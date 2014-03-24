define(function (require, exports, module) {

    // Brackets modules
    var DefaultDialogs = brackets.getModule("widgets/DefaultDialogs");

    // Local modules
    var Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Main          = require("src/Main"),
        Preferences   = require("src/Preferences");

    // Module variables
    var $selectedRemote = null; // TODO: gitPanel.$panel.find(".git-selected-remote")

    function getDefaultRemote() {
        // TODO: refactor after Sprint 38 is published
        var key = ["defaultRemotes", Main.getProjectRoot()].join(".");
        var defaultRemote = Preferences.get(key);
        return defaultRemote || "origin";
    }

    function setDefaultRemote(remoteName) {
        // TODO: refactor after Sprint 38 is published
        var key = ["defaultRemotes", Main.getProjectRoot()].join(".");
        Preferences.persist(key, remoteName);
    }

    function clearRemotePicker() {
        $selectedRemote
            .html("&mdash;")
            .data("remote", null);
    }

    function selectRemote(remoteName) {
        if (!remoteName) {
            return clearRemotePicker();
        }
        $selectedRemote
            .text(remoteName)
            .data("remote", remoteName);
    }

    function handleRemotePick(e, $a) {
        var $selected = (e ? $(e.target) : $a).closest(".remote-name");
        if ($selected.length === 0) {
            clearRemotePicker();
        }
        var remoteName = $selected.data("remote-name");
        _setDefaultRemote(remoteName);
        selectRemote(remoteName);
    }

    function handleRemoteRemove(e, $a) {
        var $selected = (e ? $(e.target) : $a).closest(".remote-name"),
            remoteName = $selected.data("remote-name");

        return askQuestion(Strings.DELETE_REMOTE,
                           StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName),
                           {booleanResponse: true}).then(function (response) {
            if (response === true) {
                Main.gitControl.remoteRemove(remoteName).then(function () {
                    $selected.parent().remove();
                    // TODO: rather refresh
                    var newRemote = gitPanel.$panel.find(".git-remotes-dropdown .remote-name").first().data("remote-name");
                    selectRemote(newRemote);
                }).fail(function (err) {
                    ErrorHandler.logError(err);
                });
            }
        });
    }

    function handleRemoteCreation() {
        return askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_NAME)
        .then(function (name) {
            return askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_URL)
            .then(function (url) {
                return Main.gitControl.remoteAdd(name, url)
                .then(function () {
                    prepareRemotesPicker();
                })
                .fail(function (err) { ErrorHandler.showError(err, "Remote creation failed"); });
            });
        });
    }

    function prepareRemotesPicker() {
        Main.gitControl.getRemotes().then(function (remotes) {
            var defaultRemoteName = _getDefaultRemote(),
                $defaultRemote,
                $remotesDropdown = gitPanel.$panel.find(".git-remotes-dropdown").empty();

            gitPanel.$panel.find(".git-pull").prop("disabled", remotes.length === 0);
            gitPanel.$panel.find(".git-push").prop("disabled", remotes.length === 0);

            // Add option to define new remote
            $remotesDropdown.append("<li><a class=\"git-remote-new\"><span>" + Strings.CREATE_NEW_REMOTE + "</span></a></li>");
            $remotesDropdown.append("<li class=\"divider\"></li>");

            if (remotes.length === 0) {
                clearRemotePicker();
                return;
            }

            // Add options to change remote
            var $remotes = remotes.map(function (remoteInfo) {
                var canDelete = remoteInfo.name !== "origin";

                var $a = $("<a/>")
                    .attr("href", "#")
                    .addClass("remote-name")
                    .data("remote-name", remoteInfo.name);

                if (canDelete) {
                    $a.append("<span class='trash-icon remove-remote'>&times;</span>");
                }

                $a.append("<span class='change-remote'>" + remoteInfo.name + "</span>");
                $a.appendTo($("<li class=\"remote\"/>").appendTo($remotesDropdown));

                if (remoteInfo.name === defaultRemoteName) {
                    $defaultRemote = $a;
                }

                return $a;
            });

            if ($defaultRemote) {
                handleRemotePick(null, $defaultRemote);
            } else {
                handleRemotePick(null, _.first($remotes));
            }
        }).fail(function (err) {
            throw ErrorHandler.showError(err, "Failed to get a list of remotes.");
        });
    }

    function handleGitPushWithPassword(originalPushError, remoteName) {
        return Main.gitControl.getBranchName().then(function (branchName) {
            if (!remoteName) {
                throw ErrorHandler.rewrapError(originalPushError, new Error("handleGitPushWithPassword remote argument is empty!"));
            }
            return Main.gitControl.getGitConfig("remote." + remoteName + ".url").then(function (remoteUrl) {
                if (!remoteUrl) {
                    throw ErrorHandler.rewrapError(originalPushError, new Error("git config remote." + remoteName + ".url is empty!"));
                }

                var isHttp = remoteUrl.indexOf("http") === 0;
                if (!isHttp) {
                    throw ErrorHandler.rewrapError(originalPushError,
                                                   new Error("Asking for username/password aborted because remote is not HTTP(S)"));
                }

                var username,
                    password,
                    hasUsername,
                    hasPassword,
                    shouldSave = false;

                var m = remoteUrl.match(/https?:\/\/([^@]+)@/);
                if (!m) {
                    hasUsername = false;
                    hasPassword = false;
                } else if (m[1].split(":").length === 1) {
                    hasUsername = true;
                    hasPassword = false;
                } else {
                    hasUsername = true;
                    hasPassword = true;
                }

                if (hasUsername && hasPassword) {
                    throw ErrorHandler.rewrapError(originalPushError, new Error("Username/password is already present in the URL"));
                }

                var p = q();
                if (!hasUsername) {
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_USERNAME).then(function (str) {
                            username = encodeURIComponent(str);
                        });
                    });
                }
                if (!hasPassword) {
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_PASSWORD, {password: true}).then(function (str) {
                            password = encodeURIComponent(str);
                        });
                    });
                }
                if (Preferences.get("storePlainTextPasswords")) {
                    p = p.then(function () {
                        return askQuestion(Strings.TOOLTIP_PUSH, Strings.SAVE_PASSWORD_QUESTION, {booleanResponse: true}).then(function (bool) {
                            shouldSave = bool;
                        });
                    });
                }
                return p.then(function () {
                    if (!hasUsername) {
                        remoteUrl = remoteUrl.replace(/(https?:\/\/)/, function (a, protocol) { return protocol + username + "@"; });
                    }
                    if (!hasPassword) {
                        var io = remoteUrl.indexOf("@");
                        remoteUrl = remoteUrl.substring(0, io) + ":" + password + remoteUrl.substring(io);
                    }
                    return Main.gitControl.gitPush(remoteUrl, branchName).then(function (stdout) {
                        if (shouldSave) {
                            return Main.gitControl.setGitConfig("remote." + remoteName + ".url", remoteUrl).then(function () {
                                return stdout;
                            });
                        } else {
                            return stdout;
                        }
                    });
                });
            });
        });
    }

    function handleGitPush() {
        var $btn = gitPanel.$panel.find(".git-push").prop("disabled", true).addClass("btn-loading"),
            remoteName = gitPanel.$panel.find(".git-selected-remote").data("selected-remote");

        if (!remoteName) {
            ErrorHandler.showError("No remote has been selected for push!");
            return;
        }

        Main.gitControl.gitPush(remoteName).fail(function (err) {

            if (!ErrorHandler.contains(err, "git remote add <name> <url>")) {
                throw err;
            }
            // this will ask user to enter an origin url for pushing
            // it's pretty dumb because if he enters invalid url, he has to go to console again
            // but our users are very wise so that definitely won't happen :)))
            var defer = q.defer();
            var compiledTemplate = Mustache.render(questionDialogTemplate, {
                title: Strings.SET_ORIGIN_URL,
                question: _.escape(Strings.URL),
                stringInput: true,
                Strings: Strings
            });
            var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            dialog.getElement().find("input").focus();
            dialog.done(function (buttonId) {
                if (buttonId === "ok") {
                    var url = dialog.getElement().find("input").val().trim();
                    Main.gitControl.remoteAdd("origin", url)
                        .then(function () {
                            return Main.gitControl.gitPush("origin");
                        })
                        .then(defer.resolve)
                        .fail(defer.reject);
                }
            });
            return defer.promise;

        }).fail(function (err) {

            if (typeof err !== "string") { throw err; }
            var m = err.match(/git push --set-upstream (\S+) (\S+)/);
            if (!m) { throw err; }
            return Main.gitControl.gitPushSetUpstream(m[1], m[2]);

        }).fail(function (err) {

            var validFail = false;
            if (ErrorHandler.contains(err, "rejected because")) {
                validFail = true;
            }
            if (validFail) {
                throw err;
            } else {
                console.warn("Traditional push failed: " + err);
                return handleGitPushWithPassword(err, remoteName);
            }

        }).then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PUSH_RESPONSE, // title
                result // message
            );
        }).fail(function (err) {
            console.warn("Pushing to remote repositories with username / password is not supported! See github page/issues for details.");
            ErrorHandler.showError(err, "Pushing to remote repository failed.");
        }).fin(function () {
            $btn.prop("disabled", false).removeClass("btn-loading");
            refresh();
        });
    }

    function handleGitPull() {
        var $btn = gitPanel.$panel.find(".git-pull").prop("disabled", true).addClass("btn-loading"),
            remoteName = gitPanel.$panel.find(".git-selected-remote").data("selected-remote");

        if (!remoteName) {
            ErrorHandler.showError("No remote has been selected for pull!");
            return;
        }

        Main.gitControl.gitPull(remoteName).then(function (result) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_INFO,
                Strings.GIT_PULL_RESPONSE, // title
                result // message
            );
        }).fail(function (err) {
            ErrorHandler.showError(err, "Pulling from remote repository failed.");
        }).fin(function () {
            $btn.prop("disabled", false).removeClass("btn-loading");
            refresh();
        });
    }

    // Event subscriptions
    EventEmitter.on(Events.GIT_ENABLED, function () {
        prepareRemotesPicker();
    });

});
