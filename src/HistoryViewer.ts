import { _, FileUtils, Mustache } from "./brackets-modules";
import * as marked from "marked";
import * as ErrorHandler from "./ErrorHandler";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as Git from "./git/GitCli";
import * as Preferences from "./Preferences";
import * as Strings from "strings";
import * as Utils from "./Utils";

const historyViewerTemplate = require("text!templates/history-viewer.html");
const historyViewerFilesTemplate = require("text!templates/history-viewer-files.html");

const avatarType = Preferences.get("avatarType");
const enableAdvancedFeatures = Preferences.get("enableAdvancedFeatures");
let useDifftool = false;
let isShown = false;
let commit = null;
let isInitial = null;
let $viewer = null;
let $editorHolder = null;

const setExpandState = _.debounce(() => {
    const allFiles = $viewer.find(".commit-files a");
    const activeFiles = allFiles.filter(".active");
    const allExpanded = allFiles.length === activeFiles.length;
    $viewer.find(".toggle-diffs").toggleClass("opened", allExpanded);
}, 100);

const PAGE_SIZE = 25;
let currentPage = 0;
let hasNextPage = false;

function toggleDiff($a) {
    if ($a.hasClass("active")) {
        // Close the clicked diff
        $a.removeClass("active");
        setExpandState();
        return;
    }

    // Open the clicked diff
    $(".commit-files a.active").attr("scrollPos", $(".commit-diff").scrollTop());

    // If this diff was not previously loaded then load it
    if (!$a.is(".loaded")) {
        const $li = $a.closest("[x-file]");
        const relativeFilePath = $li.attr("x-file");
        const $diffContainer = $li.find(".commit-diff");

        Git.getDiffOfFileFromCommit(commit.hash, relativeFilePath, isInitial).then((diff) => {
            $diffContainer.html(Utils.formatDiff(diff));
            $diffContainer.scrollTop($a.attr("scrollPos") || 0);

            $a.addClass("active loaded");
            setExpandState();
        }).catch((err) => ErrorHandler.showError(err, "Failed to get diff"));
    } else {
        // If this diff was previously loaded just open it
        $a.addClass("active");
        setExpandState();
    }
}

function showDiff($el) {
    const file = $el.closest("[x-file]").attr("x-file");
    Git.difftoolFromHash(commit.hash, file, isInitial);
}

function expandAll() {
    $viewer.find(".commit-files a").not(".active").trigger("click");
    Preferences.set("autoExpandDiffsInHistory", true);
}

function collapseAll() {
    $viewer.find(".commit-files a").filter(".active").trigger("click");
    Preferences.set("autoExpandDiffsInHistory", false);
}

function attachEvents() {
    $viewer
        .on("click", ".commit-files a", function () {
            toggleDiff($(this));
        })
        .on("click", ".commit-files .difftool", function (e) {
            e.stopPropagation();
            showDiff($(this));
        })
        .on("click", ".openFile", function (e) {
            e.stopPropagation();
            const file = $(this).closest("[x-file]").attr("x-file");
            Utils.openEditorForFile(file, true);
            hide();
        })
        .on("click", ".close", () => remove())
        .on("click", ".git-extend-sha", function () {
            // Show complete commit SHA
            const $parent = $(this).parent();
            const sha = $parent.data("hash");
            $parent.find("span.selectable-text").text(sha);
            $(this).remove();
        })
        .on("click", ".toggle-diffs", expandAll)
        .on("click", ".toggle-diffs.opened", collapseAll);

    // Add/Remove shadow on bottom of header
    $viewer.find(".body")
        .on("scroll", () => {
            if ($viewer.find(".body").scrollTop() > 0) {
                $viewer.find(".header").addClass("shadow");
            } else {
                $viewer.find(".header").removeClass("shadow");
            }
        });

    // Enable actions on advanced buttons if requested by user's preferences
    if (enableAdvancedFeatures) {
        attachAdvancedEvents();
    }

    // Expand the diffs when wanted
    if (Preferences.get("autoExpandDiffsInHistory")) {
        expandAll();
    }
}

