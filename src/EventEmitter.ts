import { _ } from "./brackets-modules";
import { EventEmitter2 } from "eventemitter2";
import * as Preferences from "./Preferences";
import * as Utils from "./Utils";

const debugOn = Preferences.get("debugMode");

export interface MyEventEmitter2 extends EventEmitter2 {
    _emit: Function;
    emitFactory: (eventName: string, ...args: any[]) => () => void;
}

const emInstance = new EventEmitter2({
    wildcard: false
}) as MyEventEmitter2;

export default emInstance;

if (debugOn) {
    emInstance._emit = emInstance.emit;
    emInstance.emit = function (...args) {

        const eventName = args.shift();
        if (!eventName) {
            throw new Error("no event has been thrown!");
        }

        const listenersCount = this.listeners(eventName).length;

        let argsString = args.map((arg) => {
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

        return this._emit(eventName, ...args);
    };
}

emInstance.emitFactory = function (eventName: string, ...args: any[]): () => void {
    if (!eventName) {
        throw new Error("no event has been passed to the factory!");
    }

    let lastClick = 0;

    return (...args2) => {

        // prevent doubleclicks with 500ms timeout
        const now = new Date().valueOf();
        if (now - lastClick < 500) {
            return;
        }
        lastClick = now;

        this.emit(eventName, ...args, ...args2);
    };
};
