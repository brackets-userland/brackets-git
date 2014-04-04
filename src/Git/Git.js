/*
    This file acts as an entry point to GitCli.js and other possible
    implementations of Git communication besides Cli. Application
    should not access GitCli directly.
*/
define(function (require, exports) {

    // Local modules
    var Promise = require("bluebird"),
        GitCli  = require("src/Git/GitCli"),
        Utils   = require("src/Utils");

    // Implementation
    function pushToNewUpstream(remoteName, remoteBranch) {
        return GitCli.push(remoteName, remoteBranch, ["--set-upstream"]);
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
        return GitCli.reset("--hard");
    }

    function getMergeInfo() {
        var gitFolder = Utils.getProjectRoot() + "/.git/",
            mergeFiles = ["MERGE_HEAD", "MERGE_MODE", "MERGE_MSG"];
        return Promise.all(mergeFiles.map(function (fileName) {
            return Utils.loadPathContent(gitFolder + fileName);
        })).spread(function (head, mode, msg) {
            var msgSplit = msg ? msg.trim().split(/conflicts:/i) : [];
            return {
                headCommit: head ? head.trim() : null,
                mergeMode: mode !== null,
                message: msgSplit[0] ? msgSplit[0].trim() : null,
                conflicts: msgSplit[1] ? msgSplit[1].trim().split("\n").map(function (line) { return line.trim(); }) : []
            };
        });
    }

    function discardFileChanges(file) {
        return GitCli.unstage(file).then(function () {
            return GitCli.checkout(file);
        });
    }

    // Public API
    exports.pushToNewUpstream   = pushToNewUpstream;
    exports.getBranches         = getBranches;
    exports.getAllBranches      = getAllBranches;
    exports.getHistory          = getHistory;
    exports.getFileHistory      = getFileHistory;
    exports.resetIndex          = resetIndex;
    exports.discardAllChanges   = discardAllChanges;
    exports.getMergeInfo        = getMergeInfo;
    exports.discardFileChanges  = discardFileChanges;

    Object.keys(GitCli).forEach(function (method) {
        if (!exports[method]) {
            exports[method] = GitCli[method];
        }
    });
});
