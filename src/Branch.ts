import {
    _,
    CommandManager,
    Dialogs,
    EditorManager,
    FileSyncManager,
    FileSystem,
    Menus,
    Mustache,
    PopUpManager,
    StringUtils,
    DocumentManager,
    MainViewManager
} from "./brackets-modules";

import * as Git from "./git/GitCli";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as ErrorHandler from "./ErrorHandler";
import * as Panel from "./Panel";
import * as Preferences from "./Preferences";
import * as ProgressDialog from "./dialogs/Progress";
import * as Strings from "strings";
import * as Utils from "./Utils";
import getMergeInfo from "./git/get-merge-info";

const branchesMenuTemplate = require("text!templates/git-branches-menu.html");
const newBranchTemplate = require("text!templates/branch-new-dialog.html");
const mergeBranchTemplate = require("text!templates/branch-merge-dialog.html");

let $gitBranchName = $(null);
let currentEditor;
let $dropdown;

function renderList(branches) {
    const templateVars = {
        branchList: _.filter(branches.map((name) => {
            return {
                name,
                currentBranch: name.indexOf("* ") === 0,
                canDelete: name !== "master"
            };
        }), (b) => !b.currentBranch),
        Strings
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
    Git.getBranches().then((branches) => {

        const compiledTemplate = Mustache.render(mergeBranchTemplate, {
            fromBranch,
            branches,
            Strings
        });

        const dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        const $dialog = dialog.getElement();
        $dialog.find("input").focus();

        const $toBranch = $dialog.find("[name='branch-target']");
        const $useRebase = $dialog.find("[name='use-rebase']");
        const $useNoff = $dialog.find("[name='use-noff']");

        if (fromBranch === "master") {
            $useRebase.prop("checked", true);
        }
        if ($toBranch.val() === "master") {
            $useRebase.prop("checked", false).prop("disabled", true);
        }

        // fill merge message if possible
        const $mergeMessage = $dialog.find("[name='merge-message']");
        $mergeMessage.attr("placeholder", "Merge branch '" + fromBranch + "'");
        $dialog.find(".fill-pr").on("click", () => {
            const prMsg = "Merge pull request #??? from " + fromBranch;
            $mergeMessage.val(prMsg);
            $mergeMessage[0].setSelectionRange(prMsg.indexOf("???"), prMsg.indexOf("???") + 3);
        });

        // load default value for --no-ff
        let useNoffDefaultValue = Preferences.get("useNoffDefaultValue");
        if (typeof useNoffDefaultValue !== "boolean") { useNoffDefaultValue = true; }
        $useNoff.prop("checked", useNoffDefaultValue);

        // can't use rebase and no-ff together so have a change handler for this
        $useRebase.on("change", () => {
            const useRebase = $useRebase.prop("checked");
            $useNoff.prop("disabled", useRebase);
            if (useRebase) { $useNoff.prop("checked", false); }
        }).trigger("change");

        dialog.done((buttonId) => {
            // right now only merge to current branch without any configuration
            // later delete merge branch and so ...
            const useRebase = $useRebase.prop("checked");
            const useNoff = $useNoff.prop("checked");
            const mergeMsg = $mergeMessage.val();

            // save state for next time branch merge is invoked
            Preferences.set("useNoffDefaultValue", useNoff);

            if (buttonId === "ok") {

                if (useRebase) {

                    Git.rebaseInit(fromBranch).catch((err) => {
                        throw ErrorHandler.showError(err, "Rebase failed");
                    }).then((stdout) => {
                        Utils.showOutput(stdout, Strings.REBASE_RESULT).finally(() => {
                            EventEmitter.emit(Events.REFRESH_ALL);
                        });
                    });

                } else {

                    Git.mergeBranch(fromBranch, mergeMsg, useNoff).catch((err) => {
                        throw ErrorHandler.showError(err, "Merge failed");
                    }).then((stdout) => {
                        Utils.showOutput(stdout, Strings.MERGE_RESULT).finally(() => {
                            EventEmitter.emit(Events.REFRESH_ALL);
                        });
                    });

                }

            }
        });
    });
}

function _reloadBranchSelect($el, branches) {
    const template = "{{#branches}}<option value='{{name}}' remote='{{remote}}' " +
        "{{#currentBranch}}selected{{/currentBranch}}>{{name}}</option>{{/branches}}";
    const html = Mustache.render(template, { branches });
    $el.html(html);
}

function closeNotExistingFiles(oldBranchName, newBranchName) {
    return Git.getDeletedFiles(oldBranchName, newBranchName).then((deletedFiles) => {

        const gitRoot = Preferences.get("currentGitRoot");
        const openedFiles = MainViewManager.getWorkingSet(MainViewManager.ALL_PANES);

        // Close files that does not exists anymore in the new selected branch
        deletedFiles.forEach((dFile) => {
            const oFile = _.find(openedFiles, (f) => f.fullPath === gitRoot + dFile);
            if (oFile) {
                DocumentManager.closeFullEditor(oFile);
            }
        });

        EventEmitter.emit(Events.REFRESH_ALL);

    }).catch((err) => {
        ErrorHandler.showError(err, "Getting list of deleted files failed.");
    });
}

function handleEvents() {
    $dropdown.on("click", "a.git-branch-new", (e) => {
        e.stopPropagation();

        Git.getAllBranches().catch((err) => {
            ErrorHandler.showError(err);
        }).then((branches) => {

            const compiledTemplate = Mustache.render(newBranchTemplate, {
                branches,
                Strings
            });

            const dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

            const $input = dialog.getElement().find("[name='branch-name']");
            const $select = dialog.getElement().find(".branchSelect");

            $select.on("change", () => {
                if (!$input.val()) {
                    const $opt = $select.find(":selected");
                    const remote = $opt.attr("remote");
                    let newVal = $opt.val();
                    if (remote) {
                        newVal = newVal.substring(remote.length + 1);
                        if (remote !== "origin") {
                            newVal = remote + "#" + newVal;
                        }
                    }
                    $input.val(newVal);
                }
            });

            _reloadBranchSelect($select, branches);
            dialog.getElement().find(".fetchBranches").on("click", function () {
                const $this = $(this);
                ProgressDialog.show(Git.fetchAllRemotes())
                    .then(() => {
                        return Git.getAllBranches().then((allBranches) => {
                            $this.prop("disabled", true).attr("title", "Already fetched");
                            _reloadBranchSelect($select, allBranches);
                        });
                    }).catch((err) => {
                        throw ErrorHandler.showError(err, "Fetching remote information failed");
                    });
            });

            dialog.getElement().find("input").focus();
            dialog.done((buttonId) => {
                if (buttonId === "ok") {

                    const $dialog = dialog.getElement();
                    const branchName = $dialog.find("input[name='branch-name']").val().trim();
                    const $option = $dialog.find("select[name='branch-origin']").children("option:selected");
                    const originName = $option.val();
                    const isRemote = $option.attr("remote");
                    const track = !!isRemote;

                    Git.createBranch(branchName, originName, track).catch((err) => {
                        ErrorHandler.showError(err, "Creating new branch failed");
                    }).then(() => {
                        closeDropdown();
                        EventEmitter.emit(Events.REFRESH_ALL);
                    });
                }
            });
        });

    }).on("click", "a.git-branch-link .switch-branch", function (e) {

        e.stopPropagation();
        const newBranchName = $(this).parent().data("branch");

        Git.getCurrentBranchName().then((oldBranchName) => {
            Git.checkout(newBranchName).then(() => {
                closeDropdown();
                return closeNotExistingFiles(oldBranchName, newBranchName);
            }).catch((err) => { ErrorHandler.showError(err, "Switching branches failed."); });
        }).catch((err) => { ErrorHandler.showError(err, "Getting current branch name failed."); });

    }).on("mouseenter", "a", function () {
        $(this).addClass("selected");
    }).on("mouseleave", "a", function () {
        $(this).removeClass("selected");
    }).on("click", "a.git-branch-link .trash-icon", function () {

        const branchName = $(this).parent().data("branch");
        Utils.askQuestion(Strings.DELETE_LOCAL_BRANCH,
                          StringUtils.format(Strings.DELETE_LOCAL_BRANCH_NAME, branchName),
                          { booleanResponse: true })
            .then((response) => {
                if (response === true) {
                    return Git.branchDelete(branchName).catch((err) => {

                        return Utils.showOutput(err, "Branch deletion failed", {
                            question: "Do you wish to force branch deletion?"
                        }).then((response2) => {
                            if (response2 === true) {
                                return Git.forceBranchDelete(branchName).then((output) => {
                                    return Utils.showOutput(output);
                                }).catch((err2) => {
                                    ErrorHandler.showError(err2, "Forced branch deletion failed");
                                });
                            }
                        });

                    });
                }
            })
            .catch((err) => ErrorHandler.showError(err));

    }).on("click", ".merge-branch", function () {
        const fromBranch = $(this).parent().data("branch");
        doMerge(fromBranch);
    });
}

function attachCloseEvents() {
    $("html").on("click", closeDropdown);
    $("#project-files-container").on("scroll", closeDropdown);
    $("#titlebar .nav").on("click", closeDropdown);

    currentEditor = EditorManager.getCurrentFullEditor();
    if (currentEditor) {
        currentEditor._codeMirror.on("focus", closeDropdown);
    }

    // $(window).on("keydown", keydownHook);
}

function detachCloseEvents() {
    $("html").off("click", closeDropdown);
    $("#project-files-container").off("scroll", closeDropdown);
    $("#titlebar .nav").off("click", closeDropdown);

    if (currentEditor) {
        currentEditor._codeMirror.off("focus", closeDropdown);
    }

    // $(window).off("keydown", keydownHook);

    $dropdown = null;
    MainViewManager.focusActivePane();
}

function toggleDropdown(e) {
    e.stopPropagation();

    // If the dropdown is already visible, close it
    if ($dropdown) {
        closeDropdown();
        return;
    }

    Menus.closeAll();

    Git.getBranches().catch((err) => {
        ErrorHandler.showError(err, "Getting branch list failed");
    }).then((_branches) => {
        const branches = _branches.reduce((arr, branch) => {
            if (!branch.currentBranch && !branch.remote) {
                arr.push(branch.name);
            }
            return arr;
        }, []);

        $dropdown = $(renderList(branches));

        const toggleOffset = $gitBranchName.offset();
        $dropdown
            .css({
                left: toggleOffset.left,
                top: toggleOffset.top + $gitBranchName.outerHeight()
            })
            .appendTo($("body"));

        // fix so it doesn't overflow the screen
        const maxHeight = $dropdown.parent().height();
        const height = $dropdown.height();
        const topOffset = $dropdown.position().top;
        if (height + topOffset >= maxHeight - 10) {
            $dropdown.css("bottom", "10px");
        }

        PopUpManager.addPopUp($dropdown, detachCloseEvents, true);
        attachCloseEvents();
        handleEvents();
    });
}

function _getHeadFilePath() {
    return Preferences.get("currentGitRoot") + ".git/HEAD";
}

function addHeadToTheFileIndex() {
    FileSystem.resolve(_getHeadFilePath(), (err) => {
        if (err) {
            ErrorHandler.logError(err, "Resolving .git/HEAD file failed");
            return;
        }
    });
}

function checkBranch() {
    FileSystem.getFileForPath(_getHeadFilePath()).read((err, _contents) => {
        if (err) {
            ErrorHandler.showError(err, "Reading .git/HEAD file failed");
            return;
        }

        const contents = _contents.trim();

        let m = contents.match(/^ref:\s+refs\/heads\/(\S+)/);

        // alternately try to parse the hash
        if (!m) { m = contents.match(/^([a-f0-9]{40})$/); }

        if (!m) {
            ErrorHandler.showError(new Error("Failed parsing branch name from " + contents));
            return;
        }

        const branchInHead = m[1];
        const branchInUi = $gitBranchName.text();

        if (branchInHead !== branchInUi) {
            refresh();
        }
    });
}

export function refresh(): PromiseLike<void> {
    if ($gitBranchName.length === 0) { return; }

    // show info that branch is refreshing currently
    $gitBranchName
        .text("\u2026")
        .parent()
            .show();

    return Git.getGitRoot().then((gitRoot) => {
        const projectRoot = Utils.getProjectRoot();
        const isRepositoryRootOrChild = gitRoot && projectRoot.indexOf(gitRoot) === 0;

        $gitBranchName.parent().toggle(isRepositoryRootOrChild);

        if (!isRepositoryRootOrChild) {
            Preferences.set("currentGitRoot", projectRoot);
            Preferences.set("currentGitSubfolder", "");

            $gitBranchName
                .off("click")
                .text("not a git repo");
            Panel.disable("not-repo");

            return;
        }

        Preferences.set("currentGitRoot", gitRoot);
        Preferences.set("currentGitSubfolder", projectRoot.substring(gitRoot.length));

        // we are in a .git repo so read the head
        addHeadToTheFileIndex();

        return Git.getCurrentBranchName().then((_branchName) => {
            let branchName = _branchName;

            getMergeInfo().then((mergeInfo) => {

                if (mergeInfo.mergeMode) {
                    branchName += "|MERGING";
                }

                if (mergeInfo.rebaseMode) {
                    if (mergeInfo.rebaseHead) {
                        branchName = mergeInfo.rebaseHead;
                    }
                    branchName += "|REBASE";
                    if (mergeInfo.rebaseNext && mergeInfo.rebaseLast) {
                        branchName += "(" + mergeInfo.rebaseNext + "/" + mergeInfo.rebaseLast + ")";
                    }
                }

                EventEmitter.emit(Events.REBASE_MERGE_MODE, mergeInfo.rebaseMode, mergeInfo.mergeMode);

                const MAX_LEN = 20;

                $gitBranchName
                    .text(branchName.length > MAX_LEN ? branchName.substring(0, MAX_LEN) + "\u2026" : branchName)
                    .attr("title", branchName.length > MAX_LEN ? branchName : null)
                    .off("click")
                    .on("click", toggleDropdown)
                    .append($("<span class='dropdown-arrow' />"));
                Panel.enable();

            }).catch((err) => ErrorHandler.showError(err, "Reading .git state failed"));

        }).catch((ex) => {
            if (ErrorHandler.contains(ex, "unknown revision")) {
                $gitBranchName
                    .off("click")
                    .text("no branch");
                Panel.enable();
            } else {
                throw ex;
            }
        });
    }).catch((err) => {
        throw ErrorHandler.showError(err);
    });
}

export function init() {
    // Add branch name to project tree
    $gitBranchName = $("<span id='git-branch'></span>");
    $("<div id='git-branch-dropdown-toggle' class='btn-alt-quiet'></div>")
        .append("<i class='octicon octicon-git-branch'></i> ")
        .append($gitBranchName)
        .on("click", () => {
            $gitBranchName.click();
            return false;
        })
        .appendTo($("<div></div>").appendTo("#project-files-header"));
    refresh();
}

EventEmitter.on(Events.BRACKETS_FILE_CHANGED, (evt, file) => {
    if (file.fullPath === _getHeadFilePath()) {
        checkBranch();
    }
});

EventEmitter.on(Events.REFRESH_ALL, () => {
    FileSyncManager.syncOpenDocuments();
    CommandManager.execute("file.refresh");
    refresh();
});

EventEmitter.on(Events.BRACKETS_PROJECT_CHANGE, () => refresh());

EventEmitter.on(Events.BRACKETS_PROJECT_REFRESH, () => refresh());
