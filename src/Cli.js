define(function (require, exports, module) {

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection = brackets.getModule("utils/NodeConnection");

    var Promise       = require("bluebird"),
        Strings       = require("strings"),
        ErrorHandler  = require("src/ErrorHandler"),
        Preferences   = require("src/Preferences"),
        Utils         = require("src/Utils");

    var moduleDirectory   = ExtensionUtils.getModulePath(module),
        domainModulePath  = moduleDirectory + "Domains/cli",
        debugOn           = Preferences.get("debugMode"),
        TIMEOUT_VALUE     = Preferences.get("TIMEOUT_VALUE"),
        domainName        = "brackets-git",
        extName           = "[brackets-git] ",
        nodeConnection    = new NodeConnection(),
        nextCliId         = 0;

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
        $(nodeConnection)
            .off(EVENT_NAMESPACE)
            .on(domainName + ":progress" + EVENT_NAMESPACE, function (err, cliId, time, message) {
                console.log("progress(" + cliId + "): " + message);
            });
    }

    // return true/false to state if wasConnected before
    function connectToNode() {
        return new Promise(function (resolve, reject) {
            if (nodeConnection.connected()) {
                return resolve(true);
            }
            // we don't want automatic reconnections as we handle the reconnect manually
            nodeConnection.connect(false).then(function () {
                nodeConnection.loadDomains([domainModulePath], false).then(function () {
                    attachEventHandlers();
                    resolve(false);
                }).fail(function (err) { // jQuery promise - .fail is fine
                    reject(err);
                });
            }).fail(function (err) { // jQuery promise - .fail is fine
                reject(err);
            });
        });
    }

    function normalizePathForOs(path) {
        if (brackets.platform === "win") {
            path = path.replace(/\//g, "\\");
        }
        return path;
    }

    // this functions prevents sensitive info from going further (like http passwords)
    function sanitizeOutput(str) {
        if (typeof str === "string") {
            str = str.replace(/(https?:\/\/)([^:@\s]*):([^:@]*)?@/g, function (a, protocol, user/*, pass*/) {
                return protocol + user + ":***@";
            });
        } else {
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

        var msg = extName + "cmd-" + method + "-" + type + " (" + processInfo.join(";") + ")";
        if (out) { msg += ": \"" + out + "\""; }
        console.log(msg);
    }

    function cliHandler(method, cmd, args, opts) {
        return new Promise(function (resolve, reject) {
            opts = opts || {};

            // it is possible to set a custom working directory in options
            // otherwise the current project root is used to execute commands
            if (opts.cwd) { opts.customCwd = true; }
            else { opts.cwd = Utils.getProjectRoot(); }

            // convert paths like c:/foo/bar to c:\foo\bar on windows
            opts.cwd = normalizePathForOs(opts.cwd);

            // execute commands have to be escaped, spawn does this automatically and will fail if cmd is escaped
            if (method === "execute") {
                cmd = "\"" + cmd + "\"";
            }

            // log all cli communication into console when debug mode is on
            if (debugOn) {
                var startTime = (new Date()).getTime();
                console.log(extName + "cmd-" + method + ": " + (opts.customCwd ? opts.cwd + "\\" : "") + cmd + " " + args.join(" "));
            }

            // we connect to node (promise is returned immediately if we are already connected)
            connectToNode().then(function (wasConnected) {

                var domainOpts = {
                    cliId: getNextCliId(),
                    watchProgress: args.indexOf("--progress") !== -1
                };

                var debugInfo = {
                    startTime: startTime,
                    wasConnected: wasConnected
                };

                var resolved = false;
                // nodeConnection returns jQuery deffered
                nodeConnection.domains[domainName][method](opts.cwd, cmd, args, domainOpts)
                    .fail(function (err) { // jQuery promise - .fail is fine
                        if (!resolved) {
                            err = sanitizeOutput(err);
                            if (debugOn) {
                                logDebug(domainOpts, debugInfo, method, "fail", err);
                            }
                            reject(err);
                        }
                    })
                    .then(function (out) {
                        if (!resolved) {
                            out = sanitizeOutput(out);
                            if (debugOn) {
                                logDebug(domainOpts, debugInfo, method, "out", out);
                            }
                            resolve(out);
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

                    reject(err);
                    resolved = true;
                }

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
                            } else {
                                // we don't have any custom handler, so just kill the promise here
                                // note that command WILL keep running in the background
                                // so even when timeout occurs, operation might finish after it
                                timeoutPromise();
                            }
                        }
                    }, opts.timeout ? (opts.timeout * 1000) : TIMEOUT_VALUE);
                }

                // when opts.timeout === false then never timeout the process
                if (opts.timeout !== false) {
                    timeoutCall();
                }

            }).catch(function (err) {
                // failed to connect to node for some reason
                ErrorHandler.showError(err, Strings.ERROR_CONNECT_NODEJS);
            });
        });
    }

    function executeCommand(cmd, args, opts) {
        return cliHandler("execute", cmd, args, opts);
    }

    function spawnCommand(cmd, args, opts) {
        return cliHandler("spawn", cmd, args, opts);
    }

    // Public API
    exports.cliHandler = cliHandler;
    exports.executeCommand = executeCommand;
    exports.spawnCommand = spawnCommand;

});
