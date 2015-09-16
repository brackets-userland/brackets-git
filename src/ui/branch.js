import { _ } from '../brackets';
import Events from '../events';
import EventEmitter from '../event-emitter';

const $branchContainer = $(`<div id="brackets-git-branch" class="btn-alt-quiet"/>`);
const $branchName = $(`<span class="branch-name">\u2026</span>`);

async function refresh() {



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

  refresh();

  // TODO: attach events triggering refresh here

});

EventEmitter.on(Events.GIT_WORKING, () => init());
