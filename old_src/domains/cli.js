/*jshint maxparams:false*/

(function () {
    "use strict";

    var fs            = require("fs"),
        ChildProcess  = require("child_process"),
        ProcessUtils  = require("./processUtils"),
        domainName    = "brackets-git",
        domainManager = null,
        processMap    = {},
        resolvedPaths = {};

    // handler with ChildProcess.spawn


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
