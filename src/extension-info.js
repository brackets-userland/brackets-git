import { ExtensionUtils } from './brackets';
import PackageJsonStr from 'text!../package.json';
const PackageJson = JSON.parse(PackageJsonStr);

export function getExtensionName() {
  return `${PackageJson.name}_v${PackageJson.version}`;
}

export function getExtensionVersion() {
  return PackageJson.version;
}

// should return something like C:/Users/Zaggi/AppData/Roaming/Brackets/extensions/user/zaggino.brackets-git/
export function getExtensionDirectory() {
  return ExtensionUtils.getModulePath(module).slice(0, -1 * 'src/'.length);
}

export function getMinimumGitVersion() {
  return {
    major: 1,
    minor: 8
  };
}
