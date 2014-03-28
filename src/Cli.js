define(function (require, exports, module) {

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection = brackets.getModule("utils/NodeConnection");

    var Promise       = require("bluebird"),
        ErrorHandler  = require("src/ErrorHandler"),
        Preferences   = require("src/Preferences"),
        Utils         = require("src/Utils");

    var moduleDirectory   = ExtensionUtils.getModulePath(module),
        domainModulePath  = moduleDirectory + "Domains/cli",
        debugOn           = Preferences.get("debugMode"),
        TIMEOUT_VALUE     = Preferences.get("TIMEOUT_VALUE"),
        extName           = "[brackets-git] ",
        nodeConnection    = new NodeConnection();

    // return true/false to state if wasConnected before
    function connectToNode() {
        return new Promise(function (resolve, reject) {
            if (nodeConnection.connected()) {
                return resolve(true);
            }
            // we don't want automatic reconnections as we handle the reconnect manually
            nodeConnection.connect(false).then(function () {
                nodeConnection.loadDomains([domainModulePath], false).then(function () {
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

    function logDebug(startTime, wasConnected, method, type, out) {
        var duration = ((new Date()).getTime() - startTime) + "ms";
        if (!wasConnected) { duration += "+conn"; }
        var msg = extName + "cmd-" + method + "-" + type + " (" + duration + ")";
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

                var resolved = false;
                // nodeConnection returns jQuery deffered
                nodeConnection.domains["brackets-git"][method](opts.cwd, cmd, args)
                    .fail(function (err) { // jQuery promise - .fail is fine
                        if (!resolved) {
                            err = sanitizeOutput(err);
                            if (debugOn) {
                                logDebug(startTime, wasConnected, method, "fail", err);
                            }
                            reject(err);
                        }
                    })
                    .then(function (out) {
                        if (!resolved) {
                            out = sanitizeOutput(out);
                            if (debugOn) {
                                logDebug(startTime, wasConnected, method, "out", out);
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
                        logDebug(startTime, wasConnected, method, "timeout");
                    }
                    var err = new Error("cmd-" + method + "-timeout: " + cmd + " " + args.join(" "));
                    if (!opts.timeoutExpected) {
                        ErrorHandler.logError(err);
                    }
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
                ErrorHandler.showError(err, "Failed to connect to Node.js");
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
