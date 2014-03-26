define(function (require) {

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        DefaultDialogs  = brackets.getModule("widgets/DefaultDialogs"),
        Dialogs         = brackets.getModule("widgets/Dialogs"),
        StringUtils     = brackets.getModule("utils/StringUtils");

    // Local modules
    var ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Preferences   = require("src/Preferences"),
        Strings       = require("strings"),
        Utils         = require("src/Utils"),
        GitFtp        = require("./GitFtp");

    // Module variables
    var ftpRemotesTemplate = require("text!src/Ftp/templates/remotes-picker.html"),
        $gitPanel = null,
        $remotesDropdown = null;
    
    // Implementation
    
    var attachEvents = _.once(function () {
        $gitPanel
            .on("click", ".gitftp-remote-new", handleGitFtpRemoteCreation)
            .on("click", ".gitftp-remove-remote", function () { handleGitFtpRemoteRemove($(this)); })
            .on("click", ".gitftp-push", handleGitFtpPush);
    });
    
    function initVariables() {
        $gitPanel = $("#git-panel");
        $remotesDropdown = $gitPanel.find(".git-remotes-dropdown");
        if (Preferences.get("useGitFtp")) {
            attachEvents();
        }
    }

    function handleGitFtpPush() {
        var gitFtpRemote = $gitPanel.find(".git-remote-selected").text().trim();
        $gitPanel.find(".gitftp-push").prop("disabled", true).addClass("btn-loading");

        GitFtp.push(gitFtpRemote).done(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GITFTP_PUSH_RESPONSE, // title
                result // message
            );
        }).catch(function (err) {
            ErrorHandler.showError(err, "Failed push to Git-FTP remote.");
        }).finally(function () {
            $gitPanel.find(".gitftp-push")
                .prop("disabled", false)
                .removeClass("btn-loading");
        });
    }
    
    function handleGitFtpRemoteCreation() {
        $gitPanel.find(".git-remotes")
            .addClass("btn-loading")
            .prop("disabled", true);
        
        return Utils.askQuestion(Strings.CREATE_GITFTP_NEW_REMOTE, Strings.ENTER_GITFTP_REMOTE_NAME)
            .then(function (name) {
                return Utils.askQuestion(
                    Strings.CREATE_GITFTP_NEW_REMOTE,
                    Strings.ENTER_GITFTP_REMOTE_URL,
                    {defaultValue: "ftp://user:passwd@example.org/folder"}
                )
                    .then(function (url) {
                        return GitFtp.addScope(name, url).then(function () {

                            // Render the list element of the new remote
                            // TODO: replace this part with a way to call `Remotes.refreshRemotesPicker()`
                            var $newRemote =   $("<li/>")
                                                    .addClass("gitftp-remote")
                                                    .append("<a/>")
                                                    .find("a")
                                                        .attr({href: "#", "data-remote-name": name, "data-type": "ftp"})
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

                            $gitPanel.find(".git-remotes-dropdown .ftp-remotes-header").after($newRemote);

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
    
    function handleGitFtpRemoteRemove($this) {
        $gitPanel.find(".git-remotes")
            .addClass("btn-loading")
            .prop("disabled", true);
        
        var $selectedElement = $this.closest(".remote-name"),
            $currentRemote = $gitPanel.find(".git-remote-selected"),
            remoteName = $selectedElement.data("remote-name");

        return Utils.askQuestion(
            Strings.DELETE_REMOTE,
            StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName),
            {booleanResponse: true}
        ).then(function (response) {
            if (response) {
                return GitFtp.removeScope(remoteName).then(function () {
                    $selectedElement.parent().remove();
                    var newRemote = $gitPanel.find(".git-remotes-dropdown .remote").first().find("a").data("remote-name");
                    $currentRemote.data("remote-name", newRemote).html(newRemote);
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
    
    function addFtpRemotesToPicker() {
        GitFtp.getRemotes().then(function (ftpRemotes) {

            // Pass to Mustache the needed data
            var compiledTemplate = Mustache.render(ftpRemotesTemplate, {
                Strings: Strings,
                ftpRemotes: ftpRemotes,
                hasFtpRemotes: ftpRemotes.length > 0
            });

            $remotesDropdown.prepend(compiledTemplate);

        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting FTP remotes failed!");
        });
    }

    // Event subscriptions
    EventEmitter.on(Events.GIT_ENABLED, function () {
        initVariables();
    });

    EventEmitter.on(Events.REMOTES_REFRESH_PICKER, function () {
        addFtpRemotesToPicker();
    });

});
