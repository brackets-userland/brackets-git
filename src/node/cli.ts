/* eslint-env node */
/* eslint no-console:0 */

import * as fs from "fs";
import * as ChildProcess from "child_process";
import * as ProcessUtils from "./process-utils";

const domainName = "brackets-git";
const processMap: { [id: number]: ChildProcess.ChildProcess } = {};
const resolvedPaths: { [path: string]: string } = {};
const fixEOL = (str: string) => str[str.length - 1] === "\n" ? str.slice(0, -1) : str;
const fixCommandForExec = (command: string) => {
    // execute commands have to be escaped, spawn does this automatically and will fail if cmd is escaped
    return command[0] !== "\"" || command[command.length - 1] !== "\"" ? "\"" + command + "\"" : command;
};

/* eslint-disable */
export interface DomainManager {
    emitEvent: Function;
    hasDomain: Function;
    registerDomain: Function;
    registerCommand: Function;
    registerEvent: Function;
}
/* eslint-enable */

let domainManager: DomainManager | null;

// handler with ChildProcess.exec
// this won't handle cases where process outputs a large string
function execute(
    directory: string,
    command: string,
    args: string[],
    opts: { cliId: number },
    callback: (stderr: string | null, stdout: string | null) => void
) {
    // http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
    const toExec = fixCommandForExec(command) + " " + args.join(" ");
    const child = ChildProcess.exec(toExec, {
        cwd: directory,
        maxBuffer: 20 * 1024 * 1024
    }, (err, stdout, stderr) => {
        delete processMap[opts.cliId];
        callback(err ? fixEOL(stderr) : null, err ? null : fixEOL(stdout));
    });
    processMap[opts.cliId] = child;
}

// handler with ChildProcess.spawn
function join(arr: Buffer[]) {
    let index = 0;
    const length = arr.reduce((l, b) => l + b.length, 0);
    const result = new Buffer(length);
    arr.forEach((b) => {
        b.copy(result, index);
        index += b.length;
    });
    return fixEOL(result.toString("utf8"));
}

function spawn(
    directory: string,
    command: string,
    args: string[],
    opts: { cliId: number, watchProgress: boolean },
    callback: (stderr: string | null, stdout: string | null) => void
) {
    // https://github.com/creationix/node-git
    const child = ChildProcess.spawn(command, args, {
        cwd: directory
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
        callback(err.stack || err.toString(), null);
    });

    processMap[opts.cliId] = child;

    let exitCode: number;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.addListener("data", (text: Buffer) => {
        stdout[stdout.length] = text;
    });
    child.stderr.addListener("data", (text: Buffer) => {
        if (opts.watchProgress && domainManager) {
            domainManager.emitEvent(domainName, "progress", [
                opts.cliId,
                (new Date()).getTime(),
                fixEOL(text.toString("utf8"))
            ]);
        }
        stderr[stderr.length] = text;
    });
    child.addListener("exit", (code: number) => {
        exitCode = code;
    });
    child.addListener("close", () => {
        delete processMap[opts.cliId];
        callback(exitCode > 0 ? join(stderr) : null,
                 exitCode > 0 ? null : join(stdout));
    });
    child.stdin.end();
}

function doIfExists( // eslint-disable-line max-params
    method: Function,
    directory: string,
    command: string,
    args: string[],
    opts: {},
    callback: (stderr: string | null, stdout: string | null) => void
) {
    // do not call executableExists if we already know it exists
    if (resolvedPaths[command]) {
        return method(directory, resolvedPaths[command], args, opts, callback);
    }

    ProcessUtils.executableExists(command, (err, exists, resolvedPath) => {
        if (err || !exists || !resolvedPath) {
            return callback("ProcessUtils can't resolve the path requested: " + command, null);
        }
        resolvedPaths[command] = resolvedPath;
        return method(directory, resolvedPath, args, opts, callback);
    });
}

function executeIfExists(
    directory: string,
    command: string,
    args: string[],
    opts: {},
    callback: (stderr: string | null, stdout: string | null) => void
) {
    return doIfExists(execute, directory, command, args, opts, callback);
}

