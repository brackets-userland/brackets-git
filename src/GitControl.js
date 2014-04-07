/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define */

define(function (require, exports, module) {
    "use strict";

    var _               = brackets.getModule("thirdparty/lodash"),
        Promise         = require("bluebird"),
        Utils           = require("src/Utils"),
        ErrorHandler    = require("./ErrorHandler"),
        ExpectedError   = require("./ExpectedError"),
        Preferences     = require("./Preferences"),
        md5             = require("thirdparty/md5"),
        marked          = require("marked");

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

            self.options.handler(method, cmd, args, opts)
                .progressed(function () {
                    promise.progress.apply(promise, arguments);
                })
                .then(function (result) {
                    promise.resolve(result);
                    self._isHandlerRunning = false;
                    self._processQueue();
                })
                .catch(function (ex) {
                    promise.reject(ex);
                    self._isHandlerRunning = false;
                    self._processQueue();
                });
        },

        _pushToQueue: function (method, cmd, args, opts) {
            if (!args) { args = []; }
            if (!opts) { opts = {}; }
            if (typeof args === "string") { args = [args]; }

            var rv = Promise.defer();
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

        chmodTerminalScript: function () {
            var file = Utils.getExtensionDirectory() + "shell/" +
                    (brackets.platform === "mac" ? "terminal.osa" : "terminal.sh");
            return this.executeCommand("chmod", [
                "+x",
                escapeShellArg(file)
            ]);
        },

        terminalOpen: function (folder, customCmd, customArgs) {
            var cmd,
                args,
                opts = {
                timeout: 1, // 1 second
                timeoutExpected: true
            };
            if (customCmd) {
                cmd = customCmd;
                args = customArgs.split(" ").map(function (arg) {
                    return arg.replace("$1", escapeShellArg(normalizeUncUrls(folder)));
                });
            } else {
                if (brackets.platform === "win") {
                    var msysgitFolder = Preferences.get("gitPath").split("\\");
                    msysgitFolder.splice(-2, 2, "Git Bash.vbs");
                    cmd = msysgitFolder.join("\\");
                } else if (brackets.platform === "mac") {
                    cmd = Utils.getExtensionDirectory() + "shell/terminal.osa";
                } else {
                    cmd = Utils.getExtensionDirectory() + "shell/terminal.sh";
                }
                args = [escapeShellArg(folder)];
            }
            return this.executeCommand(cmd, args, opts).catch(function (err) {
                if (ErrorHandler.isTimeout(err)) {
                    // process is running after 1 second timeout so terminal is opened
                    return;
                }
                var pathExecuted = [cmd].concat(args).join(" ");
                throw new Error(err + ": " + pathExecuted);
            });
        },

        getVersion: function () {
            return this.executeCommand(this._git, "--version").then(function (output) {
                var io = output.indexOf("git version");
                return output.substring(io !== -1 ? io + "git version".length : 0).trim();
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

        mergeBranch: function (branchName, mergeMessage) {
            var args = ["merge", "--no-ff"];
            if (mergeMessage && mergeMessage.trim()) {
                args.push("-m", mergeMessage);
            }
            args.push(branchName);
            return this.spawnCommand(this._git, args);
        },

        checkoutBranch: function (branchName) {
            var args = ["checkout", branchName];
            return this.executeCommand(this._git, args, {
                timeout: false // never timeout this
            });
        },

        createBranch: function (branchName, originBranch, trackOrigin) {
            var args = ["checkout", "-b", branchName];

            if (originBranch) {
                if (trackOrigin) {
                    args.push("--track");
                }
                args.push(originBranch);
            }

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
            }).catch(function (stderr) {
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
