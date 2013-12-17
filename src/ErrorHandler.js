/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define, Mustache */

define(function (require, exports) {
    "use strict";

    var Dialogs                    = brackets.getModule("widgets/Dialogs"),
        NativeApp                  = brackets.getModule("utils/NativeApp"),
        ExtInfo                    = require("../ExtInfo"),
        Strings                    = require("../strings"),
        markdownReportTemplate     = require("text!htmlContent/error-report.md"),
        errorDialogTemplate        = require("text!htmlContent/git-error-dialog.html");

    exports.logError = function (err) {
        console.error("[brackets-git] " + err);
        if (err && err.stack) { console.error(err.stack); }
    };

    exports.showError = function (err, title) {
        var dialog,
            errorBody,
            errorStack;

        if (typeof err === "string") {
            errorBody = err;
        } else {
            // TODO: more custom error body handle
            console.warn("[brackets-git] more custom error body handle needed");
            console.error(err);
            errorBody = err.toString();
            errorStack = err.stack || "";
        }

        var compiledTemplate = Mustache.render(errorDialogTemplate, {
            title: title,
            body: errorBody,
            Strings: Strings
        });

        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

        dialog.done(function (buttonId) {
            if (buttonId === "report") {
                console.log("[brackets-git] user tried to report an error");
                console.log(err);

                var mdReport = Mustache.render(markdownReportTemplate, {
                    brackets: [brackets.metadata.name, brackets.metadata.version, "(" + brackets.platform + ")"].join(" "),
                    bracketsGit: "Brackets-Git " + ExtInfo.getSync().version,
                    title: title,
                    errorBody: errorBody,
                    errorStack: errorStack
                });

                NativeApp.openURLInDefaultBrowser(ExtInfo.getSync().homepage + "/issues/new?title=" +
                                                  encodeURIComponent(title) +
                                                  "&body=" +
                                                  encodeURIComponent(mdReport));
            }
        });
    };

});
