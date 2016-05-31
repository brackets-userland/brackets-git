define(function (require, exports) {
    "use strict";

    var _               = brackets.getModule("thirdparty/lodash"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        Mustache        = brackets.getModule("thirdparty/mustache/mustache");

    var marked        = require("marked"),
        ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Git           = require("src/git/Git"),
        Preferences   = require("src/Preferences"),
        Strings       = require("strings"),
        Utils         = require("src/Utils");

    var historyViewerTemplate       = require("text!templates/history-viewer.html"),
        historyViewerFilesTemplate  = require("text!templates/history-viewer-files.html");

    var avatarType             = Preferences.get("avatarType"),
        enableAdvancedFeatures = Preferences.get("enableAdvancedFeatures"),
        useDifftool            = false,
        isShown                = false,
        commit                 = null,
        isInitial              = null,
        $viewer                = null,
        $editorHolder          = null;

    var setExpandState = _.debounce(function () {
        var allFiles = $viewer.find(".commit-files a"),
            activeFiles = allFiles.filter(".active"),
            allExpanded = allFiles.length === activeFiles.length;
        $viewer.find(".toggle-diffs").toggleClass("opened", allExpanded);
    }, 100);

    var PAGE_SIZE = 25;
    var currentPage = 0;
    var hasNextPage = false;

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
            var $li = $a.closest("[x-file]"),
                relativeFilePath = $li.attr("x-file"),
                $diffContainer = $li.find(".commit-diff");

            Git.getDiffOfFileFromCommit(commit.hash, relativeFilePath, isInitial).then(function (diff) {
                $diffContainer.html(Utils.formatDiff(diff));
                $diffContainer.scrollTop($a.attr("scrollPos") || 0);

                $a.addClass("active loaded");
                setExpandState();
            }).catch(function (err) {
                ErrorHandler.showError(err, "Failed to get diff");
            });
        } else {
            // If this diff was previously loaded just open it
            $a.addClass("active");
            setExpandState();
        }
    }

    function showDiff($el) {
        var file = $el.closest("[x-file]").attr("x-file");
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
                var file = $(this).closest("[x-file]").attr("x-file");
                Utils.openEditorForFile(file, true);
                hide();
            })
            .on("click", ".close", function () {
                // Close history viewer
                remove();
            })
            .on("click", ".git-extend-sha", function () {
                // Show complete commit SHA
                var $parent = $(this).parent(),
                    sha = $parent.data("hash");
                $parent.find("span.selectable-text").text(sha);
                $(this).remove();
            })
            .on("click", ".toggle-diffs", expandAll)
            .on("click", ".toggle-diffs.opened", collapseAll);

        // Add/Remove shadow on bottom of header
        $viewer.find(".body")
            .on("scroll", function () {
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
        var refreshCallback  = function () {
            // dialog.close();
            EventEmitter.emit(Events.REFRESH_ALL);
        };

        $viewer.on("click", ".btn-checkout", function () {
            var cmd = "git checkout " + commit.hash;
            Utils.askQuestion(Strings.TITLE_CHECKOUT,
                              Strings.DIALOG_CHECKOUT + "<br><br>" + cmd,
                              { booleanResponse: true, noescape: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.checkout(commit.hash).then(refreshCallback);
                    }
                });
        });

        $viewer.on("click", ".btn-reset-hard", function () {
            var cmd = "git reset --hard " + commit.hash;
            Utils.askQuestion(Strings.TITLE_RESET,
                              Strings.DIALOG_RESET_HARD + "<br><br>" + cmd,
                              { booleanResponse: true, noescape: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.reset("--hard", commit.hash).then(refreshCallback);
                    }
                });
        });

        $viewer.on("click", ".btn-reset-mixed", function () {
            var cmd = "git reset --mixed " + commit.hash;
            Utils.askQuestion(Strings.TITLE_RESET,
                              Strings.DIALOG_RESET_MIXED + "<br><br>" + cmd,
                              { booleanResponse: true, noescape: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.reset("--mixed", commit.hash).then(refreshCallback);
                    }
                });
        });

        $viewer.on("click", ".btn-reset-soft", function () {
            var cmd = "git reset --soft " + commit.hash;
            Utils.askQuestion(Strings.TITLE_RESET,
                              Strings.DIALOG_RESET_SOFT + "<br><br>" + cmd,
                              { booleanResponse: true, noescape: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.reset("--soft", commit.hash).then(refreshCallback);
                    }
                });
        });
    }

    function renderViewerContent(files, selectedFile) {
        var bodyMarkdown = marked(commit.body, { gfm: true, breaks: true });

        $viewer.append(Mustache.render(historyViewerTemplate, {
            commit: commit,
            bodyMarkdown: bodyMarkdown,
            usePicture: avatarType === "PICTURE",
            useIdenticon: avatarType === "IDENTICON",
            useBwAvatar: avatarType === "AVATAR_BW",
            useColoredAvatar: avatarType === "AVATAR_COLOR",
            Strings: Strings,
            enableAdvancedFeatures: enableAdvancedFeatures
        }));

        renderFiles(files);

        if (selectedFile) {
            var $fileEntry = $viewer.find(".commit-files li[x-file='" + selectedFile + "'] a").first();
            if ($fileEntry.length) {
                toggleDiff($fileEntry);
                window.setTimeout(function () {
                    $viewer.find(".body").animate({ scrollTop: $fileEntry.position().top - 10 });
                }, 80);
            }
        }

        attachEvents();
    }

    function renderFiles(files) {
        $viewer.find(".filesContainer").append(Mustache.render(historyViewerFilesTemplate, {
            files: files,
            Strings: Strings,
            useDifftool: useDifftool
        }));

        // Activate/Deactivate load more button
        $viewer.find(".loadMore")
            .toggle(hasNextPage)
            .off("click")
            .on("click", function () {
                currentPage++;
                loadMoreFiles();
            });
    }

    function loadMoreFiles() {
        Git.getFilesFromCommit(commit.hash, isInitial).then(function (files) {

            hasNextPage = files.slice((currentPage + 1) * PAGE_SIZE).length > 0;
            files = files.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

            var list = files.map(function (file) {
                var fileExtension = FileUtils.getSmartFileExtension(file),
                    i = file.lastIndexOf("." + fileExtension),
                    fileName = file.substring(0, fileExtension && i >= 0 ? i : file.length);
                return {
                    name: fileName,
                    extension: fileExtension ? "." + fileExtension : "",
                    file: file
                };
            });

            if (currentPage === 0) {
                var file = $("#git-history-list").data("file-relative");
                return renderViewerContent(list, file);
            } else {
                return renderFiles(list);
            }
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to load list of diff files");
        }).finally(function () {
            $viewer.removeClass("spinner large spin");
        });
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

    var initialize = _.once(function () {
        Git.getConfig("diff.tool").done(function (config) {
            useDifftool = !!config;
        });
    });

    function show(commitInfo, doc, options) {
        initialize();

        isShown   = true;
        commit    = commitInfo;
        isInitial = options.isInitial;

        $editorHolder = $("#editor-holder");
        render();
    }

    function onRemove() {
        isShown = false;
        $viewer = null;
        // detach events that were added by this viewer to another element than one added to $editorHolder
    }

    function hide() {
        if (isShown) {
            remove();
        }
    }

    function remove() {
        $viewer.remove();
        onRemove();
    }

    function isVisible() {
        return isShown;
    }

    // Public API
    exports.show = show;
    exports.hide = hide;
    exports.isVisible = isVisible;

});
