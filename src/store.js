import { createStore } from 'redux';
import { deepFreeze } from './utils';

const toolbarGitIcon = (
  state = {},
  action
) => {
  return {};
};

const bracketsGit = (previousState = {}, action) => {
  deepFreeze(previousState);
  return Object.assign({}, previousState, {
    toolbarGitIcon: toolbarGitIcon(previousState, action)
  });
};

const store = createStore(bracketsGit);

export default store;

