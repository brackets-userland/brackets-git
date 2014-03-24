define(function (require, exports, module) {
    "use strict";

    var EventEmitter2 = require("eventemitter2"),
        Preferences   = require("src/Preferences"),
        debugOn       = Preferences.get("debugMode");

    var emInstance = new EventEmitter2({
        wildcard: false
    });

    emInstance._emit = emInstance.emit;
    emInstance.emit = function () {
        if (debugOn) {
            console.log("[brackets-git] Event invoked: " + arguments[0]);
        }
        return this._emit.apply(this, arguments);
    };

    emInstance.emitFactory = function (eventName) {
        var self = this;
        return function () {
            self.emit.apply(self, [eventName].concat(arguments));
        };
    };

    module.exports = emInstance;

});
