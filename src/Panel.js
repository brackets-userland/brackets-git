/*jshint maxstatements:false*/

define(function (require, exports) {
    "use strict";

    var moment             = require("moment"),
        Promise            = require("bluebird"),
        _                  = brackets.getModule("thirdparty/lodash"),
        CodeInspection     = brackets.getModule("language/CodeInspection"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        Commands           = brackets.getModule("command/Commands"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        DocumentManager    = brackets.getModule("document/DocumentManager"),
        EditorManager      = brackets.getModule("editor/EditorManager"),
        FileViewController = brackets.getModule("project/FileViewController"),
        KeyBindingManager  = brackets.getModule("command/KeyBindingManager"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        Menus              = brackets.getModule("command/Menus"),
        FindInFiles        = brackets.getModule("search/FindInFiles"),
        WorkspaceManager   = brackets.getModule("view/WorkspaceManager"),
        ProjectManager     = brackets.getModule("project/ProjectManager"),
        StringUtils        = brackets.getModule("utils/StringUtils"),
        Git                = require("src/git/Git"),
        Events             = require("./Events"),
        EventEmitter       = require("./EventEmitter"),
        Preferences        = require("./Preferences"),
        ErrorHandler       = require("./ErrorHandler"),
        ExpectedError      = require("./ExpectedError"),
        Main               = require("./Main"),
        GutterManager      = require("./GutterManager"),
        Strings            = require("../strings"),
        Utils              = require("src/Utils"),
        SettingsDialog     = require("./SettingsDialog"),
        ProgressDialog     = require("src/dialogs/Progress"),
        PANEL_COMMAND_ID   = "brackets-git.panel";

    var gitPanelTemplate            = require("text!templates/git-panel.html"),
        gitPanelResultsTemplate     = require("text!templates/git-panel-results.html"),
        gitAuthorsDialogTemplate    = require("text!templates/authors-dialog.html"),
        gitCommitDialogTemplate     = require("text!templates/git-commit-dialog.html"),
        gitDiffDialogTemplate       = require("text!templates/git-diff-dialog.html"),
        questionDialogTemplate      = require("text!templates/git-question-dialog.html");

    var showFileWhiteList = /^\.gitignore$/;

    var gitPanel = null,
        $gitPanel = $(null),
        gitPanelDisabled = null,
        gitPanelMode = null,
        showingUntracked = true,
        $tableContainer = $(null),
        lastCommitMessage = null;

    function lintFile(filename) {
        var fullPath = Preferences.get("currentGitRoot") + filename,
            codeInspectionPromise;

        try {
            codeInspectionPromise = CodeInspection.inspectFile(FileSystem.getFileForPath(fullPath));
        } catch (e) {
            ErrorHandler.logError("CodeInspection.inspectFile failed to execute for file " + fullPath);
            ErrorHandler.logError(e);
            codeInspectionPromise = Promise.reject(e);
        }

        return Promise.cast(codeInspectionPromise);
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
            .width(desiredWidth)
            .children(".modal-body")
                .css("max-height", desiredHeight)
            .end();

        return { width: desiredWidth, height: desiredHeight };
    }

    function _showCommitDialog(stagedDiff, lintResults, prefilledMessage) {
        lintResults = lintResults || [];

        // Flatten the error structure from various providers
        lintResults.forEach(function (lintResult) {
            lintResult.errors = [];
            if (Array.isArray(lintResult.result)) {
                lintResult.result.forEach(function (resultSet) {
                    if (!resultSet.result || !resultSet.result.errors) { return; }

                    var providerName = resultSet.provider.name;
                    resultSet.result.errors.forEach(function (e) {
                        lintResult.errors.push((e.pos.line + 1) + ": " + e.message + " (" + providerName + ")");
                    });
                });
            } else {
                ErrorHandler.logError("[brackets-git] lintResults contain object in unexpected format: " + JSON.stringify(lintResult));
            }
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

        // Enable / Disable amend checkbox
        var toggleAmendCheckbox = function (bool) {
            $dialog.find(".amend-commit")
                .prop("disabled", !bool)
                .parent()
                .attr("title", !bool ? Strings.AMEND_COMMIT_FORBIDDEN : null);
        };
        toggleAmendCheckbox(false);
        Git.getCommitsAhead().then(function (commits) {
            toggleAmendCheckbox(commits.length > 0);
        });

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

        var $commitMessageCount = $dialog.find("input[name='commit-message-count']");

        // Add event to count characters in commit message
        var recalculateMessageLength = function () {
            var val = getCommitMessageElement().val().trim(),
                length = val.length;

            if (val.indexOf("\n")) {
                // longest line
                length = Math.max.apply(null, val.split("\n").map(function (l) { return l.length; }));
            }

            $commitMessageCount
                .val(length)
                .toggleClass("over50", length > 50 && length <= 100)
                .toggleClass("over100", length > 100);
        };

        var usingTextArea = false;

        // commit message handling
        function switchCommitMessageElement() {
            usingTextArea = !usingTextArea;

            var findStr = "[name='commit-message']",
                currentValue = $dialog.find(findStr + ":visible").val();
            $dialog.find(findStr).toggle();
            $dialog.find(findStr + ":visible")
                .val(currentValue)
                .focus();
            recalculateMessageLength();
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

        $dialog.find("button.extendedCommit").on("click", function () {
            switchCommitMessageElement();
            // this value will be set only when manually triggered
            Preferences.set("useTextAreaForCommitByDefault", usingTextArea);
        });

        function prefillMessage(msg) {
            if (msg.indexOf("\n") !== -1 && !usingTextArea) {
                switchCommitMessageElement();
            }
            $dialog.find("[name='commit-message']:visible").val(msg);
            recalculateMessageLength();
        }

        // Assign action to amend checkbox
        $dialog.find(".amend-commit").on("click", function () {
            if ($(this).prop("checked") === false) {
                prefillMessage("");
            } else {
                Git.getLastCommitMessage().then(function (msg) {
                    prefillMessage(msg);
                });
            }
        });

        if (Preferences.get("useTextAreaForCommitByDefault")) {
            switchCommitMessageElement();
        }

        if (prefilledMessage) {
            prefillMessage(prefilledMessage.trim());
        }

        // Add focus to commit message input
        getCommitMessageElement().focus();

        $dialog.find("[name='commit-message']")
            .on("keyup", recalculateMessageLength)
            .on("change", recalculateMessageLength);
        recalculateMessageLength();

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                // this event won't launch when commit-message is empty so its safe to assume that it is not
                var commitMessage = getCommitMessageElement().val(),
                    amendCommit = $dialog.find(".amend-commit").prop("checked");

                // if commit message is extended and has a newline, put an empty line after first line to separate subject and body
                var s = commitMessage.split("\n");
                if (s.length > 1 && s[1].trim() !== "") {
                    s.splice(1, 0, "");
                }
                commitMessage = s.join("\n");

                // save lastCommitMessage in case the commit will fail
                lastCommitMessage = commitMessage;

                // now we are going to be paranoid and we will check if some mofo didn't change our diff
                _getStagedDiff().then(function (diff) {
                    if (diff === stagedDiff) {
                        return Git.commit(commitMessage, amendCommit).then(function () {
                            // clear lastCommitMessage because the commit was successful
                            lastCommitMessage = null;
                        });
                    } else {
                        throw new ExpectedError("The files you were going to commit were modified while commit dialog was displayed. " +
                                                "Aborting the commit as the result would be different then what was shown in the dialog.");
                    }
                }).catch(function (err) {
                    ErrorHandler.showError(err, "Git Commit failed");
                }).finally(function () {
                    EventEmitter.emit(Events.GIT_COMMITED);
                    refresh();
                });

            } else {
                // this will trigger refreshing where appropriate
                Git.status();
            }
        });
    }

    function _showAuthors(file, blame, fromLine, toLine) {
        var linesTotal = blame.length;
        var blameStats = blame.reduce(function (stats, lineInfo) {
            var name = lineInfo.author + " " + lineInfo["author-mail"];
            if (stats[name]) {
                stats[name] += 1;
            } else {
                stats[name] = 1;
            }
            return stats;
        }, {});
        blameStats = _.reduce(blameStats, function (arr, val, key) {
            arr.push({
                authorName: key,
                lines: val,
                percentage: Math.round(val / (linesTotal / 100))
            });
            return arr;
        }, []);
        blameStats = _.sortBy(blameStats, "lines").reverse();

        if (fromLine || toLine) {
            file += " (" + Strings.LINES + " " + fromLine + "-" + toLine + ")";
        }

        var compiledTemplate = Mustache.render(gitAuthorsDialogTemplate, {
                file: file,
                blameStats: blameStats,
                Strings: Strings
            });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate);
    }

    function _getCurrentFilePath(editor) {
        var gitRoot = Preferences.get("currentGitRoot"),
            document = editor ? editor.document : DocumentManager.getCurrentDocument(),
            filePath = document.file.fullPath;
        if (filePath.indexOf(gitRoot) === 0) {
            filePath = filePath.substring(gitRoot.length);
        }
        return filePath;
    }

    function handleAuthorsSelection() {
        var editor = EditorManager.getActiveEditor(),
            filePath = _getCurrentFilePath(editor),
            currentSelection = editor.getSelection(),
            fromLine = currentSelection.start.line + 1,
            toLine = currentSelection.end.line + 1;

        // fix when nothing is selected on that line
        if (currentSelection.end.ch === 0) { toLine = toLine - 1; }

        var isSomethingSelected = currentSelection.start.line !== currentSelection.end.line ||
                                  currentSelection.start.ch !== currentSelection.end.ch;
        if (!isSomethingSelected) {
            ErrorHandler.showError(new ExpectedError(Strings.ERROR_NOTHING_SELECTED));
            return;
        }

        if (editor.document.isDirty) {
            ErrorHandler.showError(new ExpectedError(Strings.ERROR_SAVE_FIRST));
            return;
        }

        Git.getBlame(filePath, fromLine, toLine).then(function (blame) {
            return _showAuthors(filePath, blame, fromLine, toLine);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Git Blame failed");
        });
    }

    function handleAuthorsFile() {
        var filePath = _getCurrentFilePath();
        Git.getBlame(filePath).then(function (blame) {
            return _showAuthors(filePath, blame);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Git Blame failed");
        });
    }

    function handleGitDiff(file) {
        if (Preferences.get("useDifftool")) {
            Git.difftool(file);
        } else {
            Git.diffFileNice(file).then(function (diff) {
                // show the dialog with the diff
                var compiledTemplate = Mustache.render(gitDiffDialogTemplate, { file: file, Strings: Strings }),
                    dialog           = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
                    $dialog          = dialog.getElement();
                _makeDialogBig($dialog);
                $dialog.find(".commit-diff").append(Utils.formatDiff(diff));
            }).catch(function (err) {
                ErrorHandler.showError(err, "Git Diff failed");
            });
        }
    }

    function handleGitUndo(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.UNDO_CHANGES,
            question: StringUtils.format(Strings.Q_UNDO_CHANGES, _.escape(file)),
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                Git.discardFileChanges(file).then(function () {
                    var gitRoot = Preferences.get("currentGitRoot");
                    DocumentManager.getAllOpenDocuments().forEach(function (doc) {
                        if (doc.file.fullPath === gitRoot + file) {
                            Utils.reloadDoc(doc);
                        }
                    });
                    refresh();
                }).catch(function (err) {
                    ErrorHandler.showError(err, "Git Checkout failed");
                });
            }
        });
    }

    function handleGitDelete(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.DELETE_FILE,
            question: StringUtils.format(Strings.Q_DELETE_FILE, _.escape(file)),
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                FileSystem.resolve(Preferences.get("currentGitRoot") + file, function (err, fileEntry) {
                    if (err) {
                        ErrorHandler.showError(err, "Could not resolve file");
                        return;
                    }
                    Promise.cast(ProjectManager.deleteItem(fileEntry))
                        .then(function () {
                            refresh();
                        })
                        .catch(function (err) {
                            ErrorHandler.showError(err, "File deletion failed");
                        });
                });
            }
        });
    }

    function _getStagedDiff() {
        return ProgressDialog.show(Git.getDiffOfStagedFiles(),
                                   Strings.GETTING_STAGED_DIFF_PROGRESS,
                                   { preDelay: 3, postDelay: 1 })
        .catch(function (err) {
            if (ErrorHandler.contains(err, "cleanup")) {
                return false; // will display list of staged files instead
            }
            throw err;
        })
        .then(function (diff) {
            if (!diff) {
                return Git.getListOfStagedFiles().then(function (filesList) {
                    return Strings.DIFF_FAILED_SEE_FILES + "\n\n" + filesList;
                });
            }
            return diff;
        });
    }

    // whatToDo gets values "continue" "skip" "abort"
    function handleRebase(whatToDo) {
        Git.rebase(whatToDo).then(function () {
            EventEmitter.emit(Events.REFRESH_ALL);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Rebase " + whatToDo + " failed");
        });
    }

    function abortMerge() {
        Git.discardAllChanges().then(function () {
            EventEmitter.emit(Events.REFRESH_ALL);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Merge abort failed");
        });
    }

    function findConflicts() {
        FindInFiles.doSearch(/^<<<<<<<\s|^=======\s|^>>>>>>>\s/gm);
    }

    function commitMerge() {
        Utils.loadPathContent(Preferences.get("currentGitRoot") + "/.git/MERGE_MSG").then(function (msg) {
            handleGitCommit(msg, true);
            EventEmitter.once(Events.GIT_COMMITED, function () {
                EventEmitter.emit(Events.REFRESH_ALL);
            });
        }).catch(function (err) {
            ErrorHandler.showError(err, "Merge commit failed");
        });
    }

    function inspectFiles(gitStatusResults) {
        var lintResults = [];

        var codeInspectionPromises = gitStatusResults.map(function (fileObj) {
            var isDeleted = fileObj.status.indexOf(Git.FILE_STATUS.DELETED) !== -1;

            // do a code inspection for the file, if it was not deleted
            if (!isDeleted) {
                return lintFile(fileObj.file)
                    .catch(function () {
                        return [
                            {
                                provider: { name: "See console [F12] for details" },
                                result: {
                                    errors: [
                                        {
                                            pos: { line: 0, ch: 0 },
                                            message: "CodeInspection failed to execute for this file."
                                        }
                                    ]
                                }
                            }
                        ];
                    })
                    .then(function (result) {
                        if (result) {
                            lintResults.push({
                                filename: fileObj.file,
                                result: result
                            });
                        }
                    });
            }
        });

        return Promise.all(_.compact(codeInspectionPromises)).then(function () {
            return lintResults;
        });
    }

    function handleGitCommit(prefilledMessage, isMerge) {

        var stripWhitespace = Preferences.get("stripWhitespaceFromCommits");
        var codeInspectionEnabled = Preferences.get("useCodeInspection");

        // Disable button (it will be enabled when selecting files after reset)
        Utils.setLoading($gitPanel.find(".git-commit"));

        // First reset staged files, then add selected files to the index.
        Git.status().then(function (files) {
            files = _.filter(files, function (file) {
                return file.status.indexOf(Git.FILE_STATUS.STAGED) !== -1;
            });

            if (files.length === 0 && !isMerge) {
                return ErrorHandler.showError(new Error("Commit button should have been disabled"), "Nothing staged to commit");
            }

            var queue = Promise.resolve();
            var lintResults;

            if (stripWhitespace) {
                queue = queue.then(function () {
                    return ProgressDialog.show(Utils.stripWhitespaceFromFiles(files),
                                               Strings.CLEANING_WHITESPACE_PROGRESS,
                                               { preDelay: 3, postDelay: 1 });
                });
            }

            if (codeInspectionEnabled) {
                queue = queue.then(function () {
                    return inspectFiles(files).then(function (_lintResults) {
                        lintResults = _lintResults;
                    });
                });
            }

            return queue.then(function () {
                // All files are in the index now, get the diff and show dialog.
                return _getStagedDiff().then(function (diff) {
                    return _showCommitDialog(diff, lintResults, prefilledMessage);
                });
            });
        }).catch(function (err) {
            ErrorHandler.showError(err, "Preparing commit dialog failed");
        }).finally(function () {
            Utils.unsetLoading($gitPanel.find(".git-commit"));
        });
    }

    function refreshCurrentFile() {
        var gitRoot = Preferences.get("currentGitRoot");
        var currentDoc = DocumentManager.getCurrentDocument();
        if (currentDoc) {
            $gitPanel.find("tr").each(function () {
                var currentFullPath = currentDoc.file.fullPath,
                    thisFile = $(this).attr("x-file");
                $(this).toggleClass("selected", gitRoot + thisFile === currentFullPath);
            });
        } else {
            $gitPanel.find("tr").removeClass("selected");
        }
    }

    function shouldShow(fileObj) {
        if (showFileWhiteList.test(fileObj.name)) {
            return true;
        }
        return ProjectManager.shouldShow(fileObj);
    }

    function _refreshTableContainer(files) {
        if (!gitPanel.isVisible()) {
            return;
        }

        // remove files that we should not show
        files = _.filter(files, function (file) {
            return shouldShow(file);
        });

        var allStaged = files.length > 0 && _.all(files, function (file) { return file.status.indexOf(Git.FILE_STATUS.STAGED) !== -1; });
        $gitPanel.find(".check-all").prop("checked", allStaged).prop("disabled", files.length === 0);

        var $editedList = $tableContainer.find(".git-edited-list");
        var visibleBefore = $editedList.length ? $editedList.is(":visible") : true;
        $editedList.remove();

        if (files.length === 0) {
            $tableContainer.append($("<p class='git-edited-list nothing-to-commit' />").text(Strings.NOTHING_TO_COMMIT));
        } else {
            // if desired, remove untracked files from the results
            if (showingUntracked === false) {
                files = _.filter(files, function (file) {
                    return file.status.indexOf(Git.FILE_STATUS.UNTRACKED) === -1;
                });
            }
            // -
            files.forEach(function (file) {
                file.staged = file.status.indexOf(Git.FILE_STATUS.STAGED) !== -1;
                file.statusText = file.status.map(function (status) {
                    return Strings["FILE_" + status];
                }).join(", ");
                file.allowDiff = file.status.indexOf(Git.FILE_STATUS.UNTRACKED) === -1 &&
                                 file.status.indexOf(Git.FILE_STATUS.RENAMED) === -1 &&
                                 file.status.indexOf(Git.FILE_STATUS.DELETED) === -1;
                file.allowDelete = file.status.indexOf(Git.FILE_STATUS.UNTRACKED) !== -1;
                file.allowUndo = !file.allowDelete;
            });
            $tableContainer.append(Mustache.render(gitPanelResultsTemplate, {
                files: files,
                Strings: Strings
            }));

            refreshCurrentFile();
        }
        $tableContainer.find(".git-edited-list").toggle(visibleBefore);
    }

    function refresh() {
        // set the history panel to false and remove the class that show the button history active when refresh
        $gitPanel.find(".git-history-toggle").removeClass("active").attr("title", Strings.TOOLTIP_SHOW_HISTORY);
        $gitPanel.find(".git-file-history").removeClass("active").attr("title", Strings.TOOLTIP_SHOW_FILE_HISTORY);

        if (gitPanelMode === "not-repo") {
            $tableContainer.empty();
            return Promise.resolve();
        }

        $tableContainer.find("#git-history-list").remove();
        $tableContainer.find(".git-edited-list").show();

        var p1 = Git.status().catch(function (err) {
            // this is an expected "error"
            if (ErrorHandler.contains(err, "Not a git repository")) {
                return;
            }
        });

        //  Push button
        var $pushBtn = $gitPanel.find(".git-push");
        var p2 = Git.getCommitsAhead().then(function (commits) {
            $pushBtn.children("span").remove();
            if (commits.length > 0) {
                $pushBtn.append($("<span/>").text(" (" + commits.length + ")"));
            }
        }).catch(function () {
            $pushBtn.children("span").remove();
        });

        // Clone button
        $gitPanel.find(".git-clone").prop("disabled", false);

        // FUTURE: who listens for this?
        return Promise.all([p1, p2]);
    }

    function toggle(bool) {
        if (gitPanelDisabled === true) {
            return;
        }
        if (typeof bool !== "boolean") {
            bool = !gitPanel.isVisible();
        }
        Preferences.persist("panelEnabled", bool);
        Main.$icon.toggleClass("on", bool);
        gitPanel.setVisible(bool);

        // Mark menu item as enabled/disabled.
        CommandManager.get(PANEL_COMMAND_ID).setChecked(bool);

        if (bool) {
            refresh();
        }
    }

    function handleToggleUntracked() {
        showingUntracked = !showingUntracked;

        $gitPanel
            .find(".git-toggle-untracked")
                .text(showingUntracked ? Strings.HIDE_UNTRACKED : Strings.SHOW_UNTRACKED);

        refresh();
    }

    function commitCurrentFile() {
        return Promise.cast(CommandManager.execute("file.save"))
            .then(function () {
                return Git.resetIndex();
            })
            .then(function () {
                var gitRoot = Preferences.get("currentGitRoot");
                var currentDoc = DocumentManager.getCurrentDocument();
                if (currentDoc) {
                    var relativePath = currentDoc.file.fullPath.substring(gitRoot.length);
                    return Git.stage(relativePath).then(function () {
                        return handleGitCommit();
                    });
                }
            });
    }

    function commitAllFiles() {
        return Promise.cast(CommandManager.execute("file.saveAll"))
            .then(function () {
                return Git.resetIndex();
            })
            .then(function () {
                return Git.stageAll().then(function () {
                    return handleGitCommit();
                });
            });
    }

    // Disable "commit" button if there aren't staged files to commit
    function _toggleCommitButton(files) {
        var anyStaged = _.any(files, function (file) { return file.status.indexOf(Git.FILE_STATUS.STAGED) !== -1; });
        $gitPanel.find(".git-commit").prop("disabled", !anyStaged);
    }

    EventEmitter.on(Events.GIT_STATUS_RESULTS, function (results) {
        _refreshTableContainer(results);
        _toggleCommitButton(results);
    });

    function undoLastLocalCommit() {
        Git.undoLastLocalCommit()
            .catch(function (err) {
                ErrorHandler.showError(err, "Impossible to undo last commit");
            })
            .finally(function () {
                refresh();
            });
    }

    var lastCheckOneClicked = null;

    function attachDefaultTableHandlers() {
        $tableContainer = $gitPanel.find(".table-container")
            .off()
            .on("click", ".check-one", function (e) {
                e.stopPropagation();
                var $tr = $(this).closest("tr"),
                    file = $tr.attr("x-file"),
                    status = $tr.attr("x-status"),
                    isChecked = $(this).is(":checked");

                if (e.shiftKey) {
                    // stage/unstage all file between
                    var lc = lastCheckOneClicked.localeCompare(file),
                        lcClickedSelector = "[x-file='" + lastCheckOneClicked + "']",
                        sequence;

                    if (lc < 0) {
                        sequence = $tr.prevUntil(lcClickedSelector).andSelf();
                    } else if (lc > 0) {
                        sequence = $tr.nextUntil(lcClickedSelector).andSelf();
                    }

                    if (sequence) {
                        sequence = sequence.add($tr.parent().children(lcClickedSelector));
                        var promises = sequence.map(function () {
                            var $this = $(this),
                                method = isChecked ? "stage" : "unstage",
                                file = $this.attr("x-file"),
                                status = $this.attr("x-status");
                            return Git[method](file, status === Git.FILE_STATUS.DELETED);
                        }).toArray();
                        return Promise.all(promises).then(function () {
                            return Git.status();
                        }).catch(function (err) {
                            ErrorHandler.showError(err, "Modifying file status failed");
                        });
                    }
                }

                lastCheckOneClicked = file;

                if (isChecked) {
                    Git.stage(file, status === Git.FILE_STATUS.DELETED).then(function () {
                        Git.status();
                    });
                } else {
                    Git.unstage(file).then(function () {
                        Git.status();
                    });
                }
            })
            .on("dblclick", ".check-one", function (e) {
                e.stopPropagation();
            })
            .on("click", ".btn-git-diff", function (e) {
                e.stopPropagation();
                handleGitDiff($(e.target).closest("tr").attr("x-file"));
            })
            .on("click", ".btn-git-undo", function (e) {
                e.stopPropagation();
                handleGitUndo($(e.target).closest("tr").attr("x-file"));
            })
            .on("click", ".btn-git-delete", function (e) {
                e.stopPropagation();
                handleGitDelete($(e.target).closest("tr").attr("x-file"));
            })
            .on("click", ".modified-file", function (e) {
                var $this = $(e.currentTarget);
                if ($this.attr("x-status") === Git.FILE_STATUS.DELETED) {
                    return;
                }
                CommandManager.execute(Commands.FILE_OPEN, {
                    fullPath: Preferences.get("currentGitRoot") + $this.attr("x-file")
                });
            })
            .on("dblclick", ".modified-file", function (e) {
                var $this = $(e.currentTarget);
                if ($this.attr("x-status") === Git.FILE_STATUS.DELETED) {
                    return;
                }
                FileViewController.addToWorkingSetAndSelect(Preferences.get("currentGitRoot") + $this.attr("x-file"));
            });

    }

    EventEmitter.on(Events.GIT_CHANGE_USERNAME, function (event, callback) {
        return Git.getConfig("user.name").then(function (currentUserName) {
            return Utils.askQuestion(Strings.CHANGE_USER_NAME, Strings.ENTER_NEW_USER_NAME, { defaultValue: currentUserName })
                .then(function (userName) {
                    if (!userName.length) { userName = currentUserName; }
                    return Git.setConfig("user.name", userName, true).catch(function (err) {
                        ErrorHandler.showError(err, "Impossible to change username");
                    }).then(function () {
                        EventEmitter.emit(Events.GIT_USERNAME_CHANGED, userName);
                    }).finally(function () {
                        if (callback) {
                            callback(userName);
                        }
                    });
                });
        });
    });

    EventEmitter.on(Events.GIT_CHANGE_EMAIL, function (event, callback) {
        return Git.getConfig("user.email").then(function (currentUserEmail) {
            return Utils.askQuestion(Strings.CHANGE_USER_EMAIL, Strings.ENTER_NEW_USER_EMAIL, { defaultValue: currentUserEmail })
                .then(function (userEmail) {
                    if (!userEmail.length) { userEmail = currentUserEmail; }
                    return Git.setConfig("user.email", userEmail, true).catch(function (err) {
                        ErrorHandler.showError(err, "Impossible to change user email");
                    }).then(function () {
                        EventEmitter.emit(Events.GIT_EMAIL_CHANGED, userEmail);
                    }).finally(function () {
                        if (callback) {
                            callback(userEmail);
                        }
                    });
                });
        });
    });

    function discardAllChanges() {
        return Utils.askQuestion(Strings.RESET_LOCAL_REPO, Strings.RESET_LOCAL_REPO_CONFIRM, { booleanResponse: true })
            .then(function (response) {
                if (response) {
                    return Git.discardAllChanges().catch(function (err) {
                        ErrorHandler.showError(err, "Reset of local repository failed");
                    }).then(function () {
                        refresh();
                    });
                }
            });
    }

    function init() {
        // Add panel
        var panelHtml = Mustache.render(gitPanelTemplate, {
            enableAdvancedFeatures: Preferences.get("enableAdvancedFeatures"),
            showBashButton: Preferences.get("showBashButton"),
            showReportBugButton: Preferences.get("showReportBugButton"),
            S: Strings
        });
        var $panelHtml = $(panelHtml);
        $panelHtml.find(".git-available, .git-not-available").hide();

        gitPanel = WorkspaceManager.createBottomPanel("brackets-git.panel", $panelHtml, 100);
        $gitPanel = gitPanel.$panel;

        $gitPanel
            .on("click", ".close", toggle)
            .on("click", ".check-all", function () {
                if ($(this).is(":checked")) {
                    return Git.stageAll().then(function () {
                        Git.status();
                    });
                } else {
                    return Git.resetIndex().then(function () {
                        Git.status();
                    });
                }
            })
            .on("click", ".git-refresh", EventEmitter.emitFactory(Events.REFRESH_ALL))
            .on("click", ".git-commit", EventEmitter.emitFactory(Events.HANDLE_GIT_COMMIT))
            .on("click", ".git-rebase-continue", function (e) { handleRebase("continue", e); })
            .on("click", ".git-rebase-skip", function (e) { handleRebase("skip", e); })
            .on("click", ".git-rebase-abort", function (e) { handleRebase("abort", e); })
            .on("click", ".git-commit-merge", commitMerge)
            .on("click", ".git-merge-abort", abortMerge)
            .on("click", ".git-find-conflicts", findConflicts)
            .on("click", ".git-prev-gutter", GutterManager.goToPrev)
            .on("click", ".git-next-gutter", GutterManager.goToNext)
            .on("click", ".git-toggle-untracked", handleToggleUntracked)
            .on("click", ".authors-selection", handleAuthorsSelection)
            .on("click", ".authors-file", handleAuthorsFile)
            .on("click", ".git-file-history", EventEmitter.emitFactory(Events.HISTORY_SHOW, "FILE"))
            .on("click", ".git-history-toggle", EventEmitter.emitFactory(Events.HISTORY_SHOW, "GLOBAL"))
            .on("click", ".git-push", function () {
                var typeOfRemote = $(this).attr("x-selected-remote-type");
                if (typeOfRemote === "git") {
                    EventEmitter.emit(Events.HANDLE_PUSH);
                }
            })
            .on("click", ".git-pull", EventEmitter.emitFactory(Events.HANDLE_PULL))
            .on("click", ".git-bug", ErrorHandler.reportBug)
            .on("click", ".git-init", EventEmitter.emitFactory(Events.HANDLE_GIT_INIT))
            .on("click", ".git-clone", EventEmitter.emitFactory(Events.HANDLE_GIT_CLONE))
            .on("click", ".change-remote", EventEmitter.emitFactory(Events.HANDLE_REMOTE_PICK))
            .on("click", ".remove-remote", EventEmitter.emitFactory(Events.HANDLE_REMOTE_DELETE))
            .on("click", ".git-remote-new", EventEmitter.emitFactory(Events.HANDLE_REMOTE_CREATE))
            .on("click", ".git-settings", SettingsDialog.show)
            .on("contextmenu", "tr", function (e) {
                var $this = $(this);
                if ($this.hasClass("history-commit")) { return; }

                $this.click();
                setTimeout(function () {
                    Menus.getContextMenu("git-panel-context-menu").open(e);
                }, 1);
            })
            .on("click", ".change-user-name", EventEmitter.emitFactory(Events.GIT_CHANGE_USERNAME))
            .on("click", ".change-user-email", EventEmitter.emitFactory(Events.GIT_CHANGE_EMAIL))
            .on("click", ".undo-last-commit", undoLastLocalCommit)
            .on("click", ".git-bash", EventEmitter.emitFactory(Events.TERMINAL_OPEN))
            .on("click", ".reset-all", discardAllChanges);

        /* Put here event handlers for advanced actions
        if (Preferences.get("enableAdvancedFeatures")) {

            $gitPanel
                .on("click", target, function);

         }
         */

        // Attaching table handlers
        attachDefaultTableHandlers();

        // Commit current and all shortcuts
        var COMMIT_CURRENT_CMD = "brackets-git.commitCurrent",
            COMMIT_ALL_CMD     = "brackets-git.commitAll",
            BASH_CMD           = "brackets-git.launchBash",
            PUSH_CMD           = "brackets-git.push",
            PULL_CMD           = "brackets-git.pull",
            GOTO_PREV_CHANGE   = "brackets-git.gotoPrevChange",
            GOTO_NEXT_CHANGE   = "brackets-git.gotoNextChange";

        // Add command to menu.
        // Register command for opening bottom panel.
        CommandManager.register(Strings.PANEL_COMMAND, PANEL_COMMAND_ID, toggle);
        KeyBindingManager.addBinding(PANEL_COMMAND_ID, Preferences.get("panelShortcut"), brackets.platform);

        CommandManager.register(Strings.COMMIT_CURRENT_SHORTCUT, COMMIT_CURRENT_CMD, commitCurrentFile);
        KeyBindingManager.addBinding(COMMIT_CURRENT_CMD, Preferences.get("commitCurrentShortcut"), brackets.platform);

        CommandManager.register(Strings.COMMIT_ALL_SHORTCUT, COMMIT_ALL_CMD, commitAllFiles);
        KeyBindingManager.addBinding(COMMIT_ALL_CMD, Preferences.get("commitAllShortcut"), brackets.platform);

        CommandManager.register(Strings.LAUNCH_BASH_SHORTCUT, BASH_CMD, EventEmitter.emitFactory(Events.TERMINAL_OPEN));
        KeyBindingManager.addBinding(BASH_CMD, Preferences.get("bashShortcut"), brackets.platform);

        CommandManager.register(Strings.PUSH_SHORTCUT, PUSH_CMD, EventEmitter.emitFactory(Events.HANDLE_PUSH));
        KeyBindingManager.addBinding(PUSH_CMD, Preferences.get("pushShortcut"), brackets.platform);

        CommandManager.register(Strings.PULL_SHORTCUT, PULL_CMD, EventEmitter.emitFactory(Events.HANDLE_PULL));
        KeyBindingManager.addBinding(PULL_CMD, Preferences.get("pullShortcut"), brackets.platform);

        CommandManager.register(Strings.GOTO_PREVIOUS_GIT_CHANGE, GOTO_PREV_CHANGE, GutterManager.goToPrev);
        KeyBindingManager.addBinding(GOTO_PREV_CHANGE, Preferences.get("gotoPrevChangeShortcut"), brackets.platform);

        CommandManager.register(Strings.GOTO_NEXT_GIT_CHANGE, GOTO_NEXT_CHANGE, GutterManager.goToNext);
        KeyBindingManager.addBinding(GOTO_NEXT_CHANGE, Preferences.get("gotoNextChangeShortcut"), brackets.platform);

        // Init moment - use the correct language
        moment.lang(brackets.getLocale());

        // Show gitPanel when appropriate
        if (Preferences.get("panelEnabled")) {
            toggle(true);
        }
    }

    function enable() {
        EventEmitter.emit(Events.GIT_ENABLED);
        // this function is called after every Branch.refresh
        gitPanelMode = null;
        //
        $gitPanel.find(".git-available").show();
        $gitPanel.find(".git-not-available").hide();
        //
        Main.$icon.removeClass("warning").removeAttr("title");
        gitPanelDisabled = false;
        // after all is enabled
        refresh();
    }

    function disable(cause) {
        EventEmitter.emit(Events.GIT_DISABLED, cause);
        gitPanelMode = cause;
        // causes: not-repo
        if (gitPanelMode === "not-repo") {
            $gitPanel.find(".git-available").hide();
            $gitPanel.find(".git-not-available").show();
        } else {
            Main.$icon.addClass("warning").attr("title", cause);
            toggle(false);
            gitPanelDisabled = true;
        }
        refresh();
    }

    // Event listeners
    EventEmitter.on(Events.GIT_USERNAME_CHANGED, function (userName) {
        $gitPanel.find(".git-user-name").text(userName);
    });

    EventEmitter.on(Events.GIT_EMAIL_CHANGED, function (email) {
        $gitPanel.find(".git-user-email").text(email);
    });

    EventEmitter.on(Events.GIT_REMOTE_AVAILABLE, function () {
        $gitPanel.find(".git-pull").prop("disabled", false);
        $gitPanel.find(".git-push").prop("disabled", false);
    });

    EventEmitter.on(Events.GIT_REMOTE_NOT_AVAILABLE, function () {
        $gitPanel.find(".git-pull").prop("disabled", true);
        $gitPanel.find(".git-push").prop("disabled", true);
    });

    EventEmitter.on(Events.GIT_ENABLED, function () {
        // Add info from Git to panel
        Git.getConfig("user.name").then(function (currentUserName) {
            EventEmitter.emit(Events.GIT_USERNAME_CHANGED, currentUserName);
        });
        Git.getConfig("user.email").then(function (currentEmail) {
            EventEmitter.emit(Events.GIT_EMAIL_CHANGED, currentEmail);
        });
    });

    EventEmitter.on(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, function () {
        if (!gitPanel) { return; }
        refreshCurrentFile();
    });

    EventEmitter.on(Events.BRACKETS_DOCUMENT_SAVED, function () {
        if (!gitPanel) { return; }
        refresh();
    });

    EventEmitter.on(Events.BRACKETS_FILE_CHANGED, function (event, fileSystemEntry) {
        // files are added or deleted from the directory
        if (fileSystemEntry.isDirectory) {
            refresh();
        }
    });

    EventEmitter.on(Events.REBASE_MERGE_MODE, function (rebaseEnabled, mergeEnabled) {
        $gitPanel.find(".git-rebase").toggle(rebaseEnabled);
        $gitPanel.find(".git-merge").toggle(mergeEnabled);
        $gitPanel.find("button.git-commit").toggle(!rebaseEnabled && !mergeEnabled);
    });

    EventEmitter.on(Events.HANDLE_GIT_COMMIT, function () {
        handleGitCommit(lastCommitMessage, false);
    });

    EventEmitter.on(Events.TERMINAL_DISABLE, function (where) {
        $gitPanel.find(".git-bash").prop("disabled", true).attr("title", Strings.TERMINAL_DISABLED + " @ " + where);
    });

    exports.init = init;
    exports.refresh = refresh;
    exports.toggle = toggle;
    exports.enable = enable;
    exports.disable = disable;
    exports.getPanel = function () { return $gitPanel; };

});
