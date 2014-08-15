define(function (require) {
    "use strict";

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash");

    // Local modules
    var Cli           = require("src/Cli"),
        ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Preferences   = require("src/Preferences"),
        Promise       = require("bluebird"),
        Utils         = require("src/Utils");

    // Templates

    // Module variables

    // Implementation

    // Converts UNC (Samba) urls from `//server/` to `\\server\`
    function normalizeUncUrls(url) {
        return (url.substring(0, 1) === "//" && brackets.platform === "win") ? url.replace("/", "\\") : url;
    }

    function chmodTerminalScript() {
        var file = Utils.getExtensionDirectory() + "shell/" +
                (brackets.platform === "mac" ? "terminal.osa" : "terminal.sh");
        return Cli.executeCommand("chmod", [
            "+x",
            Cli.escapeShellArg(file)
        ]);
    }

    function open(event) {
        var folder = Utils.getProjectRoot(),
            customCmd = Preferences.get("terminalCommand"),
            customArgs = Preferences.get("terminalCommandArgs");

        var cmd,
            args,
            opts = {
                timeout: false
            };

        cmd = customCmd;
        args = customArgs.split(" ").map(function (arg) {
            return arg.replace("$1", Cli.escapeShellArg(normalizeUncUrls(folder)));
        });

        if (brackets.platform === "mac" && cmd.match(/\.osa$/)) {
            args.unshift(Cli.escapeShellArg(cmd));
            cmd = "osascript";
        }

        return Cli.executeCommand(cmd, args, opts).catch(function (err) {
            if (ErrorHandler.isTimeout(err)) {
                // process is running after 1 second timeout so terminal is opened
                return;
            }
            var pathExecuted = [cmd].concat(args).join(" ");
            throw new Error(err + ": " + pathExecuted);
        }).catch(function (err) {
            if (event !== "retry" && ErrorHandler.contains(err, "Permission denied")) {
                chmodTerminalScript().catch(function (err) {
                    throw ErrorHandler.showError(err);
                }).then(function () {
                    open("retry");
                });
                return;
            }
            ErrorHandler.showError(err);
        });
    }

    var setup = _.once(function () {
        return new Promise(function (resolve) {

            var paths = [Preferences.get("terminalCommand")];

            if (brackets.platform === "win") {
                paths.push("C:\\Program Files (x86)\\Git\\Git Bash.vbs");
                paths.push("C:\\Program Files\\Git\\Git Bash.vbs");
            } else if (brackets.platform === "mac") {
                paths.push(Utils.getExtensionDirectory() + "shell/terminal.osa");
            } else {
                paths.push(Utils.getExtensionDirectory() + "shell/terminal.sh");
            }

            paths = _.unique(paths);

            var results = [];
            var finish = _.after(paths.length, function () {

                if (!results[0]) {
                    // configuration is not set to something meaningful
                    var validPaths = _.compact(results);
                    if (validPaths.length === 0) {
                        // nothing meaningful found, so restore default configuration
                        Preferences.set("terminalCommand", paths[1]);
                        Preferences.set("terminalCommandArgs", "$1");
                        // and then disabled the button for this session
                        EventEmitter.emit(Events.TERMINAL_DISABLE, paths[0]);
                        resolve(false);
                        return;
                    }
                    Preferences.set("terminalCommand", validPaths[0]);
                    Preferences.set("terminalCommandArgs", "$1");
                } else {
                    Preferences.set("terminalCommand", results[0]);
                }
                resolve(true);

            });

            // verify if these paths exist
            paths.forEach(function (path, index) {
                if (!path) {
                    results[index] = null;
                    finish();
                    return;
                }
                Cli.which(path).then(function (_path) {
                    results[index] = _path;
                }).catch(function () {
                    results[index] = null;
                }).finally(function () {
                    finish();
                });
            });

        });
    });

    // Event subscriptions
    EventEmitter.on(Events.TERMINAL_OPEN, function () {
        setup().then(function (configuredOk) {
            if (configuredOk) {
                open();
            }
        });
    });

});
