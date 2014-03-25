define(function (require, exports) {

    var Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Preferences   = require("src/Preferences"),
        Utils         = require("src/Utils");

    var q             = require("../thirdparty/q"),
        ErrorHandler  = require("src/ErrorHandler");

    var debugOn         = Preferences.get("debugMode"),
        extName         = "[brackets-git] ",
        TIMEOUT_VALUE   = Preferences.get("TIMEOUT_VALUE"),
        nodeConnection  = null;

    EventEmitter.on(Events.NODE_CONNECTION_READY, function (_conn) {
        nodeConnection = _conn;
    });

    function normalizePathForOs(path) {
        if (brackets.platform === "win") {
            path = path.replace(/\//g, "\\");
        }
        return path;
    }

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
        var rv = q.defer(),
            resolved = false;

        opts = opts || {};
        if (opts.cwd) { opts.customCwd = true; }
        else { opts.cwd = Utils.getProjectRoot(); }

        opts.cwd = normalizePathForOs(opts.cwd);

        if (method === "execute") {
            cmd = "\"" + cmd + "\"";
        }

        if (debugOn) {
            console.log(extName + "cmd-" + method + ": " + (opts.customCwd ? opts.cwd + "\\" : "") + cmd + " " + args.join(" "));
        }

        // nodeConnection returns jQuery deffered, not Q
        nodeConnection.domains["brackets-git"][method](opts.cwd, cmd, args)
            .fail(function (err) {
                if (!resolved) {
                    err = sanitizeOutput(err);
                    if (debugOn) { console.log(extName + "cmd-" + method + "-fail: \"" + err + "\""); }
                    rv.reject(err);
                }
            })
            .then(function (out) {
                if (!resolved) {
                    out = sanitizeOutput(out);
                    if (debugOn) { console.log(extName + "cmd-" + method + "-out: \"" + out + "\""); }
                    rv.resolve(out);
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

                rv.reject(err);
                resolved = true;
            }
        }, opts.timeout ? (opts.timeout * 1000) : TIMEOUT_VALUE);

        return rv.promise;
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
