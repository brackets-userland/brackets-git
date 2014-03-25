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

    // Public API
    exports.pushToNewUpstream         = pushToNewUpstream;
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

});
