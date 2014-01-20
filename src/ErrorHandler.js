/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define, Mustache */

define(function (require, exports) {
    "use strict";

    var _                          = brackets.getModule("thirdparty/lodash"),
        Dialogs                    = brackets.getModule("widgets/Dialogs"),
        NativeApp                  = brackets.getModule("utils/NativeApp"),
        ExpectedError              = require("./ExpectedError"),
        ExtInfo                    = require("../ExtInfo"),
        Strings                    = require("../strings"),
        markdownReportTemplate     = require("text!htmlContent/error-report.md"),
        errorDialogTemplate        = require("text!htmlContent/git-error-dialog.html");

    var errorQueue = [];

    function getMdReport(params) {
        return Mustache.render(markdownReportTemplate, _.defaults(params || {}, {
            brackets: [brackets.metadata.name, brackets.metadata.version, "(" + brackets.platform + ")"].join(" "),
            bracketsGit: "Brackets-Git " + ExtInfo.getSync().version
        })).trim();
    }

    exports.reportBug = function () {
        var mdReport = getMdReport({
            errorStack: errorQueue.map(function (err, index) {
                return "#" + (index + 1) + ". " + err.toString();
            }).join("\n")
        });
        NativeApp.openURLInDefaultBrowser(ExtInfo.getSync().homepage + "/issues/new?body=" +
                                          encodeURIComponent(mdReport));
    };

    exports.logError = function (err) {
        console.error("[brackets-git] " + err);
        if (err && err.stack) { console.error(err.stack); }
        errorQueue.push(err);
        return err;
    };

    exports.showError = function (err, title) {
        exports.logError(err);

        var dialog,
            errorBody,
            errorStack;

        var showReportButton = true;
        if (err instanceof ExpectedError) {
            showReportButton = false;
        }

        if (typeof err === "string") {
            errorBody = err;
        } else if (err instanceof Error) {
            errorBody = err.toString();
            errorStack = err.stack || "";
        } else {
            errorBody = JSON.stringify(err, null, 4);
        }

        var compiledTemplate = Mustache.render(errorDialogTemplate, {
            title: title,
            body: errorBody,
            showReportButton: showReportButton,
            Strings: Strings
        });

        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

        dialog.done(function (buttonId) {
            if (buttonId === "report") {
                var mdReport = getMdReport({
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

        return err;
    };

});
