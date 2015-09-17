const $branchContainer = $(`<div id="brackets-git-branch" class="btn-alt-quiet"/>`);
const $branchName = $(`<span class="branch-name">\u2026</span>`);

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

export function setBranchName(text, title) {
  setText(text);
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
