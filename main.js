/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

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
    var SettingsDialog  = require("src/SettingsDialog"),
        EventEmitter    = require("src/EventEmitter"),
        Events          = require("src/Events"),
        Main            = require("src/Main"),
        Preferences     = require("src/Preferences"),
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
    if (Preferences.get("showTerminalIcon")) { modules.push("src/TerminalIcon"); }
    require(modules);

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "styles/brackets-git.less");
    ExtensionUtils.loadStyleSheet(module, "styles/fonts/octicon.less");
    if (Preferences.get("useGitFtp")) { ExtensionUtils.loadStyleSheet(module, "src/ftp/styles/ftp.less"); }

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

    // keeps checking errors coming into console and logs all installed extensions when node problem is encountered
    /* remove, see https://github.com/zaggino/brackets-git/issues/906
    window.console.error = _.wrap(window.console.error, function (consoleError) {
        // inspect the error
        var msg = arguments[1];
        if (typeof msg !== "string") {
            msg = msg.toString();
        }
        var hasCommonError = _.any([
            "[Launcher] uncaught exception at top level, exiting.",
            "Max connection attempts reached",
            "[brackets-git] getInstalledExtensions"
        ], function (str) {
            return msg.indexOf(str) !== -1;
        });
        if (hasCommonError) {
            var installedExtensions = ExtensionInfo.getInstalledExtensions();
            _.each(nodeDomains, function (domains, key) {
                if (installedExtensions[key]) {
                    installedExtensions[key]["node-domains"] = "YES";
                }
            });
            console.table(installedExtensions);
            console.log("These files were using Brackets' NodeConnection:\n" + _.map(nodeDomains, function (arr) {
                return arr.join("\n");
            }).join("\n"));
        }
        // call the normal console error
        return consoleError.apply(this, _.toArray(arguments).slice(1));
    });
    */

});
