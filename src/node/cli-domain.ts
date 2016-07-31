import 'core-js/shim';
import 'regenerator/runtime';
import spawn from 'cross-spawn-async';

const DOMAIN_NAME = 'cli-domain';
const processMap = {};
const fixEOL = str => str[str.length - 1] === '\n' ? str.slice(0, -1) : str;
const joinBuffers = arr => fixEOL(arr.map(buf => buf.toString('utf8')).join(''));

let domainManager;

/*
  supported options for execute and spawn:
  - pid: process id, can be used with killHandler to kill a spawned process
  - cwd: working directory to use when spawning
  - cmd: cmd to spawn
  - args: array of arguments to supply to cmd
*/

function spawnAsync({ pid, cwd, cmd, args = [] }, progressCallback) {
  return new Promise(function (resolve, reject) {

    let child = spawn(cmd, args, { cwd });
    child.on('error', err => reject(err.stack));

    // map gui pid to real pid
    if (pid) { processMap[pid] = child.pid; }

    let exitCode;
    let stdout = [];
    let stderr = [];

    child.stdout.addListener('data', data => stdout[stdout.length] = data);

    child.stderr.addListener('data', data => {
      progressCallback(fixEOL(data.toString('utf8')));
      stderr[stderr.length] = data;
    });

    child.addListener('exit', code => exitCode = code);

    child.addListener('close', () => {
      if (pid) { delete processMap[pid]; }
      return exitCode > 0 ? reject(joinBuffers(stderr)) : resolve(joinBuffers(stdout));
    });

    child.stdin.end();
  });
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
