/*global window*/
define(function (require) {

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        Utils           = brackets.getModule("src/Utils"),
        FileUtils       = brackets.getModule("file/FileUtils");

    // Local modules
    var moment = require("moment"),
        Strings = require("strings"),
        ErrorHandler = require("src/ErrorHandler"),
        Events = require("src/Events"),
        EventEmitter = require("src/EventEmitter"),
        Git = require("src/Git/Git"),
        Preferences = require("src/Preferences");

    // Templates
    var gitPanelHistoryTemplate         = require("text!templates/git-panel-history.html"),
        gitPanelHistoryCommitsTemplate  = require("text!templates/git-panel-history-commits.html"),
        gitDiffDetailsTemplate          = require("text!templates/git-diff-details.html"),
        gitCommitDiffTemplate           = require("text!templates/git-commit-diff-dialog.html");

    // Module variables
    var $gitPanel       = $(null),
        $tableContainer = $(null),
        $historyList    = $(null);

    // Implementation

    function initVariables() {
        $gitPanel = $("#git-panel");
        $tableContainer = $gitPanel.find(".table-container");
        attachHandlers();
    }

    function attachHandlers() {
        $tableContainer.find(".history-commits-list")
            .off(".history")
            .off("click.history")
            .on("scroll.history", function () {
                loadMoreHistory();
            })
            .on("click.history", ".history-commit", function () {
                renderHistoryCommit($(this).attr("data-hash"));
            });
    }

    // Render the dialog with the modified files list and the diff commited
    function _renderCommitDiff(commit, files, selectedFile) {

        var variables                    = commit;
        variables.files                  = files;
        variables.Strings                = Strings;
        variables.enableAdvancedFeatures = Preferences.get("enableAdvancedFeatures");

        var compiledTemplate = Mustache.render(gitCommitDiffTemplate, variables),
            refreshCallback  = function () {
                EventEmitter.emit(Events.REFRESH_ALL);
            },
            $historyDiff = $gitPanel.find(".history-diff");

        $historyDiff.html(compiledTemplate);

        // Handle click on commit list's elements
        $historyDiff
             .off("click.historyDiff")
             .on("click.historyDiff", ".commit-files a", function () {
                var self = $(this),
                     file = $(this).text().trim();

                if (self.parent().is(".active")) {
                    self.parent().removeClass("active");
                }
                else {
                    $(".commit-files a.active").attr("scrollPos", $(".commit-diff").scrollTop());
                    Git.getDiffOfFileFromCommit(commit.hash, file).then(function (diff) {
                        $historyDiff.find(".commit-files li").removeClass("active");
                        self.parent().addClass("active");
                        $historyDiff.parent().find(".commit-diff").html(Utils.formatDiff(diff));
                        $(".commit-diff").scrollTop(self.attr("scrollPos") || 0);
                    });
                }
            });

        var firstFile = selectedFile || $historyDiff.find(".commit-files ul li:first-child").text().trim();
        if (firstFile) {
            Git.getDiffOfFileFromCommit(commit.hash, firstFile).then(function (diff) {
                var $fileEntry = $historyDiff.find(".commit-files a[data-file='" + firstFile + "']").first(),
                    $commitFiles = $historyDiff.find(".commit-files");
                $fileEntry.addClass("active");
                $commitFiles.animate({ scrollTop: $fileEntry.offset().top - $commitFiles.height() });
                $fileEntry.parent().find(".commit-diff").html(Utils.formatDiff(diff));
            });
        }

        $(window)
            .off("resize.historyDiff")
            .on("resize.historyDiff", function () {
                $gitPanel.find(".diff-header").width($gitPanel.find(".history-diff").width() - 12);
            })
            .trigger("resize.historyDiff");

        $historyDiff
            .off("scroll")
            .on("scroll", function () {
                if ($historyDiff.scrollTop() > 0) {
                    $(".diff-header").addClass("shadow");
                }
                else {
                    $(".diff-header").removeClass("shadow");
                }
            });

        // Remove advanced features binds to prevent double assignments
        $historyDiff.off("click.advancedFeature");

        // Add advanced features binds if needed
        if (variables.enableAdvancedFeatures) {
            $historyDiff
                .on("click.advancedFeature", ".btn-checkout", function () {
                    var cmd = "git checkout " + commit.hash;
                    Utils.askQuestion(Strings.TITLE_CHECKOUT,
                                      Strings.DIALOG_CHECKOUT + "<br><br>" + cmd,
                                      {booleanResponse: true, noescape: true})
                        .then(function (response) {
                            if (response === true) {
                                return Git.checkout(commit.hash).then(refreshCallback);
                            }
                        });
                })
                .on("click.advancedFeature", ".btn-reset-hard", function () {
                    var cmd = "git reset --hard " + commit.hash;
                    Utils.askQuestion(Strings.TITLE_RESET,
                                      Strings.DIALOG_RESET_HARD + "<br><br>" + cmd,
                                      {booleanResponse: true, noescape: true})
                        .then(function (response) {
                            if (response === true) {
                                return Git.reset("--hard", commit.hash).then(refreshCallback);
                            }
                        });
                })
                .on("click.advancedFeature", ".btn-reset-mixed", function () {
                    var cmd = "git reset --mixed " + commit.hash;
                    Utils.askQuestion(Strings.TITLE_RESET,
                                      Strings.DIALOG_RESET_MIXED + "<br><br>" + cmd,
                                      {booleanResponse: true, noescape: true})
                        .then(function (response) {
                            if (response === true) {
                                return Git.reset("--mixed", commit.hash).then(refreshCallback);
                            }
                        });
                })
                .on("click.advancedFeature", ".btn-reset-soft", function () {
                    var cmd = "git reset --soft " + commit.hash;
                    Utils.askQuestion(Strings.TITLE_RESET,
                                      Strings.DIALOG_RESET_SOFT + "<br><br>" + cmd,
                                      {booleanResponse: true, noescape: true})
                        .then(function (response) {
                            if (response === true) {
                                return Git.reset("--soft", commit.hash).then(refreshCallback);
                            }
                        });
                });
        }
    }


    // show a commit with given hash
    function renderHistoryCommit(commit) {
        Git.getFilesFromCommit(commit.hash).then(function (files) {
            var list = $.map(files, function (file) {
                // FUTURE: Remove extensionFunction one day (always use getSmartFileExtension, needs Sprint 38)
                var extensionFunction = FileUtils.getSmartFileExtension || FileUtils.getFileExtension,
                    fileExtension = extensionFunction(file),
                    i = file.lastIndexOf("." + fileExtension),
                    fileName = file.substring(0, fileExtension && i >= 0 ? i : file.length);
                return {name: fileName, extension: fileExtension ? "." + fileExtension : "", file: file};
            });
            _renderCommitDiff(commit, list, $tableContainer.find(".git-history-list").data("file-relative"));
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to load list of diff files");
        });
    }

    // Render history list the first time
    function renderHistory(file) {
        return Git.getCurrentBranchName().then(function (branchName) {
            // Get the history commits of the current branch
            var p = file ? Git.getFileHistory(file.relative, branchName) : Git.getHistory(branchName);
            return p.then(function (commits) {
                commits = convertCommitDates(commits);

                var partials = {gitPanelHistoryCommits: gitPanelHistoryCommitsTemplate, gitDiffDetails: gitDiffDetailsTemplate};

                $tableContainer
                    .append(Mustache.render(gitPanelHistoryTemplate, {commits: commits}, partials))
                      .find(".history-commits-list")
                          .prepend("<h1>" + Strings.HISTORY + "</h1>");

                $historyList = $tableContainer.find(".git-history-list")
                    .data("file", file ? file.absolute : null)
                    .data("file-relative", file ? file.relative : null);

                renderHistoryCommit(commits[0]);
            });
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to get history");
        });
    }

    // Load more rows in the history list on scroll
    function loadMoreHistory() {
        if ($historyList.is(":visible")) {
            if (($tableContainer.prop("scrollHeight") - $tableContainer.scrollTop()) === $tableContainer.height()) {
                if ($historyList.attr("x-finished") === "true") {
                    return;
                }
                return Git.getCurrentBranchName().then(function (branchName) {
                    var p,
                        file = $historyList.data("file-relative"),
                        skipCount = $tableContainer.find("tr.history-commit").length;
                    if (file) {
                        p = Git.getFileHistory(file, branchName, skipCount);
                    } else {
                        p = Git.getHistory(branchName, skipCount);
                    }
                    return p.then(function (commits) {
                        if (commits.length === 0) {
                            $historyList.attr("x-finished", "true");
                            return;
                        }
                        commits = convertCommitDates(commits);
                        $tableContainer.find(".git-history-list > tbody")
                            .append(Mustache.render(gitPanelHistoryTemplate, {commits: commits}));
                    })
                    .catch(function (err) {
                        ErrorHandler.showError(err, "Failed to load more history rows");
                    });
                })
                .catch(function (err) {
                    ErrorHandler.showError(err, "Failed to get current branch name");
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
                    if (date.diff(yesterday) > 0) {
                        commit.date.shown = moment.duration(Math.max(date.diff(now), -24 * 60 * 60 * 1000), "ms").humanize(true);
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

    function handleFileChange() {
        var currentDocument = DocumentManager.getCurrentDocument();
        if ($historyList.is(":visible") && $historyList.data("file")) {
            handleToggleHistory("FILE", currentDocument);
        }
        $gitPanel.find(".git-file-history").prop("disabled", !currentDocument);
    }

    // Show or hide the history list on click of .history button
    // newHistoryMode can be "FILE" or "GLOBAL"
    function handleToggleHistory(newHistoryMode, newDocument) {
        var historyEnabled = $historyList.is(":visible"),
            currentFile = $historyList.data("file") || null,
            currentHistoryMode = historyEnabled ? (currentFile ? "FILE" : "GLOBAL") : "DISABLED",
            $spinner = $(".spinner", $gitPanel),
            file;

        if (currentHistoryMode !== newHistoryMode) {
            // we are switching the modes so enable
            historyEnabled = true;
        } else if (!newDocument) {
            // we are not changing the mode and we are not switching to a new document
            historyEnabled = !historyEnabled;
        }

        if (historyEnabled && newHistoryMode === "FILE") {
            var doc = newDocument ? newDocument : DocumentManager.getCurrentDocument();
            if (doc) {
                file = {};
                file.absolute = doc.file.fullPath;
                file.relative = ProjectManager.makeProjectRelativeIfPossible(file.absolute);
            } else {
                // we want a file history but no file was found
                historyEnabled = false;
            }
        }

        // Render .git-history-list if is not already generated or if the viewed file for file history has changed
        if (historyEnabled && ($historyList.length === 0 || currentFile !== (file ? file.absolute : null))) {
            if ($historyList.length > 0) {
                $historyList.remove();
            }
            $spinner.addClass("spin");
            renderHistory(file).then(function () {
                $spinner.removeClass("spin");
            });
        }

        // Toggle commit button and check-all checkbox
        $gitPanel.find(".git-commit, .check-all").prop("disabled", historyEnabled);

        // Toggle visibility of .git-edited-list and .git-history-list
        $tableContainer.find(".git-edited-list").toggle(!historyEnabled);
        $historyList.toggle(historyEnabled);

        // Toggle history button
        var globalButtonActive  = historyEnabled && newHistoryMode === "GLOBAL",
            fileButtonActive    = historyEnabled && newHistoryMode === "FILE";
        $gitPanel.find(".git-history").toggleClass("active", globalButtonActive)
            .attr("title", globalButtonActive ? Strings.TOOLTIP_HIDE_HISTORY : Strings.TOOLTIP_SHOW_HISTORY);
        $gitPanel.find(".git-file-history").toggleClass("active", fileButtonActive)
            .attr("title", fileButtonActive ? Strings.TOOLTIP_HIDE_FILE_HISTORY : Strings.TOOLTIP_SHOW_FILE_HISTORY);
    }

    // Event listeners
    EventEmitter.on(Events.GIT_ENABLED, function () {
        initVariables();
    });
    EventEmitter.on(Events.HISTORY_SHOW, function (mode) {
        handleToggleHistory(mode === "FILE" ? "FILE" : "GLOBAL");
    });
    EventEmitter.on(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, function () {
        handleFileChange();
    });
});
