import { _, DefaultDialogs, Dialogs, Mustache, StringUtils } from "./brackets-modules";
import * as ErrorHandler from "./ErrorHandler";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as Git from "./git/GitCli";
import * as Git2 from "./git/Git";
import * as Preferences from "./Preferences";
import * as ProgressDialog from "./dialogs/Progress";
import * as Promise from "bluebird";
import * as PullDialog from "./dialogs/Pull";
import * as PushDialog from "./dialogs/Push";
import * as Strings from "strings";
import * as Utils from "./Utils";

const gitRemotesPickerTemplate = require("text!templates/git-remotes-picker.html");

let $selectedRemote = null;
let $remotesDropdown = null;
let $gitPanel = null;
let $gitPush = null;

function initVariables() {
    $gitPanel = $("#git-panel");
    $selectedRemote = $gitPanel.find(".git-selected-remote");
    $remotesDropdown = $gitPanel.find(".git-remotes-dropdown");
    $gitPush = $gitPanel.find(".git-push");
}

function getDefaultRemote(allRemotes) {
    const defaultRemotes = Preferences.get("defaultRemotes") || {};
    let candidate = defaultRemotes[Preferences.get("currentGitRoot")];

    const exists = _.find(allRemotes, (remote) => remote.name === candidate);
    if (!exists) {
        candidate = null;
        if (allRemotes.length > 0) {
            candidate = _.first(allRemotes).name;
        }
    }

    return candidate;
}

function setDefaultRemote(remoteName) {
    const defaultRemotes = Preferences.get("defaultRemotes") || {};
    defaultRemotes[Preferences.get("currentGitRoot")] = remoteName;
    Preferences.persist("defaultRemotes", defaultRemotes);
}

function clearRemotePicker() {
    $selectedRemote
        .html("&mdash;")
        .data("remote", null);
}

function selectRemote(remoteName, type) {
    if (!remoteName) {
        return clearRemotePicker();
    }

    // Set as default remote only if is a normal git remote
    if (type === "git") { setDefaultRemote(remoteName); }

    // Disable pull if it is not a normal git remote
    $gitPanel.find(".git-pull").prop("disabled", type !== "git");

    // Enable push and set selected-remote-type to Git push button by type of remote
    $gitPush
        .prop("disabled", false)
        .attr("x-selected-remote-type", type);

    // Update remote name of $selectedRemote
    $selectedRemote
        .text(remoteName)
        .attr("data-type", type) // use attr to apply CSS styles
        .data("remote", remoteName);
}

function refreshRemotesPicker() {
    Git.getRemotes().then((remotes) => {
        // Set default remote name and cache the remotes dropdown menu
        const defaultRemoteName = getDefaultRemote(remotes);

        // Disable Git-push and Git-pull if there are not remotes defined
        $gitPanel
            .find(".git-pull, .git-push, .git-fetch")
            .prop("disabled", remotes.length === 0);

        // Add options to change remote
        remotes.forEach((remote) => remote.deletable = remote.name !== "origin");

        // Pass to Mustache the needed data
        const compiledTemplate = Mustache.render(gitRemotesPickerTemplate, { Strings, remotes });

        // Inject the rendered template inside the $remotesDropdown
        $remotesDropdown.html(compiledTemplate);

        // Notify others that they may add more stuff to this dropdown
        EventEmitter.emit(Events.REMOTES_REFRESH_PICKER);
        // TODO: is it possible to wait for listeners to finish?

        // TODO: if there're no remotes but there are some ftp remotes
        // we need to adjust that something other may be put as default
        // low priority
        if (remotes.length > 0) {
            selectRemote(defaultRemoteName, "git");
        } else {
            clearRemotePicker();
        }
    }).catch((err) => ErrorHandler.showError(err, "Getting remotes failed!"));
}

