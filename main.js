/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

define(function (require, exports, module) {

    // Brackets modules
    var AppInit         = brackets.getModule("utils/AppInit"),
        CommandManager  = brackets.getModule("command/CommandManager"),
        Commands        = brackets.getModule("command/Commands"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        Menus           = brackets.getModule("command/Menus");

    // Local modules
    var ChangelogDialog = require("src/ChangelogDialog"),
        EventEmitter    = require("src/EventEmitter"),
        Events          = require("src/Events"),
        ExtensionInfo   = require("src/ExtensionInfo"),
        Main            = require("src/Main"),
        Preferences     = require("src/Preferences"),
        SettingsDialog  = require("src/SettingsDialog"),
        Strings         = require("strings");

    // Load extension modules that are not included by core
    var modules = [
        "src/BracketsEvents",
        "src/GutterManager",
        "src/History",
        "src/NoRepo",
        "src/ProjectTreeMarks",
        "src/Remotes",
        "src/utils/Terminal"
    ];
    if (Preferences.get("useGitFtp")) { modules.push("src/ftp/Ftp"); }
    if (Preferences.get("showTerminalIcon")) { modules.push("src/terminalicon/TerminalIcon"); }
    require(modules);

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "styles/brackets-git.less");
    ExtensionUtils.loadStyleSheet(module, "styles/fonts/octicon.less");
    if (Preferences.get("useGitFtp")) { ExtensionUtils.loadStyleSheet(module, "styles/src/ftp/styles/ftp.less"); }

    // Display settings panel on first start / changelog dialog on version change
    ExtensionInfo.get().then(function (packageJson) {
        // do not display dialogs when running tests
        if (window.isBracketsTestWindow) {
            return;
        }

        var lastVersion    = Preferences.get("lastVersion"),
            currentVersion = packageJson.version;

        if (!lastVersion) {
            Preferences.persist("lastVersion", "firstStart");
            SettingsDialog.show();
        } else if (lastVersion !== currentVersion) {
            Preferences.persist("lastVersion", currentVersion);
            ChangelogDialog.show();
        }
    });

    // Register command and add it to the menu.
    var SETTINGS_COMMAND_ID = "brackets-git.settings";
    CommandManager.register(Strings.GIT_SETTINGS, SETTINGS_COMMAND_ID, SettingsDialog.show);
    Menus.getMenu(Menus.AppMenuBar.FILE_MENU).addMenuItem(SETTINGS_COMMAND_ID, "", Menus.AFTER, Commands.FILE_PROJECT_SETTINGS);

    AppInit.appReady(function () {
        Main.init();
    });

    // export API's for other extensions
    if (typeof window === "object") {
        window.bracketsGit = {
            EventEmitter: EventEmitter,
            Events: Events
        };
    }

});
