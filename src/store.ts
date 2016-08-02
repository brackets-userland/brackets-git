import toolbarGitIcon from './toolbar-git-icon/toolbar-git-icon-reducer';
const { combineReducers, createStore } = require('redux');

const store = createStore(combineReducers({
  toolbarGitIcon
}));

export default store;
