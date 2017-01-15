import {
    _, CommandManager, Commands, Dialogs, DocumentManager, ExtensionUtils,
    FileSystem, FileUtils, LanguageManager, Mustache, ProjectManager
} from "./brackets-modules";
import * as ErrorHandler from "./ErrorHandler";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as Git from "./git/GitCli";
import * as Preferences from "./Preferences";
import * as Promise from "bluebird";
import * as Strings from "strings";

const formatDiffTemplate = require("text!templates/format-diff.html");
const questionDialogTemplate = require("text!templates/git-question-dialog.html");
const outputDialogTemplate = require("text!templates/git-output.html");
const writeTestResults = {};
const debugOn = Preferences.get("debugMode");
const EXT_NAME = "[brackets-git] ";

export function getProjectRoot() {
    const projectRoot = ProjectManager.getProjectRoot();
    return projectRoot ? projectRoot.fullPath : null;
}

// returns "C:/Users/Zaggi/AppData/Roaming/Brackets/extensions/user/zaggino.brackets-git/"
export function getExtensionDirectory() {
    return window.bracketsGit.getExtensionPath();
}

export function formatDiff(diff) {
    const DIFF_MAX_LENGTH = 2000;

    let tabReplace = "";
    const verbose = Preferences.get("useVerboseDiff");
    let numLineOld = 0;
    let numLineNew = 0;
    let lastStatus = 0;
    const diffData = [];

    let i = Preferences.getGlobal("tabSize");
    while (i--) {
        tabReplace += "&nbsp;";
    }

    const LINE_STATUS = {
        HEADER: 0,
        UNCHANGED: 1,
        REMOVED: 2,
        ADDED: 3,
        EOF: 4
    };

    const diffSplit = diff.split("\n");

    if (diffSplit.length > DIFF_MAX_LENGTH) {
        return "<div>" + Strings.DIFF_TOO_LONG + "</div>";
    }

    diffSplit.forEach((_line) => {
        let line = _line;
        if (line === " ") { line = ""; }

        let lineClass = "";
        let pushLine = true;

        if (line.indexOf("diff --git") === 0) {
            lineClass = "diffCmd";

            diffData.push({
                name: line.split("b/")[1],
                lines: []
            });

            if (!verbose) {
                pushLine = false;
            }
        } else if (line.match(/index\s[A-z0-9]{7}\.\.[A-z0-9]{7}/)) {
            if (!verbose) {
                pushLine = false;
            }
        } else if (line.substr(0, 3) === "+++" || line.substr(0, 3) === "---") {
            if (!verbose) {
                pushLine = false;
            }
        } else if (line.indexOf("@@") === 0) {
            lineClass = "position";

            // Define the type of the line: Header
            lastStatus = LINE_STATUS.HEADER;

            // This read the start line for the diff and substract 1 for this line
            const m = line.match(/^@@ -([,0-9]+) \+([,0-9]+) @@/);
            const s1 = m[1].split(",");
            const s2 = m[2].split(",");

            numLineOld = s1[0] - 1;
            numLineNew = s2[0] - 1;
        } else if (line[0] === "+") {
            lineClass = "added";
            line = line.substring(1);

            // Define the type of the line: Added
            lastStatus = LINE_STATUS.ADDED;

            // Add 1 to the num line for new document
            numLineNew++;
        } else if (line[0] === "-") {
            lineClass = "removed";
            line = line.substring(1);

            // Define the type of the line: Removed
            lastStatus = LINE_STATUS.REMOVED;

            // Add 1 to the num line for old document
            numLineOld++;
        } else if (line[0] === " " || line === "") {
            lineClass = "unchanged";
            line = line.substring(1);

            // Define the type of the line: Unchanged
            lastStatus = LINE_STATUS.UNCHANGED;

            // Add 1 to old a new num lines
            numLineOld++;
            numLineNew++;
        } else if (line === "\\ No newline at end of file") {
            lastStatus = LINE_STATUS.EOF;
            lineClass = "end-of-file";
        } else {
            console.log("Unexpected line in diff: " + line); // eslint-disable-line
        }

        if (pushLine) {
            let _numLineOld = null;
            let _numLineNew = null;

            switch (lastStatus) {
                case LINE_STATUS.HEADER:
                case LINE_STATUS.EOF:
                    // _numLineOld = "";
                    // _numLineNew = "";
                    break;
                case LINE_STATUS.UNCHANGED:
                    _numLineOld = numLineOld;
                    _numLineNew = numLineNew;
                    break;
                case LINE_STATUS.REMOVED:
                    _numLineOld = numLineOld;
                    // _numLineNew = "";
                    break;
                // case LINE_STATUS.ADDED:
                default:
                    // _numLineOld = "";
                    _numLineNew = numLineNew;
            }

            // removes ZERO WIDTH NO-BREAK SPACE character (BOM)
            line = line.replace(/\uFEFF/g, "");

            // exposes other potentially harmful characters
            line = line.replace(/[\u2000-\uFFFF]/g, (x) => {
                return "<U+" + x.charCodeAt(0).toString(16).toUpperCase() + ">";
            });

            line = _.escape(line)
                .replace(/\t/g, tabReplace)
                .replace(/\s/g, "&nbsp;");

            line = line.replace(/(&nbsp;)+$/g, (trailingWhitespace) => {
                return "<span class='trailingWhitespace'>" + trailingWhitespace + "</span>";
            });

            if (diffData.length > 0) {
                _.last(diffData).lines.push({
                    numLineOld: _numLineOld,
                    numLineNew: _numLineNew,
                    line,
                    lineClass
                });
            }
        }
    });

    return Mustache.render(formatDiffTemplate, { files: diffData });
}

