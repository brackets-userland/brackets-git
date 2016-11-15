import * as Preferences from "../Preferences";
import * as Promise from "bluebird";
import * as RemoteCommon from "./RemoteCommon";
import * as Strings from "strings";
import { Dialogs, Mustache } from "../brackets-modules";

const template = require("text!src/dialogs/templates/pull-dialog.html");
const remotesTemplate = require("text!src/dialogs/templates/remotes-template.html");
const credentialsTemplate = require("text!src/dialogs/templates/credentials-template.html");

let defer;
let pullConfig;

function _attachEvents($dialog) {
    RemoteCommon.attachCommonEvents(pullConfig, $dialog);

    // load last used
    $dialog
        .find("input[name='strategy']")
        .filter("[value='" + (Preferences.get("pull.strategy") || "DEFAULT") + "']")
        .prop("checked", true);
}

function _show() {
    const templateArgs = {
        config: pullConfig,
        mode: "PULL_FROM",
        modeLabel: Strings.PULL_FROM,
        Strings
    };
    const compiledTemplate = Mustache.render(template, templateArgs, {
        credentials: credentialsTemplate,
        remotes: remotesTemplate
    });
    const dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
    const $dialog = dialog.getElement();

    _attachEvents($dialog);

    dialog.done((buttonId) => {
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
