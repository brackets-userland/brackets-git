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

            var args = _.toArray(arguments);
            var eventName = args.shift();
            if (!eventName) {
                throw new Error("no event has been thrown!");
            }
            var listenersCount = this.listeners(eventName).length;
            var argsString = args.map(function (arg) {
                if (typeof arg === "function") { return "function(){...}"; }
                return arg.toString();
            }).join(", ");
            if (argsString) { argsString = " - " + argsString; }
            argsString = argsString + " (" + listenersCount + " listeners)";
            console.log("[brackets-git] Event invoked: " + eventName + argsString);
            
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
            self.emit.apply(self, _.union(args, arguments));
        };
    };

    module.exports = emInstance;
});
