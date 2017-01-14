import { ExtensionUtils, NodeConnection } from "./brackets-modules";
import * as Promise from "bluebird";
import * as Strings from "strings";
import * as ErrorHandler from "./ErrorHandler";
import ExpectedError from "./ExpectedError";
import * as Preferences from "./Preferences";
import * as Utils from "./Utils";

const debugOn = Preferences.get("debugMode");
const gitTimeout = Preferences.get("gitTimeout") * 1000;
const domainName = "brackets-git";
const nodeConnection = new NodeConnection();
let nextCliId = 0;
const deferredMap = {};

const MAX_COUNTER_VALUE = 4294967295; // 2^32 - 1
const EVENT_NAMESPACE = ".bracketsGitEvent";

function getNextCliId() {
    if (nextCliId >= MAX_COUNTER_VALUE) {
        nextCliId = 0;
    }
    return ++nextCliId;
}

function attachEventHandlers() {
    nodeConnection
        .off(EVENT_NAMESPACE)
        .on(domainName + ":progress" + EVENT_NAMESPACE, (err, cliId, time, message) => {
            if (err) {
                ErrorHandler.logError(`Progress event error: ${err}`);
            }
            const deferred = deferredMap[cliId];
            if (deferred && !deferred.isResolved()) {
                deferred.progress(message);
            } else {
                ErrorHandler.logError("Progress sent for a non-existing process(" + cliId + "): " + message);
            }
        });
}

let connectPromise = null;

// return true/false to state if wasConnected before
function connectToNode() {
    if (connectPromise) {
        return connectPromise;
    }

    const moduleDirectory = Utils.getExtensionDirectory();
    const domainModulePath = moduleDirectory + "dist/node/cli";

    connectPromise = new Promise((resolve, reject) => {
        if (nodeConnection.connected()) {
            return resolve(true);
        }
        // we don't want automatic reconnections as we handle the reconnect manually
        nodeConnection.connect(false).then(() => {
            nodeConnection.loadDomains([domainModulePath], false).then(() => {
                attachEventHandlers();
                resolve(false);
            }).fail((err) => { // jQuery promise - .fail is fine
                reject(ErrorHandler.toError(err));
            });
        }).fail((err) => { // jQuery promise - .fail is fine
            if (ErrorHandler.contains(err, "Max connection attempts reached")) {
                Utils.consoleLog("Max connection attempts reached, trying again.", "warn");
                // try again
                connectPromise = null;
                connectToNode()
                    .then((result) => { resolve(result); })
                    .catch((err2) => { reject(err2); });
                return;
            }
            reject(ErrorHandler.toError(err));
        });
    });

    connectPromise.finally(() => connectPromise = null);

    return connectPromise;
}

