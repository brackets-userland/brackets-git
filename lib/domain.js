/*global require, exports */

(function () {
    "use strict";

    var child_process = require("child_process"),
        domainName = "brackets-git";

    function executeCommand(directory, command, callback) {
        // http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
        child_process.exec(command, {
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
            "Returns Git version",
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
    };
    
}());