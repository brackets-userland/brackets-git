/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

/*jslint plusplus: true, vars: true, nomen: true */
/*global define, brackets, console */

define(function (require, exports, module) {
    "use strict";

    // Get module dependencies.
    var AppInit                    = brackets.getModule("utils/AppInit"),
        ExtensionUtils             = brackets.getModule("utils/ExtensionUtils"),
        FileUtils                  = brackets.getModule("file/FileUtils"),
        NativeFileSystem           = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        NodeConnection             = brackets.getModule("utils/NodeConnection"),
        UiControl                  = require("lib/uiControl"),
        Strings                    = require("strings"),
        moduleDirectory            = ExtensionUtils.getModulePath(module),
        configurationFilePath      = moduleDirectory + "_configuration.json",
        domainModulePath           = moduleDirectory + "lib/domain",
        nodeConnection             = new NodeConnection(),
        nodeConnectionEstabilished = false,
        configuration              = null;

    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");

    // Every async setup calls this function, init executes after everything is fulfilled.
    function startExtension() {
        if (nodeConnectionEstabilished === false || configuration === null) { return; }
        UiControl.init(nodeConnection, configuration);
    }

    // Load configuration, or create default one if none available.
    // Idea is that configuration file is created after first install and updates should not delete it.
    var configurationFileEntry = new NativeFileSystem.FileEntry(configurationFilePath);
    FileUtils.readAsText(configurationFileEntry).done(function (content) {

        try {
            configuration = JSON.parse(content);
        } catch (e) {
            return console.error("[brackets-git] configuration file is not a valid JSON, please delete it: " + configurationFilePath);
        }
        startExtension();

    }).fail(function () {
        // Open the default file and create a new configuration file
        var defaultConfigurationFileEntry = new NativeFileSystem.FileEntry(configurationFilePath + ".default");
        FileUtils.readAsText(defaultConfigurationFileEntry).done(function (content) {

            // Parse first in case there is an exception
            configuration = JSON.parse(content);
            FileUtils.writeText(configurationFileEntry, content);
            startExtension();

        }).fail(function () {
            console.error("[brackets-git] reinstall extension, failed to read file: " + configurationFilePath + ".default");
        });
    });

    AppInit.appReady(function () {
        // Connects to Node
        nodeConnection.connect(true).fail(function () {
            console.error("[brackets-git] failed to connect to node");
        }).then(function () {
            // Register the domain.
            return nodeConnection.loadDomains([domainModulePath], true).fail(function () {
                console.error("[brackets-git] failed to register domain");
            });
        }).then(function () {
            nodeConnectionEstabilished = true;
            startExtension();
        }).done();
    });
});