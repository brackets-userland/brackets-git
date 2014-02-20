/*global brackets, define */

define(function (require, exports, module) {
    "use strict";

    var _                   = brackets.getModule("thirdparty/lodash"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        prefs               = PreferencesManager.getExtensionPrefs("brackets-git");

    var defaultPreferences = {
        // features
        "stripWhitespaceFromCommits": {     "type": "boolean",           "value": true          },
        "addEndlineToTheEndOfFile": {       "type": "boolean",           "value": true          },
        "useGitGutter": {                   "type": "boolean",           "value": true          },
        "markModifiedInTree": {             "type": "boolean",           "value": true          },
        // shortcuts
        "panelShortcut": {                  "type": "string",            "value": "Ctrl-Alt-G"  },
        "commitCurrentShortcut": {          "type": "string",            "value": null          },
        "commitAllShortcut": {              "type": "string",            "value": null          },
        // system
        "lastVersion": {                    "type": "string",            "value": null          },
        "panelEnabled": {                   "type": "boolean",           "value": true          },
        "TIMEOUT_VALUE": {                  "type": "number",            "value": 30000         },
        "terminalCommand": {                "type": "string",            "value": null          },
        "extensionDirectory": {             "type": "string",            "value": undefined     },
        // platform specific
        "gitIsInSystemPath": {
            "type": "boolean",
            "os": {
                "win":      { "value": true },
                "mac":      { "value": false },
                "linux":    { "value": false }
            }
        },
        "gitPath": {
            "type": "string",
            "os": {
                "win":      { "value": "C:\\Program Files (x86)\\Git\\bin\\git.exe" },
                "mac":      { "value": "/usr/local/git/bin/git" },
                "linux":    { "value": "/usr/bin/git" }
            }
        },
        "msysgitPath": {
            "type": "string",
            "os": {
                "win":      { "value": "C:\\Program Files (x86)\\Git\\" },
                "mac":      { "value": null },
                "linux":    { "value": null }
            }
        }
    };

    _.each(defaultPreferences, function (definition, key) {
        if (definition.os && definition.os[brackets.platform]) {
            prefs.definePreference(key, definition.type, definition.os[brackets.platform].value);
        } else {
            prefs.definePreference(key, definition.type, definition.value);
        }
    });
    prefs.save();

    prefs.getAll = function () {
        var obj = {};
        _.each(defaultPreferences, function (definition, key) {
            obj[key] = this.get(key);
        }, this);
        return obj;
    };

    prefs.getDefaults = function () {
        var obj = {};
        _.each(defaultPreferences, function (definition, key) {
            var defaultValue;
            if (definition.os && definition.os[brackets.platform]) {
                defaultValue = definition.os[brackets.platform].value;
            } else {
                defaultValue = definition.value;
            }
            obj[key] = defaultValue;
        }, this);
        return obj;
    };

    prefs.persist = function (key, value) {
        this.set(key, value);
        this.save();
    };

    module.exports = prefs;
});
