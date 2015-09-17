import { FileSystem, ProjectManager } from './brackets';

export function getProjectRoot() {
  let projectRoot = ProjectManager.getProjectRoot();
  return projectRoot ? projectRoot.fullPath : null;
}

export function pathExists(path) {
  return new Promise(function (resolve) {
    FileSystem.resolve(path, function (err, entry, stats) {
      return resolve(err ? false : stats.isFile || stats.isDirectory);
    });
  });
}

export function loadPathContent(path) {
  return new Promise(function (resolve) {
    FileSystem.resolve(path, function (err, entry) {
      if (err) { return resolve(null); }
      if (entry._clearCachedData) { entry._clearCachedData(); }
      if (entry.isFile) {
        entry.read(function (err2, content) {
          if (err2) { return resolve(null); }
          resolve(content);
        });
      } else {
        entry.getContents(function (err2, contents) {
          if (err2) { return resolve(null); }
          resolve(contents);
        });
      }
    });
  });
}
