/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define */

define(function (require, exports) {
    "use strict";

    // fill for Brackets <= 32
    var _;
    try {
        _ = brackets.getModule("thirdparty/lodash");
    } catch (e) {
        var StringUtils = brackets.getModule("utils/StringUtils");
        _ = {
            escape: StringUtils.htmlEscape
        };
    }

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
            var $line = $("<pre/>").html(line.length > 0 ? line : "&nbsp;");
            if (lineClass) { $line.addClass(lineClass); }
            rv.push($line);
        });
        return rv;
    }

    exports.formatDiff = formatDiff;
});
