/*jslint plusplus: true, vars: true, nomen: true */
/*global brackets, define, Mustache */

define(function (require, exports) {
    "use strict";

    var _                          = brackets.getModule("thirdparty/lodash"),
        Dialogs                    = brackets.getModule("widgets/Dialogs"),
        NativeApp                  = brackets.getModule("utils/NativeApp"),
        ExpectedError              = require("./ExpectedError"),
        ExtensionInfo              = require("./ExtensionInfo"),
        Strings                    = require("../strings"),
        markdownReportTemplate     = require("text!templates/error-report.md"),
        errorDialogTemplate        = require("text!templates/git-error-dialog.html");

    var errorQueue = [];

    function getMdReport(params) {
        return Mustache.render(markdownReportTemplate, _.defaults(params || {}, {
            brackets: [brackets.metadata.name, brackets.metadata.version, "(" + brackets.platform + ")"].join(" "),
            bracketsGit: "Brackets-Git " + ExtensionInfo.getSync().version,
            git: Strings.GIT_VERSION
        })).trim();
    }

    exports.rewrapError = function (err, errNew) {
        var oldText = "Original " + err.toString(),
            oldStack;
        if (err.stack) {
            if (err.stack.indexOf(err.toString()) === 0) {
                oldStack = "Original " + err.stack;
            } else {
                oldStack = oldText + "\n" + err.stack;
            }
        }
        if (typeof errNew === "string") {
            errNew = new Error(errNew);
        }
        errNew.toString = function () {
            return Error.prototype.toString.call(this) + "\n" + oldText;
        };
        errNew.stack += "\n\n" + oldStack;
        return errNew;
    };

    function _reportBug(params) {
        ExtensionInfo.hasLatestVersion(function (hasLatestVersion, currentVersion, latestVersion) {
            if (hasLatestVersion) {
                NativeApp.openURLInDefaultBrowser(params);
            } else {
                var err = new ExpectedError("Latest version of extension is " + latestVersion + ", yours is " + currentVersion);
                exports.showError(err, "Outdated extension version!");
            }
        });
    }

    exports.reportBug = function () {
        var mdReport = getMdReport({
            errorStack: errorQueue.map(function (err, index) {
                return "#" + (index + 1) + ". " + err.toString();
            }).join("\n")
        });
        _reportBug(ExtensionInfo.getSync().homepage + "/issues/new?body=" + encodeURIComponent(mdReport));
    };

    exports.isTimeout = function (err) {
        return err instanceof Error && (
            err.message.indexOf("cmd-execute-timeout") === 0 ||
            err.message.indexOf("cmd-spawn-timeout") === 0
        );
    };

    exports.equals = function (err, what) {
        return err.toString().toLowerCase() === what.toLowerCase();
    };

    exports.contains = function (err, what) {
        return err.toString().toLowerCase().indexOf(what.toLowerCase()) !== -1;
    };

    exports.logError = function (err) {
        var msg = err && err.stack ? err.stack : err;
        console.error("[brackets-git] " + msg);
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
                _reportBug(ExtensionInfo.getSync().homepage + "/issues/new?title=" +
                           encodeURIComponent(title) +
                           "&body=" +
                           encodeURIComponent(mdReport));
            }
        });

        return err;
    };

});
