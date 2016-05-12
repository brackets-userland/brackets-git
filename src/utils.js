import { FileSystem, ProjectManager } from './brackets';

export function deepFreeze(o) {
  Object.freeze(o);
  Object.getOwnPropertyNames(o).forEach(prop => {
    if (
      o.hasOwnProperty(prop) &&
      o[prop] !== null &&
      (typeof o[prop] === 'object' || typeof o[prop] === 'function') &&
      !Object.isFrozen(o[prop])
    ) {
      deepFreeze(o[prop]);
    }
  });
  return o;
}

export function getProjectRoot() {
  const projectRoot = ProjectManager.getProjectRoot();
  return projectRoot ? projectRoot.fullPath : null;
}

export function pathExists(path) {
  return new Promise(resolve => {
    FileSystem.resolve(path, (err, entry, stats) => {
      return resolve(err ? false : stats.isFile || stats.isDirectory);
    });
  });
}

export function loadPathContent(path) {
  return new Promise(resolve => {
    FileSystem.resolve(path, (err, entry) => {
      if (err) { return resolve(null); }
      if (entry._clearCachedData) { entry._clearCachedData(); }
      if (entry.isFile) {
        entry.read((err2, content) => {
          if (err2) { return resolve(null); }
          resolve(content);
        });
      } else {
        entry.getContents((err2, contents) => {
          if (err2) { return resolve(null); }
          resolve(contents);
        });
      }
    });
  });
}
