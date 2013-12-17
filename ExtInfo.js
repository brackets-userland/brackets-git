/*global brackets, define */

define(function (require, exports) {
    "use strict";

    var FileSystem = brackets.getModule("filesystem/FileSystem"),
        FileUtils  = brackets.getModule("file/FileUtils");

    var packageJson,
        moduleDirectory;

    function loadInfo(callback) {
        // Load package.json - delay this so perf utils doesn't conflict with brackets loading the same file
        setTimeout(function () {
            FileUtils
                .readAsText(FileSystem.getFileForPath(moduleDirectory + "package.json"))
                .done(function (content) {
                    callback(packageJson = JSON.parse(content));
                });
        }, 1000);
    }

    exports.init = function (_moduleDirectory) {
        moduleDirectory = _moduleDirectory;
    };

    exports.get = function (callback) {
        if (packageJson) {
            callback(packageJson);
        } else {
            loadInfo(function (json) {
                callback(json);
            });
        }
    };

    exports.getSync = function () {
        if (packageJson) {
            return packageJson;
        } else {
            throw new Error("[brackets-git] package.json is not loaded yet!");
        }
    };

});
