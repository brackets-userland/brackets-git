const $branchContainer = $(`<div id="brackets-git-branch" class="btn-alt-quiet"/>`);
const $branchName = $(`<span class="branch-name">\u2026</span>`);
const MAX_LEN = 20;

function toggleDropdown() {

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
