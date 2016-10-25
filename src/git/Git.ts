/*
    This file acts as an entry point to GitCli.js and other possible
    implementations of Git communication besides Cli. Application
    should not access GitCli directly.
*/

import * as Preferences from "../Preferences";
import * as Promise from "bluebird";
import * as GitCli from "../git/GitCli";
import * as Utils from "../Utils";

export function pushToNewUpstream(remoteName, remoteBranch) {
    return GitCli.push(remoteName, remoteBranch, ["--set-upstream"]);
}

export function getRemoteUrl(remote) {
    return GitCli.getConfig("remote." + remote + ".url");
}

export function setRemoteUrl(remote, url) {
    return GitCli.setConfig("remote." + remote + ".url", url);
}

function sortBranches(branches) {
    return branches.sort((a, b) => {
        const ar = a.remote || "";
        const br = b.remote || "";
        // origin remote first
        if (br && ar === "origin" && br !== "origin") {
            return -1;
        } else if (ar && ar !== "origin" && br === "origin") {
            return 1;
        }
        // sort by remotes
        if (ar < br) {
            return -1;
        } else if (ar > br) {
            return 1;
        }
        // sort by sortPrefix (# character)
        if (a.sortPrefix < b.sortPrefix) {
            return -1;
        } else if (a.sortPrefix > b.sortPrefix) {
            return 1;
        }
        // master branch first
        if (a.sortName === "master" && b.sortName !== "master") {
            return -1;
        } else if (a.sortName !== "master" && b.sortName === "master") {
            return 1;
        }
        // sort by sortName (lowercased branch name)
        if (a.sortName < b.sortName) {
            return -1;
        }
        if (a.sortName > b.sortName) {
            return 1;
        }
        return 0;
    });
}

export function getBranches() {
    return GitCli.getBranches().then((branches) => sortBranches(branches));
}

export function getAllBranches() {
    return GitCli.getAllBranches().then((branches) => sortBranches(branches));
}

export function getHistory(branch, skip) {
    return GitCli.getHistory(branch, skip);
}

export function getFileHistory(file, branch, skip) {
    return GitCli.getHistory(branch, skip, file);
}

export function resetIndex() {
    return GitCli.reset();
}

export function discardAllChanges() {
    return GitCli.reset("--hard").then(() => GitCli.clean());
}

export function getMergeInfo() {
    const baseCheck = ["MERGE_MODE", "rebase-apply"];
    const mergeCheck = ["MERGE_HEAD", "MERGE_MSG"];
    const rebaseCheck = ["rebase-apply/next", "rebase-apply/last", "rebase-apply/head-name"];
    const gitFolder = Preferences.get("currentGitRoot") + ".git/";

    return Promise.all(baseCheck.map((fileName) => Utils.loadPathContent(gitFolder + fileName)))
    .spread((mergeMode, rebaseMode) => {
        const obj = {
            mergeMode: mergeMode !== null,
            mergeHead: null,
            rebaseMode: rebaseMode !== null
        };
        if (obj.mergeMode) {

            return Promise.all(mergeCheck.map((fileName) => Utils.loadPathContent(gitFolder + fileName)))
            .spread((head, msg) => {
                if (head) {
                    obj.mergeHead = head.trim();
                }
                const msgSplit = msg ? msg.trim().split(/conflicts:/i) : [];
                if (msgSplit[0]) {
                    obj.mergeMessage = msgSplit[0].trim();
                }
                if (msgSplit[1]) {
                    obj.mergeConflicts = msgSplit[1].trim().split("\n").map((line) => line.trim());
                }
                return obj;

            });

        }
        if (obj.rebaseMode) {

            return Promise.all(rebaseCheck.map((fileName) => Utils.loadPathContent(gitFolder + fileName)))
            .spread((next, last, head) => {
                if (next) { obj.rebaseNext = next.trim(); }
                if (last) { obj.rebaseLast = last.trim(); }
                if (head) { obj.rebaseHead = head.trim().substring("refs/heads/".length); }
                return obj;
            });

        }
        return obj;
    });
}

export function discardFileChanges(file) {
    return GitCli.unstage(file).then(() => GitCli.checkout(file));
}

export function pushForced(remote, branch) {
    return GitCli.push(remote, branch, ["--force"]);
}

export function deleteRemoteBranch(remote, branch) {
    return GitCli.push(remote, branch, ["--delete"]);
}

export function undoLastLocalCommit() {
    return GitCli.reset("--soft", "HEAD~1");
}

Object.keys(GitCli).forEach((method) => {
    if (!exports[method]) {
        exports[method] = GitCli[method];
    }
});
