define(function (require, exports) {
    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager"),
        FileUtils = brackets.getModule("file/FileUtils");

    var marked = require("marked"),
        ErrorHandler = require("src/ErrorHandler"),
        Events = require("src/Events"),
        EventEmitter = require("src/EventEmitter"),
        Git = require("src/Git/Git"),
        Preferences = require("src/Preferences"),
        Strings = require("strings"),
        Utils = require("src/Utils");

    var historyViewerTemplate = require("text!templates/history-viewer.html");

    var commit = null;

    function attachEvents($viewer) {
        $viewer.find(".commit-files a").on("click", function () {
            $(".commit-files a.active").attr("scrollPos", $(".commit-diff").scrollTop());
            var self = $(this);
            Git.getDiffOfFileFromCommit(commit.hash, $(this).text().trim()).then(function (diff) {
                $viewer.find(".commit-files a").removeClass("active");
                self.addClass("active");
                $viewer.find(".commit-diff").html(Utils.formatDiff(diff));
                $(".commit-diff").scrollTop(self.attr("scrollPos") || 0);
            });
        });

        if (Preferences.get("enableAdvancedFeatures")) {
            attachAdvancedEvents($viewer);
        } else {
            // TODO: put this into template
            $viewer.find(".git-advanced-features").hide();
        }
    }

    function attachAdvancedEvents($viewer) {
        var refreshCallback  = function () {
            // dialog.close();
            EventEmitter.emit(Events.REFRESH_ALL);
        };

        $viewer.find(".btn-checkout").on("click", function () {
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

        $viewer.find(".btn-reset-hard").on("click", function () {
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

        $viewer.find(".btn-reset-mixed").on("click", function () {
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

        $viewer.find(".btn-reset-soft").on("click", function () {
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
            useGravatar: Preferences.get("useGravatar"),
            files: files,
            Strings: Strings,
            enableAdvancedFeatures: Preferences.get("enableAdvancedFeatures")
        }));

        var firstFile = selectedFile || $viewer.find(".commit-files ul li:first-child").text().trim();
        if (firstFile) {
            Git.getDiffOfFileFromCommit(commit.hash, firstFile).then(function (diff) {
                var $fileEntry = $viewer.find(".commit-files a[data-file='" + firstFile + "']").first(),
                    $commitFiles = $viewer.find(".commit-files");
                $fileEntry.addClass("active");
                $commitFiles.animate({ scrollTop: $fileEntry.offset().top - $commitFiles.height() });
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
                return {name: fileName, extension: fileExtension ? "." + fileExtension : "", file: file};
            });
            var file = $("#git-panel .git-history-list").data("file-relative");
            return renderViewerContent($container, list, file);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to load list of diff files");
        }).finally(function () {
            $container.removeClass("spinner large spin");
        });
        return $container.appendTo($editorHolder);
    }

    function onRemove() {
        // detach events that were added by this viewer to another element than one added to $editorHolder
    }

    function show(commitInfo) {
        commit = commitInfo;
        // this is a "private" API but it's so convienient it's a sin not to use it
        EditorManager._showCustomViewer({
            render: render,
            onRemove: onRemove
        }, commit.hash);
    }

    // Public API
    exports.show = show;

});

/*
// Render view with the modified files list and the diff commited
    function _renderCommitDiff(commit, files) {

        var variables = commit;
        variables.files = files;
        variables.Strings = Strings;
        variables.useGravatar = Preferences.get("useGravatar");
        var compiledTemplate = Mustache.render(gitCommitDiffTemplate, variables);

        var $historyDiff = gitPanel.$panel.find(".history-diff");
        $historyDiff.html(compiledTemplate);

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
                    Main.gitControl.getDiffOfFileFromCommit(commit.hash, file).then(function (diff) {
                        $historyDiff.find(".commit-files li").removeClass("active");
                        self.parent().addClass("active");
                        $historyDiff.parent().find(".commit-diff").html(Utils.formatDiff(diff));
                        $(".commit-diff").scrollTop(self.attr("scrollPos") || 0);
                    });
                }
            });

        $(window)
            .off("resize.historyDiff")
            .on("resize.historyDiff", function () {
                gitPanel.$panel.find(".diff-header").width(gitPanel.$panel.find(".history-diff").width() - 12);
            })
            .trigger("resize.historyDiff");

        $historyDiff
            .on("scroll", function () {
                if ($historyDiff.scrollTop() > 0) {
                    $(".diff-header").addClass("shadow");
                }
                else {
                    $(".diff-header").removeClass("shadow");
                }
            });
    }
    
    // show a commit with given hash
    function renderHistoryCommit(commit, self) {
        gitPanel.$panel.find(".history-commits-list .active").removeClass("active");
        self.addClass("active");
        Main.gitControl.getFilesFromCommit(commit.hash).then(function (files) {
            var list = $.map(files, function (file) {
                var dotPosition = file.lastIndexOf("."),
                    fileName = file.substring(0, dotPosition),
                    fileExtension = file.substring(dotPosition, file.length);
                return {name: fileName, extension: fileExtension};
            });
            _renderCommitDiff(commit, list);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed to load list of diff files");
        });
    }
*/
