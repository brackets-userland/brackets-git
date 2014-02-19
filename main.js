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

    window.bracketsGit = {
        debug: false
    };

    // Get module dependencies.
    var q                          = require("./thirdparty/q"),
        AppInit                    = brackets.getModule("utils/AppInit"),
        CommandManager             = brackets.getModule("command/CommandManager"),
        Commands                   = brackets.getModule("command/Commands"),
        ExtensionUtils             = brackets.getModule("utils/ExtensionUtils"),
        Menus                      = brackets.getModule("command/Menus"),
        NodeConnection             = brackets.getModule("utils/NodeConnection"),
        PreferencesManager         = brackets.getModule("preferences/PreferencesManager"),
        moduleDirectory            = ExtensionUtils.getModulePath(module),
        ExtInfo                    = require("./ExtInfo");

    // This should be set before loading any more files that may depend on this
    ExtInfo.init(moduleDirectory);

    var DefaultPreferences         = require("./DefaultPreferences"),
        ExtensionMain              = require("./src/Main"),
        Strings                    = require("./strings"),
        ChangelogDialog            = require("./src/ChangelogDialog"),
        ErrorHandler               = require("./src/ErrorHandler"),
        ExpectedError              = require("./src/ExpectedError"),
        SettingsDialog             = require("./src/SettingsDialog"),
        SETTINGS_COMMAND_ID        = "brackets-git.settings",
        domainModulePath           = moduleDirectory + "domain",
        nodeConnection             = new NodeConnection();

    // Seems just too buggy right now
    q.stopUnhandledRejectionTracking();

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");
    ExtensionUtils.loadStyleSheet(module, "less/fonts/octicon.less");

    // Initialize PreferenceStorage.
    var preferences = PreferencesManager.getPreferenceStorage(module, DefaultPreferences);
    preferences.setValue("extensionDirectory", moduleDirectory);

    // Handle settings dialog
    function openSettingsPanel() {
        SettingsDialog.show(preferences);
    }

    // Display settings panel on first start / changelog dialog on version change
    ExtInfo.get(function (packageJson) {
        var lastVersion    = preferences.getValue("lastVersion"),
            currentVersion = packageJson.version;

        if (lastVersion === null) {
            preferences.setValue("lastVersion", "firstStart");
            openSettingsPanel();
        } else if (lastVersion !== currentVersion) {
            preferences.setValue("lastVersion", currentVersion);
            ChangelogDialog.show(preferences);
        }
    });

    // Register command and add it to the menu.
	CommandManager.register(Strings.GIT_SETTINGS, SETTINGS_COMMAND_ID, openSettingsPanel);
	Menus.getMenu(Menus.AppMenuBar.FILE_MENU).addMenuItem(SETTINGS_COMMAND_ID, "", Menus.AFTER, Commands.FILE_PROJECT_SETTINGS);

    AppInit.appReady(function () {
        // Connects to Node
        nodeConnection.connect(true).fail(function (err) {
            ErrorHandler.showError(new ExpectedError(err), "Failed to connect to Node.js, extension requires Node.js installed");
        }).then(function () {
            // Register the domain.
            return nodeConnection.loadDomains([domainModulePath], true).fail(function (err) {
                ErrorHandler.showError(new ExpectedError(err), "Failed to register Node.js domain, extension requires Node.js installed");
            });
        }).then(function () {
            ExtensionMain.init(nodeConnection, preferences);
        }).done();
    });

});
