import * as Promise from "bluebird";
import * as Strings from "strings";

var _ = brackets.getModule("thirdparty/lodash"),
    Dialogs = brackets.getModule("widgets/Dialogs"),
    Mustache = brackets.getModule("thirdparty/mustache/mustache");

var template = require("text!src/dialogs/templates/progress-dialog.html");

var lines,
    $textarea;

function addLine(str) {
    lines.push(str);
}

function onProgress(str) {
    if (typeof str !== "undefined") {
        addLine(str);
    }
    if ($textarea) {
        $textarea.val(lines.join("\n"));
        $textarea.scrollTop($textarea[0].scrollHeight - $textarea.height());
    }
}

export function show(promise, title, options) {
    if (!promise || !promise.finally || !promise.progressed) {
        throw new Error("Invalid argument for progress dialog!");
    }

    if (typeof title === "object") {
        options = title;
        title = false;
    }

    options = options || {};

    return new Promise(function (resolve, reject) {

        lines = [];
        $textarea = null;

        var dialog,
            finished = false;

        function showDialog() {
            if (finished) {
                return;
            }

            var templateArgs = {
                title: title || Strings.OPERATION_IN_PROGRESS_TITLE,
                Strings: Strings
            };

            var compiledTemplate = Mustache.render(template, templateArgs);
            dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

            $textarea = dialog.getElement().find("textarea");
            onProgress(undefined);
        }

        function finish() {
            finished = true;
            if (dialog) {
                dialog.close();
            }
            promise.then(function (val) {
                resolve(val);
            }).catch(function (err) {
                reject(err);
            });
        }

        if (!options.preDelay) {
            showDialog();
        } else {
            setTimeout(function () {
                showDialog();
            }, options.preDelay * 1000);
        }

        promise.progressed(function (string) {
            onProgress(string);
        }).finally(function () {
            onProgress("Finished!");
            if (!options.postDelay || !dialog) {
                finish();
            } else {
                setTimeout(function () {
                    finish();
                }, options.postDelay * 1000);
            }
        });

    });
}

export function waitForClose() {
    return new Promise(function (resolve) {
        function check() {
            var visible = $("#git-progress-dialog").is(":visible");
            if (!visible) {
                resolve();
            } else {
                _.defer(check);
            }
        }
        _.defer(check);
    });
}
