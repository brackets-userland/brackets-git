import { _, DocumentManager, FileUtils, Mustache } from "./brackets-modules";
import * as md5 from "blueimp-md5";
import * as moment from "moment";
import * as Strings from "strings";
import * as ErrorHandler from "./ErrorHandler";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as Git from "./git/GitCli";
import * as Git2 from "./git/Git";
import * as HistoryViewer from "./HistoryViewer";
import * as Preferences from "./Preferences";

const generateMd5 = _.memoize((str) => (md5 as any)(str));

const gitPanelHistoryTemplate = require("text!templates/git-panel-history.html");
const gitPanelHistoryCommitsTemplate = require("text!templates/git-panel-history-commits.html");

let $gitPanel = $(null);
let $tableContainer = $(null);
let $historyList = $(null);
let commitCache = [];
const avatarType = Preferences.get("avatarType");
let lastDocumentSeen = null;

function initVariables() {
    $gitPanel = $("#git-panel");
    $tableContainer = $gitPanel.find(".table-container");
    attachHandlers();
}

function attachHandlers() {
    $tableContainer
        .off(".history")
        .on("scroll.history", () => loadMoreHistory())
        .on("click.history", ".history-commit", function () {
            const hash = $(this).attr("x-hash");
            const commit = _.find(commitCache, (c) => c.hash === hash);
            HistoryViewer.show(commit, getCurrentDocument(), {
                isInitial: $(this).attr("x-initial-commit") === "true"
            });
        });
}

const generateCssAvatar = _.memoize((author, email) => {

    // Original source: http://indiegamr.com/generate-repeatable-random-numbers-in-js/
    const seededRandom = function (max = 1, min = 0, _seed) {
        const seed = (_seed * 9301 + 49297) % 233280;
        const rnd = seed / 233280.0;
        return min + rnd * (max - min);
    };

    // Use `seededRandom()` to generate a pseudo-random number [0-16] to pick a color from the list
    const seedBase = parseInt(author.charCodeAt(3).toString(), email.length);
    const seed = parseInt(email.charCodeAt(seedBase.toString().substring(1, 2)).toString(), 16);
    const colors = [
        "#ffb13b", "#dd5f7a", "#8dd43a", "#2f7e2f", "#4141b9", "#3dafea", "#7e3e3e", "#f2f26b",
        "#864ba3", "#ac8aef", "#f2f2ce", "#379d9d", "#ff6750", "#8691a2", "#d2fd8d", "#88eadf"
    ];
    const texts = [
        "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#333333",
        "#FEFEFE", "#FEFEFE", "#333333", "#FEFEFE", "#FEFEFE", "#FEFEFE", "#333333", "#333333"
    ];
    const picked = Math.floor(seededRandom(0, 16, seed));

    return "background-color: " + colors[picked] + "; color: " + texts[picked];

}, (author, email) => {
    // calculate hash for memoize - both are strings so we don't need to convert
    return author + email;
});

// Render history list the first time
function renderHistory(file) {
    // clear cache
    commitCache = [];

    return Git.getCurrentBranchName().then((branchName) => {
        // Get the history commits of the current branch
        const p = file ? Git2.getFileHistory(file.relative, branchName) : Git.getHistory(branchName);
        return p.then((_commits) => {

            // calculate some missing stuff like avatars
            const commits = addAdditionalCommitInfo(_commits);
            commitCache = commitCache.concat(commits);

            const templateData = {
                commits,
                usePicture: avatarType === "PICTURE",
                useIdenticon: avatarType === "IDENTICON",
                useBwAvatar: avatarType === "AVATAR_BW",
                useColoredAvatar: avatarType === "AVATAR_COLOR",
                Strings
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
    }).catch((err) => ErrorHandler.showError(err, "Failed to get history"));
}

// Load more rows in the history list on scroll
function loadMoreHistory() {
    if ($historyList.is(":visible")) {
        if (($tableContainer.prop("scrollHeight") - $tableContainer.scrollTop()) === $tableContainer.height()) {
            if ($historyList.attr("x-finished") === "true") {
                return;
            }
            return Git.getCurrentBranchName().then((branchName) => {
                let p;
                const file = $historyList.data("file-relative");
                const skipCount = $tableContainer.find("tr.history-commit").length;
                if (file) {
                    p = Git2.getFileHistory(file, branchName, skipCount);
                } else {
                    p = Git.getHistory(branchName, skipCount);
                }
                return p.then((_commits) => {
                    if (_commits.length === 0) {
                        $historyList.attr("x-finished", "true");
                        // marks initial commit as first
                        $historyList
                            .find("tr.history-commit:last-child")
                            .attr("x-initial-commit", "true");
                        return;
                    }

                    const commits = addAdditionalCommitInfo(_commits);
                    commitCache = commitCache.concat(commits);

                    const templateData = {
                        commits,
                        usePicture: avatarType === "PICTURE",
                        useIdenticon: avatarType === "IDENTICON",
                        useBwAvatar: avatarType === "AVATAR_BW",
                        useColoredAvatar: avatarType === "AVATAR_COLOR",
                        Strings
                    };
                    const commitsHtml = Mustache.render(gitPanelHistoryCommitsTemplate, templateData);
                    $historyList.children("tbody").append(commitsHtml);
                })
                .catch((err) => ErrorHandler.showError(err, "Failed to load more history rows"));
            })
            .catch((err) => ErrorHandler.showError(err, "Failed to get current branch name"));
        }
    }
}

function addAdditionalCommitInfo(commits) {
    let mode = Preferences.get("dateMode");
    let format = Strings.DATE_FORMAT;
    let ownFormat = Preferences.get("dateFormat") || Strings.DATE_FORMAT;

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

        let date = moment(commit.date);
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
                let relative = date.fromNow();
                let formatted = date.format(format);
                commit.date.shown = relative + " (" + formatted + ")";
                commit.date.title = date.format(Strings.DATE_FORMAT);
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
    let doc = DocumentManager.getCurrentDocument();
    if (doc) {
        lastDocumentSeen = doc;
    }
    return doc || lastDocumentSeen;
}

function handleFileChange() {
    let currentDocument = getCurrentDocument();

    if ($historyList.is(":visible") && $historyList.data("file")) {
        handleToggleHistory("FILE", currentDocument);
    }
    $gitPanel.find(".git-file-history").prop("disabled", !currentDocument);
}

// Show or hide the history list on click of .history button
// newHistoryMode can be "FILE" or "GLOBAL"
function handleToggleHistory(newHistoryMode: "FILE" | "GLOBAL", newDocument?) {
    // this is here to check that $historyList is still attached to the DOM
    $historyList = $tableContainer.find("#git-history-list");

    let historyEnabled = $historyList.is(":visible");
    let currentFile = $historyList.data("file") || null;
    let currentHistoryMode = historyEnabled ? (currentFile ? "FILE" : "GLOBAL") : "DISABLED";
    let doc = newDocument ? newDocument : getCurrentDocument();
    let file;

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
    let isEmpty = $historyList.find("tr").length === 0;
    let fileChanged = currentFile !== (file ? file.absolute : null);
    if (historyEnabled && (isEmpty || fileChanged)) {
        if ($historyList.length > 0) {
            $historyList.remove();
        }
        let $spinner = $("<div class='spinner spin large'></div>").appendTo($gitPanel);
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
    let globalButtonActive  = historyEnabled && newHistoryMode === "GLOBAL";
    let fileButtonActive    = historyEnabled && newHistoryMode === "FILE";
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
