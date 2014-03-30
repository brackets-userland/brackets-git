/*global require, exports */

(function () {
    "use strict";

    var ChildProcess  = require("child_process"),
        domainName    = "brackets-git",
        domainManager = null,
        processMap    = {};

    function fixEOL(str) {
        if (str[str.length - 1] === "\n") {
            str = str.slice(0, -1);
        }
        return str;
    }

    // handler with ChildProcess.exec
    // this won't handle cases where process outputs a large string
    function execute(directory, command, args, opts, callback) {
        // http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
        var toExec = command + " " + args.join(" ");
        ChildProcess.exec(toExec, { cwd: directory }, function (err, stdout, stderr) {
            callback(err ? fixEOL(stderr) : undefined, err ? undefined : fixEOL(stdout));
        });
    }

    // handler with ChildProcess.spawn
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
        var child = ChildProcess.spawn(command, args, {
            cwd: directory
        });
        processMap[opts.cliId] = child;

        var exitCode, stdout = [], stderr = [];
        child.stdout.addListener("data", function (text) {
            stdout[stdout.length] = text;
        });
        child.stderr.addListener("data", function (text) {
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

    function kill(cliId, callback) {
        var process = processMap[cliId];
        if (!process) {
            return callback("Couldn't find process to kill with ID:" + cliId);
        }
        try {
            callback(undefined, process.kill());
        } catch (e) {
            callback(e);
        }
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
            execute, // command handler function
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
            spawn, // command handler function
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
    };

}());
