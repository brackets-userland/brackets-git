import { CommandManager, Commands, ExtensionUtils, Menus } from './brackets';
import EventEmitter from './event-emitter';
import Events from './events';
import SettingsDialog from './dialogs/settings-dialog';
import Strings from 'strings';
import { log } from './log';
import { getExtensionName } from './extension-info';

// load stylesheets
ExtensionUtils.loadStyleSheet(module, '../styles/main.less');

// register command for the settings dialog and add it to the brackets menu
const SETTINGS_COMMAND_ID = `${getExtensionName()}.settings-dialog`;
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
  log(`${getExtensionName()} started!`);
}

init();
