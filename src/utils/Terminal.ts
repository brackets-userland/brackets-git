import { _, platform } from "../brackets-modules";
import * as Cli from "../Cli";
import * as ErrorHandler from "../ErrorHandler";
import * as Events from "../Events";
import EventEmitter from "../EventEmitter";
import ExpectedError from "../ExpectedError";
import * as Preferences from "../Preferences";
import * as Promise from "bluebird";
import * as Utils from "../Utils";

// Converts UNC (Samba) urls from `//server/` to `\\server\`
function normalizeUncUrls(url) {
    return url.substring(0, 1) === "//" && platform === "win" ? url.replace("/", "\\") : url;
}

function chmodTerminalScript(allowExec) {
    const files = platform === "mac" ? [
        // mac
        "terminal.osa",
        "iterm.osa"
    ] : [
        // linux
        "terminal.sh"
    ];

    const args = [allowExec ? "+x" : "-x"].concat(files.map((file) => {
        return Cli.escapeShellArg(Utils.getExtensionDirectory() + "shell/" + file);
    }));

    return Cli.executeCommand("chmod", args);
}

function open(event?: string) {
    const folder = Utils.getProjectRoot();
    const customCmd = Preferences.get("terminalCommand");
    const customArgs = Preferences.get("terminalCommandArgs");

    let cmd = customCmd;
    const args = customArgs ? customArgs.split(" ").map((arg) => {
        return arg.replace("$1", Cli.escapeShellArg(normalizeUncUrls(folder)));
    }) : [];
    const opts = { timeout: false };

    if (platform === "mac" && cmd.match(/\.osa$/)) {
        args.unshift(Cli.escapeShellArg(cmd));
        cmd = "osascript";
    }

    return Cli.executeCommand(cmd, args, opts).catch((err) => {
        if (ErrorHandler.isTimeout(err)) {
            // process is running after 1 second timeout so terminal is opened
            return;
        }
        const pathExecuted = [cmd].concat(args).join(" ");
        throw new Error(err + ": " + pathExecuted);
    }).catch((err) => {
        if (event !== "retry" && ErrorHandler.contains(err, "Permission denied")) {
            chmodTerminalScript(true).catch((chmodErr) => {
                throw ErrorHandler.showError(chmodErr, "Failed to open terminal");
            }).then(() => {
                open("retry");
            });
            return;
        }
        ErrorHandler.showError(err, "Failed to open terminal");
    });
}

const setup = _.once(() => {
    return new Promise((resolve) => {

        let paths = [Preferences.get("terminalCommand")];

        if (platform === "win") {
            paths.push("C:\\Program Files (x86)\\Git\\Git Bash.vbs");
            paths.push("C:\\Program Files\\Git\\Git Bash.vbs");
            paths.push("C:\\Program Files (x86)\\Git\\git-bash.exe");
            paths.push("C:\\Program Files\\Git\\git-bash.exe");
        } else if (platform === "mac") {
            paths.push(Utils.getExtensionDirectory() + "shell/terminal.osa");
        } else {
            paths.push(Utils.getExtensionDirectory() + "shell/terminal.sh");
        }

        paths = _.unique(paths);

        const results = [];
        const finish = _.after(paths.length, () => {

            if (!results[0]) {
                // configuration is not set to something meaningful
                const validPaths = _.compact(results);
                if (validPaths.length === 0) {
                    // nothing meaningful found, so restore default configuration
                    Preferences.set("terminalCommand", paths[1]);
                    Preferences.set("terminalCommandArgs", "$1");
                    resolve(false);
                    return;
                }
                Preferences.set("terminalCommand", validPaths[0]);
                if (/git-bash\.exe$/.test(validPaths[0])) {
                    Preferences.set("terminalCommandArgs", "--cd=$1");
                } else {
                    Preferences.set("terminalCommandArgs", "$1");
                }
            } else {
                Preferences.set("terminalCommand", results[0]);
            }
            resolve(true);

        });

        // verify if these paths exist
        paths.forEach((path, index) => {
            if (!path) {
                results[index] = null;
                finish();
                return;
            }
            Cli.which(path).then((_path) => {
                results[index] = _path;
            }).catch(() => {
                results[index] = null;
            }).finally(() => {
                finish();
            });
        });

    }).then((result) => {
        // my mac yosemite will actually fail if the scripts are executable!
        // so do -x here and then do +x when permission denied is encountered
        // TODO: explore linux/ubuntu behaviour
        if (platform === "mac") {
            return chmodTerminalScript(false).then(() => result);
        }
        return result;
    });
});

// Event subscriptions
EventEmitter.on(Events.TERMINAL_OPEN, () => {
    setup()
        .then((configuredOk) => {
            if (configuredOk) {
                open();
            } else {
                throw new ExpectedError(
                    "Terminal configuration invalid, restoring defaults. Restart Brackets to apply."
                );
            }
        })
        .catch((err) => {
            // disable the button for this session
            EventEmitter.emit(Events.TERMINAL_DISABLE);
            ErrorHandler.showError(err, "Error setting up the terminal");
        });
});
