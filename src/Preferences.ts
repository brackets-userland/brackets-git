import { _, PreferencesManager } from "./brackets-modules";

const StateManager = PreferencesManager.stateManager;
const prefix = "brackets-git";

const defaultPreferences = {
    // features
    stripWhitespaceFromCommits: { type: "boolean", value: true },
    addEndlineToTheEndOfFile: { type: "boolean", value: true },
    removeByteOrderMark: { type: "boolean", value: false },
    normalizeLineEndings: { type: "boolean", value: false },
    useGitGutter: { type: "boolean", value: true },
    markModifiedInTree: { type: "boolean", value: true },
    useCodeInspection: { type: "boolean", value: true },
    useGitFtp: { type: "boolean", value: false },
    avatarType: { type: "string", value: "AVATAR_COLOR" },
    showBashButton: { type: "boolean", value: true },
    dateMode: { type: "number", value: 1 },
    dateFormat: { type: "string", value: null },
    enableAdvancedFeatures: { type: "boolean", value: false },
    useVerboseDiff: { type: "boolean", value: false },
    useDifftool: { type: "boolean", value: false },
    clearWhitespaceOnSave: { type: "boolean", value: false },
    gerritPushref: { type: "boolean", value: false },
    // shortcuts
    panelShortcut: { type: "string", value: "Ctrl-Alt-G" },
    commitCurrentShortcut: { type: "string", value: null },
    commitAllShortcut: { type: "string", value: null },
    bashShortcut: { type: "string", value: null },
    pushShortcut: { type: "string", value: null },
    pullShortcut: { type: "string", value: null },
    gotoPrevChangeShortcut: { type: "string", value: null },
    gotoNextChangeShortcut: { type: "string", value: null },
    refreshShortcut: { type: "string", value: null },
    showTerminalIcon: { type: "boolean", value: false },
    // system
    debugMode: { type: "boolean", value: false },
    gitTimeout: { type: "number", value: 30 },
    gitPath: { type: "string", value: "" },
    terminalCommand: { type: "string", value: "" },
    terminalCommandArgs: { type: "string", value: "" }
};

const prefs = PreferencesManager.getExtensionPrefs(prefix);
_.each(defaultPreferences, (definition, key) => {
    if (definition.os && definition.os[brackets.platform]) {
        prefs.definePreference(key, definition.type, definition.os[brackets.platform].value);
    } else {
        prefs.definePreference(key, definition.type, definition.value);
    }
});
prefs.save();

export function get(key, ...rest) {
    const location = defaultPreferences[key] ? PreferencesManager : StateManager;
    return location.get(prefix + "." + key, ...rest);
}

export function set(key, ...rest) {
    const location = defaultPreferences[key] ? PreferencesManager : StateManager;
    return location.set(prefix + "." + key, ...rest);
}

export function getAll() {
    const obj = {};
    _.each(defaultPreferences, (definition, key) => {
        obj[key] = get(key);
    });
    return obj;
}

export function getDefaults() {
    const obj = {};
    _.each(defaultPreferences, (definition, key) => {
        let defaultValue;
        if (definition.os && definition.os[brackets.platform]) {
            defaultValue = definition.os[brackets.platform].value;
        } else {
            defaultValue = definition.value;
        }
        obj[key] = defaultValue;
    });
    return obj;
}

export function getType(key) {
    return defaultPreferences[key].type;
}

export function getGlobal(key) {
    return PreferencesManager.get(key);
}

export function persist(key, value) {
    // FUTURE: remote this method
    set(key, value);
    save();
}

export function save() {
    PreferencesManager.save();
    StateManager.save();
}