function attachAdvancedEvents() {
    const refreshCallback = function () {
        // dialog.close();
        EventEmitter.emit(Events.REFRESH_ALL);
    };

    $viewer.on("click", ".btn-checkout", () => {
        const cmd = "git checkout " + commit.hash;
        Utils.askQuestion(Strings.TITLE_CHECKOUT,
                          Strings.DIALOG_CHECKOUT + "<br><br>" + cmd,
                          { booleanResponse: true, noescape: true })
            .then((response) => {
                if (response === true) {
                    return Git.checkout(commit.hash).then(refreshCallback);
                }
                return null;
            });
    });

    $viewer.on("click", ".btn-reset-hard", () => {
        const cmd = "git reset --hard " + commit.hash;
        Utils.askQuestion(Strings.TITLE_RESET,
                          Strings.DIALOG_RESET_HARD + "<br><br>" + cmd,
                          { booleanResponse: true, noescape: true })
            .then((response) => {
                if (response === true) {
                    return Git.reset("--hard", commit.hash).then(refreshCallback);
                }
                return null;
            });
    });

    $viewer.on("click", ".btn-reset-mixed", () => {
        const cmd = "git reset --mixed " + commit.hash;
        Utils.askQuestion(Strings.TITLE_RESET,
                          Strings.DIALOG_RESET_MIXED + "<br><br>" + cmd,
                          { booleanResponse: true, noescape: true })
            .then((response) => {
                if (response === true) {
                    return Git.reset("--mixed", commit.hash).then(refreshCallback);
                }
                return null;
            });
    });

    $viewer.on("click", ".btn-reset-soft", () => {
        const cmd = "git reset --soft " + commit.hash;
        Utils.askQuestion(Strings.TITLE_RESET,
                          Strings.DIALOG_RESET_SOFT + "<br><br>" + cmd,
                          { booleanResponse: true, noescape: true })
            .then((response) => {
                if (response === true) {
                    return Git.reset("--soft", commit.hash).then(refreshCallback);
                }
                return null;
            });
    });
}

function renderViewerContent(files, selectedFile) {
    const bodyMarkdown = marked(commit.body, { gfm: true, breaks: true });

    $viewer.append(Mustache.render(historyViewerTemplate, {
        commit,
        bodyMarkdown,
        usePicture: avatarType === "PICTURE",
        useIdenticon: avatarType === "IDENTICON",
        useBwAvatar: avatarType === "AVATAR_BW",
        useColoredAvatar: avatarType === "AVATAR_COLOR",
        Strings,
        enableAdvancedFeatures
    }));

    renderFiles(files);

    if (selectedFile) {
        const $fileEntry = $viewer.find(".commit-files li[x-file='" + selectedFile + "'] a").first();
        if ($fileEntry.length) {
            toggleDiff($fileEntry);
            window.setTimeout(() => {
                $viewer.find(".body").animate({ scrollTop: $fileEntry.position().top - 10 });
            }, 80);
        }
    }

    attachEvents();
}

function renderFiles(files) {
    $viewer.find(".filesContainer").append(Mustache.render(historyViewerFilesTemplate, {
        files,
        Strings,
        useDifftool
    }));

    // Activate/Deactivate load more button
    $viewer.find(".loadMore")
        .toggle(hasNextPage)
        .off("click")
        .on("click", () => {
            currentPage++;
            loadMoreFiles();
        });
}

function loadMoreFiles() {
    Git.getFilesFromCommit(commit.hash, isInitial).then((_files) => {
        let files = _files;

        hasNextPage = files.slice((currentPage + 1) * PAGE_SIZE).length > 0;
        files = files.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

        const list = files.map((file) => {
            const fileExtension = FileUtils.getSmartFileExtension(file);
            const i = file.lastIndexOf("." + fileExtension);
            const fileName = file.substring(0, fileExtension && i >= 0 ? i : file.length);
            return {
                name: fileName,
                extension: fileExtension ? "." + fileExtension : "",
                file
            };
        });

        if (currentPage === 0) {
            const file = $("#git-history-list").data("file-relative");
            return renderViewerContent(list, file);
        }
        return renderFiles(list);
    })
        .catch((err) => ErrorHandler.showError(err, "Failed to load list of diff files"))
        .finally(() => $viewer.removeClass("spinner large spin"));
}

function render() {
    if ($viewer) {
        remove();
    }

    $viewer = $("<div>").addClass("git spinner large spin");

    currentPage = 0;
    loadMoreFiles();

    return $viewer.appendTo($editorHolder);
}

const initialize = _.once(() => {
    Git.getConfig("diff.tool")
        .done((config) => useDifftool = !!config);
});

export function show(commitInfo, doc, options) {
    initialize();

    isShown = true;
    commit = commitInfo;
    isInitial = options.isInitial;

    $editorHolder = $("#editor-holder");
    render();
}

function onRemove() {
    isShown = false;
    $viewer = null;
    // detach events that were added by this viewer to another element than one added to $editorHolder
}

export function hide() {
    if (isShown) {
        remove();
    }
}

function remove() {
    $viewer.remove();
    onRemove();
}

export function isVisible() {
    return isShown;
}
