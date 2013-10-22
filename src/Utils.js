/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define */

define(function (require, exports) {
    "use strict";

    var _ = brackets.getModule("lodash");

    function formatDiff(diff) {
        var rv = [];

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
            var $line = $("<pre/>").html(line);
            if (lineClass) { $line.addClass(lineClass); }
            rv.push($line);
        });
        return rv;
    }

    exports.formatDiff = formatDiff;
});
