/*jslint plusplus: true, vars: true, nomen: true */
/*global $, define, brackets, Mustache*/

define(function (require, exports) {
    "use strict";

    var q               = require("../thirdparty/q"),
        Preferences     = require("./Preferences"),
        Main            = require("src/Main"),
        Panel           = require("src/Panel"),
        Strings         = require("strings"),
        StringUtils     = brackets.getModule("utils/StringUtils"),
        ErrorHandler    = require("./ErrorHandler");

    //FIXME: fake gitPanel element, I can't run Remotes.js after `#git-panel` is created so I need to cache it in each function, hints are welcome.
    var gitPanel = {};

    // Templates
    var gitRemotesPickerTemplate = require("text!htmlContent/git-remotes-picker.html");

    function _getDefaultRemote() {
        // refactor later when Preferences are fixed
        var key = ["defaultRemotes", Main.getProjectRoot()].join(".");
        var defaultRemote = Preferences.get(key);
        return defaultRemote || "origin";
    }

    function _setDefaultRemote(remoteName) {
        // refactor later when Preferences are fixed
        var key = ["defaultRemotes", Main.getProjectRoot()].join(".");
        Preferences.persist(key, remoteName);
    }

    function clearRemotePicker() {
        gitPanel.$panel = $("#git-panel");
        gitPanel.$panel.find(".git-remote-selected")
        .html("&hellip;")
        .data("remote-name", "");
    }

    function handleRemotePick($this) {
        gitPanel.$panel = $("#git-panel");

        var $selectedElement = ((typeof ($this) === "string") ? gitPanel.$panel.find("a[data-remote-name=\"" + $this + "\"]") : $($this).parent()),
            $currentRemote = gitPanel.$panel.find(".git-remote-selected");

        // If the selected element exists, switch remote to it
        if ($selectedElement.length !== 0) {
            var remoteName = $selectedElement.attr("data-remote-name");

            // Set as default remote if is not a Git-FTP remote
            if (!$selectedElement.data("is-gitftp")) {
                _setDefaultRemote(remoteName);
                gitPanel.$panel.find(".gitftp-push").removeClass("gitftp-push").addClass("git-push").attr("title", Strings.TOOLTIP_PUSH);
            }
            else {
                gitPanel.$panel.find(".git-push").removeClass("git-push").addClass("gitftp-push").attr("title", Strings.TOOLTIP_GITPUSH);
            }

            // Change content and data of the remotes-picker button
            $currentRemote
            .text($selectedElement.find(".change-remote").text().trim())
            .data("remote-name", remoteName);
            $currentRemote.prev(".ftp-prefix").attr("data-is-gitftp", $selectedElement.is("[data-is-gitftp=true]"));

            // Enable/disable push/pull as needed
            gitPanel.$panel.find(".git-pull").prop("disabled", $selectedElement.data("is-gitftp"));
            gitPanel.$panel.find(".git-push").prop("disabled", false);
        }
        // If doesn't exist, switch to an empty remote and disable push/pull buttons
        else {
            $currentRemote.html("&mdash;").attr({
                "data-remote-name": null
            });
            gitPanel.$panel.find(".git-pull, .git-push").prop("disabled", true);
        }

    }

    // GIT REMOTES CREATE/REMOVE {
    function handleRemoteCreation() {
        return Panel.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_NAME)
        .then(function (name) {
            return Panel.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_URL)
            .then(function (url) {
                return Main.gitControl.remoteAdd(name, url)
                .then(function () {
                    prepareRemotesPicker();
                })
                .fail(function (err) {
                    ErrorHandler.showError(err, "Remote creation failed");
                });
            });
        });
    }

    function handleRemoteRemove($this) {
        gitPanel.$panel = $("#git-panel");

        var $selectedElement = $($this).closest("a[data-remote-name]"),
            $currentRemote = gitPanel.$panel.find(".git-remote-selected"),
            remoteName = $selectedElement.data("remote-name");

        return Panel.askQuestion(Strings.DELETE_REMOTE, StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName), {
            booleanResponse: true
        })
        .then(function (response) {
            if (response) {
                Main.gitControl.remoteRemove(remoteName).then(function () {
                    $selectedElement.parent().remove();
                    var newRemote = gitPanel.$panel.find(".git-remotes-dropdown .remote").first().find("a").data("remote-name");
                    $currentRemote.data("remote-name", newRemote).html(newRemote);
                }).fail(function (err) {
                    ErrorHandler.logError(err);
                });
            }
        });
    }
    // } GIT REMOTES CREATE/REMOVE

    // GIT-FTP REMOTES INIT/CREATE/REMOVE {

    function handleGitFtpRemoteInit(scope) {
        gitPanel.$panel.find(".git-remotes").addClass("btn-loading").prop("disabled", true);
        return Panel.askQuestion(
            Strings.INIT_GITFTP_REMOTE,
            StringUtils.format(Strings.INIT_GITFTP_REMOTE_NAME, scope),
            {booleanResponse: true}
        ).then(function (response) {
            if (response) {
                Main.gitControl.gitFtpInit(scope).then(function () {
                    gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
                }).fail(function (err) {
                    ErrorHandler.showError(err, "Git-FTP remote initialization failed");
                    gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
                });
            }
            prepareRemotesPicker();
        }).fail(function (err) {
            gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
            prepareRemotesPicker();
            ErrorHandler.logError(err);
        });
    }

    function handleGitFtpRemoteCreation() {
        gitPanel.$panel = $("#git-panel");
        gitPanel.$panel.find(".git-remotes").addClass("btn-loading").prop("disabled", true);
        return Panel.askQuestion(Strings.CREATE_GITFTP_NEW_REMOTE, Strings.ENTER_GITFTP_REMOTE_NAME)
        .then(function (name) {
            return Panel.askQuestion(
                Strings.CREATE_GITFTP_NEW_REMOTE,
                Strings.ENTER_GITFTP_REMOTE_URL,
                {defaultValue: "ftp://user:passwd@example.org/folder"}
            )
            .then(function (url) {
                return Main.gitControl.gitFtpAddScope(name, url)
                .then(function () {
                    gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
                    return handleGitFtpRemoteInit();
                })
                .fail(function (err) {
                    ErrorHandler.showError(err, "Git-FTP remote creation failed");
                    gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
                });
            });
        }).fail(function () {
            gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
        });
    }

    function handleGitFtpRemoteRemove($this) {
        gitPanel.$panel = $("#git-panel");
        gitPanel.$panel.find(".git-remotes").addClass("btn-loading").prop("disabled", true);
        var $selectedElement = $($this).closest("a[data-remote-name]"),
            $currentRemote = gitPanel.$panel.find(".git-remote-selected"),
            remoteName = $selectedElement.data("remote-name");

        return Panel.askQuestion(
            Strings.DELETE_REMOTE,
            StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName),
            {booleanResponse: true}
        ).then(function (response) {
            if (response) {
                Main.gitControl.gitFtpRemoveScope(remoteName).then(function () {
                    $selectedElement.parent().remove();
                    var newRemote = gitPanel.$panel.find(".git-remotes-dropdown .remote").first().find("a").data("remote-name");
                    $currentRemote.data("remote-name", newRemote).html(newRemote);
                    gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
                }).fail(function (err) {
                    ErrorHandler.logError(err);
                    gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
                });
            } else {
                gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
            }
        }).fail(function () {
            gitPanel.$panel.find(".git-remotes").removeClass("btn-loading").prop("disabled", false);
        });
    }
    // } GIT-FTP REMOTES CREATE/REMOVE


    function prepareRemotesPicker() {
        gitPanel.$panel = $("#git-panel");

        q.allSettled([Main.gitControl.getRemotes(), Main.gitControl.getFtpRemotes()]).spread(function (remotes, ftpRemotes) {

            var gitFtpEnabled = Preferences.get("useGitFtp");

            // If both promises are fullfilled
            if (remotes.state === "fulfilled" && (ftpRemotes.state === "fulfilled" || gitFtpEnabled === false)) {

                // Set default remote name and cache the remotes dropdown menu
                var defaultRemoteName    = _getDefaultRemote(),
                    $remotesDropdown     = gitPanel.$panel.find(".git-remotes-dropdown"),
                    $remotesDropdownList = "";

                // Disable Git-push and Git-pull if there are not remotes defined
                gitPanel.$panel.find(".git-pull, .git-push").prop("disabled", (remotes.value.length === 0 && ftpRemotes.value.length === 0));

                // Add options to change remote
                remotes.value = $.map(remotes.value, function (remote) {
                    return {
                        "name": remote.name,
                        "deletable": (remote.name !== "origin") ? true : false
                    };
                });
                var hasRemotes = remotes.value.length ? true : false,
                    hasFtpRemotes = ftpRemotes.value.length ? true : false;

                $remotesDropdownList = Mustache.render(gitRemotesPickerTemplate, {
                    Strings: Strings,
                    remotes: remotes.value,
                    ftpRemotes: ftpRemotes.value,
                    hasRemotes: hasRemotes,
                    hasFtpRemotes: hasFtpRemotes,
                    gitFtpEnabled: gitFtpEnabled
                });

                $remotesDropdown.html($remotesDropdownList);
                if (remotes.value.length !== 0) {
                    handleRemotePick(defaultRemoteName);
                } else {
                    clearRemotePicker();
                }

                if (ftpRemotes.state === "rejected") {
                    throw ErrorHandler.showError(
                        ftpRemotes.reason,
                        "Failed to get a list of Git-FTP remotes, Git remotes was successfully initalized and are usable."
                    );
                }

            } else {
                if (remotes.state === "rejected") {
                    throw ErrorHandler.showError(remotes.reason, "Failed to get a list of remotes.");
                }
                if (ftpRemotes.state === "rejected") {
                    throw ErrorHandler.showError(ftpRemotes.reason, "Failed to get a list of Git-FTP remotes.");
                }
            }
        });
    }


    function init() {
        gitPanel.$panel = $("#git-panel");
        gitPanel.$panel
            .on("click", ".change-remote", function () { handleRemotePick(this); })
            .on("click", ".remove-remote", function () {  handleRemoteRemove(this); })
            .on("click", ".git-remote-new", handleRemoteCreation);

        // Assign handlers related to Git-FTP features if Git-FTP is enabled
        if (Preferences.get("useGitFtp")) {
            gitPanel.$panel
                .on("click", ".gitftp-remote-new", handleGitFtpRemoteCreation)
                .on("click", ".gitftp-remove-remote", function () {  handleGitFtpRemoteRemove(this); });
        }

    }

    // Public API
    exports.prepareRemotesPicker = prepareRemotesPicker;
    exports.init = init;

});
