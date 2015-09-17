import Promise from 'bluebird';
import Preferences from '../preferences';
import { loadPathContent } from '../utils';

const baseCheck = ['MERGE_MODE', 'rebase-apply'];
const mergeCheck = ['MERGE_HEAD', 'MERGE_MSG'];
const rebaseCheck = ['rebase-apply/next', 'rebase-apply/last', 'rebase-apply/head-name'];

export default async function getMergeInfo() {

  let gitFolder = Preferences.get('currentGitRoot') + '.git/';
  let [ mergeMode, rebaseMode ] = await Promise.all(baseCheck.map(file => loadPathContent(gitFolder + file)));

  let obj = {
    mergeMode: mergeMode != null,
    rebaseMode: rebaseMode != null
  };

  if (obj.mergeMode) {
    let [ head, msg ] = await Promise.all(mergeCheck.map(file => loadPathContent(gitFolder + file)));

    if (head) {
      obj.mergeHead = head.trim();
    }

    let msgSplit = msg ? msg.trim().split(/conflicts:/i) : [];
    if (msgSplit[0]) {
      obj.mergeMessage = msgSplit[0].trim();
    }
    if (msgSplit[1]) {
      obj.mergeConflicts = msgSplit[1].trim().split('\n').map(function (line) { return line.trim(); });
    }
  }

  if (obj.rebaseMode) {
    let [ next, last, head ] = await Promise.all(rebaseCheck.map(file => loadPathContent(gitFolder + file)));
    if (next) { obj.rebaseNext = next.trim(); }
    if (last) { obj.rebaseLast = last.trim(); }
    if (head) { obj.rebaseHead = head.trim().substring('refs/heads/'.length); }
  }

  return obj;
}
