define(function (require) {
    "use strict";

    var _                 = brackets.getModule("thirdparty/lodash"),
        FileSystem        = brackets.getModule("filesystem/FileSystem");

    var EventEmitter      = require("src/EventEmitter"),
        Events            = require("src/Events"),
        Git               = require("src/git/Git"),
        Preferences       = require("src/Preferences"),
        Promise           = require("bluebird"),
        Utils             = require("src/Utils");

    var ignoreEntries = [],
        newPaths      = [],
        modifiedPaths = [];

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

    function isNew(fullPath) {
        return newPaths.indexOf(fullPath) !== -1;
    }

    function isModified(fullPath) {
        return modifiedPaths.indexOf(fullPath) !== -1;
    }

    function _refreshProjectFiles(selector, dataEntry) {
        $(selector).find("li").each(function () {
            var $li = $(this),
                data = $li.data(dataEntry);
            if (data) {
                var fullPath = data.fullPath;
                $li.toggleClass("git-ignored", isIgnored(fullPath))
                   .toggleClass("git-new", isNew(fullPath))
                   .toggleClass("git-modified", isModified(fullPath));
            }
        });
    }

    var refreshOpenFiles = _.debounce(function () {
        _refreshProjectFiles("#open-files-container", "file");
    }, 100);

    var refreshProjectFiles = _.debounce(function () {
        _refreshProjectFiles("#project-files-container", "entry");
    }, 100);

    function refreshBoth() {
        refreshOpenFiles();
        refreshProjectFiles();
    }

    function attachEvents() {
        if (Preferences.get("markModifiedInTree")) {
            $("#open-files-container").on("contentChanged", refreshOpenFiles).triggerHandler("contentChanged");
            $("#project-files-container").on("contentChanged", refreshProjectFiles).triggerHandler("contentChanged");
        }
    }

    function detachEvents() {
        $("#open-files-container").off("contentChanged", refreshOpenFiles);
        $("#project-files-container").off("contentChanged", refreshProjectFiles);
    }

    // this will refresh ignore entries when .gitignore is modified
    EventEmitter.on(Events.BRACKETS_FILE_CHANGED, function (evt, file) {
        if (file.fullPath === Utils.getProjectRoot() + ".gitignore") {
            refreshIgnoreEntries().finally(function () {
                refreshBoth();
            });
        }
    });
    // this will refresh new/modified paths on every status results
    EventEmitter.on(Events.GIT_STATUS_RESULTS, function (files) {
        var projectRoot = Utils.getProjectRoot();

        newPaths = [];
        modifiedPaths = [];

        files.forEach(function (entry) {
            var isNew = entry.status.indexOf(Git.FILE_STATUS.UNTRACKED) !== -1 ||
                        entry.status.indexOf(Git.FILE_STATUS.ADDED) !== -1;

            var fullPath = projectRoot + entry.file;
            if (isNew) {
                newPaths.push(fullPath);
            } else {
                modifiedPaths.push(fullPath);
            }
        });

        refreshBoth();
    });
    // this will refresh ignore entries when git project is opened
    EventEmitter.on(Events.GIT_ENABLED, function () {
        refreshIgnoreEntries();
        attachEvents();
    });
    // this will clear entries when non-git project is opened
    EventEmitter.on(Events.GIT_DISABLED, function () {
        ignoreEntries = [];
        newPaths      = [];
        modifiedPaths = [];
        detachEvents();
    });

});
