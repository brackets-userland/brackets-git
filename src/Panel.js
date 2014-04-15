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
        FileUtils          = brackets.getModule("file/FileUtils"),
        FileViewController = brackets.getModule("project/FileViewController"),
        KeyBindingManager  = brackets.getModule("command/KeyBindingManager"),
        LanguageManager    = brackets.getModule("language/LanguageManager"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        Menus              = brackets.getModule("command/Menus"),
        FindInFiles        = brackets.getModule("search/FindInFiles"),
        PanelManager       = brackets.getModule("view/PanelManager"),
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
        $tableContainer = $(null);

    /**
     * Reloads the Document's contents from disk, discarding any unsaved changes in the editor.
     *
     * @param {!Document} doc
     * @return {Promise} Resolved after editor has been refreshed; rejected if unable to load the
     *      file's new content. Errors are logged but no UI is shown.
     */
    function _reloadDoc(doc) {
        return Promise.cast(FileUtils.readAsText(doc.file))
            .then(function (text) {
                doc.refreshText(text, new Date());
            })
            .catch(function (err) {
                ErrorHandler.logError("Error reloading contents of " + doc.file.fullPath);
                ErrorHandler.logError(err);
            });
    }

    function lintFile(filename) {
        return CodeInspection.inspectFile(FileSystem.getFileForPath(Utils.getProjectRoot() + filename));
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

                // now we are going to be paranoid and we will check if some mofo didn't change our diff
                _getStagedDiff().then(function (diff) {
                    if (diff === stagedDiff) {
                        return Git.commit(commitMessage, amendCommit);
                    } else {
                        throw new Error("Index was changed while commit dialog was shown!");
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
        var projectRoot = Utils.getProjectRoot(),
            document = editor ? editor.document : DocumentManager.getCurrentDocument(),
            filePath = document.file.fullPath;
        if (filePath.indexOf(projectRoot) === 0) {
            filePath = filePath.substring(projectRoot.length);
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
            ErrorHandler.showError(new ExpectedError("Nothing is selected!"));
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

    function handleGitUndo(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.UNDO_CHANGES,
            question: StringUtils.format(Strings.Q_UNDO_CHANGES, _.escape(file)),
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                Git.discardFileChanges(file).then(function () {
                    var currentProjectRoot = Utils.getProjectRoot();
                    DocumentManager.getAllOpenDocuments().forEach(function (doc) {
                        if (doc.file.fullPath === currentProjectRoot + file) {
                            _reloadDoc(doc);
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
                FileSystem.resolve(Utils.getProjectRoot() + file, function (err, fileEntry) {
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

    /**
     *  strips trailing whitespace from all the diffs and adds \n to the end
     */
    function stripWhitespaceFromFile(filename, clearWholeFile) {
        return new Promise(function (resolve, reject) {

            var fullPath              = Utils.getProjectRoot() + filename,
                removeBom             = Preferences.get("removeByteOrderMark"),
                normalizeLineEndings  = Preferences.get("normalizeLineEndings");

            var _cleanLines = function (lineNumbers) {
                // clean the file
                var fileEntry = FileSystem.getFileForPath(fullPath);
                return FileUtils.readAsText(fileEntry).then(function (text) {
                    if (removeBom) {
                        // remove BOM - \ufeff
                        text = text.replace(/\ufeff/g, "");
                    }
                    if (normalizeLineEndings) {
                        // normalizes line endings
                        text = text.replace(/\r\n/g, "\n");
                    }
                    // process lines
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
                    if (Preferences.get("addEndlineToTheEndOfFile")) {
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
                    return Promise.cast(FileUtils.writeText(fileEntry, text))
                        .catch(function (err) {
                            ErrorHandler.logError("Wasn't able to clean whitespace from file: " + fullPath);
                            resolve();
                            throw err;
                        })
                        .then(function () {
                            // refresh the file if it's open in the background
                            DocumentManager.getAllOpenDocuments().forEach(function (doc) {
                                if (doc.file.fullPath === fullPath) {
                                    _reloadDoc(doc);
                                }
                            });
                            // diffs were cleaned in this file
                            resolve();
                        });
                });
            };

            if (clearWholeFile) {
                _cleanLines(null);
            } else {
                Git.diffFile(filename).then(function (diff) {
                    if (!diff) { return resolve(); }
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
                }).catch(function (ex) {
                    // This error will bubble up to preparing commit dialog so just log here
                    ErrorHandler.logError(ex);
                    reject(ex);
                });
            }
        });
    }

    function _getStagedDiff() {
        return Git.getDiffOfStagedFiles().then(function (diff) {
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
        Utils.loadPathContent(Utils.getProjectRoot() + "/.git/MERGE_MSG").then(function (msg) {
            handleGitCommit(msg);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Merge commit failed");
        });
    }

    function handleGitCommit(prefilledMessage) {
        var codeInspectionEnabled = Preferences.get("useCodeInspection");
        var stripWhitespace = Preferences.get("stripWhitespaceFromCommits");

        // Disable button (it will be enabled when selecting files after reset)
        Utils.setLoading($gitPanel.find(".git-commit"));

        // First reset staged files, then add selected files to the index.
        Git.status().then(function (files) {
            files = _.filter(files, function (file) {
                return file.status.indexOf(Git.FILE_STATUS.STAGED) !== -1;
            });

            if (files.length === 0) {
                return ErrorHandler.showError(new Error("Commit button should have been disabled"), "Nothing staged to commit");
            }

            var lintResults = [],
                promises = [];
            files.forEach(function (fileObj) {
                var queue = Promise.resolve();

                var isDeleted = fileObj.status.indexOf(Git.FILE_STATUS.DELETED) !== -1,
                    updateIndex = isDeleted;

                // strip whitespace if configured to do so and file was not deleted
                if (stripWhitespace && !isDeleted) {
                    // strip whitespace only for recognized languages so binary files won't get corrupted
                    var langId = LanguageManager.getLanguageForPath(fileObj.file).getId();
                    if (["unknown", "binary", "image", "markdown"].indexOf(langId) === -1) {
                        queue = queue.then(function () {
                            var clearWholeFile = fileObj.status.indexOf(Git.FILE_STATUS.UNTRACKED) !== -1 ||
                                                 fileObj.status.indexOf(Git.FILE_STATUS.RENAMED) !== -1;
                            return stripWhitespaceFromFile(fileObj.file, clearWholeFile);
                        });
                    }
                }

                queue = queue.then(function () {
                    // stage the files again to include stripWhitespace changes
                    // do not stage deleted files
                    if (!isDeleted) {
                        return Git.stage(fileObj.file, updateIndex);
                    }
                });

                // do a code inspection for the file, if it was not deleted
                if (codeInspectionEnabled && !isDeleted) {
                    queue = queue.then(function () {
                        return lintFile(fileObj.file).then(function (result) {
                            if (result) {
                                lintResults.push({
                                    filename: fileObj.file,
                                    result: result
                                });
                            }
                        });
                    });
                }

                promises.push(queue);
            });
            return Promise.all(promises).then(function () {
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
        var currentProjectRoot = Utils.getProjectRoot();
        var currentDoc = DocumentManager.getCurrentDocument();
        if (currentDoc) {
            $gitPanel.find("tr").each(function () {
                var currentFullPath = currentDoc.file.fullPath,
                    thisFile = $(this).attr("x-file");
                $(this).toggleClass("selected", currentProjectRoot + thisFile === currentFullPath);
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

        var p1 = Git.status();

        //- push button
        var $pushBtn = $gitPanel.find(".git-push");
        var p2 = Git.getCommitsAhead().then(function (commits) {
            $pushBtn.children("span").remove();
            if (commits.length > 0) {
                $pushBtn.append($("<span/>").text(" (" + commits.length + ")"));
            }
        }).catch(function () {
            $pushBtn.children("span").remove();
        });

        //- Clone button
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
                var currentProjectRoot = Utils.getProjectRoot();
                var currentDoc = DocumentManager.getCurrentDocument();
                if (currentDoc) {
                    var relativePath = currentDoc.file.fullPath.substring(currentProjectRoot.length);
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
                    fullPath: Utils.getProjectRoot() + $this.attr("x-file")
                });
            })
            .on("dblclick", ".modified-file", function (e) {
                var $this = $(e.currentTarget);
                if ($this.attr("x-status") === Git.FILE_STATUS.DELETED) {
                    return;
                }
                FileViewController.addToWorkingSetAndSelect(Utils.getProjectRoot() + $this.attr("x-file"));
            });

    }

    function changeUserName() {
        return Git.getConfig("user.name").then(function (currentUserName) {
            return Utils.askQuestion(Strings.CHANGE_USER_NAME, Strings.ENTER_NEW_USER_NAME, {defaultValue: currentUserName})
                .then(function (userName) {
                    if (!userName.length) { userName = currentUserName; }
                    return Git.setConfig("user.name", userName).catch(function (err) {
                        ErrorHandler.showError(err, "Impossible change username");
                    }).then(function () {
                        EventEmitter.emit(Events.GIT_USERNAME_CHANGED, userName);
                    });
                });
        });
    }

    function changeUserEmail() {
        return Git.getConfig("user.email").then(function (currentUserEmail) {
            return Utils.askQuestion(Strings.CHANGE_USER_EMAIL, Strings.ENTER_NEW_USER_EMAIL, {defaultValue: currentUserEmail})
                .then(function (userEmail) {
                    if (!userEmail.length) { userEmail = currentUserEmail; }
                    return Git.setConfig("user.email", userEmail).catch(function (err) {
                        ErrorHandler.showError(err, "Impossible change user email");
                    }).then(function () {
                        EventEmitter.emit(Events.GIT_EMAIL_CHANGED, userEmail);
                    });
                });
        });
    }

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

        gitPanel = PanelManager.createBottomPanel("brackets-git.panel", $panelHtml, 100);
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
            .on("click", ".git-push", EventEmitter.emitFactory(Events.HANDLE_PUSH))
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
            .on("click", ".change-user-name", changeUserName)
            .on("click", ".change-user-email", changeUserEmail)
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
        KeyBindingManager.addBinding(PANEL_COMMAND_ID, Preferences.get("panelShortcut"));

        CommandManager.register(Strings.COMMIT_CURRENT_SHORTCUT, COMMIT_CURRENT_CMD, commitCurrentFile);
        KeyBindingManager.addBinding(COMMIT_CURRENT_CMD, Preferences.get("commitCurrentShortcut"));

        CommandManager.register(Strings.COMMIT_ALL_SHORTCUT, COMMIT_ALL_CMD, commitAllFiles);
        KeyBindingManager.addBinding(COMMIT_ALL_CMD, Preferences.get("commitAllShortcut"));

        CommandManager.register(Strings.LAUNCH_BASH_SHORTCUT, BASH_CMD, EventEmitter.emitFactory(Events.TERMINAL_OPEN));
        KeyBindingManager.addBinding(BASH_CMD, Preferences.get("bashShortcut"));

        CommandManager.register(Strings.PUSH_SHORTCUT, PUSH_CMD, EventEmitter.emitFactory(Events.HANDLE_PUSH));
        KeyBindingManager.addBinding(PUSH_CMD, Preferences.get("pushShortcut"));

        CommandManager.register(Strings.PULL_SHORTCUT, PULL_CMD, EventEmitter.emitFactory(Events.HANDLE_PULL));
        KeyBindingManager.addBinding(PULL_CMD, Preferences.get("pullShortcut"));

        CommandManager.register(Strings.GOTO_PREVIOUS_GIT_CHANGE, GOTO_PREV_CHANGE, GutterManager.goToPrev);
        KeyBindingManager.addBinding(GOTO_PREV_CHANGE, Preferences.get("gotoPrevChangeShortcut"));

        CommandManager.register(Strings.GOTO_NEXT_GIT_CHANGE, GOTO_NEXT_CHANGE, GutterManager.goToNext);
        KeyBindingManager.addBinding(GOTO_NEXT_CHANGE, Preferences.get("gotoNextChangeShortcut"));

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

    EventEmitter.on(Events.REBASE_MERGE_MODE, function (rebaseEnabled, mergeEnabled) {
        $gitPanel.find(".git-rebase").toggle(rebaseEnabled);
        $gitPanel.find(".git-merge").toggle(mergeEnabled);
        $gitPanel.find("button.git-commit").toggle(!rebaseEnabled && !mergeEnabled);
    });

    EventEmitter.on(Events.HANDLE_GIT_COMMIT, function () {
        handleGitCommit();
    });

    exports.init = init;
    exports.refresh = refresh;
    exports.toggle = toggle;
    exports.enable = enable;
    exports.disable = disable;
    exports.getPanel = function () { return $gitPanel; };

});
