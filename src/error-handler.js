import { logError } from './log';

export function toError(err) {
  return err instanceof Error ? err : new Error(err);
}

// TODO: if this shows a dialog, it should await it to be closed
export async function handleError(...errs) {

  const toLog = [];

  for (let e of errs) {

    if (e instanceof Error) {
      e = e.stack;
      toLog.push('\n');
    }

    toLog.push(e);
  }

  logError(...toLog);
}
