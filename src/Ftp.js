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
        GitFtp        = require("src/Git/GitFtp"),
        Preferences   = require("src/Preferences"),
        Strings       = require("strings"),
        Utils         = require("src/Utils");

    // Module variables
    var $gitPanel = null;
    
    // Implementation
    
    var attachEvents = _.once(function () {
        $gitPanel
            .on("click", ".gitftp-remote-new", handleGitFtpRemoteCreation)
            .on("click", ".gitftp-remove-remote", function () { handleGitFtpRemoteRemove($(this)); });
    });
    
    function initVariables() {
        $gitPanel = $("#git-panel");
        if (Preferences.get("useGitFtp")) {
            attachEvents();
        }
    }

    function handleGitFtpPush() {
        var gitFtpRemote = $gitPanel.find(".git-remote-selected").text().trim();
        $gitPanel.find(".gitftp-push").prop("disabled", true).addClass("btn-loading");

        GitFtp.gitFtpPush(gitFtpRemote).done(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GITFTP_PUSH_RESPONSE, // title
                result // message
            );
        }).fail(function (err) {
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
        
        return Utils.askQuestion(Strings.CREATE_GITFTP_NEW_REMOTE,
                                 Strings.ENTER_GITFTP_REMOTE_NAME).then(function (name) {
            return Utils.askQuestion(Strings.CREATE_GITFTP_NEW_REMOTE,
                                     Strings.ENTER_GITFTP_REMOTE_URL,
                                     {defaultValue: "ftp://user:passwd@example.org/folder"}).then(function (url) {
                
                return GitFtp.gitFtpAddScope(name, url).then(function () {
                    // return handleGitFtpRemoteInit();
                }).fail(function (err) {
                    ErrorHandler.showError(err, "Git-FTP remote creation failed");
                });
                
            });
        }).finally(function () {
            $gitPanel.find(".git-remotes")
                .removeClass("btn-loading")
                .prop("disabled", false);
        });
    }
    
    function handleGitFtpRemoteRemove($this) {
        $gitPanel.find(".git-remotes")
            .addClass("btn-loading")
            .prop("disabled", true);
        
        var $selectedElement = $this.closest("a[.remote-name]"),
            $currentRemote = $gitPanel.find(".git-remote-selected"),
            remoteName = $selectedElement.data("remote-name");

        return Utils.askQuestion(
            Strings.DELETE_REMOTE,
            StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName),
            {booleanResponse: true}
        ).then(function (response) {
            if (response) {
                return GitFtp.gitFtpRemoveScope(remoteName).then(function () {
                    $selectedElement.parent().remove();
                    console.log("find", $gitPanel.find(".git-remotes-dropdown .remote").first().find("a"));
                    var newRemote = $gitPanel.find(".git-remotes-dropdown .remote").first().find("a").data("remote-name");
                    $currentRemote.data("remote-name", newRemote).html(newRemote);
                }).fail(function (err) {
                    ErrorHandler.showError(err, "Remove scope failed");
                });
            }
        }).finally(function () {
            $gitPanel.find(".git-remotes")
                .removeClass("btn-loading")
                .prop("disabled", false);
        });
    }
    
    // Event subscriptions
    EventEmitter.on(Events.GIT_ENABLED, function () {
        initVariables();
    });
    
    EventEmitter.on(Events.HANDLE_FTP_PUSH, function () {
        handleGitFtpPush();
    });
    
});
