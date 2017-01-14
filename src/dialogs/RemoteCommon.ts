import { _, Mustache } from "../brackets-modules";
import * as ErrorHandler from "../ErrorHandler";
import * as Git from "../git/GitCli";
import * as Git2 from "../git/Git";
import * as ProgressDialog from "./Progress";
import * as URI from "URI";

function fillBranches(config, $dialog) {
    Git.getAllBranches().then((branches) => {
        // filter only branches for this remote
        branches = _.filter(branches, (branch) => branch.remote === config.remote);
        const template = "{{#branches}}<option value='{{name}}' remote='{{remote}}' " +
            "{{#currentBranch}}selected{{/currentBranch}}>{{name}}</option>{{/branches}}";
        const html = Mustache.render(template, { branches });
        $dialog.find(".branchSelect").html(html);
    }).catch((err) => {
        ErrorHandler.showError(err, "Getting branch list failed");
    });
}

export function collectInfo(config) {
    return Git.getCurrentUpstreamBranch().then((upstreamBranch) => {
        config.currentTrackingBranch = upstreamBranch;

        return Git2.getRemoteUrl(config.remote).then((remoteUrl) => {
            config.remoteUrl = remoteUrl;

            if (remoteUrl.match(/^https?:/)) {
                const uri = new URI(remoteUrl);
                config.remoteUsername = uri.username();
                config.remotePassword = uri.password();
            } else {
                // disable the inputs
                config._usernamePasswordDisabled = true;
            }

            if (!upstreamBranch) {
                return Git.getCurrentBranchName().then((currentBranchName) => {
                    config.currentBranchName = currentBranchName;
                });
            }
        });
    }).catch((err) => {
        ErrorHandler.showError(err, "Getting remote information failed");
    });
}

export function attachCommonEvents(config, $dialog) {
    const handleRadioChange = function () {
        const val = $dialog.find("input[name='action']:checked").val();
        $dialog.find(".only-from-selected").toggle(val === "PULL_FROM_SELECTED" || val === "PUSH_TO_SELECTED");
    };
    $dialog.on("change", "input[name='action']", handleRadioChange);
    handleRadioChange();

    let trackingBranchRemote = null;
    if (config.currentTrackingBranch) {
        trackingBranchRemote = config.currentTrackingBranch.substring(0, config.currentTrackingBranch.indexOf("/"));
    }

    // if we're pulling from another remote than current tracking remote
    if (config.currentTrackingBranch && trackingBranchRemote !== config.remote) {
        if (config.pull) {
            $dialog.find("input[value='PULL_FROM_CURRENT']").prop("disabled", true);
            $dialog.find("input[value='PULL_FROM_SELECTED']").prop("checked", true).trigger("change");
        } else {
            $dialog.find("input[value='PUSH_TO_CURRENT']").prop("disabled", true);
            $dialog.find("input[value='PUSH_TO_SELECTED']").prop("checked", true).trigger("change");
        }
    }

    $dialog.on("click", ".fetchBranches", () => {
        ProgressDialog.show(Git.fetchRemote(config.remote))
            .then(() => {
                fillBranches(config, $dialog);
            }).catch((err) => {
                throw ErrorHandler.showError(err, "Fetching remote information failed");
            });
    });
    fillBranches(config, $dialog);

    if (config._usernamePasswordDisabled) {
        $dialog.find("input[name='username'],input[name='password'],input[name='saveToUrl']").prop("disabled", true);
    }
}

export function collectValues(config, $dialog) {
    const action = $dialog.find("input[name='action']:checked").val();
    if (action === "PULL_FROM_CURRENT" || action === "PUSH_TO_CURRENT") {

        if (config.currentTrackingBranch) {
            config.branch = config.currentTrackingBranch.substring(config.remote.length + 1);
        } else {
            config.branch = config.currentBranchName;
            config.pushToNew = true;
        }

    } else if (action === "PULL_FROM_SELECTED" || action === "PUSH_TO_SELECTED") {
        config.branch = $dialog.find(".branchSelect").val().substring(config.remote.length + 1);
        config.setBranchAsTracking = $dialog.find("input[name='setBranchAsTracking']").is(":checked");
    }

    config.strategy = $dialog.find("input[name='strategy']:checked").val();
    config.tags = $dialog.find("input[name='send_tags']:checked").val();

    config.remoteUsername = $dialog.find("input[name='username']").val();
    config.remotePassword = $dialog.find("input[name='password']").val();

    // new url that has to be set for merging
    let remoteUrlNew;
    if (config.remoteUrl.match(/^https?:/)) {
        const uri = new URI(config.remoteUrl);
        uri.username(config.remoteUsername);
        uri.password(config.remotePassword);
        remoteUrlNew = uri.toString();
    }

    // assign remoteUrlNew only if it's different from the original url
    if (remoteUrlNew && config.remoteUrl !== remoteUrlNew) {
        config.remoteUrlNew = remoteUrlNew;
    }

    // old url that has to be put back after merging
    const saveToUrl = $dialog.find("input[name='saveToUrl']").is(":checked");
    // assign restore branch only if remoteUrlNew has some value
    if (config.remoteUrlNew && !saveToUrl) {
        config.remoteUrlRestore = config.remoteUrl;
    }
}
