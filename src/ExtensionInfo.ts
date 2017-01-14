import { _, ExtensionManager, ExtensionUtils, FileSystem, FileUtils } from "./brackets-modules";
import * as Promise from "bluebird";

let packageJson;

function getPackageJsonPath() {
    const extensionPath = window.bracketsGit.getExtensionPath();
    return extensionPath + "package.json";
}

// immediately read the package json info
let jsonPromise;

// gets the promise for extension info which will be resolved once the package.json is read
export function get() {
    if (jsonPromise) {
        return jsonPromise;
    }
    const readPromise = FileUtils.readAsText(FileSystem.getFileForPath(getPackageJsonPath()));
    jsonPromise = Promise.cast(readPromise)
        .then((content) => {
            packageJson = JSON.parse(content);
            return packageJson;
        });
    return jsonPromise;
}

// gets the extension info from package.json, should be safe to call once extension is loaded
export function getSync() {
    if (packageJson) {
        return packageJson;
    }
    throw new Error("[brackets-git] package.json is not loaded yet!");
}

// triggers the registry download if registry hasn't been downloaded yet
function loadRegistryInfo() {
    const registryInfo = ExtensionManager.extensions[packageJson.name].registryInfo;
    if (!registryInfo) {
        return Promise.cast(ExtensionManager.downloadRegistry());
    }
    return Promise.resolve();
}

// gets the latest version that is available in the extension registry or null if something fails
function getLatestRegistryVersion() {
    return loadRegistryInfo().then(() => {
        const registryInfo = ExtensionManager.extensions[packageJson.name].registryInfo;
        return registryInfo.metadata.version;
    }).catch(() => {
        return null;
    });
}

// responds to callback with: hasLatestVersion, currentVersion, latestVersion
export function hasLatestVersion(callback) {
    getLatestRegistryVersion().then((registryVersion) => {
        if (registryVersion === null) {
            return callback(true, packageJson.version, "unknown");
        }
        const has = packageJson.version >= registryVersion;
        callback(has, packageJson.version, registryVersion);
    });
}

export function getInstalledExtensions() {
    const rv = {};
    _.each(ExtensionManager.extensions, (obj, name) => {
        if (obj.installInfo && obj.installInfo.locationType !== "default") {
            rv[name] = {
                name: obj.installInfo.metadata.title,
                version: obj.installInfo.metadata.version
            };
        }
    });
    return rv;
}
