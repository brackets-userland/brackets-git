define(function (require, exports, module) {
    "use strict";

    var _                = brackets.getModule("thirdparty/lodash"),
        ExtensionManager = brackets.getModule("extensibility/ExtensionManager"),
        ExtensionUtils   = brackets.getModule("utils/ExtensionUtils"),
        FileSystem       = brackets.getModule("filesystem/FileSystem"),
        FileUtils        = brackets.getModule("file/FileUtils");

    var Promise           = require("bluebird");

    var moduleDirectory   = ExtensionUtils.getModulePath(module),
        packageJsonPath   = moduleDirectory.slice(0, -1 * "src/".length) + "package.json",
        packageJson;

    // immediately read the package json info
    var readPromise = FileUtils.readAsText(FileSystem.getFileForPath(packageJsonPath)),
        jsonPromise = Promise.cast(readPromise)
            .then(function (content) {
                packageJson = JSON.parse(content);
                return packageJson;
            });

    // gets the promise for extension info which will be resolved once the package.json is read
    exports.get = function () {
        return jsonPromise;
    };

    // gets the extension info from package.json, should be safe to call once extension is loaded
    exports.getSync = function () {
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
    exports.hasLatestVersion = function (callback) {
        getLatestRegistryVersion().then(function (registryVersion) {
            if (registryVersion === null) {
                callback(true, packageJson.version, "unknown");
            } else {
                var has = packageJson.version >= registryVersion;
                callback(has, packageJson.version, registryVersion);
            }
        });
    };

    exports.getInstalledExtensions = function () {
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
});
