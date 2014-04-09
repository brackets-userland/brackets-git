define(function (require, exports, module) {
    "use strict";

    var _                   = brackets.getModule("thirdparty/lodash"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        StateManager        = PreferencesManager.stateManager,
        prefix              = "brackets-git";

    var defaultPreferences = {
        // features
        "stripWhitespaceFromCommits": {     "type": "boolean",           "value": true              },
        "addEndlineToTheEndOfFile": {       "type": "boolean",           "value": true              },
        "removeByteOrderMark": {            "type": "boolean",           "value": true              },
        "normalizeLineEndings": {           "type": "boolean",           "value": false             },
        "useGitGutter": {                   "type": "boolean",           "value": true              },
        "markModifiedInTree": {             "type": "boolean",           "value": true              },
        "useCodeInspection": {              "type": "boolean",           "value": true              },
        "useGitFtp": {                      "type": "boolean",           "value": false             },
        "avatarType": {                     "type": "string",            "value": "AVATAR_COLOR"    },
        "showBashButton": {                 "type": "boolean",           "value": true              },
        "dateMode": {                       "type": "number",            "value": 1                 },
        "dateFormat": {                     "type": "string",            "value": null              },
        "showReportBugButton": {            "type": "boolean",           "value": true              },
        "storePlainTextPasswords": {        "type": "boolean",           "value": false             },
        "enableAdvancedFeatures": {         "type": "boolean",           "value": false             },
        // shortcuts
        "panelShortcut": {                  "type": "string",            "value": "Ctrl-Alt-G"      },
        "commitCurrentShortcut": {          "type": "string",            "value": null              },
        "commitAllShortcut": {              "type": "string",            "value": null              },
        "bashShortcut": {                   "type": "string",            "value": null              },
        "pushShortcut": {                   "type": "string",            "value": null              },
        "pullShortcut": {                   "type": "string",            "value": null              },
        "gotoPrevChangeShortcut": {         "type": "string",            "value": null              },
        "gotoNextChangeShortcut": {         "type": "string",            "value": null              },
        // system
        "debugMode": {                      "type": "boolean",           "value": false             },
        "TIMEOUT_VALUE": {                  "type": "number",            "value": 30000             },
        "gitIsInSystemPath": {              "type": "boolean",           "value": false             },
        "defaultRemotes": {                 "type": "object",            "value": {}                },
        // platform specific
        "gitPath": {
            "type": "string",
            "os": {
                "win":      { "value": "C:\\Program Files (x86)\\Git\\bin\\git.exe" },
                "mac":      { "value": "/usr/local/git/bin/git" },
                "linux":    { "value": "/usr/bin/git" }
            }
        },
        "terminalCommand": {
            "type": "string",
            "os": {
                "win":      { "value": "C:\\Program Files (x86)\\Git\\Git Bash.vbs" },
                "mac":      { "value": null },
                "linux":    { "value": null }
            }
        },
        "terminalCommandArgs": {
            "type": "string",
            "os": {
                "win":      { "value": "$1" },
                "mac":      { "value": null },
                "linux":    { "value": null }
            }
        }
    };

    var prefs = PreferencesManager.getExtensionPrefs(prefix);
    _.each(defaultPreferences, function (definition, key) {
        if (definition.os && definition.os[brackets.platform]) {
            prefs.definePreference(key, definition.type, definition.os[brackets.platform].value);
        } else {
            prefs.definePreference(key, definition.type, definition.value);
        }
    });
    prefs.save();

    function get(key) {
        var location = defaultPreferences[key] ? PreferencesManager : StateManager;
        arguments[0] = prefix + "." + key;
        return location.get.apply(location, arguments);
    }

    function set(key) {
        var location = defaultPreferences[key] ? PreferencesManager : StateManager;
        arguments[0] = prefix + "." + key;
        return location.set.apply(location, arguments);
    }

    function getAll() {
        var obj = {};
        _.each(defaultPreferences, function (definition, key) {
            obj[key] = get(key);
        });
        return obj;
    }

    function getDefaults() {
        var obj = {};
        _.each(defaultPreferences, function (definition, key) {
            var defaultValue;
            if (definition.os && definition.os[brackets.platform]) {
                defaultValue = definition.os[brackets.platform].value;
            } else {
                defaultValue = definition.value;
            }
            obj[key] = defaultValue;
        });
        return obj;
    }

    function getType(key) {
        return defaultPreferences[key].type;
    }

    function getGlobal(key) {
        return PreferencesManager.get(key);
    }

    function persist(key, value) {
        // TODO: remote this method
        set(key, value);
        save();
    }

    function save() {
        PreferencesManager.save();
        StateManager.save();
    }

    module.exports = {
        get: get,
        set: set,
        getAll: getAll,
        getDefaults: getDefaults,
        getType: getType,
        getGlobal: getGlobal,
        persist: persist,
        save: save
    };

});
