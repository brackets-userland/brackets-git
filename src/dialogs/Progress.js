define(function (require, exports) {
    "use strict";

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash"),
        Dialogs = brackets.getModule("widgets/Dialogs");

    // Local modules
    var Promise = require("bluebird"),
        Strings = require("strings");

    // Templates
    var template = require("text!src/dialogs/templates/progress-dialog.html");

    // Module variables
    var lines,
        $textarea;

    // Implementation
    function addLine(str) {
        lines.push(str);
    }

    function onProgress(str) {
        addLine(str);
        $textarea.val(lines.join("\n"));
        $textarea.scrollTop($textarea[0].scrollHeight - $textarea.height());
    }

    function show(promise, title) {
        lines = [];

        if (!promise || !promise.finally || !promise.progressed) {
            throw new Error("Invalid argument for progress dialog!");
        }

        var templateArgs = {
            title: title || Strings.OPERATION_IN_PROGRESS_TITLE,
            Strings: Strings
        };

        var compiledTemplate = Mustache.render(template, templateArgs),
            dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

        $textarea = dialog.getElement().find("textarea");

        promise.progressed(function (string) {
            onProgress(string);
        }).finally(function () {
            dialog.close();
        });

        return promise;
    }

    function waitForClose() {
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

    exports.show = show;
    exports.waitForClose = waitForClose;

});
