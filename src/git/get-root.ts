import { git } from './index';
import { debug } from '../log';
import { errContains } from '../error-handler';
import { getProjectRoot, pathExists } from '../utils';

export default async function getRoot() {

  const projectRoot = getProjectRoot();

  try {
    await git(['rev-parse', '--show-toplevel']);
  } catch (err) {
    if (errContains(err, 'Not a git repository')) {
      return null;
    }
    throw err;
  }

  // we know projectRoot is in a Git repo now
  // because --show-toplevel didn't return Not a git repository
  // we need to find closest .git

  let path = projectRoot;
  if (path.endsWith('/')) { path = path.slice(0, -1); }

  do {
    debug(`[get-root] Checking path for .git: ${path}`);

    let isGitRoot = await pathExists(`${path}/.git`);
    if (isGitRoot) {
      debug(`[get-root] Found .git in path: ${path}`);
      break;
    }

    debug(`[get-root] Failed to find .git in path: ${path}`);
    path = path.split('/');
    path.pop();
    path = path.join('/');
  } while (path);

  if (!path.endsWith('/')) { path += '/'; }
  return path;
}
