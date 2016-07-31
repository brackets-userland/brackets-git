// TODO: make sure all these are actually emitted
export default {
  GIT_WORKING: 'GIT_WORKING', // git executable has been found
  GIT_NOT_WORKING: 'GIT_NOT_WORKING', // extension failed to locate git executable
  GIT_REPO_AVAILABLE: 'GIT_REPO_AVAILABLE', // current project is within a git repository
  GIT_REPO_NOT_AVAILABLE: 'GIT_REPO_NOT_AVAILABLE', // current project is not a git repository
  GIT_STATUS_RESULTS: 'GIT_STATUS_RESULTS', // `git status` has been called
  PANEL_TOGGLED: 'PANEL_TOGGLED', // main panel has been shown/hidden
  REBASE_MERGE_MODE: 'REBASE_MERGE_MODE' // informs extension that a merge or rebase has been detected
};
