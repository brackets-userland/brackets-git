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
        Branch             = require("./Branch"),
        GitControl         = require("./GitControl"),
        Strings            = require("../strings"),
        Utils              = require("./Utils"),
        PANEL_COMMAND_ID   = "brackets-git.panel",
        COMMIT_CURRENT_CMD = "brackets-git.commitCurrent",
        COMMIT_ALL_CMD     = "brackets-git.commitAll";

    var gitPanelTemplate        = require("text!htmlContent/git-panel.html"),
        gitPanelResultsTemplate = require("text!htmlContent/git-panel-results.html"),
        gitCommitDialogTemplate = require("text!htmlContent/git-commit-dialog.html"),
        gitDiffDialogTemplate   = require("text!htmlContent/git-diff-dialog.html"),
        questionDialogTemplate  = require("text!htmlContent/git-question-dialog.html");
    
    var showFileWhiteList = /^.gitignore$/;

    var gitPanel = null,
        gitPanelDisabled = null,
        gitPanelMode = null,
        showingUntracked = true,
        $tableContainer = null;
    
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
            .width(desiredWidth)
            .children(".modal-body")
                .css("max-height", desiredHeight)
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
        return Main.gitControl.gitReset().then(function () {
            Branch.refresh();
            return refresh();
        }).fail(function (err) {
            // reset is executed too often so just log this error, but do not display a dialog
            ErrorHandler.logError(err);
        });
    }
    
    function _showCommitDialog(stagedDiff, lintResults) {
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
                console.warn("[brackets-git] lintResults contain object in unexpected format: " + JSON.stringify(lintResult));
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
        Main.gitControl.getCommitsAhead().then(function (commits) {
            toggleAmendCheckbox(commits.length > 0);
        });

        // Assign action to amend checkbox
        $dialog.find(".amend-commit").on("click", function () {
            if ($(this).prop("checked") === false) {
                $dialog.find("[name='commit-message']").val("");
            } else {
                Main.gitControl.getLastCommitMessage().then(function (msg) {
                    $dialog.find("[name='commit-message']").val(msg);
                });
            }
        });

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
                var commitMessage = getCommitMessageElement().val(),
                    amendCommit = $dialog.find(".amend-commit").prop("checked");

                Main.gitControl.gitCommit(commitMessage, amendCommit).then(function () {
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
                    } else {
                        handleGitReset();
                    }
                });
            });
        }).fail(function (err) {
            ErrorHandler.showError(err, "Preparing commit dialog failed");
        });
    }

    function askQuestion(title, question, booleanResponse) {
        var response = q.defer();
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: title,
            question: question,
            stringInput: !booleanResponse,
            Strings: Strings
        });
        var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        if (!booleanResponse) {
            dialog.getElement().find("input").focus();
        }
        dialog.done(function (buttonId) {
            if (booleanResponse) {
                response.resolve(buttonId === "ok");
                return;
            }
            if (buttonId === "ok") {
                response.resolve(dialog.getElement().find("input").val().trim());
            } else {
                response.reject("User aborted!");
            }
        });
        return response.promise;
    }

    function handleGitPushWithPassword(traditionalPushError) {
        return Main.gitControl.getBranchName().then(function (branchName) {
            return Main.gitControl.getGitConfig("branch." + branchName + ".remote").then(function (remoteName) {
                return Main.gitControl.getGitConfig("remote." + remoteName + ".url").then(function (remoteUrl) {
                    var isHttp = remoteUrl.indexOf("http") === 0;
                    if (!isHttp) {
                        console.warn("Asking for username/password aborted because remote is not HTTP(S)");
                        throw traditionalPushError;
                    }

                    var username,
                        password,
                        hasUsername,
                        hasPassword,
                        shouldSave;

                    var m = remoteUrl.match(/https?:\/\/([^@]+)@/);
                    if (!m) {
                        hasUsername = false;
                        hasPassword = false;
                    } else if (m.split(":").length === 1) {
                        hasUsername = true;
                        hasPassword = false;
                    } else {
                        hasUsername = true;
                        hasPassword = true;
                    }

                    if (hasUsername && hasPassword) {
                        throw traditionalPushError;
                    }

                    var p = q();
                    if (!hasUsername) {
                        p = p.then(function () {
                            return askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_USERNAME).then(function (str) {
                                username = str;
                            });
                        });
                    }
                    if (!hasUsername) {
                        p = p.then(function () {
                            return askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_PASSWORD).then(function (str) {
                                password = str;
                            });
                        });
                    }
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.SAVE_PASSWORD_QUESTION, true).then(function (bool) {
                            shouldSave = bool;
                        });
                    });
                    return p.then(function () {
                        if (!hasUsername) {
                            remoteUrl = remoteUrl.replace(/(https?:\/\/)/, function (a, protocol) { return protocol + username + "@"; });
                        }
                        if (!hasPassword) {
                            var io = remoteUrl.indexOf("@");
                            remoteUrl = remoteUrl.substring(0, io) + ":" + password + remoteUrl.substring(io);
                        }
                        return Main.gitControl.gitPush(remoteUrl + " " + branchName).then(function (stdout) {
                            if (shouldSave) {
                                return Main.gitControl.setGitConfig("remote." + remoteName + ".url", remoteUrl).then(function () {
                                    return stdout;
                                });
                            } else {
                                return stdout;
                            }
                        });
                    });
                });
            });
        });
    }

    function handleGitPush() {
        var $btn = gitPanel.$panel.find(".git-push").prop("disabled", true);
        Main.gitControl.gitPush().fail(function (err) {

            if (typeof err !== "string") { throw err; }
            var m = err.match(/git remote add <name> <url>/);
            if (!m) { throw err; }

            // this will ask user to enter an origin url for pushing
            // it's pretty dumb because if he enters invalid url, he has to go to console again
            // but our users are very wise so that definitely won't happen :)))
            var defer = q.defer();
            var compiledTemplate = Mustache.render(questionDialogTemplate, {
                title: Strings.SET_ORIGIN_URL,
                question: Strings.URL,
                stringInput: true,
                Strings: Strings
            });
            var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            dialog.getElement().find("input").focus();
            dialog.done(function (buttonId) {
                if (buttonId === "ok") {
                    var url = dialog.getElement().find("input").val().trim();
                    Main.gitControl.remoteAdd("origin", url)
                        .then(function () {
                            return Main.gitControl.gitPush("origin");
                        })
                        .then(defer.resolve)
                        .fail(defer.reject);
                }
            });
            return defer.promise;

        }).fail(function (err) {

            if (typeof err !== "string") { throw err; }
            var m = err.match(/git push --set-upstream ([-0-9a-zA-Z]+) ([-0-9a-zA-Z]+)/);
            if (!m) { throw err; }
            return Main.gitControl.gitPushUpstream(m[1], m[2]);

        }).fail(function (err) {

            console.warn("Traditional push failed: " + err);
            return handleGitPushWithPassword(err);

        }).then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PUSH_RESPONSE, // title
                result // message
            );
        }).fail(function (err) {
            console.warn("Pushing to remote repositories with username / password is not supported! See github page/issues for details.");
            ErrorHandler.showError(err, "Pushing to remote repository failed.");
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
        if (gitPanelMode === "not-repo") {
            $tableContainer.empty();
            return q();
        }

        var p1 = Main.gitControl.getGitStatus().then(function (files) {
            // mark files in the project tree
            var projectRoot = Main.getProjectRoot();
            Main.refreshProjectFiles(files.map(function (entry) { return projectRoot + entry.file; }));

            if (!gitPanel.isVisible()) {
                return;
            }

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
        }).fail(function (err) {
            // Status is executed very often, so just log this error
            ErrorHandler.logError(err);
        });

        //- push button
        var $pushBtn = gitPanel.$panel.find(".git-push");
        var p2 = Main.gitControl.getCommitsAhead().then(function (commits) {
            $pushBtn.children("span").remove();
            if (commits.length > 0) {
                $pushBtn.append($("<span/>").text(" (" + commits.length + ")"));
            }
        }).fail(function () {
            $pushBtn.children("span").remove();
        });

        return q.all([p1, p2]);
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

    function commitCurrentFile() {
        return q.when(CommandManager.execute("file.save")).then(function () {
            return handleGitReset();
        }).then(function () {
            var currentProjectRoot = Main.getProjectRoot();
            var currentDoc = DocumentManager.getCurrentDocument();
            if (currentDoc) {
                gitPanel.$panel.find("tr").each(function () {
                    var tr = $(this);
                    tr.find(".check-one")
                      .prop("checked", currentProjectRoot + tr.data("file") === currentDoc.file.fullPath);
                });
                return handleGitCommit();
            }
        });
    }

    function commitAllFiles() {
        return q.when(CommandManager.execute("file.saveAll")).then(function () {
            return handleGitReset();
        }).then(function () {
            gitPanel.$panel.find("tr .check-one").prop("checked", true);
            return handleGitCommit();
        });
    }

    function init() {
        // Add panel
        var panelHtml = Mustache.render(gitPanelTemplate, Strings);
        var $panelHtml = $(panelHtml);
        $panelHtml.find(".git-available, .git-not-available").hide();
        gitPanel = PanelManager.createBottomPanel("brackets-git.panel", $panelHtml, 100);

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

        $tableContainer = gitPanel.$panel.find(".table-container")
            .off()
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

        // Try to get Bash version, if succeeds then Bash is available, hide otherwise
        if (brackets.platform === "win") {
            Main.gitControl.bashVersion().fail(function (e) {
                gitPanel.$panel.find(".git-bash").prop("disabled", true).attr("title", Strings.BASH_NOT_AVAILABLE);
                throw e;
            }).then(function () {
                gitPanel.$panel.find(".git-bash").on("click", function () {
                    Main.gitControl.bashOpen(Main.getProjectRoot());
                });
            });
        } else {
            gitPanel.$panel.find(".git-bash").on("click", function () {
                var customTerminal = Main.preferences.getValue("terminalCommand");
                Main.gitControl.terminalOpen(Main.getProjectRoot(), customTerminal).fail(function (err) {
                    throw ErrorHandler.showError(err);
                }).then(function (result) {
                    if (!customTerminal && result !== "ok") {
                        ErrorHandler.showError(new Error(Strings.ERROR_TERMINAL_NOT_FOUND));
                    }
                });
            });
        }

        // Register command for opening bottom panel.
        CommandManager.register(Strings.PANEL_COMMAND, PANEL_COMMAND_ID, toggle);

        // Add command to menu.
        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(PANEL_COMMAND_ID, Main.preferences.getValue("panelShortcut"));

        // Commit current and all shortcuts
        CommandManager.register(Strings.COMMIT_CURRENT_SHORTCUT, COMMIT_CURRENT_CMD, commitCurrentFile);
        menu.addMenuItem(COMMIT_CURRENT_CMD, Main.preferences.getValue("commitCurrentShortcut"));
        CommandManager.register(Strings.COMMIT_ALL_SHORTCUT, COMMIT_ALL_CMD, commitAllFiles);
        menu.addMenuItem(COMMIT_ALL_CMD, Main.preferences.getValue("commitAllShortcut"));
    }

    function enable() {
        gitPanelMode = null;
        //
        gitPanel.$panel.find(".git-available").show();
        gitPanel.$panel.find(".git-not-available").hide();
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
            gitPanel.$panel.find(".git-available").hide();
            gitPanel.$panel.find(".git-not-available").show();
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