export interface AskQuestionOptions {
    booleanResponse?: boolean;
    defaultValue?: string;
    noescape?: boolean;
    password?: boolean;
}

export function askQuestion(title, question, options: AskQuestionOptions = {}): Promise<string | boolean> {
    return new Promise((resolve: (result: string | boolean) => void, reject) => {
        options = options || {}; // eslint-disable-line

        const compiledTemplate = Mustache.render(questionDialogTemplate, {
            title,
            question: options.noescape ? question : _.escape(question),
            stringInput: !options.booleanResponse && !options.password,
            passwordInput: options.password,
            defaultValue: options.defaultValue,
            Strings
        });

        const dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        const $dialog = dialog.getElement();

        _.defer(() => {
            const $input = $dialog.find("input:visible");
            if ($input.length > 0) {
                $input.focus();
            } else {
                $dialog.find(".primary").focus();
            }
        });

        dialog.done((buttonId) => {
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

export interface ShowOutputOptions {
    question?: string;
}

export function showOutput(output, title = null, options: ShowOutputOptions = {}) {
    return new Promise((resolve) => {
        options = options || {}; // eslint-disable-line
        const compiledTemplate = Mustache.render(outputDialogTemplate, {
            title,
            output,
            Strings,
            question: options.question
        });
        const dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        dialog.getElement().find("button").focus();
        dialog.done((buttonId) => {
            resolve(buttonId === "ok");
        });
    });
}

export function isProjectRootWritable() {
    return new Promise((resolve) => {

        const folder = getProjectRoot();

        // if we previously tried, assume nothing has changed
        if (writeTestResults[folder]) {
            return resolve(writeTestResults[folder]);
        }

        // create entry for temporary file
        const fileEntry = FileSystem.getFileForPath(folder + ".bracketsGitTemp");

        function finish(bool) {
            // delete the temp file and resolve
            fileEntry.unlink(() => {
                writeTestResults[folder] = bool;
                resolve(bool);
            });
        }

        // try writing some text into the temp file
        Promise.cast(FileUtils.writeText(fileEntry, ""))
            .then(() => finish(true))
            .catch(() => finish(false));
    });
}

export function pathExists(path) {
    return new Promise((resolve) => {
        FileSystem.resolve(path, (err, entry) => {
            resolve(!err && entry ? true : false);
        });
    });
}

export function loadPathContent(path): Promise<string | null> {
    return new Promise((resolve) => {
        FileSystem.resolve(path, (err, entry) => {
            if (err) {
                return resolve(null);
            }
            if (entry._clearCachedData) {
                entry._clearCachedData();
            }
            if (entry.isFile) {
                entry.read((readErr, content) => {
                    if (readErr) {
                        return resolve(null);
                    }
                    resolve(content);
                });
            } else {
                entry.getContents((getContentsErr, contents) => {
                    if (getContentsErr) {
                        return resolve(null);
                    }
                    resolve(contents);
                });
            }
        });
    }) as Promise<string | null>;
}

export function setLoading($btn) {
    $btn.prop("disabled", true).addClass("btn-loading");
}

export function unsetLoading($btn) {
    $btn.prop("disabled", false).removeClass("btn-loading");
}

export function encodeSensitiveInformation(_str: string) {
    let str = _str;
    // should match passwords in http/https urls
    str = str.replace(/(https?:\/\/)([^:@\s]*):([^:@]*)?@/g, (a, protocol, user/*, pass*/) => {
        return protocol + user + ":***@";
    });
    // should match user name in windows user folders
    str = str.replace(/(users)(\\|\/)([^\\/]+)(\\|\/)/i, (a, users, slash1, username, slash2) => {
        return users + slash1 + "***" + slash2;
    });
    return str;
}

export function consoleLog(msg, type = "log") {
    console[type](encodeSensitiveInformation(msg)); // eslint-disable-line
}

export function consoleDebug(msg) {
    if (debugOn) {
        console.log(EXT_NAME + encodeSensitiveInformation(msg)); // eslint-disable-line
    }
}

/*
 * Reloads the Document's contents from disk, discarding any unsaved changes in the editor.
 *
 * @param {!Document} doc
 * @return {Promise} Resolved after editor has been refreshed; rejected if unable to load the
 *      file's new content. Errors are logged but no UI is shown.
 */
export function reloadDoc(doc) {
    return Promise.cast(FileUtils.readAsText(doc.file))
        .then((text) => {
            doc.refreshText(text, new Date());
        })
        .catch((err) => {
            ErrorHandler.logError("Error reloading contents of " + doc.file.fullPath);
            ErrorHandler.logError(err);
        });
}

/*
 *  strips trailing whitespace from all the diffs and adds \n to the end
 */
function stripWhitespaceFromFile(filename: string, clearWholeFile: boolean = false) {
    return new Promise((resolve, reject) => {

        const fullPath = Preferences.get("currentGitRoot") + filename;
        const addEndlineToTheEndOfFile = Preferences.get("addEndlineToTheEndOfFile");
        const removeBom = Preferences.get("removeByteOrderMark");
        const normalizeLineEndings = Preferences.get("normalizeLineEndings");

        const _cleanLines = function (lineNumbers: number[]): any {
            // do not clean if there's nothing to clean
            if (lineNumbers && lineNumbers.length === 0) {
                return resolve();
            }
            // clean the file
            const fileEntry = FileSystem.getFileForPath(fullPath);
            return Promise.cast(FileUtils.readAsText(fileEntry))
                .catch((err) => {
                    ErrorHandler.logError(err + " on FileUtils.readAsText for " + fileEntry.fullPath);
                    return null;
                })
                .then((_text) => {
                    let text = _text;
                    if (text === null) {
                        return resolve();
                    }

                    if (removeBom) {
                        // remove BOM - \uFEFF
                        text = text.replace(/\uFEFF/g, "");
                    }
                    if (normalizeLineEndings) {
                        // normalizes line endings
                        text = text.replace(/\r\n/g, "\n");
                    }
                    // process lines
                    const lines = text.split("\n");

                    if (lineNumbers) {
                        lineNumbers.forEach((lineNumber) => {
                            if (typeof lines[lineNumber] === "string") {
                                lines[lineNumber] = lines[lineNumber].replace(/\s+$/, "");
                            }
                        });
                    } else {
                        lines.forEach((ln, lineNumber) => {
                            if (typeof lines[lineNumber] === "string") {
                                lines[lineNumber] = lines[lineNumber].replace(/\s+$/, "");
                            }
                        });
                    }

                    // add empty line to the end, i've heard that git likes that for some reason
                    if (addEndlineToTheEndOfFile) {
                        const lastLineNumber = lines.length - 1;
                        if (lines[lastLineNumber].length > 0) {
                            lines[lastLineNumber] = lines[lastLineNumber].replace(/\s+$/, "");
                        }
                        if (lines[lastLineNumber].length > 0) {
                            lines.push("");
                        }
                    }

                    text = lines.join("\n");
                    return Promise.cast(FileUtils.writeText(fileEntry, text))
                        .catch((err) => {
                            ErrorHandler.logError("Wasn't able to clean whitespace from file: " + fullPath);
                            resolve();
                            throw err;
                        })
                        .then(() => {
                            // refresh the file if it's open in the background
                            DocumentManager.getAllOpenDocuments().forEach((doc) => {
                                if (doc.file.fullPath === fullPath) {
                                    reloadDoc(doc);
                                }
                            });
                            // diffs were cleaned in this file
                            resolve();
                        });
                });
        };

        if (clearWholeFile) {
            _cleanLines(null);
        } else {
            Git.diffFile(filename).then((diff) => {
                // if git returned an empty diff
                if (!diff) { return resolve(); }

                // if git detected that the file is binary
                if (diff.match(/^binary files.*differ$/img)) { return resolve(); }

                const modified = [];
                const changesets = diff.split("\n").filter((l) => l.match(/^@@/) !== null);
                // collect line numbers to clean
                changesets.forEach((line) => {
                    const m = line.match(/^@@ -([,0-9]+) \+([,0-9]+) @@/);
                    const s = m[2].split(",");
                    const from = parseInt(s[0], 10);
                    const to = from - 1 + (parseInt(s[1], 10) || 1);
                    for (let i = from; i <= to; i++) { modified.push(i > 0 ? i - 1 : 0); }
                });
                _cleanLines(modified);
            }).catch((ex) => {
                // This error will bubble up to preparing commit dialog so just log here
                ErrorHandler.logError(ex);
                reject(ex);
            });
        }
    });
}

export function stripWhitespaceFromFiles(gitStatusResults, stageChanges) {
    const notificationDefer = Promise.defer();
    const startTime = (new Date()).getTime();
    let queue: Promise<any> = Promise.resolve();

    gitStatusResults.forEach((fileObj) => {
        const isDeleted = fileObj.status.indexOf(Git.FILE_STATUS.DELETED) !== -1;

        // strip whitespace if the file was not deleted
        if (!isDeleted) {
            // strip whitespace only for recognized languages so binary files won't get corrupted
            const langId = LanguageManager.getLanguageForPath(fileObj.file).getId();
            if (["unknown", "binary", "image", "markdown", "audio"].indexOf(langId) === -1) {

                queue = queue.then(() => {
                    const clearWholeFile = fileObj.status.indexOf(Git.FILE_STATUS.UNTRACKED) !== -1 ||
                                         fileObj.status.indexOf(Git.FILE_STATUS.RENAMED) !== -1;

                    const t = (new Date()).getTime() - startTime;
                    notificationDefer.progress(t + "ms - " + Strings.CLEAN_FILE_START + ": " + fileObj.file);

                    return stripWhitespaceFromFile(fileObj.file, clearWholeFile).then(() => {
                        // stage the files again to include stripWhitespace changes
                        const notifyProgress = function () {
                            const elapsed = (new Date()).getTime() - startTime;
                            notificationDefer.progress(
                                elapsed + "ms - " + Strings.CLEAN_FILE_END + ": " + fileObj.file
                            );
                        };
                        if (stageChanges) {
                            return Git.stage(fileObj.file).then(notifyProgress);
                        }
                        return notifyProgress();
                    });
                });

            }
        }
    });

    queue
        .then(() => notificationDefer.resolve())
        .catch((err) => notificationDefer.reject(err));

    return notificationDefer.promise;
}

export function openEditorForFile(file, relative) {
    CommandManager.execute(Commands.FILE_OPEN, {
        fullPath: relative ? getProjectRoot() + file : file
    });
}

if (Preferences.get("clearWhitespaceOnSave")) {
    EventEmitter.on(Events.BRACKETS_DOCUMENT_SAVED, (evt, doc) => {
        const fullPath = doc.file.fullPath;
        const currentGitRoot = Preferences.get("currentGitRoot");
        const path = fullPath.substring(currentGitRoot.length);
        stripWhitespaceFromFile(path);
    });
}

export function defer() {
    return Promise.defer();
    /* TODO: this won't work
    const progressHandlers = [];
    const progress = (...args) => {
        console.log('progress -> ', progressHandlers.length, ...args);
        progressHandlers.forEach(h => h(...args));
    };
    let resolve;
    let reject;
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    (promise as any).progressed = (handler) => progressHandlers.push(handler);
    return { promise, progress, resolve, reject };
    */
}
