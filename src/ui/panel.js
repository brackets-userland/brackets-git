import { React, WorkspaceManager } from '../brackets';
import Events from '../events';
import EventEmitter from '../event-emitter';
import Preferences from '../preferences';

const PANEL_ID = 'brackets-git-bottom-panel';
const PANEL_MIN_HEIGHT = 100;
const $panelContainer = $(`<div id="${PANEL_ID}"/>`);
const panelInstance = WorkspaceManager.createBottomPanel(PANEL_ID, $panelContainer, PANEL_MIN_HEIGHT);

class Panel extends React.Component {

  constructor(props) {
    super(props);
  }

  state = {
    count: 1
  }

  handleClick = () => {
    this.setState({
      count: this.state.count + 1
    });
  }

  render = () => {
    return <div onClick={this.handleClick}>
      hello world: {this.state.count}
    </div>;
  }

}

export function toggle(bool) {
  let isVisible = panelInstance.isVisible();
  if (typeof bool !== 'boolean') {
    bool = !isVisible;
  } else if (bool === isVisible) {
    return;
  }

  if (bool) {
    React.render(<Panel/>, $panelContainer[0]);
  } else {
    React.unmountComponentAtNode($panelContainer[0]);
  }

  panelInstance.setVisible(bool);
  Preferences.set('panel.shown', bool);
  EventEmitter.emit(Events.PANEL_TOGGLED, bool);
}

// init only when git is configured properly
EventEmitter.on(Events.GIT_WORKING, function () {
  toggle(Preferences.get('panel.shown'));
});
