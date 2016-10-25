import * as Promise from "bluebird";
import * as RemoteCommon from "./RemoteCommon";
import * as Strings from "strings";
import { Dialogs, Mustache } from "../brackets-modules";

const template = require("text!src/dialogs/templates/clone-dialog.html");
const credentialsTemplate = require("text!src/dialogs/templates/credentials-template.html");

let defer;
let $cloneInput;

function _attachEvents($dialog) {
    // Detect changes to URL, disable auth if not http
    $cloneInput.on("keyup change", () => {
        const $authInputs = $dialog.find("input[name='username'],input[name='password'],input[name='saveToUrl']");
        if ($cloneInput.val().length > 0) {
            if (/^https?:/.test($cloneInput.val())) {
                $authInputs.prop("disabled", false);

                // Update the auth fields if the URL contains auth
                const auth = /:\/\/([^:]+):?([^@]*)@/.exec($cloneInput.val());
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

export function show() {
    defer = Promise.defer();

    const templateArgs = {
        modeLabel: Strings.CLONE_REPOSITORY,
        Strings
    };

    const compiledTemplate = Mustache.render(template, templateArgs, {
        credentials: credentialsTemplate
    });
    const dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
    const $dialog = dialog.getElement();

    $cloneInput = $dialog.find("#git-clone-url");

    _attachEvents($dialog);

    dialog.done((buttonId) => {
        if (buttonId === "ok") {
            const cloneConfig = {
                remote: "origin",
                remoteUrl: $cloneInput.val()
            };
            RemoteCommon.collectValues(cloneConfig, $dialog);
            defer.resolve(cloneConfig);
        } else {
            defer.reject();
        }
    });

    return defer.promise;
}
