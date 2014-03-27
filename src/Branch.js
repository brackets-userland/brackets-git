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
        StringUtils             = brackets.getModule("utils/StringUtils"),
        SidebarView             = brackets.getModule("project/SidebarView");

    var Promise                 = require("bluebird"),
        Git                     = require("src/Git/Git"),
        ErrorHandler            = require("./ErrorHandler"),
        Main                    = require("./Main"),
        Panel                   = require("./Panel"),
        Strings                 = require("../strings"),
        Utils                   = require("./Utils"),
        branchesMenuTemplate    = require("text!templates/git-branches-menu.html"),
        newBranchTemplate       = require("text!templates/branch-new-dialog.html"),
        mergeBranchTemplate     = require("text!templates/branch-merge-dialog.html");

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

    function doMerge(fromBranch) {
        Git.getBranches().then(function (branches) {

            var compiledTemplate = Mustache.render(mergeBranchTemplate, {
                fromBranch: fromBranch,
                branches: branches,
                Strings: Strings
            });

            var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            dialog.getElement().find("input").focus();
            dialog.done(function (buttonId) {
                if (buttonId === "ok") {
                    // right now only merge to current branch without any configuration
                    // later delete merge branch and so ...
                    Main.gitControl.mergeBranch(fromBranch).catch(function (err) {
                        throw ErrorHandler.showError(err, "Merge failed");
                    }).then(function (stdout) {
                        // refresh should not be necessary in the future and trigerred automatically by Brackets, remove then
                        CommandManager.execute("file.refresh");
                        // show merge output
                        Utils.showOutput(stdout, Strings.MERGE_RESULT);
                    });
                }
            });
        });
    }

    function _reloadBranchSelect($el, branches) {
        var template = "{{#branches}}<option value='{{name}}' remote='{{remote}}' " +
            "{{#currentBranch}}selected{{/currentBranch}}>{{name}}</option>{{/branches}}";
        var html = Mustache.render(template, { branches: branches });
        $el.html(html);
    }

    function handleEvents() {
        $dropdown.on("click", "a.git-branch-new", function (e) {
            e.stopPropagation();

            Git.getAllBranches().catch(function (err) {
                ErrorHandler.showError(err);
            }).then(function (branches) {

                var compiledTemplate = Mustache.render(newBranchTemplate, {
                    branches: branches,
                    Strings: Strings
                });

                var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

                var $input  = dialog.getElement().find("[name='branch-name']"),
                    $select = dialog.getElement().find(".branchSelect");

                $select.on("change", function () {
                    if (!$input.val()) {
                        var $opt = $select.find(":selected"),
                            remote = $opt.attr("remote"),
                            newVal = $opt.val();
                        if (remote) {
                            newVal = newVal.substring(remote.length + 1);
                        }
                        $input.val(newVal);
                    }
                });

                _reloadBranchSelect($select, branches);
                dialog.getElement().find(".fetchBranches").on("click", function () {
                    var $this = $(this);
                    Git.fetchAllRemotes().then(function () {
                        return Git.getAllBranches().then(function (branches) {
                            $this.prop("disabled", true).attr("title", "Already fetched");
                            _reloadBranchSelect($select, branches);
                        });
                    }).catch(function (err) {
                        throw ErrorHandler.showError(err, "Fetching remote information failed");
                    });
                });

                dialog.getElement().find("input").focus();
                dialog.done(function (buttonId) {
                    if (buttonId === "ok") {

                        var $dialog     = dialog.getElement(),
                            branchName  = $dialog.find("input[name='branch-name']").val().trim(),
                            $option     = $dialog.find("select[name='branch-origin']").children("option:selected"),
                            originName  = $option.val(),
                            isRemote    = $option.attr("remote"),
                            track       = !!isRemote;

                        Main.gitControl.createBranch(branchName, originName, track).catch(function (err) {
                            ErrorHandler.showError(err, "Creating new branch failed");
                        }).then(function () {
                            closeDropdown();
                            // refresh should not be necessary in the future and trigerred automatically by Brackets, remove then
                            CommandManager.execute("file.refresh");
                        });
                    }
                });
            });

        }).on("click", "a.git-branch-link .switch-branch", function (e) {
            e.stopPropagation();
            var branchName = $(this).parent().data("branch");
            Main.gitControl.checkoutBranch(branchName).catch(function (err) {
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

            var branchName = $(this).parent().data("branch");
            Utils.askQuestion(Strings.DELETE_LOCAL_BRANCH,
                              StringUtils.format(Strings.DELETE_LOCAL_BRANCH_NAME, branchName),
                              { booleanResponse: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.branchDelete(branchName).catch(function (err) {

                            return Utils.showOutput(err, "Branch deletion failed", {
                                question: "Do you wish to force branch deletion?"
                            }).then(function (response) {
                                if (response === true) {
                                    return Git.forceBranchDelete(branchName).then(function (output) {
                                        return Utils.showOutput(output);
                                    }).catch(function (err) {
                                        ErrorHandler.showError(err, "Forced branch deletion failed");
                                    });
                                }
                            });

                        });
                    }
                })
                .catch(function (err) {
                    ErrorHandler.showError(err);
                });

        }).on("click", ".merge-branch", function () {
            var fromBranch = $(this).parent().data("branch");
            doMerge(fromBranch);
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

        Git.getBranches().catch(function (err) {
            ErrorHandler.showError(err, "Getting branch list failed");
        }).then(function (branches) {
            branches = branches.reduce(function (arr, branch) {
                if (!branch.currentBranch && !branch.remote) {
                    arr.push(branch.name);
                }
                return arr;
            }, []);

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
        return new Promise(function (resolve) {
            var gitFolder = Utils.getProjectRoot() + "/.git";
            FileSystem.resolve(gitFolder, function (err, directory) {
                resolve(!err && directory ? true : false);
            });
        });
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
            }).catch(function (ex) {
                if (ErrorHandler.contains(ex, "unknown revision")) {
                    $gitBranchName
                        .off("click")
                        .text("no branch");
                    Panel.enable();
                } else {
                    throw ex;
                }
            });
        }).catch(function (err) {
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
