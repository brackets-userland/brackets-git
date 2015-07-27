import { Menus } from './brackets';
import { getExtensionName } from './extension-info';
import Events from './events';
import EventEmitter from './event-emitter';

const CMD_ADD_TO_IGNORE = `${getExtensionName()}.addToIgnore`;
const CMD_REMOVE_FROM_IGNORE = `${getExtensionName()}.removeFromIgnore`;

let _toggleMenuEntriesState = false;
let _divider1 = null;
let _divider2 = null;

function toggleMenuEntries(bool) {
  if (bool === _toggleMenuEntriesState) {
    return;
  }
  let projectCmenu = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU);
  let workingCmenu = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_CONTEXT_MENU);
  if (bool) {
    _divider1 = projectCmenu.addMenuDivider();
    _divider2 = workingCmenu.addMenuDivider();
    projectCmenu.addMenuItem(CMD_ADD_TO_IGNORE);
    workingCmenu.addMenuItem(CMD_ADD_TO_IGNORE);
    projectCmenu.addMenuItem(CMD_REMOVE_FROM_IGNORE);
    workingCmenu.addMenuItem(CMD_REMOVE_FROM_IGNORE);
  } else {
    projectCmenu.removeMenuDivider(_divider1.id);
    workingCmenu.removeMenuDivider(_divider2.id);
    projectCmenu.removeMenuItem(CMD_ADD_TO_IGNORE);
    workingCmenu.removeMenuItem(CMD_ADD_TO_IGNORE);
    projectCmenu.removeMenuItem(CMD_REMOVE_FROM_IGNORE);
    workingCmenu.removeMenuItem(CMD_REMOVE_FROM_IGNORE);
  }
  _toggleMenuEntriesState = bool;
}

EventEmitter.on(Events.GIT_ENABLED, () => toggleMenuEntries(true));
EventEmitter.on(Events.GIT_DISABLED, () => toggleMenuEntries(false));
