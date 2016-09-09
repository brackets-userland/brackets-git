define(function (require, exports) {
    "use strict";

    /**
     * List of Events to be used in the extension.
     * Events should be structured by file who emits them.
     */

    // Brackets events
    exports.BRACKETS_CURRENT_DOCUMENT_CHANGE = "brackets.current.document.change";
    exports.BRACKETS_PROJECT_CHANGE = "brackets.project.change";
    exports.BRACKETS_PROJECT_REFRESH = "brackets.project.refresh";
    exports.BRACKETS_DOCUMENT_SAVED = "brackets.document.saved";
    exports.BRACKETS_FILE_CHANGED = "brackets.file.changed";

    // Git events
    exports.GIT_USERNAME_CHANGED = "git.username.changed";
    exports.GIT_EMAIL_CHANGED = "git.email.changed";
    exports.GIT_COMMITED = "git.commited";
    exports.GIT_NO_BRANCH_EXISTS = "git.no.branch.exists";
    exports.GIT_CHANGE_USERNAME = "git.change.username";
    exports.GIT_CHANGE_EMAIL = "git.change.email";

    // Gerrit events
    exports.GERRIT_TOGGLE_PUSH_REF = "gerrit.toggle.push.ref";
    exports.GERRIT_PUSH_REF_TOGGLED = "gerrit.push.ref.toggled";

    // Startup events
    exports.REFRESH_ALL = "git.refresh.all";
    exports.GIT_ENABLED = "git.enabled";
    exports.GIT_DISABLED = "git.disabled";
    exports.REBASE_MERGE_MODE = "rebase.merge.mode";

    // Panel.js
    exports.HANDLE_GIT_INIT = "handle.git.init";
    exports.HANDLE_GIT_CLONE = "handle.git.clone";
    exports.HANDLE_GIT_COMMIT = "handle.git.commit";
    exports.HANDLE_FETCH = "handle.fetch";
    exports.HANDLE_PUSH = "handle.push";
    exports.HANDLE_PULL = "handle.pull";
    exports.HANDLE_REMOTE_PICK = "handle.remote.pick";
    exports.HANDLE_REMOTE_DELETE = "handle.remote.delete";
    exports.HANDLE_REMOTE_CREATE = "handle.remote.create";
    exports.HANDLE_FTP_PUSH = "handle.ftp.push";
    exports.HISTORY_SHOW = "history.show";
    exports.REFRESH_COUNTERS = "refresh.counters";

    // Git results
    exports.GIT_STATUS_RESULTS = "git.status.results";

    // Remotes.js
    exports.GIT_REMOTE_AVAILABLE = "git.remote.available";
    exports.GIT_REMOTE_NOT_AVAILABLE = "git.remote.not.available";
    exports.REMOTES_REFRESH_PICKER = "remotes.refresh.picker";
    exports.FETCH_STARTED = "remotes.fetch.started";
    exports.FETCH_COMPLETE = "remotes.fetch.complete";

    // utils/Terminal.js
    exports.TERMINAL_OPEN = "terminal.open";
    exports.TERMINAL_DISABLE = "terminal.disable";
});
