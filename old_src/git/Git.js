/*
    This file acts as an entry point to GitCli.js and other possible
    implementations of Git communication besides Cli. Application
    should not access GitCli directly.
*/
define(function (require, exports) {

    // Local modules
    var Preferences = require("src/Preferences"),
        Promise     = require("bluebird"),
        GitCli      = require("src/git/GitCli"),
        Utils       = require("src/Utils");

    // Implementation
    function pushToNewUpstream(remoteName, remoteBranch) {
        return GitCli.push(remoteName, remoteBranch, ["--set-upstream"]);
    }

    function getRemoteUrl(remote) {
        return GitCli.getConfig("remote." + remote + ".url");
    }

    function setRemoteUrl(remote, url) {
        return GitCli.setConfig("remote." + remote + ".url", url);
    }

    function sortBranches(branches) {
        return branches.sort(function (a, b) {
            var ar = a.remote || "",
                br = b.remote || "";
            // origin remote first
            if (br && ar === "origin" && br !== "origin") {
                return -1;
            } else if (ar && ar !== "origin" && br === "origin") {
                return 1;
            }
            // sort by remotes
            if (ar < br) {
                return -1;
            } else if (ar > br) {
                return 1;
            }
            // sort by sortPrefix (# character)
            if (a.sortPrefix < b.sortPrefix) {
                return -1;
            } else if (a.sortPrefix > b.sortPrefix) {
                return 1;
            }
            // master branch first
            if (a.sortName === "master" && b.sortName !== "master") {
                return -1;
            } else if (a.sortName !== "master" && b.sortName === "master") {
                return 1;
            }
            // sort by sortName (lowercased branch name)
            return a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0;
        });
    }

    function getBranches() {
        return GitCli.getBranches().then(function (branches) {
            return sortBranches(branches);
        });
    }

    function getAllBranches() {
        return GitCli.getAllBranches().then(function (branches) {
            return sortBranches(branches);
        });
    }

    function getHistory(branch, skip) {
        return GitCli.getHistory(branch, skip);
    }

    function getFileHistory(file, branch, skip) {
        return GitCli.getHistory(branch, skip, file);
    }

    function resetIndex() {
        return GitCli.reset();
    }

    function discardAllChanges() {
        return GitCli.reset("--hard").then(function () {
            return GitCli.clean();
        });
    }

    function getMergeInfo() {
        var baseCheck  = ["MERGE_MODE", "rebase-apply"],
            mergeCheck = ["MERGE_HEAD", "MERGE_MSG"],
            rebaseCheck = ["rebase-apply/next", "rebase-apply/last", "rebase-apply/head-name"],
            gitFolder  = Preferences.get("currentGitRoot") + ".git/";

        return Promise.all(baseCheck.map(function (fileName) {
            return Utils.loadPathContent(gitFolder + fileName);
        })).spread(function (mergeMode, rebaseMode) {
            var obj = {
                mergeMode: mergeMode !== null,
                rebaseMode: rebaseMode !== null
            };
            if (obj.mergeMode) {

                return Promise.all(mergeCheck.map(function (fileName) {
                    return Utils.loadPathContent(gitFolder + fileName);
                })).spread(function (head, msg) {

                    if (head) {
                        obj.mergeHead = head.trim();
                    }
                    var msgSplit = msg ? msg.trim().split(/conflicts:/i) : [];
                    if (msgSplit[0]) {
                        obj.mergeMessage = msgSplit[0].trim();
                    }
                    if (msgSplit[1]) {
                        obj.mergeConflicts = msgSplit[1].trim().split("\n").map(function (line) { return line.trim(); });
                    }
                    return obj;

                });

            }
            if (obj.rebaseMode) {

                return Promise.all(rebaseCheck.map(function (fileName) {
                    return Utils.loadPathContent(gitFolder + fileName);
                })).spread(function (next, last, head) {

                    if (next) { obj.rebaseNext = next.trim(); }
                    if (last) { obj.rebaseLast = last.trim(); }
                    if (head) { obj.rebaseHead = head.trim().substring("refs/heads/".length); }
                    return obj;

                });

            }
            return obj;
        });
    }

    function discardFileChanges(file) {
        return GitCli.unstage(file).then(function () {
            return GitCli.checkout(file);
        });
    }

    function pushForced(remote, branch) {
        return GitCli.push(remote, branch, ["--force"]);
    }

    function deleteRemoteBranch(remote, branch) {
        return GitCli.push(remote, branch, ["--delete"]);
    }

    function undoLastLocalCommit() {
        return GitCli.reset("--soft", "HEAD~1");
    }

    // Public API
    exports.pushToNewUpstream       = pushToNewUpstream;
    exports.getBranches             = getBranches;
    exports.getAllBranches          = getAllBranches;
    exports.getHistory              = getHistory;
    exports.getFileHistory          = getFileHistory;
    exports.resetIndex              = resetIndex;
    exports.discardAllChanges       = discardAllChanges;
    exports.getMergeInfo            = getMergeInfo;
    exports.discardFileChanges      = discardFileChanges;
    exports.getRemoteUrl            = getRemoteUrl;
    exports.setRemoteUrl            = setRemoteUrl;
    exports.pushForced              = pushForced;
    exports.deleteRemoteBranch      = deleteRemoteBranch;
    exports.undoLastLocalCommit     = undoLastLocalCommit;

    Object.keys(GitCli).forEach(function (method) {
        if (!exports[method]) {
            exports[method] = GitCli[method];
        }
    });
});
