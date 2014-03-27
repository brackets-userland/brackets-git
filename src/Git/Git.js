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

    Object.keys(GitCli).forEach(function (method) {
        if (!exports[method]) {
            exports[method] = GitCli[method];
        } else {
            console.log("[brackets-git] Method " + method + " already exists in Git");
        }
    });

});
