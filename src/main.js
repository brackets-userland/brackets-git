import { AppInit, CommandManager, Commands, ExtensionUtils, Menus } from './brackets';
import EventEmitter from './event-emitter';
import Events from './events';
import * as Preferences from './preferences';
import ChangelogDialog from './dialogs/changelog-dialog';
import SettingsDialog from './dialogs/settings-dialog';
import Strings from 'strings';
import { getExtensionName, getExtensionVersion } from './extension-info';
import { findGit } from './git/find-git';
import { handleError } from './error-handler';

// load without importing
import { } from './icons/git-icon';
import { } from './menu-entries';

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

// display settings panel on first start / changelog dialog on version change
async function _displayExtensionInfoIfNeeded() {

  // do not display dialogs when running tests
  if (window.isBracketsTestWindow) { return; }

  let lastVersion = Preferences.get('lastVersion');
  let currentVersion = getExtensionVersion();

  if (!lastVersion) {
    Preferences.set('lastVersion', 'firstStart');
    await SettingsDialog.show();
  } else if (lastVersion !== currentVersion) {
    Preferences.set('lastVersion', currentVersion);
    await ChangelogDialog.show();
  }
}

function initUi() {
  // TODO: implement
  // FUTURE: do we really need to launch init from here?
  // Panel.init();
  // Branch.init();
  // CloseNotModified.init();
}

async function init() {

  try {
    Strings.GIT_VERSION = await findGit();
  } catch (err) {
    await handleError(Strings.CHECK_GIT_SETTINGS, err);
    EventEmitter.emit(Events.GIT_NOT_WORKING, err);
    return;
  }

  EventEmitter.emit(Events.GIT_WORKING);
  _displayExtensionInfoIfNeeded();
  initUi();

}

AppInit.htmlReady(() => init());
