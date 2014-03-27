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
        Promise       = require("bluebird"),
        Strings       = require("strings"),
        Utils         = require("src/Utils");

    // Templates
    var gitRemotesPickerTemplate = require("text!templates/git-remotes-picker.html");

    // Module variables
    var $selectedRemote  = null,
        $remotesDropdown = null,
        $gitPanel = null;

    function initVariables() {
        $gitPanel = $("#git-panel");
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

    function selectRemote(remoteName, type) {
        if (!remoteName) {
            return clearRemotePicker();
        }
        // Set as default remote only if is a normal git remote
        if (type === "git") { setDefaultRemote(remoteName); }

        // Disable pull if it is not a normal git remote
        $gitPanel.find("git-pull").prop("disabled", type !== "git");

        // Update remote name of $selectedRemote
        $selectedRemote
            .text(remoteName)
            .attr("data-type", type) // use attr to apply CSS styles
            .data("remote", remoteName);
    }

    function refreshRemotesPicker() {
        Git.getRemotes().then(function (remotes) {
            // Set default remote name and cache the remotes dropdown menu
            var defaultRemoteName    = getDefaultRemote();

            // Disable Git-push and Git-pull if there are not remotes defined
            $gitPanel
                .find(".git-pull, .git-push")
                .prop("disabled", remotes.length === 0);

            // Add options to change remote
            remotes.forEach(function (remote) {
                remote.deletable = remote.name !== "origin";
            });

            // Pass to Mustache the needed data
            var compiledTemplate = Mustache.render(gitRemotesPickerTemplate, {
                Strings: Strings,
                remotes: remotes
            });

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
        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting remotes failed!");
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
                if (!ErrorHandler.equals(err, Strings.USER_ABORTED)) {
                    ErrorHandler.showError(err, "Remote creation failed");
                }
            });
    }

    function deleteRemote(remoteName) {
        return Utils.askQuestion(Strings.DELETE_REMOTE, StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName), { booleanResponse: true })
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

    function decideRemoteBranch(remoteName) {
        remoteName = remoteName + "/";
        return Git.getCurrentUpstreamBranch().then(function (upstreamBranch) {
            return Git.getCurrentBranchName().then(function (currentBranch) {

                // if we don't have an upstream branch - remote branch will have the same name
                if (!upstreamBranch) {
                    return [currentBranch, true];
                }

                if (upstreamBranch.indexOf(remoteName) === 0) {
                    // we are pushing to upstream
                    upstreamBranch = upstreamBranch.substring(remoteName.length);
                } else {
                    // we are pushing to different remote than upstream
                    upstreamBranch = currentBranch;
                }
                return [upstreamBranch, false];
            });
        });
    }

    function pushToRemote(remoteName) {
        if (!remoteName) {
            ErrorHandler.showError("No remote has been selected for push!");
            return;
        }

        EventEmitter.emit(Events.PUSH_STARTED);
        decideRemoteBranch(remoteName).spread(function (remoteBranch, newUpstream) {
            var p;
            if (newUpstream) {
                p = Git.pushToNewUpstream(remoteName, remoteBranch);
            } else {
                p = Git.push(remoteName, remoteBranch);
            }
            return p.catch(function (err) {

                if (!ErrorHandler.contains(err, "git remote add <name> <url>")) {
                    throw err;
                }

                // this will ask user to enter an origin url for pushing
                // it's pretty dumb because if he enters invalid url, he has to go to console again
                // but our users are very wise so that definitely won't happen :)))

                return new Promise(function (resolve, reject) {
                    Utils.askQuestion(Strings.SET_ORIGIN_URL, _.escape(Strings.URL)).then(function (url) {
                        Git.createRemote("origin", url)
                            .then(function () {
                                return Git.push("origin");
                            })
                            .then(resolve)
                            .catch(reject);
                    });
                });

            }).catch(function (err) {

                throw err;
                /* this shouldn't be needed anymore
                if (typeof err !== "string") { throw err; }
                var m = err.match(/git push --set-upstream (\S+) (\S+)/);
                if (!m) { throw err; }
                return Git.pushToNewUpstream(m[1], m[2]);
                */

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

                var template = [
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

            }).catch(function (err) {
                console.warn("Pushing to remote repositories with username / password is not fully supported! See github page/issues for details.");
                ErrorHandler.showError(err, "Pushing to remote repository failed.");
            });
        }).finally(function () {
            EventEmitter.emit(Events.PUSH_FINISHED);
        });
    }

    function handleGitPushWithPassword(originalPushError, remoteName) {
        if (!remoteName) {
            throw ErrorHandler.rewrapError(originalPushError, new Error("handleGitPushWithPassword remote argument is empty!"));
        }
        return Git.getCurrentBranchName().then(function (branchName) {
            return Git.getConfig("remote." + remoteName + ".url").then(function (remoteUrl) {
                if (!remoteUrl) {
                    throw ErrorHandler.rewrapError(originalPushError, new Error("git config remote." + remoteName + ".url is empty!"));
                }
                return [branchName, remoteUrl];
            });
        }).spread(function (branchName, remoteUrl) {

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

            var p = Promise.resolve();
            if (!hasUsername) {
                p = p.then(function () {
                    return Utils.askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_USERNAME).then(function (str) {
                        username = encodeURIComponent(str);
                    });
                });
            }
            if (!hasPassword) {
                p = p.then(function () {
                    return Utils.askQuestion(Strings.TOOLTIP_PUSH, Strings.ENTER_PASSWORD, {password: true}).then(function (str) {
                        password = encodeURIComponent(str);
                    });
                });
            }
            if (Preferences.get("storePlainTextPasswords")) {
                p = p.then(function () {
                    return Utils.askQuestion(Strings.TOOLTIP_PUSH, Strings.SAVE_PASSWORD_QUESTION, {booleanResponse: true}).then(function (bool) {
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
                return Git.push(remoteUrl, branchName).then(function (pushResponse) {
                    if (shouldSave) {
                        return Git.setConfig("remote." + remoteName + ".url", remoteUrl).then(function () {
                            return pushResponse;
                        });
                    } else {
                        return pushResponse;
                    }
                });
            });
        });
    }

    // Event subscriptions
    EventEmitter.on(Events.GIT_ENABLED, function () {
        initVariables();
        refreshRemotesPicker();
    });

    EventEmitter.on(Events.HANDLE_REMOTE_PICK, function (event) {
        var $remote     = $(event.target).closest(".remote-name"),
            remoteName  = $remote.data("remote-name"),
            type        = $remote.data("type");
        selectRemote(remoteName, type);
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

    EventEmitter.on(Events.HANDLE_PUSH, function () {
        var remoteName = $selectedRemote.data("remote");
        pushToRemote(remoteName);
    });

});
