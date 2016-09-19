/**
 * List of Events to be used in the extension.
 * Events should be structured by file who emits them.
 */

// Brackets events
export const BRACKETS_CURRENT_DOCUMENT_CHANGE = "brackets.current.document.change";
export const BRACKETS_PROJECT_CHANGE = "brackets.project.change";
export const BRACKETS_PROJECT_REFRESH = "brackets.project.refresh";
export const BRACKETS_DOCUMENT_SAVED = "brackets.document.saved";
export const BRACKETS_FILE_CHANGED = "brackets.file.changed";

// Git events
export const GIT_USERNAME_CHANGED = "git.username.changed";
export const GIT_EMAIL_CHANGED = "git.email.changed";
export const GIT_COMMITED = "git.commited";
export const GIT_NO_BRANCH_EXISTS = "git.no.branch.exists";
export const GIT_CHANGE_USERNAME = "git.change.username";
export const GIT_CHANGE_EMAIL = "git.change.email";

// Gerrit events
export const GERRIT_TOGGLE_PUSH_REF = "gerrit.toggle.push.ref";
export const GERRIT_PUSH_REF_TOGGLED = "gerrit.push.ref.toggled";

// Startup events
export const REFRESH_ALL = "git.refresh.all";
export const GIT_ENABLED = "git.enabled";
export const GIT_DISABLED = "git.disabled";
export const REBASE_MERGE_MODE = "rebase.merge.mode";

// Panel.js
export const HANDLE_GIT_INIT = "handle.git.init";
export const HANDLE_GIT_CLONE = "handle.git.clone";
export const HANDLE_GIT_COMMIT = "handle.git.commit";
export const HANDLE_FETCH = "handle.fetch";
export const HANDLE_PUSH = "handle.push";
export const HANDLE_PULL = "handle.pull";
export const HANDLE_REMOTE_PICK = "handle.remote.pick";
export const HANDLE_REMOTE_DELETE = "handle.remote.delete";
export const HANDLE_REMOTE_CREATE = "handle.remote.create";
export const HANDLE_FTP_PUSH = "handle.ftp.push";
export const HISTORY_SHOW = "history.show";
export const REFRESH_COUNTERS = "refresh.counters";

// Git results
export const GIT_STATUS_RESULTS = "git.status.results";

// Remotes.js
export const GIT_REMOTE_AVAILABLE = "git.remote.available";
export const GIT_REMOTE_NOT_AVAILABLE = "git.remote.not.available";
export const REMOTES_REFRESH_PICKER = "remotes.refresh.picker";
export const FETCH_STARTED = "remotes.fetch.started";
export const FETCH_COMPLETE = "remotes.fetch.complete";

// utils/Terminal.js
export const TERMINAL_OPEN = "terminal.open";
export const TERMINAL_DISABLE = "terminal.disable";
