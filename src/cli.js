import * as NodeConnector from './node-connector';
import { debug } from './log';
import { getProjectRoot } from './utils';

let pidCounter = 1;

export function spawn(opts) {

  opts.pid = pidCounter++;

  if (!opts.cwd) {
    // default to current project directory
    opts.cwd = getProjectRoot();
  }

  debug(`[cli] spawn pid ${opts.pid}: ${opts.cmd} ${opts.args.join(' ')}`);
  return NodeConnector.call('cli-domain', 'spawn', opts)
    .then(stdout => {
      debug(`[cli] pid ${opts.pid} OUT: ${stdout}`);
      return stdout;
    })
    .catch(stderr => {
      if (stderr instanceof Error) { stderr = stderr.stack; }
      debug(`[cli] pid ${opts.pid} ERR: ${stderr}`);
      throw stderr;
    });
}
