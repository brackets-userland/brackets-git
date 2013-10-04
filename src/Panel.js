/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, console, define, Mustache, refresh, window */

define(function (require, exports) {
    "use strict";
    
    var q                  = require("../thirdparty/q"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        Commands           = brackets.getModule("command/Commands"),
        DefaultDialogs     = brackets.getModule("widgets/DefaultDialogs"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        DocumentManager    = brackets.getModule("document/DocumentManager"),
        EditorManager      = brackets.getModule("editor/EditorManager"),
        FileUtils          = brackets.getModule("file/FileUtils"),
        FileViewController = brackets.getModule("project/FileViewController"),
        LanguageManager    = brackets.getModule("language/LanguageManager"),
        NativeFileSystem   = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        PanelManager       = brackets.getModule("view/PanelManager"),
        ProjectManager     = brackets.getModule("project/ProjectManager"),
        Main               = require("./Main"),
        GitControl         = require("./gitControl"),
        Strings            = require("../strings"),
        Utils              = require("./Utils");
    
    //+ Temp
    var CodeInspection;
    try {
        CodeInspection = brackets.getModule("language/CodeInspection");
    } catch (e) { }
    if (!CodeInspection || !CodeInspection.inspectFile) {
        CodeInspection = {
            inspectFile: function () { var d = $.Deferred(); d.resolve(null); return d.promise(); }
        };
    }
    //- Temp

    var gitPanelTemplate        = require("text!htmlContent/git-panel.html"),
        gitPanelResultsTemplate = require("text!htmlContent/git-panel-results.html"),
        gitCommitDialogTemplate = require("text!htmlContent/git-commit-dialog.html"),
        gitDiffDialogTemplate   = require("text!htmlContent/git-diff-dialog.html"),
        questionDialogTemplate  = require("text!htmlContent/git-question-dialog.html");
    
    var gitPanel = null,
        gitPanelDisabled = null;
    
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
            console.log("Error reloading contents of " + doc.file.fullPath, error.name);
        });
        return promise;
    }
    
    function lintFile(filename) {
        return CodeInspection.inspectFile(new NativeFileSystem.FileEntry(Main.getProjectRoot() + filename));
        /* TODO: remove commented code
        var rv = q.defer(),
            fileEntry = new NativeFileSystem.FileEntry(Main.getProjectRoot() + filename),
            codeInspector = CodeInspection.getProviderForFile(fileEntry);
        if (codeInspector) {
            var fileTextPromise = FileUtils.readAsText(fileEntry);
            fileTextPromise.done(function (fileText) {
                rv.resolve(codeInspector.scanFile(fileText, fileEntry.fullPath));
            });
            fileTextPromise.fail(function (error) {
                Main.logError("Error reading contents of " + fileEntry.fullPath + " (" + error + ")");
                rv.reject();
            });
        } else {
            rv.resolve(null);
        }
        return rv.promise;
        */
    }
    
    function _makeDialogBig($dialog) {
        // We need bigger commit dialog
        var minWidth = 500,
            minHeight = 300,
            maxWidth = $(window).width(),
            maxHeight = $(window).height(),
            desiredWidth = maxWidth / 2,
            desiredHeight = maxHeight / 2;

        if (desiredWidth < minWidth) { desiredWidth = minWidth; }
        if (desiredHeight < minHeight) { desiredHeight = minHeight; }

        $dialog
            .css("margin-left", "-" + (desiredWidth / 2) + "px")
            .css("margin-top", "-" + (desiredHeight / 1.6) + "px")
            .find(".modal-header")
                .width(desiredWidth)
            .end()
            .find(".modal-body")
                .width(desiredWidth)
                .css("max-height", desiredHeight);

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
        }).fail(Main.logError);
    }
    
    function _showCommitDialog(stagedDiff, lintResults) {
        lintResults.forEach(function (obj) {
            obj.hasErrors = obj.result.errors.length > 0;
            obj.errors = obj.result.errors.map(function (e) {
                // TODO: handle e.type
                return (e.pos.line + 1) + ": " + e.message;
            });
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

        $dialog.find("button.primary").on("click", function (e) {
            var $commitMessage = $dialog.find("input[name='commit-message']");
            if ($commitMessage.val().trim().length === 0) {
                e.stopPropagation();
                $commitMessage.addClass("invalid");
            } else {
                $commitMessage.removeClass("invalid");
            }
        });

        // Add focus to commit message input
        $dialog.find("input[name='commit-message']").focus();

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                // this event won't launch when commit-message is empty so its safe to assume that it is not
                var commitMessage = $dialog.find("input[name='commit-message']").val();

                Main.gitControl.gitCommit(commitMessage).then(function () {
                    return refresh();
                }).fail(Main.logError);

            } else {
                handleGitReset();
            }
        });
    }
    
    function handleGitDiff(file) {
        Main.gitControl.gitDiffSingle(file).then(function (diff) {
            _showDiffDialog(file, diff);
        }).fail(Main.logError);
    }
    
    function handleGitUndo(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.UNDO_CHANGES,
            question: Strings.Q_UNDO_CHANGES + file + Strings.Q_UNDO_CHANGES_POST,
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
                }).fail(Main.logError);
            }
        });
    }
    
    function handleGitDelete(file) {
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.DELETE_FILE,
            question: Strings.Q_DELETE_FILE + file + Strings.Q_DELETE_FILE_POST,
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                NativeFileSystem.resolveNativeFileSystemPath(Main.getProjectRoot() + file, function (fileEntry) {
                    ProjectManager.deleteItem(fileEntry);
                }, function (err) {
                    console.error(err);
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
            var fileEntry = new NativeFileSystem.FileEntry(fullPath);
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
                var lastLineNumber = lines.length - 1;
                if (lines[lastLineNumber].length > 0) {
                    lines[lastLineNumber] = lines[lastLineNumber].replace(/\s+$/, "");
                }
                if (lines[lastLineNumber].length > 0) {
                    lines.push("");
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
                    for (i = from; i <= to; i++) { modified.push(i - 1); }
                });
                _cleanLines(modified);
            }).fail(function (ex) {
                Main.logError(ex);
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
                    if (LanguageManager.getLanguageForPath(fileObj.filename).getId() !== "unknown") {
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
                Main.gitControl.gitDiffStaged().then(function (diff) {
                    if (diff) {
                        _showCommitDialog(diff, lintResults);
                    }
                });
            });
        }).fail(Main.logError);
    }

    function handleGitPush() {
        var $btn = gitPanel.$panel.find(".git-push").prop("disabled", true);
        Main.gitControl.gitPush().then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PUSH_RESPONSE, // title
                result // message
            );
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
    
    function refresh() {
        if (!gitPanel.isVisible()) {
            // no point, will be refreshed when it's displayed
            return;
        }

        Main.gitControl.getGitStatus().then(function (files) {
            var $checkAll = gitPanel.$panel.find(".check-all"),
                $tableContainer = gitPanel.$panel.find(".table-container").empty();

            if (files.length === 0) {
                $tableContainer.append($("<p class='nothing-to-commit' />").text(Strings.NOTHING_TO_COMMIT));
            } else {
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

        }).fail(Main.logError);

        //- push button
        Main.gitControl.getCommitsAhead().then(function (commits) {
            var $btn = gitPanel.$panel.find(".git-push");
            $btn.children("span").remove();
            if (commits.length > 0) {
                $btn.append($("<span/>").text(" (" + commits.length + ")"));
            }
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
            .on("click", ".git-push", handleGitPush);
    }

    function enable() {
        Main.$icon.removeClass("warning").removeAttr("title");
        gitPanelDisabled = false;
    }
    
    function disable(cause) {
        Main.$icon.addClass("warning").attr("title", cause);
        toggle(false);
        gitPanelDisabled = true;
    }
    
    exports.init = init;
    exports.refresh = refresh;
    exports.toggle = toggle;
    exports.enable = enable;
    exports.disable = disable;
    exports.refreshCurrentFile = refreshCurrentFile;
});
