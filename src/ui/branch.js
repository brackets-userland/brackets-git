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

const $branchContainer = $(`<div id="brackets-git-branch" class="btn-alt-quiet"/>`);
const $branchName = $(`<span class="branch-name">\u2026</span>`);
const MAX_LEN = 20;

function toggleDropdown() {

}

async function refresh() {
  $branchName.text('\u2026').parent().show();

  let gitRoot = await getRoot();
  let projectRoot = getProjectRoot();
  let isRepositoryRootOrChild = gitRoot && projectRoot.startsWith(gitRoot);

  $branchName.parent().toggle(isRepositoryRootOrChild);

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

  let branchNameTooLong = branchName.length > MAX_LEN;
  let displayBranchName = branchNameTooLong ? branchName.substring(0, MAX_LEN) + '\u2026' : branchName;

  $branchName
    .text(displayBranchName)
    .attr('title', branchNameTooLong ? branchName : null)
    .off('click')
    .on('click', toggleDropdown)
    .append($('<span class="dropdown-arrow" />'));

  EventEmitter.emit(Events.GIT_REPO_AVAILABLE);
  EventEmitter.emit(Events.REBASE_MERGE_MODE, mergeInfo.rebaseMode, mergeInfo.mergeMode);
}

const init = _.once(function () {

  $branchContainer
    .append('[ ')
    .append($branchName)
    .append(' ]')
    .on('click', function () {
      $branchName.click();
      return false;
    })
    .appendTo('#project-files-header');

  refresh().catch(err => handleError(err));

  // TODO: attach events triggering refresh here

});

EventEmitter.on(Events.GIT_WORKING, () => init());
