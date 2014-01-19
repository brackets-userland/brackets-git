/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, console, define, Mustache, refresh */

define(function (require, exports) {
    "use strict";
    
    var q                  = require("../thirdparty/q"),
        _                  = brackets.getModule("thirdparty/lodash"),
        CodeInspection     = brackets.getModule("language/CodeInspection"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        Commands           = brackets.getModule("command/Commands"),
        DefaultDialogs     = brackets.getModule("widgets/DefaultDialogs"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        DocumentManager    = brackets.getModule("document/DocumentManager"),
        EditorManager      = brackets.getModule("editor/EditorManager"),
        FileUtils          = brackets.getModule("file/FileUtils"),
        FileViewController = brackets.getModule("project/FileViewController"),
        LanguageManager    = brackets.getModule("language/LanguageManager"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        Menus              = brackets.getModule("command/Menus"),
        PanelManager       = brackets.getModule("view/PanelManager"),
        ProjectManager     = brackets.getModule("project/ProjectManager"),
        StringUtils        = brackets.getModule("utils/StringUtils"),
        ErrorHandler       = require("./ErrorHandler"),
        ExpectedError      = require("./ExpectedError"),
        Main               = require("./Main"),
        GitControl         = require("./GitControl"),
        Strings            = require("../strings"),
        Utils              = require("./Utils"),
        PANEL_COMMAND_ID   = "brackets-git.panel";

    var gitPanelTemplate        = require("text!htmlContent/git-panel.html"),
        gitPanelResultsTemplate = require("text!htmlContent/git-panel-results.html"),
        gitCommitDialogTemplate = require("text!htmlContent/git-commit-dialog.html"),
        gitDiffDialogTemplate   = require("text!htmlContent/git-diff-dialog.html"),
        questionDialogTemplate  = require("text!htmlContent/git-question-dialog.html");
    
    var showFileWhiteList = /^.gitignore$/;

    var gitPanel = null,
        gitPanelDisabled = null,
        gitPanelMode = null,
        showingUntracked = true;
    
    /**
     * Reloads the Document's contents from disk, discarding any unsaved changes in the editor.
     *
     * @param {!Document} doc
     * @return {$.Promise} Resolved after editor has been refreshed; rejected if unable to load the
     *      file's new content. Errors are logged but no UI is shown.
     */
    function _reloadDoc(doc) {
        var promise = FileUtils.readAsText(doc.file);
        promise.done(function (text, readTimestamp) {
            doc.refreshText(text, readTimestamp);
        });
        promise.fail(function (error) {
            console.log("Error reloading contents of " + doc.file.fullPath, error);
        });
        return promise;
    }
    
    function lintFile(filename) {
        return CodeInspection.inspectFile(FileSystem.getFileForPath(Main.getProjectRoot() + filename));
    }
    
    function _makeDialogBig($dialog) {
        var $wrapper = $dialog.parents(".modal-wrapper").first();
        if ($wrapper.length === 0) { return; }

        // We need bigger commit dialog
        var minWidth = 500,
            minHeight = 300,
            maxWidth = $wrapper.width(),
            maxHeight = $wrapper.height(),
            desiredWidth = maxWidth / 2,
            desiredHeight = maxHeight / 2;

        if (desiredWidth < minWidth) { desiredWidth = minWidth; }
        if (desiredHeight < minHeight) { desiredHeight = minHeight; }

        $dialog
            .css("margin-left", (desiredWidth / 2) + "px")
            .children(".modal-header")
                .width(desiredWidth)
            .end()
            .children(".modal-body")
                .width(desiredWidth)
                .css("max-height", desiredHeight)
            .end()
            .children(".modal-footer")
                .width(desiredWidth)
            .end();

        return { width: desiredWidth, height: desiredHeight };
    }
    
    function _showDiffDialog(file, diff) {
        var compiledTemplate = Mustache.render(gitDiffDialogTemplate, { file: file, Strings: Strings }),
            dialog           = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
            $dialog          = dialog.getElement();

        _makeDialogBig($dialog);
        $dialog.find(".commit-diff").append(Utils.formatDiff(diff));
    }
    
    function handleGitReset() {
        Main.gitControl.gitReset().then(function () {
            refresh();
        }).fail(function (err) {
            // reset is executed too often so just log this error, but do not display a dialog
            ErrorHandler.logError(err);
        });
    }
    
    function _showCommitDialog(stagedDiff, lintResults) {
        // Flatten the error structure from various providers
        lintResults.forEach(function (lintResult) {
            lintResult.errors = [];
            lintResult.result.forEach(function (resultSet) {
                if (!resultSet.result || !resultSet.result.errors) { return; }

                var providerName = resultSet.provider.name;
                resultSet.result.errors.forEach(function (e) {
                    lintResult.errors.push((e.pos.line + 1) + ": " + e.message + " (" + providerName + ")");
                });
            });
            lintResult.hasErrors = lintResult.errors.length > 0;
        });

        // Filter out only results with errors to show
        lintResults = _.filter(lintResults, function (lintResult) {
            return lintResult.hasErrors;
        });
        
        // Open the dialog
        var compiledTemplate = Mustache.render(gitCommitDialogTemplate, {
                Strings: Strings,
                hasLintProblems: lintResults.length > 0,
                lintResults: lintResults
            }),
            dialog           = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
            $dialog          = dialog.getElement();

        // We need bigger commit dialog
        _makeDialogBig($dialog);

        // Show nicely colored commit diff
        $dialog.find(".commit-diff").append(Utils.formatDiff(stagedDiff));

        // commit message handling
        function switchCommitMessageElement() {
            $dialog.find("[name='commit-message']").toggle();
            recalculateMessageLength();
        }

        function getCommitMessageElement() {
            var r = $dialog.find("[name='commit-message']:visible");
            if (r.length !== 1) {
                r = $dialog.find("[name='commit-message']");
                for (var i = 0; i < r.length; i++) {
                    if ($(r[i]).css("display") !== "none") {
                        return $(r[i]);
                    }
                }
            }
            return r;
        }

        $dialog.find("button.primary").on("click", function (e) {
            var $commitMessage = getCommitMessageElement();
            if ($commitMessage.val().trim().length === 0) {
                e.stopPropagation();
                $commitMessage.addClass("invalid");
            } else {
                $commitMessage.removeClass("invalid");
            }
        });

        $dialog.find("button.extendedCommit").on("click", switchCommitMessageElement);

        var $commitMessageCount = $dialog.find("input[name='commit-message-count']");

        // Add focus to commit message input
        getCommitMessageElement().focus();

        // Add event to count characters in commit message
        var recalculateMessageLength = function () {
            var length = getCommitMessageElement().val().replace("\n", "").trim().length;
            $commitMessageCount
                .val(length)
                .toggleClass("over50", length > 50 && length <= 100)
                .toggleClass("over100", length > 100);
        };

        $dialog.find("[name='commit-message']")
            .on("keyup", recalculateMessageLength)
            .on("change", recalculateMessageLength);
        recalculateMessageLength();

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                // this event won't launch when commit-message is empty so its safe to assume that it is not
                var commitMessage = getCommitMessageElement().val();

                Main.gitControl.gitCommit(commitMessage).then(function () {
                    return refresh();
                }).fail(function (err) {
                    ErrorHandler.showError(err, "Git Commit failed");
                });

            } else {
                handleGitReset();
            }
        });
    }
    
    function handleGitDiff(file) {
        Main.gitControl.gitDiffSingle(file).then(function (diff) {
            _showDiffDialog(file, diff);
        }).fail(function (err) {
            ErrorHandler.showError(err, "Git Diff failed");
        });
    }
    
    function handleGitUndo(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.UNDO_CHANGES,
            question: StringUtils.format(Strings.Q_UNDO_CHANGES, file),
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                Main.gitControl.gitUndoFile(file).then(function () {
                    var currentProjectRoot = Main.getProjectRoot();
                    DocumentManager.getAllOpenDocuments().forEach(function (doc) {
                        if (doc.file.fullPath === currentProjectRoot + file) {
                            _reloadDoc(doc);
                        }
                    });
                    refresh();
                }).fail(function (err) {
                    ErrorHandler.showError(err, "Git Checkout failed");
                });
            }
        });
    }
    
    function handleGitDelete(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.DELETE_FILE,
            question: StringUtils.format(Strings.Q_DELETE_FILE, file),
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                FileSystem.resolve(Main.getProjectRoot() + file, function (err, fileEntry) {
                    if (err) {
                        ErrorHandler.showError(err, "Could not resolve file");
                        return;
                    }
                    ProjectManager.deleteItem(fileEntry).done(function () {
                        refresh();
                    }).fail(function (err) {
                        ErrorHandler.showError(err, "File deletion failed");
                    });
                });
            }
        });
    }
    
    /**
     *  strips trailing whitespace from all the diffs and adds \n to the end
     */
    function stripWhitespaceFromFile(filename, clearWholeFile) {
        var rv = q.defer(),
            fullPath = Main.getProjectRoot() + filename;

        var _cleanLines = function (lineNumbers) {
            // clean the file
            var fileEntry = FileSystem.getFileForPath(fullPath);
            return FileUtils.readAsText(fileEntry).then(function (text) {
                var lines = text.split("\n");

                if (lineNumbers) {
                    lineNumbers.forEach(function (lineNumber) {
                        lines[lineNumber] = lines[lineNumber].replace(/\s+$/, "");
                    });
                } else {
                    lines.forEach(function (ln, lineNumber) {
                        lines[lineNumber] = lines[lineNumber].replace(/\s+$/, "");
                    });
                }

                // add empty line to the end, i've heard that git likes that for some reason
                if (Main.preferences.getValue("addEndlineToTheEndOfFile")) {
                    var lastLineNumber = lines.length - 1;
                    if (lines[lastLineNumber].length > 0) {
                        lines[lastLineNumber] = lines[lastLineNumber].replace(/\s+$/, "");
                    }
                    if (lines[lastLineNumber].length > 0) {
                        lines.push("");
                    }
                }
                //-
                text = lines.join("\n");
                return FileUtils.writeText(fileEntry, text).then(function () {
                    // refresh the file if it's open in the background
                    DocumentManager.getAllOpenDocuments().forEach(function (doc) {
                        if (doc.file.fullPath === fullPath) {
                            _reloadDoc(doc);
                        }
                    });
                    // diffs were cleaned in this file
                    rv.resolve();
                });
            });
        };

        if (clearWholeFile) {
            _cleanLines(null);
        } else {
            Main.gitControl.gitDiff(filename).then(function (diff) {
                var modified = [],
                    changesets = diff.split("\n").filter(function (l) { return l.match(/^@@/) !== null; });
                // collect line numbers to clean
                changesets.forEach(function (line) {
                    var i,
                        m = line.match(/^@@ -([,0-9]+) \+([,0-9]+) @@/),
                        s = m[2].split(","),
                        from = parseInt(s[0], 10),
                        to = from - 1 + (parseInt(s[1], 10) || 1);
                    for (i = from; i <= to; i++) { modified.push(i > 0 ? i - 1 : 0); }
                });
                _cleanLines(modified);
            }).fail(function (ex) {
                // This error will bubble up to preparing commit dialog so just log here
                ErrorHandler.logError(ex);
                rv.reject(ex);
            });
        }

        return rv.promise;
    }

    function handleGitCommit() {
        var stripWhitespace = Main.preferences.getValue("stripWhitespaceFromCommits");
        // Get checked files
        var $checked = gitPanel.$panel.find(".check-one:checked");
        // TODO: probably some user friendly message that no files are checked for commit.
        if ($checked.length === 0) { return; }

        // Collect file information.
        var files = $checked.closest("tr").map(function () {
            return {
                filename: $(this).data("file"),
                status:   $(this).data("status")
            };
        }).toArray();

        // Handle moved files, issue https://github.com/zaggino/brackets-git/issues/56
        for (var i = 0; i < files.length; i++) {
            var split = files[i].filename.split("->");
            if (split.length > 1) {
                var o1 = {
                    filename: split[0].trim(),
                    status: [GitControl.FILE_STATUS.DELETED]
                };
                var o2 = {
                    filename: split[1].trim(),
                    status: [GitControl.FILE_STATUS.NEWFILE]
                };
                files.splice(i, 1, o1, o2);
                i += 1;
            }
        }

        // First reset staged files, then add selected files to the index.
        Main.gitControl.gitReset().then(function () {
            var lintResults = [],
                promises = [];
            files.forEach(function (fileObj) {
                var queue = q();

                var updateIndex = false;
                if (fileObj.status.indexOf(GitControl.FILE_STATUS.DELETED) !== -1) {
                    updateIndex = true;
                }

                // strip whitespace if configured to do so and file was not deleted
                if (stripWhitespace && updateIndex === false) {
                    // strip whitespace only for recognized languages so binary files won't get corrupted
                    var langId = LanguageManager.getLanguageForPath(fileObj.filename).getId();
                    if (["unknown", "binary", "image"].indexOf(langId) === -1) {
                        queue = queue.then(function () {
                            var clearWholeFile = fileObj.status.indexOf(GitControl.FILE_STATUS.UNTRACKED) !== -1;
                            return stripWhitespaceFromFile(fileObj.filename, clearWholeFile);
                        });
                    }
                }

                queue = queue.then(function () {
                    return Main.gitControl.gitAdd(fileObj.filename, updateIndex);
                });

                // do a code inspection for the file, if it was not deleted
                if (updateIndex === false) {
                    queue = queue.then(function () {
                        return lintFile(fileObj.filename).then(function (result) {
                            if (result) {
                                lintResults.push({
                                    filename: fileObj.filename,
                                    result: result
                                });
                            }
                        });
                    });
                }

                promises.push(queue);
            });
            return q.all(promises).then(function () {
                // All files are in the index now, get the diff and show dialog.
                return Main.gitControl.gitDiffStaged().then(function (diff) {
                    if (diff) {
                        _showCommitDialog(diff, lintResults);
                    }
                });
            });
        }).fail(function (err) {
            ErrorHandler.showError(err, "Preparing commit dialog failed");
        });
    }

    function handleGitPush() {
        var $btn = gitPanel.$panel.find(".git-push").prop("disabled", true);
        Main.gitControl.gitPush().then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PUSH_RESPONSE, // title
                result // message
            );
        }).fail(function (err) {
            console.warn("Pushing to remote repositories with username / password is not supported! See github page/issues for details.");
            ErrorHandler.showError(err, "Pushing to remote repository failed, password protected repositories are not supported.");
        }).fin(function () {
            $btn.prop("disabled", false);
            refresh();
        });
    }
    
    function handleGitPull() {
        var $btn = gitPanel.$panel.find(".git-pull").prop("disabled", true);
        Main.gitControl.gitPull().then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PULL_RESPONSE, // title
                result // message
            );
        }).fin(function () {
            $btn.prop("disabled", false);
            refresh();
        });
    }

    function refreshCurrentFile() {
        var currentProjectRoot = Main.getProjectRoot();
        var currentDoc = DocumentManager.getCurrentDocument();
        if (currentDoc) {
            gitPanel.$panel.find("tr").each(function () {
                var currentFullPath = currentDoc.file.fullPath,
                    thisFile = $(this).data("file");
                $(this).toggleClass("selected", currentProjectRoot + thisFile === currentFullPath);
            });
        } else {
            gitPanel.$panel.find("tr").removeClass("selected");
        }
    }
    
    function shouldShow(fileObj) {
        if (showFileWhiteList.test(fileObj.name)) {
            return true;
        }
        return ProjectManager.shouldShow(fileObj);
    }

    function refresh() {
        if (!gitPanel.isVisible()) {
            // no point, will be refreshed when it's displayed
            return;
        }

        var $tableContainer = gitPanel.$panel.find(".table-container");

        if (gitPanelMode === "not-repo") {
            $tableContainer.empty();
            return;
        }

        Main.gitControl.getGitStatus().then(function (files) {
            var $checkAll = gitPanel.$panel.find(".check-all");
            $tableContainer.empty();

            // remove files that we should not show
            files = _.filter(files, function (file) {
                return shouldShow(file);
            });

            if (files.length === 0) {
                $tableContainer.append($("<p class='nothing-to-commit' />").text(Strings.NOTHING_TO_COMMIT));
            } else {
                // if desired, remove untracked files from the results
                if (showingUntracked === false) {
                    files = _.filter(files, function (file) {
                        return file.status.indexOf(GitControl.FILE_STATUS.UNTRACKED) === -1;
                    });
                }
                // -
                files.forEach(function (file) {
                    file.statusText = file.status.map(function (status) {
                        return Strings[status];
                    }).join(", ");
                    file.allowDiff = file.status.indexOf(GitControl.FILE_STATUS.UNTRACKED) === -1 &&
                                     file.status.indexOf(GitControl.FILE_STATUS.RENAMED) === -1 &&
                                     file.status.indexOf(GitControl.FILE_STATUS.DELETED) === -1;
                    file.allowDelete = file.status.indexOf(GitControl.FILE_STATUS.UNTRACKED) !== -1;
                    file.allowUndo = !file.allowDelete;
                });
                $tableContainer.append(Mustache.render(gitPanelResultsTemplate, {
                    files: files,
                    Strings: Strings
                }));
                $checkAll.prop("checked", false);
                refreshCurrentFile();
            }

            // TODO: move this to .init()
            $tableContainer.off()
                .on("click", ".check-one", function (e) {
                    e.stopPropagation();
                })
                .on("click", ".btn-git-diff", function (e) {
                    e.stopPropagation();
                    handleGitDiff($(e.target).closest("tr").data("file"));
                })
                .on("click", ".btn-git-undo", function (e) {
                    e.stopPropagation();
                    handleGitUndo($(e.target).closest("tr").data("file"));
                })
                .on("click", ".btn-git-delete", function (e) {
                    e.stopPropagation();
                    handleGitDelete($(e.target).closest("tr").data("file"));
                })
                .on("click", "tr", function (e) {
                    var fullPath = Main.getProjectRoot() + $(e.currentTarget).data("file");
                    CommandManager.execute(Commands.FILE_OPEN, {
                        fullPath: fullPath
                    });
                })
                .on("dblclick", "tr", function (e) {
                    var fullPath = Main.getProjectRoot() + $(e.currentTarget).data("file");
                    FileViewController.addToWorkingSetAndSelect(fullPath);
                });

        }).fail(function (err) {
            // Status is executed very often, so just log this error
            ErrorHandler.logError(err);
        });

        //- push button
        var $pushBtn = gitPanel.$panel.find(".git-push");
        Main.gitControl.getCommitsAhead().then(function (commits) {
            $pushBtn.children("span").remove();
            if (commits.length > 0) {
                $pushBtn.append($("<span/>").text(" (" + commits.length + ")"));
            }
        }).fail(function () {
            $pushBtn.children("span").remove();
        });
    }
    
    function toggle(bool) {
        if (gitPanelDisabled === true) {
            return;
        }
        if (typeof bool !== "boolean") {
            bool = !gitPanel.isVisible();
        }
        Main.preferences.setValue("panelEnabled", bool);
        Main.$icon.toggleClass("on", bool);
        gitPanel.setVisible(bool);

        // Mark menu item as enabled/disabled.
        CommandManager.get(PANEL_COMMAND_ID).setChecked(bool);

        if (bool) {
            refresh();
        }
    }

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

    function handleToggleUntracked() {
        showingUntracked = !showingUntracked;
        gitPanel.$panel.find(".git-toggle-untracked").text(showingUntracked ? Strings.BUTTON_HIDE_UNTRACKED : Strings.BUTTON_SHOW_UNTRACKED);
        refresh();
    }

    function handleGitInit() {
        Main.isProjectRootWritable().then(function (writable) {
            if (!writable) {
                throw new ExpectedError("Folder " + Main.getProjectRoot() + " is not writable!");
            }
            return Main.gitControl.gitInit();
        }).then(function () {
            return q.when(FileUtils.writeText(FileSystem.getFileForPath(Main.getProjectRoot() + ".gitignore"), ""));
        }).then(function () {
            return Main.gitControl.gitAdd(".gitignore");
        }).then(function () {
            return Main.gitControl.gitCommit("Initial commit");
        }).then(function () {
            return $(ProjectManager).triggerHandler("projectRefresh");
        }).fail(function (err) {
            ErrorHandler.showError(err, "Initializing new repository failed");
        });
    }

    function init() {
        // Add panel
        var panelHtml = Mustache.render(gitPanelTemplate, Strings);
        gitPanel = PanelManager.createBottomPanel("brackets-git.panel", $(panelHtml), 100);

        gitPanel.$panel
            .on("click", ".close", toggle)
            .on("click", ".check-all", function () {
                var isChecked = $(this).is(":checked");
                gitPanel.$panel.find(".check-one").prop("checked", isChecked);
            })
            .on("click", ".git-reset", handleGitReset)
            .on("click", ".git-commit", handleGitCommit)
            .on("click", ".git-close-notmodified", handleCloseNotModified)
            .on("click", ".git-toggle-untracked", handleToggleUntracked)
            .on("click", ".git-push", handleGitPush)
            .on("click", ".git-pull", handleGitPull)
            .on("click", ".git-bug", ErrorHandler.reportBug)
            .on("click", ".git-init", handleGitInit)
            .on("contextmenu", "tr", function (e) {
                $(this).click();
                setTimeout(function () {
                    Menus.getContextMenu("git-panel-context-menu").open(e);
                }, 1);
            });

        // Register command for opening bottom panel.
        CommandManager.register(Strings.PANEL_COMMAND, PANEL_COMMAND_ID, toggle);

        // Add command to menu.
        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(PANEL_COMMAND_ID, "Ctrl-Alt-G");

        // Make Git in status bar clickable
        $("#git-status").addClass("clickable").on("click", toggle);
    }

    function enable() {
        gitPanelMode = null;
        //
        gitPanel.$panel.find(".mainToolbar").show();
        gitPanel.$panel.find(".noRepoToolbar").hide();
        //
        Main.$icon.removeClass("warning").removeAttr("title");
        gitPanelDisabled = false;
        // after all is enabled
        refresh();
    }
    
    function disable(cause) {
        gitPanelMode = cause;
        // causes: not-repo, not-root
        if (gitPanelMode === "not-repo") {
            gitPanel.$panel.find(".mainToolbar").hide();
            gitPanel.$panel.find(".noRepoToolbar").show();
        } else {
            Main.$icon.addClass("warning").attr("title", cause);
            toggle(false);
            gitPanelDisabled = true;
        }
        refresh();
    }
    
    function getPanel() {
        return gitPanel.$panel;
    }

    exports.init = init;
    exports.refresh = refresh;
    exports.toggle = toggle;
    exports.enable = enable;
    exports.disable = disable;
    exports.refreshCurrentFile = refreshCurrentFile;
    exports.getPanel = getPanel;
});
