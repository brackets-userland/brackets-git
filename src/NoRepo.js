define(function (require) {

    // Brackets modules
    var FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager");

    // Local modules
    var Promise         = require("bluebird"),
        ErrorHandler    = require("src/ErrorHandler"),
        Events          = require("src/Events"),
        EventEmitter    = require("src/EventEmitter"),
        ExpectedError   = require("src/ExpectedError"),
        ProgressDialog  = require("src/dialogs/Progress"),
        CloneDialog     = require("src/dialogs/Clone"),
        Git             = require("src/git/Git"),
        Preferences     = require("src/Preferences"),
        Utils           = require("src/Utils");

    // Templates
    var gitignoreTemplate = require("text!templates/default-gitignore");

    // Module variables

    // Implementation

    function createGitIgnore() {
        var gitIgnorePath = Preferences.get("currentGitRoot") + ".gitignore";
        return Utils.pathExists(gitIgnorePath).then(function (exists) {
            if (!exists) {
                return Promise.cast(FileUtils.writeText(FileSystem.getFileForPath(gitIgnorePath), gitignoreTemplate));
            }
        });
    }

    function stageGitIgnore(msg) {
        return createGitIgnore().then(function () {
            return Git.stage(".gitignore");
        });
    }

    function handleGitInit() {
        Utils.isProjectRootWritable().then(function (writable) {
            if (!writable) {
                throw new ExpectedError("Folder " + Utils.getProjectRoot() + " is not writable!");
            }
            return Git.init().catch(function (err) {

                if (ErrorHandler.contains(err, "Please tell me who you are")) {
                    var defer = Promise.defer();
                    EventEmitter.emit(Events.GIT_CHANGE_USERNAME, null, function () {
                        EventEmitter.emit(Events.GIT_CHANGE_EMAIL, null, function () {
                            Git.init().then(function (result) {
                                defer.resolve(result);
                            }).catch(function (err) {
                                defer.reject(err);
                            });
                        });
                    });
                    return defer.promise;
                }

                throw err;

            });
        }).then(function () {
            return stageGitIgnore("Initial staging");
        }).catch(function (err) {
            ErrorHandler.showError(err, "Initializing new repository failed");
        }).then(function () {
            EventEmitter.emit(Events.REFRESH_ALL);
        });
    }

    // This checks if the project root is empty (to let Git clone repositories)
    function isProjectRootEmpty() {
        return new Promise(function (resolve, reject) {
            ProjectManager.getProjectRoot().getContents(function (err, entries) {
                if (err) {
                    return reject(err);
                }
                resolve(entries.length === 0);
            });
        });
    }

    function handleGitClone() {
        var $gitPanel = $("#git-panel");
        var $cloneButton = $gitPanel.find(".git-clone");
        $cloneButton.prop("disabled", true);
        isProjectRootEmpty().then(function (isEmpty) {
            if (isEmpty) {
                CloneDialog.show().then(function (cloneConfig) {
                    var q = Promise.resolve();
                    // put username and password into remote url
                    var remoteUrl = cloneConfig.remoteUrl;
                    if (cloneConfig.remoteUrlNew) {
                        remoteUrl = cloneConfig.remoteUrlNew;
                    }

                    // do the clone
                    q = q.then(function () {
                        return ProgressDialog.show(Git.clone(remoteUrl, "."));
                    }).catch(function (err) {
                        ErrorHandler.showError(err, "Cloning remote repository failed!");
                    });

                    // restore original url if desired
                    if (cloneConfig.remoteUrlRestore) {
                        q = q.then(function () {
                            return Git.setRemoteUrl(cloneConfig.remote, cloneConfig.remoteUrlRestore);
                        });
                    }

                    return q.finally(function () {
                        EventEmitter.emit(Events.REFRESH_ALL);
                    });
                }).catch(function (err) {
                    // when dialog is cancelled, there's no error
                    if (err) { ErrorHandler.showError(err, "Cloning remote repository failed!"); }
                });

            } else {
                var err = new ExpectedError("Project root is not empty, be sure you have deleted hidden files");
                ErrorHandler.showError(err, "Cloning remote repository failed!");
            }
        }).catch(function (err) {
            ErrorHandler.showError(err);
        }).finally(function () {
            $cloneButton.prop("disabled", false);
        });
    }

    // Event subscriptions
    EventEmitter.on(Events.HANDLE_GIT_INIT, function () {
        handleGitInit();
    });
    EventEmitter.on(Events.HANDLE_GIT_CLONE, function () {
        handleGitClone();
    });
    EventEmitter.on(Events.GIT_NO_BRANCH_EXISTS, function () {
        stageGitIgnore();
    });

});
