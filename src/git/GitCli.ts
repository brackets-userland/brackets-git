/*
    This module is used to communicate with Git through Cli
    Output string from Git should always be parsed here
    to provide more sensible outputs than just plain strings.
    Format of the output should be specified in Git.js
*/

import * as Promise from "bluebird";
import * as Cli from "../Cli";
import * as ErrorHandler from "../ErrorHandler";
import * as Events from "../Events";
import EventEmitter from "../EventEmitter";
import ExpectedError from "../ExpectedError";
import * as Preferences from "../Preferences";
import { consoleDebug, defer, getProjectRoot, loadPathContent } from "../Utils";
import { _, FileSystem, FileUtils } from "../brackets-modules";

let _gitPath = null;
const _gitQueue = [];
let _gitQueueBusy = false;

export const FILE_STATUS = {
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
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function getGitPath() {
    if (_gitPath) { return _gitPath; }
    _gitPath = Preferences.get("gitPath");
    return _gitPath;
}

export function setGitPath(path) {
    const _path = path === true ? "git" : path;
    Preferences.set("gitPath", _path);
    _gitPath = _path;
}

function strEndsWith(subjectString, searchString, position?) {
    let _position = position;
    if (_position == null || _position > subjectString.length) {
        _position = subjectString.length;
    }
    _position -= searchString.length;
    const lastIndex = subjectString.indexOf(searchString, _position);
    return lastIndex !== -1 && lastIndex === _position;
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
    const item = _gitQueue.shift();
    const deferObj = item[0];
    const args = item[1];
    const opts = item[2];
    // execute git command in a queue so no two commands are running at the same time
    if (opts.nonblocking !== true) { _gitQueueBusy = true; }
    Cli.spawnCommand(getGitPath(), args, opts)
        .progressed((...progressedArgs) => deferObj.progress(...progressedArgs))
        .then((r) => deferObj.resolve(r))
        .catch((e) => {
            const call = "call: git " + args.join(" ");
            e.stack = [call, e.stack].join("\n");
            deferObj.reject(e);
        })
        .finally(() => {
            if (opts.nonblocking !== true) { _gitQueueBusy = false; }
            _processQueue();
        });
}

export function git(args: string[] = [], opts: Cli.CliOptions = {}): Promise<string> {
    const rv = defer();
    _gitQueue.push([rv, args, opts]);
    _processQueue();
    return rv.promise as Promise<string>;
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

export function setUpstreamBranch(remoteName, remoteBranch) {
    if (!remoteName) { throw new TypeError("remoteName argument is missing!"); }
    if (!remoteBranch) { throw new TypeError("remoteBranch argument is missing!"); }
    return git(["branch", "--no-color", "-u", remoteName + "/" + remoteBranch]);
}

export function branchDelete(branchName) {
    return git(["branch", "--no-color", "-d", branchName]);
}

export function forceBranchDelete(branchName) {
    return git(["branch", "--no-color", "-D", branchName]);
}

export function getBranches(moreArgs = []) {
    const args = ["branch", "--no-color"].concat(moreArgs);
    return git(args).then((stdout) => {
        if (!stdout) { return []; }
        return stdout.split("\n").reduce((arr, l) => {
            let name = l.trim();
            let currentBranch = false;
            let remote = null;
            let sortPrefix = "";

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

            let sortName = name.toLowerCase();
            if (remote) {
                sortName = sortName.substring(remote.length + 1);
            }
            if (sortName.indexOf("#") !== -1) {
                sortPrefix = sortName.slice(0, sortName.indexOf("#"));
            }

            arr.push({
                name,
                sortPrefix,
                sortName,
                currentBranch,
                remote
            });
            return arr;
        }, []);
    });
}

export function getAllBranches() {
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

function repositoryNotFoundHandler(err) {
    const m = ErrorHandler.matches(err, /Repository (.*) not found$/gim);
    if (m) {
        throw new ExpectedError(m[0]);
    }
    throw err;
}

export function fetchRemote(remote) {
    return git(["fetch", "--progress", remote], {
        timeout: false // never timeout this
    }).catch(repositoryNotFoundHandler);
}

export function fetchAllRemotes() {
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

export function getRemotes() {
    return git(["remote", "-v"])
        .then((stdout) => {
            return !stdout ? [] : _.uniq(stdout.replace(/\((push|fetch)\)/g, "").split("\n")).map((l) => {
                const s = l.trim().split("\t");
                return {
                    name: s[0],
                    url: s[1]
                };
            });
        });
}

export function createRemote(name, url) {
    return git(["remote", "add", name, url])
        .then(() => {
            // stdout is empty so just return success
            return true;
        });
}

export function deleteRemote(name) {
    return git(["remote", "rm", name])
        .then(() => {
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

export function mergeRemote(remote, branch, ffOnly = false, noCommit = false) {
    const args = ["merge"];

    if (ffOnly) { args.push("--ff-only"); }
    if (noCommit) { args.push("--no-commit", "--no-ff"); }

    args.push(remote + "/" + branch);

    const readMergeMessage = () => loadPathContent(Preferences.get("currentGitRoot") + "/.git/MERGE_MSG");

    return git(args)
        .then((stdout) => {
            // return stdout if available - usually not
            if (stdout) { return stdout; }

            return readMergeMessage().then((msg) => {
                if (msg) { return msg; }
                return "Remote branch " + branch + " from " + remote + " was merged to current branch";
            });
        })
        .catch((error) => {
            return readMergeMessage().then((msg) => {
                if (msg) { return msg; }
                throw error;
            });
        });
}

export function rebaseRemote(remote, branch) {
    return git(["rebase", remote + "/" + branch]);
}

export function resetRemote(remote, branch) {
    return git(["reset", "--soft", remote + "/" + branch]).then((stdout) => {
        return stdout || "Current branch was resetted to branch " + branch + " from " + remote;
    });
}

export function mergeBranch(branchName, mergeMessage, useNoff) {
    const args = ["merge"];
    if (useNoff) { args.push("--no-ff"); }
    if (mergeMessage && mergeMessage.trim()) { args.push("-m", mergeMessage); }
    args.push(branchName);
    return git(args);
}

/*
    git push
    --porcelain Produce machine-readable output.
    --delete All listed refs are deleted from the remote repository.
             This is the same as prefixing all refs with a colon.
    --force Usually, the command refuses to update a remote ref that
            is not an ancestor of the local ref used to overwrite it.
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
export function push(remoteName, remoteBranch, additionalArgs) {
    if (!remoteName) { throw new TypeError("remoteName argument is missing!"); }

    let args = ["push", "--porcelain", "--progress"];
    if (Array.isArray(additionalArgs)) {
        args = args.concat(additionalArgs);
    }
    args.push(remoteName);

    if (remoteBranch && Preferences.get("gerritPushref")) {
        return getConfig("gerrit.pushref").then((strGerritEnabled) => {
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

export interface PushResult {
    flag: string;
    flagDescription?: string;
    from: string;
    to: string;
    summary: string;
    status: string;
    remoteUrl: string;
}

function doPushWithArgs(args): Promise<PushResult> {
    return git(args)
        .catch(repositoryNotFoundHandler)
        .then((stdout) => {
            // this should clear lines from push hooks
            const lines = stdout.split("\n");
            while (lines.length > 0 && lines[0].match(/^To/) === null) {
                lines.shift();
            }

            const lineTwo = lines[1].split("\t");

            const retObj: PushResult = {
                remoteUrl: lines[0].trim().split(" ")[1],
                flag: lineTwo[0],
                from: lineTwo[1].split(":")[0],
                to: lineTwo[1].split(":")[1],
                summary: lineTwo[2],
                status: lines[2]
            };

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

export function getCurrentBranchName() {
    return git(["branch", "--no-color"]).then((branchOut) => {
        let branchName = _.find(branchOut.split("\n"), (l) => l[0] === "*");
        if (branchName) {
            branchName = branchName.substring(1).trim();

            const m = branchName.match(/^\(.*\s(\S+)\)$/); // like (detached from f74acd4)
            if (m) { return m[1]; }

            return branchName;
        }

        // no branch situation so we need to create one by doing a commit
        if (branchOut.match(/^\s*$/)) {
            EventEmitter.emit(Events.GIT_NO_BRANCH_EXISTS);
            // master is the default name of the branch after git init
            return "master";
        }

        // alternative
        return git(["log", "--pretty=format:%H %d", "-1"]).then((logOut) => {
            const logMatch = logOut.trim().match(/^(\S+)\s+\((.*)\)$/);
            let hash = logMatch[1].substring(0, 20);
            logMatch[2].split(",").forEach((_info) => {
                const info = _info.trim();

                if (info === "HEAD") { return; }

                const tagMatch = info.match(/^tag:(.+)$/);
                if (tagMatch) {
                    hash = tagMatch[1].trim();
                    return;
                }

                hash = info;
            });
            return hash;
        });
    });
}

export function getCurrentUpstreamBranch(): Promise<string | null> {
    return git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => null);
}

// Get list of deleted files between two branches
export function getDeletedFiles(oldBranch, newBranch) {
    return git(["diff", "--no-ext-diff", "--name-status", oldBranch + ".." + newBranch])
        .then((stdout) => {
            return stdout.split("\n").reduce((arr, row) => {
                if (/^D/.test(row)) {
                    arr.push(row.substring(1).trim());
                }
                return arr;
            }, []);
        });
}

export function getConfig(key) {
    return git(["config", key.replace(/\s/g, "")]);
}

export function setConfig(key, value, allowGlobal = false) {
    const _key = key.replace(/\s/g, "");
    return git(["config", _key, value]).catch((err) => {
        if (allowGlobal && ErrorHandler.contains(err, "No such file or directory")) {
            return git(["config", "--global", _key, value]);
        }
        throw err;
    });
}

export interface CommitInfo {
    hashShort: string;
    hash: string;
    author: string;
    date: string;
    email: string;
    subject: string;
    body: string;
    tags?: string[];
}

export function getHistory(branch, skipCommits, file = null): Promise<CommitInfo[]> {
    const separator = "_._";
    const newline = "_.nw._";
    const format = [
        "%h",  // abbreviated commit hash
        "%H",  // commit hash
        "%an", // author name
        "%ai", // author date, ISO 8601 format
        "%ae", // author email
        "%s",  // subject
        "%b",  // body
        "%d"   // tags
    ].join(separator) + newline;

    const args = ["log", "-100"];
    if (skipCommits) { args.push("--skip=" + skipCommits); }
    args.push("--format=" + format, branch, "--");

    // follow is too buggy - do not use
    // if (file) { args.push("--follow"); }
    if (file) { args.push(file); }

    return git(args).then((_stdout) => {
        const stdout = _stdout.substring(0, _stdout.length - newline.length);
        return !stdout ? [] : stdout.split(newline).map((line) => {

            const data = line.trim().split(separator);

            const commitInfo: CommitInfo = {
                hashShort: data[0],
                hash: data[1],
                author: data[2],
                date: data[3],
                email: data[4],
                subject: data[5],
                body: data[6]
            };

            if (data[7]) {
                const tags = data[7].match(/tag: ([^,|\)]+)/g);
                for (const key in tags) {
                    if (tags[key] && tags[key].replace) {
                        tags[key] = tags[key].replace("tag:", "");
                    }
                }
                commitInfo.tags = tags;
            }

            return commitInfo;

        });
    });
}

export function init() {
    return git(["init"]);
}

export function clone(remoteGitUrl, destinationFolder) {
    return git(["clone", remoteGitUrl, destinationFolder, "--progress"], {
        timeout: false // never timeout this
    });
}

export function stage(fileOrFiles, updateIndex = false) {
    const args = ["add"];
    if (updateIndex) { args.push("-u"); }
    return git(args.concat("--", fileOrFiles));
}

export function stageAll() {
    return git(["add", "--all"]);
}

export function commit(message, amend) {
    const lines = message.split("\n");
    const args = ["commit"];

    if (amend) {
        args.push("--amend", "--reset-author");
    }

    if (lines.length === 1) {
        args.push("-m", message);
        return git(args);
    }

    return new Promise((resolve, reject) => {
        // FUTURE: maybe use git commit --file=-
        const fileEntry = FileSystem.getFileForPath(Preferences.get("currentGitRoot") + ".bracketsGitTemp");
        Promise.cast(FileUtils.writeText(fileEntry, message))
            .then(() => {
                args.push("-F", ".bracketsGitTemp");
                return git(args);
            })
            .then((res) => fileEntry.unlink(() => resolve(res)))
            .catch((err) => fileEntry.unlink(() => reject(err)));
    });
}

export function reset(type = "--mixed", hash = null) {
    const args = ["reset", type]; // mixed is the default action
    if (hash) { args.push(hash, "--"); }
    return git(args);
}

export function unstage(file) {
    return git(["reset", "--", file]);
}

export function checkout(hash) {
    return git(["checkout", hash], {
        timeout: false // never timeout this
    });
}

export function createBranch(branchName, originBranch, trackOrigin) {
    const args = ["checkout", "-b", branchName];

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

export function status(type) {
    return git(["status", "-u", "--porcelain"]).then((stdout) => {
        if (!stdout) { return []; }

        const currentSubFolder = Preferences.get("currentGitSubfolder");

        // files that are modified both in index and working tree should be resetted
        let isEscaped = false;
        const needReset = [];
        const results = [];
        const lines = stdout.split("\n");

        lines.forEach((line) => {
            const statusStaged = line.substring(0, 1);
            const statusUnstaged = line.substring(1, 2);
            const statusArr = [];
            let file = line.substring(3);

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

            let statusChar;
            if (statusStaged !== " " && statusStaged !== "?") {
                statusArr.push(FILE_STATUS.STAGED);
                statusChar = statusStaged;
            } else {
                statusChar = statusUnstaged;
            }

            switch (statusChar) {
                case " ":
                    statusArr.push(FILE_STATUS.UNMODIFIED);
                    break;
                case "!":
                    statusArr.push(FILE_STATUS.IGNORED);
                    break;
                case "?":
                    statusArr.push(FILE_STATUS.UNTRACKED);
                    break;
                case "M":
                    statusArr.push(FILE_STATUS.MODIFIED);
                    break;
                case "A":
                    statusArr.push(FILE_STATUS.ADDED);
                    break;
                case "D":
                    statusArr.push(FILE_STATUS.DELETED);
                    break;
                case "R":
                    statusArr.push(FILE_STATUS.RENAMED);
                    break;
                case "C":
                    statusArr.push(FILE_STATUS.COPIED);
                    break;
                case "U":
                    statusArr.push(FILE_STATUS.UNMERGED);
                    break;
                default:
                    throw new Error("Unexpected status: " + statusChar);
            }

            let display = file;
            const io = file.indexOf("->");
            if (io !== -1) {
                file = file.substring(io + 2).trim();
            }

            // we don't want to display paths that lead to this file outside the project
            if (currentSubFolder && display.indexOf(currentSubFolder) === 0) {
                display = display.substring(currentSubFolder.length);
            }

            results.push({
                status: statusArr,
                display,
                file,
                name: file.substring(file.lastIndexOf("/") + 1)
            });
        });

        if (isEscaped) {
            return setConfig("core.quotepath", "false").then(() => {
                if (type === "SET_QUOTEPATH") {
                    throw new Error("git status is calling itself in a recursive loop!");
                }
                return status("SET_QUOTEPATH");
            });
        }

        if (needReset.length > 0) {
            return Promise.all(needReset.map((_fileName) => {
                let fileName = _fileName;
                if (fileName.indexOf("->") !== -1) {
                    fileName = fileName.split("->")[1].trim();
                }
                return unstage(fileName);
            })).then(() => {
                if (type === "RECURSIVE_CALL") {
                    throw new Error("git status is calling itself in a recursive loop!");
                }
                return status("RECURSIVE_CALL");
            });
        }

        return results.sort((a, b) => {
            if (a.file < b.file) {
                return -1;
            }
            if (a.file > b.file) {
                return 1;
            }
            return 0;
        });
    }).then((results) => {
        EventEmitter.emit(Events.GIT_STATUS_RESULTS, results);
        return results;
    });
}

function _isFileStaged(file) {
    return git(["status", "-u", "--porcelain", "--", file]).then((stdout) => {
        if (!stdout) { return false; }
        return _.any(stdout.split("\n"), (line) => {
            // first character marks staged status
            return line[0] !== " " && line[0] !== "?" &&
                   // in case another file appeared here?
                   line.lastIndexOf(" " + file) === line.length - file.length - 1;
        });
    });
}

export function getDiffOfStagedFiles() {
    return git(["diff", "--no-ext-diff", "--no-color", "--staged"], {
        timeout: false // never timeout this
    });
}

export function getDiffOfAllIndexFiles(files) {
    let args = ["diff", "--no-ext-diff", "--no-color", "--full-index"];
    if (files) {
        args = args.concat("--", files);
    }
    return git(args, {
        timeout: false // never timeout this
    });
}

export function getListOfStagedFiles() {
    return git(["diff", "--no-ext-diff", "--no-color", "--staged", "--name-only"], {
        timeout: false // never timeout this
    });
}

export function diffFile(file) {
    return _isFileStaged(file).then((staged) => {
        const args = ["diff", "--no-ext-diff", "--no-color"];
        if (staged) { args.push("--staged"); }
        args.push("-U0", "--", file);
        return git(args, {
            timeout: false // never timeout this
        });
    });
}

export function diffFileNice(file) {
    return _isFileStaged(file).then((staged) => {
        const args = ["diff", "--no-ext-diff", "--no-color"];
        if (staged) { args.push("--staged"); }
        args.push("--", file);
        return git(args, {
            timeout: false // never timeout this
        });
    });
}

export function difftool(file) {
    return _isFileStaged(file).then((staged) => {
        const args = ["difftool"];
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

export function clean() {
    return git(["clean", "-f", "-d"]);
}

export function getFilesFromCommit(hash, isInitial) {
    let args = ["diff", "--no-ext-diff", "--name-only"];
    args = args.concat((isInitial ? EMPTY_TREE : hash + "^") + ".." + hash);
    args = args.concat("--");
    return git(args).then((stdout) => !stdout ? [] : stdout.split("\n"));
}

export function getDiffOfFileFromCommit(hash, file, isInitial) {
    let args = ["diff", "--no-ext-diff", "--no-color"];
    args = args.concat((isInitial ? EMPTY_TREE : hash + "^") + ".." + hash);
    args = args.concat("--", file);
    return git(args);
}

export function difftoolFromHash(hash, file, isInitial) {
    return git(["difftool", (isInitial ? EMPTY_TREE : hash + "^") + ".." + hash, "--", file], {
        timeout: false // never timeout this
    });
}

export function rebaseInit(branchName) {
    return git(["rebase", "--ignore-date", branchName]);
}

export function rebase(whatToDo) {
    return git(["rebase", "--" + whatToDo]);
}

export function getVersion() {
    return git(["--version"]).then((stdout) => {
        const m = stdout.match(/[0-9].*/);
        return m ? m[0] : stdout.trim();
    });
}

function getCommitCountsFallback() {
    return git(["rev-list", "HEAD", "--not", "--remotes"])
    .then((stdout) => {
        const ahead = stdout ? stdout.split("\n").length : 0;
        return "-1 " + ahead;
    })
    .catch((err) => {
        ErrorHandler.logError(err);
        return "-1 -1";
    });
}

export function getCommitCounts() {
    const remotes = Preferences.get("defaultRemotes") || {};
    const remote = remotes[Preferences.get("currentGitRoot")];
    return getCurrentBranchName().then((branch) => {
        let p;
        if (!branch || !remote) {
            p = getCommitCountsFallback();
        } else {
            p = git(["rev-list", "--left-right", "--count", remote + "/" + branch + "...@{0}", "--"])
                .catch((err) => {
                    ErrorHandler.logError(err);
                    return getCommitCountsFallback();
                });
        }
        return p.then((stdout) => {
            const matches = /(-?\d+)\s+(-?\d+)/.exec(stdout);
            return matches ? {
                behind: parseInt(matches[1], 10),
                ahead: parseInt(matches[2], 10)
            } : {
                behind: -1,
                ahead: -1
            };
        });
    });
}

export function getLastCommitMessage() {
    return git(["log", "-1", "--pretty=%B"]).then((stdout) => stdout.trim());
}

export interface BlameInfo {
    hash: string;
    num: string;
    content: string;
}

export function getBlame(file, from, to): Promise<BlameInfo[]> {
    const args = ["blame", "-w", "--line-porcelain"];
    if (from || to) { args.push("-L" + from + "," + to); }
    args.push(file);

    return git(args).then((_stdout) => {
        if (!_stdout) { return []; }

        const sep = "-@-BREAK-HERE-@-";
        const sep2 = "$$#-#$BREAK$$-$#";
        const stdout = _stdout.replace(sep, sep2).replace(/^\t(.*)$/gm, (a, b) => b + sep);

        return stdout.split(sep).reduce((arr, _lineInfo) => {
            const lineInfo = _lineInfo.replace(sep2, sep).replace(/^\s+/, "");
            if (!lineInfo) { return arr; }

            const lines = lineInfo.split("\n");
            const firstLine = _.first(lines).split(" ");
            const obj: BlameInfo = {
                hash: firstLine[0],
                num: firstLine[2],
                content: _.last(lines)
            };

            // process all but first and last lines
            for (let i = 1, l = lines.length - 1; i < l; i++) {
                const line = lines[i];
                const io = line.indexOf(" ");
                const key = line.substring(0, io);
                const val = line.substring(io + 1);
                obj[key] = val;
            }

            arr.push(obj);
            return arr;
        }, []);
    }).catch((stderr) => {
        const m = stderr.match(/no such path (\S+)/);
        if (m) {
            throw new Error("File is not tracked by Git: " + m[1]);
        }
        throw stderr;
    });
}

export function getGitRoot() {
    const projectRoot = getProjectRoot();
    return git(["rev-parse", "--show-toplevel"], {
        cwd: projectRoot
    })
        .catch((e) => {
            if (ErrorHandler.contains(e, "Not a git repository")) {
                return null;
            }
            throw e;
        })
        .then((root) => {
            if (root === null) {
                return root;
            }

            // paths on cygwin look a bit different
            // root = fixCygwinPath(root);

            // we know projectRoot is in a Git repo now
            // because --show-toplevel didn't return Not a git repository
            // we need to find closest .git

            function checkPathRecursive(_path) {
                let path = _path;

                if (strEndsWith(path, "/")) {
                    path = path.slice(0, -1);
                }

                consoleDebug("Checking path for .git: " + path);

                return new Promise((resolve) => {

                    // keep .git away from file tree for now
                    // this branch of code will not run for intel xdk
                    if (typeof brackets !== "undefined" && brackets.fs && brackets.fs.stat) {
                        brackets.fs.stat(path + "/.git", (err, result) => {
                            const exists = err ? false : (result.isFile() || result.isDirectory());
                            if (exists) {
                                consoleDebug("Found .git in path: " + path);
                                resolve(path);
                            } else {
                                consoleDebug("Failed to find .git in path: " + path);
                                path = path.split("/");
                                path.pop();
                                path = path.join("/");
                                resolve(checkPathRecursive(path));
                            }
                        });
                        return;
                    }

                    FileSystem.resolve(path + "/.git", (err, item, stat) => {
                        const exists = err ? false : (stat.isFile || stat.isDirectory);
                        if (exists) {
                            consoleDebug("Found .git in path: " + path);
                            resolve(path);
                        } else {
                            consoleDebug("Failed to find .git in path: " + path);
                            path = path.split("/");
                            path.pop();
                            path = path.join("/");
                            resolve(checkPathRecursive(path));
                        }
                    });

                });

            }

            return checkPathRecursive(projectRoot).then((path) => path + "/");
        });
}

export function setTagName(tagname) {
    return git(["tag", tagname]).then((stdout) => stdout.trim());
}
