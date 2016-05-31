define(function (require) {

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        DefaultDialogs  = brackets.getModule("widgets/DefaultDialogs"),
        Dialogs         = brackets.getModule("widgets/Dialogs"),
        Mustache        = brackets.getModule("thirdparty/mustache/mustache"),
        StringUtils     = brackets.getModule("utils/StringUtils");

    // Local modules
    var ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Strings       = require("strings"),
        Utils         = require("src/Utils"),
        GitFtp        = require("src/ftp/GitFtp");

    // Module variables
    var ftpScopesTemplate = require("text!src/ftp/templates/remotes-picker.html"),
        $gitPanel = null,
        $remotesDropdown = null;

    // Implementation
    var attachEvents = _.once(function () {
        $gitPanel
            .on("click", ".gitftp-remote-new", function () { handleGitFtpScopeCreation(); })
            .on("click", ".gitftp-remove-remote", function () { handleGitFtpScopeRemove($(this)); })
            .on("click", ".gitftp-init-remote", function () { handleGitFtpInitScope($(this)); })
            .on("click", ".git-push", function () {
                var typeOfRemote = $(this).attr("x-selected-remote-type");
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
        var gitFtpScope = $gitPanel.find(".git-selected-remote").text().trim();

        $gitPanel.find(".git-push")
            .addClass("btn-loading")
            .prop("disabled", true);

        return GitFtp.push(gitFtpScope).then(function (result) {

            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GITFTP_PUSH_RESPONSE, // title
                result // message
            );

        }).catch(function (err) {

            ErrorHandler.showError(err, "Failed push to Git-FTP remote.");

        }).finally(function () {

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
            .then(function (name) {
                return Utils.askQuestion(
                    Strings.CREATE_GITFTP_NEW_SCOPE,
                    Strings.ENTER_GITFTP_SCOPE_URL,
                    { defaultValue: "ftp://user:passwd@example.org/folder" }
                )
                    .then(function (url) {
                        return GitFtp.addScope(name, url).then(function () {

                            // Render the list element of the new remote
                            // FUTURE: replace this part with a way to call `Remotes.refreshRemotesPicker()`
                            var $newScope = $("<li/>")
                                                .addClass("gitftp-remote")
                                                .append("<a/>")
                                                .find("a")
                                                    .attr({
                                                        href: "#",
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

                        }).catch(function (err) {
                            ErrorHandler.showError(err, "Git-FTP remote creation failed");
                        });
                    });
            })
            .finally(function () {
                $gitPanel.find(".git-remotes")
                    .removeClass("btn-loading")
                    .prop("disabled", false);
            });
    }

    function handleGitFtpScopeRemove($this) {
        $gitPanel.find(".git-remotes")
            .addClass("btn-loading")
            .prop("disabled", true);

        var $selectedElement = $this.closest(".remote-name"),
            $currentScope = $gitPanel.find(".git-selected-remote"),
            scopeName = $selectedElement.data("remote-name");

        return Utils.askQuestion(
            Strings.DELETE_SCOPE,
            StringUtils.format(Strings.DELETE_SCOPE_NAME, scopeName),
            { booleanResponse: true }
        ).then(function (response) {
            if (response) {
                return GitFtp.removeScope(scopeName).then(function () {
                    $selectedElement.parent().remove();
                    var newScope = $gitPanel.find(".git-remotes-dropdown .remote").first().find("a").data("remote-name");
                    $currentScope.data("remote-name", newScope).html(newScope);
                }).catch(function (err) {
                    ErrorHandler.showError(err, "Remove scope failed");
                });
            }
        }).finally(function () {
            $gitPanel.find(".git-remotes")
                .removeClass("btn-loading")
                .prop("disabled", false);
        });
    }

    function handleGitFtpInitScope($this) {
        $gitPanel.find(".git-remotes")
            .addClass("btn-loading")
            .prop("disabled", true);

        var $selectedElement = $this.closest(".remote-name"),
            scopeName = $selectedElement.data("remote-name");

        return Utils.askQuestion(
            Strings.INIT_GITFTP_SCOPE,
            StringUtils.format(Strings.INIT_GITFTP_SCOPE_NAME, scopeName),
            { booleanResponse: true }
        ).then(function (response) {
            if (response) {
                return GitFtp.init(scopeName).catch(function (err) {
                    ErrorHandler.showError(err, "Init scope failed");
                });
            }
        }).finally(function () {
            $gitPanel.find(".git-remotes")
                .removeClass("btn-loading")
                .prop("disabled", false);
        });
    }

    function addFtpScopesToPicker() {
        var otherRemotes = $remotesDropdown.find("li.remote");

        GitFtp.getScopes().then(function (ftpScopes) {
            if ($gitPanel.find(".ftp-remotes-header").length === 0) {
                // Pass to Mustache the needed data
                var compiledTemplate = Mustache.render(ftpScopesTemplate, {
                    Strings: Strings,
                    ftpScopes: ftpScopes,
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
        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting FTP remotes failed!");
        });
    }

    GitFtp.isAvailable().then(function () {
        // Event subscriptions
        EventEmitter.on(Events.GIT_ENABLED, function () {
            initVariables();
        });

        EventEmitter.on(Events.REMOTES_REFRESH_PICKER, function () {
            addFtpScopesToPicker();
        });
    }).catch(function (err) {
        ErrorHandler.showError(err, "Git-FTP seems not installed in your system, please install it and restart Brackets.");
    });

});
