define(function (require, exports) {
    "use strict";

    var _                 = brackets.getModule("thirdparty/lodash"),
        FileSystem        = brackets.getModule("filesystem/FileSystem");

    var EventEmitter      = require("src/EventEmitter"),
        Events            = require("src/Events"),
        Promise           = require("bluebird"),
        Preferences       = require("./Preferences"),
        Utils             = require("src/Utils");

    var ignoreEntries = [];

    function refreshIgnoreEntries() {
        return new Promise(function (resolve) {

            if (!Preferences.get("markModifiedInTree")) {
                return resolve();
            }

            var projectRoot = Utils.getProjectRoot();

            FileSystem.getFileForPath(projectRoot + ".gitignore").read(function (err, content) {
                if (err) {
                    ignoreEntries = [];
                    return resolve();
                }

                ignoreEntries = _.compact(_.map(content.split("\n"), function (line) {
                    var type = "deny",
                        isNegative,
                        leadingSlash,
                        regex;

                    line = line.trim();
                    if (!line || line.indexOf("#") === 0) {
                        return;
                    }

                    isNegative = line.indexOf("!") === 0;
                    if (isNegative) {
                        line = line.slice(1);
                        type = "accept";
                    }
                    if (line.indexOf("\\") === 0) {
                        line = line.slice(1);
                    }
                    if (line.indexOf("/") === 0) {
                        line = line.slice(1);
                        leadingSlash = true;
                    }

                    line = line.replace(/[^*]$/, "$&**");

                    regex = projectRoot + (leadingSlash ? "" : "**") + line;
                    // NOTE: We cannot use StringUtils.regexEscape() here because we don't wanna replace *
                    regex = regex.replace(/([.?+\^$\[\]\\(){}|\-])/g, "\\$1");
                    regex = regex.replace(/\*\*$/g, "(.{0,})").replace(/\*\*/g, "(.+)").replace(/\*/g, "([^/]+)");
                    regex = "^" + regex + "$";

                    console.log(regex);
                    return {regexp: new RegExp(regex), type: type};
                }));

                return resolve();
            });
        });
    }

    function isIgnored(path) {
        var ignored = false;
        _.forEach(ignoreEntries, function (entry) {
            if (entry.regexp.test(path)) {
                ignored = (entry.type === "deny");
            }
        });
        return ignored;
    }

    EventEmitter.on(Events.GIT_ENABLED, function () {
        refreshIgnoreEntries();
    });
    EventEmitter.on(Events.GIT_DISABLED, function () {
        ignoreEntries = [];
    });

    exports.isIgnored               = isIgnored;
    exports.refreshIgnoreEntries    = refreshIgnoreEntries;

});
