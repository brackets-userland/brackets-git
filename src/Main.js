define(function (require, exports) {
    "use strict";

    var _                 = brackets.getModule("thirdparty/lodash"),
        AppInit           = brackets.getModule("utils/AppInit"),
        CommandManager    = brackets.getModule("command/CommandManager"),
        Menus             = brackets.getModule("command/Menus"),
        FileSystem        = brackets.getModule("filesystem/FileSystem"),
        ProjectManager    = brackets.getModule("project/ProjectManager");

    var ExpectedError     = require("src/ExpectedError"),
        Promise           = require("bluebird"),
        Events            = require("src/Events"),
        EventEmitter      = require("src/EventEmitter"),
        Strings           = require("../strings"),
        Preferences       = require("./Preferences"),
        ErrorHandler      = require("./ErrorHandler"),
        Git               = require("src/git/Git"),
        Panel             = require("./Panel"),
        Branch            = require("./Branch"),
        CloseNotModified  = require("./CloseNotModified"),
        Setup             = require("src/utils/Setup"),
        Utils             = require("src/Utils");

    var $icon                   = $("<a id='git-toolbar-icon' href='#'></a>").attr("title", Strings.LOADING)
                                    .addClass("loading").appendTo($("#main-toolbar .buttons"));

    // This only launches when Git is available
    function initUi() {
        // FUTURE: do we really need to launch init from here?
        Panel.init();
        Branch.init();
        CloseNotModified.init();
        // Attach events
        $icon.on("click", Panel.toggle);
    }

    function _addRemoveItemInGitignore(selectedEntry, method) {
        var projectRoot = Utils.getProjectRoot(),
            entryPath = "/" + selectedEntry.fullPath.substring(projectRoot.length),
            gitignoreEntry = FileSystem.getFileForPath(projectRoot + ".gitignore");

        gitignoreEntry.read(function (err, content) {
            if (err) {
                Utils.consoleLog(err, "warn");
                content = "";
            }

            // use trimmed lines only
            var lines = content.split("\n").map(function (l) { return l.trim(); });
            // clean start and end empty lines
            while (lines.length > 0 && !lines[0]) { lines.shift(); }
            while (lines.length > 0 && !lines[lines.length - 1]) { lines.pop(); }

            if (method === "add") {
                // add only when not already present
                if (lines.indexOf(entryPath) === -1) { lines.push(entryPath); }
            } else if (method === "remove") {
                lines = _.without(lines, entryPath);
            }

            // always have an empty line at the end of the file
            if (lines[lines.length - 1]) { lines.push(""); }

            gitignoreEntry.write(lines.join("\n"), function (err) {
                if (err) {
                    return ErrorHandler.showError(err, "Failed modifying .gitignore");
                }
                refreshIgnoreEntries().then(Panel.refresh);
            });
        });
    }

    function addItemToGitingore() {
        return _addRemoveItemInGitignore(ProjectManager.getSelectedItem(), "add");
    }

    function removeItemFromGitingore() {
        return _addRemoveItemInGitignore(ProjectManager.getSelectedItem(), "remove");
    }

    function addItemToGitingoreFromPanel() {
        var filePath = Panel.getPanel().find("tr.selected").attr("x-file"),
            fileEntry = FileSystem.getFileForPath(Utils.getProjectRoot() + filePath);
        return _addRemoveItemInGitignore(fileEntry, "add");
    }

    function removeItemFromGitingoreFromPanel() {
        var filePath = Panel.getPanel().find("tr.selected").attr("x-file"),
            fileEntry = FileSystem.getFileForPath(Utils.getProjectRoot() + filePath);
        return _addRemoveItemInGitignore(fileEntry, "remove");
    }

    var _ignoreEntries = [];

    function refreshProjectFiles(modifiedPaths, newPaths) {
        if (!Preferences.get("markModifiedInTree")) {
            return;
        }

        function isIgnored(path) {
            var ignored = false;
            _.forEach(_ignoreEntries, function (entry) {
                if (entry.regexp.test(path)) {
                    ignored = (entry.type === "ignore");
                }
            });
            return ignored;
        }

        [ ["#project-files-container", "entry"], ["#open-files-container", "file"] ].forEach(function (arr) {
            $(arr[0]).find("li").each(function () {
                var $li = $(this),
                    data = $li.data(arr[1]);
                if (data) {
                    var fullPath = data.fullPath,
                        isModified = modifiedPaths.indexOf(fullPath) !== -1,
                        isNew = newPaths.indexOf(fullPath) !== -1;

                    $li.toggleClass("git-ignored", isIgnored(fullPath))
                       .toggleClass("git-new", isNew)
                       .toggleClass("git-modified", isModified);
                }
            });
        });
    }

    function refreshIgnoreEntries() {
        return new Promise(function (resolve) {

            if (!Preferences.get("markModifiedInTree")) {
                return resolve();
            }

            var projectRoot = Utils.getProjectRoot();

            FileSystem.getFileForPath(projectRoot + ".gitignore").read(function (err, content) {
                if (err) {
                    _ignoreEntries = [];
                    return resolve();
                }

                _ignoreEntries = _.compact(_.map(content.split("\n"), function (line) {
                    line = line.trim();
                    if (!line || line.indexOf("#") === 0) {
                        return;
                    }

                    var path,
                        type = "ignore";
                    if (line.indexOf("/") === 0) {
                        line = line.substring(1);
                        path = projectRoot + line;
                    } else if (line.indexOf("!") === 0) {
                        type = "include";
                        line = line.substring(1);
                        path = projectRoot + line;
                    } else {
                        path = projectRoot + "(**/)?" + line;
                    }
                    path = path.replace(/\\/, "");
                    path = path.replace(/\./, "\\.");

                    path = "^" + path + "/?$";

                    path = path.replace(/\*+/g, function (match) {
                        if (match.length === 2) {
                            return ".*";
                        }
                        if (match.length === 1) {
                            return "[^/]*";
                        }
                    });

                    return {regexp: new RegExp(path), type: type};
                }));

                return resolve();
            });
        });
    }

    function init() {
        // Initialize items dependent on HTML DOM
        AppInit.htmlReady(function () {
            $icon.removeClass("loading").removeAttr("title");

            // Try to get Git version, if succeeds then Git works
            Setup.findGit().then(function (version) {
                Strings.GIT_VERSION = version;
                initUi();
            }).catch(function (err) {
                $icon.addClass("error").attr("title", Strings.CHECK_GIT_SETTINGS + " - " + err.toString());

                var expected = new ExpectedError(err);
                expected.detailsUrl = "https://github.com/zaggino/brackets-git#dependencies";
                ErrorHandler.showError(expected, Strings.CHECK_GIT_SETTINGS);
            });

            // add command to project menu
            var projectCmenu = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU);
            var workingCmenu = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU);
            var panelCmenu = Menus.registerContextMenu("git-panel-context-menu");
            projectCmenu.addMenuDivider();
            workingCmenu.addMenuDivider();

            var cmdName = "git.addToIgnore";
            CommandManager.register(Strings.ADD_TO_GITIGNORE, cmdName, addItemToGitingore);
            projectCmenu.addMenuItem(cmdName);
            workingCmenu.addMenuItem(cmdName);
            CommandManager.register(Strings.ADD_TO_GITIGNORE, cmdName + "2", addItemToGitingoreFromPanel);
            panelCmenu.addMenuItem(cmdName + "2");

            cmdName = "git.removeFromIgnore";
            CommandManager.register(Strings.REMOVE_FROM_GITIGNORE, cmdName, removeItemFromGitingore);
            projectCmenu.addMenuItem(cmdName);
            workingCmenu.addMenuItem(cmdName);
            CommandManager.register(Strings.REMOVE_FROM_GITIGNORE, cmdName + "2", removeItemFromGitingoreFromPanel);
            panelCmenu.addMenuItem(cmdName + "2");
        });
    }

    // Event handlers
    EventEmitter.on(Events.GIT_ENABLED, function () {
        refreshIgnoreEntries();
    });

    EventEmitter.on(Events.GIT_DISABLED, function () {
        _ignoreEntries = [];
    });

    EventEmitter.on(Events.GIT_STATUS_RESULTS, function (files) {
        var projectRoot = Utils.getProjectRoot(),
            modifiedPaths = [],
            newPaths = [];

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

        refreshProjectFiles(modifiedPaths, newPaths);
    });

    EventEmitter.on(Events.HANDLE_PROJECT_REFRESH, function () {
        $(ProjectManager).triggerHandler("projectRefresh");
    });

    // API
    exports.$icon = $icon;
    exports.init = init;

});
