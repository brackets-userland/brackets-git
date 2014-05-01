/*jshint maxstatements:false*/

/*
    This module is used to communicate with Git through Cli
    Output string from Git should always be parsed here
    to provide more sensible outputs than just plain strings.
    Format of the output should be specified in Git.js
*/
var querystring = require('querystring');

define(function (require, exports) {

    // Brackets modules
    var _           = brackets.getModule("thirdparty/lodash"),
        FileSystem  = brackets.getModule("filesystem/FileSystem"),
        FileUtils   = brackets.getModule("file/FileUtils");

    // Local modules
    var Promise       = require("bluebird"),
        Cli           = require("src/Cli"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
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

    // Implementation
    function getGitPath() {
        if (_gitPath) { return _gitPath; }
        _gitPath = Preferences.get("gitPath");
        return _gitPath;
    }

    function setGitPath(path) {
        if (path === true) { path = "git"; }
        Preferences.set("gitPath", path);
        _gitPath = path;
    }

    function _processQueue() {
        // do nothing if the queue is busy
        if (_gitQueueBusy) {
            return;
        }
        // do nothing if the queue is empty
        if (_gitQueue.length === 0) {
            _gitQueueBusy = false;
            return;
        }
        // get item from queue
        var item  = _gitQueue.shift(),
            defer = item[0],
            args  = item[1],
            opts  = item[2];
        // execute git command in a queue so no two commands are running at the same time
        _gitQueueBusy = true;
        Cli.spawnCommand(getGitPath(), args, opts)
            .progressed(function () {
                defer.progress.apply(defer, arguments);
            })
            .then(function (r) {
                defer.resolve(r);
            })
            .catch(function (e) {
                var call = "call: git " + args.join(" ");
                e.stack = [call, e.stack].join("\n");
                defer.reject(e);
            })
            .finally(function () {
                _gitQueueBusy = false;
                _processQueue();
            });
    }

    function git(args, opts) {
        var rv = Promise.defer();
        _gitQueue.push([rv, args || [], opts || {}]);
        _processQueue();
        return rv.promise;
    }

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

    function getBranches(moreArgs) {
        var args = ["branch", "--no-color"];
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

    /*
        git fetch
        --all Fetch all remotes.
        --dry-run Show what would be done, without making any changes.
        --multiple Allow several <repository> and <group> arguments to be specified. No <refspec>s may be specified.
        --prune After fetching, remove any remote-tracking references that no longer exist on the remote.
        --progress This flag forces progress status even if the standard error stream is not directed to a terminal.
    */

    function fetchRemote(remote) {
        return git(["fetch", "--progress", remote]);
    }

    function fetchAllRemotes() {
        return git(["fetch", "--progress", "--all"]);
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
            return Utils.loadPathContent(Utils.getProjectRoot() + "/.git/MERGE_MSG").then(function (msg) {
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

    function mergeBranch(branchName, mergeMessage) {
        var args = ["merge", "--no-ff"];
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

    function getCurrentBranchName() {
        return git(["branch"]).then(function (stdout) {
            var branchName = _.find(stdout.split("\n"), function (l) { return l[0] === "*"; });
            if (branchName) {
                branchName = branchName.substring(1).trim();

                var m = branchName.match(/^\(.*\s(\S+)\)$/); // like (detached from f74acd4)
                if (m) { return m[1]; }

                return branchName;
            }

            // no branch situation so we need to create one by doing a commit
            if (stdout.match(/^\s*$/)) {
                return EventEmitter.emit(Events.GIT_NO_BRANCH_EXISTS);
            }

            // alternative
            return git(["log", "--pretty=format:%H %d", "-1"]).then(function (stdout) {
                var m = stdout.trim().match(/^(\S+)\s+\((.*)\)$/);
                var hash = m[1].substring(0, 20);
                m[2].split(",").forEach(function (info) {
                    info = info.trim();

                    if (info === "HEAD") { return; }

                    var m = info.match(/^tag:(.+)$/);
                    if (m) {
                        hash = m[1].trim();
                        return;
                    }

                    hash = info;
                });
                return hash;
            });
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

    function setConfig(key, value) {
        return git(["config", key.replace(/\s/g, ""), value]);
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
        args.push("--format=" + format);
        args.push(branch);
        // follow is too buggy - do not use
        // if (file) { args.push("--follow"); }
        if (file) { args.push(file); }

        return git(args).then(function (stdout) {
            stdout = stdout.substring(0, stdout.length - newline.length);
            return !stdout ? [] : stdout.split(newline).map(function (line) {

                var data = line.split(separator),
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
        return git(["clone", remoteGitUrl, destinationFolder, "--progress"]);
    }

    function stage(file, updateIndex) {
        var args = ["add"];
        if (updateIndex) { args.push("-u"); }
        args.push("--", file);
        return git(args);
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

    function _unquote(str) {
        if (str[0] === "\"" && str[str.length - 1] === "\"") {
            str = str.substring(1, str.length - 1);
        }
        return str;
    }

    function status(type) {
        return git(["status", "-u", "--porcelain"]).then(function (stdout) {
            if (!stdout) { return []; }

            // files that are modified both in index and working tree should be resetted
            var needReset = [],
                results = [],
                lines = stdout.split("\n");

            lines.forEach(function (line) {
                var statusStaged = line.substring(0, 1),
                    statusUnstaged = line.substring(1, 2),
                    status = [],
                    file = _unquote(line.substring(3));

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

                results.push({
                    status: status,
                    display: display,
                    file: file,
                    name: file.substring(file.lastIndexOf("/") + 1)
                });
            });

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
                return line.match("^(\\S)(.)\\s+(" + querystring.escape(file) + ")$") !== null;
            });
        });
    }

    function getDiffOfStagedFiles() {
        return git(["diff", "--no-ext-diff", "--no-color", "--staged"]);
    }

    function getListOfStagedFiles() {
        return git(["diff", "--no-ext-diff", "--no-color", "--staged", "--name-only"]);
    }

    function diffFile(file) {
        return _isFileStaged(file).then(function (staged) {
            var args = ["diff", "--no-ext-diff", "--no-color"];
            if (staged) { args.push("--staged"); }
            args.push("-U0", "--", file);
            return git(args);
        });
    }

    function diffFileNice(file) {
        return _isFileStaged(file).then(function (staged) {
            var args = ["diff", "--no-ext-diff", "--no-color"];
            if (staged) { args.push("--staged"); }
            args.push("--", file);
            return git(args);
        });
    }

    function clean() {
        return git(["clean", "-f", "-d"]);
    }

    function getFilesFromCommit(hash) {
        return git(["diff", "--no-ext-diff", "--name-only", hash + "^!"]).then(function (stdout) {
            return !stdout ? [] : stdout.split("\n");
        });
    }

    function getDiffOfFileFromCommit(hash, file) {
        return git(["diff", "--no-ext-diff", "--no-color", hash + "^!", "--", file]);
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
    exports.clean                     = clean;
    exports.getFilesFromCommit        = getFilesFromCommit;
    exports.getDiffOfFileFromCommit   = getDiffOfFileFromCommit;
    exports.rebase                    = rebase;
    exports.rebaseInit                = rebaseInit;
    exports.mergeRemote               = mergeRemote;
    exports.rebaseRemote              = rebaseRemote;
    exports.resetRemote               = resetRemote;
    exports.getVersion                = getVersion;
    exports.getCommitsAhead           = getCommitsAhead;
    exports.getLastCommitMessage      = getLastCommitMessage;
    exports.mergeBranch               = mergeBranch;
    exports.getDiffOfStagedFiles      = getDiffOfStagedFiles;
    exports.getListOfStagedFiles      = getListOfStagedFiles;
    exports.getBlame                  = getBlame;

});
