define(function (require, exports) {
    "use strict";

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        Dialogs         = brackets.getModule("widgets/Dialogs"),
        ProjectManager  = brackets.getModule("project/ProjectManager");

    // Local modules
    var Preferences     = require("src/Preferences"),
        Promise         = require("bluebird"),
        Strings         = require("strings");

    // Module variables
    var questionDialogTemplate = require("text!htmlContent/git-question-dialog.html");

    // Implementation

    function getProjectRoot() {
        return ProjectManager.getProjectRoot().fullPath;
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
                    return reject("User aborted!");
                }
            });
        });
    }

    // Public API
    exports.formatDiff      = formatDiff;
    exports.getProjectRoot  = getProjectRoot;
    exports.askQuestion     = askQuestion;
});
