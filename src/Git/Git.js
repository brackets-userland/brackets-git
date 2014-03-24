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

    // Public API
    exports.getRemotes = getRemotes;

});
