import Events from './events';
import EventEmitter from './event-emitter';

export function toggle() {
  let enabled = true;
  EventEmitter.emit(Events.PANEL_TOGGLED, enabled);
}
