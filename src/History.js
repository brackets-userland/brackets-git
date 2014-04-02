define(function (require) {

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        ProjectManager = brackets.getModule("project/ProjectManager");

    // Local modules
    var moment = require("moment"),
        Strings = require("strings"),
        ErrorHandler = require("src/ErrorHandler"),
        Events = require("src/Events"),
        EventEmitter = require("src/EventEmitter"),
        Git = require("src/Git/Git"),
        Preferences = require("src/Preferences");

    // Templates
    var gitPanelHistoryTemplate = require("text!templates/git-panel-history.html");

    // Module variables
    var $gitPanel = $(null),
        $tableContainer = $(null);

    // Implementation

    function initVariables() {
        $gitPanel = $("#git-panel");
        $tableContainer = $gitPanel.find(".table-container");
        attachHandlers();
    }

    function attachHandlers() {
        $tableContainer
            .off(".history")
            .on("scroll.history", function () {
                loadMoreHistory();
            });
    }

    // Render history list the first time
    function renderHistory(file) {
        return Git.getCurrentBranchName().then(function (branchName) {
            // Get the history commits of the current branch
            var p;
            if (file) {
                p = Git.getFileHistory(file.relative, branchName);
            } else {
                p = Git.getHistory(branchName);
            }
            return p.then(function (commits) {
                commits = convertCommitDates(commits);

                var template = "<table class='git-history-list bottom-panel-table table table-striped table-condensed row-highlight'>";
                template += "<tbody>";
                template += gitPanelHistoryTemplate;
                template += "</tbody>";
                template += "</table>";

                $tableContainer.append(Mustache.render(template, {
                    commits: commits
                }));

                $(".git-history-list", $tableContainer)
                    .data("file", file ? file.absolute : null)
                    .data("file-relative", file ? file.relative : null);
            });
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to get history");
        });
    }

    // Load more rows in the history list on scroll
    function loadMoreHistory() {
        if ($tableContainer.find(".git-history-list").is(":visible")) {
            if (($tableContainer.prop("scrollHeight") - $tableContainer.scrollTop()) === $tableContainer.height()) {
                return Git.getCurrentBranchName().then(function (branchName) {
                    var p,
                        file = $tableContainer.find(".git-history-list").data("file-relative"),
                        skipCount = $tableContainer.find("tr.history-commit").length;
                    if (file) {
                        p = Git.getFileHistory(file, branchName, skipCount);
                    } else {
                        p = Git.getHistory(branchName, skipCount);
                    }
                    return p.then(function (commits) {
                        if (commits.length === 0) { return; }
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
        var noDoc = !DocumentManager.getCurrentDocument(),
            $historyList = $tableContainer.find(".git-history-list");
        if ($historyList.is(":visible") && $historyList.data("file")) {
            handleToggleHistory("FILE", noDoc);
        }
        $gitPanel.find(".git-file-history").prop("disabled", noDoc);
    }

    // Show or hide the history list on click of .history button
    // newHistoryMode can be "FILE" or "GLOBAL"
    function handleToggleHistory(newHistoryMode, toggleVisibility) {
        if (toggleVisibility === undefined) {
            toggleVisibility = true;
        }

        var $historyList = $tableContainer.find(".git-history-list"),
            historyEnabled = !$historyList.is(":visible"),
            currentHistoryMode = $historyList.data("file") ? "FILE" : "GLOBAL",
            file;

        if (!toggleVisibility || (!historyEnabled && currentHistoryMode !== newHistoryMode)) {
            historyEnabled = !historyEnabled;
        }

        if (newHistoryMode === "FILE") {
            var doc = DocumentManager.getCurrentDocument();
            if (doc) {
                file = {};
                file.absolute = doc.file.fullPath;
                file.relative = ProjectManager.makeProjectRelativeIfPossible(file.absolute);
            }
        }

        // Render .git-history-list if is not already generated or if the viewed file for file history has changed
        if (historyEnabled && ($historyList.length === 0 || $historyList.data("file") !== ((file && file.absolute) || ""))) {
            if ($historyList.length > 0) {
                $historyList.remove();
            }
            renderHistory(file);
        }

        // Toggle commit button and check-all checkbox
        $gitPanel.find(".git-commit, .check-all").prop("disabled", historyEnabled);

        // Toggle visibility of .git-edited-list and .git-history-list
        $tableContainer.find(".git-edited-list").toggle(!historyEnabled);
        $tableContainer.find(".git-history-list").toggle(historyEnabled);

        // Toggle history button
        var globalButtonActive = !!(historyEnabled && newHistoryMode === "GLOBAL"),
            fileButtonActive = !!(historyEnabled && newHistoryMode === "FILE");
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
