import PackageJsonStr from 'text!../package.json';
const PackageJson = JSON.parse(PackageJsonStr);

export function getExtensionName() {
  return `${PackageJson.name}_v${PackageJson.version}`;
}

export function getExtensionVersion() {
  return PackageJson.version;
}
