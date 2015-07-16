import { CommandManager, Commands, ExtensionUtils, Menus } from './brackets';
import EventEmitter from './event-emitter';
import Events from './events';
import SettingsDialog from './dialogs/settings-dialog';
import Strings from 'strings';
import PackageJsonStr from 'text!../package.json';
const PackageJson = JSON.parse(PackageJsonStr);

// load stylesheets
ExtensionUtils.loadStyleSheet(module, '../styles/main.less');

// register command for the settings dialog and add it to the brackets menu
const SETTINGS_COMMAND_ID = `${PackageJson.name}-${PackageJson.version}.settings-dialog`;
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

async function init() {
  console.log(`brackets-git 1.0 started!`);
}

init();
