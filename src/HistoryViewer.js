define(function (require, exports) {
    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager"),
        CommandManager = brackets.getModule("command/CommandManager"),
        FileUtils = brackets.getModule("file/FileUtils");

    var marked = require("marked"),
        ErrorHandler = require("src/ErrorHandler"),
        Events = require("src/Events"),
        EventEmitter = require("src/EventEmitter"),
        Git = require("src/git/Git"),
        Preferences = require("src/Preferences"),
        Strings = require("strings"),
        Utils = require("src/Utils");

    var historyViewerTemplate = require("text!templates/history-viewer.html");

    var commit                 = null,
        avatarType             = Preferences.get("avatarType"),
        enableAdvancedFeatures = Preferences.get("enableAdvancedFeatures");

    function attachEvents($viewer) {
        $viewer
            .on("click", ".commit-files a:not(.active)", function () {
                    // Open the clicked diff
                    $(".commit-files a.active").attr("scrollPos", $(".commit-diff").scrollTop());
                    var $a = $(this);
                    // If this diff was not previously loaded then load it
                    if (!$a.is(".loaded")) {
                        var $li = $a.closest("[x-file]"),
                            relativeFilePath = $li.attr("x-file"),
                            $diffContainer = $li.find(".commit-diff");

                        Git.getDiffOfFileFromCommit(commit.hash, relativeFilePath).then(function (diff) {
                            $a.addClass("active loaded");
                            $diffContainer.html(Utils.formatDiff(diff));
                            $diffContainer.scrollTop($a.attr("scrollPos") || 0);
                        }).catch(function (err) {
                            ErrorHandler.showError(err, "Failed to get diff");
                        });
                    } else {
                        // If this diff was previously loaded just open it
                        $a.addClass("active");
                    }
                })
            .on("click", ".commit-files a.active", function () {
                // Close the clicked diff
                $(this).removeClass("active");
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
            .on("click", ".toggle-diffs", function () {
                $(this).addClass("opened");
                $viewer.find(".commit-files a").not(".active").trigger("click");
            })
            .on("click", ".toggle-diffs.opened", function () {
                $(this).removeClass("opened");
                $viewer.find(".commit-files a.active").trigger("click");
            });

        // Add/Remove shadown on bottom of header
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
            attachAdvancedEvents($viewer);
        }
    }

    function attachAdvancedEvents($viewer) {
        var refreshCallback  = function () {
            // dialog.close();
            EventEmitter.emit(Events.REFRESH_ALL);
        };

        $viewer.on("click", ".btn-checkout", function () {
            var cmd = "git checkout " + commit.hash;
            Utils.askQuestion(Strings.TITLE_CHECKOUT,
                              Strings.DIALOG_CHECKOUT + "<br><br>" + cmd,
                              {booleanResponse: true, noescape: true})
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
                              {booleanResponse: true, noescape: true})
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
                              {booleanResponse: true, noescape: true})
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
                              {booleanResponse: true, noescape: true})
                .then(function (response) {
                    if (response === true) {
                        return Git.reset("--soft", commit.hash).then(refreshCallback);
                    }
                });
        });
    }

    function renderViewerContent($viewer, files, selectedFile) {
        var bodyMarkdown = marked(commit.body, {gfm: true, breaks: true});

        $viewer.append(Mustache.render(historyViewerTemplate, {
            commit: commit,
            bodyMarkdown: bodyMarkdown,
            usePicture: avatarType === "PICTURE",
            useIdenticon: avatarType === "IDENTICON",
            useBwAvatar: avatarType === "AVATAR_BW",
            useColoredAvatar: avatarType === "AVATAR_COLOR",
            files: files,
            Strings: Strings,
            enableAdvancedFeatures: enableAdvancedFeatures
        }));

        var firstFile = selectedFile || $viewer.find(".commit-files ul li:first-child").text().trim();
        if (firstFile) {
            Git.getDiffOfFileFromCommit(commit.hash, firstFile).then(function (diff) {
                $viewer.find(".commit-files a[data-file='" + firstFile + "']").first().addClass("active");
                $viewer.find(".commit-diff").html(Utils.formatDiff(diff));
            });
        }

        attachEvents($viewer);
    }

    function render(hash, $editorHolder) {
        var $container = $("<div>").addClass("git spinner large spin");
        Git.getFilesFromCommit(commit.hash).then(function (files) {
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
            var file = $("#git-history-list").data("file-relative");
            return renderViewerContent($container, list, file);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to load list of diff files");
        }).finally(function () {
            $container.removeClass("spinner large spin");
        });
        return $container.appendTo($editorHolder);
    }

    var isShown = false;

    function onRemove() {
        isShown = false;
        // detach events that were added by this viewer to another element than one added to $editorHolder
    }

    var previousFile = null;

    function show(commitInfo, _previousFile) {
        isShown = true;
        commit = commitInfo;
        previousFile = _previousFile;
        // this is a "private" API but it's so convienient it's a sin not to use it
        EditorManager._showCustomViewer({
            render: render,
            onRemove: onRemove
        }, commit.hash);
    }

    function hide() {
        if (isShown) {
            remove();
        }
    }

    function remove() {
        if (previousFile && previousFile.file) {
            CommandManager.execute("file.open", previousFile.file);
        } else {
            EditorManager._closeCustomViewer();
        }
    }

    function isVisible() {
        return isShown;
    }

    // Public API
    exports.show = show;
    exports.hide = hide;
    exports.isVisible = isVisible;

});
