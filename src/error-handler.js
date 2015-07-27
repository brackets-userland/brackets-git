import { logError } from './log';

// TODO: if this shows a dialog, it should await it to be closed
export async function handleError(...errs) {
  logError(...errs);
}
