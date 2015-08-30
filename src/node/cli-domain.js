if (!global._babelPolyfill) { require('babel-core/polyfill'); }

import spawn from 'cross-spawn-async';

const DOMAIN_NAME = 'cli-domain';

let domainManager;

/*
  supported options for execute and spawn:
  - pid: process id, can be used with killHandler to kill a spawned process
  - cwd: working directory to use when spawning
  - cmd: cmd to spawn
  - args: array of arguments to supply to cmd
*/

async function executeAsync({ pid, cwd, cmd, args = [] }, progressCallback) {

}

async function spawnAsync({ pid, cwd, cmd, args = [] }, progressCallback) {

}

async function killAsync({ pid }, progressCallback) {

}

async function whichAsync({ cmd }, progressCallback) {

}

export function init(_domainManager) {
  domainManager = _domainManager;

  if (domainManager.hasDomain(DOMAIN_NAME)) {
    throw new Error(`${DOMAIN_NAME} domain already registered.
      Close all Brackets instances and start again.
      This should only happen when updating the extension.`);
  }

  domainManager.registerDomain(DOMAIN_NAME, { major: 0, minor: 1 });

  domainManager.registerCommand(
    DOMAIN_NAME,
    'execute',
    function executeHandler(options, callback, progressCallback) {
      executeAsync(options, progressCallback)
        .then(stdout => callback(null, stdout))
        .catch(stderr => callback(stderr, null));
    },
    true,
    'Executes a command and returns its stdout.',
    [ { name: 'options', type: 'object' } ],
    [ { name: 'stdout', type: 'string' } ]
  );

  domainManager.registerCommand(
    DOMAIN_NAME,
    'spawn',
    function spawnHandler(options, callback, progressCallback) {
      spawnAsync(options, progressCallback)
        .then(stdout => callback(null, stdout))
        .catch(stderr => callback(stderr, null));
    },
    true,
    'Spawns a command and returns its stdout.',
    [ { name: 'options', type: 'object' } ],
    [ { name: 'stdout', type: 'string' } ]
  );

  domainManager.registerCommand(
    DOMAIN_NAME,
    'kill',
    function killHandler(options, callback, progressCallback) {
      killAsync(options, progressCallback)
        .then(stdout => callback(null, stdout))
        .catch(stderr => callback(stderr, null));
    },
    true,
    'Kills a process with given pid.',
    [ { name: 'options', type: 'object' } ],
    [ { name: 'stdout', type: 'string' } ]
  );

  domainManager.registerCommand(
    DOMAIN_NAME,
    'which',
    function whichHandler(options, callback, progressCallback) {
      whichAsync(options, progressCallback)
        .then(stdout => callback(null, stdout))
        .catch(stderr => callback(stderr, null));
    },
    true,
    'Looks for a given file using which.',
    [ { name: 'options', type: 'object' } ],
    [ { name: 'stdout', type: 'string' } ]
  );
}
