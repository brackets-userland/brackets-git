/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define */

define(function (require, exports, module) {
    "use strict";

    var _               = brackets.getModule("thirdparty/lodash"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        q               = require("../thirdparty/q"),
        ExpectedError   = require("./ExpectedError"),
        Preferences     = require("./Preferences");

    var FILE_STATUS = {
        STAGED: "FILE_STAGED",
        NEWFILE: "FILE_NEWFILE",
        MODIFIED: "FILE_MODIFIED",
        DELETED: "FILE_DELETED",
        RENAMED: "FILE_RENAMED",
        UNTRACKED: "FILE_UNTRACKED",
        UNMERGED: "FILE_UNMERGED"
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
        if (typeof str !== "string") {
            throw new Error("escapeShellArg argument is not a string: " + typeof str);
        }
        if (str.length === 0) {
            return str;
        }
        if (brackets.platform !== "win") {
            // http://steve-parker.org/sh/escape.shtml
            str = str.replace(/["$`\\]/g, function (m) {
                return "\\" + m;
            });
            return "\"" + str + "\"";
        } else {
            // http://stackoverflow.com/questions/7760545/cmd-escape-double-quotes-in-parameter
            str = str.replace(/"/g, function () {
                return "\"\"\"";
            });
            return "\"" + str + "\"";
        }
    }

    // Converts UNC (Samba) urls from `//server/` to `\\server\`
    function normalizeUncUrls(url) {
        return (url.substring(0, 1) === "//" && brackets.platform === "win") ? url.replace("/", "\\") : url;
    }

    function GitControl(options) {
        this._isHandlerRunning = false;
        this._queue = [];
        this.options = options;

        if (Preferences.get("gitIsInSystemPath")) {
            this._git = "git";
        } else {
            this._git = Preferences.get("gitPath");
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
                var cmd = Preferences.get("msysgitPath") + "bin\\sh.exe";
                return this.executeCommand(cmd, ["--version"]);
            } else {
                return q().thenReject();
            }
        },

        bashOpen: function (folder) {
            if (brackets.platform === "win") {
                var cmd = Preferences.get("msysgitPath") + "Git Bash.vbs";
                return this.executeCommand(cmd, [normalizeUncUrls(folder)]);
            } else {
                return q().thenReject();
            }
        },

        chmodTerminalScript: function () {
            var file = Preferences.get("extensionDirectory") + "shell/" +
                    (brackets.platform === "mac" ? "terminal.osa" : "terminal.sh");
            return this.executeCommand("chmod", [
                "+x",
                escapeShellArg(file)
            ]);
        },

        terminalOpen: function (folder, customCmd) {
            var cmd,
                args,
                opts = {
                timeout: 1,
                timeoutExpected: true
            };
            if (customCmd) {
                customCmd = customCmd.replace("$1", escapeShellArg(folder));
                args = customCmd.split(" ");
                cmd = args.shift();
            } else {
                cmd = Preferences.get("extensionDirectory") + "shell/" + (brackets.platform === "mac" ? "terminal.osa" : "terminal.sh");
                args = [escapeShellArg(folder)];
            }
            return this.executeCommand(cmd, args, opts);
        },

        getVersion: function () {
            return this.executeCommand(this._git, "--version").then(function (output) {
                var io = output.indexOf("git version");
                return output.substring(io !== -1 ? io + "git version".length : 0).trim();
            });
        },

        getRepositoryRoot: function () {
            var self = this;
            return this.executeCommand(this._git, ["rev-parse", "--show-toplevel"]).then(function (output) {
                // Git returns directory name without trailing slash
                if (output.length > 0) { output = output.trim() + "/"; }
                // Check if it's a cygwin installation.
                if (brackets.platform === "win" && output[0] === "/") {
                    // Convert to Windows path with cygpath.
                    var cygpath = Preferences.get("msysgitPath") + "\\bin\\cygpath",
                        cygpathArgs = ["-m", escapeShellArg(output)];
                    return self.executeCommand(cygpath, cygpathArgs).then(function (output) {
                        return output;
                    });
                }
                return output;
            });
        },

        getCommitsAhead: function () {
            var args = [
                "rev-list",
                "HEAD",
                "--not",
                "--remotes"
            ];
            return this.executeCommand(this._git, args).then(function (stdout) {
                return !stdout ? [] : stdout.split("\n");
            });
        },

        getLastCommitMessage: function () {
            var args = [
                "log",
                "-1",
                "--pretty=%B"
            ];
            return this.executeCommand(this._git, args).then(function (output) {
                return output.trim();
            });
        },

        getBranchName: function () {
            var args = [
                "rev-parse",
                "--abbrev-ref",
                "HEAD"
            ];
            return this.executeCommand(this._git, args);
        },

        getGitConfig: function (str) {
            var args = [
                "config",
                str.replace(/\s/g, "")
            ];
            return this.executeCommand(this._git, args);
        },

        setGitConfig: function (str, val) {
            var args = [
                "config",
                str.replace(/\s/g, ""),
                escapeShellArg(val)
            ];
            return this.executeCommand(this._git, args);
        },

        getBranches: function () {
            var args = [
                "branch"
            ];
            return this.executeCommand(this._git, args).then(function (stdout) {
                return stdout.split("\n").map(function (l) {
                    return l.trim();
                });
            });
        },

        checkoutBranch: function (branchName) {
            var args = ["checkout", branchName];
            return this.executeCommand(this._git, args);
        },

        createBranch: function (branchName) {
            var args = ["checkout", "-b", branchName];
            return this.executeCommand(this._git, args);
        },

        deleteLocalBranch: function (branchName) {
            var args = ["branch", "-d", branchName];
            return this.executeCommand(this._git, args);
        },

        getRemotes: function () {
            var args = ["remote", "-v"];
            return this.executeCommand(this._git, args).then(function (stdout) {
                return !stdout ? [] : _.uniq(stdout.replace(/\((push|fetch)\)/g, "").split("\n")).map(function (l) {
                    var s = l.trim().split("\t");
                    return {
                        name: s[0],
                        url: s[1]
                    };
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

            var args = ["status", "-u", "--porcelain"];
            return this.executeCommand(this._git, args).then(function (stdout) {
                if (!stdout) {
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
                    case "U":
                        status.push(FILE_STATUS.UNMERGED);
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
                    case "U":
                        status.push(FILE_STATUS.UNMERGED);
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
            var args = ["add"];
            if (updateIndex) { args.push("-u"); }
            args.push(escapeShellArg(file));
            return this.executeCommand(this._git, args);
        },

        gitUndoFile: function (file) {
            var args = [
                "checkout",
                escapeShellArg(file)
            ];
            return this.executeCommand(this._git, args);
        },

        gitCommit: function (message, amend) {
            var self = this,
                lines = message.split("\n");

            var args = ["commit"];
            if (amend) {
                args.push("--amend", "--reset-author");
            }

            if (lines.length === 1) {
                args.push("-m", escapeShellArg(message));
                return self.executeCommand(self._git, args);
            } else {
                // TODO: maybe use git commit --file=-
                var result = q.defer(),
                    fileEntry = FileSystem.getFileForPath(ProjectManager.getProjectRoot().fullPath + ".bracketsGitTemp");
                q.when(FileUtils.writeText(fileEntry, message)).then(function () {
                    args.push("-F", ".bracketsGitTemp");
                    return self.executeCommand(self._git, args);
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
            return this.executeCommand(this._git, ["reset"]);
        },

        gitDiff: function (file) {
            var args = [
                "diff",
                "--no-color",
                "-U0",
                escapeShellArg(file)
            ];
            return this.executeCommand(this._git, args);
        },

        gitDiffSingle: function (file) {
            var args = [
                "diff",
                "--no-color",
                escapeShellArg(file)
            ];
            return this.executeCommand(this._git, args);
        },

        gitDiffStaged: function () {
            var args = [
                "diff",
                "--no-color",
                "--staged"
            ];
            return this.executeCommand(this._git, args);
        },

        gitDiffStagedFiles: function () {
            var args = [
                "diff",
                "--no-color",
                "--staged",
                "--name-only"
            ];
            return this.executeCommand(this._git, args);
        },

        gitPush: function (remote, branch, options) {
            remote = remote || "";
            branch = branch || "";

            var args = ["push", "--porcelain"];

            if (Array.isArray(options)) {
                args = args.concat(options);
            }

            if (remote) {
                args.push(escapeShellArg(remote));
                if (branch) {
                    args.push(escapeShellArg(branch));
                }
            }

            return this.executeCommand(this._git, args);
        },

        gitPushSetUpstream: function (remote, branch) {
            return this.gitPush(remote, branch, ["--set-upstream"]);
        },

        gitPull: function (remote) {
            var args = ["pull", "--ff-only"];
            if (remote) {
                args.push(escapeShellArg(remote));
            }
            return this.executeCommand(this._git, args);
        },

        gitInit: function () {
            return this.executeCommand(this._git, ["init"]);
        },

        gitClone: function (remoteGitUrl, destinationFolder) {
            var args = [
                "clone",
                escapeShellArg(remoteGitUrl),
                escapeShellArg(destinationFolder)
            ];
            return this.executeCommand(this._git, args);
        },

        gitHistory: function (branch, skipCommits) {
            var separator = "_._",
                items  = ["hashShort", "hash", "author", "date", "message"],
                format = ["%h",        "%H",   "%an",    "%ai",  "%s"     ].join(separator);

            var args = ["log", "-100"];
            if (skipCommits) { args.push("--skip=" + skipCommits); }
            args.push("--format=" + escapeShellArg(format));
            args.push(escapeShellArg(branch));

            return this.executeCommand(this._git, args).then(function (stdout) {
                return !stdout ? [] : stdout.split("\n").map(function (line) {
                    var result = {},
                        data = line.split(separator);
                    items.forEach(function (name, i) {
                        result[name] = data[i];
                    });
                    return result;
                });
            });
        },

        getFilesFromCommit: function (hash) {
            var args = [
                "diff",
                "--name-only",
                escapeShellArg(hash + "^!")
            ];
            return this.executeCommand(this._git, args).then(function (stdout) {
                return !stdout ? [] : stdout.split("\n");
            });
        },

        getDiffOfFileFromCommit: function (hash, file) {
            var args = ["diff", "--no-color", escapeShellArg(hash + "^!"), "--", escapeShellArg(file)];
            return this.executeCommand(this._git, args);
        },

        remoteAdd: function (remote, url) {
            var args = ["remote", "add", escapeShellArg(remote), escapeShellArg(url)];
            return this.executeCommand(this._git, args);
        },

        remoteRemove: function (remote) {
            var args = ["remote", "rm", escapeShellArg(remote)];
            return this.executeCommand(this._git, args);
        },

        getBlame: function (file, from, to) {
            var args = ["blame", "-w", "--line-porcelain"];
            if (from || to) { args.push("-L" + from + "," + to); }
            args.push(file); // spawnCommand doesn't need arguments escaped
            return this.spawnCommand(this._git, args).then(function (stdout) {
                if (!stdout) { return []; }

                var sep  = "-@-BREAK-HERE-@-",
                    sep2 = "$$#-#$BREAK$$-$#";
                stdout = stdout.replace(sep, sep2)
                               .replace(/^\t(.*)$/gm, function (a, b) { return b + sep; });

                return stdout.split(sep).reduce(function (arr, lineInfo) {
                    lineInfo = lineInfo.replace(sep2, sep).trimLeft();
                    if (!lineInfo) { return arr; }

                    var obj = {},
                        lines = lineInfo.split("\n"),
                        firstLine = _.first(lines).split(" ");

                    obj.hash = firstLine[0];
                    obj.num = firstLine[2];
                    obj.content = _.last(lines);

                    // process all but first and last lines
                    for (var i = 1, l = lines.length - 1; i < l; i++) {
                        var line = lines[i],
                            io = line.indexOf(" "),
                            key = line.substring(0, io),
                            val = line.substring(io + 1);
                        obj[key] = val;
                    }

                    arr.push(obj);
                    return arr;
                }, []);
            }).fail(function (stderr) {
                var m = stderr.match(/no such path (\S+)/);
                if (m) {
                    throw new ExpectedError("File is not tracked by Git: " + m[1]);
                }
                throw stderr;
            });
        },

        setUserName: function (userName) {
            return this.setGitConfig("user.name", userName);
        },

        setUserEmail: function (userEmail) {
            return this.setGitConfig("user.email", userEmail);
        },

        undoLastLocalCommit: function () {
            var args = ["reset", "--soft", "HEAD~1"];
            return this.executeCommand(this._git, args);
        }

    };

    module.exports = GitControl;
});
