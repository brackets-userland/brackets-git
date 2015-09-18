/*jshint maxstatements:false*/

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
    var Promise       = require("bluebird"),
        Cli           = require("src/Cli"),
        ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        ExpectedError = require("src/ExpectedError"),
        Preferences   = require("src/Preferences"),
        Utils         = require("src/Utils");

    // Module variables
    var _gitPath = null,
        _gitQueue = [],
        _gitQueueBusy = false;

    var FILE_STATUS = {
        STAGED: "STAGED",
        UNMODIFIED: "UNMODIFIED",
        IGNORED: "IGNORED",
        UNTRACKED: "UNTRACKED",
        MODIFIED: "MODIFIED",
        ADDED: "ADDED",
        DELETED: "DELETED",
        RENAMED: "RENAMED",
        COPIED: "COPIED",
        UNMERGED: "UNMERGED"
    };

    // This SHA1 represents the empty tree. You get it using `git mktree < /dev/null`
    var EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

    function strEndsWith(subjectString, searchString, position) {
        if (position === undefined || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    }

    /*
    function fixCygwinPath(path) {
        if (typeof path === "string" && brackets.platform === "win" && path.indexOf("/cygdrive/") === 0) {
            path = path.substring("/cygdrive/".length)
                       .replace(/^([a-z]+)\//, function (a, b) {
                           return b.toUpperCase() + ":/";
                       });
        }
        return path;
    }
    */

    /*
        git branch
        -d --delete Delete a branch.
        -D Delete a branch irrespective of its merged status.
        --no-color Turn off branch colors
        -r --remotes List or delete (if used with -d) the remote-tracking branches.
        -a --all List both remote-tracking branches and local branches.
        --track When creating a new branch, set up branch.<name>.remote and branch.<name>.merge
        --set-upstream If specified branch does not exist yet or if --force has been given, acts exactly like --track
    */

    function setUpstreamBranch(remoteName, remoteBranch) {
        if (!remoteName) { throw new TypeError("remoteName argument is missing!"); }
        if (!remoteBranch) { throw new TypeError("remoteBranch argument is missing!"); }
        return git(["branch", "--no-color", "-u", remoteName + "/" + remoteBranch]);
    }

    function branchDelete(branchName) {
        return git(["branch", "--no-color", "-d", branchName]);
    }

    function forceBranchDelete(branchName) {
        return git(["branch", "--no-color", "-D", branchName]);
    }

    /*
        git fetch
        --all Fetch all remotes.
        --dry-run Show what would be done, without making any changes.
        --multiple Allow several <repository> and <group> arguments to be specified. No <refspec>s may be specified.
        --prune After fetching, remove any remote-tracking references that no longer exist on the remote.
        --progress This flag forces progress status even if the standard error stream is not directed to a terminal.
    */

    function repositoryNotFoundHandler(err) {
        var m = ErrorHandler.matches(err, /Repository (.*) not found$/gim);
        if (m) {
            throw new ExpectedError(m[0]);
        }
        throw err;
    }

    function fetchRemote(remote) {
        return git(["fetch", "--progress", remote], {
            timeout: false // never timeout this
        }).catch(repositoryNotFoundHandler);
    }

    function fetchAllRemotes() {
        return git(["fetch", "--progress", "--all"], {
            timeout: false // never timeout this
        }).catch(repositoryNotFoundHandler);
    }

    /*
        git remote
        add Adds a remote named <name> for the repository at <url>.
        rename Rename the remote named <old> to <new>.
        remove Remove the remote named <name>.
        show Gives some information about the remote <name>.
        prune Deletes all stale remote-tracking branches under <name>.

    */

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

    /*
        git pull
        --no-commit Do not commit result after merge
        --ff-only Refuse to merge and exit with a non-zero status
                  unless the current HEAD is already up-to-date
                  or the merge can be resolved as a fast-forward.
    */

    function mergeRemote(remote, branch, ffOnly, noCommit) {
        var args = ["merge"];

        if (ffOnly) { args.push("--ff-only"); }
        if (noCommit) { args.push("--no-commit", "--no-ff"); }

        args.push(remote + "/" + branch);

        var readMergeMessage = function () {
            return Utils.loadPathContent(Preferences.get("currentGitRoot") + "/.git/MERGE_MSG").then(function (msg) {
                return msg;
            });
        };

        return git(args)
            .then(function (stdout) {
                // return stdout if available - usually not
                if (stdout) { return stdout; }

                return readMergeMessage().then(function (msg) {
                    if (msg) { return msg; }
                    return "Remote branch " + branch + " from " + remote + " was merged to current branch";
                });
            })
            .catch(function (error) {
                return readMergeMessage().then(function (msg) {
                    if (msg) { return msg; }
                    throw error;
                });
            });
    }

    function rebaseRemote(remote, branch) {
        return git(["rebase", remote + "/" + branch]);
    }

    function resetRemote(remote, branch) {
        return git(["reset", "--soft", remote + "/" + branch]).then(function (stdout) {
            return stdout || "Current branch was resetted to branch " + branch + " from " + remote;
        });
    }

    function mergeBranch(branchName, mergeMessage, useNoff) {
        var args = ["merge"];
        if (useNoff) { args.push("--no-ff"); }
        if (mergeMessage && mergeMessage.trim()) { args.push("-m", mergeMessage); }
        args.push(branchName);
        return git(args);
    }

    /*
        git push
        --porcelain Produce machine-readable output.
        --delete All listed refs are deleted from the remote repository. This is the same as prefixing all refs with a colon.
        --force Usually, the command refuses to update a remote ref that is not an ancestor of the local ref used to overwrite it.
        --set-upstream For every branch that is up to date or successfully pushed, add upstream (tracking) reference
        --progress This flag forces progress status even if the standard error stream is not directed to a terminal.
    */

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

        var args = ["push", "--porcelain", "--progress"];
        if (Array.isArray(additionalArgs)) {
            args = args.concat(additionalArgs);
        }
        args.push(remoteName);

        if (remoteBranch && Preferences.get("gerritPushref")) {
            return getConfig("gerrit.pushref").then(function (strGerritEnabled) {
                if (strGerritEnabled === "true") {
                    args.push("HEAD:refs/for/" + remoteBranch);
                } else {
                    args.push(remoteBranch);
                }
                return doPushWithArgs(args);
            });
        }

        if (remoteBranch) {
            args.push(remoteBranch);
        }

        return doPushWithArgs(args);
    }

    function doPushWithArgs(args) {
        return git(args)
            .catch(repositoryNotFoundHandler)
            .then(function (stdout) {
                // this should clear lines from push hooks
                var lines = stdout.split("\n");
                while (lines.length > 0 && lines[0].match(/^To/) === null) {
                    lines.shift();
                }

                var retObj = {},
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

    function getCurrentUpstreamBranch() {
        return git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
            .catch(function () {
                return null;
            });
    }

    // Get list of deleted files between two branches
    function getDeletedFiles(oldBranch, newBranch) {
        return git(["diff", "--no-ext-diff", "--name-status", oldBranch + ".." + newBranch])
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

    function setConfig(key, value, allowGlobal) {
        key = key.replace(/\s/g, "");
        return git(["config", key, value]).catch(function (err) {

            if (allowGlobal && ErrorHandler.contains(err, "No such file or directory")) {
                return git(["config", "--global", key, value]);
            }

            throw err;

        });
    }

    function getHistory(branch, skipCommits, file) {
        var separator = "_._",
            newline   = "_.nw._",
            format = [
                "%h",  // abbreviated commit hash
                "%H",  // commit hash
                "%an", // author name
                "%ai", // author date, ISO 8601 format
                "%ae", // author email
                "%s",  // subject
                "%b"   // body
            ].join(separator) + newline;

        var args = ["log", "-100"];
        if (skipCommits) { args.push("--skip=" + skipCommits); }
        args.push("--format=" + format, branch, "--");

        // follow is too buggy - do not use
        // if (file) { args.push("--follow"); }
        if (file) { args.push(file); }

        return git(args).then(function (stdout) {
            stdout = stdout.substring(0, stdout.length - newline.length);
            return !stdout ? [] : stdout.split(newline).map(function (line) {

                var data = line.trim().split(separator),
                    commit = {};

                commit.hashShort  = data[0];
                commit.hash       = data[1];
                commit.author     = data[2];
                commit.date       = data[3];
                commit.email      = data[4];
                commit.subject    = data[5];
                commit.body       = data[6];

                return commit;

            });
        });
    }

    function init() {
        return git(["init"]);
    }

    function clone(remoteGitUrl, destinationFolder) {
        return git(["clone", remoteGitUrl, destinationFolder, "--progress"], {
            timeout: false // never timeout this
        });
    }

    function stage(fileOrFiles, updateIndex) {
        var args = ["add"];
        if (updateIndex) { args.push("-u"); }
        return git(args.concat("--", fileOrFiles));
    }

    function stageAll() {
        return git(["add", "--all"]);
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
                // FUTURE: maybe use git commit --file=-
                var fileEntry = FileSystem.getFileForPath(Preferences.get("currentGitRoot") + ".bracketsGitTemp");
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

    function reset(type, hash) {
        var args = ["reset", type || "--mixed"]; // mixed is the default action
        if (hash) { args.push(hash, "--"); }
        return git(args);
    }

    function unstage(file) {
        return git(["reset", "--", file]);
    }

    function checkout(hash) {
        return git(["checkout", hash], {
            timeout: false // never timeout this
        });
    }

    function createBranch(branchName, originBranch, trackOrigin) {
        var args = ["checkout", "-b", branchName];

        if (originBranch) {
            if (trackOrigin) {
                args.push("--track");
            }
            args.push(originBranch);
        }

        return git(args);
    }

    function _isquoted(str) {
        return str[0] === "\"" && str[str.length - 1] === "\"";
    }

    function _unquote(str) {
        return str.substring(1, str.length - 1);
    }

    function _isescaped(str) {
        return /\\[0-9]{3}/.test(str);
    }

    function status(type) {
        return git(["status", "-u", "--porcelain"]).then(function (stdout) {
            if (!stdout) { return []; }

            var currentSubFolder = Preferences.get("currentGitSubfolder");

            // files that are modified both in index and working tree should be resetted
            var isEscaped = false,
                needReset = [],
                results = [],
                lines = stdout.split("\n");

            lines.forEach(function (line) {
                var statusStaged = line.substring(0, 1),
                    statusUnstaged = line.substring(1, 2),
                    status = [],
                    file = line.substring(3);

                // check if the file is quoted
                if (_isquoted(file)) {
                    file = _unquote(file);
                    if (_isescaped(file)) {
                        isEscaped = true;
                    }
                }

                if (statusStaged !== " " && statusUnstaged !== " " &&
                    statusStaged !== "?" && statusUnstaged !== "?") {
                    needReset.push(file);
                    return;
                }

                var statusChar;
                if (statusStaged !== " " && statusStaged !== "?") {
                    status.push(FILE_STATUS.STAGED);
                    statusChar = statusStaged;
                } else {
                    statusChar = statusUnstaged;
                }

                switch (statusChar) {
                    case " ":
                        status.push(FILE_STATUS.UNMODIFIED);
                        break;
                    case "!":
                        status.push(FILE_STATUS.IGNORED);
                        break;
                    case "?":
                        status.push(FILE_STATUS.UNTRACKED);
                        break;
                    case "M":
                        status.push(FILE_STATUS.MODIFIED);
                        break;
                    case "A":
                        status.push(FILE_STATUS.ADDED);
                        break;
                    case "D":
                        status.push(FILE_STATUS.DELETED);
                        break;
                    case "R":
                        status.push(FILE_STATUS.RENAMED);
                        break;
                    case "C":
                        status.push(FILE_STATUS.COPIED);
                        break;
                    case "U":
                        status.push(FILE_STATUS.UNMERGED);
                        break;
                    default:
                        throw new Error("Unexpected status: " + statusChar);
                }

                var display = file,
                    io = file.indexOf("->");
                if (io !== -1) {
                    file = file.substring(io + 2).trim();
                }

                // we don't want to display paths that lead to this file outside the project
                if (currentSubFolder && display.indexOf(currentSubFolder) === 0) {
                    display = display.substring(currentSubFolder.length);
                }

                results.push({
                    status: status,
                    display: display,
                    file: file,
                    name: file.substring(file.lastIndexOf("/") + 1)
                });
            });

            if (isEscaped) {
                return setConfig("core.quotepath", "false").then(function () {
                    if (type === "SET_QUOTEPATH") {
                        throw new Error("git status is calling itself in a recursive loop!");
                    }
                    return status("SET_QUOTEPATH");
                });
            }

            if (needReset.length > 0) {
                return Promise.all(needReset.map(function (fileName) {
                    if (fileName.indexOf("->") !== -1) {
                        fileName = fileName.split("->")[1].trim();
                    }
                    return unstage(fileName);
                })).then(function () {
                    if (type === "RECURSIVE_CALL") {
                        throw new Error("git status is calling itself in a recursive loop!");
                    }
                    return status("RECURSIVE_CALL");
                });
            }

            return results.sort(function (a, b) {
                if (a.file < b.file) {
                    return -1;
                }
                if (a.file > b.file) {
                    return 1;
                }
                return 0;
            });
        }).then(function (results) {
            EventEmitter.emit(Events.GIT_STATUS_RESULTS, results);
            return results;
        });
    }

    function _isFileStaged(file) {
        return git(["status", "-u", "--porcelain", "--", file]).then(function (stdout) {
            if (!stdout) { return false; }
            return _.any(stdout.split("\n"), function (line) {
                return line[0] !== " " && line[0] !== "?" && // first character marks staged status
                       line.lastIndexOf(" " + file) === line.length - file.length - 1; // in case another file appeared here?
            });
        });
    }

    function getDiffOfStagedFiles() {
        return git(["diff", "--no-ext-diff", "--no-color", "--staged"], {
            timeout: false // never timeout this
        });
    }

    function getDiffOfAllIndexFiles(files) {
        var args = ["diff", "--no-ext-diff", "--no-color", "--full-index"];
        if (files) {
            args = args.concat("--", files);
        }
        return git(args, {
            timeout: false // never timeout this
        });
    }

    function getListOfStagedFiles() {
        return git(["diff", "--no-ext-diff", "--no-color", "--staged", "--name-only"], {
            timeout: false // never timeout this
        });
    }

    function diffFile(file) {
        return _isFileStaged(file).then(function (staged) {
            var args = ["diff", "--no-ext-diff", "--no-color"];
            if (staged) { args.push("--staged"); }
            args.push("-U0", "--", file);
            return git(args, {
                timeout: false // never timeout this
            });
        });
    }

    function diffFileNice(file) {
        return _isFileStaged(file).then(function (staged) {
            var args = ["diff", "--no-ext-diff", "--no-color"];
            if (staged) { args.push("--staged"); }
            args.push("--", file);
            return git(args, {
                timeout: false // never timeout this
            });
        });
    }

    function difftool(file) {
        return _isFileStaged(file).then(function (staged) {
            var args = ["difftool"];
            if (staged) {
                args.push("--staged");
            }
            args.push("--", file);
            return git(args, {
                timeout: false, // never timeout this
                nonblocking: true // allow running other commands before this command finishes its work
            });
        });
    }

    function clean() {
        return git(["clean", "-f", "-d"]);
    }

    function getFilesFromCommit(hash, isInitial) {
        var args = ["diff", "--no-ext-diff", "--name-only"];
        args = args.concat((isInitial ? EMPTY_TREE : hash + "^") + ".." + hash);
        return git(args).then(function (stdout) {
            return !stdout ? [] : stdout.split("\n");
        });
    }

    function getDiffOfFileFromCommit(hash, file, isInitial) {
        var args = ["diff", "--no-ext-diff", "--no-color"];
        args = args.concat((isInitial ? EMPTY_TREE : hash + "^") + ".." + hash);
        args = args.concat("--", file);
        return git(args);
    }

    function difftoolFromHash(hash, file, isInitial) {
        return git(["difftool", (isInitial ? EMPTY_TREE : hash + "^") + ".." + hash, "--", file], {
            timeout: false // never timeout this
        });
    }

    function rebaseInit(branchName) {
        return git(["rebase", "--ignore-date", branchName]);
    }

    function rebase(whatToDo) {
        return git(["rebase", "--" + whatToDo]);
    }

    function getVersion() {
        return git(["--version"]).then(function (stdout) {
            var m = stdout.match(/[0-9].*/);
            return m ? m[0] : stdout.trim();
        });
    }

    function getCommitsAhead() {
        return git(["rev-list", "HEAD", "--not", "--remotes"]).then(function (stdout) {
            return !stdout ? [] : stdout.split("\n");
        });
    }

    function getLastCommitMessage() {
        return git(["log", "-1", "--pretty=%B"]).then(function (stdout) {
            return stdout.trim();
        });
    }

    function getBlame(file, from, to) {
        var args = ["blame", "-w", "--line-porcelain"];
        if (from || to) { args.push("-L" + from + "," + to); }
        args.push(file);

        return git(args).then(function (stdout) {
            if (!stdout) { return []; }

            var sep  = "-@-BREAK-HERE-@-",
                sep2 = "$$#-#$BREAK$$-$#";
            stdout = stdout.replace(sep, sep2)
                           .replace(/^\t(.*)$/gm, function (a, b) { return b + sep; });

            return stdout.split(sep).reduce(function (arr, lineInfo) {
                lineInfo = lineInfo.replace(sep2, sep).trimLeft();
                if (!lineInfo) { return arr; }

                var obj = {},
                    lines = lineInfo.split("\n"),
                    firstLine = _.first(lines).split(" ");

                obj.hash = firstLine[0];
                obj.num = firstLine[2];
                obj.content = _.last(lines);

                // process all but first and last lines
                for (var i = 1, l = lines.length - 1; i < l; i++) {
                    var line = lines[i],
                        io = line.indexOf(" "),
                        key = line.substring(0, io),
                        val = line.substring(io + 1);
                    obj[key] = val;
                }

                arr.push(obj);
                return arr;
            }, []);
        }).catch(function (stderr) {
            var m = stderr.match(/no such path (\S+)/);
            if (m) {
                throw new Error("File is not tracked by Git: " + m[1]);
            }
            throw stderr;
        });
    }

    // Public API
    exports._git                      = git;
    exports.setGitPath                = setGitPath;
    exports.FILE_STATUS               = FILE_STATUS;
    exports.fetchRemote               = fetchRemote;
    exports.fetchAllRemotes           = fetchAllRemotes;
    exports.getRemotes                = getRemotes;
    exports.createRemote              = createRemote;
    exports.deleteRemote              = deleteRemote;
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
    exports.getDeletedFiles           = getDeletedFiles;
    exports.getHistory                = getHistory;
    exports.init                      = init;
    exports.clone                     = clone;
    exports.stage                     = stage;
    exports.unstage                   = unstage;
    exports.stageAll                  = stageAll;
    exports.commit                    = commit;
    exports.reset                     = reset;
    exports.checkout                  = checkout;
    exports.createBranch              = createBranch;
    exports.status                    = status;
    exports.diffFile                  = diffFile;
    exports.diffFileNice              = diffFileNice;
    exports.difftool                  = difftool;
    exports.clean                     = clean;
    exports.getFilesFromCommit        = getFilesFromCommit;
    exports.getDiffOfFileFromCommit   = getDiffOfFileFromCommit;
    exports.difftoolFromHash          = difftoolFromHash;
    exports.rebase                    = rebase;
    exports.rebaseInit                = rebaseInit;
    exports.mergeRemote               = mergeRemote;
    exports.rebaseRemote              = rebaseRemote;
    exports.resetRemote               = resetRemote;
    exports.getVersion                = getVersion;
    exports.getCommitsAhead           = getCommitsAhead;
    exports.getLastCommitMessage      = getLastCommitMessage;
    exports.mergeBranch               = mergeBranch;
    exports.getDiffOfAllIndexFiles    = getDiffOfAllIndexFiles;
    exports.getDiffOfStagedFiles      = getDiffOfStagedFiles;
    exports.getListOfStagedFiles      = getListOfStagedFiles;
    exports.getBlame                  = getBlame;
});
