/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

/*jslint plusplus: true, vars: true, nomen: true */
/*global define, brackets, console, setTimeout */

define(function (require, exports, module) {
    "use strict";

    // Get module dependencies.
    var q                          = require("./thirdparty/q"),
        AppInit                    = brackets.getModule("utils/AppInit"),
        CommandManager             = brackets.getModule("command/CommandManager"),
        Commands                   = brackets.getModule("command/Commands"),
        ExtensionUtils             = brackets.getModule("utils/ExtensionUtils"),
        FileSystem                 = brackets.getModule("filesystem/FileSystem"),
        FileUtils                  = brackets.getModule("file/FileUtils"),
        Menus                      = brackets.getModule("command/Menus"),
        NodeConnection             = brackets.getModule("utils/NodeConnection"),
        PreferencesManager         = brackets.getModule("preferences/PreferencesManager"),
        DefaultPreferences         = require("./DefaultPreferences"),
        ExtensionMain              = require("./src/Main"),
        Strings                    = require("./strings"),
        ChangelogDialog            = require("./src/ChangelogDialog"),
        SettingsDialog             = require("./src/SettingsDialog"),
        SETTINGS_COMMAND_ID        = "brackets-git.settings",
        moduleDirectory            = ExtensionUtils.getModulePath(module),
        domainModulePath           = moduleDirectory + "domain",
        nodeConnection             = new NodeConnection();

    // Seems just too buggy right now
    q.stopUnhandledRejectionTracking();

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");

    // Initialize PreferenceStorage.
    var preferences = PreferencesManager.getPreferenceStorage(module, DefaultPreferences);
    preferences.setValue("extensionDirectory", moduleDirectory);

    // Handle settings dialog
    function openSettingsPanel() {
        SettingsDialog.show(preferences);
    }

    // Load package.json - delay this so perf utils doesn't conflict with brackets loading the same file
    setTimeout(function () {
        FileUtils.readAsText(FileSystem.getFileForPath(moduleDirectory + "package.json")).done(function (content) {
            var lastVersion    = preferences.getValue("lastVersion"),
                currentVersion = JSON.parse(content).version;

            if (lastVersion === null) {
                preferences.setValue("lastVersion", "firstStart");
                openSettingsPanel();
            } else if (lastVersion !== currentVersion) {
                preferences.setValue("lastVersion", currentVersion);
                ChangelogDialog.show(preferences);
            }
        });
    }, 1000);

    // Register command and add it to the menu.
	CommandManager.register(Strings.GIT_SETTINGS, SETTINGS_COMMAND_ID, openSettingsPanel);
	Menus.getMenu(Menus.AppMenuBar.FILE_MENU).addMenuItem(SETTINGS_COMMAND_ID, "", Menus.AFTER, Commands.FILE_PROJECT_SETTINGS);

    AppInit.appReady(function () {
        // Connects to Node
        nodeConnection.connect(true).fail(function (err) {
            console.error("[brackets-git] failed to connect to node");
            console.error(err);
        }).then(function () {
            // Register the domain.
            return nodeConnection.loadDomains([domainModulePath], true).fail(function (err) {
                console.error("[brackets-git] failed to register domain");
                console.error(err);
            });
        }).then(function () {
            ExtensionMain.init(nodeConnection, preferences);
        }).done();
    });

});
