import { _ } from '../brackets';
import { git } from './index';

export default async function getBranchName() {

  // main approach, probably dated, but keep it here as a reference
  /*
  let stdout = await git(['branch', '--no-color']);
  let branchName = _.find(stdout.split('\n'), line => line.startsWith('*'));
  if (branchName) {
    branchName = branchName.substring(1).trim();

    let m = branchName.match(/^\(.*\s(\S+)\)$/); // like (detached from f74acd4)
    if (m) { return m[1]; }

    return branchName;
  }
  */

  // alternative approach
  let stdout = await git(['log', '--pretty=format:%H %d', '-1']);
  stdout = stdout.trim();

  let hashMatch = stdout.match(/^[0-9a-f]+/i);
  let hash = hashMatch ? hashMatch[0] : null;

  let infoMatch = stdout.match(/\((.*)\)$/i);
  let infos = infoMatch ? infoMatch[1].split(',').map(i => i.trim()) : [];

  infos = infos.map(info => {

    let headMatch = info.match(/^HEAD\s+->\s+(\S+)$/i);
    if (headMatch) { return headMatch[1]; }

    let tagMatch = info.match(/^tag:\s+(\S+)$/i);
    if (tagMatch) { return tagMatch[1]; }

    return null;
  });

  return _.first(_.compact(infos.concat(hash)));
}
