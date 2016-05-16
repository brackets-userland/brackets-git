import Strings from 'strings';

const toolbarGitIcon = (state = {}, action) => {
  switch (action.type) {
    case 'GIT_LOADING':
      return Object.assign({}, state, {
        title: Strings.LOADING
      });
    default:
      return state;
  }
};

export default toolbarGitIcon;
