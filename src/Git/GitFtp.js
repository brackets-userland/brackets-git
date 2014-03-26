/*
    To make these features work you need Git-FTP (https://github.com/git-ftp/git-ftp)
*/
define(function (require, exports) {

    // Local modules
    var ErrorHandler  = require("src/ErrorHandler"),
        GitCli        = require("src/Git/GitCli"),
        Promise       = require("bluebird"),
        URI           = require("URI");

    // Module variables
    var git = GitCli.git;
    
    // Implementation
    
    function gitFtpInit(scope) {
        return git(["ftp", "init", "--scope", scope]);
    }

    function gitFtpPush(scope) {
        return git(["ftp", "push", "--scope", scope]);
    }

    function getFtpRemotes() {
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

    function gitFtpAddScope(scope, url) {
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
        ]).fail(function (err) {
            throw ErrorHandler.rewrapError(err, "There was a problem editing Git configuration file. Operation aborted.");
        });
    }

    function gitFtpRemoveScope(scope) {
        return git(["ftp", "remove-scope", scope]);
    }

    // Public API
    exports.gitFtpInit = gitFtpInit;
    exports.gitFtpPush = gitFtpPush;
    exports.getFtpRemotes = getFtpRemotes;
    exports.gitFtpAddScope = gitFtpAddScope;
    exports.gitFtpRemoveScope = gitFtpRemoveScope;

});
