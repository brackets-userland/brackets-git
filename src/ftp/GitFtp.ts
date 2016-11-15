/*
    To make these features work you need Git-FTP (https://github.com/git-ftp/git-ftp)
*/

import { git } from "../git/GitCli";
import * as Promise from "bluebird";
import * as URI from "URI";

export function isAvailable() {
    return git(["ftp"])
        .then(() => true)
        .catch((err) => err);
}

export function init(scope) {
    return git(["ftp", "init", "--scope", scope]);
}

export function push(scope) {
    return git(["ftp", "push", "--scope", scope]);
}

export function getScopes() {
    return git(["config", "--list"]).then((stdout) => {
        return stdout.split("\n").reduce((result, row) => {
            const io = row.indexOf(".url");
            if (row.substring(0, 8) === "git-ftp." && row.substring(io, io + 4) === ".url") {
                result.push({
                    name: row.split(".")[1],
                    url: row.split("=")[1]
                });
            }
            return result;
        }, []);
    });
}

export function addScope(scope, url) {
    const uri = new URI(url);
    const username = uri.username();
    const password = uri.password();

    uri.username("");
    uri.password("");
    url = uri.toString(); // eslint-disable-line

    const scopeArgs = ["config", "--add", "git-ftp." + scope + ".url", url];
    const usernameArgs = ["config", "--add", "git-ftp." + scope + ".user", username];
    const passwordArgs = ["config", "--add", "git-ftp." + scope + ".password", password];

    return Promise.all([
        git(scopeArgs),
        git(usernameArgs),
        git(passwordArgs)
    ]);
}

export function removeScope(scope) {
    return git(["ftp", "remove-scope", scope]);
}
