import Events from '../events';
import EventEmitter from '../event-emitter';
import Preferences from '../preferences';
import Promise from 'bluebird';
import { _ } from '../brackets';
import { spawn } from '../cli';
import { watchFile } from '../node-utils';

let _gitPath = Preferences.get('gitPath') || 'git';
let _gitQueue = [];
let _gitQueueBusy = false;

export function setGitPath(value) {
  if (typeof value === 'string') {
    Preferences.set('gitPath', value);
    _gitPath = value;
  }
  return _gitPath;
}

function _processQueue() {

  // do nothing if the queue is busy
  if (_gitQueueBusy) {
    return;
  }

  // do nothing if the queue is empty
  if (_gitQueue.length === 0) {
    _gitQueueBusy = false;
    return;
  }

  // get item from queue
  let item = _gitQueue.shift();
  let defer = item[0];
  let args = item[1];
  let opts = item[2];

  // execute git command in a queue so no two commands are running at the same time
  if (opts.nonblocking !== true) {
    _gitQueueBusy = true;
  }

  spawn(_.defaults({ cmd: _gitPath, args }, opts))
    .then(result => defer.resolve(result))
    .catch(err => {
      err.stack = [`call: git ${args.join(' ')}`, err.stack].join('\n');
      defer.reject(err);
    })
    .then(function () {
      if (opts.nonblocking !== true) {
        _gitQueueBusy = false;
      }
      _processQueue();
    });
}

export function git(args = [], opts = {}) {
  let defer = Promise.defer();
  _gitQueue.push([defer, args, opts]);
  _processQueue();
  return defer.promise;
}

function watchHeadFile() {
  const headFilePath = Preferences.get('currentGitRoot') + '.git/HEAD';
  watchFile(headFilePath);
}

EventEmitter.on(Events.GIT_REPO_AVAILABLE, function () {
  watchHeadFile();
});
