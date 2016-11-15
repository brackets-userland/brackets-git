import * as Cli from "../Cli";
import * as Git from "../git/GitCli";
import * as Preferences from "../Preferences";
import * as Promise from "bluebird";
import * as Utils from "../Utils";
import { _ } from "../brackets-modules";

const standardGitPathsWin = [
    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\cmd\\git.exe"
];

const standardGitPathsNonWin = [
    "/usr/local/git/bin/git",
    "/usr/local/bin/git",
    "/usr/bin/git"
];

export function findGit() {
    return new Promise((resolve, reject) => {

        // TODO: do this in two steps - first check user config and then check all
        let pathsToLook = [Preferences.get("gitPath"), "git"]
            .concat(brackets.platform === "win" ? standardGitPathsWin : standardGitPathsNonWin);
        pathsToLook = _.unique(_.compact(pathsToLook));

        const results = [];
        const errors = [];
        const finish = _.after(pathsToLook.length, () => {

            const searchedPaths = "\n\nSearched paths:\n" + pathsToLook.join("\n");

            if (results.length === 0) {
                // no git found
                reject("No Git has been found on this computer" + searchedPaths);
            } else {
                // at least one git is found
                const gits = _.sortBy(results, "version").reverse();
                let latestGit = gits[0];
                const m = latestGit.version.match(/([0-9]+)\.([0-9]+)/);
                const major = parseInt(m[1], 10);
                const minor = parseInt(m[2], 10);

                if (major === 1 && minor < 8) {
                    return reject(
                        "Brackets Git requires Git 1.8 or later - latest version found was " +
                        latestGit.version + searchedPaths
                    );
                }

                // prefer the first defined so it doesn't change all the time and confuse people
                latestGit = _.sortBy(_.filter(gits, (git) => git.version === latestGit.version), "index")[0];

                // this will save the settings also
                Git.setGitPath(latestGit.path);
                resolve(latestGit.version);
            }

        });

        pathsToLook.forEach((path, index) => {
            Cli.spawnCommand(path, ["--version"], {
                cwd: Utils.getExtensionDirectory()
            }).then((stdout) => {
                const m = stdout.match(/^git version\s+(.*)$/);
                if (m) {
                    results.push({
                        path,
                        version: m[1],
                        index
                    });
                }
            }).catch((err) => {
                errors.push({
                    path,
                    err
                });
            }).finally(() => finish());
        });

    });
}
