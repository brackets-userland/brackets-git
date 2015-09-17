import Events from '../events';
import EventEmitter from '../event-emitter';
import Preferences from '../preferences';
import Strings from 'strings';
import getRoot from '../git/get-root';
import getBranchName from '../git/get-branch-name';
import getMergeInfo from '../git/get-merge-info';
import { _ } from '../brackets';
import { getProjectRoot } from '../utils';
import { handleError } from '../error-handler';
import * as branchUi from '../ui/branch';

async function refresh() {
  branchUi.setText('\u2026');

  let gitRoot = await getRoot();
  let projectRoot = getProjectRoot();
  let isRepositoryRootOrChild = gitRoot && projectRoot.startsWith(gitRoot);

  branchUi.toggle(isRepositoryRootOrChild);

  if (!isRepositoryRootOrChild) {
    Preferences.set('currentGitRoot', projectRoot);
    Preferences.set('currentGitSubfolder', '');
    EventEmitter.emit(Events.GIT_REPO_NOT_AVAILABLE, Strings.PROJECT_NOT_A_REPO);
    return;
  }

  Preferences.set('currentGitRoot', gitRoot);
  Preferences.set('currentGitSubfolder', projectRoot.substring(gitRoot.length));

  let branchName = await getBranchName();
  let mergeInfo = await getMergeInfo();

  if (mergeInfo.mergeMode) {
    branchName += '|MERGING';
  }

  if (mergeInfo.rebaseMode) {
    if (mergeInfo.rebaseHead) {
      branchName = mergeInfo.rebaseHead;
    }
    branchName += '|REBASE';
    if (mergeInfo.rebaseNext && mergeInfo.rebaseLast) {
      branchName += '(' + mergeInfo.rebaseNext + '/' + mergeInfo.rebaseLast + ')';
    }
  }

  branchUi.setBranchName(branchName);

  EventEmitter.emit(Events.GIT_REPO_AVAILABLE);
  EventEmitter.emit(Events.REBASE_MERGE_MODE, mergeInfo.rebaseMode, mergeInfo.mergeMode);
}

const init = _.once(function () {
  branchUi.init();
  refresh().catch(err => handleError(err));
  // TODO: attach events triggering refresh here
});

EventEmitter.on(Events.GIT_WORKING, () => init());
