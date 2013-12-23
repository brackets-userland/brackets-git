/*global require, exports */
/*jshint -W101*/

// some parts of this file credited to https://github.com/creationix/node-git/

(function () {
    "use strict";

    var ChildProcess = require("child_process"),
        domainName = "brackets-git";

    var gitENOENT = /fatal: (Path '([^']+)' does not exist in '([0-9a-f]{40})'|ambiguous argument '([^']+)': unknown revision or path not in the working tree.)/,
        gitCommands = []; // can be filled with --git-dir and --work-tree

    function join(arr, encoding) {
        var result, index = 0, length;
        length = arr.reduce(function (l, b) {
            return l + b.length;
        }, 0);
        result = new Buffer(length);
        arr.forEach(function (b) {
            b.copy(result, index);
            index += b.length;
        });
        if (encoding) {
            return result.toString(encoding);
        }
        return result;
    }

    // Internal helper to talk to the git subprocess
    function gitExec(directory, commands, callback) {
        commands = gitCommands.concat(commands);
        var child = ChildProcess.spawn("git", commands, {
            cwd: directory
        });
        var stdout = [], stderr = [];
        child.stdout.addListener("data", function (text) {
            stdout[stdout.length] = text;
        });
        child.stderr.addListener("data", function (text) {
            stderr[stderr.length] = text;
        });
        var exitCode;
        child.addListener("exit", function (code) {
            exitCode = code;
        });
        child.addListener("close", function () {
            if (exitCode > 0) {
                var err = new Error("git " + commands.join(" ") + "\n" + join(stderr, "utf8"));
                if (gitENOENT.test(err.message)) {
                    err.errno = process.ENOENT;
                }
                callback(err);
                return;
            }
            callback(undefined, join(stdout, "utf8"));
        });
        child.stdin.end();
    }

    // old handler, <= 0.7.3
    function executeCommand(directory, command, callback) {
        // http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
        ChildProcess.exec(command, {
            cwd: directory
        }, function (err, stdout, stderr) {
            // remove last EOL
            if (stdout[stdout.length - 1] === "\n") {
                stdout = stdout.slice(0, -1);
            }
            callback(err ? stderr : undefined, err ? undefined : stdout);
        });
    }

    /**
     * Initializes the domain.
     * @param {DomainManager} DomainManager for the server
     */
    exports.init = function (DomainManager) {
        if (!DomainManager.hasDomain(domainName)) {
            DomainManager.registerDomain(domainName, {
                major: 0,
                minor: 1
            });
        }
        
        DomainManager.registerCommand(
            domainName,
            "executeCommand", // command name
            executeCommand, // command handler function
            true, // this command is async
            "Executes any command in command line",
            [
                {
                    name: "directory",
                    type: "string"
                },
                {
                    name: "command",
                    type: "string"
                }
            ],
            [{
                name: "stdout",
                type: "string"
            }]
        );

        DomainManager.registerCommand(
            domainName,
            "gitExec", // command name
            gitExec, // command handler function
            true, // this command is async
            "Executes Git CLI",
            [
                {
                    name: "directory",
                    type: "string"
                },
                {
                    name: "args",
                    type: "array"
                }
            ],
            [{
                name: "stdout",
                type: "string"
            }]
        );
    };
    
}());
