/*
    This module is used to communicate with Git through Cli
    Output string from Git should always be parsed here
    to provide more sensible outputs than just plain strings.
    Format of the output should be specified in Git.js
*/
define(function (require, exports) {

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash");

    // Local modules
    var Cli         = require("src/Cli"),
        Preferences = require("src/Preferences");

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

    function getCurrentBranchName() {
        return git(["rev-parse", "--abbrev-ref", "HEAD"]);
    }

    function getBranches(moreArgs) {
        var args = ["branch"];
        if (moreArgs) { args = args.concat(moreArgs); }

        return git(args).then(function (stdout) {
            if (!stdout) { return []; }
            return stdout.split("\n").map(function (l) {
                var name = l.trim(),
                    currentBranch = false,
                    remote = null;

                if (name.indexOf("* ") === 0) {
                    name = name.substring(2);
                    currentBranch = true;
                }

                if (name.indexOf("remotes/") === 0) {
                    name = name.substring("remotes/".length);
                    remote = name.substring(0, name.indexOf("/"));
                }

                return {
                    name: name,
                    currentBranch: currentBranch,
                    remote: remote
                };
            });
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

    // Public API
    exports.git                       = git;
    exports.fetchAllRemotes           = fetchAllRemotes;
    exports.getRemotes                = getRemotes;
    exports.createRemote              = createRemote;
    exports.deleteRemote              = deleteRemote;
    exports.pull                      = pull;
    exports.push                      = push;
    exports.setUpstreamBranch         = setUpstreamBranch;
    exports.getCurrentBranchName      = getCurrentBranchName;
    exports.getCurrentUpstreamBranch  = getCurrentUpstreamBranch;
    exports.getConfig                 = getConfig;
    exports.setConfig                 = setConfig;
    exports.getBranches               = getBranches;
    exports.getAllBranches            = getAllBranches;
    exports.branchDelete              = branchDelete;
    exports.forceBranchDelete         = forceBranchDelete;

});
