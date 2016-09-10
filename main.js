define(function (require, exports, module) {

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        AppInit         = brackets.getModule("utils/AppInit"),
        CommandManager  = brackets.getModule("command/CommandManager"),
        Commands        = brackets.getModule("command/Commands"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        Menus           = brackets.getModule("command/Menus"),
        NodeConnection  = brackets.getModule("utils/NodeConnection");

    // Local modules
    var SettingsDialog  = require("dist/SettingsDialog"),
        EventEmitter    = require("dist/EventEmitter"),
        Events          = require("dist/Events"),
        Main            = require("dist/Main"),
        Preferences     = require("dist/Preferences"),
        Strings         = require("strings");

    // Load extension modules that are not included by core
    var modules = [
        "dist/BracketsEvents",
        "dist/GutterManager",
        "dist/History",
        "dist/NoRepo",
        "dist/ProjectTreeMarks",
        "dist/Remotes",
        "dist/utils/Terminal"
    ];
    if (Preferences.get("useGitFtp")) { modules.push("dist/ftp/Ftp"); }
    if (Preferences.get("showTerminalIcon")) { modules.push("dist/TerminalIcon"); }
    require(modules);

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "styles/brackets-git.less");
    ExtensionUtils.loadStyleSheet(module, "styles/fonts/octicon.less");
    if (Preferences.get("useGitFtp")) { ExtensionUtils.loadStyleSheet(module, "styles/ftp/ftp.less"); }

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
            Events: Events,
            getInstalledExtensions: function () {
                window.console.error("[brackets-git] getInstalledExtensions");
            }
        };
    }

    var nodeDomains = {};

    // keeps a track of who is accessing node domains
    NodeConnection.prototype.loadDomains = _.wrap(NodeConnection.prototype.loadDomains, function (loadDomains) {

        var paths = arguments[1];
        if (!Array.isArray(paths)) { paths = [paths]; }

        var extId = "unknown";
        var stack = new Error().stack.split("\n").slice(2).join("\n");
        var m = stack.match(/extensions\/user\/([^\/]+)/);
        if (m) {
            extId = m[1];
        }

        if (!nodeDomains[extId]) { nodeDomains[extId] = []; }
        nodeDomains[extId] = _.uniq(nodeDomains[extId].concat(paths));

        // call the original method
        return loadDomains.apply(this, _.toArray(arguments).slice(1));
    });

});
