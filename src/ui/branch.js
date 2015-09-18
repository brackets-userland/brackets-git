import { EditorManager, MainViewManager, Menus, PopUpManager, React } from '../brackets';
import getBranches from '../git/get-branches';
import BranchDropdown from './branch-dropdown';

const $branchContainer = $(`<div id="brackets-git-branch" class="btn-alt-quiet"/>`);
const $branchName = $(`<span class="branch-name">\u2026</span>`);
const $dropdownContainer = $(`<div id="brackets-git-branch-dropdown" class="dropdown-menu" tabindex="-1"/>`);
const dropdownAttached = () => $dropdownContainer.parent().length > 0;
const MAX_LEN = 20;

let currentEditor;

function detachDropdown() {
  PopUpManager.removePopUp($dropdownContainer);
  detachCloseEvents(); // eslint-disable-line no-use-before-define
  React.unmountComponentAtNode($dropdownContainer[0]);
  $dropdownContainer.remove();
  MainViewManager.focusActivePane();
}

function attachCloseEvents() {
  $('html').on('click', detachDropdown);
  $('#project-files-container').on('scroll', detachDropdown);
  $('#titlebar .nav').on('click', detachDropdown);
  currentEditor = EditorManager.getCurrentFullEditor();
  if (currentEditor) { currentEditor._codeMirror.on('focus', detachDropdown); }
}

function detachCloseEvents() {
  $('html').off('click', detachDropdown);
  $('#project-files-container').off('scroll', detachDropdown);
  $('#titlebar .nav').off('click', detachDropdown);
  if (currentEditor) { currentEditor._codeMirror.off('focus', detachDropdown); }
}

async function toggleDropdown(e) {
  e.stopPropagation();

  // if the dropdown is already visible, close it
  if (dropdownAttached()) {
    detachDropdown();
    return;
  }

  Menus.closeAll();

  let branches = await getBranches();

  // filter out current branch and all remote branches
  branches = branches.filter(b => !b.currentBranch && !b.remote);

  let toggleOffset = $branchName.offset();
  $dropdownContainer
    .css({
      left: toggleOffset.left,
      top: toggleOffset.top + $branchName.outerHeight()
    })
    .appendTo($('body'));
  // fix so it doesn't overflow the screen
  let maxHeight = $dropdownContainer.parent().height();
  let height = $dropdownContainer.height();
  let topOffset = $dropdownContainer.position().top;
  $dropdownContainer.css('bottom', height + topOffset >= maxHeight - 10 ? '10px' : null);

  React.render(<BranchDropdown branches={branches} />, $dropdownContainer[0]);
  attachCloseEvents();
  PopUpManager.addPopUp($dropdownContainer, detachCloseEvents, true);
}

export function toggle(bool) {
  $branchName
    .parent()
    .toggle(bool);
}

export function setText(text) {
  $branchName.text(text);
  toggle(true);
}

export function setBranchName(text) {
  let [ name, rest ] = text.split('|');
  let nameTooLong = name.length > MAX_LEN;
  let shortName = nameTooLong ? name.substring(0, MAX_LEN) + '\u2026' : name;
  let title = nameTooLong ? name : null;

  if (rest) {
    shortName += '|' + rest;
    title += '|' + rest;
  }

  setText(shortName);
  $branchName
    .attr('title', title)
    .off('click')
    .on('click', toggleDropdown)
    .append($('<span class="dropdown-arrow" />'));
}

export function init() {
  $branchContainer
    .append('[ ')
    .append($branchName)
    .append(' ]')
    .on('click', function () {
      $branchName.click();
      return false;
    })
    .appendTo('#project-files-header');
}