function handleRemoteCreation() {
    return Utils.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_NAME)
        .then((name) => {
            return Utils.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_URL).then((url) => {
                return [name, url];
            });
        })
        .spread((name, url) => {
            return Git.createRemote(name, url).then(() => {
                return refreshRemotesPicker();
            });
        })
        .catch((err) => {
            if (!ErrorHandler.equals(err, Strings.USER_ABORTED)) {
                ErrorHandler.showError(err, "Remote creation failed");
            }
        });
}

function deleteRemote(remoteName) {
    return Utils.askQuestion(
        Strings.DELETE_REMOTE, StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName), { booleanResponse: true }
    )
        .then((response) => {
            if (response === true) {
                return Git.deleteRemote(remoteName).then(() => refreshRemotesPicker());
            }
            return null;
        })
        .catch((err) => ErrorHandler.logError(err));
}

function showPushResult(result) {
    if (typeof result.remoteUrl === "string") {
        result.remoteUrl = Utils.encodeSensitiveInformation(result.remoteUrl);
    }

    const template = [
        "<h3>{{flagDescription}}</h3>",
        "Info:",
        "Remote url - {{remoteUrl}}",
        "Local branch - {{from}}",
        "Remote branch - {{to}}",
        "Summary - {{summary}}",
        "<h4>Status - {{status}}</h4>"
    ].join("<br>");

    Dialogs.showModalDialog(
        DefaultDialogs.DIALOG_ID_INFO,
        Strings.GIT_PUSH_RESPONSE, // title
        Mustache.render(template, result) // message
    );
}

function pushToRemote(remote) {
    if (!remote) {
        const msg = "No remote has been selected for push!";
        return ErrorHandler.showError(new Error(msg), msg);
    }

    return PushDialog.show({ remote })
        .then((pushConfig) => {
            let q: Promise<any> = Promise.resolve();
            const additionalArgs = [];

            if (pushConfig.tags) {
                additionalArgs.push("--tags");
            }

            // set a new tracking branch if desired
            if (pushConfig.branch && pushConfig.setBranchAsTracking) {
                q = q.then(() => Git.setUpstreamBranch(pushConfig.remote, pushConfig.branch));
            }
            // put username and password into remote url
            if (pushConfig.remoteUrlNew) {
                q = q.then(() => Git2.setRemoteUrl(pushConfig.remote, pushConfig.remoteUrlNew));
            }
            // do the pull itself (we are not using pull command)
            q = q.then(() => {
                let op;

                if (pushConfig.pushToNew) {
                    op = Git2.pushToNewUpstream(pushConfig.remote, pushConfig.branch);
                } else if (pushConfig.strategy === "DEFAULT") {
                    op = Git.push(pushConfig.remote, pushConfig.branch, additionalArgs);
                } else if (pushConfig.strategy === "FORCED") {
                    op = Git2.pushForced(pushConfig.remote, pushConfig.branch);
                } else if (pushConfig.strategy === "DELETE_BRANCH") {
                    op = Git2.deleteRemoteBranch(pushConfig.remote, pushConfig.branch);
                }
                return ProgressDialog.show(op)
                    .then((result) => {
                        return ProgressDialog.waitForClose().then(() => {
                            showPushResult(result);
                        });
                    })
                    .catch((err) => ErrorHandler.showError(err, "Pushing to remote failed"));
            });
            // restore original url if desired
            if (pushConfig.remoteUrlRestore) {
                q = q.finally(() => Git2.setRemoteUrl(pushConfig.remote, pushConfig.remoteUrlRestore));
            }

            return q.finally(() => EventEmitter.emit(Events.REFRESH_ALL));
        })
        .catch((err) => {
            // when dialog is cancelled, there's no error
            if (err) { ErrorHandler.showError(err, "Pushing operation failed"); }
        });
}

