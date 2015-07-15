define(function (require, exports) {
    "use strict";

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash");

    // Local modules
    var Cli         = require("src/Cli"),
        Git         = require("src/git/Git"),
        Preferences = require("src/Preferences"),
        Promise     = require("bluebird"),
        Utils       = require("src/Utils");

    // Module variables
    var standardGitPathsWin = [
        "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
        "C:\\Program Files\\Git\\cmd\\git.exe"
    ];

    var standardGitPathsNonWin = [
        "/usr/local/git/bin/git",
        "/usr/local/bin/git",
        "/usr/bin/git"
    ];

    // Implementation
    function findGit() {
        return new Promise(function (resolve, reject) {

            // TODO: do this in two steps - first check user config and then check all
            var pathsToLook = [Preferences.get("gitPath"), "git"].concat(brackets.platform === "win" ? standardGitPathsWin : standardGitPathsNonWin);
            pathsToLook = _.unique(_.compact(pathsToLook));

            var results = [],
                errors = [];
            var finish = _.after(pathsToLook.length, function () {

                var searchedPaths = "\n\nSearched paths:\n" + pathsToLook.join("\n");

                if (results.length === 0) {
                    // no git found
                    reject("No Git has been found on this computer" + searchedPaths);
                } else {
                    // at least one git is found
                    var gits = _.sortBy(results, "version").reverse(),
                        latestGit = gits[0],
                        m = latestGit.version.match(/([0-9]+)\.([0-9]+)/),
                        major = parseInt(m[1], 10),
                        minor = parseInt(m[2], 10);

                    if (major === 1 && minor < 8) {
                        return reject("Brackets Git requires Git 1.8 or later - latest version found was " + latestGit.version + searchedPaths);
                    }

                    // prefer the first defined so it doesn't change all the time and confuse people
                    latestGit = _.sortBy(_.filter(gits, function (git) { return git.version === latestGit.version; }), "index")[0];

                    // this will save the settings also
                    Git.setGitPath(latestGit.path);
                    resolve(latestGit.version);
                }

            });

            pathsToLook.forEach(function (path, index) {
                Cli.spawnCommand(path, ["--version"], {
                    cwd: Utils.getExtensionDirectory()
                }).then(function (stdout) {
                    var m = stdout.match(/^git version\s+(.*)$/);
                    if (m) {
                        results.push({
                            path: path,
                            version: m[1],
                            index: index
                        });
                    }
                }).catch(function (err) {
                    errors.push({
                        path: path,
                        err: err
                    });
                }).finally(function () {
                    finish();
                });
            });

        });
    }

    // Public API
    exports.findGit = findGit;

});
