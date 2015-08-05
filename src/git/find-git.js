import { _, Preferences } from '../brackets';
import { getMinimumGitVersion, getExtensionDirectory } from '../extension-info';
import { warn } from '../log';
import { setPath } from './index';
import Cli from '../cli';

const standardGitPathsWin = [
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\cmd\\git.exe'
];

const standardGitPathsNonWin = [
  '/usr/local/git/bin/git',
  '/usr/local/bin/git',
  '/usr/bin/git'
];

export async function findGit() {

  const paths = [
    Preferences.get('gitPath'),
    'git'
  ].concat(brackets.platform === 'win' ? standardGitPathsWin : standardGitPathsNonWin);

  // make sure paths are unique so we're not checking the same path twice
  paths = _.unique(_.compact(paths));

  let gitPath;
  let gitVersion;

  for (let path of paths) {

    let stdout;
    try {
      stdout = await Cli.spawnCommand(path, ['--version'], { cwd: getExtensionDirectory() });
    } catch (err) {
      warn(`failed to find git at ${path}: ${err}`);
      continue;
    }

    let m = stdout.match(/^git version\s+(.*)$/);
    if (m) {
      gitPath = path;
      gitVersion = m[1];
      break;
    }

  }

  if (!gitVersion) {
    throw new Error(`failed to find git executable, check your git settings`);
  }

  let required = getMinimumGitVersion();
  let m = gitVersion.match(/([0-9]+)\.([0-9]+)/);
  let major = parseInt(m[1], 10);
  let minor = parseInt(m[2], 10);

  if (major < required.major || major === required.major && minor < required.minor) {
    throw new Error(`brackets-git requires git version 1.8 (or later), version found was ${gitVersion}`);
  }

  // this will also save the settings
  setPath(gitPath);

  return gitVersion;
}