function pullFromRemote(remote) {
    if (!remote) {
        const msg = "No remote has been selected for pull!";
        return ErrorHandler.showError(new Error(msg), msg);
    }

    return PullDialog.show({ remote })
        .then((pullConfig) => {
            let q: Promise<any> = Promise.resolve();

            // set a new tracking branch if desired
            if (pullConfig.branch && pullConfig.setBranchAsTracking) {
                q = q.then(() => Git.setUpstreamBranch(pullConfig.remote, pullConfig.branch));
            }
            // put username and password into remote url
            if (pullConfig.remoteUrlNew) {
                q = q.then(() => Git2.setRemoteUrl(pullConfig.remote, pullConfig.remoteUrlNew));
            }
            // do the pull itself (we are not using pull command)
            q = q.then(() => {
                // fetch the remote first
                return ProgressDialog.show(Git.fetchRemote(pullConfig.remote))
                    .then(() => {
                        if (pullConfig.strategy === "DEFAULT") {
                            return Git.mergeRemote(pullConfig.remote, pullConfig.branch);
                        } else if (pullConfig.strategy === "AVOID_MERGING") {
                            return Git.mergeRemote(pullConfig.remote, pullConfig.branch, true);
                        } else if (pullConfig.strategy === "MERGE_NOCOMMIT") {
                            return Git.mergeRemote(pullConfig.remote, pullConfig.branch, false, true);
                        } else if (pullConfig.strategy === "REBASE") {
                            return Git.rebaseRemote(pullConfig.remote, pullConfig.branch);
                        } else if (pullConfig.strategy === "RESET") {
                            return Git.resetRemote(pullConfig.remote, pullConfig.branch);
                        }
                        throw new Error(`Unexpected pullConfig.strategy: ${pullConfig.strategy}`);
                    })
                    .then((result) => {
                        return ProgressDialog.waitForClose().then(() => {
                            return Utils.showOutput(result, Strings.GIT_PULL_RESPONSE);
                        });
                    })
                    .catch((err) => ErrorHandler.showError(err, "Pulling from remote failed"));
            });
            // restore original url if desired
            if (pullConfig.remoteUrlRestore) {
                q = q.finally(() => Git2.setRemoteUrl(pullConfig.remote, pullConfig.remoteUrlRestore));
            }

            return q.finally(() => EventEmitter.emit(Events.REFRESH_ALL));
        })
        .catch((err) => {
            // when dialog is cancelled, there's no error
            if (err) { ErrorHandler.showError(err, "Pulling operation failed"); }
        });
}

function handleFetch(silent = false) {

    // Tell the rest of the plugin that the fetch has started
    EventEmitter.emit(Events.FETCH_STARTED);

    let q;

    if (!silent) {

        // If it's not a silent fetch show a progress window
        q = ProgressDialog.show(Git.fetchAllRemotes())
        .catch((err) => ErrorHandler.showError(err))
        .then(ProgressDialog.waitForClose);

    } else {

        // Else fetch in the background
        q = Git.fetchAllRemotes()
        .catch((err) => ErrorHandler.logError(err));

    }

    // Tell the rest of the plugin that the fetch has completed
    return q.finally(() => EventEmitter.emit(Events.FETCH_COMPLETE));
}

// Event subscriptions
EventEmitter.on(Events.GIT_ENABLED, () => {
    initVariables();
    refreshRemotesPicker();
});
EventEmitter.on(Events.HANDLE_REMOTE_PICK, (event) => {
    const $remote = $(event.target).closest(".remote-name");
    const remoteName = $remote.data("remote-name");
    const type = $remote.data("type");
    selectRemote(remoteName, type);
    EventEmitter.emit(Events.REFRESH_COUNTERS);
});
EventEmitter.on(Events.HANDLE_REMOTE_CREATE, () => {
    handleRemoteCreation();
});
EventEmitter.on(Events.HANDLE_REMOTE_DELETE, (event) => {
    const remoteName = $(event.target).closest(".remote-name").data("remote-name");
    deleteRemote(remoteName);
});
EventEmitter.on(Events.HANDLE_PULL, () => {
    const remoteName = $selectedRemote.data("remote");
    pullFromRemote(remoteName);
});
EventEmitter.on(Events.HANDLE_PUSH, () => {
    const remoteName = $selectedRemote.data("remote");
    pushToRemote(remoteName);
});
EventEmitter.on(Events.HANDLE_FETCH, () => {
    handleFetch();
});
