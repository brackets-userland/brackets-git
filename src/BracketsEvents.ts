import { _, DocumentManager, FileSystem, ProjectManager, MainViewManager } from "./brackets-modules";
import * as Events from "./Events";
import EventEmitter from "./EventEmitter";
import * as HistoryViewer from "./HistoryViewer";
import * as Preferences from "./Preferences";
import * as Utils from "./Utils";

// White-list for .git file watching
const watchedInsideGit = ["HEAD"];

FileSystem.on("change", (evt, file) => {
    // we care only for files in current project
    const currentGitRoot = Preferences.get("currentGitRoot");
    if (file && file.fullPath.indexOf(currentGitRoot) === 0) {

        if (file.fullPath.indexOf(currentGitRoot + ".git/") === 0) {

            const whitelisted = _.any(watchedInsideGit, (entry) => {
                return file.fullPath === currentGitRoot + ".git/" + entry;
            });
            if (!whitelisted) {
                Utils.consoleDebug("Ignored FileSystem.change event: " + file.fullPath);
                return;
            }

        }

        EventEmitter.emit(Events.BRACKETS_FILE_CHANGED, evt, file);
    }
});

DocumentManager.on("documentSaved", (evt, doc) => {
    // we care only for files in current project
    if (doc.file.fullPath.indexOf(Preferences.get("currentGitRoot")) === 0) {
        EventEmitter.emit(Events.BRACKETS_DOCUMENT_SAVED, evt, doc);
    }
});

MainViewManager.on("currentFileChange", (evt, currentDocument, previousDocument) => {
    if (!HistoryViewer.isVisible()) {
        const _currentDocument = currentDocument || DocumentManager.getCurrentDocument();
        EventEmitter.emit(Events.BRACKETS_CURRENT_DOCUMENT_CHANGE, evt, _currentDocument, previousDocument);
    } else {
        HistoryViewer.hide();
    }
});

ProjectManager.on("projectOpen", () => EventEmitter.emit(Events.BRACKETS_PROJECT_CHANGE));

ProjectManager.on("projectRefresh", () => EventEmitter.emit(Events.BRACKETS_PROJECT_REFRESH));

// Disable Git when closing a project so listeners won't fire before new is opened
ProjectManager.on("beforeProjectClose", () => EventEmitter.emit(Events.GIT_DISABLED));
