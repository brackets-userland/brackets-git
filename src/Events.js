define(function (require, exports) {
    "use strict";

    /**
     * List of Events to be used in the extension
     */

    // Setup Events
    exports.NODE_CONNECTION_READY = "node.connection.ready";

    // Git Events
    exports.GIT_ENABLED = "git.enabled";
    exports.GIT_DISABLED = "git.disabled";
    exports.GIT_USERNAME_CHANGED = "git.username.changed";
    exports.GIT_EMAIL_CHANGED = "git.email.changed";

    // UI Events
    exports.HANDLE_PUSH = "handle.push";
    exports.HANDLE_PULL = "handle.pull";
    exports.HANDLE_REMOTE_PICK = "handle.remote.pick";
    exports.HANDLE_REMOTE_DELETE = "handle.remote.delete";
    exports.HANDLE_REMOTE_CREATE = "handle.remote.create";

});
