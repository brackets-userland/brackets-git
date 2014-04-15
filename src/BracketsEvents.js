define(function (require) {
    "use strict";

    // Brackets modules
    var DocumentManager = brackets.getModule("document/DocumentManager"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        ProjectManager  = brackets.getModule("project/ProjectManager");

    // Local modules
    var Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Git           = require("src/git/Git"),
        HistoryViewer = require("src/HistoryViewer"),
        Utils         = require("src/Utils");

    function refreshStatus() {
        // Extension parts should listen to GIT_STATUS_RESULTS
        Git.status();
    }

    function attachGitOnlyEvents() {
        $("#open-files-container").on("contentChanged", refreshStatus);
    }

    function detachGitOnlyEvents() {
        $("#open-files-container").off("contentChanged", refreshStatus);
    }

    EventEmitter.on(Events.GIT_ENABLED, function () {
        attachGitOnlyEvents();
    });

    EventEmitter.on(Events.GIT_DISABLED, function () {
        detachGitOnlyEvents();
    });

	FileSystem.on("change", function (evt, file) {
        // we care only for files in current project
        if (file && file.fullPath.indexOf(Utils.getProjectRoot()) === 0) {
            EventEmitter.emit(Events.BRACKETS_FILE_CHANGED, evt, file);
        }
    });

    $(DocumentManager).on("documentSaved", function (evt, doc) {
        // we care only for files in current project
        if (doc.file.fullPath.indexOf(Utils.getProjectRoot()) === 0) {
            EventEmitter.emit(Events.BRACKETS_DOCUMENT_SAVED, evt, doc);
        }
    });

    $(DocumentManager).on("currentDocumentChange", function (evt, currentDocument, previousDocument) {
        currentDocument = currentDocument || DocumentManager.getCurrentDocument();
        if (!HistoryViewer.isVisible()) {
            EventEmitter.emit(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, evt, currentDocument, previousDocument);
        }
    });

    $(ProjectManager).on("projectOpen", function () {
        EventEmitter.emit(Events.BRACKETS_PROJECT_CHANGE);
    });

    $(ProjectManager).on("projectRefresh", function () {
        EventEmitter.emit(Events.BRACKETS_PROJECT_REFRESH);
    });

    $(ProjectManager).on("beforeProjectClose", function () {
        // Disable Git when closing a project so listeners won't fire before new is opened
        EventEmitter.emit(Events.GIT_DISABLED);
    });

});
