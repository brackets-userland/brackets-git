define(function (require) {
    "use strict";

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        MainViewManager = brackets.getModule("view/MainViewManager");

    // Local modules
    var Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        HistoryViewer = require("src/HistoryViewer"),
        Preferences   = require("src/Preferences"),
        Utils         = require("src/Utils");

    // White-list for .git file watching
    var watchedInsideGit = ["HEAD"];

    FileSystem.on("change", function (evt, file) {
        // we care only for files in current project
        var currentGitRoot = Preferences.get("currentGitRoot");
        if (file && file.fullPath.indexOf(currentGitRoot) === 0) {

            if (file.fullPath.indexOf(currentGitRoot + ".git/") === 0) {

                var whitelisted = _.any(watchedInsideGit, function (entry) {
                    return file.fullPath === currentGitRoot + ".git/" + entry;
                });
                if (!whitelisted) {
                    Utils.consoleDebug("Ignored FileSystem.change event: " + file.fullPath);
                    return;
                }

            }

            EventEmitter.emit(Events.BRACKETS_FILE_CHANGED, evt, file);
        }
    });

    DocumentManager.on("documentSaved", function (evt, doc) {
        // we care only for files in current project
        if (doc.file.fullPath.indexOf(Preferences.get("currentGitRoot")) === 0) {
            EventEmitter.emit(Events.BRACKETS_DOCUMENT_SAVED, evt, doc);
        }
    });

    MainViewManager.on("currentFileChange", function (evt, currentDocument, previousDocument) {
        currentDocument = currentDocument || DocumentManager.getCurrentDocument();
        if (!HistoryViewer.isVisible()) {
            EventEmitter.emit(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, evt, currentDocument, previousDocument);
        } else {
            HistoryViewer.hide();
        }
    });

    ProjectManager.on("projectOpen", function () {
        EventEmitter.emit(Events.BRACKETS_PROJECT_CHANGE);
    });

    ProjectManager.on("projectRefresh", function () {
        EventEmitter.emit(Events.BRACKETS_PROJECT_REFRESH);
    });

    ProjectManager.on("beforeProjectClose", function () {
        // Disable Git when closing a project so listeners won't fire before new is opened
        EventEmitter.emit(Events.GIT_DISABLED);
    });

});
