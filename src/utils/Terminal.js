define(function (require) {
    "use strict";

    // Brackets modules

    // Local modules
    var Cli           = require("src/Cli"),
        ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Preferences   = require("src/Preferences"),
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
            timeout: 1, // 1 second
            timeoutExpected: true
        };
        if (customCmd) {
            cmd = customCmd;
            args = customArgs.split(" ").map(function (arg) {
                return arg.replace("$1", Cli.escapeShellArg(normalizeUncUrls(folder)));
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
            args = [Cli.escapeShellArg(folder)];
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
            throw ErrorHandler.showError(err);
        });
    }

    // Event subscriptions
    EventEmitter.on(Events.TERMINAL_OPEN, function () {
        open();
    });

});
