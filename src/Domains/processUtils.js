var exec  = require("child_process").exec;

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

function killSingleProcess(pid, callback) {
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

function getChildrenOfPid(pid, callback) {
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

exports.getChildrenOfPid = getChildrenOfPid;
exports.killSingleProcess = killSingleProcess;
