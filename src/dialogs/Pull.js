define(function (require, exports) {
    "use strict";

    // Brackets modules
    var _       = brackets.getModule("thirdparty/lodash"),
        Dialogs = brackets.getModule("widgets/Dialogs");

    // Local modules
    var ErrorHandler    = require("src/ErrorHandler"),
        Git             = require("src/git/Git"),
        Preferences     = require("src/Preferences"),
        ProgressDialog  = require("src/dialogs/Progress"),
        Promise         = require("bluebird"),
        Strings         = require("strings"),
        URI             = require("URI");

    // Templates
    var template            = require("text!src/dialogs/templates/pull-dialog.html"),
        credentialsTemplate = require("text!src/dialogs/templates/credentials-template.html");

    // Module variables
    var defer,
        pullConfig;

    // Implementation
    function collectInfo() {
        return Git.getCurrentUpstreamBranch().then(function (upstreamBranch) {
            pullConfig.currentTrackingBranch = upstreamBranch;

            return Git.getRemoteUrl(pullConfig.remote).then(function (remoteUrl) {
                pullConfig.remoteUrl = remoteUrl;
                var uri = new URI(remoteUrl);
                pullConfig.remoteUsername = uri.username();
                pullConfig.remotePassword = uri.password();
            });
        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting remote information failed");
        });
    }

    function _fillBranches($dialog) {
        Git.getAllBranches().then(function (branches) {
            // filter only branches for this remote
            branches = _.filter(branches, function (branch) {
                return branch.remote === pullConfig.remote;
            });

            var template = "{{#branches}}<option value='{{name}}' remote='{{remote}}' " +
                "{{#currentBranch}}selected{{/currentBranch}}>{{name}}</option>{{/branches}}";
            var html = Mustache.render(template, { branches: branches });
            $dialog.find(".branchSelect").html(html);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting branch list failed");
        });
    }

    function _attachEvents($dialog) {
        var handleRadioChange = function () {
            var val = $dialog.find("input[name='action']:checked").val();
            $dialog.find(".pull-from-selected").toggle(val === "PULL_FROM_SELECTED");
        };
        $dialog.on("change", "input[name='action']", handleRadioChange);
        handleRadioChange();

        $dialog.on("click", ".fetchBranches", function () {
            ProgressDialog.show(Git.fetchRemote(pullConfig.remote))
                .then(function () {
                    _fillBranches($dialog);
                }).catch(function (err) {
                    throw ErrorHandler.showError(err, "Fetching remote information failed");
                });
        });
        _fillBranches($dialog);

        // load from state
        var defaultStrategy = Preferences.get("pull.strategy") || "CLASSIC";
        $dialog.find("input[name='strategy']").val(defaultStrategy);
    }

    function _collectValues($dialog) {
        var action = $dialog.find("input[name='action']:checked").val();
        if (action === "PULL_FROM_CURRENT") {
            pullConfig.branch = pullConfig.currentTrackingBranch.substring(pullConfig.remote.length + 1);
        } else if (action === "PULL_FROM_SELECTED") {
            pullConfig.branch = $dialog.find(".branchSelect").val().substring(pullConfig.remote.length + 1);
            pullConfig.setBranchAsTracking = $dialog.find("input[name='setBranchAsTracking']").is(":checked");
        }

        pullConfig.strategy = $dialog.find("input[name='strategy']:checked").val();
        Preferences.set("pull.strategy", pullConfig.strategy);

        pullConfig.remoteUsername = $dialog.find("input[name='username']").val();
        pullConfig.remotePassword = $dialog.find("input[name='password']").val();
        pullConfig.saveToUrl = $dialog.find("input[name='saveToUrl']").is(":checked");
    }

    function _show() {
        var templateArgs = {
            config: pullConfig,
            Strings: Strings
        };

        var compiledTemplate = Mustache.render(template, templateArgs, {
                credentials: credentialsTemplate
            }),
            dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
            $dialog = dialog.getElement();

        _attachEvents($dialog);

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                _collectValues($dialog);
                defer.resolve(pullConfig);
            } else {
                defer.reject();
            }
        });
    }

    function show(_pullConfig) {
        defer = Promise.defer();
        pullConfig = _pullConfig;
        collectInfo().then(_show);
        return defer.promise;
    }

    exports.show = show;

});
