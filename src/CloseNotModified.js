/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, console, define */

define(function (require, exports) {
    "use strict";

    var DocumentManager     = brackets.getModule("document/DocumentManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        Main                = require("./Main");

    var Strings             = require("../strings");

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

    $("#working-set-header")
    .on("click", ".git-close-not-modified", handleCloseNotModified);

    function init() {
        // Add close not modified button near working files list
        console.log("added");
        var $closeNotModifiedIcon = "<i class=\"octicon octicon-remove-close\"></i>";
        $("#working-set-header")
        .append("<div title=\"" + Strings.TOOLTIP_CLOSE_NOT_MODIFIED + "\" class=\"git-close-not-modified\">" + $closeNotModifiedIcon + "</div>");
    }

    exports.init    = init;
});
