// this file was composed with a big help from @MiguelCastillo extension Brackets-InteractiveLinter
// @see https://github.com/MiguelCastillo/Brackets-InteractiveLinter

define(function (require, exports) {

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager   = brackets.getModule("editor/EditorManager"),
        ErrorHandler    = require("src/ErrorHandler"),
        Events          = require("src/Events"),
        EventEmitter    = require("src/EventEmitter"),
        Git             = require("src/git/Git"),
        Preferences     = require("./Preferences"),
        Utils           = require("src/Utils"),
        Strings         = require("strings");

    var currentFilePath = null,
        guttersEnabled = false,
        cm = null,
        results = null,
        gutterName = "brackets-git-gutter",
        openWidgets = [];

    function clearWidgets() {
        var lines = openWidgets.map(function (mark) {
            var w = mark.lineWidget;
            if (w.visible) {
                w.visible = false;
                w.widget.clear();
            }
            return mark.line;
        });
        openWidgets = [];
        return lines;
    }

    function clearOld() {
        if (!cm) { return; }
        var gutters = cm.getOption("gutters").slice(0),
            io = gutters.indexOf(gutterName);
        if (io !== -1) {
            gutters.splice(io, 1);
            cm.clearGutter(gutterName);
            cm.setOption("gutters", gutters);
            cm.off("gutterClick", gutterClick);
        }
        clearWidgets();
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
        results = _.sortBy(_results, "line");

        // get line numbers of currently opened widgets
        var openBefore = clearWidgets();

        cm.clearGutter(gutterName);
        results.forEach(function (obj) {
            var $marker = $("<div>")
                            .addClass(gutterName + "-" + obj.type + " gitline-" + (obj.line + 1))
                            .html("&nbsp;");
            cm.setGutterMarker(obj.line, gutterName, $marker[0]);
        });

        // reopen widgets that were opened before refresh
        openBefore.forEach(function (lineNumber) {
            gutterClick(cm, lineNumber, gutterName);
        });
    }

    function gutterClick(cm, lineIndex, gutterId) {
        if (gutterId !== gutterName && gutterId !== "CodeMirror-linenumbers") {
            return;
        }

        var mark = _.find(results, function (o) { return o.line === lineIndex; });
        if (!mark || mark.type === "added") { return; }
        if (mark.parentMark) { mark = mark.parentMark; }

        if (!mark.lineWidget) {
            mark.lineWidget = {
                visible: false,
                element: $("<div class='" + gutterName + "-deleted-lines'></div>")
            };
            $("<pre/>")
                .attr("style", "tab-size:" + cm.getOption("tabSize"))
                .text(mark.content || " ")
                .appendTo(mark.lineWidget.element);
        }

        if (mark.lineWidget.visible !== true) {
            mark.lineWidget.visible = true;
            mark.lineWidget.widget = cm.addLineWidget(mark.line, mark.lineWidget.element[0], {
                coverGutter: false,
                noHScroll: false,
                above: true,
                showIfHidden: false
            });
            openWidgets.push(mark);
        } else {
            mark.lineWidget.visible = false;
            mark.lineWidget.widget.clear();
            var io = openWidgets.indexOf(mark);
            if (io !== -1) {
                openWidgets.splice(io, 1);
            }
        }
    }

    function refresh() {
        // FUTURE: this might be called too often, do not call if previous refresh isn't finished?

        if (!guttersEnabled) {
            return;
        }

        if (!Preferences.get("useGitGutter")) {
            return;
        }

        var currentDoc = DocumentManager.getCurrentDocument();
        if (!currentDoc) { return; }

        var editor = EditorManager.getActiveEditor();
        if (!editor || !editor._codeMirror) {
            return;
        }
        prepareGutter(editor._codeMirror);

        currentFilePath = currentDoc.file.fullPath;

        var currentProjectRoot = Utils.getProjectRoot();
        if (currentFilePath.indexOf(currentProjectRoot) !== 0) {
            // file is not in the current project
            return;
        }

        var filename = currentFilePath.substring(currentProjectRoot.length);

        Git.diffFile(filename).then(function (diff) {
            var added = [],
                removed = [],
                modified = [],
                changesets = diff.split(/\n@@/).map(function (str) { return "@@" + str; });

            // remove part before first
            changesets.shift();

            changesets.forEach(function (str) {
                var m = str.match(/^@@ -([,0-9]+) \+([,0-9]+) @@/);
                var s1 = m[1].split(",");
                var s2 = m[2].split(",");

                // removed stuff
                var lineRemovedFrom;
                var lineFrom = parseInt(s2[0], 10);
                var lineCount = parseInt(s1[1], 10);
                if (isNaN(lineCount)) { lineCount = 1; }
                if (lineCount > 0) {
                    lineRemovedFrom = lineFrom > 0 ? lineFrom - 1 : 0;
                    removed.push({
                        type: "removed",
                        line: lineRemovedFrom,
                        content: str.split("\n")
                                    .filter(function (l) { return l.indexOf("-") === 0; })
                                    .map(function (l) { return l.substring(1); })
                                    .join("\n")
                    });
                }

                // added stuff
                lineFrom = parseInt(s2[0], 10);
                lineCount = parseInt(s2[1], 10);
                if (isNaN(lineCount)) { lineCount = 1; }
                var isModifiedMark = false;
                var firstAddedMark = false;
                for (var i = lineFrom, lineTo = lineFrom + lineCount; i < lineTo; i++) {
                    var lineNo = i > 0 ? i - 1 : 0;
                    if (lineNo === lineRemovedFrom) {
                        // modified
                        var o = removed.pop();
                        o.type = "modified";
                        modified.push(o);
                        isModifiedMark = o;
                    } else {
                        var mark = {
                            type: isModifiedMark ? "modified" : "added",
                            line: lineNo,
                            parentMark: isModifiedMark || firstAddedMark || null
                        };
                        if (!isModifiedMark && !firstAddedMark) {
                            firstAddedMark = mark;
                        }
                        // added new
                        added.push(mark);
                    }
                }
            });

            // fix displaying of removed lines
            removed.forEach(function (o) {
                o.line = o.line + 1;
            });

            showGutters(editor._codeMirror, [].concat(added, removed, modified));
        }).catch(function (err) {
            ErrorHandler.showError(err, "Refreshing gutter failed!");
        });
    }

    function goToPrev() {
        var activeEditor = EditorManager.getActiveEditor();
        if (!activeEditor) { return; }

        var searched = _.filter(results, function (i) { return !i.parentMark; });

        var currentPos = activeEditor.getCursorPos();
        var i = searched.length;
        while (i--) {
            if (searched[i].line < currentPos.line) {
                break;
            }
        }
        if (i > -1) {
            var goToMark = searched[i];
            activeEditor.setCursorPos(goToMark.line, currentPos.ch);
        }
    }

    function goToNext() {
        var activeEditor = EditorManager.getActiveEditor();
        if (!activeEditor) { return; }

        var searched = _.filter(results, function (i) { return !i.parentMark; });

        var currentPos = activeEditor.getCursorPos();
        for (var i = 0, l = searched.length; i < l; i++) {
            if (searched[i].line > currentPos.line) {
                break;
            }
        }
        if (i < searched.length) {
            var goToMark = searched[i];
            activeEditor.setCursorPos(goToMark.line, currentPos.ch);
        }
    }

    var _timer;
    var $line = $(),
        $gitGutterLines = $();

    $(document)
        .on("mouseenter", ".CodeMirror-linenumber", function (evt) {
            var $target = $(evt.target);

            // Remove tooltip
            $line.attr("title", "");

            // Remove any misc gutter hover classes
            $(".CodeMirror-linenumber").removeClass("brackets-git-gutter-hover");
            $(".brackets-git-gutter-hover").removeClass("brackets-git-gutter-hover");

            // Add new gutter hover classes
            $gitGutterLines = $(".gitline-" + $target.html()).addClass("brackets-git-gutter-hover");

            // Add tooltips if there are any git gutter marks
            if ($gitGutterLines.hasClass("brackets-git-gutter-modified") ||
                $gitGutterLines.hasClass("brackets-git-gutter-removed")) {

                $line = $target.attr("title", Strings.GUTTER_CLICK_DETAILS);
                $target.addClass("brackets-git-gutter-hover");
            }
        })
        .on("mouseleave", ".CodeMirror-linenumber", function (evt) {
            var $target = $(evt.target);

            if (_timer) {
                clearTimeout(_timer);
            }

            _timer = setTimeout(function () {
                $(".gitline-" + $target.html()).removeClass("brackets-git-gutter-hover");
                $target.removeClass("brackets-git-gutter-hover");
            }, 500);
        });

    // Event handlers
    EventEmitter.on(Events.GIT_ENABLED, function () {
        guttersEnabled = true;
        refresh();
    });
    EventEmitter.on(Events.GIT_DISABLED, function () {
        guttersEnabled = false;
        clearOld();
    });
    EventEmitter.on(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, function () {
        refresh();
    });
    EventEmitter.on(Events.GIT_COMMITED, function () {
        refresh();
    });
    EventEmitter.on(Events.BRACKETS_FILE_CHANGED, function (evt, file) {
        if (file.fullPath === currentFilePath) {
            refresh();
        }
    });

    // API
    exports.refresh = refresh;
    exports.goToPrev = goToPrev;
    exports.goToNext = goToNext;
});
