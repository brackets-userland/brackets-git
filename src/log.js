/* eslint no-console:0 */

import { getExtensionName } from './extension-info';

export function log(...args) {
  console.log(`[${getExtensionName()}]`, ...args);
}

export function warn(...args) {
  console.warn(`[${getExtensionName()}]`, ...args);
}

export function logError(...args) {
  console.error(`[${getExtensionName()}]`, ...args);
}
