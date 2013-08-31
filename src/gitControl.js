/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define */

define(function (require, exports, module) {
    "use strict";

    var q = require("../thirdparty/q");

    function GitControl(options) {
        this._isHandlerRunning = false;
        this._queue = [];
        this.options = options;

        if (this.options.preferences.getValue("gitIsInSystemPath")) {
            this._git = "git";
        } else {
            this._git = "\"" + this.options.preferences.getValue("gitPath") + "\"";
        }
    }

    GitControl.prototype = {

        _processQueue: function () {
            var self = this;
            if (self._isHandlerRunning || self._queue.length === 0) { return; }
            self._isHandlerRunning = true;

            var queueItem = self._queue.shift(),
                promise = queueItem[0],
                cmd = queueItem[1];

            self.options.executeHandler(cmd)
                .then(function (result) {
                    promise.resolve(result);
                    self._isHandlerRunning = false;
                    self._processQueue();
                })
                .fail(function (ex) {
                    promise.reject(ex);
                    self._isHandlerRunning = false;
                    self._processQueue();
                });
        },

        executeCommand: function (cmd) {
            var rv = q.defer();
            this._queue.push([rv, cmd]);
            this._processQueue();
            return rv.promise;
        },

        bashVersion: function () {
            if (brackets.platform === "win") {
                var cmd = "\"" + this.options.preferences.getValue("msysgitPath") + "bin\\sh.exe" + "\"";
                return this.executeCommand(cmd + " --version");
            } else {
                return q().thenReject();
            }
        },

        bashOpen: function (folder) {
            if (brackets.platform === "win") {
                var cmd = "\"" + this.options.preferences.getValue("msysgitPath") + "Git Bash.vbs" + "\"";
                var arg = " \"" + folder + "\"";
                return this.executeCommand(cmd + arg);
            } else {
                return q().thenReject();
            }
        },

        getVersion: function () {
            return this.executeCommand(this._git + " --version").then(function (output) {
                var io = output.indexOf("git version");
                return output.substring(io !== -1 ? io + "git version".length : 0).trim();
            }).fail(function (error) {
                // 'git' is not recognized as an internal or external command
                throw error;
            });
        },

        getRepositoryRoot: function () {
            return this.executeCommand(this._git + " rev-parse --show-toplevel").then(function (output) {
                // Git returns directory name without trailing slash
                return output.trim() + "/";
            }).fail(function (error) {
                // Not a git repository (or any of the parent directories): .git
                throw error;
            });
        },

        getBranchName: function () {
            return this.executeCommand(this._git + " rev-parse --abbrev-ref HEAD");
        },

        getGitStatus: function () {
            return this.executeCommand(this._git + " status -u --porcelain").then(function (stdout) {
                if (stdout.length === 0) { return []; }

                var results = [],
                    lines = stdout.split("\n");
                lines.forEach(function (line) {
                    var status = line.substring(0, 2),
                        file = line.substring(3);

                    switch (status) {
                    case "A ":
                        status = "STAGED;NEWFILE";
                        break;
                    case "AM":
                        status = "STAGED;NEWFILE;MODIFIED";
                        break;
                    case " D":
                        status = "DELETED";
                        break;
                    case "M ":
                        status = "STAGED";
                        break;
                    case " M":
                        status = "MODIFIED";
                        break;
                    case "MM":
                        status = "STAGED;MODIFIED";
                        break;
                    case "??":
                        status = "UNTRACKED";
                        break;
                    default:
                        throw new Error("Unexpected status: " + status);
                    }

                    results.push({
                        status: status,
                        file: file
                    });
                });
                return results.sort(function (a, b) {
                    if (a.file < b.file) { return -1; }
                    if (a.file > b.file) { return 1; }
                    return 0;
                });
            });
        },

        gitAdd: function (file, updateIndex) {
            var cmd = this._git + " add ";
            if (updateIndex) { cmd += "-u "; }
            cmd += "\"" + file + "\"";
            return this.executeCommand(cmd);
        },

        gitUndoFile: function (file) {
            return this.executeCommand(this._git + " checkout \"" + file + "\"");
        },

        gitCommit: function (message) {
            return this.executeCommand(this._git + " commit -m \"" + message + "\"");
        },

        gitReset: function () {
            return this.executeCommand(this._git + " reset");
        },

        gitDiff: function (file) {
            return this.executeCommand(this._git + " diff -U0 \"" + file + "\"");
        },

        gitDiffSingle: function (file) {
            return this.executeCommand(this._git + " diff \"" + file + "\"");
        },

        gitDiffStaged: function () {
            return this.executeCommand(this._git + " diff --staged");
        }

    };

    module.exports = GitControl;
});
