import { _ } from "./brackets-modules";
import * as EventEmitter2 from "eventemitter2";
import * as Preferences from "./Preferences";
import * as Utils from "./Utils";

var debugOn = Preferences.get("debugMode");

const emInstance = new EventEmitter2({
    wildcard: false
});

export default emInstance;

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
            if (arg === null) { return "null"; }
            if (typeof arg === "undefined") { return "undefined"; }
            if (typeof arg === "function") { return "function(){...}"; }
            if (!arg.toString) { return Object.prototype.toString.call(arg); }
            return arg.toString();
        }).join(", ");
        if (argsString) { argsString = " - " + argsString; }
        argsString = argsString + " (" + listenersCount + " listeners)";
        if (listenersCount > 0) {
            Utils.consoleLog("[brackets-git] Event invoked: " + eventName + argsString);
        }

        return this._emit.apply(this, arguments);
    };
}

emInstance.emitFactory = function (eventName) {
    if (!eventName) {
        throw new Error("no event has been passed to the factory!");
    }

    var self = this,
        args = _.toArray(arguments),
        lastClick = 0;

    return function () {

        // prevent doubleclicks with 500ms timeout
        var now = new Date().valueOf();
        if (now - lastClick < 500) {
            return;
        }
        lastClick = now;

        self.emit.apply(self, _.union(args, arguments));
    };
};
