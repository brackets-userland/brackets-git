/*
    This file acts as an entry point to GitCli.js and other possible
    implementations of Git communication besides Cli. Application
    should not access GitCli directly.
*/
define(function (require, exports) {

    // Local modules
    var GitCli = require("src/Git/GitCli");

    // Implementation

    /*
        returns the list of currently available remotes
        format: [ { name: string, url: string } ]
    */
    function getRemotes() {
        return GitCli.getRemotes();
    }

    /*
        no return output - just returns true on success
    */
    function createRemote(name, url) {
        return GitCli.createRemote(name, url);
    }

    /*
        no return output - just returns true on success
    */
    function deleteRemote(name) {
        return GitCli.deleteRemote(name);
    }

    /*
        returns string message from command line
    */
    function pull(remoteName) {
        return GitCli.pull(remoteName);
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
    function push(remoteName) {
        return GitCli.push(remoteName);
    }

    /*
        sets new upstream branch for current branch
    */
    function setUpstreamBranch(remoteName, remoteBranch) {
        return GitCli.setUpstreamBranch(remoteName, remoteBranch);
    }

    // Public API
    exports.getRemotes        = getRemotes;
    exports.createRemote      = createRemote;
    exports.deleteRemote      = deleteRemote;
    exports.pull              = pull;
    exports.push              = push;
    exports.setUpstreamBranch = setUpstreamBranch;

});
