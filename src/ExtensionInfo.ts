import { _, ExtensionManager, ExtensionUtils, FileSystem, FileUtils } from "./brackets-modules";
import * as Promise from "bluebird";

var packageJson;

function getPackageJsonPath() {
    const extensionPath = window.bracketsGit.getExtensionPath();
    return extensionPath + "package.json";
}

// immediately read the package json info
var jsonPromise;

// gets the promise for extension info which will be resolved once the package.json is read
export function get() {
    if (jsonPromise) {
        return jsonPromise;
    }
    var readPromise = FileUtils.readAsText(FileSystem.getFileForPath(getPackageJsonPath()));
    jsonPromise = Promise.cast(readPromise)
        .then(function (content) {
            packageJson = JSON.parse(content);
            return packageJson;
        });
    return jsonPromise;
};

// gets the extension info from package.json, should be safe to call once extension is loaded
export function getSync() {
    if (packageJson) {
        return packageJson;
    } else {
        throw new Error("[brackets-git] package.json is not loaded yet!");
    }
};

// triggers the registry download if registry hasn't been downloaded yet
function loadRegistryInfo() {
    var registryInfo = ExtensionManager.extensions[packageJson.name].registryInfo;
    if (!registryInfo) {
        return Promise.cast(ExtensionManager.downloadRegistry());
    } else {
        return Promise.resolve();
    }
}

// gets the latest version that is available in the extension registry or null if something fails
function getLatestRegistryVersion() {
    return loadRegistryInfo().then(function () {
        var registryInfo = ExtensionManager.extensions[packageJson.name].registryInfo;
        return registryInfo.metadata.version;
    }).catch(function () {
        return null;
    });
}

// responds to callback with: hasLatestVersion, currentVersion, latestVersion
export function hasLatestVersion(callback) {
    getLatestRegistryVersion().then(function (registryVersion) {
        if (registryVersion === null) {
            callback(true, packageJson.version, "unknown");
        } else {
            var has = packageJson.version >= registryVersion;
            callback(has, packageJson.version, registryVersion);
        }
    });
};

export function getInstalledExtensions() {
    var rv = {};
    _.each(ExtensionManager.extensions, function (obj, name) {
        if (obj.installInfo && obj.installInfo.locationType !== "default") {
            rv[name] = {
                name: obj.installInfo.metadata.title,
                version: obj.installInfo.metadata.version
            };
        }
    });
    return rv;
};
