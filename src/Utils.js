/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define */

define(function (require, exports) {
    "use strict";

    var _               = brackets.getModule("thirdparty/lodash"),
        Preferences     = require("./Preferences"),
        ProjectManager  = brackets.getModule("project/ProjectManager");

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

    // Public API
    exports.formatDiff      = formatDiff;
    exports.getProjectRoot  = getProjectRoot;
});
