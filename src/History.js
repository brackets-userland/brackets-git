define(function (require) {

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        FileUtils = brackets.getModule("file/FileUtils"),
        Mustache = brackets.getModule("thirdparty/mustache/mustache");

    // Local modules
    var moment = require("moment"),
        Strings = require("strings"),
        ErrorHandler = require("src/ErrorHandler"),
        Events = require("src/Events"),
        EventEmitter = require("src/EventEmitter"),
        Git = require("src/git/Git"),
        HistoryViewer = require("src/HistoryViewer"),
        Preferences = require("src/Preferences");

    // Templates
    var gitPanelHistoryTemplate = require("text!templates/git-panel-history.html"),
        gitPanelHistoryCommitsTemplate = require("text!templates/git-panel-history-commits.html");

    // Module variables
    var $gitPanel         = $(null),
        $tableContainer   = $(null),
        $historyList      = $(null),
        commitCache       = [],
        avatarType        = Preferences.get("avatarType"),
        lastDocumentSeen  = null;

    if (avatarType === "PICTURE" || avatarType === "IDENTICON") {
        var md5;
        require(["md5"], function (_md5) {
            md5 = _md5;
        });
    }

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
            })
            .on("click.history", ".history-commit", function () {
                var hash = $(this).attr("x-hash");
                var commit = _.find(commitCache, function (commit) { return commit.hash === hash; });
                HistoryViewer.show(commit, getCurrentDocument(), {
                    isInitial: $(this).attr("x-initial-commit") === "true"
                });
            });
    }

    var generateCssAvatar = _.memoize(function (author, email) {

        // Original source: http://indiegamr.com/generate-repeatable-random-numbers-in-js/
        var seededRandom = function (max, min, seed) {
            max = max || 1;
            min = min || 0;

            seed = (seed * 9301 + 49297) % 233280;
            var rnd = seed / 233280.0;

            return min + rnd * (max - min);
        };

        // Use `seededRandom()` to generate a pseudo-random number [0-16] to pick a color from the list
        var seedBase = parseInt(author.charCodeAt(3).toString(), email.length),
            seed = parseInt(email.charCodeAt(seedBase.toString().substring(1, 2)).toString(), 16),
            colors = [
                "#ffb13b", "#dd5f7a", "#8dd43a", "#2f7e2f", "#4141b9", "#3dafea", "#7e3e3e", "#f2f26b",
                "#864ba3", "#ac8aef", "#f2f2ce", "#379d9d", "#ff6750", "#8691a2", "#d2fd8d", "#88eadf"
            ],
            texts = [
                "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#333333",
                "#FEFEFE", "#FEFEFE", "#333333", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#333333", "#333333"
            ],
            picked = Math.floor(seededRandom(0, 16, seed));

        return "background-color: " + colors[picked] + "; color: " + texts[picked];

    }, function (author, email) {
        // calculate hash for memoize - both are strings so we don't need to convert
        return author + email;
    });

    var generateMd5 = _.memoize(function (string) {
        return md5(string);
    });

    // Render history list the first time
    function renderHistory(file) {
        // clear cache
        commitCache = [];

        return Git.getCurrentBranchName().then(function (branchName) {
            // Get the history commits of the current branch
            var p = file ? Git.getFileHistory(file.relative, branchName) : Git.getHistory(branchName);
            return p.then(function (commits) {

                // calculate some missing stuff like avatars
                commits = addAdditionalCommitInfo(commits);
                commitCache = commitCache.concat(commits);

                var templateData = {
                    commits: commits,
                    usePicture: avatarType === "PICTURE",
                    useIdenticon: avatarType === "IDENTICON",
                    useBwAvatar: avatarType === "AVATAR_BW",
                    useColoredAvatar: avatarType === "AVATAR_COLOR",
                    Strings: Strings
                };

                $tableContainer.append(Mustache.render(gitPanelHistoryTemplate, templateData, {
                    commits: gitPanelHistoryCommitsTemplate
                }));

                $historyList = $tableContainer.find("#git-history-list")
                    .data("file", file ? file.absolute : null)
                    .data("file-relative", file ? file.relative : null);

                $historyList
                    .find("tr.history-commit:last-child")
                    .attr("x-initial-commit", "true");
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
                            // marks initial commit as first
                            $historyList
                                .find("tr.history-commit:last-child")
                                .attr("x-initial-commit", "true");
                            return;
                        }

                        commits = addAdditionalCommitInfo(commits);
                        commitCache = commitCache.concat(commits);

                        var templateData = {
                            commits: commits,
                            usePicture: avatarType === "PICTURE",
                            useIdenticon: avatarType === "IDENTICON",
                            useBwAvatar: avatarType === "AVATAR_BW",
                            useColoredAvatar: avatarType === "AVATAR_COLOR",
                            Strings: Strings
                        };
                        var commitsHtml = Mustache.render(gitPanelHistoryCommitsTemplate, templateData);
                        $historyList.children("tbody").append(commitsHtml);
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

    function addAdditionalCommitInfo(commits) {
        var mode        = Preferences.get("dateMode"),
            format      = Strings.DATE_FORMAT,
            // now         = moment(),
            // yesterday   = moment().subtract("d", 1).startOf("d"),
            ownFormat   = Preferences.get("dateFormat") || Strings.DATE_FORMAT;

        if (mode === 2 && format.indexOf(" ")) {
            // only date part
            format = format.substring(0, format.indexOf(" "));
        }

        _.forEach(commits, function (commit) {

            // Get color for AVATAR_BW and AVATAR_COLOR
            if (avatarType === "AVATAR_COLOR" || avatarType === "AVATAR_BW") {
                commit.cssAvatar = generateCssAvatar(commit.author, commit.email);
                commit.avatarLetter = commit.author.substring(0, 1);
            }
            if (avatarType === "PICTURE" || avatarType === "IDENTICON") {
                commit.emailHash = generateMd5(commit.email);
            }

            // FUTURE: convert date modes to sensible constant strings
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
                    var relative = date.fromNow(),
                        formatted = date.format(format);
                    commit.date.shown = relative + " (" + formatted + ")";
                    commit.date.title = date.format(Strings.DATE_FORMAT);
                    /*
                    if (date.diff(yesterday) > 0) {
                        commit.date.shown = moment.duration(Math.max(date.diff(now), -24 * 60 * 60 * 1000), "ms").humanize(true);
                        commit.date.title = date.format(format);
                    } else {
                        commit.date.shown = date.format(format);
                    }
                    */
                    break;
                // mode 3: formatted with own format (as pref)
                case 3:
                    commit.date.shown = date.format(ownFormat);
                    commit.date.title = date.format(format);
                    break;
                /* mode 4 (Original Git date) is handled above */
            }
            commit.hasTag = (commit.tags) ? true : false;
        });

        return commits;
    }

    function getCurrentDocument() {
        if (HistoryViewer.isVisible()) {
            return lastDocumentSeen;
        }
        var doc = DocumentManager.getCurrentDocument();
        if (doc) {
            lastDocumentSeen = doc;
        }
        return doc || lastDocumentSeen;
    }

    function handleFileChange() {
        var currentDocument = getCurrentDocument();

        if ($historyList.is(":visible") && $historyList.data("file")) {
            handleToggleHistory("FILE", currentDocument);
        }
        $gitPanel.find(".git-file-history").prop("disabled", !currentDocument);
    }

    // Show or hide the history list on click of .history button
    // newHistoryMode can be "FILE" or "GLOBAL"
    function handleToggleHistory(newHistoryMode, newDocument) {
        // this is here to check that $historyList is still attached to the DOM
        $historyList = $tableContainer.find("#git-history-list");

        var historyEnabled = $historyList.is(":visible"),
            currentFile = $historyList.data("file") || null,
            currentHistoryMode = historyEnabled ? (currentFile ? "FILE" : "GLOBAL") : "DISABLED",
            doc = newDocument ? newDocument : getCurrentDocument(),
            file;

        if (currentHistoryMode !== newHistoryMode) {
            // we are switching the modes so enable
            historyEnabled = true;
        } else if (!newDocument) {
            // we are not changing the mode and we are not switching to a new document
            historyEnabled = !historyEnabled;
        }

        if (historyEnabled && newHistoryMode === "FILE") {
            if (doc) {
                file = {};
                file.absolute = doc.file.fullPath;
                file.relative = FileUtils.getRelativeFilename(Preferences.get("currentGitRoot"), file.absolute);
            } else {
                // we want a file history but no file was found
                historyEnabled = false;
            }
        }

        // Render #git-history-list if is not already generated or if the viewed file for file history has changed
        var isEmpty = $historyList.find("tr").length === 0,
            fileChanged = currentFile !== (file ? file.absolute : null);
        if (historyEnabled && (isEmpty || fileChanged)) {
            if ($historyList.length > 0) {
                $historyList.remove();
            }
            var $spinner = $("<div class='spinner spin large'></div>").appendTo($gitPanel);
            renderHistory(file).finally(function () {
                $spinner.remove();
            });
        }

        // disable commit button when viewing history
        // refresh status when history is closed and commit button will correct its disabled state if required
        if (historyEnabled) {
            $gitPanel.find(".git-commit, .check-all").prop("disabled", true);
        } else {
            Git.status();
        }

        // Toggle visibility of .git-edited-list and #git-history-list
        $tableContainer.find(".git-edited-list").toggle(!historyEnabled);
        $historyList.toggle(historyEnabled);

        if (!historyEnabled) { HistoryViewer.hide(); }

        // Toggle history button
        var globalButtonActive  = historyEnabled && newHistoryMode === "GLOBAL",
            fileButtonActive    = historyEnabled && newHistoryMode === "FILE";
        $gitPanel.find(".git-history-toggle").toggleClass("active", globalButtonActive)
            .attr("title", globalButtonActive ? Strings.TOOLTIP_HIDE_HISTORY : Strings.TOOLTIP_SHOW_HISTORY);
        $gitPanel.find(".git-file-history").toggleClass("active", fileButtonActive)
            .attr("title", fileButtonActive ? Strings.TOOLTIP_HIDE_FILE_HISTORY : Strings.TOOLTIP_SHOW_FILE_HISTORY);
    }

    // Event listeners
    EventEmitter.on(Events.GIT_ENABLED, function () {
        initVariables();
    });
    EventEmitter.on(Events.GIT_DISABLED, function () {
        lastDocumentSeen = null;
        $historyList.remove();
        $historyList = $();
    });
    EventEmitter.on(Events.HISTORY_SHOW, function (mode) {
        handleToggleHistory(mode === "FILE" ? "FILE" : "GLOBAL");
    });
    EventEmitter.on(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, function () {
        handleFileChange();
    });

});
