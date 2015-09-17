import { FileSystem, ProjectManager } from './brackets';

export function getProjectRoot() {
  let projectRoot = ProjectManager.getProjectRoot();
  return projectRoot ? projectRoot.fullPath : null;
}

export function pathExists(path) {
  return new Promise(function (resolve, reject) {
    FileSystem.resolve(path, function (err, item, stat) {
      resolve(err ? false : stat.isFile || stat.isDirectory);
    });
  });
}
