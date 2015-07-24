/* eslint no-console:0 */

import { getExtensionName } from './extension-info';

export function log(...args) {
  console.log(`[${getExtensionName()}]`, ...args);
}
