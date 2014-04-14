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
            tabSize = Preferences.getGlobal("tabSize"),
            verbose = Preferences.get("useVerboseDiff");

        diff.split("\n").forEach(function (line) {
            if (line === " ") { line = ""; }

            var lineClass   = "",
                pushLine    = true,
                $newBlock   = $(null),
                $separator  = $(null);

            if (/index\s[A-z0-9]{7}..[A-z0-9]{7}/.test(line)) {
                if (!verbose) {
                    line = "";
                }
            } else if (line.substr(0, 3) === "+++" || line.substr(0, 3) === "---" && !verbose) {
                pushLine = false;
            } else if (line[0] === "+" && line[1] !== "+") {
                lineClass = "added";
                line = line.substring(1);
            } else if (line[0] === "-" && line[1] !== "-") {
                lineClass = "removed";
                line = line.substring(1);
            } else if (line[0] === " ") {
                lineClass = "unchanged";
                line = line.substring(1);
            } else if (line.indexOf("@@") === 0) {
                lineClass = "position";
            } else if (line.indexOf("diff --git") === 0) {
                lineClass = "diffCmd";
                $newBlock = $("<tr/>")
                                .addClass("meta")
                                .html("<td/>")
                                .find("td")
                                    .text(line.split("b/")[1])
                                .end();
                $separator = $("<tr/>").addClass("separator");
                if (!verbose) {
                    pushLine = false;
                }
            }

            line = _.escape(line).replace(/\s/g, "&nbsp;");
            line = line.replace(/(&nbsp;)+$/g, function (trailingWhitespace) {
                return "<span class='trailingWhitespace'>" + trailingWhitespace + "</span>";
            });
            var $line = $("<tr/>")
                            .addClass("diff-row")
                            .addClass(lineClass)
                            .html("<td/>")
                            .find("td")
                                .html("<pre/>")
                                .find("pre")
                                    .attr("style", "tab-size:" + tabSize)
                                    .html(line.length > 0 ? line : "&nbsp;")
                                .end()
                            .end();

            if ($newBlock.length) {
                rv.push($separator);
                rv.push($newBlock);
            }
            if (pushLine) {
                rv.push($line);
            }
        });
        var $diff = $("<table/>");
        console.log($diff.html(rv).html());
        return $diff.html(rv);
    }

    function askQuestion(title, question, options) {
        return new Promise(function (resolve, reject) {
            options = options || {};

            if (!options.noescape) {
                question = _.escape(question);
            }

            var compiledTemplate = Mustache.render(questionDialogTemplate, {
                title: title,
                question: question,
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
                    resolve(dialog.getElement().find("input").val().trim());
                } else {
                    reject(Strings.USER_ABORTED);
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
                    writeTestResults[folder] = bool;
                    resolve(bool);
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

    function loadPathContent(path) {
        return new Promise(function (resolve) {
            FileSystem.resolve(path, function (err, entry) {
                if (err) {
                    return resolve(null);
                }
                if (entry.isFile) {
                    entry.read(function (err, content) {
                        if (err) {
                            return resolve(null);
                        }
                        resolve(content);
                    });
                } else {
                    entry.getContents(function (err, contents) {
                        if (err) {
                            return resolve(null);
                        }
                        resolve(contents);
                    });
                }
            });
        });
    }

    function setLoading($btn) {
        $btn.prop("disabled", true).addClass("btn-loading");
    }

    function unsetLoading($btn) {
        $btn.prop("disabled", false).removeClass("btn-loading");
    }

    function encodeSensitiveInformation(str) {
        // should match passwords in http/https urls
        str = str.replace(/(https?:\/\/)([^:@\s]*):([^:@]*)?@/g, function (a, protocol, user/*, pass*/) {
            return protocol + user + ":***@";
        });
        // should match user name in windows user folders
        str = str.replace(/(users)(\\|\/)([^\\\/]+)(\\|\/)/i, function (a, users, slash1, username, slash2) {
            return users + slash1 + "***" + slash2;
        });
        return str;
    }

    function consoleLog(msg, type) {
        console[type || "log"](encodeSensitiveInformation(msg));
    }

    // Public API
    exports.formatDiff                  = formatDiff;
    exports.getProjectRoot              = getProjectRoot;
    exports.getExtensionDirectory       = getExtensionDirectory;
    exports.askQuestion                 = askQuestion;
    exports.showOutput                  = showOutput;
    exports.isProjectRootWritable       = isProjectRootWritable;
    exports.pathExists                  = pathExists;
    exports.loadPathContent             = loadPathContent;
    exports.setLoading                  = setLoading;
    exports.unsetLoading                = unsetLoading;
    exports.consoleLog                  = consoleLog;
    exports.encodeSensitiveInformation  = encodeSensitiveInformation;

});