function spawnIfExists(
    directory: string,
    command: string,
    args: string[],
    opts: {},
    callback: (stderr: string | null, stdout: string | null) => void
) {
    return doIfExists(spawn, directory, command, args, opts, callback);
}

function kill(
    cliId: number,
    callback: (stderr: string | null, success: boolean) => void
) {
    const process = processMap[cliId];
    if (!process) {
        return callback("Couldn't find process to kill with ID:" + cliId, false);
    }
    delete processMap[cliId];
    ProcessUtils.getChildrenOfPid(process.pid, (err, children) => {
        if (err) {
            return callback(err, false);
        }
        // kill also parent process
        children.push(process.pid);
        children.forEach((pid) => {
            ProcessUtils.killSingleProcess(pid, (stderr, stdout) => {
                if (stderr) {
                    console.warn(`killSingleProcess -> ${stderr}`);
                }
            });
        });
        callback(null, true);
    });
}

function which(
    directory: string,
    filePath: string,
    args: string[],
    opts: {},
    callback: (stderr: string | null, stdout: string | null) => void
) {
    ProcessUtils.executableExists(filePath, (err, exists, resolvedPath) => {
        if (err || !exists) {
            return callback("ProcessUtils can't resolve the path requested: " + filePath, null);
        }
        callback(null, resolvedPath);
    });
}

function pathExists(
    directory: string,
    path: string,
    args: string[],
    opts: {},
    callback: (stderr: string | null, exists: boolean) => void
) {
    fs.exists(path, (exists) => {
        callback(null, exists);
    });
}

/*
 * Initializes the domain.
 * @param {DomainManager} DomainManager for the server
 */
export function init(_domainManager: DomainManager) {
    domainManager = _domainManager;

    if (!domainManager.hasDomain(domainName)) {
        domainManager.registerDomain(domainName, {
            major: 0,
            minor: 1
        });
    } else {
        throw new Error(domainName +
                        " domain already registered. Close all Brackets instances and start again. " +
                        "This should only happen when updating the extension.");
    }

    domainManager.registerCommand(
        domainName,
        "execute", // command name
        executeIfExists, // command handler function
        true, // this command is async
        "Runs a command in a shell and buffers the output.",
        [
            { name: "directory", type: "string" },
            { name: "command", type: "string" },
            { name: "args", type: "array" },
            { name: "opts", type: "object" }
        ],
        [
            { name: "stdout", type: "string" }
        ]
    );

    domainManager.registerCommand(
        domainName,
        "spawn", // command name
        spawnIfExists, // command handler function
        true, // this command is async
        "Launches a new process with the given command.",
        [
            { name: "directory", type: "string" },
            { name: "command", type: "string" },
            { name: "args", type: "array" },
            { name: "opts", type: "object" }
        ],
        [
            { name: "stdout", type: "string" }
        ]
    );

    domainManager.registerCommand(
        domainName,
        "kill", // command name
        kill, // command handler function
        true, // this command is async
        "Launches a new process with the given command.",
        [
            { name: "commandId", type: "number" }
        ],
        [
            { name: "stdout", type: "string" }
        ]
    );

    domainManager.registerCommand(
        domainName,
        "which",
        which,
        true,
        "Looks for a given file using which.",
        [
            { name: "directory", type: "string" },
            { name: "filePath", type: "string" },
            { name: "args", type: "array" },
            { name: "opts", type: "object" }
        ],
        [
            { name: "path", type: "string" }
        ]
    );

    domainManager.registerCommand(
        domainName,
        "pathExists",
        pathExists,
        true,
        "Looks if given path exists on the file system",
        [
            { name: "directory", type: "string" },
            { name: "path", type: "string" },
            { name: "args", type: "array" },
            { name: "opts", type: "object" }
        ],
        [
            { name: "exists", type: "boolean" }
        ]
    );

    domainManager.registerEvent(
        domainName,
        "progress",
        [
            { name: "commandId", type: "number" },
            { name: "time", type: "number" },
            { name: "message", type: "string" }
        ]
    );
}
