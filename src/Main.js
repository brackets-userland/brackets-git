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
        EditorManager   = brackets.getModule("editor/EditorManager"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        Strings         = require("../strings"),
        ErrorHandler    = require("./ErrorHandler"),
        GitControl      = require("./GitControl"),
        GutterManager   = require("./GutterManager"),
        Panel           = require("./Panel"),
        Branch          = require("./Branch");
    
    var $icon                   = $("<a id='git-toolbar-icon' href='#'></a>").attr("title", Strings.LOADING)
                                    .addClass("loading").appendTo($("#main-toolbar .buttons")),
        gitControl              = null,
        preferences             = null,
        // shows detected git version in the status bar
        $gitStatusBar           = $(null),
        // show busy icon in status bar when git operation is running
        $busyIndicator          = $(null),
        busyIndicatorIndex      = 0,
        busyIndicatorInProgress = [];
    
    function showBusyIndicator() {
        var i = busyIndicatorIndex++;
        busyIndicatorInProgress.push(i);
        $busyIndicator.addClass("spin");
        return i;
    }

    function hideBusyIndicator(i) {
        var pos = busyIndicatorInProgress.indexOf(i);
        if (pos !== -1) {
            busyIndicatorInProgress.splice(pos, 1);
        }
        if (busyIndicatorInProgress.length === 0) {
            $busyIndicator.removeClass("spin");
        }
    }

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

    // Shows currently installed version or error when Git is not available
    function initGitStatusBar() {
        return gitControl.getVersion().then(function (version) {
            Strings.GIT_VERSION = version;
            $gitStatusBar.text("Git " + version);
        }).fail(function (err) {
            var errText = Strings.CHECK_GIT_SETTINGS + ": " + err.toString();
            $gitStatusBar.addClass("error").text(errText);
            $icon.addClass("error").attr("title", errText);
            throw err;
        });
    }
    
    // This only launches, when bash is available
    function initBashIcon() {
        $("<a id='git-bash'>[ bash ]</a>")
            .appendTo("#project-files-header")
            .on("click", function (e) {
                e.stopPropagation();
                gitControl.bashOpen(getProjectRoot());
            });
    }
    
    // This only launches when Git is available
    function initUi() {
        Panel.init(gitControl, preferences);
        Branch.init(gitControl, preferences);
        
        // Attach events
        $icon.on("click", Panel.toggle);
        
        // Show gitPanel when appropriate
        if (preferences.getValue("panelEnabled")) {
            Panel.toggle(true);
        }
    }
    
    // Call this only when Git is available
    function attachEventsToBrackets() {
        $(ProjectManager).on("projectOpen projectRefresh", function () {
            Branch.refresh();
            Panel.refresh();
            highlightGitignore();
        });
        $(FileSystem).on("change rename", function () {
            Branch.refresh();
            Panel.refresh();
        });
        $(DocumentManager).on("documentSaved", function () {
            Panel.refresh();
            refreshGitGutters();
        });
        $(DocumentManager).on("currentDocumentChange", function () {
            Panel.refreshCurrentFile();
            refreshGitGutters();
        });
        highlightGitignore();
        refreshGitGutters();
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
                Panel.refresh();
                highlightGitignore();
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

    function highlightGitignore() {
        var projectRoot = getProjectRoot();
        FileSystem.getFileForPath(projectRoot + ".gitignore").read(function (err, content) {
            if (err) { return; }

            var ignoreEntries = _.map(_.compact(content.split("\n")), function (line) {
                line = line.trim();
                if (line.indexOf("/") === 0) { line = line.substring(1); }
                return projectRoot + line;
            });

            $("#project-files-container").find("li").each(function () {
                var $li = $(this),
                    isIgnored = ignoreEntries.indexOf($li.data("entry").fullPath) !== -1;
                $li.toggleClass("git-ignored", isIgnored);
            });
        });
    }

    function refreshGitGutters() {
        if (!preferences.getValue("useGitGutter")) {
            return;
        }

        var currentDoc = DocumentManager.getCurrentDocument();
        if (!currentDoc) { return; }

        var editor = EditorManager.getActiveEditor();
        if (!editor || !editor._codeMirror) {
            return;
        }
        GutterManager.prepareGutter(editor._codeMirror);

        var filename = currentDoc.file.fullPath.substring(getProjectRoot().length);
        gitControl.gitDiff(filename).then(function (diff) {
            var added = [],
                removed = [],
                modified = [],
                changesets = diff.split("\n").filter(function (l) { return l.match(/^@@/) !== null; });

            function parseChangeset(str, arr) {
                var i,
                    s = str.split(","),
                    fromLine = parseInt(s[0], 10),
                    howMany = parseInt(s[1], 10);

                if (isNaN(howMany)) { howMany = 1; }
                var toLine = fromLine + howMany;

                for (i = fromLine; i < toLine; i++) {
                    arr.push(i > 0 ? i - 1 : 0);
                }
            }

            changesets.forEach(function (line) {
                var m = line.match(/^@@ -([,0-9]+) \+([,0-9]+) @@/);
                parseChangeset(m[1], removed);
                parseChangeset(m[2], added);
            });

            added.forEach(function (num, i) {
                var io = removed.indexOf(num);
                if (io !== -1) {
                    added.splice(i, 1);
                    removed.splice(io, 1);
                    modified.push(num);
                }
            });

            GutterManager.showGutters(editor._codeMirror, {
                added: added,
                modified: modified,
                removed: removed
            });
        });
    }

    function init(nodeConnection, _preferences) {
        preferences = exports.preferences = _preferences;
        var TIMEOUT_VALUE = preferences.getValue("TIMEOUT_VALUE");
        // Creates an GitControl Instance
        gitControl = exports.gitControl = new GitControl({
            preferences: preferences,
            handler: function (method, cmd, args, opts) {
                var rv = q.defer(),
                    i = showBusyIndicator(),
                    resolved = false;

                opts = opts || {};
                if (opts.cwd) { opts.customCwd = true; }
                else { opts.cwd = getProjectRoot(); }

                if (window.bracketsGit.debug) {
                    console.log("cmd-" + method + ": " + (opts.customCwd ? opts.cwd + "\\" : "") + cmd + " " + args.join(" "));
                }

                // nodeConnection returns jQuery deffered, not Q
                nodeConnection.domains["brackets-git"][method](opts.cwd, cmd, args)
                    .then(function (out) {
                        if (!resolved) {
                            if (window.bracketsGit.debug) { console.log("cmd-" + method + "-out: " + out); }
                            rv.resolve(out);
                        }
                    })
                    .fail(function (err) {
                        if (!resolved) {
                            if (window.bracketsGit.debug) { console.log("cmd-" + method + "-fail: " + err); }
                            rv.reject(err);
                        }
                    })
                    .always(function () {
                        hideBusyIndicator(i);
                        resolved = true;
                    })
                    .done();

                setTimeout(function () {
                    if (!resolved) {
                        var err = new Error("cmd-" + method + "-timeout: " + cmd + " " + args.join(" "));
                        ErrorHandler.logError(err);
                        rv.reject(err);
                        hideBusyIndicator(i);
                        resolved = true;
                    }
                }, opts.timeout || TIMEOUT_VALUE);

                return rv.promise;
            }
        });
        // Initialize items dependent on HTML DOM
        AppInit.htmlReady(function () {
            $icon.removeClass("loading").removeAttr("title");
            $gitStatusBar  = $("<div id='git-status'></div>").appendTo($("#status-indicators"));
            $busyIndicator = $("<div class='spinner'></div>").appendTo($gitStatusBar);
            initGitStatusBar().then(function () {
                initUi();
                attachEventsToBrackets();
            });
            gitControl.bashVersion().then(function () {
                initBashIcon();
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
    
    // API
    exports.$icon = $icon;
    exports.getProjectRoot = getProjectRoot;
    exports.isProjectRootWritable = isProjectRootWritable;
    exports.init = init;
});
