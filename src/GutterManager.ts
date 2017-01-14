import { _, CommandManager, DocumentManager, EditorManager, MainViewManager } from "./brackets-modules";
import * as ErrorHandler from "./ErrorHandler";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as Git from "./git/GitCli";
import * as Preferences from "./Preferences";

let gitAvailable = false;
const gutterName = "brackets-git-gutter";
const editorsWithGutters = [];
let openWidgets = [];

function clearWidgets() {
    const lines = openWidgets.map((mark) => {
        const w = mark.lineWidget;
        if (w.visible) {
            w.visible = false;
            w.widget.clear();
        }
        return {
            cm: mark.cm,
            line: mark.line
        };
    });
    openWidgets = [];
    return lines;
}

function clearOld(editor) {
    const cm = editor._codeMirror;
    if (!cm) { return; }

    const gutters = cm.getOption("gutters").slice(0);
    const io = gutters.indexOf(gutterName);

    if (io !== -1) {
        gutters.splice(io, 1);
        cm.clearGutter(gutterName);
        cm.setOption("gutters", gutters);
        cm.off("gutterClick", gutterClick);
    }

    delete cm.gitGutters;

    clearWidgets();
}

function prepareGutter(editor) {
    // add our gutter if its not already available
    const cm = editor._codeMirror;

    const gutters = cm.getOption("gutters").slice(0);
    if (gutters.indexOf(gutterName) === -1) {
        gutters.unshift(gutterName);
        cm.setOption("gutters", gutters);
        cm.on("gutterClick", gutterClick);
    }

    if (editorsWithGutters.indexOf(editor) === -1) {
        editorsWithGutters.push(editor);
    }
}

function prepareGutters(editors) {
    editors.forEach((editor) => {
        prepareGutter(editor);
    });
    // clear the rest
    let idx = editorsWithGutters.length;
    while (idx--) {
        if (editors.indexOf(editorsWithGutters[idx]) === -1) {
            clearOld(editorsWithGutters[idx]);
            editorsWithGutters.splice(idx, 1);
        }
    }
}

function showGutters(editor, _results) {
    prepareGutter(editor);

    const cm = editor._codeMirror;
    cm.gitGutters = _.sortBy(_results, "line");

    // get line numbers of currently opened widgets
    const openBefore = clearWidgets();

    cm.clearGutter(gutterName);
    cm.gitGutters.forEach((obj) => {
        const $marker = $("<div>")
                        .addClass(gutterName + "-" + obj.type + " gitline-" + (obj.line + 1))
                        .html("&nbsp;");
        cm.setGutterMarker(obj.line, gutterName, $marker[0]);
    });

    // reopen widgets that were opened before refresh
    openBefore.forEach((obj) => {
        gutterClick(obj.cm, obj.line, gutterName);
    });
}

function gutterClick(cm, lineIndex, gutterId) {
    if (!cm) {
        return;
    }

    if (gutterId !== gutterName && gutterId !== "CodeMirror-linenumbers") {
        return;
    }

    let mark = _.find(cm.gitGutters, (o) => o.line === lineIndex);
    if (!mark || mark.type === "added") { return; }

    // we need to be able to identify cm instance from any mark
    mark.cm = cm;

    if (mark.parentMark) { mark = mark.parentMark; }

    if (!mark.lineWidget) {
        mark.lineWidget = {
            visible: false,
            element: $("<div class='" + gutterName + "-deleted-lines'></div>")
        };
        const $btn = $("<button/>")
            .addClass("brackets-git-gutter-copy-button")
            .text("R")
            .on("click", () => {
                const doc = DocumentManager.getCurrentDocument();
                doc.replaceRange(mark.content + "\n", {
                    line: mark.line,
                    ch: 0
                });
                CommandManager.execute("file.save");
                refresh();
            });
        $("<pre/>")
            .attr("style", "tab-size:" + cm.getOption("tabSize"))
            .text(mark.content || " ")
            .append($btn)
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
        const io = openWidgets.indexOf(mark);
        if (io !== -1) {
            openWidgets.splice(io, 1);
        }
    }
}

function getEditorFromPane(paneId) {
    const currentPath = MainViewManager.getCurrentlyViewedPath(paneId);
    const doc = currentPath && DocumentManager.getOpenDocumentForPath(currentPath);
    return doc && doc._masterEditor;
}

