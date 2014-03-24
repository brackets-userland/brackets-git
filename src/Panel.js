/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, console, define, Mustache, refresh */

define(function (require, exports) {
    "use strict";

    var q                  = require("../thirdparty/q"),
        moment             = require("moment"),
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
        Events             = require("./Events"),
        EventEmitter       = require("./EventEmitter"),
        Preferences        = require("./Preferences"),
        ErrorHandler       = require("./ErrorHandler"),
        ExpectedError      = require("./ExpectedError"),
        Main               = require("./Main"),
        GutterManager      = require("./GutterManager"),
        Branch             = require("./Branch"),
        GitControl         = require("./GitControl"),
        Strings            = require("../strings"),
        Utils              = require("./Utils"),
        SettingsDialog     = require("./SettingsDialog"),
        PANEL_COMMAND_ID   = "brackets-git.panel";

    var gitignoreTemplate           = require("text!htmlContent/default-gitignore"),
        gitPanelTemplate            = require("text!htmlContent/git-panel.html"),
        gitPanelResultsTemplate     = require("text!htmlContent/git-panel-results.html"),
        gitPanelHistoryTemplate     = require("text!htmlContent/git-panel-history.html"),
        gitAuthorsDialogTemplate    = require("text!htmlContent/authors-dialog.html"),
        gitCommitDialogTemplate     = require("text!htmlContent/git-commit-dialog.html"),
        gitDiffDialogTemplate       = require("text!htmlContent/git-diff-dialog.html"),
        gitCommitDiffDialogTemplate = require("text!htmlContent/git-commit-diff-dialog.html"),
        questionDialogTemplate      = require("text!htmlContent/git-question-dialog.html");

    var showFileWhiteList = /^\.gitignore$/;

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

    function handleGitReset() {
        return Main.gitControl.gitReset().then(function () {
            // Branch.refresh will refresh also Panel
            return Branch.refresh();
        }).fail(function (err) {
            // reset is executed too often so just log this error, but do not display a dialog
            ErrorHandler.logError(err);
        });
    }

    function _getDefaultRemote() {
        // refactor later when Preferences are fixed
        var key = ["defaultRemotes", Main.getProjectRoot()].join(".");
        var defaultRemote = Preferences.get(key);
        return defaultRemote || "origin";
    }

    function _setDefaultRemote(remoteName) {
        // refactor later when Preferences are fixed
        var key = ["defaultRemotes", Main.getProjectRoot()].join(".");
        Preferences.persist(key, remoteName);
    }

    function clearRemotePicker() {
        gitPanel.$panel.find(".git-selected-remote")
            .html("&mdash;")
            .data("selected-remote", null);
    }

    function selectRemote(remoteName) {
        if (!remoteName) {
            return clearRemotePicker();
        }
        gitPanel.$panel.find(".git-selected-remote")
            .text(remoteName)
            .data("selected-remote", remoteName);
    }

    function handleRemotePick(e, $a) {
        var $selected = (e ? $(e.target) : $a).closest(".remote-name");
        if ($selected.length === 0) {
            clearRemotePicker();
        }
        var remoteName = $selected.data("remote-name");
        _setDefaultRemote(remoteName);
        selectRemote(remoteName);
    }

    function handleRemoteRemove(e, $a) {
        var $selected = (e ? $(e.target) : $a).closest(".remote-name"),
            remoteName = $selected.data("remote-name");

        return askQuestion(Strings.DELETE_REMOTE,
                           StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName),
                           {booleanResponse: true}).then(function (response) {
            if (response === true) {
                Main.gitControl.remoteRemove(remoteName).then(function () {
                    $selected.parent().remove();
                    // TODO: rather refresh
                    var newRemote = gitPanel.$panel.find(".git-remotes-dropdown .remote-name").first().data("remote-name");
                    selectRemote(newRemote);
                }).fail(function (err) {
                    ErrorHandler.logError(err);
                });
            }
        });
    }

    function handleRemoteCreation() {
        return askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_NAME)
        .then(function (name) {
            return askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_URL)
            .then(function (url) {
                return Main.gitControl.remoteAdd(name, url)
                .then(function () {
                    prepareRemotesPicker();
                })
                .fail(function (err) { ErrorHandler.showError(err, "Remote creation failed"); });
            });
        });
    }

    function prepareRemotesPicker() {
        Main.gitControl.getRemotes().then(function (remotes) {
            var defaultRemoteName = _getDefaultRemote(),
                $defaultRemote,
                $remotesDropdown = gitPanel.$panel.find(".git-remotes-dropdown").empty();

            gitPanel.$panel.find(".git-pull").prop("disabled", remotes.length === 0);
            gitPanel.$panel.find(".git-push").prop("disabled", remotes.length === 0);

            // Add option to define new remote
            $remotesDropdown.append("<li><a class=\"git-remote-new\"><span>" + Strings.CREATE_NEW_REMOTE + "</span></a></li>");
            $remotesDropdown.append("<li class=\"divider\"></li>");

            if (remotes.length === 0) {
                clearRemotePicker();
                return;
            }

            // Add options to change remote
            var $remotes = remotes.map(function (remoteInfo) {
                var canDelete = remoteInfo.name !== "origin";

                var $a = $("<a/>")
                    .attr("href", "#")
                    .addClass("remote-name")
                    .data("remote-name", remoteInfo.name);

                if (canDelete) {
                    $a.append("<span class='trash-icon remove-remote'>&times;</span>");
                }

                $a.append("<span class='change-remote'>" + remoteInfo.name + "</span>");
                $a.appendTo($("<li class=\"remote\"/>").appendTo($remotesDropdown));

                if (remoteInfo.name === defaultRemoteName) {
                    $defaultRemote = $a;
                }

                return $a;
            });

            if ($defaultRemote) {
                handleRemotePick(null, $defaultRemote);
            } else {
                handleRemotePick(null, _.first($remotes));
            }
        }).fail(function (err) {
            throw ErrorHandler.showError(err, "Failed to get a list of remotes.");
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
            var findStr = "[name='commit-message']",
                currentValue = $dialog.find(findStr + ":visible").val();
            $dialog.find(findStr).toggle();
            $dialog.find(findStr + ":visible").val(currentValue);
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
        var projectRoot = Main.getProjectRoot(),
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

        var isSomethingSelected = currentSelection.start.line !== currentSelection.end.line ||
                                  currentSelection.start.ch !== currentSelection.end.ch;
        if (!isSomethingSelected) {
            ErrorHandler.showError(new ExpectedError("Nothing is selected!"));
            return;
        }

        Main.gitControl.getBlame(filePath, fromLine, toLine).then(function (blame) {
            return _showAuthors(filePath, blame, fromLine, toLine);
        }).fail(function (err) {
            ErrorHandler.showError(err, "Git Blame failed");
        });
    }

    function handleAuthorsFile() {
        var filePath = _getCurrentFilePath();
        Main.gitControl.getBlame(filePath).then(function (blame) {
            return _showAuthors(filePath, blame);
        }).fail(function (err) {
            ErrorHandler.showError(err, "Git Blame failed");
        });
    }

    function handleGitDiff(file) {
        Main.gitControl.gitDiffSingle(file).then(function (diff) {
            // show the dialog with the diff
            var compiledTemplate = Mustache.render(gitDiffDialogTemplate, { file: file, Strings: Strings }),
                dialog           = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
                $dialog          = dialog.getElement();
            _makeDialogBig($dialog);
            $dialog.find(".commit-diff").append(Utils.formatDiff(diff));
        }).fail(function (err) {
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
            question: StringUtils.format(Strings.Q_DELETE_FILE, _.escape(file)),
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
                return FileUtils.writeText(fileEntry, text).fail(function (err) {
                    ErrorHandler.logError("Wasn't able to clean whitespace from file: " + fullPath);
                    rv.resolve();
                    throw err;
                }).then(function () {
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
                if (!diff) { return rv.resolve(); }
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
        var codeInspectionEnabled = Preferences.get("useCodeInspection");
        var stripWhitespace = Preferences.get("stripWhitespaceFromCommits");
        // Get checked files
        var $checked = gitPanel.$panel.find(".check-one:checked");
        // Disable button (it will be enabled when selecting files after reset)
        gitPanel.$panel.find(".git-commit").prop("disabled", true).addClass("btn-loading");
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
                if (codeInspectionEnabled && updateIndex === false) {
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
                gitPanel.$panel.find(".git-commit").removeClass("btn-loading");
                return Main.gitControl.gitDiffStaged().then(function (diff) {
                    if (!diff) {
                        return Main.gitControl.gitDiffStagedFiles().then(function (filesList) {
                            diff = Strings.DIFF_FAILED_SEE_FILES + "\n\n" + filesList;
                            return _showCommitDialog(diff, lintResults);
                        });
                    }
                    return _showCommitDialog(diff, lintResults);
                });
            });
        }).fail(function (err) {
            ErrorHandler.showError(err, "Preparing commit dialog failed");
        });
    }

    function askQuestion(title, question, options) {
        options = options || {};

        var response = q.defer();
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: title,
            question: _.escape(question),
            stringInput: !options.booleanResponse && !options.password,
            passwordInput: options.password,
            defaultValue: options.defaultValue,
            Strings: Strings
        });
        var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        if (!options.booleanResponse) {
            dialog.getElement().find("input").focus();
        }
        dialog.done(function (buttonId) {
            if (options.booleanResponse) {
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

    function handleGitPushWithPassword(originalPushError, remoteName) {
        return Main.gitControl.getBranchName().then(function (branchName) {
            if (!remoteName) {
                throw ErrorHandler.rewrapError(originalPushError, new Error("handleGitPushWithPassword remote argument is empty!"));
            }
            return Main.gitControl.getGitConfig("remote." + remoteName + ".url").then(function (remoteUrl) {
                if (!remoteUrl) {
                    throw ErrorHandler.rewrapError(originalPushError, new Error("git config remote." + remoteName + ".url is empty!"));
                }

                var isHttp = remoteUrl.indexOf("http") === 0;
                if (!isHttp) {
                    throw ErrorHandler.rewrapError(originalPushError,
                                                   new Error("Asking for username/password aborted because remote is not HTTP(S)"));
                }

                var username,
                    password,
                    hasUsername,
                    hasPassword,
                    shouldSave = false;

                var m = remoteUrl.match(/https?:\/\/([^@]+)@/);
                if (!m) {
                    hasUsername = false;
                    hasPassword = false;
                } else if (m[1].split(":").length === 1) {
                    hasUsername = true;
                    hasPassword = false;
                } else {
                    hasUsername = true;
                    hasPassword = true;
                }

                if (hasUsername && hasPassword) {
                    throw ErrorHandler.rewrapError(originalPushError, new Error("Username/password is already present in the URL"));
                }

                var p = q();
                if (!hasUsername) {
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_USERNAME).then(function (str) {
                            username = encodeURIComponent(str);
                        });
                    });
                }
                if (!hasPassword) {
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_PASSWORD, {password: true}).then(function (str) {
                            password = encodeURIComponent(str);
                        });
                    });
                }
                if (Preferences.get("storePlainTextPasswords")) {
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.SAVE_PASSWORD_QUESTION, {booleanResponse: true}).then(function (bool) {
                            shouldSave = bool;
                        });
                    });
                }
                return p.then(function () {
                    if (!hasUsername) {
                        remoteUrl = remoteUrl.replace(/(https?:\/\/)/, function (a, protocol) { return protocol + username + "@"; });
                    }
                    if (!hasPassword) {
                        var io = remoteUrl.indexOf("@");
                        remoteUrl = remoteUrl.substring(0, io) + ":" + password + remoteUrl.substring(io);
                    }
                    return Main.gitControl.gitPush(remoteUrl, branchName).then(function (stdout) {
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
    }

    function handleGitPush() {
        var $btn = gitPanel.$panel.find(".git-push").prop("disabled", true).addClass("btn-loading"),
            remoteName = gitPanel.$panel.find(".git-selected-remote").data("selected-remote");

        if (!remoteName) {
            ErrorHandler.showError("No remote has been selected for push!");
            return;
        }

        Main.gitControl.gitPush(remoteName).fail(function (err) {

            if (!ErrorHandler.contains(err, "git remote add <name> <url>")) {
                throw err;
            }
            // this will ask user to enter an origin url for pushing
            // it's pretty dumb because if he enters invalid url, he has to go to console again
            // but our users are very wise so that definitely won't happen :)))
            var defer = q.defer();
            var compiledTemplate = Mustache.render(questionDialogTemplate, {
                title: Strings.SET_ORIGIN_URL,
                question: _.escape(Strings.URL),
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
            var m = err.match(/git push --set-upstream (\S+) (\S+)/);
            if (!m) { throw err; }
            return Main.gitControl.gitPushSetUpstream(m[1], m[2]);

        }).fail(function (err) {

            var validFail = false;
            if (ErrorHandler.contains(err, "rejected because")) {
                validFail = true;
            }
            if (validFail) {
                throw err;
            } else {
                console.warn("Traditional push failed: " + err);
                return handleGitPushWithPassword(err, remoteName);
            }

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
            $btn.prop("disabled", false).removeClass("btn-loading");
            refresh();
        });
    }

    function handleGitPull() {
        var $btn = gitPanel.$panel.find(".git-pull").prop("disabled", true).addClass("btn-loading"),
            remoteName = gitPanel.$panel.find(".git-selected-remote").data("selected-remote");

        if (!remoteName) {
            ErrorHandler.showError("No remote has been selected for pull!");
            return;
        }

        Main.gitControl.gitPull(remoteName).then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PULL_RESPONSE, // title
                result // message
            );
        }).fail(function (err) {
            ErrorHandler.showError(err, "Pulling from remote repository failed.");
        }).fin(function () {
            $btn.prop("disabled", false).removeClass("btn-loading");
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
        // set the history panel to false and remove the class that show the button history active when refresh
        gitPanel.$panel.find(".git-history").removeClass("btn-active").attr("title", Strings.TOOLTIP_SHOW_HISTORY);

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

            $tableContainer.empty();
            toggleCommitButton(false);

            // remove files that we should not show
            files = _.filter(files, function (file) {
                return shouldShow(file);
            });

            gitPanel.$panel.find(".check-all").prop("checked", false).prop("disabled", files.length === 0);

            if (files.length === 0) {
                $tableContainer.append($("<p class='git-edited-list nothing-to-commit' />").text(Strings.NOTHING_TO_COMMIT));
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

        //- Clone button
        gitPanel.$panel.find(".git-clone").prop("disabled", false);

        return q.all([p1, p2]);
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

        gitPanel.$panel
            .find(".git-toggle-untracked")
                .attr("title", showingUntracked ? Strings.TOOLTIP_HIDE_UNTRACKED : Strings.TOOLTIP_SHOW_UNTRACKED)
                .find("i")
                    .toggleClass("octicon-eye", !showingUntracked)
                    .toggleClass("octicon-eye-unwatch", showingUntracked);

        refresh();
    }

    // Render the dialog with the modified files list and the diff commited
    function _showCommitDiffDialog(hashCommit, files) {
        var compiledTemplate = Mustache.render(gitCommitDiffDialogTemplate, { hashCommit: hashCommit, files: files, Strings: Strings }),
            dialog           = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
            $dialog          = dialog.getElement();
        _makeDialogBig($dialog);

        var firstFile = $dialog.find(".commit-files ul li:first-child").text().trim();
        if (firstFile) {
            Main.gitControl.getDiffOfFileFromCommit(hashCommit, firstFile).then(function (diff) {
                $dialog.find(".commit-files a").first().addClass("active");
                $dialog.find(".commit-diff").html(Utils.formatDiff(diff));
            });
        }

        $dialog.find(".commit-files a").on("click", function () {
            $(".commit-files a.active").attr("scrollPos", $(".commit-diff").scrollTop());
            var self = $(this);
            Main.gitControl.getDiffOfFileFromCommit(hashCommit, $(this).text().trim()).then(function (diff) {
                $dialog.find(".commit-files a").removeClass("active");
                self.addClass("active");
                $dialog.find(".commit-diff").html(Utils.formatDiff(diff));
                $(".commit-diff").scrollTop(self.attr("scrollPos") || 0);
            });
        });
    }

    // show a commit with given hash in a dialog
    function showHistoryCommitDialog(hash) {
        Main.gitControl.getFilesFromCommit(hash).then(function (files) {
            var list = $.map(files, function (file) {
                var dotPosition = file.lastIndexOf("."),
                    fileName = file.substring(0, dotPosition),
                    fileExtension = file.substring(dotPosition, file.length);
                return {name: fileName, extension: fileExtension};
            });
            _showCommitDiffDialog(hash, list);
        }).fail(function (err) {
            ErrorHandler.showError(err, "Failed to load list of diff files");
        });
    }

    // Render history list the first time
    function renderHistory() {
        return Main.gitControl.getBranchName().then(function (branchName) {
            // Get the history commit of the current branch
            return Main.gitControl.gitHistory(branchName).then(function (commits) {
                commits = convertCommitDates(commits);

                var template = "<table class='git-history-list bottom-panel-table table table-striped table-condensed row-highlight'>";
                template += "<tbody>";
                template += gitPanelHistoryTemplate;
                template += "</tbody>";
                template += "</table>";

                $tableContainer.append(Mustache.render(template, {
                    commits: commits
                }));
            });
        }).fail(function (err) {
            ErrorHandler.showError(err, "Failed to get history");
        });
    }

    // Load more rows in the history list on scroll
    function loadMoreHistory() {
        if ($tableContainer.find(".git-history-list").is(":visible")) {
            if (($tableContainer.prop("scrollHeight") - $tableContainer.scrollTop()) === $tableContainer.height()) {
                return Main.gitControl.getBranchName().then(function (branchName) {
                    return Main.gitControl.gitHistory(branchName, $tableContainer.find("tr.history-commit").length).then(function (commits) {
                        if (commits.length === 0) {
                            return;
                        }
                        commits = convertCommitDates(commits);

                        $tableContainer.find(".git-history-list > tbody").append(Mustache.render(gitPanelHistoryTemplate, {commits: commits}));
                    })
                    .fail(function (err) {
                        ErrorHandler.showError(err, "Failed to load more history rows");
                    });
                })
                .fail(function (err) {
                    ErrorHandler.showError(err, "Failed to get branch name");
                });
            }
        }
    }
    
    function convertCommitDates(commits) {
        var mode        = Preferences.get("dateMode"),
            format      = Strings.DATE_FORMAT,
            now         = moment(),
            yesterday   = moment().subtract("d", 1).startOf("d"),
            ownFormat   = Preferences.get("dateFormat") || Strings.DATE_FORMAT;

        _.forEach(commits, function (commit) {
            if (mode === 4) {
                // mode 4: Original Git date
                commit.date = {
                    shown: commit.date
                };
                return;
            }

            var date = moment(commit.date);
            commit.date = {
                title: ""
            };
            switch (mode) {
                // mode 0 (default): formatted with Strings.DATE_FORMAT
                default:
                case 0:
                    commit.date.shown = date.format(format);
                    break;
                // mode 1: always relative
                case 1:
                    commit.date.shown = date.fromNow();
                    commit.date.title = date.format(format);
                    break;
                // mode 2: intelligent relative/formatted
                case 2:
                    if(date.diff(yesterday) > 0) {
                        commit.date.shown = moment.duration(Math.max(date.diff(now), -24*60*60*1000), "ms").humanize(true);
                        commit.date.title = date.format(format);
                    } else {
                        commit.date.shown = date.format(format);
                    }
                    break;
                // mode 3: formatted with own format (as pref)
                case 3:
                    commit.date.shown = date.format(ownFormat);
                    commit.date.title = date.format(format);
                    break;
                /* mode 4 (Original Git date) is handled above */
            }
        });
        return commits;
    }

    // Show or hide the history list on click of .history button
    function handleToggleHistory() {

        var $panel = gitPanel.$panel,
            historyEnabled = !$panel.find(".git-history-list").is(":visible");

        // Render .git-history-list if is not already generated
        if ($tableContainer.find(".git-history-list").length === 0) { renderHistory(); }

        // Toggle commit button and check-all checkbox
        $panel.find(".git-commit, .check-all").prop("disabled", historyEnabled);

        // Toggle visibility of .git-edited-list and .git-history-list
        $tableContainer.find(".git-edited-list, .git-history-list").toggle();

        // Toggle history button
        $panel.find(".git-history").toggleClass("btn-active")
        .attr("title", historyEnabled ? Strings.TOOLTIP_HIDE_HISTORY : Strings.TOOLTIP_SHOW_HISTORY);

    }

    function handleGitInit() {
        Main.isProjectRootWritable().then(function (writable) {
            if (!writable) {
                throw new ExpectedError("Folder " + Main.getProjectRoot() + " is not writable!");
            }
            return Main.gitControl.gitInit();
        }).then(function () {
            return q.when(FileUtils.writeText(FileSystem.getFileForPath(Main.getProjectRoot() + ".gitignore"), gitignoreTemplate));
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

    function handleGitClone() {
        Main.isProjectRootEmpty()
        .then(function (isEmpty) {
            if (isEmpty) {
                return askQuestion(Strings.CLONE_REPOSITORY, Strings.ENTER_REMOTE_GIT_URL).then(function (remoteGitUrl) {
                    gitPanel.$panel.find(".git-clone").prop("disabled", true);
                    return Main.gitControl.gitClone(remoteGitUrl, ".")
                    .then(function () {
                        refresh();
                    });
                });
            }
            else {
                var err = new ExpectedError("Project root is not empty, be sure you have deleted hidden files");
                ErrorHandler.showError(err, "Cloning remote repository failed!");
            }
        })
        .fail(function (err) {
            ErrorHandler.showError(err);
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

    function openBashConsole(event) {
        var customTerminal = Preferences.get("terminalCommand"),
            customTerminalArgs = Preferences.get("terminalCommandArgs");
        Main.gitControl.terminalOpen(Main.getProjectRoot(), customTerminal, customTerminalArgs).fail(function (err) {
            if (event !== "retry" && ErrorHandler.contains(err, "Permission denied")) {
                Main.gitControl.chmodTerminalScript().fail(function (err) {
                    throw ErrorHandler.showError(err);
                }).then(function () {
                    openBashConsole("retry");
                });
                return;
            }
            throw ErrorHandler.showError(err);
        });
    }

    // Disable "commit" button if there aren't selected files and vice versa
    function toggleCommitButton(enableButton) {
        if (typeof enableButton !== "boolean") {
            enableButton = gitPanel.$panel.find(".check-one:checked").length > 0;
        }
        gitPanel.$panel.find(".git-commit").prop("disabled", !enableButton);
    }

    function undoLastLocalCommit() {
        Main.gitControl.undoLastLocalCommit().fail(function (err) { ErrorHandler.showError(err, "Impossible undo last commit");  });
        refresh();
    }

    function attachDefaultTableHandlers() {
        $tableContainer = gitPanel.$panel.find(".table-container")
            .off()
            .on("click", ".check-one", function (e) {
                e.stopPropagation();
                toggleCommitButton($(this).is(":checked") ? true : undefined);
            })
            .on("dblclick", ".check-one", function (e) {
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
            .on("click", ".modified-file", function (e) {
                var $this = $(e.currentTarget);
                if ($this.data("status") === GitControl.FILE_STATUS.DELETED) {
                    return;
                }
                CommandManager.execute(Commands.FILE_OPEN, {
                    fullPath: Main.getProjectRoot() + $this.data("file")
                });
            })
            .on("dblclick", ".modified-file", function (e) {
                var $this = $(e.currentTarget);
                if ($this.data("status") === GitControl.FILE_STATUS.DELETED) {
                    return;
                }
                FileViewController.addToWorkingSetAndSelect(Main.getProjectRoot() + $this.data("file"));
            })
            .on("click", ".history-commit", function () {
                showHistoryCommitDialog($(this).attr("data-hash"));
            })
            .on("scroll", function () {
                loadMoreHistory();
            });
    }

    function changeUserName() {
        return Main.gitControl.getGitConfig("user.name")
        .then(function (currentUserName) {
            return askQuestion(Strings.CHANGE_USER_NAME, Strings.ENTER_NEW_USER_NAME, {defaultValue: currentUserName}).then(function (userName) {
                if (!userName.length) { userName = currentUserName; }
                return Main.gitControl.setUserName(userName).fail(function (err) {
                    ErrorHandler.showError(err, "Impossible change username");
                }).then(function () {
                    EventEmitter.emit(Events.GIT_USERNAME_CHANGED, userName);
                });
            });
        });
    }

    EventEmitter.on(Events.GIT_USERNAME_CHANGED, function (userName) {
        gitPanel.$panel.find(".git-user-name").text(userName);
    });

    function changeUserEmail() {
        return Main.gitControl.getGitConfig("user.email")
        .then(function (currentUserEmail) {
            return askQuestion(Strings.CHANGE_USER_EMAIL, Strings.ENTER_NEW_USER_EMAIL, {defaultValue: currentUserEmail}).then(function (userEmail) {
                if (!userEmail.length) { userEmail = currentUserEmail; }
                return Main.gitControl.setUserEmail(userEmail).fail(function (err) {
                    ErrorHandler.showError(err, "Impossible change user email");
                }).then(function () {
                    EventEmitter.emit(Events.GIT_EMAIL_CHANGED, userEmail);
                });
            });
        });
    }

    EventEmitter.on(Events.GIT_EMAIL_CHANGED, function (email) {
        gitPanel.$panel.find(".git-user-email").text(email);
    });

    function init() {
        // Add panel
        var panelHtml = Mustache.render(gitPanelTemplate, Strings);
        var $panelHtml = $(panelHtml);
        $panelHtml.find(".git-available").hide();

        if (!Preferences.get("showBashButton")) {
            $panelHtml.find(".git-bash").remove();
        }

        if (!Preferences.get("showReportBugButton")) {
            $panelHtml.find(".git-bug").remove();
        }

        gitPanel = PanelManager.createBottomPanel("brackets-git.panel", $panelHtml, 100);

        gitPanel.$panel
            .on("click", ".close", toggle)
            .on("click", ".check-all", function () {
                var isChecked = $(this).is(":checked"),
                    checkboxes = gitPanel.$panel.find(".check-one").prop("checked", isChecked);
                // do not toggle if there are no files in the list
                toggleCommitButton(isChecked && checkboxes.length > 0);
            })
            .on("click", ".git-reset", handleGitReset)
            .on("click", ".git-commit", handleGitCommit)
            .on("click", ".git-prev-gutter", GutterManager.goToPrev)
            .on("click", ".git-next-gutter", GutterManager.goToNext)
            .on("click", ".git-toggle-untracked", handleToggleUntracked)
            .on("click", ".authors-selection", handleAuthorsSelection)
            .on("click", ".authors-file", handleAuthorsFile)
            .on("click", ".git-history", handleToggleHistory)
            .on("click", ".git-push", handleGitPush)
            .on("click", ".git-pull", handleGitPull)
            .on("click", ".git-bug", ErrorHandler.reportBug)
            .on("click", ".git-init", handleGitInit)
            .on("click", ".git-clone", handleGitClone)
            .on("click", ".change-remote", handleRemotePick)
            .on("click", ".remove-remote", handleRemoteRemove)
            .on("click", ".git-remote-new", handleRemoteCreation)
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
            .on("click", ".git-bash", openBashConsole);

        // Attaching table handlers
        attachDefaultTableHandlers();

        // Register command for opening bottom panel.
        CommandManager.register(Strings.PANEL_COMMAND, PANEL_COMMAND_ID, toggle);


        // Commit current and all shortcuts
        var GIT_MENU           = "brackets-git.gitMenu",
            COMMIT_CURRENT_CMD = "brackets-git.commitCurrent",
            COMMIT_ALL_CMD     = "brackets-git.commitAll",
            BASH_CMD           = "brackets-git.launchBash",
            PUSH_CMD           = "brackets-git.push",
            PULL_CMD           = "brackets-git.pull",
            GOTO_PREV_CHANGE   = "brackets-git.gotoPrevChange",
            GOTO_NEXT_CHANGE   = "brackets-git.gotoNextChange";

         // Add command to menu.
        var menu = Menus.getMenu(GIT_MENU);

        menu.addMenuDivider();
        menu.addMenuItem(PANEL_COMMAND_ID, Preferences.get("panelShortcut"));

        menu.addMenuDivider();
        CommandManager.register(Strings.COMMIT_CURRENT_SHORTCUT, COMMIT_CURRENT_CMD, commitCurrentFile);
        menu.addMenuItem(COMMIT_CURRENT_CMD, Preferences.get("commitCurrentShortcut"));
        CommandManager.register(Strings.COMMIT_ALL_SHORTCUT, COMMIT_ALL_CMD, commitAllFiles);
        menu.addMenuItem(COMMIT_ALL_CMD, Preferences.get("commitAllShortcut"));
        CommandManager.register(Strings.LAUNCH_BASH_SHORTCUT, BASH_CMD, openBashConsole);
        menu.addMenuItem(BASH_CMD, Preferences.get("bashShortcut"));
        CommandManager.register(Strings.PUSH_SHORTCUT, PUSH_CMD, handleGitPush);
        menu.addMenuItem(PUSH_CMD, Preferences.get("pushShortcut"));
        CommandManager.register(Strings.PULL_SHORTCUT, PULL_CMD, handleGitPull);
        menu.addMenuItem(PULL_CMD, Preferences.get("pullShortcut"));
        CommandManager.register(Strings.GOTO_PREVIOUS_GIT_CHANGE, GOTO_PREV_CHANGE, GutterManager.goToPrev);
        menu.addMenuItem(GOTO_PREV_CHANGE, Preferences.get("gotoPrevChangeShortcut"));
        CommandManager.register(Strings.GOTO_NEXT_GIT_CHANGE, GOTO_NEXT_CHANGE, GutterManager.goToNext);
        menu.addMenuItem(GOTO_NEXT_CHANGE, Preferences.get("gotoNextChangeShortcut"));

        // Add info from Git to panel
        Main.gitControl.getGitConfig("user.name").then(function (currentUserName) {
            EventEmitter.emit(Events.GIT_USERNAME_CHANGED, currentUserName);
        });
        Main.gitControl.getGitConfig("user.email").then(function (currentEmail) {
            EventEmitter.emit(Events.GIT_EMAIL_CHANGED, currentEmail);
        });
        
        // Init moment - use the correct language
        moment.lang(brackets.getLocale());
    }

    function enable() {
        EventEmitter.emit(Events.GIT_ENABLED);
        // this function is called after every Branch.refresh
        gitPanelMode = null;
        prepareRemotesPicker();
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
        EventEmitter.emit(Events.GIT_DISABLED, cause);
        gitPanelMode = cause;
        // causes: not-repo
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
