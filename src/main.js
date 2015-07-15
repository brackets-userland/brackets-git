define(function (require, exports, module) {

  const CommandManager = brackets.getModule('command/CommandManager');
  const Commands = brackets.getModule('command/Commands');
  const EventEmitter = require('./event-emitter');
  const Events = require('./events');
  const ExtensionUtils = brackets.getModule('utils/ExtensionUtils');
  const Menus = brackets.getModule('command/Menus');
  const PackageInfo = JSON.parse(require('text!../package.json'));
  const SettingsDialog = require('./dialogs/settings-dialog');
  const Strings = require('strings');

  // load stylesheets
  ExtensionUtils.loadStyleSheet(module, '../styles/main.less');

  // register command for the settings dialog and add it to the brackets menu
  const SETTINGS_COMMAND_ID = `${PackageInfo.name}-${PackageInfo.version}.settings`;
  CommandManager
    .register(Strings.GIT_SETTINGS, SETTINGS_COMMAND_ID, SettingsDialog.show);
  Menus
    .getMenu(Menus.AppMenuBar.FILE_MENU)
    .addMenuItem(SETTINGS_COMMAND_ID, '', Menus.AFTER, Commands.FILE_PROJECT_SETTINGS);

  // export for other extensions to use
  if (typeof window === 'object') {
    window.bracketsGit = {
      EventEmitter,
      Events
    };
  }

});
