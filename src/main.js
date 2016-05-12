import './lib/branch';
import './menu-entries';
import './ui/panel';
import EventEmitter from './event-emitter';
import Events from './events';
import findGit from './git/find-git';
import { handleError } from './error-handler';
import store from './store';
import Strings from 'strings';
import ToolbarGitIcon from './react-components/toolbar-git-icon';
import * as ChangelogDialog from './dialogs/changelog-dialog';
import * as Preferences from './preferences';
import * as SettingsDialog from './dialogs/settings-dialog';
import { AppInit, CommandManager, Commands, ExtensionUtils, Menus, React, ReactDOM } from './brackets';
import { getExtensionName, getExtensionVersion } from './extension-info';

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
async function displayExtensionInfoIfNeeded() {

  // do not display dialogs when running tests
  if (window.isBracketsTestWindow) { return; }

  const lastVersion = Preferences.get('lastVersion');
  const currentVersion = getExtensionVersion();

  if (!lastVersion) {
    Preferences.set('lastVersion', 'firstStart');
    await SettingsDialog.show();
  } else if (lastVersion !== currentVersion) {
    Preferences.set('lastVersion', currentVersion);
    await ChangelogDialog.show();
  }

}

async function init() {

  const ReactComponents = [
    {
      name: 'toolbar-git-icon',
      component: ToolbarGitIcon,
      target: '#main-toolbar .buttons'
    }
  ];

  const render = () => {
    ReactComponents.forEach(obj => {

      const container = $('<div/>')
        .addClass(`brackets-git-${obj.name}-container`)
        .appendTo(obj.target).get(0);

      const Component = obj.component;
      ReactDOM.render(
        <Component {...store.getState()} />,
        container
      );

    });
  };

  store.subscribe(render);
  render();

  try {
    Strings.GIT_VERSION = await findGit();
  } catch (err) {
    await handleError(Strings.CHECK_GIT_SETTINGS, err);
    EventEmitter.emit(Events.GIT_NOT_WORKING, err);
    return;
  }

  await displayExtensionInfoIfNeeded();
  EventEmitter.emit(Events.GIT_WORKING);

}

AppInit.htmlReady(() => init());
