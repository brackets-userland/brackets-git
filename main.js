/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

/*jslint plusplus: true, vars: true, nomen: true */
/*global define, brackets, console */

define(function (require, exports, module) {
    "use strict";

    // Get module dependencies.
    var AppInit                    = brackets.getModule("utils/AppInit"),
        CommandManager             = brackets.getModule("command/CommandManager"),
        Commands                   = brackets.getModule("command/Commands"),
        ExtensionUtils             = brackets.getModule("utils/ExtensionUtils"),
        FileEntry                  = brackets.getModule("file/NativeFileSystem").NativeFileSystem.FileEntry,
        FileUtils                  = brackets.getModule("file/FileUtils"),
        Menus                      = brackets.getModule("command/Menus"),
        NodeConnection             = brackets.getModule("utils/NodeConnection"),
        PreferencesManager         = brackets.getModule("preferences/PreferencesManager"),
        DefaultPreferences         = require("DefaultPreferences"),
        UiControl                  = require("src/uiControl"),
        Strings                    = require("strings"),
        ChangelogDialog            = require("src/ChangelogDialog"),
        SettingsDialog             = require("src/SettingsDialog"),
        SETTINGS_COMMAND_ID        = "brackets-git.settings",
        moduleDirectory            = ExtensionUtils.getModulePath(module),
        domainModulePath           = moduleDirectory + "src/domain",
        nodeConnection             = new NodeConnection();

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");

    // Initialize PreferenceStorage.
    var preferences = PreferencesManager.getPreferenceStorage(module, DefaultPreferences);
    preferences.setValue("extensionDirectory", moduleDirectory);

    // Handle settings dialog
    function openSettingsPanel() {
        SettingsDialog.show(preferences);
    }

    // Load package.json
    FileUtils.readAsText(new FileEntry(moduleDirectory + "package.json")).done(function (content) {
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
            UiControl.init(nodeConnection, preferences);
        }).done();
    });

});