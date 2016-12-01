import { Dialogs, FileSystem, FileUtils, Mustache, StringUtils } from "./brackets-modules";
import * as Utils from "./Utils";
import * as Preferences from "./Preferences";
import * as Strings from "strings";
import * as marked from "marked";

const changelogDialogTemplate = require("text!templates/git-changelog-dialog.html");

let dialog;

export function show() {
    Strings.EXTENSION_VERSION = Preferences.get("lastVersion");
    const title = StringUtils.format(Strings.EXTENSION_WAS_UPDATED_TITLE, Strings.EXTENSION_VERSION);
    const compiledTemplate = Mustache.render(changelogDialogTemplate, { Strings, TITLE: title });
    dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

    FileUtils.readAsText(FileSystem.getFileForPath(Utils.getExtensionDirectory() + "CHANGELOG.md"))
        .done((content) => {
            $("#git-changelog", dialog.getElement()).html(marked(content, {
                gfm: true,
                breaks: true
            }));
        });
}
