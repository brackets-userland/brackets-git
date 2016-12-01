import * as Preferences from "../Preferences";
import * as Utils from "../Utils";

export default function getMergeInfo() {
    const baseCheck = ["MERGE_MODE", "rebase-apply"];
    const mergeCheck = ["MERGE_HEAD", "MERGE_MSG"];
    const rebaseCheck = ["rebase-apply/next", "rebase-apply/last", "rebase-apply/head-name"];
    const gitFolder = Preferences.get("currentGitRoot") + ".git/";
    return Promise.all(baseCheck.map((fileName) => Utils.loadPathContent(gitFolder + fileName)))
    .then(([ mergeMode, rebaseMode ]) => {
        const obj = {
            mergeMode: mergeMode !== null,
            mergeHead: null,
            mergeMessage: null,
            mergeConflicts: null,
            rebaseMode: rebaseMode !== null,
            rebaseNext: null,
            rebaseLast: null,
            rebaseHead: null
        };
        if (obj.mergeMode) {

            return Promise.all(mergeCheck.map((fileName) => Utils.loadPathContent(gitFolder + fileName)))
            .then(([ head, msg ]) => {
                if (head) {
                    obj.mergeHead = head.trim();
                }
                const msgSplit = msg ? msg.trim().split(/conflicts:/i) : [];
                if (msgSplit[0]) {
                    obj.mergeMessage = msgSplit[0].trim();
                }
                if (msgSplit[1]) {
                    obj.mergeConflicts = msgSplit[1].trim().split("\n").map((line) => line.trim());
                }
                return obj;
            });

        }
        if (obj.rebaseMode) {

            return Promise.all(rebaseCheck.map((fileName) => Utils.loadPathContent(gitFolder + fileName)))
            .then(([ next, last, head ]) => {
                if (next) { obj.rebaseNext = next.trim(); }
                if (last) { obj.rebaseLast = last.trim(); }
                if (head) { obj.rebaseHead = head.trim().substring("refs/heads/".length); }
                return obj;
            });

        }
        return obj;
    });
}
