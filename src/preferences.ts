/* eslint quote-props:0, no-multi-spaces:0 */

import { _, PreferencesManager } from './brackets';
import { getExtensionName } from './extension-info';

const StateManager = PreferencesManager.stateManager;
const PREFIX = getExtensionName();

// TODO: check if all these are actually used
const defaultPreferences = {

  // features
  'stripWhitespaceFromCommits': {     'type': 'boolean',           'value': true              },
  'addEndlineToTheEndOfFile': {       'type': 'boolean',           'value': true              },
  'removeByteOrderMark': {            'type': 'boolean',           'value': false             },
  'normalizeLineEndings': {           'type': 'boolean',           'value': false             },
  'useGitGutter': {                   'type': 'boolean',           'value': true              },
  'markModifiedInTree': {             'type': 'boolean',           'value': true              },
  'useCodeInspection': {              'type': 'boolean',           'value': true              },
  'useGitFtp': {                      'type': 'boolean',           'value': false             },
  'avatarType': {                     'type': 'string',            'value': 'AVATAR_COLOR'    },
  'showBashButton': {                 'type': 'boolean',           'value': true              },
  'dateMode': {                       'type': 'number',            'value': 1                 },
  'dateFormat': {                     'type': 'string',            'value': null              },
  'showReportBugButton': {            'type': 'boolean',           'value': true              },
  'enableAdvancedFeatures': {         'type': 'boolean',           'value': false             },
  'useVerboseDiff': {                 'type': 'boolean',           'value': false             },
  'useDifftool': {                    'type': 'boolean',           'value': false             },
  'clearWhitespaceOnSave': {          'type': 'boolean',           'value': false             },
  'gerritPushref': {                  'type': 'boolean',           'value': false             },

  // shortcuts
  'panelShortcut': {                  'type': 'string',            'value': 'Ctrl-Alt-G'      },
  'commitCurrentShortcut': {          'type': 'string',            'value': null              },
  'commitAllShortcut': {              'type': 'string',            'value': null              },
  'bashShortcut': {                   'type': 'string',            'value': null              },
  'pushShortcut': {                   'type': 'string',            'value': null              },
  'pullShortcut': {                   'type': 'string',            'value': null              },
  'gotoPrevChangeShortcut': {         'type': 'string',            'value': null              },
  'gotoNextChangeShortcut': {         'type': 'string',            'value': null              },
  'refreshShortcut': {                'type': 'string',            'value': null              },
  'showTerminalIcon': {               'type': 'boolean',           'value': false             },

  // system
  'debugMode': {                      'type': 'boolean',           'value': false             },
  'gitTimeout': {                     'type': 'number',            'value': 30                },
  'gitPath': {                        'type': 'string',            'value': ''                },
  'terminalCommand': {                'type': 'string',            'value': ''                },
  'terminalCommandArgs': {            'type': 'string',            'value': ''                }
};

(function init() {
  let prefs = PreferencesManager.getExtensionPrefs(PREFIX);
  _.each(defaultPreferences, (definition, key) => { prefs.definePreference(key, definition.type, definition.value); });
  prefs.save();
}());

export function get(...args) {
  let location = defaultPreferences[args[0]] ? PreferencesManager : StateManager;
  args[0] = PREFIX + '.' + args[0];
  return location.get.apply(location, args);
}

export function set(...args) {
  let location = defaultPreferences[args[0]] ? PreferencesManager : StateManager;
  args[0] = PREFIX + '.' + args[0];
  let rv = location.set.apply(location, args);
  location.save();
  return rv;
}

export const getAll = () => _.reduce(defaultPreferences, (obj, def, key) => obj[key] = get(key), {});

export const getDefaults = () => _.reduce(defaultPreferences, (obj, def, key) => obj[key] = def.value, {});

export const getType = (key) => defaultPreferences[key].type;

export const getGlobal = (key) => PreferencesManager.get(key);
