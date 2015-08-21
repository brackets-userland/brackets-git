define(function (require, exports, module) {

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection = brackets.getModule("utils/NodeConnection");

    var Promise       = require("bluebird"),
        Strings       = require("strings"),
        ErrorHandler  = require("src/ErrorHandler"),
        ExpectedError = require("src/ExpectedError"),
        Preferences   = require("src/Preferences"),
        Utils         = require("src/Utils");

    var moduleDirectory   = ExtensionUtils.getModulePath(module),
        domainModulePath  = moduleDirectory + "domains/cli",
        debugOn           = Preferences.get("debugMode"),
        gitTimeout        = Preferences.get("gitTimeout") * 1000,
        domainName        = "brackets-git",
        nodeConnection    = new NodeConnection(),
        nextCliId         = 0,
        deferredMap       = {};

    // Constants
    var MAX_COUNTER_VALUE = 4294967295; // 2^32 - 1
    var EVENT_NAMESPACE   = ".bracketsGitEvent";

    function getNextCliId() {
        if (nextCliId >= MAX_COUNTER_VALUE) {
            nextCliId = 0;
        }
        return ++nextCliId;
    }

    function attachEventHandlers() {
        nodeConnection
            .off(EVENT_NAMESPACE)
            .on(domainName + ":progress" + EVENT_NAMESPACE, function (err, cliId, time, message) {
                var deferred = deferredMap[cliId];
                if (deferred && !deferred.isResolved()) {
                    deferred.progress(message);
                } else {
                    ErrorHandler.logError("Progress sent for a non-existing process(" + cliId + "): " + message);
                }
            });
    }

    var connectPromise = null;

    // return true/false to state if wasConnected before
    function connectToNode() {
        if (connectPromise) {
            return connectPromise;
        }

        connectPromise = new Promise(function (resolve, reject) {
            if (nodeConnection.connected()) {
                return resolve(true);
            }
            // we don't want automatic reconnections as we handle the reconnect manually
            nodeConnection.connect(false).then(function () {
                nodeConnection.loadDomains([domainModulePath], false).then(function () {
                    attachEventHandlers();
                    resolve(false);
                }).fail(function (err) { // jQuery promise - .fail is fine
                    reject(ErrorHandler.toError(err));
                });
            }).fail(function (err) { // jQuery promise - .fail is fine
                if (ErrorHandler.contains(err, "Max connection attempts reached")) {
                    Utils.consoleLog("Max connection attempts reached, trying again.", "warn");
                    // try again
                    connectPromise = null;
                    connectToNode()
                        .then(function (result) { resolve(result); })
                        .catch(function (err) { reject(err); });
                    return;
                }
                reject(ErrorHandler.toError(err));
            });
        });

        connectPromise.finally(function () {
            connectPromise = null;
        });

        return connectPromise;
    }

    function normalizePathForOs(path) {
        if (brackets.platform === "win") {
            path = path.replace(/\//g, "\\");
        }
        return path;
    }

    // this functions prevents sensitive info from going further (like http passwords)
    function sanitizeOutput(str) {
        if (typeof str !== "string") {
            if (str != null) { // checks for both null & undefined
                str = str.toString();
            } else {
                str = "";
            }
        }
        return str;
    }

    function logDebug(opts, debugInfo, method, type, out) {
        var processInfo = [];

        var duration = (new Date()).getTime() - debugInfo.startTime;
        processInfo.push(duration + "ms");

        if (!debugInfo.wasConnected) {
            processInfo.push("+conn");
        }

        if (opts.cliId) {
            processInfo.push("ID=" + opts.cliId);
        }

        var msg = "cmd-" + method + "-" + type + " (" + processInfo.join(";") + ")";
        if (out) { msg += ": \"" + out + "\""; }
        Utils.consoleDebug(msg);
    }

    function cliHandler(method, cmd, args, opts, retry) {
        var cliId     = getNextCliId(),
            deferred  = Promise.defer();

        deferredMap[cliId] = deferred;
        args = args || [];
        opts = opts || {};

        var watchProgress = args.indexOf("--progress") !== -1;

        // it is possible to set a custom working directory in options
        // otherwise the current project root is used to execute commands
        if (!opts.cwd) {
            opts.cwd = Preferences.get("currentGitRoot") || Utils.getProjectRoot();
        }

        // convert paths like c:/foo/bar to c:\foo\bar on windows
        opts.cwd = normalizePathForOs(opts.cwd);

        // log all cli communication into console when debug mode is on
        if (debugOn) {
            var startTime = (new Date()).getTime();
            Utils.consoleDebug("cmd-" + method + (watchProgress ? "-watch" : "") + ": " +
                               opts.cwd + " -> " +
                               cmd + " " + args.join(" "));
        }

        // we connect to node (promise is returned immediately if we are already connected)
        connectToNode().catch(function (err) {
            // failed to connect to node for some reason
            throw ErrorHandler.showError(new ExpectedError(err), Strings.ERROR_CONNECT_NODEJS);
        }).then(function (wasConnected) {

            var resolved      = false,
                timeoutLength = opts.timeout ? (opts.timeout * 1000) : gitTimeout;

            var domainOpts = {
                cliId: cliId,
                watchProgress: watchProgress
            };

            var debugInfo = {
                startTime: startTime,
                wasConnected: wasConnected
            };

            if (watchProgress) {
                deferred.progress("Running command: git " + args.join(" "));
            }

            // nodeConnection returns jQuery deferred
            nodeConnection.domains[domainName][method](opts.cwd, cmd, args, domainOpts)
                .fail(function (err) { // jQuery promise - .fail is fine
                    if (!resolved) {
                        err = sanitizeOutput(err);
                        if (debugOn) {
                            logDebug(domainOpts, debugInfo, method, "fail", err);
                        }
                        delete deferredMap[cliId];

                        err = ErrorHandler.toError(err);

                        // spawn ENOENT error
                        var invalidCwdErr = "spawn ENOENT";
                        if (err.stack && err.stack.indexOf(invalidCwdErr)) {
                            err.message = err.message.replace(invalidCwdErr, invalidCwdErr + " (" + opts.cwd + ")");
                            err.stack = err.stack.replace(invalidCwdErr, invalidCwdErr + " (" + opts.cwd + ")");
                        }

                        // socket was closed so we should try this once again (if not already retrying)
                        if (err.stack && err.stack.indexOf("WebSocket.self._ws.onclose") !== -1 && !retry) {
                            cliHandler(method, cmd, args, opts, true)
                                .then(function (response) {
                                    deferred.resolve(response);
                                })
                                .catch(function (err) {
                                    deferred.reject(err);
                                });
                            return;
                        }

                        deferred.reject(err);
                    }
                })
                .then(function (out) {
                    if (!resolved) {
                        out = sanitizeOutput(out);
                        if (debugOn) {
                            logDebug(domainOpts, debugInfo, method, "out", out);
                        }
                        delete deferredMap[cliId];
                        deferred.resolve(out);
                    }
                })
                .always(function () {
                    resolved = true;
                })
                .done();

            function timeoutPromise() {
                if (debugOn) {
                    logDebug(domainOpts, debugInfo, method, "timeout");
                }
                var err = new Error("cmd-" + method + "-timeout: " + cmd + " " + args.join(" "));
                if (!opts.timeoutExpected) {
                    ErrorHandler.logError(err);
                }

                // process still lives and we need to kill it
                nodeConnection.domains[domainName].kill(domainOpts.cliId)
                    .fail(function (err) {
                        ErrorHandler.logError(err);
                    });

                delete deferredMap[cliId];
                deferred.reject(ErrorHandler.toError(err));
                resolved = true;
            }

            var lastProgressTime = 0;
            function timeoutCall() {
                setTimeout(function () {
                    if (!resolved) {
                        if (typeof opts.timeoutCheck === "function") {
                            Promise.cast(opts.timeoutCheck())
                                .catch(function (err) {
                                    ErrorHandler.logError("timeoutCheck failed: " + opts.timeoutCheck.toString());
                                    ErrorHandler.logError(err);
                                })
                                .then(function (continueExecution) {
                                    if (continueExecution) {
                                        // check again later
                                        timeoutCall();
                                    } else {
                                        timeoutPromise();
                                    }
                                });
                        } else if (domainOpts.watchProgress) {
                            // we are watching the promise progress in the domain
                            // so we should check if the last message was sent in more than timeout time
                            var currentTime = (new Date()).getTime();
                            var diff = currentTime - lastProgressTime;
                            if (diff > timeoutLength) {
                                if (debugOn) {
                                    Utils.consoleDebug("cmd(" + cliId + ") - last progress message was sent " + diff + "ms ago - timeout");
                                }
                                timeoutPromise();
                            } else {
                                if (debugOn) {
                                    Utils.consoleDebug("cmd(" + cliId + ") - last progress message was sent " + diff + "ms ago - delay");
                                }
                                timeoutCall();
                            }
                        } else {
                            // we don't have any custom handler, so just kill the promise here
                            // note that command WILL keep running in the background
                            // so even when timeout occurs, operation might finish after it
                            timeoutPromise();
                        }
                    }
                }, timeoutLength);
            }

            // when opts.timeout === false then never timeout the process
            if (opts.timeout !== false) {
                // if we are watching for progress events, mark the time when last progress was made
                if (domainOpts.watchProgress) {
                    deferred.promise.progressed(function () {
                        lastProgressTime = (new Date()).getTime();
                    });
                }
                // call the method which will timeout the promise after a certain period of time
                timeoutCall();
            }

        }).catch(function (err) {
            throw ErrorHandler.showError(err, "Unexpected error in CLI handler - close all instances of Brackets and start again to reload");
        });

        return deferred.promise;
    }

    function which(cmd) {
        return cliHandler("which", cmd);
    }

    function pathExists(path) {
        return cliHandler("pathExists", path).then(function (response) {
            return typeof response === "string" ? response === "true" : response;
        });
    }

    function spawnCommand(cmd, args, opts) {
        return cliHandler("spawn", cmd, args, opts);
    }

    function executeCommand(cmd, args, opts) {
        return cliHandler("execute", cmd, args, opts);
    }

    // this is to be used together with executeCommand
    // spawnCommand does the escaping automatically
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

    // Public API
    exports.cliHandler      = cliHandler;
    exports.which           = which;
    exports.pathExists      = pathExists;
    exports.executeCommand  = executeCommand;
    exports.spawnCommand    = spawnCommand;
    exports.escapeShellArg  = escapeShellArg;

});
