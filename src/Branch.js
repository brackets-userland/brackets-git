/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define, Mustache */

define(function (require, exports) {
    "use strict";
    
    var _                       = brackets.getModule("thirdparty/lodash"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        FileSystem              = brackets.getModule("filesystem/FileSystem"),
        Menus                   = brackets.getModule("command/Menus"),
        PopUpManager            = brackets.getModule("widgets/PopUpManager"),
        SidebarView             = brackets.getModule("project/SidebarView");
    
    var q                       = require("../thirdparty/q"),
        ErrorHandler            = require("./ErrorHandler"),
        Main                    = require("./Main"),
        Panel                   = require("./Panel"),
        Strings                 = require("../strings"),
        branchesMenuTemplate    = require("text!htmlContent/git-branches-menu.html"),
        questionDialogTemplate  = require("text!htmlContent/git-question-dialog.html");

    var $gitBranchName          = $(null),
        $dropdown;

    function renderList(branches) {
        branches = branches.map(function (name) {
            return {
                name: name,
                currentBranch: name.indexOf("* ") === 0,
                canDelete: name !== "master"
            };
        });
        var templateVars  = {
                branchList : _.filter(branches, function (o) { return !o.currentBranch; }),
                Strings     : Strings
            };
        return Mustache.render(branchesMenuTemplate, templateVars);
    }

    function closeDropdown() {
        if ($dropdown) {
            PopUpManager.removePopUp($dropdown);
        }
        detachCloseEvents();
    }

    function handleEvents() {
        $dropdown.on("click", "a.git-branch-new", function (e) {
            e.stopPropagation();

            var compiledTemplate = Mustache.render(questionDialogTemplate, {
                title: Strings.CREATE_NEW_BRANCH,
                question: _.escape(Strings.BRANCH_NAME),
                stringInput: true,
                Strings: Strings
            });
            var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            dialog.getElement().find("input").focus();
            dialog.done(function (buttonId) {
                if (buttonId === "ok") {
                    var branchName = dialog.getElement().find("input").val().trim();
                    Main.gitControl.createBranch(branchName).fail(function (err) {
                        ErrorHandler.showError(err, "Creating new branch failed");
                    }).then(function () {
                        closeDropdown();
                        // refresh should not be necessary in the future and trigerred automatically by Brackets, remove then
                        CommandManager.execute("file.refresh");
                    });
                }
            });

        }).on("click", "a.git-branch-link .switch-branch", function (e) {
            e.stopPropagation();
            var branchName = $(this).parent().data("branch");
            Main.gitControl.checkoutBranch(branchName).fail(function (err) {
                ErrorHandler.showError(err, "Switching branches failed");
            }).then(function () {
                closeDropdown();
                // refresh should not be necessary in the future and trigerred automatically by Brackets, remove then
                CommandManager.execute("file.refresh");
            });
        }).on("mouseenter", "a", function () {
            $(this).addClass("selected");
        }).on("mouseleave", "a", function () {
            $(this).removeClass("selected");
        }).on("click", "a.git-branch-link .trash-icon", function () {
            Main.gitControl.deleteLocalBranch($(this).parent().data("branch"))
            .fail(function (err) { ErrorHandler.showError(err, "Branch deletion failed"); });
            $(this).parent().remove();
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
    
    function _isRepositoryRoot() {
        var gitFolder = Main.getProjectRoot() + "/.git",
            defer = q.defer();
        FileSystem.resolve(gitFolder, function (err, directory) {
            defer.resolve(directory && !err ? true : false);
        });
        return defer.promise;
    }

    function refresh() {
        // show info that branch is refreshing currently
        $gitBranchName
            .text("\u2026")
            .parent()
                .show();

        return _isRepositoryRoot().then(function (isRepositoryRoot) {
            $gitBranchName.parent().toggle(isRepositoryRoot);

            if (!isRepositoryRoot) {
                $gitBranchName
                    .off("click")
                    .text("not a git repo");
                Panel.disable("not-repo");
                return;
            }
            
            return Main.gitControl.getBranchName().then(function (branchName) {
                $gitBranchName.text(branchName)
                    .off("click")
                    .on("click", toggleDropdown)
                    .append($("<span class='dropdown-arrow' />"));
                Panel.enable();
            }).fail(function (ex) {
                if (ErrorHandler.contains(ex, "unknown revision")) {
                    $gitBranchName
                        .off("click")
                        .text("no branch");
                    Panel.enable();
                } else {
                    throw ex;
                }
            });
        }).fail(function (err) {
            throw ErrorHandler.showError(err);
        });
    }
    
    function init() {
        // Add branch name to project tree
        $gitBranchName = $("<span id='git-branch'></span>");
        $("<div id='git-branch-dropdown-toggle' class='btn-alt-quiet'></div>")
            .append("[ ")
            .append($gitBranchName)
            .append(" ]")
            .on("click", function () {
                $gitBranchName.click();
                return false;
            })
            .appendTo("#project-files-header");
        refresh();
    }
    
    exports.init    = init;
    exports.refresh = refresh;
});
