/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define */

define(function (require, exports) {
    "use strict";

    var DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager   = brackets.getModule("editor/EditorManager");

    var Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Git           = require("src/git/Git"),
        Utils         = require("src/Utils"),
        Strings       = require("strings");

    var $icon = $(null);

    function handleCloseNotModified() {
        Git.status().then(function (modifiedFiles) {
            var openFiles = DocumentManager.getWorkingSet(),
                projectRoot = Utils.getProjectRoot();
            openFiles.forEach(function (openFile) {
                var removeOpenFile = true;
                modifiedFiles.forEach(function (modifiedFile) {
                    if (projectRoot + modifiedFile.file === openFile.fullPath) { removeOpenFile = false; }
                });

                if (removeOpenFile) {
                    // check if file doesn't have any unsaved changes
                    var doc = DocumentManager.getOpenDocumentForPath(openFile.fullPath);
                    if (doc && doc.isDirty) {
                        removeOpenFile = false;
                    }
                }

                if (removeOpenFile) {
                    DocumentManager.closeFullEditor(openFile);
                }
            });
            EditorManager.focusEditor();
        });
    }

    function init() {
        // Add close not modified button near working files list
        $icon = $("<div/>")
            .addClass("git-close-not-modified btn-alt-quiet")
            .attr("title", Strings.TOOLTIP_CLOSE_NOT_MODIFIED)
            .html("<i class='octicon octicon-remove-close'></i>")
            .on("click", handleCloseNotModified)
            .appendTo("#working-set-header");
    }

    EventEmitter.on(Events.GIT_ENABLED, function () {
        $icon.show();
    });

    EventEmitter.on(Events.GIT_DISABLED, function () {
        $icon.hide();
    });

    // Public API
    exports.init = init;
});
