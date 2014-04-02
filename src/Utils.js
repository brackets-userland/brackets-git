define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        Dialogs         = brackets.getModule("widgets/Dialogs"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager");

    // Local modules
    var Preferences     = require("src/Preferences"),
        Promise         = require("bluebird"),
        Strings         = require("strings");

    // Module variables
    var questionDialogTemplate  = require("text!templates/git-question-dialog.html"),
        outputDialogTemplate    = require("text!templates/git-output.html"),
        writeTestResults        = {};

    // Implementation

    function getProjectRoot() {
        return ProjectManager.getProjectRoot().fullPath;
    }

    // returns "C:/Users/Zaggi/AppData/Roaming/Brackets/extensions/user/zaggino.brackets-git/"
    function getExtensionDirectory() {
        var modulePath = ExtensionUtils.getModulePath(module);
        return modulePath.slice(0, -1 * "src/".length);
    }

    function formatDiff(diff) {
        var rv      = [],
            tabSize = Preferences.getGlobal("tabSize");

        diff.split("\n").forEach(function (line) {
            if (line === " ") { line = ""; }

            var lineClass;
            if (line[0] === "+") {
                lineClass = "added";
            } else if (line[0] === "-") {
                lineClass = "removed";
            } else if (line.indexOf("@@") === 0) {
                lineClass = "position";
            } else if (line.indexOf("diff --git") === 0) {
                lineClass = "diffCmd";
            }

            line = _.escape(line).replace(/\s/g, "&nbsp;");
            line = line.replace(/(&nbsp;)+$/g, function (trailingWhitespace) {
                return "<span class='trailingWhitespace'>" + trailingWhitespace + "</span>";
            });
            var $line = $("<pre/>")
                            .attr("style", "tab-size:" + tabSize)
                            .html(line.length > 0 ? line : "&nbsp;");
            if (lineClass) { $line.addClass(lineClass); }
            rv.push($line);
        });
        return rv;
    }

    function askQuestion(title, question, options) {
        return new Promise(function (resolve, reject) {
            options = options || {};

            var compiledTemplate = Mustache.render(questionDialogTemplate, {
                title: title,
                question: _.escape(question),
                stringInput: !options.booleanResponse && !options.password,
                passwordInput: options.password,
                defaultValue: options.defaultValue,
                Strings: Strings
            });

            var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            if (!options.booleanResponse) {
                dialog.getElement().find("input").focus();
            }

            dialog.done(function (buttonId) {
                if (options.booleanResponse) {
                    return resolve(buttonId === "ok");
                }
                if (buttonId === "ok") {
                    return resolve(dialog.getElement().find("input").val().trim());
                } else {
                    return reject(Strings.USER_ABORTED);
                }
            });
        });
    }

    function showOutput(output, title, options) {
        return new Promise(function (resolve) {
            options = options || {};
            var compiledTemplate = Mustache.render(outputDialogTemplate, {
                title: title,
                output: output,
                Strings: Strings,
                question: options.question
            });
            var dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            dialog.getElement().focus();
            dialog.done(function (buttonId) {
                resolve(buttonId === "ok");
            });
        });
    }

    function isProjectRootWritable() {
        return new Promise(function (resolve) {

            var folder = getProjectRoot();

            // if we previously tried, assume nothing has changed
            if (writeTestResults[folder]) {
                return resolve(writeTestResults[folder]);
            }

            // create entry for temporary file
            var fileEntry = FileSystem.getFileForPath(folder + ".bracketsGitTemp");

            function finish(bool) {
                // delete the temp file and resolve
                fileEntry.unlink(function () {
                    resolve(writeTestResults[folder] = bool);
                });
            }

            // try writing some text into the temp file
            Promise.cast(FileUtils.writeText(fileEntry, ""))
                .then(function () {
                    finish(true);
                })
                .catch(function () {
                    finish(false);
                });
        });
    }

    function pathExists(path) {
        return new Promise(function (resolve) {
            FileSystem.resolve(path, function (err, entry) {
                resolve(!err && entry ? true : false);
            });
        });
    }

    // Public API
    exports.formatDiff            = formatDiff;
    exports.getProjectRoot        = getProjectRoot;
    exports.getExtensionDirectory = getExtensionDirectory;
    exports.askQuestion           = askQuestion;
    exports.showOutput            = showOutput;
    exports.isProjectRootWritable = isProjectRootWritable;
    exports.pathExists            = pathExists;
});
