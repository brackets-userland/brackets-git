import toolbarGitIcon from './toolbar-git-icon/toolbar-git-icon-reducer';
import { combineReducers, createStore } from 'redux';

const store = createStore(combineReducers({
  toolbarGitIcon
}));

export default store;
