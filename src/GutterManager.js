/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define */

// this file was composed with a big help from @MiguelCastillo extension Brackets-InteractiveLinter
// @see https://github.com/MiguelCastillo/Brackets-InteractiveLinter

define(function (require, exports) {
    "use strict";

    var _ = brackets.getModule("thirdparty/lodash");

    var cm = null,
        results = null,
        gutterName = "brackets-git-gutter",
        openWidgets = [];

    function clearOld() {
        var gutters = cm.getOption("gutters").slice(0),
            io = gutters.indexOf(gutterName);
        if (io !== -1) {
            gutters.splice(io, 1);
            cm.clearGutter(gutterName);
            cm.setOption("gutters", gutters);
            cm.off("gutterClick", gutterClick);
        }
        openWidgets.forEach(function (w) {
            if (w.visible) {
                w.visible = false;
                w.widget.clear();
            }
        });
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
            gutters.unshift(gutterName);
            cm.setOption("gutters", gutters);
            cm.on("gutterClick", gutterClick);
        }
    }

    function showGutters(_cm, _results) {
        prepareGutter(_cm);
        results = _results;
        //-
        cm.clearGutter(gutterName);
        results.forEach(function (obj) {
            cm.setGutterMarker(obj.line, gutterName, $("<div class='" + gutterName + "-" + obj.type + "'>&nbsp;</div>")[0]);
        });
    }

    function gutterClick(cm, lineIndex, gutterId) {
        if (gutterId !== gutterName && gutterId !== "CodeMirror-linenumbers") {
            return;
        }

        var mark = _.find(results, function (o) { return o.line === lineIndex; });
        if (!mark) { return; }
        if (mark.parentMark) { mark = mark.parentMark; }

        if (!mark.lineWidget) {
            mark.lineWidget = {
                visible: false,
                element: $("<div class='" + gutterName + "-deleted-lines'></div>")
            };
            $("<pre/>").text(mark.content).appendTo(mark.lineWidget.element);
        }

        if (mark.lineWidget.visible !== true) {
            mark.lineWidget.visible = true;
            mark.lineWidget.widget = cm.addLineWidget(mark.line, mark.lineWidget.element[0], {
                coverGutter: false,
                noHScroll: false,
                above: true,
                showIfHidden: false
            });
            openWidgets.push(mark.lineWidget);
        } else {
            mark.lineWidget.visible = false;
            mark.lineWidget.widget.clear();
        }
    }

    // API
    exports.prepareGutter = prepareGutter;
    exports.showGutters = showGutters;

});
