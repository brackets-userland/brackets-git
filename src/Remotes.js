define(function (require) {

    // Brackets modules
    var _               = brackets.getModule("thirdparty/lodash"),
        DefaultDialogs  = brackets.getModule("widgets/DefaultDialogs"),
        Dialogs         = brackets.getModule("widgets/Dialogs"),
        StringUtils     = brackets.getModule("utils/StringUtils");

    // Local modules
    var ErrorHandler  = require("src/ErrorHandler"),
        Events        = require("src/Events"),
        EventEmitter  = require("src/EventEmitter"),
        Git           = require("src/Git/Git"),
        Preferences   = require("src/Preferences"),
        Strings       = require("strings"),
        Utils         = require("src/Utils");

    // Module variables
    var $selectedRemote  = null,
        $remotesDropdown = null;

    function initVariables() {
        var $gitPanel = $("#git-panel");
        $selectedRemote = $gitPanel.find(".git-selected-remote");
        $remotesDropdown = $gitPanel.find(".git-remotes-dropdown");
    }

    // Implementation

    function getDefaultRemote() {
        // TODO: refactor after Sprint 38 is published
        var key = ["defaultRemotes", Utils.getProjectRoot()].join(".");
        var defaultRemote = Preferences.get(key);
        return defaultRemote || "origin";
    }

    function setDefaultRemote(remoteName) {
        // TODO: refactor after Sprint 38 is published
        var key = ["defaultRemotes", Utils.getProjectRoot()].join(".");
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
        setDefaultRemote(remoteName);
        $selectedRemote
            .text(remoteName)
            .data("remote", remoteName);
    }

    function refreshRemotesPicker() {
        Git.getRemotes().then(function (remotes) {
            var defaultRemoteName = getDefaultRemote(),
                defaultRemote;

            // empty the list first
            $remotesDropdown.empty();

            // Add option to define new remote
            $remotesDropdown.append("<li><a class=\"git-remote-new\"><span>" + Strings.CREATE_NEW_REMOTE + "</span></a></li>");
            $remotesDropdown.append("<li class=\"divider\"></li>");

            if (remotes.length > 0) {
                EventEmitter.emit(Events.GIT_REMOTE_AVAILABLE);
            } else {
                EventEmitter.emit(Events.GIT_REMOTE_NOT_AVAILABLE);
                clearRemotePicker();
                return;
            }

            // Add options to change remote
            remotes.forEach(function (remoteInfo) {
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
                    defaultRemote = remoteInfo.name;
                }

                return $a;
            });

            selectRemote(defaultRemote || _.first(remotes).name);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Preparing remotes picker failed");
        });
    }

    function handleRemoteCreation() {
        return Utils.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_NAME)
            .then(function (name) {
                return Utils.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_URL).then(function (url) {
                    return [name, url];
                });
            })
            .spread(function (name, url) {
                return Git.createRemote(name, url).then(function () {
                    return refreshRemotesPicker();
                });
            })
            .catch(function (err) {
                ErrorHandler.showError(err, "Remote creation failed");
            });
    }

    function deleteRemote(remoteName) {
        return Utils.askQuestion(Strings.DELETE_REMOTE,
                                 StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName),
                                 { booleanResponse: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.deleteRemote(remoteName).then(function () {
                            return refreshRemotesPicker();
                        });
                    }
                })
                .catch(function (err) {
                    ErrorHandler.logError(err);
                });
    }

    function pullFromRemote(remoteName) {
        if (!remoteName) {
            ErrorHandler.showError("No remote has been selected for pull!");
            return;
        }

        EventEmitter.emit(Events.PULL_STARTED);

        Git.pull(remoteName).then(function (result) {
            Utils.showOutput(result, Strings.GIT_PULL_RESPONSE);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Pulling from remote repository failed.");
        }).finally(function () {
            EventEmitter.emit(Events.PULL_FINISHED);
        });
    }

    // Event subscriptions
    EventEmitter.on(Events.GIT_ENABLED, function () {
        initVariables();
        refreshRemotesPicker();
    });

    EventEmitter.on(Events.HANDLE_REMOTE_PICK, function (event) {
        var remoteName = $(event.target).closest(".remote-name").data("remote-name");
        selectRemote(remoteName);
    });

    EventEmitter.on(Events.HANDLE_REMOTE_CREATE, function () {
        handleRemoteCreation();
    });

    EventEmitter.on(Events.HANDLE_REMOTE_DELETE, function (event) {
        var remoteName = $(event.target).closest(".remote-name").data("remote-name");
        deleteRemote(remoteName);
    });

    EventEmitter.on(Events.HANDLE_PULL, function () {
        var remoteName = $selectedRemote.data("remote");
        pullFromRemote(remoteName);
    });

    /////-------------------------------------------------------------------------------







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

        Main.gitControl.gitPush(remoteName).catch(function (err) {

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
                        .catch(defer.reject);
                }
            });
            return defer.promise;

        }).catch(function (err) {

            if (typeof err !== "string") { throw err; }
            var m = err.match(/git push --set-upstream (\S+) (\S+)/);
            if (!m) { throw err; }
            return Main.gitControl.gitPushSetUpstream(m[1], m[2]);

        }).catch(function (err) {

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
        }).catch(function (err) {
            console.warn("Pushing to remote repositories with username / password is not supported! See github page/issues for details.");
            ErrorHandler.showError(err, "Pushing to remote repository failed.");
        }).finally(function () {
            $btn.prop("disabled", false).removeClass("btn-loading");
            refresh();
        });
    }





});
