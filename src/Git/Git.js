/*
    This file acts as an entry point to GitCli.js and other possible
    implementations of Git communication besides Cli. Application
    should not access GitCli directly.
*/
define(function (require, exports) {

    // Local modules
    var GitCli = require("src/Git/GitCli");

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

    // Public API
    exports.pushToNewUpstream = pushToNewUpstream;
    exports.getBranches       = getBranches;
    exports.getAllBranches    = getAllBranches;

    Object.keys(GitCli).forEach(function (method) {
        if (!exports[method]) {
            exports[method] = GitCli[method];
        }
    });

    exports.pull                      = GitCli.pull;
    exports.push                      = GitCli.push;
    exports.getRemotes                = GitCli.getRemotes;
    exports.createRemote              = GitCli.createRemote;
    exports.deleteRemote              = GitCli.deleteRemote;
    exports.setUpstreamBranch         = GitCli.setUpstreamBranch;
    exports.getCurrentBranchName      = GitCli.getCurrentBranchName;
    exports.getCurrentUpstreamBranch  = GitCli.getCurrentUpstreamBranch;
    exports.getConfig                 = GitCli.getConfig;
    exports.setConfig                 = GitCli.setConfig;
    exports.fetchAllRemotes           = GitCli.fetchAllRemotes;
    exports.getBranches               = GitCli.getBranches;
    exports.getAllBranches            = GitCli.getAllBranches;
    exports.getDeletedFiles           = GitCli.getDeletedFiles;

});
