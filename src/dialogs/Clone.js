define(function (require, exports) {
    "use strict";

    // Brackets modules
    var Dialogs = brackets.getModule("widgets/Dialogs"),
        Mustache = brackets.getModule("thirdparty/mustache/mustache");

    // Local modules
    var Promise         = require("bluebird"),
        RemoteCommon    = require("src/dialogs/RemoteCommon"),
        Strings         = require("strings");

    // Templates
    var template            = require("text!src/dialogs/templates/clone-dialog.html"),
        credentialsTemplate = require("text!src/dialogs/templates/credentials-template.html");

    // Module variables
    var defer,
        $cloneInput;

    // Implementation
    function _attachEvents($dialog) {
        // Detect changes to URL, disable auth if not http
        $cloneInput.on("keyup change", function () {
            var $authInputs = $dialog.find("input[name='username'],input[name='password'],input[name='saveToUrl']");
            if ($(this).val().length > 0) {
                if (/^https?:/.test($(this).val())) {
                    $authInputs.prop("disabled", false);

                    // Update the auth fields if the URL contains auth
                    var auth = /:\/\/([^:]+):?([^@]*)@/.exec($(this).val());
                    if (auth) {
                        $("input[name=username]", $dialog).val(auth[1]);
                        $("input[name=password]", $dialog).val(auth[2]);
                    }
                } else {
                    $authInputs.prop("disabled", true);
                }
            } else {
                $authInputs.prop("disabled", false);
            }
        });
        $cloneInput.focus();
    }

    function show() {
        defer = Promise.defer();

        var templateArgs = {
            modeLabel: Strings.CLONE_REPOSITORY,
            Strings: Strings
        };

        var compiledTemplate = Mustache.render(template, templateArgs, {
            credentials: credentialsTemplate
        }),
        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
        $dialog = dialog.getElement();

        $cloneInput = $dialog.find("#git-clone-url");

        _attachEvents($dialog);

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                var cloneConfig = {};
                cloneConfig.remote = "origin";
                cloneConfig.remoteUrl = $cloneInput.val();
                RemoteCommon.collectValues(cloneConfig, $dialog);
                defer.resolve(cloneConfig);
            } else {
                defer.reject();
            }
        });

        return defer.promise;
    }

    exports.show = show;
});
