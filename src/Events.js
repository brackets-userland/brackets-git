define(function (require, exports) {
    "use strict";

    /**
     * List of Events to be used in the extension.
     * Events should be structured by file who emits them.
     */

    // Panel.js
    exports.GIT_ENABLED = "git.enabled";
    exports.GIT_DISABLED = "git.disabled";
    exports.GIT_USERNAME_CHANGED = "git.username.changed";
    exports.GIT_EMAIL_CHANGED = "git.email.changed";
    exports.HANDLE_PUSH = "handle.push";
    exports.HANDLE_PULL = "handle.pull";
    exports.HANDLE_REMOTE_PICK = "handle.remote.pick";
    exports.HANDLE_REMOTE_DELETE = "handle.remote.delete";
    exports.HANDLE_REMOTE_CREATE = "handle.remote.create";
    exports.HANDLE_FTP_PUSH = "handle.ftp.push";

    // Remotes.js
    exports.GIT_REMOTE_AVAILABLE = "git.remote.available";
    exports.GIT_REMOTE_NOT_AVAILABLE = "git.remote.not.available";
    exports.PULL_STARTED = "pull.started";
    exports.PULL_FINISHED = "pull.finished";
    exports.PUSH_STARTED = "push.started";
    exports.PUSH_FINISHED = "push.finished";
    exports.REMOTES_REFRESH_PICKER = "remotes.refresh.picker";

});
