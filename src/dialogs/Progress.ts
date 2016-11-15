import * as Promise from "bluebird";
import * as Strings from "strings";
import { _, Dialogs, Mustache } from "../brackets-modules";

const template = require("text!src/dialogs/templates/progress-dialog.html");
let lines;
let $textarea;

function addLine(str) {
    lines.push(str);
}

function onProgress(str?) {
    if (typeof str !== "undefined") {
        addLine(str);
    }
    if ($textarea) {
        $textarea.val(lines.join("\n"));
        $textarea.scrollTop($textarea[0].scrollHeight - $textarea.height());
    }
}

export interface ShowOptions {
    preDelay?: number;
    postDelay?: number;
}

export function show(promise, title = null, options: ShowOptions = {}) {
    if (!promise || !promise.finally || !promise.progressed) {
        throw new Error("Invalid argument for progress dialog!");
    }

    if (typeof title === "object") {
        options = title; // eslint-disable-line
        title = false; // eslint-disable-line
    }
    options = options || {}; // eslint-disable-line

    return new Promise((resolve, reject) => {

        lines = [];
        $textarea = null;

        let dialog;
        let finished = false;

        function showDialog() {
            if (finished) {
                return;
            }

            const templateArgs = { title: title || Strings.OPERATION_IN_PROGRESS_TITLE, Strings };

            const compiledTemplate = Mustache.render(template, templateArgs);
            dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

            $textarea = dialog.getElement().find("textarea");
            onProgress();
        }

        function finish() {
            finished = true;
            if (dialog) {
                dialog.close();
            }
            promise
                .then((val) => resolve(val))
                .catch((err) => reject(err));
        }

        if (!options.preDelay) {
            showDialog();
        } else {
            setTimeout(() => showDialog(), options.preDelay * 1000);
        }

        promise
            .progressed((string) => onProgress(string))
            .finally(() => {
                onProgress("Finished!");
                if (!options.postDelay || !dialog) {
                    finish();
                } else {
                    setTimeout(() => finish(), options.postDelay * 1000);
                }
            });

    });
}

export function waitForClose() {
    return new Promise((resolve) => {
        function check() {
            const visible = $("#git-progress-dialog").is(":visible");
            if (!visible) {
                resolve();
            } else {
                _.defer(check);
            }
        }
        _.defer(check);
    });
}
