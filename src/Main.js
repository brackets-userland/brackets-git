/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define, setTimeout */

define(function (require, exports) {
    "use strict";

    var q               = require("../thirdparty/q"),
        _               = brackets.getModule("thirdparty/lodash"),
        AppInit         = brackets.getModule("utils/AppInit"),
        CommandManager  = brackets.getModule("command/CommandManager"),
        Menus           = brackets.getModule("command/Menus"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        Strings         = require("../strings"),
        Preferences     = require("./Preferences"),
        ErrorHandler    = require("./ErrorHandler"),
        GitControl      = require("./GitControl"),
        GutterManager   = require("./GutterManager"),
        Panel           = require("./Panel"),
        Branch          = require("./Branch");

    var $icon                   = $("<a id='git-toolbar-icon' href='#'></a>").attr("title", Strings.LOADING)
                                    .addClass("loading").appendTo($("#main-toolbar .buttons")),
        gitControl              = null;

    function getProjectRoot() {
        return ProjectManager.getProjectRoot().fullPath;
    }

    var writeTestResults = {};
    function isProjectRootWritable() {
        var folder = getProjectRoot();

        if (writeTestResults[folder]) {
            return q(writeTestResults[folder]);
        }

        var result = q.defer(),
            fileEntry = FileSystem.getFileForPath(folder + ".bracketsGitTemp");

        function finish(bool) {
            fileEntry.unlink(function () {
                result.resolve(writeTestResults[folder] = bool);
            });
        }

        FileUtils.writeText(fileEntry, "").done(function () {
            finish(true);
        }).fail(function () {
            finish(false);
        });

        return result.promise;
    }

    // This checks if the project root is empty (to let Git clone repositories)
    function isProjectRootEmpty() {
        var defer = q.defer();
        ProjectManager.getProjectRoot().getContents(function (err, entries) {
            if (err) {
                return defer.reject(err);
            }
            defer.resolve(entries.length === 0);
        });
        return defer.promise;
    }

    // This only launches when Git is available
    function initUi() {
        Panel.init(gitControl);
        Branch.init(gitControl);

        // Attach events
        $icon.on("click", Panel.toggle);

        // Show gitPanel when appropriate
        if (Preferences.get("panelEnabled")) {
            Panel.toggle(true);
        }
    }

    // Call this only when Git is available
    function attachEventsToBrackets() {
        $(ProjectManager).on("projectOpen projectRefresh", function () {
            Branch.refresh();
            Panel.prepareRemotesPicker();
            refreshIgnoreEntries().then(Panel.refresh);
        });
        $(FileSystem).on("change rename", function () {
            Branch.refresh();
            Panel.refresh();
        });
        $(DocumentManager).on("documentSaved", function () {
            Panel.refresh();
            GutterManager.refresh();
        });
        $(DocumentManager).on("currentDocumentChange", function () {
            Panel.refreshCurrentFile();
            GutterManager.refresh();
        });

        refreshIgnoreEntries();
        GutterManager.refresh();
    }

    function _addRemoveItemInGitignore(selectedEntry, method) {
        var projectRoot = getProjectRoot(),
            entryPath = "/" + selectedEntry.fullPath.substring(projectRoot.length),
            gitignoreEntry = FileSystem.getFileForPath(projectRoot + ".gitignore");

        gitignoreEntry.read(function (err, content) {
            if (err) {
                console.warn(err);
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
        var filePath = Panel.getPanel().find("tr.selected").data("file"),
            fileEntry = FileSystem.getFileForPath(getProjectRoot() + filePath);
        return _addRemoveItemInGitignore(fileEntry, "add");
    }

    function removeItemFromGitingoreFromPanel() {
        var filePath = Panel.getPanel().find("tr.selected").data("file"),
            fileEntry = FileSystem.getFileForPath(getProjectRoot() + filePath);
        return _addRemoveItemInGitignore(fileEntry, "remove");
    }

    var _ignoreEntries = [];

    function refreshProjectFiles(modifiedEntries) {
        if (!Preferences.get("markModifiedInTree")) {
            return;
        }

        $("#project-files-container").find("li").each(function () {
            var $li = $(this),
                fullPath = $li.data("entry").fullPath,
                isIgnored = _ignoreEntries.indexOf(fullPath) !== -1,
                isModified = modifiedEntries.indexOf(fullPath) !== -1;
            $li.toggleClass("git-ignored", isIgnored)
               .toggleClass("git-modified", isModified);
        });
    }

    function refreshIgnoreEntries() {
        if (!Preferences.get("markModifiedInTree")) {
            return q();
        }

        var p = q.defer(),
            projectRoot = getProjectRoot();

        FileSystem.getFileForPath(projectRoot + ".gitignore").read(function (err, content) {
            if (err) {
                p.reject(err);
                return;
            }
            _ignoreEntries = _.map(_.compact(content.split("\n")), function (line) {
                line = line.trim();
                if (line.indexOf("/") === 0) { line = line.substring(1); }
                return projectRoot + line;
            });
            p.resolve();
        });

        return p.promise;
    }

    function sanitizeOutput(str) {
        if (typeof str === "string") {
            str = str.replace(/(https?:\/\/)([^:@\s]*):([^:@]*)?@/g, function (a, protocol, user/*, pass*/) {
                return protocol + user + ":***@";
            });
        } else {
            if (str != null) { // checks for both null & undefined
                str = str.toString();
            } else {
                str = "";
            }
        }
        return str;
    }

    function init(nodeConnection) {
        var debugOn       = Preferences.get("debugMode"),
            extName       = "[brackets-git] ",
            TIMEOUT_VALUE = Preferences.get("TIMEOUT_VALUE");

        // Creates an GitControl Instance
        gitControl = exports.gitControl = new GitControl({
            handler: function (method, cmd, args, opts) {
                var rv = q.defer(),
                    resolved = false;

                opts = opts || {};
                if (opts.cwd) { opts.customCwd = true; }
                else { opts.cwd = getProjectRoot(); }

                if (debugOn) {
                    console.log(extName + "cmd-" + method + ": " + (opts.customCwd ? opts.cwd + "\\" : "") + cmd + " " + args.join(" "));
                }

                // nodeConnection returns jQuery deffered, not Q
                nodeConnection.domains["brackets-git"][method](opts.cwd, cmd, args)
                    .fail(function (err) {
                        if (!resolved) {
                            if (debugOn) { console.log(extName + "cmd-" + method + "-fail: \"" + err + "\""); }
                            rv.reject(sanitizeOutput(err));
                        }
                    })
                    .then(function (out) {
                        if (!resolved) {
                            if (debugOn) { console.log(extName + "cmd-" + method + "-out: \"" + out + "\""); }
                            rv.resolve(sanitizeOutput(out));
                        }
                    })
                    .always(function () {
                        resolved = true;
                    })
                    .done();

                setTimeout(function () {
                    if (!resolved) {
                        var err = new Error("cmd-" + method + "-timeout: " + cmd + " " + args.join(" "));
                        ErrorHandler.logError(err);
                        rv.reject(err);
                        resolved = true;
                    }
                }, opts.timeout || TIMEOUT_VALUE);

                return rv.promise;
            }
        });
        // Initialize items dependent on HTML DOM
        AppInit.htmlReady(function () {
            $icon.removeClass("loading").removeAttr("title");

            // Try to get Git version, if succeeds then Git works
            gitControl.getVersion().then(function (version) {
                Strings.GIT_VERSION = version;
                initUi();
                attachEventsToBrackets();
            }).fail(function (err) {
                var errText = Strings.CHECK_GIT_SETTINGS + ": " + err.toString();
                $icon.addClass("error").attr("title", errText);
                throw err;
            }).done();

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

    // API
    exports.$icon = $icon;
    exports.getProjectRoot = getProjectRoot;
    exports.isProjectRootEmpty = isProjectRootEmpty;
    exports.isProjectRootWritable = isProjectRootWritable;
    exports.refreshProjectFiles = refreshProjectFiles;
    exports.init = init;
});
