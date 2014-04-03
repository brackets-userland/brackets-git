define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash");

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
            if (!arguments[0]) {
                throw new Error("no event has been thrown!");
            }
            console.log("[brackets-git] Event invoked: " + arguments[0]);
            return this._emit.apply(this, arguments);
        };
    }

    emInstance.emitFactory = function (eventName) {
        if (!eventName) {
            throw new Error("no event has been passed to the factory!");
        }

        var self = this,
            args = _.toArray(arguments);

        return function () {
            self.emit.apply(self, args);
        };
    };

    module.exports = emInstance;
});
