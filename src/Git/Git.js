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

    // Public API
    exports.getRemotes    = getRemotes;
    exports.createRemote  = createRemote;
    exports.deleteRemote  = deleteRemote;
    exports.pull          = pull;

});
