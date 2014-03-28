/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

/*jslint plusplus: true, vars: true, nomen: true */
/*global define, brackets */

define(function (require, exports, module) {
    "use strict";

    // Get module dependencies.
    var AppInit                    = brackets.getModule("utils/AppInit"),
        CommandManager             = brackets.getModule("command/CommandManager"),
        Commands                   = brackets.getModule("command/Commands"),
        ExtensionUtils             = brackets.getModule("utils/ExtensionUtils"),
        Menus                      = brackets.getModule("command/Menus");

    var ExtensionInfo              = require("src/ExtensionInfo"),
        Preferences                = require("src/Preferences"),
        ExtensionMain              = require("src/Main"),
        ChangelogDialog            = require("src/ChangelogDialog"),
        SettingsDialog             = require("src/SettingsDialog"),
        Strings                    = require("strings");

    // Load extension modules that are not included by core
    var modules = ["src/Remotes"];
    if (Preferences.get("useGitFtp")) {
        modules.push("src/Ftp/Ftp");
    }
    require(modules);

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");
    ExtensionUtils.loadStyleSheet(module, "less/fonts/octicon.less");

    // Handle settings dialog
    function openSettingsPanel() {
        SettingsDialog.show();
    }

    // Display settings panel on first start / changelog dialog on version change
    ExtensionInfo.get().then(function (packageJson) {
        var lastVersion    = Preferences.get("lastVersion"),
            currentVersion = packageJson.version;

        if (lastVersion === null) {
            Preferences.persist("lastVersion", "firstStart");
            openSettingsPanel();
        } else if (lastVersion !== currentVersion) {
            Preferences.persist("lastVersion", currentVersion);
            ChangelogDialog.show();
        }
    });

    // Register command and add it to the menu.
    var SETTINGS_COMMAND_ID = "brackets-git.settings";
    CommandManager.register(Strings.GIT_SETTINGS, SETTINGS_COMMAND_ID, openSettingsPanel);
    Menus.getMenu(Menus.AppMenuBar.FILE_MENU).addMenuItem(SETTINGS_COMMAND_ID, "", Menus.AFTER, Commands.FILE_PROJECT_SETTINGS);

    AppInit.appReady(function () {
        ExtensionMain.init();
    });

});
