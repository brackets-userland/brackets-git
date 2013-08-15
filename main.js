/*!
 * Brackets Git Extension
 *
 * @author Martin Zagora
 * @license http://opensource.org/licenses/MIT
 */

/*global define, brackets, console */

define(function (require, exports, module) {
    "use strict";

    // Get module dependencies.
    var AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        UiControl           = require("lib/uiControl"),
        domainModulePath    = ExtensionUtils.getModulePath(module, "lib/domain"),
        nodeConnection      = new NodeConnection();
    
    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "less/brackets-git.less");

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
            UiControl.init(nodeConnection);
        }).done();
    });
});