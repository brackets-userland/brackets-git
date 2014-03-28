# Changelog

## 0.13.0
* `Q` library has been completely removed and replaced by `bluebird`
* Added French translation by [rainje](https://github.com/rainje)

## 0.12.2
* Top menu has been removed - you can access settings through panel or File > Git settings...
* Branch deletion handling has been improved and now you can delete also not fully merged branches.
* README has been updated after a long time (thanks [Fez Vrasta](https://github.com/FezVrasta))
* [Fez Vrasta](https://github.com/FezVrasta) started to add support for [Git-FTP](https://github.com/git-ftp/git-ftp)
* Updated translations by [Marcel Gerber](https://github.com/SAPlayer)

## 0.12.1
* Fixed a bug that extension won't even start on some machines.
* Fixed some issues with pushing to remote repositories.
* Improvements to the commit history by [Marcel Gerber](https://github.com/SAPlayer)

## 0.12.0
* Bash command is now customizable for Windows - you may need to do some adjustements (even Mac/Linux users) in the settings (you can use restore defaults command if you have any problems).
* You can now specify origin branch when creating new one.
* You can now merge local branches into the current branch.
* Many UI tweaks by [Larz](https://github.com/larz0)
* Some more UI tweaks by [Fez Vrasta](https://github.com/FezVrasta)
* Fixed custom terminal not working in Linux/Mac.
* Better .gitignore parsing by [Marcel Gerber](https://github.com/SAPlayer)
* Updated translations by [Marcel Gerber](https://github.com/SAPlayer) & [Pietro Albini](https://github.com/pietroalbini)

## 0.11.0
* Added features to change current username and email by [Fez Vrasta](https://github.com/FezVrasta)
* Added feature to delete local branches by [Fez Vrasta](https://github.com/FezVrasta)
* Added feature to add and remove remotes by [Fez Vrasta](https://github.com/FezVrasta)
* Added feature to revert last commit by [Fez Vrasta](https://github.com/FezVrasta)
* Changelog is now shown in nice html by [Marcel Gerber](https://github.com/SAPlayer)
* Updated Italian translation by [Pietro Albini](https://github.com/pietroalbini)
* Updated German translation by [Marcel Gerber](https://github.com/SAPlayer)
* Fixed issue when right-clicking on history entries.
* Fixed an issue with "View authors" not working for some people.
* When toggling "Extended" commit, message is copied from the input.
* Close not modified icon has been moved to the Working Files section by [Fez Vrasta](https://github.com/FezVrasta)

## 0.10.12
* Added features to view authors of a file or current selection.
* Push dialog shows masked password.
* Tabs are now properly displayed in the diffs respecting Brackets "tabSize" preference.

## 0.10.11
* Fixed an issue when commit dialog won't show on a large number of files.
* Fixed Bash button when working with UNC paths on Windows by [Fez Vrasta](https://github.com/FezVrasta)

## 0.10.10
* Fixed extension not working on Mac & Linux platforms.

## 0.10.9
* Fixed critical bug in 0.10.8 when not working in a git repo.

## 0.10.8
* Unmerged file state is now properly recognized.
* Should now recognize git root even in soft links.
* Fixed bugs when handling various .gitignore entries.
* Pull and Push are now disabled when there are no remotes to work with.

## 0.10.7
* Fixed an issue when commiting large files failed to open commit dialog.
* Updated Simplified Chinese translation by [Zhi](https://github.com/yfwz100)

## 0.10.6
* Fixes an issue with timeout error while launching terminal in Linux.
* Automatically does chmod +x when there's permission denied on terminal script.
* Fixed issue when ignored directories were not marked as ignored without trailing slash.
* Last selected remote is now saved for the project when you reopen Brackets.

## 0.10.5
* Escape special characters in username and password by [Zhi](https://github.com/yfwz100)
* Implemented infinite history scrolling by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4) & [Fez Vrasta](https://github.com/FezVrasta)
* Fixed commit message escaping issues in Linux
* Git commands added into own top menu by [Matt Hayward](https://github.com/matthaywardwebdesign)

## 0.10.4
* Fixed multiple issues with pushing into remote repository.
* Fixed an issue where history was not working for large repositories.
* Fixed an issue with displaying some commits in the history.

## 0.10.3
* Fixed ambiguous argument error when viewing history.
* Tweaks to commit history by [Fez Vrasta](https://github.com/FezVrasta) & [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)

## 0.10.2
* xfce4-terminal support by [Ben Keith](https://github.com/benlk)
* Fixed an issue with pull command.

## 0.10.1
* Fixed a push bug that was introduced in 0.10.0

## 0.10.0
* Feature to browse commit history by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)
* Feature to clone a repository when in an empty folder by [Fez Vrasta](https://github.com/FezVrasta)
* Feature to use pull & push with multiple remotes by [Fez Vrasta](https://github.com/FezVrasta)
* Tabs have been added to settings dialog, a lot of new shorcuts to configure added.
* You can now navigate between modifications inside a file.
* Bash/Terminal button and Report Bug button can be hidden from panel in the settings.
* Shortcut for Push is now configurable in the settings by [Matt Hayward](https://github.com/matthaywardwebdesign)
* Bug when pushing failed in case of a password containing a quote fixed by [Matt Hayward](https://github.com/matthaywardwebdesign)
* Improved function for escaping shell arguments on Windows, commits can now contain doublequotes.

## 0.9.3
* Disable commit button when there are no files to commit selected by [Fez Vrasta](https://github.com/FezVrasta)
* Fixed an issue when doubleclicking on a checkbox triggered opening a file.

## 0.9.2
* Fix password hiding regExp from 0.9.1

## 0.9.1
* Added option to disable code inspection in commit dialog.
* You must now agree to store passwords in plain text on your computer.

## 0.9.0
* Pushing to http(s) password protected repositories should work - extension will ask for username & password.
* Bash icon now launches terminal window in other OS than Windows, thanks to [Jimmy Brian Anamaria Torres](https://github.com/Azakur4) & [Benjamin Pick](https://github.com/benjaminpick)
* Modified files are now marked in a project tree too for those who have panel closed.
* New shorcuts for commiting current file and commiting all files configurable in settings.
* Panel icons and other visual tweaks by [Fez Vrasta](https://github.com/FezVrasta)
* Refresh button on panel now refreshes current branch too in case it has been switched from outside of Brackets.
* Gutters now expand when clicking on line numbers too.
* Added Italian translation by [Fez Vrasta](https://github.com/FezVrasta)
* Updated German translation by [Marcel Gerber](https://github.com/SAPlayer)
* Updated Brazilian Portuguese translation by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)

## 0.8.10
* Restyle of the interface by [Fez Vrasta](https://github.com/FezVrasta)

## 0.8.9
* Do not display 'not a git repo' anymore [#111](https://github.com/zaggino/brackets-git/issues/111)
* Removed obsolete status bar [#110](https://github.com/zaggino/brackets-git/issues/110)

## 0.8.8
* Add toggle panel keyboard shortcut in settings dialog.
* Add amend checkbox to the commit dialog.

## 0.8.7
* Added Brazilian Portuguese translation by [Rodrigo Tavares](https://github.com/rodrigost23)
* Fixed dialog size bug.

## 0.8.6
* Push now asks for origin url when no origin is defined.

## 0.8.5
* Basic branches switching implemented.

## 0.8.4
* Adds an option to disable adding newline at the end of the file.
* Updated Simplified Chinese translation by [Zhi](https://github.com/yfwz100)
* Updated German translation by [Marcel Gerber](https://github.com/SAPlayer)

## 0.8.3
* Git gutters are now clickable.

## 0.8.2
* Basic Git gutter support - you can turn on/off this feature in settings.

## 0.8.1
* Fixes for new Brackets' CodeInspection API (requires Sprint 36).

## 0.8.0
* You can now add files and directory entries to .gitignore file by right clicking.

## 0.7.12
* Minor fix in produced error messages for github bug reports.

## 0.7.11
* Fixes bug when commiting files moved with git mv command.

## 0.7.10
* Fixes of previous release.

## 0.7.9
* Test if project folder is writable before doing Git Init.
* Extended commit now works without extra line breaks.

## 0.7.8
* Do not display files in panel that are hidden by Brackets by default.

## 0.7.7
* Added Simplified Chinese translation by [Zhi](https://github.com/yfwz100)

## 0.7.6
* Fixes buggy releases 0.7.5 & 0.7.4

## 0.7.5
* Button to hide untracked files from panel.

## 0.7.4
* Experimental support for multi-line commit messages.

## 0.7.3
* Git Init now experimentally works in projects that are not a git repository.

## 0.7.2
* Updated German translation by [Marcel Gerber](https://github.com/SAPlayer)

## 0.7.1
* Added bug reporting button to the git panel which prefills some Brackets info.

## 0.7.0
* Improvements towards error handling and reporting.

## 0.6.19
* Fixed issue with corrupting image files [#31](https://github.com/zaggino/brackets-git/issues/31)
* Fixed issue with delete button not working.

## 0.6.18
* Added Git panel to the menu (View > Git) with keyboard shortcut Ctrl+Alt+G.

## 0.6.17
* Changes to move on from deprecated APIs to new ones - requires Brackets 34.

## 0.6.16
* Add box to show commit message length.

## 0.6.15
* Fix the cygwin path conversion using a more reliable method by [Zhi](https://github.com/yfwz100)

## 0.6.14
* Added pull button with fast-forward only mode. (No functionality to resolve merge conflicts)

## 0.6.13
* Some improvements in error handling and logging.
* Fixed a bug when file contained spaces [#21](https://github.com/zaggino/brackets-git/issues/21)

## 0.6.12
* Fix [Extension failed to load](https://github.com/zaggino/brackets-git/issues/19)

## 0.6.11
* Fix a bug when deleting uncommited files from Git panel.

## 0.6.10
* Fix a bug when commit/diff dialogs fail to display when first line of file is modified.
* Fix a bug in diff formatting.

## 0.6.9
* German translation by [Marcel Gerber](https://github.com/SAPlayer)

## 0.6.8
* Fix bug where extension breaks on Linux by [Fabio Massaioli](https://github.com/fbbdev)

## 0.6.7
* Add support for cygwin git by [Zhi](https://github.com/yfwz100)

## 0.6.6
* Removed polyfills for older Brackets, sprint 32 required from now.

## 0.6.5
* Push button will now show if there are any unpushed commits.

## 0.6.4
* Enabled experimental push button. Pushes only to default remote.

## 0.6.3
* Added button to remove unmodified files from working tree.

## 0.6.2
* Fix diff output to use --no-color do avoid having color codes in output on some machines.

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
* Great new icon and UI tweaks by [Larz](https://github.com/larz0)
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
* Added configuration file that is created on the first extension run (thx for idea to [Rajani Karuturi](https://github.com/karuturi))

## 0.1.0
* First real functionality, basic commit from brackets is now available.

## 0.0.3
* Added handlers to refresh branch name on project change or file tree refresh.

## 0.0.2
* Display current branch name in file tree if working folder is a git repository.

## 0.0.1
* Initial release.
* Display current Git version in status bar.
