define(function (require, exports, module) {
    "use strict";

    // Local modules
    var EventEmitter2 = require("eventemitter2"),
        Preferences   = require("src/Preferences");

    // Module variables
    var debugOn = Preferences.get("debugMode");

    // Implementation
    var emInstance = new EventEmitter2({
        wildcard: false
    });

    if (debugOn) {
        emInstance._emit = emInstance.emit;
        emInstance.emit = function () {
            console.log("[brackets-git] Event invoked: " + arguments[0]);
            return this._emit.apply(this, arguments);
        };
    }

    emInstance.emitFactory = function (eventName) {
        var self = this;
        return function () {
            Array.prototype.unshift.call(arguments, eventName);
            self.emit.apply(self, arguments);
        };
    };

    module.exports = emInstance;

});
