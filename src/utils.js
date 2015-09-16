import { ProjectManager } from './brackets';

export function getProjectRoot() {
  let projectRoot = ProjectManager.getProjectRoot();
  return projectRoot ? projectRoot.fullPath : null;
}
