/*jshint maxparams:false*/

(function () {
    "use strict";

    var fs            = require("fs"),
        ChildProcess  = require("child_process"),
        crossSpawn    = require('cross-spawn'),
        ProcessUtils  = require("./processUtils"),
        domainName    = "brackets-git",
        domainManager = null,
        processMap    = {},
        resolvedPaths = {};

    function fixEOL(str) {
        if (str[str.length - 1] === "\n") {
            str = str.slice(0, -1);
        }
        return str;
    }

    // handler with ChildProcess.exec
    // this won't handle cases where process outputs a large string
    function execute(directory, command, args, opts, callback) {
        // execute commands have to be escaped, spawn does this automatically and will fail if cmd is escaped
        if (command[0] !== "\"" || command[command.length - 1] !== "\"") {
            command = "\"" + command + "\"";
        }
        // http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
        var toExec = command + " " + args.join(" ");
        var child = ChildProcess.exec(toExec, {
            cwd: directory,
            maxBuffer: 20 * 1024 * 1024
        }, function (err, stdout, stderr) {
            delete processMap[opts.cliId];
            callback(err ? fixEOL(stderr) : undefined, err ? undefined : fixEOL(stdout));
        });
        processMap[opts.cliId] = child;
    }

    // handler with cross-spawn
    function join(arr) {
        var result, index = 0, length;
        length = arr.reduce(function (l, b) {
            return l + b.length;
        }, 0);
        result = new Buffer(length);
        arr.forEach(function (b) {
            b.copy(result, index);
            index += b.length;
        });
        return fixEOL(result.toString("utf8"));
    }

    function spawn(directory, command, args, opts, callback) {
        // https://github.com/creationix/node-git
        var child = crossSpawn(command, args, {
            cwd: directory
        });
        child.on("error", function (err) {
            callback(err.stack, undefined);
        });

        processMap[opts.cliId] = child;

        var exitCode, stdout = [], stderr = [];
        child.stdout.addListener("data", function (text) {
            stdout[stdout.length] = text;
        });
        child.stderr.addListener("data", function (text) {
            if (opts.watchProgress) {
                domainManager.emitEvent(domainName, "progress", [
                    opts.cliId,
                    (new Date()).getTime(),
                    fixEOL(text.toString("utf8"))
                ]);
            }
            stderr[stderr.length] = text;
        });
        child.addListener("exit", function (code) {
            exitCode = code;
        });
        child.addListener("close", function () {
            delete processMap[opts.cliId];
            callback(exitCode > 0 ? join(stderr) : undefined,
                     exitCode > 0 ? undefined : join(stdout));
        });
        child.stdin.end();
    }

    function doIfExists(method, directory, command, args, opts, callback) {
        // do not call executableExists if we already know it exists
        if (resolvedPaths[command]) {
            return method(directory, resolvedPaths[command], args, opts, callback);
        }

        ProcessUtils.executableExists(command, function (err, exists, resolvedPath) {
            if (exists) {
                resolvedPaths[command] = resolvedPath;
                return method(directory, resolvedPath, args, opts, callback);
            } else {
                callback("ProcessUtils can't resolve the path requested: " + command);
            }
        });
    }

    function executeIfExists(directory, command, args, opts, callback) {
        return doIfExists(execute, directory, command, args, opts, callback);
    }

    function spawnIfExists(directory, command, args, opts, callback) {
        return doIfExists(spawn, directory, command, args, opts, callback);
    }

    function kill(cliId, callback) {
        var process = processMap[cliId];
        if (!process) {
            return callback("Couldn't find process to kill with ID:" + cliId);
        }
        delete processMap[cliId];
        ProcessUtils.getChildrenOfPid(process.pid, function (err, children) {
            // kill also parent process
            children.push(process.pid);
            children.forEach(function (pid) {
                ProcessUtils.killSingleProcess(pid);
            });
        });
    }

    function which(directory, filePath, args, opts, callback) {
        ProcessUtils.executableExists(filePath, function (err, exists, resolvedPath) {
            if (exists) {
                callback(null, resolvedPath);
            } else {
                callback("ProcessUtils can't resolve the path requested: " + filePath);
            }
        });
    }

    function pathExists(directory, path, args, opts, callback) {
        fs.exists(path, function (exists) {
            callback(null, exists);
        });
    }

    /**
     * Initializes the domain.
     * @param {DomainManager} DomainManager for the server
     */
    exports.init = function (_domainManager) {
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
    };

}());
