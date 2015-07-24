export default {
  GIT_WORKING: 'GIT_WORKING', // git executable has been found
  GIT_NOT_WORKING: 'GIT_NOT_WORKING', // extension failed to locate git executable
  GIT_ENABLED: 'GIT_ENABLED', // current project is within a git repository
  GIT_DISABLED: 'GIT_DISABLED', // current project is not a git repository
  GIT_STATUS_RESULTS: 'GIT_STATUS_RESULTS', // `git status` has been called
  PANEL_TOGGLED: 'PANEL_TOGGLED' // main panel has been shown/hidden
};
