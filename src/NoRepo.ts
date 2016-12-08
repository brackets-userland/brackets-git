import { FileSystem, FileUtils, ProjectManager } from "./brackets-modules";
import * as Promise from "bluebird";
import * as ErrorHandler from "./ErrorHandler";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import ExpectedError from "./ExpectedError";
import * as ProgressDialog from "./dialogs/Progress";
import * as CloneDialog from "./dialogs/Clone";
import * as Git from "./git/GitCli";
import * as Git2 from "./git/Git";
import * as Preferences from "./Preferences";
import * as Utils from "./Utils";

const gitignoreTemplate = require("text!templates/default-gitignore");

function createGitIgnore() {
    const gitIgnorePath = Preferences.get("currentGitRoot") + ".gitignore";
    return Utils.pathExists(gitIgnorePath).then((exists) => {
        if (!exists) {
            return Promise.cast(FileUtils.writeText(FileSystem.getFileForPath(gitIgnorePath), gitignoreTemplate));
        }
    });
}

function stageGitIgnore() {
    return createGitIgnore().then(() => Git.stage(".gitignore"));
}

function handleGitInit() {
    Utils.isProjectRootWritable().then((writable) => {
        if (!writable) {
            throw new ExpectedError("Folder " + Utils.getProjectRoot() + " is not writable!");
        }
        return Git.init().catch((err) => {

            if (ErrorHandler.contains(err, "Please tell me who you are")) {
                const defer = Promise.defer();
                EventEmitter.emit(Events.GIT_CHANGE_USERNAME, null, () => {
                    EventEmitter.emit(Events.GIT_CHANGE_EMAIL, null, () => {
                        Git.init()
                            .then((result) => defer.resolve(result))
                            .catch((initErr) => defer.reject(initErr));
                    });
                });
                return defer.promise;
            }

            throw err;

        });
    })
    .then(() => stageGitIgnore())
    .catch((err) => ErrorHandler.showError(err, "Initializing new repository failed"))
    .then(() => EventEmitter.emit(Events.REFRESH_ALL));
}

// This checks if the project root is empty (to let Git clone repositories)
function isProjectRootEmpty() {
    return new Promise((resolve, reject) => {
        ProjectManager.getProjectRoot().getContents((err, entries) => {
            if (err) {
                return reject(err);
            }
            resolve(entries.length === 0);
        });
    });
}

function handleGitClone() {
    const $gitPanel = $("#git-panel");
    const $cloneButton = $gitPanel.find(".git-clone");
    $cloneButton.prop("disabled", true);
    isProjectRootEmpty().then((isEmpty) => {
        if (isEmpty) {
            CloneDialog.show().then((cloneConfig) => {
                let q: Promise<any> = Promise.resolve();
                // put username and password into remote url
                let remoteUrl = cloneConfig.remoteUrl;
                if (cloneConfig.remoteUrlNew) {
                    remoteUrl = cloneConfig.remoteUrlNew;
                }

                // do the clone
                q = q.then(() => ProgressDialog.show(Git.clone(remoteUrl, ".")))
                    .catch((err) => ErrorHandler.showError(err, "Cloning remote repository failed!"));

                // restore original url if desired
                if (cloneConfig.remoteUrlRestore) {
                    q = q.then(() => Git2.setRemoteUrl(cloneConfig.remote, cloneConfig.remoteUrlRestore));
                }

                return q.finally(() => EventEmitter.emit(Events.REFRESH_ALL));
            }).catch((err) => {
                // when dialog is cancelled, there's no error
                if (err) { ErrorHandler.showError(err, "Cloning remote repository failed!"); }
            });

        } else {
            const err = new ExpectedError("Project root is not empty, be sure you have deleted hidden files");
            ErrorHandler.showError(err, "Cloning remote repository failed!");
        }
    })
    .catch((err) => ErrorHandler.showError(err))
    .finally(() => $cloneButton.prop("disabled", false));
}

// Event subscriptions
EventEmitter.on(Events.HANDLE_GIT_INIT, () => handleGitInit());
EventEmitter.on(Events.HANDLE_GIT_CLONE, () => handleGitClone());
EventEmitter.on(Events.GIT_NO_BRANCH_EXISTS, () => stageGitIgnore());
