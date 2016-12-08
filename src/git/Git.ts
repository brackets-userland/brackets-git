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

export function getHistory(branch, skip: number = 0) {
    return GitCli.getHistory(branch, skip);
}

export function getFileHistory(file, branch, skip: number = 0) {
    return GitCli.getHistory(branch, skip, file);
}

export function resetIndex() {
    return GitCli.reset();
}

export function discardAllChanges() {
    return GitCli.reset("--hard").then(() => GitCli.clean());
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

// TODO: this hack should be removed
Object.keys(GitCli).forEach((method) => {
    if (!exports[method]) {
        exports[method] = GitCli[method];
    }
});
