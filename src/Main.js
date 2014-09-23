define(function (require, exports) {
    "use strict";

    var _                 = brackets.getModule("thirdparty/lodash"),
        AppInit           = brackets.getModule("utils/AppInit"),
        CommandManager    = brackets.getModule("command/CommandManager"),
        Menus             = brackets.getModule("command/Menus"),
        FileSystem        = brackets.getModule("filesystem/FileSystem"),
        ProjectManager    = brackets.getModule("project/ProjectManager");

    var ExpectedError     = require("src/ExpectedError"),
        Events            = require("src/Events"),
        EventEmitter      = require("src/EventEmitter"),
        Strings           = require("../strings"),
        ErrorHandler      = require("./ErrorHandler"),
        Panel             = require("./Panel"),
        Branch            = require("./Branch"),
        CloseNotModified  = require("./CloseNotModified"),
        Setup             = require("src/utils/Setup"),
        Utils             = require("src/Utils");

    var CMD_ADD_TO_IGNORE      = "git.addToIgnore",
        CMD_REMOVE_FROM_IGNORE = "git.removeFromIgnore",
        $icon                  = $("<a id='git-toolbar-icon' href='#'></a>")
                                    .attr("title", Strings.LOADING)
                                    .addClass("loading")
                                    .appendTo($("#main-toolbar .buttons"));

    EventEmitter.on(Events.GIT_STATUS_RESULTS, function (results) {
        $icon.toggleClass("dirty", results.length !== 0);
    });

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
                Panel.refresh();
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

            // register commands for project tree / working files
            CommandManager.register(Strings.ADD_TO_GITIGNORE, CMD_ADD_TO_IGNORE, addItemToGitingore);
            CommandManager.register(Strings.REMOVE_FROM_GITIGNORE, CMD_REMOVE_FROM_IGNORE, removeItemFromGitingore);

            // create context menu for git panel
            var panelCmenu = Menus.registerContextMenu("git-panel-context-menu");
            CommandManager.register(Strings.ADD_TO_GITIGNORE, CMD_ADD_TO_IGNORE + "2", addItemToGitingoreFromPanel);
            CommandManager.register(Strings.REMOVE_FROM_GITIGNORE, CMD_REMOVE_FROM_IGNORE + "2", removeItemFromGitingoreFromPanel);
            panelCmenu.addMenuItem(CMD_ADD_TO_IGNORE + "2");
            panelCmenu.addMenuItem(CMD_REMOVE_FROM_IGNORE + "2");
        });
    }

    var _toggleMenuEntriesState = false,
        _divider1 = null,
        _divider2 = null;
    function toggleMenuEntries(bool) {
        if (bool === _toggleMenuEntriesState) {
            return;
        }
        var projectCmenu = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU);
        var workingCmenu = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_CONTEXT_MENU);
        if (bool) {
            _divider1 = projectCmenu.addMenuDivider();
            _divider2 = workingCmenu.addMenuDivider();
            projectCmenu.addMenuItem(CMD_ADD_TO_IGNORE);
            workingCmenu.addMenuItem(CMD_ADD_TO_IGNORE);
            projectCmenu.addMenuItem(CMD_REMOVE_FROM_IGNORE);
            workingCmenu.addMenuItem(CMD_REMOVE_FROM_IGNORE);
        } else {
            projectCmenu.removeMenuDivider(_divider1.id);
            workingCmenu.removeMenuDivider(_divider2.id);
            projectCmenu.removeMenuItem(CMD_ADD_TO_IGNORE);
            workingCmenu.removeMenuItem(CMD_ADD_TO_IGNORE);
            projectCmenu.removeMenuItem(CMD_REMOVE_FROM_IGNORE);
            workingCmenu.removeMenuItem(CMD_REMOVE_FROM_IGNORE);
        }
        _toggleMenuEntriesState = bool;
    }

    // Event handlers
    EventEmitter.on(Events.GIT_ENABLED, function () {
        toggleMenuEntries(true);
    });
    EventEmitter.on(Events.GIT_DISABLED, function () {
        toggleMenuEntries(false);
    });
    // TODO: investigate this event
    EventEmitter.on(Events.HANDLE_PROJECT_REFRESH, function () {
        $(ProjectManager).triggerHandler("projectRefresh");
    });

    // API
    exports.$icon = $icon;
    exports.init = init;

});
