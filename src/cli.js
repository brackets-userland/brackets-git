import * as NodeConnector from './node-connector';
import { debug } from './log';
import { ProjectManager } from './brackets';

let pidCounter = 1;

export function spawn(opts) {

  opts.pid = pidCounter++;

  if (!opts.cwd) {
    // default to current project directory
    opts.cwd = ProjectManager.getProjectRoot().fullPath;
  }

  debug(`[cli] spawn pid ${opts.pid}: ${opts.cmd} ${opts.args}`);
  return NodeConnector.call('cli-domain', 'spawn', opts)
    .then(stdout => {
      debug(`[cli] pid ${opts.pid} OUT: ${stdout}`);
      return stdout;
    })
    .catch(stderr => {
      debug(`[cli] pid ${opts.pid} ERR: ${stderr}`);
      throw stderr;
    });
}
