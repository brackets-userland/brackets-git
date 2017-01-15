import { _, FileSystem, ProjectManager } from "./brackets-modules";
import EventEmitter from "./EventEmitter";
import * as Events from "./Events";
import * as Git from "./git/GitCli";
import * as Preferences from "./Preferences";
import * as Promise from "bluebird";

let ignoreEntries = [];
let newPaths = [];
let modifiedPaths = [];

function loadIgnoreContents() {
    const defer = Promise.defer();
    const gitRoot = Preferences.get("currentGitRoot");
    let excludeContents;
    let gitignoreContents;

    const finish = _.after(2, () => defer.resolve(excludeContents + "\n" + gitignoreContents));

    FileSystem.getFileForPath(gitRoot + ".git/info/exclude").read((err, content) => {
        excludeContents = err ? "" : content;
        finish();
    });

    FileSystem.getFileForPath(gitRoot + ".gitignore").read((err, content) => {
        gitignoreContents = err ? "" : content;
        finish();
    });

    return defer.promise;
}

function refreshIgnoreEntries() {
    function regexEscape(str) {
        // NOTE: We cannot use StringUtils.regexEscape() here because we don't wanna replace *
        return str.replace(/([.?+^$\\(){}|])/g, "\\$1");
    }

    return loadIgnoreContents().then((content: string) => {
        const gitRoot = Preferences.get("currentGitRoot");

        ignoreEntries = _.compact(_.map(content.split("\n"), (_line) => {
            // Rules: http://git-scm.com/docs/gitignore
            let line = _line;
            let type = "deny";
            let leadingSlash;
            let trailingSlash;
            let regex;

            line = line.trim();
            if (!line || line.indexOf("#") === 0) {
                return null;
            }

            // handle explicitly allowed files/folders with a leading !
            if (line.indexOf("!") === 0) {
                line = line.slice(1);
                type = "accept";
            }
            // handle lines beginning with a backslash, which is used for escaping ! or #
            if (line.indexOf("\\") === 0) {
                line = line.slice(1);
            }
            // handle lines beginning with a slash, which only matches files/folders in the root dir
            if (line.indexOf("/") === 0) {
                line = line.slice(1);
                leadingSlash = true;
            }
            // handle lines ending with a slash, which only exludes dirs
            if (line.lastIndexOf("/") === line.length) {
                // a line ending with a slash ends with **
                line += "**";
                trailingSlash = true;
            }

            // NOTE: /(.{0,})/ is basically the same as /(.*)/, but we can't use it because the asterisk
            // would be replaced later on

            // create the intial regexp here. We need the absolute path 'cause it could be that there
            // are external files with the same name as a project file
            regex = regexEscape(gitRoot) +
                (leadingSlash ? "" : "((.+)/)?") + regexEscape(line) + (trailingSlash ? "" : "(/.{0,})?");
            // replace all the possible asterisks
            regex = regex.replace(/\*\*$/g, "(.{0,})").replace(/(\*\*|\*$)/g, "(.+)").replace(/\*/g, "([^/]*)");
            regex = "^" + regex + "$";

            return { regexp: new RegExp(regex), type };
        }));
    });
}

function isIgnored(path) {
    let ignored = false;
    _.forEach(ignoreEntries, (entry) => {
        if (entry.regexp.test(path)) {
            ignored = (entry.type === "deny");
        }
    });
    return ignored;
}

function isNew(fullPath) {
    return newPaths.indexOf(fullPath) !== -1;
}

function isModified(fullPath) {
    return modifiedPaths.indexOf(fullPath) !== -1;
}

function _refreshOpenFiles() {
    $("#working-set-list-container").find("li").each(function () {
        const $li = $(this);
        const data = $li.data("file");
        if (data) {
            const fullPath = data.fullPath;
            $li.toggleClass("git-ignored", isIgnored(fullPath))
               .toggleClass("git-new", isNew(fullPath))
               .toggleClass("git-modified", isModified(fullPath));
        }
    });
}

const refreshOpenFiles = _.debounce(() => _refreshOpenFiles(), 100);

function attachEvents() {
    $("#working-set-list-container").on("contentChanged", refreshOpenFiles).triggerHandler("contentChanged");
}

function detachEvents() {
    $("#working-set-list-container").off("contentChanged", refreshOpenFiles);
}

if (Preferences.get("markModifiedInTree")) {

    // init here
    ProjectManager.addClassesProvider((data) => {
        const fullPath = data.fullPath;
        if (isIgnored(fullPath)) {
            return "git-ignored";
        } else if (isNew(fullPath)) {
            return "git-new";
        } else if (isModified(fullPath)) {
            return "git-modified";
        }
        return null;
    });

    // this will refresh ignore entries when .gitignore is modified
    EventEmitter.on(Events.BRACKETS_FILE_CHANGED, (evt, file) => {
        if (file.fullPath === Preferences.get("currentGitRoot") + ".gitignore") {
            refreshIgnoreEntries().finally(() => {
                refreshOpenFiles();
            });
        }
    });

    // this will refresh new/modified paths on every status results
    EventEmitter.on(Events.GIT_STATUS_RESULTS, (files) => {
        const gitRoot = Preferences.get("currentGitRoot");

        newPaths = [];
        modifiedPaths = [];

        files.forEach((entry) => {
            const _isNew = entry.status.indexOf(Git.FILE_STATUS.UNTRACKED) !== -1 ||
                           entry.status.indexOf(Git.FILE_STATUS.ADDED) !== -1;
            const fullPath = gitRoot + entry.file;
            if (_isNew) {
                newPaths.push(fullPath);
            } else {
                modifiedPaths.push(fullPath);
            }
        });

        ProjectManager.rerenderTree();
        refreshOpenFiles();
    });

    // this will refresh ignore entries when git project is opened
    EventEmitter.on(Events.GIT_ENABLED, () => {
        refreshIgnoreEntries();
        attachEvents();
    });

    // this will clear entries when non-git project is opened
    EventEmitter.on(Events.GIT_DISABLED, () => {
        ignoreEntries = [];
        newPaths = [];
        modifiedPaths = [];
        detachEvents();
    });
}
