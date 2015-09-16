import Events from '../events';
import EventEmitter from '../event-emitter';
import Preferences from '../preferences';
import { WorkspaceManager } from '../brackets';

const PANEL_ID = 'brackets-git-bottom-panel';
const PANEL_MIN_HEIGHT = 100;
const $panelContainer = $(`<div id="${PANEL_ID}"/>`);
const panelInstance = WorkspaceManager.createBottomPanel(PANEL_ID, $panelContainer, PANEL_MIN_HEIGHT);

/*
React.render(<RegistryDialog/>, $dialog[0]);
dialog.done(() => {
  React.unmountComponentAtNode($dialog[0]);
  afterClose();
});
*/

export function toggle(bool) {
  let isVisible = panelInstance.isVisible();
  if (typeof bool !== 'boolean') {
    bool = !isVisible;
  } else if (bool === isVisible) {
    return;
  }

  panelInstance.setVisible(bool);
  Preferences.set('panel.shown', bool);
  EventEmitter.emit(Events.PANEL_TOGGLED, bool);
}

// init only when git is configured properly
EventEmitter.on(Events.GIT_WORKING, function () {
  toggle(Preferences.get('panel.shown'));
});
