/*
    This module is used to communicate with Git through Cli
    Output string from Git should always be parsed here
    to provide more sensible outputs than just plain strings.
    Format of the output should be specified in Git.js
*/
define(function (require, exports) {

    // Brackets modules
    var _           = brackets.getModule("thirdparty/lodash"),
        FileSystem  = brackets.getModule("filesystem/FileSystem"),
        FileUtils   = brackets.getModule("file/FileUtils");

    // Local modules
    var Promise     = require("bluebird"),
        Cli         = require("src/Cli"),
        Preferences = require("src/Preferences"),
        Utils       = require("src/Utils");

    // Module variables
    var _gitPath = null;

    // Implementation
    function getGitPath() {
        return _gitPath || (Preferences.get("gitIsInSystemPath") ? "git" : Preferences.get("gitPath"));
    }

    function git(args) {
        return Cli.spawnCommand(getGitPath(), args);
    }

    function fetchAllRemotes() {
        return git(["fetch", "--all"]).then(function (stdout) {
            // TODO: parse?
            return stdout;
        });
    }

    function getRemotes() {
        return git(["remote", "-v"])
            .then(function (stdout) {
                return !stdout ? [] : _.uniq(stdout.replace(/\((push|fetch)\)/g, "").split("\n")).map(function (l) {
                    var s = l.trim().split("\t");
                    return {
                        name: s[0],
                        url: s[1]
                    };
                });
            });
    }

    function createRemote(name, url) {
        return git(["remote", "add", name, url])
            .then(function () {
                // stdout is empty so just return success
                return true;
            });
    }

    function deleteRemote(name) {
        return git(["remote", "rm", name])
            .then(function () {
                // stdout is empty so just return success
                return true;
            });
    }

    function pull(remoteName) {
        return git(["pull", "--ff-only", remoteName])
            .then(function (stdout) {
                // stdout contains currently non-parseable message
                return stdout;
            });
    }

    /*
        returns parsed push response in this format:
        {
            flag: "="
            flagDescription: "Ref was up to date and did not need pushing"
            from: "refs/heads/rewrite-remotes"
            remoteUrl: "http://github.com/zaggino/brackets-git.git"
            status: "Done"
            summary: "[up to date]"
            to: "refs/heads/rewrite-remotes"
        }
    */
    function push(remoteName, remoteBranch, additionalArgs) {
        if (!remoteName) { throw new TypeError("remoteName argument is missing!"); }

        var args = ["push", "--porcelain"];
        if (Array.isArray(additionalArgs)) {
            args = args.concat(additionalArgs);
        }
        args.push(remoteName);

        if (remoteBranch) {
            args.push(remoteBranch);
        }

        return git(args)
            .then(function (stdout) {
                var retObj = {},
                    lines = stdout.split("\n"),
                    lineTwo = lines[1].split("\t");

                retObj.remoteUrl = lines[0].trim().split(" ")[1];
                retObj.flag = lineTwo[0];
                retObj.from = lineTwo[1].split(":")[0];
                retObj.to = lineTwo[1].split(":")[1];
                retObj.summary = lineTwo[2];
                retObj.status = lines[2];

                switch (retObj.flag) {
                    case " ":
                        retObj.flagDescription = "Successfully pushed fast-forward";
                        break;
                    case "+":
                        retObj.flagDescription = "Successful forced update";
                        break;
                    case "-":
                        retObj.flagDescription = "Successfully deleted ref";
                        break;
                    case "*":
                        retObj.flagDescription = "Successfully pushed new ref";
                        break;
                    case "!":
                        retObj.flagDescription = "Ref was rejected or failed to push";
                        break;
                    case "=":
                        retObj.flagDescription = "Ref was up to date and did not need pushing";
                        break;
                    default:
                        retObj.flagDescription = "Unknown push flag received: " + retObj.flag;
                }

                return retObj;
            });
    }

    function setUpstreamBranch(remoteName, remoteBranch) {
        if (!remoteName) { throw new TypeError("remoteName argument is missing!"); }
        if (!remoteBranch) { throw new TypeError("remoteBranch argument is missing!"); }
        return git(["branch", "-u", remoteName + "/" + remoteBranch]);
    }

    function getCurrentBranchHash() {
        return git(["rev-parse", "--abbrev-ref", "HEAD"]);
    }

    function getCurrentBranchName() {
        return git(["symbolic-ref", "--short", "HEAD"]);
    }

    function getBranches(moreArgs) {
        var args = ["branch"];
        if (moreArgs) { args = args.concat(moreArgs); }

        return git(args).then(function (stdout) {
            if (!stdout) { return []; }
            return stdout.split("\n").reduce(function (arr, l) {
                var name = l.trim(),
                    currentBranch = false,
                    remote = null,
                    sortPrefix = "";

                if (name.indexOf("->") !== -1) {
                    return arr;
                }

                if (name.indexOf("* ") === 0) {
                    name = name.substring(2);
                    currentBranch = true;
                }

                if (name.indexOf("remotes/") === 0) {
                    name = name.substring("remotes/".length);
                    remote = name.substring(0, name.indexOf("/"));
                }

                var sortName = name.toLowerCase();
                if (remote) {
                    sortName = sortName.substring(remote.length + 1);
                }
                if (sortName.indexOf("#") !== -1) {
                    sortPrefix = sortName.slice(0, sortName.indexOf("#"));
                }

                arr.push({
                    name: name,
                    sortPrefix: sortPrefix,
                    sortName: sortName,
                    currentBranch: currentBranch,
                    remote: remote
                });
                return arr;
            }, []);
        });
    }

    function getAllBranches() {
        return getBranches(["-a"]);
    }

    function getCurrentUpstreamBranch() {
        return git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
            .catch(function () {
                return null;
            });
    }

    // Get list of deleted files between two branches
    function getDeletedFiles(oldBranch, newBranch) {
        return git(["diff", "--name-status", oldBranch + ".." + newBranch])
            .then(function (stdout) {
                var regex = /^D/;
                return stdout.split("\n").reduce(function (arr, row) {
                    if (regex.test(row)) {
                        arr.push(row.substring(1).trim());
                    }
                    return arr;
                }, []);
            });
    }

    function getConfig(key) {
        return git(["config", key.replace(/\s/g, "")]);
    }

    function setConfig(key, value) {
        return git(["config", key.replace(/\s/g, ""), value]);
    }

    function branchDelete(branchName) {
        return git(["branch", "-d", branchName]);
    }

    function forceBranchDelete(branchName) {
        return git(["branch", "-D", branchName]);
    }

    function getHistory(branch, skipCommits, file) {
        var separator = "_._",
            items  = ["hashShort", "hash", "author", "date", "message"],
            format = ["%h",        "%H",   "%an",    "%ai",  "%s"     ].join(separator);

        var args = ["log", "-100"];
        if (skipCommits) { args.push("--skip=" + skipCommits); }
        args.push("--format=" + format);
        args.push(branch);
        if (file) { args.push("--follow", file); }

        return git(args).then(function (stdout) {
            return !stdout ? [] : stdout.split("\n").map(function (line) {
                var result = {},
                    data = line.split(separator);
                items.forEach(function (name, i) {
                    result[name] = data[i];
                });
                return result;
            });
        });
    }

    function init() {
        return git(["init"]);
    }

    function clone(remoteGitUrl, destinationFolder) {
        return git(["clone", remoteGitUrl, destinationFolder, "--progress"]);
    }

    function stage(file, updateIndex) {
        var args = ["add"];
        if (updateIndex) { args.push("-u"); }
        args.push(file);
        return git(args);
    }

    function commit(message, amend) {
        var lines = message.split("\n"),
            args = ["commit"];

        if (amend) {
            args.push("--amend", "--reset-author");
        }

        if (lines.length === 1) {
            args.push("-m", message);
            return git(args);
        } else {
            return new Promise(function (resolve, reject) {
                // TODO: maybe use git commit --file=-
                var fileEntry = FileSystem.getFileForPath(Utils.getProjectRoot() + ".bracketsGitTemp");
                Promise.cast(FileUtils.writeText(fileEntry, message))
                    .then(function () {
                        args.push("-F", ".bracketsGitTemp");
                        return git(args);
                    })
                    .then(function (res) {
                        fileEntry.unlink(function () {
                            resolve(res);
                        });
                    })
                    .catch(function (err) {
                        fileEntry.unlink(function () {
                            reject(err);
                        });
                    });
            });
        }
    }

    // Public API
    exports.git                       = git;
    exports.fetchAllRemotes           = fetchAllRemotes;
    exports.getRemotes                = getRemotes;
    exports.createRemote              = createRemote;
    exports.deleteRemote              = deleteRemote;
    exports.pull                      = pull;
    exports.push                      = push;
    exports.setUpstreamBranch         = setUpstreamBranch;
    exports.getCurrentBranchHash      = getCurrentBranchHash;
    exports.getCurrentBranchName      = getCurrentBranchName;
    exports.getCurrentUpstreamBranch  = getCurrentUpstreamBranch;
    exports.getConfig                 = getConfig;
    exports.setConfig                 = setConfig;
    exports.getBranches               = getBranches;
    exports.getAllBranches            = getAllBranches;
    exports.branchDelete              = branchDelete;
    exports.forceBranchDelete         = forceBranchDelete;
    exports.getDeletedFiles           = getDeletedFiles;
    exports.getHistory                = getHistory;
    exports.init                      = init;
    exports.clone                     = clone;
    exports.stage                     = stage;
    exports.commit                    = commit;

});
