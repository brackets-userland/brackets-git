/*
    To make these features work you need Git-FTP (https://github.com/git-ftp/git-ftp)
*/
define(function (require, exports) {

    // Local modules
    var GitCli        = require("src/git/GitCli"),
        Promise       = require("bluebird"),
        URI           = require("URI");

    // Module variables
    var git = GitCli._git;

    // Implementation
    function isAvailable() {
        return git(["ftp"]).then(function () {
            return true;
        }).catch(function (err) {
            return err;
        });
    }

    function init(scope) {
        return git(["ftp", "init", "--scope", scope]);
    }

    function push(scope) {
        return git(["ftp", "push", "--scope", scope]);
    }

    function getScopes() {
        return git(["config", "--list"]).then(function (stdout) {
            return stdout.split("\n").reduce(function (result, row) {
                var io = row.indexOf(".url");
                if (row.substring(0, 8) === "git-ftp." && row.substring(io, io + 4) === ".url") {
                    result.push({
                        name: row.split(".")[1],
                        url: row.split("=")[1]
                    });
                }
                return result;
            }, []);
        });
    }

    function addScope(scope, url) {
        var uri = new URI(url),
            username = uri.username(),
            password = uri.password();

        uri.username("");
        uri.password("");
        url = uri.toString();

        var scopeArgs    = ["config", "--add", "git-ftp." + scope + ".url", url],
            usernameArgs = ["config", "--add", "git-ftp." + scope + ".user", username],
            passwordArgs = ["config", "--add", "git-ftp." + scope + ".password", password];

        return Promise.all([
            git(scopeArgs),
            git(usernameArgs),
            git(passwordArgs)
        ]);
    }

    function removeScope(scope) {
        return git(["ftp", "remove-scope", scope]);
    }

    // Public API
    exports.isAvailable = isAvailable;
    exports.init        = init;
    exports.push        = push;
    exports.getScopes   = getScopes;
    exports.addScope    = addScope;
    exports.removeScope = removeScope;

});