function processDiffResults(editor, diff) {
    const added = [];
    const removed = [];
    const modified = [];
    const changesets = diff.split(/\n@@/).map((str) => "@@" + str);

    // remove part before first
    changesets.shift();

    changesets.forEach((str) => {
        const m = str.match(/^@@ -([,0-9]+) \+([,0-9]+) @@/);
        const s1 = m[1].split(",");
        const s2 = m[2].split(",");

        // removed stuff
        let lineRemovedFrom;
        let lineFrom = parseInt(s2[0], 10);
        let lineCount = parseInt(s1[1], 10);
        if (isNaN(lineCount)) { lineCount = 1; }
        if (lineCount > 0) {
            lineRemovedFrom = lineFrom - 1;
            removed.push({
                type: "removed",
                line: lineRemovedFrom,
                content: str.split("\n")
                            .filter((l) => l.indexOf("-") === 0)
                            .map((l) => l.substring(1))
                            .join("\n")
            });
        }

        // added stuff
        lineFrom = parseInt(s2[0], 10);
        lineCount = parseInt(s2[1], 10);
        if (isNaN(lineCount)) { lineCount = 1; }
        let isModifiedMark = false;
        let firstAddedMark = false;
        const lineTo = lineFrom + lineCount;
        for (let i = lineFrom; i < lineTo; i++) {
            const lineNo = i - 1;
            if (lineNo === lineRemovedFrom) {
                // modified
                const o = removed.pop();
                o.type = "modified";
                modified.push(o);
                isModifiedMark = o;
            } else {
                const mark = {
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
    removed.forEach((o) => {
        o.line += 1;
    });

    showGutters(editor, [].concat(added, removed, modified));
}

function refresh() {
    if (!gitAvailable) {
        return;
    }

    if (!Preferences.get("useGitGutter")) {
        return;
    }

    const currentGitRoot = Preferences.get("currentGitRoot");

    // we get a list of editors, which need to be refreshed
    const editors = _.compact(_.map(MainViewManager.getPaneIdList(), (paneId) => {
        return getEditorFromPane(paneId);
    }));

    // we create empty gutters in all of these editors, all other editors lose their gutters
    prepareGutters(editors);

    // now we launch a diff to fill the gutters in our editors
    editors.forEach((editor) => {

        let currentFilePath = null;

        if (editor.document && editor.document.file) {
            currentFilePath = editor.document.file.fullPath;
        }

        if (currentFilePath.indexOf(currentGitRoot) !== 0) {
            // file is not in the current project
            return;
        }

        const filename = currentFilePath.substring(currentGitRoot.length);

        Git.diffFile(filename).then((diff) => {
            processDiffResults(editor, diff);
        }).catch((err) => {
            // if this is launched in a non-git repository, just ignore
            if (ErrorHandler.contains(err, "Not a git repository")) {
                return;
            }
            // if this file was moved or deleted before this command could be executed, ignore
            if (ErrorHandler.contains(err, "No such file or directory")) {
                return;
            }
            ErrorHandler.showError(err, "Refreshing gutter failed!");
        });

    });
}

export function goToPrev() {
    const activeEditor = EditorManager.getActiveEditor();
    if (!activeEditor) { return; }

    const results = activeEditor._codeMirror.gitGutters || [];
    const searched = _.filter(results, (i) => !i.parentMark);

    const currentPos = activeEditor.getCursorPos();
    let i = searched.length;
    while (i--) {
        if (searched[i].line < currentPos.line) {
            break;
        }
    }
    if (i > -1) {
        const goToMark = searched[i];
        activeEditor.setCursorPos(goToMark.line, currentPos.ch);
    }
}

export function goToNext() {
    const activeEditor = EditorManager.getActiveEditor();
    if (!activeEditor) { return; }

    const results = activeEditor._codeMirror.gitGutters || [];
    const searched = _.filter(results, (i) => !i.parentMark);

    const currentPos = activeEditor.getCursorPos();
    let i;
    let l;
    for (i = 0, l = searched.length; i < l; i++) {
        if (searched[i].line > currentPos.line) {
            break;
        }
    }
    if (i < searched.length) {
        const goToMark = searched[i];
        activeEditor.setCursorPos(goToMark.line, currentPos.ch);
    }
}

/* // disable because of https://github.com/zaggino/brackets-git/issues/1019
let _timer;
let $line = $(),
    $gitGutterLines = $();

$(document)
    .on("mouseenter", ".CodeMirror-linenumber", function (evt) {
        let $target = $(evt.target);

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
        let $target = $(evt.target);

        if (_timer) {
            clearTimeout(_timer);
        }

        _timer = setTimeout(function () {
            $(".gitline-" + $target.html()).removeClass("brackets-git-gutter-hover");
            $target.removeClass("brackets-git-gutter-hover");
        }, 500);
    });
*/

// Event handlers
EventEmitter.on(Events.GIT_ENABLED, () => {
    gitAvailable = true;
    refresh();
});
EventEmitter.on(Events.GIT_DISABLED, () => {
    gitAvailable = false;
    // calling this with an empty array will remove gutters from all editor instances
    prepareGutters([]);
});
EventEmitter.on(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, (evt, file) => {
    // file will be null when switching to an empty pane
    if (!file) { return; }

    // document change gets launched even when switching panes,
    // so we check if the file hasn't already got the gutters
    const alreadyOpened = _.filter(editorsWithGutters, (editor) => {
        return editor.document.file.fullPath === file.fullPath;
    }).length > 0;

    if (!alreadyOpened) {
        // TODO: here we could sent a particular file to be refreshed only
        refresh();
    }
});
EventEmitter.on(Events.GIT_COMMITED, () => {
    refresh();
});
EventEmitter.on(Events.BRACKETS_FILE_CHANGED, (evt, file) => {
    const alreadyOpened = _.filter(editorsWithGutters, (editor) => {
        return editor.document.file.fullPath === file.fullPath;
    }).length > 0;

    if (alreadyOpened) {
        // TODO: here we could sent a particular file to be refreshed only
        refresh();
    }
});
