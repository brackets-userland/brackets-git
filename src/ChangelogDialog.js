define(function (require, exports) {
    "use strict";

    var Dialogs                    = brackets.getModule("widgets/Dialogs"),
        FileSystem                 = brackets.getModule("filesystem/FileSystem"),
        FileUtils                  = brackets.getModule("file/FileUtils"),
        Mustache                   = brackets.getModule("thirdparty/mustache/mustache"),
        StringUtils                = brackets.getModule("utils/StringUtils"),
        Utils                      = require("src/Utils"),
        Preferences                = require("./Preferences"),
        Strings                    = require("../strings"),
        changelogDialogTemplate    = require("text!templates/git-changelog-dialog.html"),
        marked                     = require("marked");

    var dialog;

    exports.show = function () {
        Strings.EXTENSION_VERSION = Preferences.get("lastVersion");
        var title = StringUtils.format(Strings.EXTENSION_WAS_UPDATED_TITLE, Strings.EXTENSION_VERSION);
        var compiledTemplate = Mustache.render(changelogDialogTemplate, { Strings: Strings, TITLE: title });
        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

        FileUtils.readAsText(FileSystem.getFileForPath(Utils.getExtensionDirectory() + "CHANGELOG.md")).done(function (content) {
            content = marked(content, {
                gfm: true,
                breaks: true
            });
            $("#git-changelog", dialog.getElement()).html(content);
        });
    };

});
