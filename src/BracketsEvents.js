define(function (require) {
    "use strict";

    // Brackets modules
    var FileSystem    = brackets.getModule("filesystem/FileSystem");

    // Local modules
    var Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Git           = require("src/git/Git");

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
        EventEmitter.emit(Events.BRACKETS_FILE_CHANGED, evt, file);
    });

});
