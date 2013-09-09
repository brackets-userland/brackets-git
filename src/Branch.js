/*jslint plusplus: true, vars: true, nomen: true */
/*global $, define */

define(function (require, exports) {
    "use strict";
    
    var Main = require("./Main"),
        Panel = require("./Panel");
    
    var $gitBranchName = $(null);
    
    function refresh() {
        $gitBranchName.text("\u2026").show();
        Main.gitControl.getRepositoryRoot().then(function (root) {
            if (root === Main.getProjectRoot()) {
                Main.gitControl.getBranchName().then(function (branchName) {
                    $gitBranchName.text(branchName);
                    Panel.enable();
                }).fail(Main.logError);
            } else {
                // Current working folder is not a git root
                $gitBranchName.text("not a git root");
                Panel.disable("not a git root");
            }
        }).fail(function () {
            // Current working folder is not a git repository
            $gitBranchName.text("not a git repo");
            Panel.disable("not a git repo");
        });
    }
    
    function init() {
        // Add branch name to project tree
        $gitBranchName = $("<span id='git-branch'></span>");
        $("<div id='git-branch-dropdown-toggle'></div>")
            .append("[ ")
            .append($gitBranchName)
            //.append("<span class='dropdown-arrow'></span>") // TODO: add branches switching
            .append(" ]")
            .appendTo("#project-files-header");
        refresh();
    }
    
    exports.init    = init;
    exports.refresh = refresh;
});