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
    var q                          = require("./thirdparty/q"),
        AppInit                    = brackets.getModule("utils/AppInit"),
        CommandManager             = brackets.getModule("command/CommandManager"),
        Commands                   = brackets.getModule("command/Commands"),
        ExtensionUtils             = brackets.getModule("utils/ExtensionUtils"),
        Menus                      = brackets.getModule("command/Menus"),
        NodeConnection             = brackets.getModule("utils/NodeConnection"),
        moduleDirectory            = ExtensionUtils.getModulePath(module);

    var ExtensionInfo              = require("src/ExtensionInfo"),
        Preferences                = require("src/Preferences"),
        ExtensionMain              = require("src/Main"),
        ChangelogDialog            = require("src/ChangelogDialog"),
        ErrorHandler               = require("src/ErrorHandler"),
        ExpectedError              = require("src/ExpectedError"),
        SettingsDialog             = require("src/SettingsDialog"),
        Strings                    = require("strings"),
        domainModulePath           = moduleDirectory + "src/Domains/cli",
        nodeConnection             = new NodeConnection();

    // Load extension sources
    require("src/Remotes");
    require("src/Ftp"); // TODO: maybe only if FTP is enabled?

    // Seems just too buggy right now
    q.stopUnhandledRejectionTracking();

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");
    ExtensionUtils.loadStyleSheet(module, "less/fonts/octicon.less");

    // Initialize PreferenceStorage.
    Preferences.persist("extensionDirectory", moduleDirectory);

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
        // Connects to Node
        nodeConnection.connect(true).fail(function (err) {
            ErrorHandler.showError(new ExpectedError(err), "Failed to connect to Node.js, extension requires Node.js installed");
        }).then(function () {
            // Register the domain.
            return nodeConnection.loadDomains([domainModulePath], true).fail(function (err) {
                ErrorHandler.showError(new ExpectedError(err), "Failed to register Node.js domain, extension requires Node.js installed");
            });
        }).then(function () {
            ExtensionMain.init(nodeConnection);
        }).done();
    });

});
