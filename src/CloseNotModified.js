/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define */

define(function (require, exports) {
    "use strict";

    var DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager   = brackets.getModule("editor/EditorManager");

    var Main    = require("./Main"),
        Strings = require("../strings");

    function handleCloseNotModified() {
        Main.gitControl.getGitStatus().then(function (modifiedFiles) {
            var openFiles = DocumentManager.getWorkingSet(),
                projectRoot = Main.getProjectRoot();
            openFiles.forEach(function (openFile) {
                var removeOpenFile = true;
                modifiedFiles.forEach(function (modifiedFile) {
                    if (projectRoot + modifiedFile.file === openFile.fullPath) { removeOpenFile = false; }
                });
                if (removeOpenFile) {
                    DocumentManager.closeFullEditor(openFile);
                }
            });
            EditorManager.focus();
        });
    }

    function init() {
        // Add close not modified button near working files list
        $("<div/>")
            .addClass("git-close-not-modified btn-alt-quiet")
            .attr("title", Strings.TOOLTIP_CLOSE_NOT_MODIFIED)
            .html("<i class='octicon octicon-remove-close'></i>")
            .on("click", handleCloseNotModified)
            .appendTo("#working-set-header");
    }

    // Public API
    exports.init = init;
});
