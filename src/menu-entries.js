import { _, CommandManager, FileSystem, Menus, ProjectManager } from './brackets';
import { getExtensionName } from './extension-info';
import { warn } from './log';
import { handleError } from './error-handler';
import Events from './events';
import EventEmitter from './event-emitter';
import * as Panel from './ui/panel';
import * as Preferences from './preferences';
import Promise from 'bluebird';
import Strings from 'strings';

const CMD_ADD_TO_IGNORE = `${getExtensionName()}.addToIgnore`;
const CMD_REMOVE_FROM_IGNORE = `${getExtensionName()}.removeFromIgnore`;

let _toggleMenuEntriesState = false;
let _divider1 = null;
let _divider2 = null;
let initialized = false;

async function _addRemoveItemInGitignore(selectedEntry, method) {
  let gitRoot = Preferences.get('currentGitRoot');
  let entryPath = '/' + selectedEntry.fullPath.substring(gitRoot.length);
  let gitignoreEntry = FileSystem.getFileForPath(gitRoot + '.gitignore');

  let content = '';
  try {
    content = await Promise.fromNode(gitignoreEntry.read.bind(gitignoreEntry));
  } catch (err) {

    // TODO: check what the error actually is
    // only when file not found, we actually want to continue
    warn(err);

  }

  // use trimmed lines only
  let lines = content.split('\n').map(function (l) { return l.trim(); });

  // clean start and end empty lines
  while (lines.length > 0 && !lines[0]) { lines.shift(); }
  while (lines.length > 0 && !lines[lines.length - 1]) { lines.pop(); }

  if (method === 'add') {

    // add only when not already present
    if (lines.indexOf(entryPath) === -1) { lines.push(entryPath); }

  } else if (method === 'remove') {

    lines = _.without(lines, entryPath);

  }

  // always have an empty line at the end of the file
  if (lines[lines.length - 1]) { lines.push(''); }

  try {
    await Promise.fromNode(gitignoreEntry.write.bind(gitignoreEntry, lines.join('\n')));
  } catch (err) {
    handleError('Failed writing to .gitignore', err);
  }

  // TODO: call git-status instead of this, panel should auto-refresh
  Panel.refresh();
}

const addItemToGitingore = () => _addRemoveItemInGitignore(ProjectManager.getSelectedItem(), 'add');

const removeItemFromGitingore = () => _addRemoveItemInGitignore(ProjectManager.getSelectedItem(), 'remove');

function addItemToGitingoreFromPanel() {
  let filePath = Panel.getPanel().find('tr.selected').attr('x-file');
  let fileEntry = FileSystem.getFileForPath(Preferences.get('currentGitRoot') + filePath);
  return _addRemoveItemInGitignore(fileEntry, 'add');
}

function removeItemFromGitingoreFromPanel() {
  let filePath = Panel.getPanel().find('tr.selected').attr('x-file');
  let fileEntry = FileSystem.getFileForPath(Preferences.get('currentGitRoot') + filePath);
  return _addRemoveItemInGitignore(fileEntry, 'remove');
}

function init() {

  // register commands for project tree / working files
  CommandManager.register(Strings.ADD_TO_GITIGNORE, CMD_ADD_TO_IGNORE, addItemToGitingore);
  CommandManager.register(Strings.REMOVE_FROM_GITIGNORE, CMD_REMOVE_FROM_IGNORE, removeItemFromGitingore);

  // create context menu for git panel
  let panelCmenu = Menus.registerContextMenu('git-panel-context-menu');
  CommandManager.register(Strings.ADD_TO_GITIGNORE, CMD_ADD_TO_IGNORE + '2', addItemToGitingoreFromPanel);
  CommandManager.register(
    Strings.REMOVE_FROM_GITIGNORE, CMD_REMOVE_FROM_IGNORE + '2', removeItemFromGitingoreFromPanel
  );
  panelCmenu.addMenuItem(CMD_ADD_TO_IGNORE + '2');
  panelCmenu.addMenuItem(CMD_REMOVE_FROM_IGNORE + '2');
}

function toggleMenuEntries(bool) {
  if (!initialized) {
    init();
  }
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
