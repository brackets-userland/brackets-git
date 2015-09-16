import Events from '../events';
import EventEmitter from '../event-emitter';
import Preferences from '../preferences';
import { watchFile } from '../node-utils';

function watchHeadFile() {
  const headFilePath = Preferences.get('currentGitRoot') + '.git/HEAD';
  watchFile(headFilePath);
}

EventEmitter.on(Events.GIT_REPO_AVAILABLE, function () {
  watchHeadFile();
});
