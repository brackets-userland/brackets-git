define(function (require) {

    // Brackets modules
    var FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ProjectManager  = brackets.getModule("project/ProjectManager");

    // Local modules
    var Promise         = require("bluebird"),
        Strings         = require("strings"),
        ErrorHandler    = require("src/ErrorHandler"),
        Events          = require("src/Events"),
        EventEmitter    = require("src/EventEmitter"),
        ExpectedError   = require("src/ExpectedError"),
        ProgressDialog  = require("src/dialogs/Progress"),
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

    function commitGitIgnore(msg) {
        return createGitIgnore().then(function () {
            return Git.stage(".gitignore");
        }).then(function () {
            return Git.commit(msg || ".gitignore created by brackets-git extension");
        }).then(function () {
            return EventEmitter.emit(Events.HANDLE_PROJECT_REFRESH);
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
            return commitGitIgnore("Initial commit");
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
        isProjectRootEmpty().then(function (isEmpty) {
            if (isEmpty) {
                return Utils.askQuestion(Strings.CLONE_REPOSITORY, Strings.ENTER_REMOTE_GIT_URL).then(function (remoteGitUrl) {
                    $gitPanel.find(".git-clone").prop("disabled", true);
                    return ProgressDialog.show(Git.clone(remoteGitUrl, "."))
                        .then(function () {
                            EventEmitter.emit(Events.REFRESH_ALL);
                        });
                });
            } else {
                var err = new ExpectedError("Project root is not empty, be sure you have deleted hidden files");
                ErrorHandler.showError(err, "Cloning remote repository failed!");
            }
        }).catch(function (err) {
            ErrorHandler.showError(err);
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
        commitGitIgnore();
    });

});
