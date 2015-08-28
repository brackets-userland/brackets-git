/* eslint no-console:0 */

import { getExtensionName } from './extension-info';

const prefix = `[${getExtensionName()}]`;

export function debug(...args) {
  // TODO: if debug mode is off, do not log
  console.log(prefix, 'DEBUG', ...args);
}

export function log(...args) {
  console.log(prefix, ...args);
}

export function warn(...args) {
  console.warn(prefix, ...args);
}

export function logError(...args) {
  console.error(prefix, ...args);
}
