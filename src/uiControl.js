/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, console, define, Mustache, window */

define(function (require, exports) {
    "use strict";

    exports.init = function (nodeConnection, preferences) {

        var q                   = require("../thirdparty/q"),
            AppInit             = brackets.getModule("utils/AppInit"),
            CommandManager      = brackets.getModule("command/CommandManager"),
            Commands            = brackets.getModule("command/Commands"),
            Dialogs             = brackets.getModule("widgets/Dialogs"),
            DocumentManager     = brackets.getModule("document/DocumentManager"),
            FileViewController  = brackets.getModule("project/FileViewController"),
            PanelManager        = brackets.getModule("view/PanelManager"),
            ProjectManager      = brackets.getModule("project/ProjectManager"),
            GitControl          = require("./gitControl"),
            Strings             = require("../strings"),
            StringUtils         = brackets.getModule("utils/StringUtils");

        var gitPanelTemplate        = require("text!htmlContent/git-panel.html"),
            gitPanelResultsTemplate = require("text!htmlContent/git-panel-results.html"),
            gitCommitDialogTemplate = require("text!htmlContent/git-commit-dialog.html");

        var extensionName           = "[brackets-git] ",
            $gitStatusBar           = $(null),
            $gitBranchName          = $(null),
            gitPanel                = null,
            $busyIndicator          = null,
            busyIndicatorIndex      = 0,
            busyIndicatorInProgress = [],
            currentProjectRoot      = ProjectManager.getProjectRoot().fullPath,
            $icon                   = $("<a id='git-toolbar-icon' href='#'></a>")
                                      .appendTo($("#main-toolbar .buttons"));

        // Seems just too buggy right now
        q.stopUnhandledRejectionTracking();

        function logError(ex) {
            console.error(extensionName + ex);
        }

        function showBusyIndicator() {
            var i = busyIndicatorIndex++;
            busyIndicatorInProgress.push(i);
            $busyIndicator.addClass("spin");
            return i;
        }

        function hideBusyIndicator(i) {
            var pos = busyIndicatorInProgress.indexOf(i);
            if (pos !== -1) {
                busyIndicatorInProgress.splice(pos, 1);
            }
            if (busyIndicatorInProgress.length === 0) {
                $busyIndicator.removeClass("spin");
            }
        }

        var gitControl = new GitControl({
            preferences: preferences,
            executeHandler: function (cmdString) {
                var rv = q.defer(),
                    i = showBusyIndicator();
                nodeConnection.domains["brackets-git"].executeCommand(currentProjectRoot, cmdString)
                    .then(function (out) {
                        hideBusyIndicator(i);
                        rv.resolve(out);
                    })
                    .fail(function (err) {
                        hideBusyIndicator(i);
                        rv.reject(err);
                    })
                    .done();
                return rv.promise;
            }
        });

        // Shows currently installed version or error when Git is not available
        function initGitStatusBar() {
            return gitControl.getVersion().then(function (version) {
                Strings.GIT_VERSION = version;
                $gitStatusBar.text(version);
            }).fail(function (err) {
                var errText = Strings.CHECK_GIT_SETTINGS + ": " + err.toString();
                $gitStatusBar.addClass("error").text(errText);
                $icon.addClass("error").attr("title", errText);
                throw err;
            });
        }

        // Displays branch name next to the current working folder name
        function refreshGitBranchName() {
            $gitBranchName.text("[ \u2026 ]").show();
            gitControl.getRepositoryRoot().then(function (root) {
                if (root === currentProjectRoot) {
                    gitControl.getBranchName().then(function (branchName) {
                        $gitBranchName.text("[ " + branchName + " ]");
                    }).fail(logError);
                } else {
                    $gitBranchName.text("[ not a git root ]");
                }
            }).fail(function () {
                // Current working folder is not a git repository
                $gitBranchName.text("[ not a git repo ]");
            });
        }

        function refreshGitPanel() {
            if (!gitPanel.isVisible()) {
                // no point, will be refreshed when it's displayed
                return;
            }

            gitControl.getGitStatus().then(function (files) {
                var $checkAll = gitPanel.$panel.find(".check-all"),
                    $tableContainer = gitPanel.$panel.find(".table-container").empty();

                if (files.length === 0) {
                    $tableContainer.append($("<p class='nothing-to-commit' />").text(Strings.NOTHING_TO_COMMIT));
                } else {
                    $tableContainer.append(Mustache.render(gitPanelResultsTemplate, { files: files }));
                    $checkAll.prop("checked", false);
                }

                $tableContainer.off()
                    .on("click", "tr", function (e) {
                        var fullPath = currentProjectRoot + $(e.currentTarget).data("file");
                        CommandManager.execute(Commands.FILE_OPEN, {fullPath: fullPath});
                    })
                    .on("dblclick", "tr", function (e) {
                        var fullPath = currentProjectRoot + $(e.currentTarget).data("file");
                        FileViewController.addToWorkingSetAndSelect(fullPath);
                    });
            }).fail(logError);
        }

        function handleGitReset() {
            gitControl.gitReset().then(function () {
                refreshGitPanel();
            }).fail(logError);
        }

        function _showCommitDialog(stagedDiff) {
            // Open the dialog
            var compiledTemplate = Mustache.render(gitCommitDialogTemplate, { Strings: Strings }),
                dialog           = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
                $dialog          = dialog.getElement();

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
                    .css("max-height", desiredHeight)
                    .find(".commit-diff")
                        .css("max-height", desiredHeight - 70);

            // Show nicely colored commit diff
            var $diff = $dialog.find(".commit-diff");
            stagedDiff.split("\n").forEach(function (line) {
                if (line === " ") { line = ""; }

                var lineClass;
                if (line[0] === "+") {
                    lineClass = "added";
                } else if (line[0] === "-") {
                    lineClass = "removed";
                } else if (line.indexOf("@@") === 0) {
                    lineClass = "position";
                } else if (line.indexOf("diff --git") === 0) {
                    lineClass = "diffCmd";
                }

                line = StringUtils.htmlEscape(line).replace(/\s/g, "&nbsp;");
                line = line.replace(/(&nbsp;)+$/g, function (trailingWhitespace) {
                    return "<span class='trailingWhitespace'>" + trailingWhitespace + "</span>";
                });
                var $line = $("<pre/>").html(line).appendTo($diff);
                if (lineClass) { $line.addClass(lineClass); }
            });

            $dialog.find("button.primary").on("click", function (e) {
                var $commitMessage = $dialog.find("input[name='commit-message']");
                if ($commitMessage.val().trim().length === 0) {
                    e.stopPropagation();
                    $commitMessage.addClass("invalid");
                } else {
                    $commitMessage.removeClass("invalid");
                }
            });

            dialog.done(function (buttonId) {
                if (buttonId === "ok") {
                    // this event won't launch when commit-message is empty so its safe to assume that it is not
                    var commitMessage = $dialog.find("input[name='commit-message']").val();

                    gitControl.gitCommit(commitMessage).then(function () {
                        return refreshGitPanel();
                    }).fail(logError);

                } else {
                    handleGitReset();
                }
            });
        }

        function handleGitCommit() {
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
            gitControl.gitReset().then(function () {
                var promises = [];
                files.forEach(function (fileObj) {
                    var updateIndex = false;
                    if (fileObj.status.indexOf("DELETED") !== -1) {
                        updateIndex = true;
                    }
                    promises.push(gitControl.gitAdd(fileObj.filename, updateIndex));
                });
                return q.all(promises).then(function () {
                    // All files are in the index now, get the diff and show dialog.
                    gitControl.gitDiffStaged().then(function (diff) {
                        _showCommitDialog(diff);
                    });
                });
            });
        }

        function toggleGitPanel() {
            var enabled = gitPanel.isVisible();
            if (enabled) {
                $icon.toggleClass("on");
                gitPanel.hide();
            } else {
                $icon.toggleClass("on");
                gitPanel.show();
                refreshGitPanel();
            }
            preferences.setValue("panelEnabled", !enabled);
        }

        // This only launches when Git is available
        function initUi() {
            // Add branch name to project tree
            $gitBranchName = $("<div id='git-branch'></div>").appendTo("#project-files-header");

            // Add panel
            var panelHtml = Mustache.render(gitPanelTemplate, Strings);
            gitPanel = PanelManager.createBottomPanel("brackets-git.panel", $(panelHtml), 100);

            // Attach events
            $icon.on("click", toggleGitPanel);

            gitPanel.$panel
                .on("click", ".close", toggleGitPanel)
                .on("click", ".check-one", function (e) {
                    e.stopPropagation();
                })
                .on("click", ".check-all", function () {
                    var isChecked = $(this).is(":checked");
                    gitPanel.$panel.find(".check-one").prop("checked", isChecked);
                })
                .on("click", ".git-reset", handleGitReset)
                .on("click", ".git-commit", handleGitCommit);

            // Show gitPanel when appropriate
            if (preferences.getValue("panelEnabled")) {
                toggleGitPanel();
            }
        }

        // This only launches, when bash is available
        function initBashIcon() {
            $("<a id='git-bash'>[ bash ]</a>")
                .appendTo("#project-files-header")
                .on("click", function (e) {
                    e.stopPropagation();
                    gitControl.bashOpen(currentProjectRoot);
                });
        }

        // Call this only when Git is available
        function attachEventsToBrackets() {
            $(ProjectManager).on("projectOpen", function (event, projectRoot) {
                currentProjectRoot = projectRoot.fullPath;
                refreshGitBranchName();
                refreshGitPanel();
            });
            $(ProjectManager).on("projectRefresh", function () { /*event, projectRoot*/
                refreshGitBranchName();
                refreshGitPanel();
            });
            $(ProjectManager).on("beforeProjectClose", function () {
                $gitBranchName.hide();
            });
            $(ProjectManager).on("projectFilesChange", function () {
                refreshGitBranchName();
                refreshGitPanel();
            });
            $(DocumentManager).on("documentSaved", function () {
                refreshGitPanel();
            });
        }

        // Initialize items dependent on HTML DOM
        AppInit.htmlReady(function () {
            $gitStatusBar  = $("<div id='git-status'></div>").appendTo($("#status-indicators"));
            $busyIndicator = $("<div class='spinner'></div>").appendTo($gitStatusBar);
            initGitStatusBar().then(function () {
                attachEventsToBrackets();
                initUi();
                refreshGitBranchName();
            });
            gitControl.bashVersion().then(function () {
                initBashIcon();
            });
        });

    };
});
