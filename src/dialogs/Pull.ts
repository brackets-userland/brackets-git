import * as Preferences from "../Preferences";
import * as Promise from "bluebird";
import * as RemoteCommon from "./RemoteCommon";
import * as Strings from "strings";

var Dialogs = brackets.getModule("widgets/Dialogs"),
    Mustache = brackets.getModule("thirdparty/mustache/mustache");

var template            = require("text!src/dialogs/templates/pull-dialog.html"),
    remotesTemplate     = require("text!src/dialogs/templates/remotes-template.html"),
    credentialsTemplate = require("text!src/dialogs/templates/credentials-template.html");

var defer,
    pullConfig;

function _attachEvents($dialog) {
    RemoteCommon.attachCommonEvents(pullConfig, $dialog);

    // load last used
    $dialog
        .find("input[name='strategy']")
        .filter("[value='" + (Preferences.get("pull.strategy") || "DEFAULT") + "']")
        .prop("checked", true);
}

function _show() {
    var templateArgs = {
        config: pullConfig,
        mode: "PULL_FROM",
        modeLabel: Strings.PULL_FROM,
        Strings: Strings
    };

    var compiledTemplate = Mustache.render(template, templateArgs, {
            credentials: credentialsTemplate,
            remotes: remotesTemplate
        }),
        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
        $dialog = dialog.getElement();

    _attachEvents($dialog);

    dialog.done(function (buttonId) {
        if (buttonId === "ok") {
            RemoteCommon.collectValues(pullConfig, $dialog);
            Preferences.set("pull.strategy", pullConfig.strategy);
            defer.resolve(pullConfig);
        } else {
            defer.reject();
        }
    });
}

export function show(_pullConfig) {
    defer = Promise.defer();
    pullConfig = _pullConfig;
    pullConfig.pull = true;
    RemoteCommon.collectInfo(pullConfig).then(_show);
    return defer.promise;
}
