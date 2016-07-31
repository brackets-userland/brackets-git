import { git } from './index';

export default async function getBranches({ all = false } = {}) {

  let args = ['branch', '--no-color'];
  if (all) { args.push('-a'); }

  let stdout = await git(args);
  stdout = stdout.trim();
  if (!stdout) { return []; }

  return stdout.split('\n').reduce(function (arr, l) {
    let name = l.trim();
    let currentBranch = false;
    let remote = null;
    let sortPrefix = '';

    if (name.includes('->')) {
      return arr;
    }

    if (name.startsWith('*')) {
      name = name.substring(1).trim();
      currentBranch = true;
    }

    if (name.startsWith('remotes/')) {
      name = name.substring('remotes/'.length);
      remote = name.substring(0, name.indexOf('/'));
    }

    let sortName = name.toLowerCase();
    if (remote) {
      sortName = sortName.substring(remote.length + 1);
    }
    if (sortName.includes('#')) {
      sortPrefix = sortName.substring(0, sortName.indexOf('#'));
    }

    arr.push({ name, currentBranch, remote, sortPrefix, sortName });
    return arr;
  }, []);
}