function normalizePathForOs(path) {
    return brackets.platform === "win" ? path.replace(/\//g, "\\") : path;
}

// this functions prevents sensitive info from going further (like http passwords)
function sanitizeOutput(str): string {
    if (typeof str !== "string") {
        if (str != null) { // checks for both null & undefined
            return str.toString();
        }
        return "";
    }
    return str;
}

function logDebug(opts, debugInfo, method, type, out?) {
    const processInfo = [];

    const duration = (new Date()).getTime() - debugInfo.startTime;
    processInfo.push(duration + "ms");

    if (!debugInfo.wasConnected) {
        processInfo.push("+conn");
    }

    if (opts.cliId) {
        processInfo.push("ID=" + opts.cliId);
    }

    let msg = "cmd-" + method + "-" + type + " (" + processInfo.join(";") + ")";
    if (out) { msg += ": \"" + out + "\""; }
    Utils.consoleDebug(msg);
}

export interface CliOptions {
    cwd?: string;
    nonblocking?: boolean;
    timeout?: number | boolean;
    timeoutCheck?: Function;
    timeoutExpected?: boolean;
}

export function cliHandler(method, cmd, args = [], opts: CliOptions = {}, retry = false): Promise<string | null> {
    const cliId = getNextCliId();
    const deferred = Promise.defer() as Promise.Resolver<string | null>;

    deferredMap[cliId] = deferred;

    const watchProgress = args.indexOf("--progress") !== -1;

    // it is possible to set a custom working directory in options
    // otherwise the current project root is used to execute commands
    if (!opts.cwd) {
        opts.cwd = Preferences.get("currentGitRoot") || Utils.getProjectRoot();
    }

    // convert paths like c:/foo/bar to c:\foo\bar on windows
    opts.cwd = normalizePathForOs(opts.cwd);

    // log all cli communication into console when debug mode is on
    let startTime;
    if (debugOn) {
        startTime = (new Date()).getTime();
        Utils.consoleDebug("cmd-" + method + (watchProgress ? "-watch" : "") + ": " +
                           opts.cwd + " -> " +
                           cmd + " " + args.join(" "));
    }

    // we connect to node (promise is returned immediately if we are already connected)
    connectToNode().catch((err) => {
        // failed to connect to node for some reason
        throw ErrorHandler.showError(new ExpectedError(err), Strings.ERROR_CONNECT_NODEJS);
    }).then((wasConnected) => {

        let resolved = false;
        const timeoutLength = typeof opts.timeout === "number" && opts.timeout > 0 ? (opts.timeout * 1000) : gitTimeout;
        const domainOpts = { cliId, watchProgress };
        const debugInfo = { startTime, wasConnected };

        if (watchProgress) {
            deferred.progress("Running command: git " + args.join(" "));
        }

        // nodeConnection returns jQuery deferred
        nodeConnection.domains[domainName][method](opts.cwd, cmd, args, domainOpts)
            .fail((_stderr) => { // jQuery promise - .fail is fine
                if (!resolved) {
                    const stderr = sanitizeOutput(_stderr);
                    if (debugOn) {
                        logDebug(domainOpts, debugInfo, method, "fail", stderr);
                    }
                    delete deferredMap[cliId];

                    const err = ErrorHandler.toError(stderr);

                    // spawn ENOENT error
                    const invalidCwdErr = "spawn ENOENT";
                    if (err.stack && err.stack.indexOf(invalidCwdErr)) {
                        err.message = err.message.replace(invalidCwdErr, invalidCwdErr + " (" + opts.cwd + ")");
                        err.stack = err.stack.replace(invalidCwdErr, invalidCwdErr + " (" + opts.cwd + ")");
                    }

                    // socket was closed so we should try this once again (if not already retrying)
                    if (err.stack && err.stack.indexOf("WebSocket.self._ws.onclose") !== -1 && !retry) {
                        cliHandler(method, cmd, args, opts, true)
                            .then((response) => deferred.resolve(response))
                            .catch((err2) => deferred.reject(err2));
                        return;
                    }

                    deferred.reject(err);
                }
            })
            .then((stdout) => {
                if (!resolved) {
                    const out = sanitizeOutput(stdout);
                    if (debugOn) {
                        logDebug(domainOpts, debugInfo, method, "out", out);
                    }
                    delete deferredMap[cliId];
                    deferred.resolve(out);
                }
            })
            .always(() => resolved = true)
            .done();

        function timeoutPromise() {
            if (debugOn) {
                logDebug(domainOpts, debugInfo, method, "timeout");
            }
            const err = new Error("cmd-" + method + "-timeout: " + cmd + " " + args.join(" "));
            if (!opts.timeoutExpected) {
                ErrorHandler.logError(err);
            }

            // process still lives and we need to kill it
            nodeConnection.domains[domainName].kill(domainOpts.cliId)
                .fail((err2) => ErrorHandler.logError(err2));

            delete deferredMap[cliId];
            deferred.reject(ErrorHandler.toError(err));
            resolved = true;
        }

        let lastProgressTime = 0;
        function timeoutCall() {
            setTimeout(() => {
                if (!resolved) {
                    if (typeof opts.timeoutCheck === "function") {
                        Promise.cast(opts.timeoutCheck())
                            .catch((err) => {
                                ErrorHandler.logError("timeoutCheck failed: " + opts.timeoutCheck.toString());
                                ErrorHandler.logError(err);
                            })
                            .then((continueExecution) => {
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
                        const currentTime = (new Date()).getTime();
                        const diff = currentTime - lastProgressTime;
                        if (diff > timeoutLength) {
                            if (debugOn) {
                                Utils.consoleDebug(
                                    "cmd(" + cliId + ") - last progress message was sent " + diff + "ms ago - timeout"
                                );
                            }
                            timeoutPromise();
                        } else {
                            if (debugOn) {
                                Utils.consoleDebug(
                                    "cmd(" + cliId + ") - last progress message was sent " + diff + "ms ago - delay"
                                );
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
                deferred.promise.progressed(() => lastProgressTime = (new Date()).getTime());
            }
            // call the method which will timeout the promise after a certain period of time
            timeoutCall();
        }

    }).catch((err) => {
        throw ErrorHandler.showError(
            err, "Unexpected error in CLI handler - close all instances of Brackets and start again to reload"
        );
    });

    return deferred.promise;
}

export function which(cmd) {
    return cliHandler("which", cmd);
}

export function pathExists(path) {
    return cliHandler("pathExists", path).then((response) => {
        return typeof response === "string" ? response === "true" : response;
    });
}

export function spawnCommand(cmd, args = [], opts = {}): Promise<string | null> {
    return cliHandler("spawn", cmd, args, opts);
}

export function executeCommand(cmd, args = [], opts = {}): Promise<string | null> {
    return cliHandler("execute", cmd, args, opts);
}

// this is to be used together with executeCommand
// spawnCommand does the escaping automatically
export function escapeShellArg(str) {
    if (typeof str !== "string") {
        throw new Error("escapeShellArg argument is not a string: " + typeof str);
    }
    if (str.length === 0) {
        return str;
    }
    if (brackets.platform !== "win") {
        // http://steve-parker.org/sh/escape.shtml
        return "\"" + str.replace(/["$`\\]/g, (m) => "\\" + m) + "\"";
    }
    // http://stackoverflow.com/questions/7760545/cmd-escape-double-quotes-in-parameter
    return "\"" + str.replace(/"/g, () => "\"\"\"") + "\"";
}
