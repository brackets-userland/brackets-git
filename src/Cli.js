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

    function connectToNode() {
        return new Promise(function (resolve, reject) {
            if (nodeConnection.connected()) {
                return resolve();
            }
            // we don't want automatic reconnections as we handle the reconnect manually
            nodeConnection.connect(false).then(function () {
                nodeConnection.loadDomains([domainModulePath], false).then(function () {
                    resolve();
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
                console.log(extName + "cmd-" + method + ": " + (opts.customCwd ? opts.cwd + "\\" : "") + cmd + " " + args.join(" "));
            }

            // we connect to node (promise is returned immediately if we are already connected)
            connectToNode().then(function () {

                var resolved = false;
                // nodeConnection returns jQuery deffered
                nodeConnection.domains["brackets-git"][method](opts.cwd, cmd, args)
                    .fail(function (err) { // jQuery promise - .fail is fine
                        if (!resolved) {
                            err = sanitizeOutput(err);
                            if (debugOn) { console.log(extName + "cmd-" + method + "-fail: \"" + err + "\""); }
                            reject(err);
                        }
                    })
                    .then(function (out) {
                        if (!resolved) {
                            out = sanitizeOutput(out);
                            if (debugOn) { console.log(extName + "cmd-" + method + "-out: \"" + out + "\""); }
                            resolve(out);
                        }
                    })
                    .always(function () {
                        resolved = true;
                    })
                    .done();

                setTimeout(function () {
                    if (!resolved) {
                        var err = new Error("cmd-" + method + "-timeout: " + cmd + " " + args.join(" "));
                        if (opts.timeoutExpected) {
                            if (debugOn) {
                                console.log(extName + "cmd-" + method + "-timeout: \"" + err + "\"");
                            }
                        } else {
                            ErrorHandler.logError(err);
                        }
                        reject(err);
                        resolved = true;
                    }
                }, opts.timeout ? (opts.timeout * 1000) : TIMEOUT_VALUE);

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
