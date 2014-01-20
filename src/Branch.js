/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define, Mustache */

define(function (require, exports) {
    "use strict";
    
    var _                       = brackets.getModule("thirdparty/lodash"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        Menus                   = brackets.getModule("command/Menus"),
        PopUpManager            = brackets.getModule("widgets/PopUpManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        SidebarView             = brackets.getModule("project/SidebarView");
    
    var ErrorHandler            = require("./ErrorHandler"),
        Main                    = require("./Main"),
        Panel                   = require("./Panel"),
        Strings                 = require("../strings"),
        BranchesMenuTemplate    = require("text!htmlContent/git-branches-menu.html");

    var $gitBranchName          = $(null),
        $dropdown;

    function renderList(branches) {
        var currentBranch = _.find(branches, function (b) { return b.indexOf("* ") === 0; }),
            templateVars  = {
                branchList : _.without(branches, currentBranch),
                Strings     : Strings
            };
        return Mustache.render(BranchesMenuTemplate, templateVars);
    }

    function closeDropdown() {
        if ($dropdown) {
            PopUpManager.removePopUp($dropdown);
        }
        detachCloseEvents();
    }

    function handleEvents() {
        $dropdown.on("click", "a", function () {
            var branchName = $(this).data("branch");
            Main.gitControl.checkoutBranch(branchName).fail(function (err) {
                ErrorHandler.showError(err, "Switching branches failed");
            }).then(function () {
                $(ProjectManager).triggerHandler("projectOpen");
                closeDropdown();
            });
        }).on("mouseenter", "a", function () {
            $(this).addClass("selected");
        }).on("mouseleave", "a", function () {
            $(this).removeClass("selected");
        });
    }

    function attachCloseEvents() {
        $("html").on("click", closeDropdown);
        $("#project-files-container").on("scroll", closeDropdown);
        $(SidebarView).on("hide", closeDropdown);
        $("#titlebar .nav").on("click", closeDropdown);
        // $(window).on("keydown", keydownHook);
    }

    function detachCloseEvents() {
        $("html").off("click", closeDropdown);
        $("#project-files-container").off("scroll", closeDropdown);
        $(SidebarView).off("hide", closeDropdown);
        $("#titlebar .nav").off("click", closeDropdown);
        // $(window).off("keydown", keydownHook);

        $dropdown = null;
        EditorManager.focusEditor();
    }

    function toggleDropdown(e) {
        e.stopPropagation();

        // If the dropdown is already visible, close it
        if ($dropdown) {
            closeDropdown();
            return;
        }

        Menus.closeAll();

        Main.gitControl.getBranches().fail(function (err) {
            ErrorHandler.showError(err, "Getting branch list failed");
        }).then(function (branches) {
            $dropdown = $(renderList(branches));

            var toggleOffset = $gitBranchName.offset();
            $dropdown
                .css({
                    left: toggleOffset.left,
                    top: toggleOffset.top + $gitBranchName.outerHeight()
                })
                .appendTo($("body"));

            PopUpManager.addPopUp($dropdown, detachCloseEvents, true);
            attachCloseEvents();
            handleEvents();
        });
    }
    
    function refresh() {
        $gitBranchName.text("\u2026").show();
        Main.gitControl.getRepositoryRoot().then(function (root) {
            if (root === Main.getProjectRoot()) {
                Main.gitControl.getBranchName().then(function (branchName) {
                    $gitBranchName.text(branchName)
                        .on("click", toggleDropdown)
                        .append($("<span class='dropdown-arrow' />"));
                    Panel.enable();
                }).fail(function (ex) {
                    if (ex.match(/unknown revision/)) {
                        $gitBranchName.text("no branch").off("click");
                        Panel.enable();
                    } else {
                        ErrorHandler.showError(ex, "Could not read branch name");
                    }
                });
            } else {
                // Current working folder is not a git root
                $gitBranchName.text("not a git root").off("click");
                Panel.disable("not-root");
            }
        }).fail(function () {
            // Current working folder is not a git repository
            $gitBranchName.text("not a git repo").off("click");
            Panel.disable("not-repo");
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
