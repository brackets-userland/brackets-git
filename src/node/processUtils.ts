/* eslint-env node */

import { exec } from "child_process";
import * as fs from "fs";
import * as Path from "path";
import * as which from "which";

var isWin = /^win/.test(process.platform);
var noop = function () {};

function fixEOL(str) {
    if (str[str.length - 1] === "\n") {
        str = str.slice(0, -1);
    }
    return str;
}

function findChildren(arr, pid) {
    var result = [];
    arr.forEach(function (obj) {
        if (obj.parentprocessid == pid) {
            // add children pid first
            result = result.concat(findChildren(arr, obj.processid));
            result.push(obj.processid);
        }
    });
    return result;
}

export function killSingleProcess(pid, callback) {
    callback = callback || noop;
    pid = pid.toString();

    if (isWin) {
        // "taskkill /F /PID 827"
        exec("taskkill /F /PID " + pid, function (err, stdout, stderr) {
            callback(err ? fixEOL(stderr) : undefined, err ? undefined : fixEOL(stdout));
        });
    } else {
        // "kill -9 2563"
        exec("kill -9 " + pid, function (err, stdout, stderr) {
            callback(err ? fixEOL(stderr) : undefined, err ? undefined : fixEOL(stdout));
        });
    }
}

export function getChildrenOfPid(pid, callback) {
    callback = callback || noop;
    pid = pid.toString();

    if (isWin) {
        exec("wmic process get parentprocessid,processid", function (err, stdout, stderr) {
            if (err) {
                return callback(fixEOL(stderr));
            }
            stdout = fixEOL(stdout);

            var map = stdout.split("\n").map(function (line) {
                var parts = line.trim().split(/\s+/);
                var o = {};
                o.processid = parts.pop();
                o.parentprocessid = parts.pop();
                return o;
            });

            callback(null, findChildren(map, pid));
        });
    } else {
        exec("ps -A -o ppid,pid", function (err, stdout, stderr) {
            if (err) {
                return callback(fixEOL(stderr));
            }
            stdout = fixEOL(stdout);

            var map = stdout.split("\n").map(function (line) {
                var parts = line.trim().split(/\s+/);
                var o = {};
                o.processid = parts.pop();
                o.parentprocessid = parts.pop();
                return o;
            });

            callback(null, findChildren(map, pid));
        });
    }
}

export function executableExists(filename, dir, callback) {
    if (typeof dir === "function") {
        callback = dir;
        dir = "";
    }

    which(filename, function (err, path) {
        if (err) {
            return callback(err, false);
        }

        path = Path.normalize(path);

        fs.stat(path, function (err, stats) {
            if (err) {
                return callback(err, false);
            }

            var exists = stats.isFile();
            if (!exists) { path = undefined; }

            return callback(null, exists, path);
        });
    });
}
