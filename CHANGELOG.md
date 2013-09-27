# Changelog

## 0.6.1
* Fix bug where whitespace cleanup function corrupts binary files.
* Code checking features delayed for Sprint 32 ([adobe/brackets#5125](https://github.com/adobe/brackets/pull/5125))

## 0.6.0
* Using new CodeInspection API from Brackets to check files for errors before commiting. (Sprint >= 31)
* Current document is now selected in the git panel for easier navigation.
* Added feature (see Git Settings) to cleanup whitespace when commiting.
* Added hover titles to the Git icon when there's a problem.

## 0.5.3
* Fixed issue [#5](https://github.com/zaggino/brackets-git/issues/5)
* Added focus to input when commit dialog is shown.

## 0.5.2
* Added delete button for untracked files
* Untracked files are now shown (instead of untracked directory)

## 0.5.1
* Undo changes now works and is no longer disabled.

## 0.5.0
* Added new diff button to show next to the every modified file.
* Little bit of UX tuning.

## 0.4.6
* Panel now properly disables when switching between projects with and without git repository.

## 0.4.5
* Click in the git panel now opens the file, doubleclick adds file to the working tree.

## 0.4.4
* Great new icon and UI tweaks by [@larz0](https://github.com/larz0)
* Commit dialog should be now a bit bigger depending on the screen size.

## 0.4.3
* Settings dialog has now a restore defaults button which restores platform specific defaults (Win, Mac).
* Settings dialog has now a button to show changelog.
* Minor UI tweaks.

## 0.4.2
* Default preferences are different for platforms.

## 0.4.1
* Changelog is not shown on the first startup, when settings are shown.

## 0.4.0
* Added settings panel to File > Git Settings...
* Git Settings dialog will open on first startup after the extension is installed.
* Changelog will open in dialog after the extension is updated.

## 0.3.0
* Added diff displaying to commit dialog.

## 0.2.1
* Added i18n support.
* Fixed styling in commit dialog.

## 0.2.0
* Added shortcut to bash console for msysgit users.
* Added configuration file that is created on the first extension run (thx for idea to [@karuturi](https://github.com/karuturi))

## 0.1.0
* First real functionality, basic commit from brackets is now available.

## 0.0.3
* Added handlers to refresh branch name on project change or file tree refresh.

## 0.0.2
* Display current branch name in file tree if working folder is a git repository.

## 0.0.1
* Initial release.
* Display current Git version in status bar.
