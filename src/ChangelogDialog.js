/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define, Mustache */

define(function (require, exports) {
    "use strict";

    var Dialogs                    = brackets.getModule("widgets/Dialogs"),
        FileEntry                  = brackets.getModule("file/NativeFileSystem").NativeFileSystem.FileEntry,
        FileUtils                  = brackets.getModule("file/FileUtils"),
        StringUtils                = brackets.getModule("utils/StringUtils"),
        Strings                    = require("../strings"),
        changelogDialogTemplate    = require("text!htmlContent/git-changelog-dialog.html");

    var dialog,
        preferences;

    exports.show = function (prefs) {
        if (prefs) {
            preferences = prefs;
        }

        Strings.EXTENSION_VERSION = prefs.getValue("lastVersion");
        var title = StringUtils.format(Strings.EXTENSION_WAS_UPDATED_TITLE, Strings.EXTENSION_VERSION);
        var compiledTemplate = Mustache.render(changelogDialogTemplate, {Strings: Strings, TITLE: title});
        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

        FileUtils.readAsText(new FileEntry(preferences.getValue("extensionDirectory") + "CHANGELOG.md")).done(function (content) {
            $("#git-changelog", dialog.getElement()).text(content);
        });
    };

});
