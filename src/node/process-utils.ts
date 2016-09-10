/* eslint-env node */

import { exec } from "child_process";
import * as fs from "fs";
import * as Path from "path";
import * as which from "which";

const isWin = /^win/.test(process.platform);

function fixEOL(str: string) {
    return str[str.length - 1] === "\n" ? str.slice(0, -1) : str;
}

function findChildren(arr: Array<{ processid: number, parentprocessid: number }>, pid: number): number[] {
    let result: number[] = [];
    arr.forEach((obj) => {
        if (obj.parentprocessid === pid) {
            // add children pid first
            result = result.concat(findChildren(arr, obj.processid));
            result.push(obj.processid);
        }
    });
    return result;
}

export function killSingleProcess(
    pid: number,
    callback: (stderr: string | null, stdout: string | null) => void
) {
    if (isWin) {
        // "taskkill /F /PID 827"
        exec("taskkill /F /PID " + pid, (err, stdout, stderr) => {
            callback(err ? fixEOL(stderr) : null, err ? null : fixEOL(stdout));
        });
    } else {
        // "kill -9 2563"
        exec("kill -9 " + pid, (err, stdout, stderr) => {
            callback(err ? fixEOL(stderr) : null, err ? null : fixEOL(stdout));
        });
    }
}

export function getChildrenOfPid(
    pid: number,
    callback: (stderr: string | null, pids: number[]) => void
) {
    if (isWin) {
        exec("wmic process get parentprocessid,processid", (err, stdout, stderr) => {
            if (err) {
                return callback(fixEOL(stderr), []);
            }

            const map = fixEOL(stdout).split("\n").map((line) => {
                const parts = line.trim().split(/\s+/);
                const processid = parseInt(parts.pop() as string, 10);
                const parentprocessid = parseInt(parts.pop() as string, 10);
                return { processid, parentprocessid };
            });

            callback(null, findChildren(map, pid));
        });
    } else {
        exec("ps -A -o ppid,pid", (err, stdout, stderr) => {
            if (err) {
                return callback(fixEOL(stderr), []);
            }

            const map = fixEOL(stdout).split("\n").map((line) => {
                const parts = line.trim().split(/\s+/);
                const processid = parseInt(parts.pop() as string, 10);
                const parentprocessid = parseInt(parts.pop() as string, 10);
                return { processid, parentprocessid };
            });

            callback(null, findChildren(map, pid));
        });
    }
}

export function executableExists(
    command: string,
    callback: (err: NodeJS.ErrnoException | null, exists: boolean, resolvedPath: string | null) => void
) {
    which(command, (whichErr, _path) => {
        if (whichErr) {
            return callback(whichErr, false, null);
        }
        const path = Path.normalize(_path);
        fs.stat(path, (statErr, stats) => {
            if (statErr) {
                return callback(statErr, false, null);
            }
            const exists = stats.isFile();
            return callback(null, exists, exists ? path : null);
        });
    });
}
