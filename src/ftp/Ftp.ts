import { _, DefaultDialogs, Dialogs, Mustache, StringUtils } from "../brackets-modules";
import * as ErrorHandler from "../ErrorHandler";
import * as Events from "../Events";
import EventEmitter from "../EventEmitter";
import * as Strings from "strings";
import * as Utils from "../Utils";
import * as GitFtp from "./GitFtp";

const ftpScopesTemplate = require("text!templates/ftp/remotes-picker.html");
let $gitPanel = null;
let $remotesDropdown = null;

const attachEvents = _.once(() => {
    $gitPanel
        .on("click", ".gitftp-remote-new", () => handleGitFtpScopeCreation())
        .on("click", ".gitftp-remove-remote", function () { handleGitFtpScopeRemove($(this)); })
        .on("click", ".gitftp-init-remote", function () { handleGitFtpInitScope($(this)); })
        .on("click", ".git-push", function () {
            const typeOfRemote = $(this).attr("x-selected-remote-type");
            if (typeOfRemote === "ftp") {
                handleGitFtpPush();
            }
        });
});

function initVariables() {
    $gitPanel = $("#git-panel");
    $remotesDropdown = $gitPanel.find(".git-remotes-dropdown");
    attachEvents();
}

function handleGitFtpPush() {
    const gitFtpScope = $gitPanel.find(".git-selected-remote").text().trim();

    $gitPanel.find(".git-push")
        .addClass("btn-loading")
        .prop("disabled", true);

    return GitFtp.push(gitFtpScope).then((result) => {

        Dialogs.showModalDialog(
            DefaultDialogs.DIALOG_ID_INFO,
            Strings.GITFTP_PUSH_RESPONSE, // title
            result // message
        );

    }).catch((err) => {

        ErrorHandler.showError(err, "Failed push to Git-FTP remote.");

    }).finally(() => {

        $gitPanel.find(".git-push")
            .removeClass("btn-loading")
            .prop("disabled", false);

    });
}

function handleGitFtpScopeCreation() {
    $gitPanel.find(".git-remotes")
        .addClass("btn-loading")
        .prop("disabled", true);

    return Utils.askQuestion(Strings.CREATE_GITFTP_NEW_SCOPE, Strings.ENTER_GITFTP_SCOPE_NAME)
        .then((name) => {
            return Utils.askQuestion(
                Strings.CREATE_GITFTP_NEW_SCOPE,
                Strings.ENTER_GITFTP_SCOPE_URL,
                { defaultValue: "ftp://user:passwd@example.org/folder" }
            )
                .then((url) => {
                    return GitFtp.addScope(name, url).then(() => {

                        // Render the list element of the new remote
                        // FUTURE: replace this part with a way to call `Remotes.refreshRemotesPicker()`
                        const $newScope = $("<li/>")
                                            .addClass("gitftp-remote")
                                            .append("<a/>")
                                            .find("a")
                                                .attr({
                                                    "href": "#",
                                                    "data-remote-name": name,
                                                    "data-type": "ftp"
                                                })
                                                .addClass("remote-name")
                                                .append("<span/>")
                                                .find("span")
                                                    .addClass("trash-icon gitftp-remove-remote")
                                                    .html("&times;")
                                                .end()
                                                .append("<span/>")
                                                .find("span:nth-child(2)")
                                                    .addClass("change-remote")
                                                    .text(name)
                                                .end()
                                            .end();

                        $gitPanel.find(".git-remotes-dropdown .ftp-remotes-header").after($newScope);

                    }).catch((err) => {
                        ErrorHandler.showError(err, "Git-FTP remote creation failed");
                    });
                });
        })
        .finally(() => {
            $gitPanel.find(".git-remotes")
                .removeClass("btn-loading")
                .prop("disabled", false);
        });
}

function handleGitFtpScopeRemove($this) {
    $gitPanel.find(".git-remotes")
        .addClass("btn-loading")
        .prop("disabled", true);

    const $selectedElement = $this.closest(".remote-name");
    const $currentScope = $gitPanel.find(".git-selected-remote");
    const scopeName = $selectedElement.data("remote-name");

    return Utils.askQuestion(
        Strings.DELETE_SCOPE,
        StringUtils.format(Strings.DELETE_SCOPE_NAME, scopeName),
        { booleanResponse: true }
    ).then((response) => {
        if (response) {
            return GitFtp.removeScope(scopeName).then(() => {
                $selectedElement.parent().remove();
                const newScope = $gitPanel.find(".git-remotes-dropdown .remote").first().find("a").data("remote-name");
                $currentScope.data("remote-name", newScope).html(newScope);
            }).catch((err) => {
                ErrorHandler.showError(err, "Remove scope failed");
            });
        }
        return null;
    }).finally(() => {
        $gitPanel.find(".git-remotes")
            .removeClass("btn-loading")
            .prop("disabled", false);
    });
}

function handleGitFtpInitScope($this) {
    $gitPanel.find(".git-remotes")
        .addClass("btn-loading")
        .prop("disabled", true);

    const $selectedElement = $this.closest(".remote-name");
    const scopeName = $selectedElement.data("remote-name");

    return Utils.askQuestion(
        Strings.INIT_GITFTP_SCOPE,
        StringUtils.format(Strings.INIT_GITFTP_SCOPE_NAME, scopeName),
        { booleanResponse: true }
    ).then((response) => {
        if (response) {
            return GitFtp.init(scopeName).catch((err) => {
                ErrorHandler.showError(err, "Init scope failed");
            });
        }
        return null;
    }).finally(() => {
        $gitPanel.find(".git-remotes")
            .removeClass("btn-loading")
            .prop("disabled", false);
    });
}

function addFtpScopesToPicker() {
    const otherRemotes = $remotesDropdown.find("li.remote");

    GitFtp.getScopes().then((ftpScopes) => {
        if ($gitPanel.find(".ftp-remotes-header").length === 0) {
            // Pass to Mustache the needed data
            const compiledTemplate = Mustache.render(ftpScopesTemplate, {
                Strings,
                ftpScopes,
                hasFtpScopes: ftpScopes.length > 0
            });
            $remotesDropdown.prepend(compiledTemplate);

            // if there are only ftp remotes, enable the push button and make first ftp remote selected
            if (otherRemotes.length === 0 && ftpScopes.length > 0) {
                $gitPanel
                    .find(".git-push")
                    .prop("disabled", false)
                    .attr("x-selected-remote-type", "ftp");
                $gitPanel
                    .find(".git-selected-remote")
                    .text(ftpScopes[0].name);
            }
        }
    }).catch((err) => {
        ErrorHandler.showError(err, "Getting FTP remotes failed!");
    });
}

GitFtp.isAvailable().then(() => {
    // Event subscriptions
    EventEmitter.on(Events.GIT_ENABLED, () => {
        initVariables();
    });

    EventEmitter.on(Events.REMOTES_REFRESH_PICKER, () => {
        addFtpScopesToPicker();
    });
}).catch((err) => {
    ErrorHandler.showError(err, "Git-FTP seems not installed in your system, please install it and restart Brackets.");
});
