/*jslint plusplus: true, vars: true, nomen: true */
/*global define */

define(function (require, exports) {
    "use strict";

    var cm = null,
        gutterName = "brackets-git-gutter";

    function clearOld() {
        var gutters = cm.getOption("gutters").slice(0),
            io = gutters.indexOf(gutterName);
        if (io !== -1) {
            gutters.splice(io, 1);
            cm.clearGutter(gutterName);
            cm.setOption("gutters", gutters);
        }
    }

    function prepareGutter(_cm) {
        // if new instance is different from the old one, clean the old one
        if (cm && cm !== _cm) {
            clearOld();
        }
        cm = _cm;

        // if called with null, just clean the old instance
        if (!cm) {
            return;
        }

        // add our gutter if its not already available
        var gutters = cm.getOption("gutters").slice(0);
        if (gutters.indexOf(gutterName) === -1) {
            gutters.splice(gutters.length - 1, 0, gutterName);
            cm.setOption("gutters", gutters);
        }
    }

    function showGutters(_cm, results) {
        prepareGutter(_cm);

        cm.clearGutter(gutterName);
        results.added.forEach(function (lineNum) {
            cm.setGutterMarker(lineNum, gutterName, $("<div class='" + gutterName + "-added' title='Added'>&nbsp;</div>")[0]);
        });
        results.modified.forEach(function (lineNum) {
            cm.setGutterMarker(lineNum, gutterName, $("<div class='" + gutterName + "-modified' title='Modified'>&nbsp;</div>")[0]);
        });
    }

    // API
    exports.prepareGutter = prepareGutter;
    exports.showGutters = showGutters;

});
