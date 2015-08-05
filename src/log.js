/* eslint no-console:0 */

import { getExtensionName } from './extension-info';

const prefix = `[${getExtensionName()}]`;

export function log(...args) {
  console.log(prefix, ...args);
}

export function warn(...args) {
  console.warn(prefix, ...args);
}

export function logError(...args) {
  console.error(prefix, ...args);
}
