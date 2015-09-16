import EventEmitter from 'eventemitter';
import Preferences from './preferences';
import { debug, logError } from './log';

//const debugOn = Preferences.get('debugMode');
const debugOn = true;
const emInstance = new EventEmitter({ wildcard: false });

if (debugOn) {
  emInstance._emit = emInstance.emit;
  emInstance.emit = function (eventName, ...args) {

    if (!eventName) {
      throw new Error('no event has been thrown!');
    }

    let listenersCount = this.listeners(eventName).length;
    let argsString = args.map(function (arg) {
      if (arg === null) {
        return 'null';
      }
      if (typeof arg === 'undefined') {
        return 'undefined';
      }
      if (typeof arg === 'function') {
        return 'function(){...}';
      }
      if (!arg.toString) {
        return Object.prototype.toString.call(arg);
      }
      return arg.toString();
    }).join(', ');

    if (argsString) {
      argsString = ' - ' + argsString;
    }

    argsString = argsString + ' (' + listenersCount + ' listeners)';

    if (eventName === 'newListener' && args[0] == null) {
      logError('Event invoked: ' + eventName + argsString);
    } else if (eventName !== 'newListener') {
      debug('Event invoked: ' + eventName + argsString);
    }

    return this._emit.apply(this, arguments);
  };
}

export default emInstance;
