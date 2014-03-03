/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define */

define(function (require, exports, module) {
    "use strict";

    var q               = require("../thirdparty/q"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        Preferences     = require("./Preferences");

    var FILE_STATUS = {
        STAGED: "FILE_STAGED",
        NEWFILE: "FILE_NEWFILE",
        MODIFIED: "FILE_MODIFIED",
        DELETED: "FILE_DELETED",
        RENAMED: "FILE_RENAMED",
        UNTRACKED: "FILE_UNTRACKED"
    };

    function uniqSorted(arr) {
        var rv = [];
        arr.forEach(function (i) {
            if (rv.indexOf(i) === -1) {
                rv.push(i);
            }
        });
        return rv.sort();
    }

    function escapeShellArg(str) {
        // From: http://phpjs.org/functions
        // +   original by: Felix Geisendoerfer (http://www.debuggable.com/felix)
        // +   improved by: Brett Zamir (http://brett-zamir.me)
        // *     example 1: escapeshellarg("kevin's birthday");
        // *     returns 1: "'kevin\'s birthday'"
        if (typeof str !== "string") {
            throw new Error("escapeShellArg argument is not a string: " + typeof str);
        }
        if (str.length === 0) {
            return str;
        }
        if (brackets.platform !== "win") {
            str = str.replace(/[^\\]'/g, function (m) {
                return m.slice(0, 1) + "\\\'";
            });
            return "'" + str + "'";
        } else {
            // http://stackoverflow.com/questions/7760545/cmd-escape-double-quotes-in-parameter
            str = str.replace(/"/g, function () {
                return "\"\"\"";
            });
            return "\"" + str + "\"";
        }
    }

    function GitControl(options) {
        this._isHandlerRunning = false;
        this._queue = [];
        this.options = options;

        if (Preferences.get("gitIsInSystemPath")) {
            this._git = "git";
        } else {
            this._git = "\"" + Preferences.get("gitPath") + "\"";
        }
    }

    GitControl.FILE_STATUS = FILE_STATUS;

    GitControl.prototype = {

        _processQueue: function () {
            var self = this;
            if (self._isHandlerRunning || self._queue.length === 0) {
                return;
            }
            self._isHandlerRunning = true;

            var queueItem = self._queue.shift(),
                method = queueItem[0],
                promise = queueItem[1],
                cmd = queueItem[2],
                args = queueItem[3],
                opts = queueItem[4];

            self.options.handler(method, cmd, args, opts).then(function (result) {
                promise.resolve(result);
                self._isHandlerRunning = false;
                self._processQueue();
            }).fail(function (ex) {
                promise.reject(ex);
                self._isHandlerRunning = false;
                self._processQueue();
            });
        },

        _pushToQueue: function (method, cmd, args, opts) {
            if (!args) { args = []; }
            if (!opts) { opts = {}; }
            if (typeof args === "string") { args = [args]; }

            var rv = q.defer();
            this._queue.push([method, rv, cmd, args, opts]);
            this._processQueue();
            return rv.promise;
        },

        executeCommand: function (cmd, args, opts) {
            return this._pushToQueue("execute", cmd, args, opts);
        },

        spawnCommand: function (cmd, args, opts) {
            return this._pushToQueue("spawn", cmd, args, opts);
        },

        bashVersion: function () {
            if (brackets.platform === "win") {
                var cmd = "\"" + Preferences.get("msysgitPath") + "bin\\sh.exe" + "\"";
                return this.executeCommand(cmd + " --version");
            } else {
                return q().thenReject();
            }
        },

        bashOpen: function (folder) {
            if (brackets.platform === "win") {
                var cmd = "\"" + Preferences.get("msysgitPath") + "Git Bash.vbs" + "\"";
                var arg = " \"" + folder + "\"";
                return this.executeCommand(cmd + arg);
            } else {
                return q().thenReject();
            }
        },

        terminalOpen: function (folder, customCmd) {
            var cmd;
            if (customCmd) {
                cmd = customCmd.replace("$1", escapeShellArg(folder));
            } else {
                cmd = Preferences.get("extensionDirectory") + "shell/" +
                    (brackets.platform === "mac" ? "terminal.osa" : "terminal.sh");
                cmd = escapeShellArg(cmd) + " " + escapeShellArg(folder);
            }
            return this.executeCommand(cmd);
        },

        getVersion: function () {
            return this.executeCommand(this._git, "--version").then(function (output) {
                var io = output.indexOf("git version");
                return output.substring(io !== -1 ? io + "git version".length : 0).trim();
            });
        },

        getRepositoryRoot: function () {
            var self = this;
            return this.executeCommand(this._git + " rev-parse --show-toplevel").then(function (output) {
                // Git returns directory name without trailing slash
                if (output.length > 0) { output = output.trim() + "/"; }
                // Check if it's a cygwin installation.
                if (brackets.platform === "win" && output[0] === "/") {
                    // Convert to Windows path with cygpath.
                    return self.executeCommand("\"" + Preferences.get("msysgitPath") +
                                               "\\bin\\cygpath" + "\" -m \"" + output + "\"").then(function (output) {
                        return output;
                    });
                }
                return output;
            });
        },

        getCommitsAhead: function () {
            return this.executeCommand(this._git + " rev-list HEAD --not --remotes").then(function (output) {
                if (output.trim().length === 0) {
                    return [];
                } else {
                    return output.split("\n");
                }
            });
        },

        getLastCommitMessage: function () {
            return this.executeCommand(this._git + " log -1 --pretty=%B").then(function (output) {
                return output.trim();
            });
        },

        getBranchName: function () {
            return this.executeCommand(this._git + " rev-parse --abbrev-ref HEAD");
        },

        getGitConfig: function (str) {
            return this.executeCommand(this._git + " config " + str.replace(/\s/g, ""));
        },

        setGitConfig: function (str, val) {
            return this.executeCommand(this._git + " config " + str.replace(/\s/g, "") + " " + escapeShellArg(val));
        },

        getBranches: function () {
            return this.executeCommand(this._git + " branch").then(function (stdout) {
                return stdout.split("\n").map(function (l) {
                    return l.trim();
                });
            });
        },

        checkoutBranch: function (branchName) {
            return this.executeCommand(this._git + " checkout " + branchName);
        },

        createBranch: function (branchName) {
            return this.executeCommand(this._git + " checkout -b " + branchName);
        },

        getRemotes: function () {
            return this.executeCommand(this._git + " remote -v").then(function (stdout) {
                return $.unique(stdout.replace(/\((push|fetch)\)/g, "").split("\n")).map(function (l) {
                    return l.trim().split("\t");
                });
            });
        },

        getGitStatus: function () {
            function unquote(str) {
                if (str[0] === "\"" && str[str.length - 1] === "\"") {
                    str = str.substring(1, str.length - 1);
                }
                return str;
            }

            return this.executeCommand(this._git + " status -u --porcelain").then(function (stdout) {
                if (stdout.length === 0) {
                    return [];
                }

                var results = [],
                    lines = stdout.split("\n");
                lines.forEach(function (line) {
                    var statusStaged = line.substring(0, 1),
                        statusUnstaged = line.substring(1, 2),
                        status = [],
                        file = unquote(line.substring(3));

                    switch (statusStaged) {
                    case " ":
                        break;
                    case "?":
                        status.push(FILE_STATUS.UNTRACKED);
                        break;
                    case "A":
                        status.push(FILE_STATUS.STAGED, FILE_STATUS.NEWFILE);
                        break;
                    case "D":
                        status.push(FILE_STATUS.STAGED, FILE_STATUS.DELETED);
                        break;
                    case "M":
                        status.push(FILE_STATUS.STAGED, FILE_STATUS.MODIFIED);
                        break;
                    case "R":
                        status.push(FILE_STATUS.STAGED, FILE_STATUS.RENAMED);
                        break;
                    default:
                        throw new Error("Unexpected status: " + statusStaged);
                    }

                    switch (statusUnstaged) {
                    case " ":
                        break;
                    case "?":
                        status.push(FILE_STATUS.UNTRACKED);
                        break;
                    case "D":
                        status.push(FILE_STATUS.DELETED);
                        break;
                    case "M":
                        status.push(FILE_STATUS.MODIFIED);
                        break;
                    default:
                        throw new Error("Unexpected status: " + statusStaged);
                    }

                    results.push({
                        status: uniqSorted(status),
                        file: file,
                        name: file.substring(file.lastIndexOf("/") + 1)
                    });
                });
                return results.sort(function (a, b) {
                    if (a.file < b.file) {
                        return -1;
                    }
                    if (a.file > b.file) {
                        return 1;
                    }
                    return 0;
                });
            });
        },

        gitAdd: function (file, updateIndex) {
            var cmd = this._git + " add ";
            if (updateIndex) {
                cmd += "-u ";
            }
            cmd += "\"" + file + "\"";
            return this.executeCommand(cmd);
        },

        gitUndoFile: function (file) {
            return this.executeCommand(this._git + " checkout \"" + file + "\"");
        },

        gitCommit: function (message, amend) {
            var self = this,
                lines = message.split("\n");

            var cmd = self._git + " commit";
            if (amend) { cmd += " --amend --reset-author"; }

            if (lines.length === 1) {
                return self.executeCommand(cmd + " -m " + escapeShellArg(message));
            } else {
                // TODO: maybe use git commit --file=-
                var result = q.defer(),
                    fileEntry = FileSystem.getFileForPath(ProjectManager.getProjectRoot().fullPath + ".bracketsGitTemp");
                q.when(FileUtils.writeText(fileEntry, message)).then(function () {
                    return self.executeCommand(cmd + " -F .bracketsGitTemp");
                }).then(function (res) {
                    fileEntry.unlink(function () {
                        result.resolve(res);
                    });
                }).fail(function (err) {
                    fileEntry.unlink(function () {
                        result.reject(err);
                    });
                });
                return result.promise;
            }
        },

        gitReset: function () {
            return this.executeCommand(this._git + " reset");
        },

        gitDiff: function (file) {
            return this.executeCommand(this._git + " diff --no-color -U0 \"" + file + "\"");
        },

        gitDiffSingle: function (file) {
            return this.executeCommand(this._git + " diff --no-color \"" + file + "\"");
        },

        gitDiffStaged: function () {
            return this.executeCommand(this._git + " diff --no-color --staged");
        },

        gitPush: function (remote) {
            remote = remote || "";
            return this.executeCommand(this._git + " push " + escapeShellArg(remote) + " --porcelain");
        },

        gitPushUpstream: function (upstream, branch) {
            return this.executeCommand(this._git + " push --porcelain --set-upstream " + upstream + " " + branch);
        },

        gitPull: function (remote) {
            remote = remote || "";
            return this.executeCommand(this._git + " pull --ff-only " + escapeShellArg(remote));
        },

        gitInit: function () {
            return this.executeCommand(this._git + " init");
        },

        gitClone: function (remoteGitUrl, destinationFolder) {
            return this.executeCommand(this._git + " clone " + escapeShellArg(remoteGitUrl) + " " + escapeShellArg(destinationFolder));
        },

        gitHistory: function (branch) {
            return this.executeCommand(this._git + " log " + branch + " --format=\"%h_._%an_._%ai_._%s\"").then(function (stdout) {
                return stdout.length === 0 ? [] : stdout.split("\n").map(function (line) {
                    var data = line.split("_._");
                    return {
                        hash: data[0].trim(),
                        author: data[1].trim(),
                        date: data[2].trim(),
                        message: data[3].trim()
                    };
                });
            });
        },

        getFilesFromCommit: function (hash) {
            return this.executeCommand(this._git + " diff --name-only " + hash + "~ " + hash).then(function (stdout) {
                return stdout.length === 0 ? [] : stdout.split("\n");
            });
        },

        getDiffOfFileFromCommit: function (hash, file) {
            return this.executeCommand(this._git + " diff --no-color " + hash + "~ " + hash + " " + file);
        },

        remoteAdd: function (remote, url) {
            return this.executeCommand(this._git + " remote add " + escapeShellArg(remote) + " " + escapeShellArg(url));
        }

    };

    module.exports = GitControl;
});
