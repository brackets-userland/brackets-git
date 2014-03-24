define(function (require, exports, module) {

    var _ = brackets.getModule("thirdparty/lodash");

    var Cli         = require("src/Cli"),
        Preferences = require("src/Preferences");

    function getGit() {
        if (Preferences.get("gitIsInSystemPath")) {
            return "git";
        } else {
            return Preferences.get("gitPath");
        }
    }

    function getRemotes() {
        var args = ["remote", "-v"];
        return Cli.executeCommand(getGit(), args).then(function (stdout) {
            return !stdout ? [] : _.uniq(stdout.replace(/\((push|fetch)\)/g, "").split("\n")).map(function (l) {
                var s = l.trim().split("\t");
                return {
                    name: s[0],
                    url: s[1]
                };
            });
        });
    }

    // Public API
    exports.getRemotes = getRemotes;

});
