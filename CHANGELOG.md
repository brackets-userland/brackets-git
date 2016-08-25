# Changelog

**If you get an error right after updating just close all Brackets instances and start again. We are aware of this problem.**

## 0.16.6 (25/08/2016)
* Fix an issue when viewing initial commit details by [Mateo Guzman](https://github.com/mateoguzman)
* Use cross-spawn to launch git commands.

## 0.16.5 (13/05/2016)
* Fixed an issue with branch name shown as true in an empty repository.

## 0.16.4 (10/05/2016)
* Stage instead of commits when no commit is present in the repository by [Peeyush Kushwaha](https://github.com/peey)

## 0.16.3 (07/03/2016)
* Moved the branch indicator to its own line to prevent overflowing out of the side panel by [José Porto](https://github.com/joseporto)

## 0.16.2 (16/01/2016)
* Fixed a bug when using Git-FTP by [Matt Bell](https://github.com/mattbell87)

## 0.16.1 (15/01/2016)
* Fixed a bug, where amend commit was not available without remote repository being set.

## 0.16.0 (13/01/2016)
* Add counter for commits behind by [Matt Bell](https://github.com/mattbell87)
* Add sync button to fetch remotes by [Matt Bell](https://github.com/mattbell87)

## 0.15.0 (02/12/2015)
* Added authentication to Clone dialog by [Matt Bell](https://github.com/mattbell87)

## 0.14.32 (22/08/2015)
* Updated terminal launch shortcut to support Git for Windows 2.5, credits to [Jan Pilzer](https://github.com/Hirse)

## 0.14.31 (21/08/2015)
* Updated iTerm launch scripts by [Andrew Minion](https://github.com/macbookandrew)

## 0.14.30 (20/08/2015)
* Fixed an issue where some characters were not visible in the diff dialog.
* Updated iTerm support to 2.9+ by [Andrew Minion](https://github.com/macbookandrew)

## 0.14.29 (12/08/2015)
* Fixed issue with history when not having project root also a git root by [Hyunchul Kwak](https://github.com/hyunchulkwak)

## 0.14.28 (05/08/2015)
* Added feature to create tags and push them to remote by [rodrigojt](https://github.com/rodrigojt)

## 0.14.27 (19/05/2015)
* Fixed .gitignore parsing by [Phillip Haydon](https://github.com/phillip-haydon)

## 0.14.26 (10/05/2015)
* Added shortcut option for refreshing Git status.
* Updated iTerm launch script for Mac by [Andrew Minion](https://github.com/macbookandrew)

## 0.14.25 (04/05/2015)
* Fixed 'Clone' button being disabled after clone fails.
* Fixed branch name displayed as 'true' when opening an empty repo without branches.
* Fixed conflict with code folding, no longer shows '+' sign on gutter hover.
* Fixed commit all files shortcut for unstaged files by [Ignacio Moreno](https://github.com/nmorenor)

## 0.14.24 (14/04/2015)
* Fixed displaying of tabs in diffs.
* Improved error handling for `spawn ENOENT` errors.
* Size of diff dialog has been slightly increased.

## 0.14.23 (10/04/2015)
* Fixed previous fix for initial commit diff by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.14.22 (08/04/2015)
* Fixed another issue when viewing inital commit in the history by [Marcel Gerber](https://github.com/MarcelGerber)
* Updated iTerm launch script for Mac by [Andrew Minion](https://github.com/macbookandrew)

## 0.14.21 (07/04/2015)
* Added commit date to file history viewer by [Andrew Minion](https://github.com/macbookandrew)
* Fixed an issue when viewing inital commit in the history.

## 0.14.20 (25/03/2015)
* Staged files are now remembered when using shortcuts to commit a single file or commit all files by [Ignacio Moreno](https://github.com/nmorenor)

## 0.14.19 (25/03/2015)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* Fixed issue parsing a branch name from HEAD file when rebasing.
* Fixed issue with displaying merge commit diff by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.14.18 (20/03/2015)
* Added support for Gerrit push operations by [Jed Anderson](https://github.com/jedkcanderson) and [Ignacio Moreno](https://github.com/nmorenor)
* Various visual style improvements by [cheesypoof](https://github.com/cheesypoof)

## 0.14.17 (27/02/2015)
* Improved iTerm script by [Andrew Minion](https://github.com/macbookandrew)
* Fixed a case when close not modified icon collided with configure working set icon.

## 0.14.16 (21/02/2015)
* Fix another terminal opening error.

## 0.14.15 (20/02/2015)
* Fixed terminal not working on Windows (chmod error).
* Fixed some console errors when using keyboard shortcuts.

## 0.14.14 (19/02/2015)
* Found the permissions bug with the original terminal scripts, so fit that and revert the scripts.

## 0.14.13 (18/02/2015)
* Fixed new repo initialization error.

## 0.14.12 (18/02/2015)
* Fixed toolbar icon staying marked as dirty after switching to a non-git project.
* Fixed terminal shortcut to work on Mac Yosemite 10.10.2, doesn't try to detect custom terminals so PRs are needed for that.

## 0.14.11 (16/02/2015)
* Fixed deprecation warnings by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.14.10 (10/02/2015)
* You can now configure timeout for Git operations in the settings dialog.
* BUGFIX: /usr/local/bin/git has been added to the Git search paths as a common Git location on Mac.
* BUGFIX: bower_components and node_modules have been added to the default .gitignore file.
* BUGFIX: Fixed an issue when it's not possible to delete a new file that's staged in index.

## 0.14.9 (23/12/2014)
* BUGFIX: Fixed cases where extension goes into infinite loop due to Brackets watching files inside the .git directory.

## 0.14.8 (19/12/2014)
* BUGFIX: Ctrl key in keyboard shortcuts should no longer be replaced by Cmd when using Mac.
* BUFFIX: Fixed line number being shown next to the 'No newline at end of file' message.
* BUGFIX: Fixed an error in the settings dialog when it's loaded for the first time on a fresh installation by [Albertina Durante](https://github.com/albertinad)

## 0.14.7 (17/12/2014)
* BUGFIX: Fixed an issue with Git detection when you delete a project folder which Brackets is supposed to open on startup.

## 0.14.6 (16/12/2014)
* Added settings option to clear whitespace on save in addition to cleaning it before commiting (default off).
* BUGFIX: Fixed problems when initializing new repository in an empty directory.
* BUGFIX: Fixed integration issues with Intel XDK by [Albertina Durante](https://github.com/albertinad)

## 0.14.5 (12/12/2014)
* BUGFIX: Prevent domain code from causing "uncaught exception at top level" while spawning invalid executable.

## 0.14.4 (12/12/2014)
* When a NodeConnection exception is encountered, list of all installed extensions will be dumped into the console to help with locating the issue.

## 0.14.3 (11/12/2014)
* BUGFIX: Some more issues when working from a subfolder have been fixed.
* BUGFIX: Wrapped some node domain code to avoid uncaught exceptions at top level.

## 0.14.2 (10/12/2014)
* BUGFIX: Improved detection of git which should work on linux with symlinks.
* BUGFIX: Fix whitespace cleanup not working when using Git subfolder.
* BUGFIX: Fix error when clicking on the panel entries when using Git subfolder.

## 0.14.1 (10/12/2014)
* BUGFIX: Fix issue where extension can't detect repository correctly on cygwin.

## 0.14.0 (08/12/2014)
* You can now experimentally use extension when not working directly from a Git root folder.
* BUGFIX: Push should work when using push hooks.

## 0.13.43 (03/12/2014)
* BUGFIX: Another "Resolving .git/HEAD file failed error" fixed.
* BUGFIX: "Cannot call method replace of undefined" fixed in whitespace cleanup functionality.

## 0.13.42 (30/11/2014)
* BUGFIX: "Resolving .git/HEAD file failed error: Unknown" should stop popping up.
* BUGFIX: syncOpenDocuments is now called after using manual refresh button in panel.

## 0.13.41 (28/11/2014)
* BUGFIX: Fixed deprecation warning for DocumentManager.getWorkingSet.
* BUGFIX: Invoke syncOpenDocuments function after rebase or merge has finished to check for changes.

## 0.13.40 (27/11/2014)
* Extension should now automatically detect change of current branch outside of Brackets (in terminal/command line).
* BUGFIX: Branch list no longer overflows out of the screen when there're too many branches locally.

## 0.13.39 (14/11/2014)
* BUGFIX: Another attempt to fix Terminal opening on Mac by [Andrew Minion](https://github.com/macbookandrew)

## 0.13.38 (11/11/2014)
* BUGFIX: Fixed 'Expected end of line but found' error when opening Terminal on Mac by [Andrew Minion](https://github.com/macbookandrew)

## 0.13.37 (10/11/2014)
* Updated README for SSH configuration on Mac by [narcarsiss](https://github.com/narcarsiss)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* When commit dialog fails, commit message should be saved for another try.
* Added ability to specify usage of --no-ff when merging local branches.
* BUGFIX: Fixed occasional 'Refreshing gutter failed' error.

## 0.13.36 (06/11/2014)
* Re-use existing iTerm session if already open by [Andrew Minion](https://github.com/macbookandrew)
* Option to add Terminal shortcut to the toolbar panel by [Fez Vrasta](https://github.com/FezVrasta)
* BUGFIX: Fixed z-index problems with the project menu.

## 0.13.35 (05/11/2014)
* Added iTerm support for Mac by [dan](https://github.com/danthewolfe)
* Updated French translation by [rainje](https://github.com/rainje)
* BUGFIX: Display only first 20 letters of branch name next to the project name (full name on hover).
* BUGFIX: Password is no longer visible on 'Git Push response' screen.
* BUGFIX: Panel context menus are no longer covered by hisory view.
* BUGFIX: Fixed "Can’t get window 1" error on Mac by [jannae](https://github.com/jannae)

## 0.13.34 (28/10/2014)
* Updated Italian translation by [Pietro Albini](https://github.com/pietroalbini)
* BUGFIX: Fixed issues with Git gutters when changing panes in SplitView.

## 0.13.33 (22/10/2014)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* Removed timeouts from clone operations.
* BUGFIX: Fixed dialog hidden by the full-screen history.
* BUGFIX: Position of the 'Close-not-modified' icon is now changed properly when working set is empty.

## 0.13.32 (14/10/2014)
* BUGFIX: Allow the extension to continue with commit when it fails to read the diff (usually because the diff itself is too large).
* BUGFIX: Doubleclick on commit button won't launch commit dialog twice anymore.
* BUGFIX: Fixed extension initialization problems on some machines.

## 0.13.31 (07/10/2014)
* Added revert change button to the gutter widgets.
* Files excluded through .git/info/exclude file are now properly marked in the project tree as ignored.
* Added dirty identifier to toolbar icon by [Larz](https://github.com/larz0)
* Added custom difftool support by [Ivan Gilchrist](https://github.com/gilly3)
* Updated Simplified Chinese translation by [Zhi](https://github.com/yfwz100)
* Fixes for Brackets 0.44 by [Marcel Gerber](https://github.com/MarcelGerber)
* Fixes of project tree marks for Brackets 0.44 by [Kevin Dangoor](https://github.com/dangoor)

## 0.13.30 (26/08/2014)
* New Dark UI styling by [Larz](https://github.com/larz0)
* Theme option has been removed from Settings, as it's now turned on automatically by [Marcel Gerber](https://github.com/MarcelGerber)
* BUGFIX: Fixed some of .gitignore negative logic by [Marcel Gerber](https://github.com/MarcelGerber)
* BUGFIX: In file history, expand file's diff automatically by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.13.29 (22/08/2014)
* BUGFIX: Occasional issues with diff displaying incorrectly.
* BUGFIX: Fix history problems when branch and folder have the same name.

## 0.13.28 (18/08/2014)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* Updated README by [Fez Vrasta](https://github.com/FezVrasta)
* BUGFIX: Fix dark button styling by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.13.27 (07/08/2014)
* Updated French translation by [rainje](https://github.com/rainje)
* Fixed some typos in the README by [Eric J](https://github.com/wormeyman)
* BUGFIX: Fix check-all checkbox not working in some cases.

## 0.13.26 (06/08/2014)
* Experimental dark theme for Git panel to use with dark editor themes (configurable in settings).
* BUGFIX: Commit summary for large commits does scroll now correctly.
* BUGFIX: Getting diff from large number of files will now not timeout, but show a dialog after 3 seconds.
* BUGFIX: Better support for handling files with non-ascii characters in filenames.
* BUGFIX: Remote not found error is now expected and non-reportable.
* BUGFIX: If a gutter refresh is queued when switching projects, do not throw an error.

## 0.13.25 (27/07/2014)
* Added feature to reopen modified files by Shift-clicking on a "Close not modified" icon.
* Git now asks for your username and email when you have none set and try to init a new repository.
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* BUGFIX: Fixes to Git-FTP support by [Živorad Milekić](https://github.com/zivoradmilekic)
* BUGFIX: Extension will not try to open the Bash/Terminal if proper executable script doesn't exist.

## 0.13.24 (24/07/2014)
* BUGFIX: Commiting no longer throws an error when buggy CodeInspector is installed.

## 0.13.23 (12/07/2014)
* BUGFIX: Attempt to reconnect to Node.js when a socket connection closed unexpectedly.
* BUGFIX: Fix a bug where commit button stays enabled after leaving history view.

## 0.13.22 (02/07/2014)
* Added grunt task to fix line-endings before creating a package.

## 0.13.21 (27/06/2014)
* Updated Brazilian Portuguese translation by [Júnior Messias](https://github.com/jrmessias)
* BUGFIX: When there are not remotes but there's at least one FTP scope the Push button is enabled, by [FezVrasta](https://github.com/FezVrasta)
* BUGFIX: Some styling improvements by [cheesypoof](https://github.com/cheesypoof)

## 0.13.20 (15/06/2014)
* BUGFIX: Fixed default Git paths for Windows from bin directory to cmd directory by [Leif Gruenwoldt](https://github.com/leif81)
* BUGFIX: Allow empty commit when in merge stage.
* BUGFIX: Do not show deleted remote as default.
* BUGFIX: History viewer is now paged to load at most 25 files in one go.

## 0.13.19 (10/06/2014)
* Use LESS rather than pre-compiled CSS for the extension.
* BUGFIX: Refresh panel when a new file is added into the project (directory content has been modified).
* BUGFIX: Refresh project after commiting a merge commit.
* BUGFIX: Always clear Brackets fileSystem cache when working with .git files.
* BUGFIX: Remove panel table margin-bottom by [cheesypoof](https://github.com/cheesypoof)
* BUGFIX: When closing files not modified by Git, do not close files that have unsaved changes.

## 0.13.18 (28/05/2014)
* BUGFIX: Fix error when trying to commit non utf-8 code files.

## 0.13.17 (28/05/2014)
* BUGFIX: Fix hanging when trying to trim whitespace from binary files.

## 0.13.16 (23/05/2014)
* Added instructions for an easy installation of Git-FTP by [Fez Vrasta](https://github.com/FezVrasta)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* BUGFIX: Restored default cursor for the commit diff scrollbars by [cheesypoof](https://github.com/cheesypoof)
* BUGFIX: Diffs over 2000 lines will not be displayed due to poor performance.

## 0.13.15 (16/05/2014)
* Updated Brazilian Portuguese translation by [Rodrigo Tavares](https://github.com/rodrigost23)
* BUGFIX: Improved .gitignore parsing by [Marcel Gerber](https://github.com/MarcelGerber)
* BUGFIX: Git Diff failed when the diff is empty is now fixed.
* BUGFIX: Fixed visual nit with commit hash in history viewer.

## 0.13.14 (02/05/2014)
* BUGFIX: Fixed errors on files that are inside a directory with a plus sign in its name. Thanks to [llchen223](https://github.com/llchen223)
* BUGFIX: Add to .gitignore and Remove from .gitignore context menu entries are now removed when Git is not available in current project.

## 0.13.13 (01/05/2014)
* Added icon to the history viewer which opens the mentioned file for editing.
* Improved .gitignore parsing by [Marcel Gerber](https://github.com/MarcelGerber)
* BUGFIX: Settings & Changelog dialogs are no longer displayed on startup when running tests.
* BUGFIX: Focus doesn't remain in the editor any longer when attempting to delete local branch.

## 0.13.12 (29/04/2014)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* History now remembers last used Expand All/Collapse All.
* Styled row numbers on diffs by [Fez Vrasta](https://github.com/FezVrasta)
* BUGFIX: View authors of selection will now ask you to save modified file before launch.
* BUGFIX: Diffs no logner fail when external diff tool is configured.

## 0.13.11 (26/04/2014)
* When whitespace cleanup takes too long (over 3 seconds) it will show a progress dialog.
* BUGFIX: Fixed launching osascripts on Mac (open terminal button).

## 0.13.10 (25/04/2014)
* Added line numbers to diffs by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)
* BUGFIX: **Fixed critical bug that caused Brackets to crash when using Find in Files feature.**
* BUGFIX: Fixed error when opening terminal on Mac.
* BUGFIX: Fixed issue when opening an empty repostitory without commits.

## 0.13.9 (24/04/2014)
* BUGFIX: Branch name not showing when switching branches.
* BUGFIX: Impossible to undo last commit.

## 0.13.8 (23/04/2014)
* Autodetection of Git installation location has been improved.
* Little performance upgrade for gutters, especially in large repositories.
* BUGFIX: Correctly detect current tag or commit when in detached state - history now works when in detached state.
* BUGFIX: Fixed issue which caused some dropdowns remained open after clicking into the editor area.

## 0.13.7 (22/04/2014)
* Extension now searches for Git in common install locations and picks the latest version available in case there are more Git versions installed on one computer.
* Git version 1.7 or lower is now rejected because it doesn't have the commands required by this extension.
* Diffs now look more like GitHub ones by [Fez Vrasta](https://github.com/FezVrasta)
* Updated French translation by [Vinz243](https://github.com/Vinz243)

## 0.13.6 (17/04/2014)
* UI tweaks around history feature by [Larz](https://github.com/larz0)

## 0.13.5 (17/04/2014)
* Performance optimizations on 'Close not modified files' feature.
* Fixes in history UI by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)
* Updated contributing information by [Fez Vrasta](https://github.com/FezVrasta)
* BUGFIX: Ambiguous argument error fixed when refreshing a gutter.

## 0.13.4 (03/12/2014)
* New files are marked with green color instead of orange in the project tree.
* Some history UI tweaks by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)
* BUGFIX: Do not launch gutters sometimes, when not in a Git repository.
* BUGFIX: Invalid Git configuration shouldn't crash file watchers on linux anymore.

## 0.13.3 (14/11/2014)
* UI tweaks for the History feature by [Larz](https://github.com/larz0)
* BUGFIX: Fixed an error on Brackets startup when project is not a Git project.

## 0.13.2 (22/08/2014)
* History viewer now has close button.
* Added button to expand/collapse every diff in history viewer of the selected commit by [Fez Vrasta](https://github.com/FezVrasta)
* BUGFIX: Fixed an issue when extension refreshed on an external file change.
* BUGFIX: Fixed an issue with history when switching projects.
* BUGFIX: View authors of selection doesn't fail when empty last line is selected.

## 0.13.1 (10/06/2014)
* Fix broken styles problem on Linux & Mac.

## 0.13.0 (14/04/2014)
* Long running operations like pull and push now have progress dialog.
* Rebasing and merging is now possible with this extension.
* You can fill in a merge message while merging a branch.
* Improved new branch dialog with ability to fetch remote branches.
* New push/pull dialog where you can specify different pulling/pushing strategies.
* Modified files are now also marked in working files list.
* Whitespace cleanup now removes byte order mark and normalizes line endings to LF (configurable in settings).
* `Q` library has been completely removed and replaced by `bluebird`
* History can now also be viewed for a particular file by [Marcel Gerber](https://github.com/MarcelGerber)
* Feature to discard all changes since last commit by [Fez Vrasta](https://github.com/FezVrasta)
* Feature to checkout a commit in history, or reset to a commit in history by [Zhi](https://github.com/yfwz100)
* Hover for the expandable gutters has been added by [Miguel Castillo](https://github.com/MiguelCastillo)
* Improved Git-FTP support by [Fez Vrasta](https://github.com/FezVrasta)
* Added French translation by [rainje](https://github.com/rainje)
* Fixed some errors in translations by [Fez Vrasta](https://github.com/FezVrasta)
* Various UI improvements by [Fez Vrasta](https://github.com/FezVrasta), [Marcel Gerber](https://github.com/MarcelGerber) and [Larz](https://github.com/larz0)
* Redesigned history by [Fez Vrasta](https://github.com/FezVrasta)
* BUGFIX: Clone won't timeout anymore when cloning large repositories.
* BUGFIX: Switching between branches will never timeout.
* BUGFIX: Git processes that timeouted (waiting for password) will no longer stay opened in your OS.
* BUGFIX: Fixed some console errors when not working in a Git repository.
* BUGFIX: Fixed a bug when an empty repository is opened (without master branch)
* BUGFIX: Fixed a bug when ammending multiline commit messages.
* BUGFIX: Opened files that do not exist in a newly switched branch are now automatically closed by [Fez Vrasta](https://github.com/FezVrasta)

Little stats - 150 commits, 108 files changed, 8673 insertions(+), 6257 deletions(-) since `0.12.2`

## 0.12.2 (28/03/2014)
* Top menu has been removed - you can access settings through panel or File > Git settings...
* Branch deletion handling has been improved and now you can delete also not fully merged branches.
* README has been updated after a long time by [Fez Vrasta](https://github.com/FezVrasta)
* [Fez Vrasta](https://github.com/FezVrasta) started to add support for [Git-FTP](https://github.com/git-ftp/git-ftp)
* Updated translations by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.12.1 (26/03/2014)
* Fixed a bug that extension won't even start on some machines.
* Fixed some issues with pushing to remote repositories.
* Improvements to the commit history by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.12.0 (24/03/2014)
* Bash command is now customizable for Windows - you may need to do some adjustements (even Mac/Linux users) in the settings (you can use restore defaults command if you have any problems).
* You can now specify origin branch when creating new one.
* You can now merge local branches into the current branch.
* Many UI tweaks by [Larz](https://github.com/larz0)
* Some more UI tweaks by [Fez Vrasta](https://github.com/FezVrasta)
* Fixed custom terminal not working in Linux/Mac.
* Better .gitignore parsing by [Marcel Gerber](https://github.com/MarcelGerber)
* Updated translations by [Marcel Gerber](https://github.com/MarcelGerber) & [Pietro Albini](https://github.com/pietroalbini)

## 0.11.0 (21/03/2014)
* Added features to change current username and email by [Fez Vrasta](https://github.com/FezVrasta)
* Added feature to delete local branches by [Fez Vrasta](https://github.com/FezVrasta)
* Added feature to add and remove remotes by [Fez Vrasta](https://github.com/FezVrasta)
* Added feature to revert last commit by [Fez Vrasta](https://github.com/FezVrasta)
* Changelog is now shown in nice html by [Marcel Gerber](https://github.com/MarcelGerber)
* Updated Italian translation by [Pietro Albini](https://github.com/pietroalbini)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* Fixed issue when right-clicking on history entries.
* Fixed an issue with "View authors" not working for some people.
* When toggling "Extended" commit, message is copied from the input.
* Close not modified icon has been moved to the Working Files section by [Fez Vrasta](https://github.com/FezVrasta)

## 0.10.12 (18/03/2014)
* Added features to view authors of a file or current selection.
* Push dialog shows masked password.
* Tabs are now properly displayed in the diffs respecting Brackets "tabSize" preference.

## 0.10.11 (15/03/2014)
* Fixed an issue when commit dialog won't show on a large number of files.
* Fixed Bash button when working with UNC paths on Windows by [Fez Vrasta](https://github.com/FezVrasta)

## 0.10.10 (14/03/2014)
* Fixed extension not working on Mac & Linux platforms.

## 0.10.9 (14/03/2014)
* Fixed critical bug in 0.10.8 when not working in a git repo.

## 0.10.8 (14/03/2014)
* Unmerged file state is now properly recognized.
* Should now recognize git root even in soft links.
* Fixed bugs when handling various .gitignore entries.
* Pull and Push are now disabled when there are no remotes to work with.

## 0.10.7 (10/03/2014)
* Fixed an issue when commiting large files failed to open commit dialog.
* Updated Simplified Chinese translation by [Zhi](https://github.com/yfwz100)

## 0.10.6 (09/03/2014)
* Fixes an issue with timeout error while launching terminal in Linux.
* Automatically does chmod +x when there's permission denied on terminal script.
* Fixed issue when ignored directories were not marked as ignored without trailing slash.
* Last selected remote is now saved for the project when you reopen Brackets.

## 0.10.5 (08/03/2014)
* Escape special characters in username and password by [Zhi](https://github.com/yfwz100)
* Implemented infinite history scrolling by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4) & [Fez Vrasta](https://github.com/FezVrasta)
* Fixed commit message escaping issues in Linux
* Git commands added into own top menu by [Matt Hayward](https://github.com/matthaywardwebdesign)

## 0.10.4 (06/03/2014)
* Fixed multiple issues with pushing into remote repository.
* Fixed an issue where history was not working for large repositories.
* Fixed an issue with displaying some commits in the history.

## 0.10.3 (05/03/2014)
* Fixed ambiguous argument error when viewing history.
* Tweaks to commit history by [Fez Vrasta](https://github.com/FezVrasta) & [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)

## 0.10.2 (05/03/2014)
* xfce4-terminal support by [Ben Keith](https://github.com/benlk)
* Fixed an issue with pull command.

## 0.10.1 (18/03/2014)
* Fixed a push bug that was introduced in 0.10.0

## 0.10.0 (04/03/2014)
* Feature to browse commit history by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)
* Feature to clone a repository when in an empty folder by [Fez Vrasta](https://github.com/FezVrasta)
* Feature to use pull & push with multiple remotes by [Fez Vrasta](https://github.com/FezVrasta)
* Tabs have been added to settings dialog, a lot of new shorcuts to configure added.
* You can now navigate between modifications inside a file.
* Bash/Terminal button and Report Bug button can be hidden from panel in the settings.
* Shortcut for Push is now configurable in the settings by [Matt Hayward](https://github.com/matthaywardwebdesign)
* Bug when pushing failed in case of a password containing a quote fixed by [Matt Hayward](https://github.com/matthaywardwebdesign)
* Improved function for escaping shell arguments on Windows, commits can now contain doublequotes.

## 0.9.3 (26/02/2014)
* Disable commit button when there are no files to commit selected by [Fez Vrasta](https://github.com/FezVrasta)
* Fixed an issue when doubleclicking on a checkbox triggered opening a file.

## 0.9.2 (24/02/2014)
* Fix password hiding regExp from 0.9.1

## 0.9.1 (24/02/2014)
* Added option to disable code inspection in commit dialog.
* You must now agree to store passwords in plain text on your computer.

## 0.9.0 (21/02/2014)
* Pushing to http(s) password protected repositories should work - extension will ask for username & password.
* Bash icon now launches terminal window in other OS than Windows, thanks to [Jimmy Brian Anamaria Torres](https://github.com/Azakur4) & [Benjamin Pick](https://github.com/benjaminpick)
* Modified files are now marked in a project tree too for those who have panel closed.
* New shorcuts for commiting current file and commiting all files configurable in settings.
* Panel icons and other visual tweaks by [Fez Vrasta](https://github.com/FezVrasta)
* Refresh button on panel now refreshes current branch too in case it has been switched from outside of Brackets.
* Gutters now expand when clicking on line numbers too.
* Added Italian translation by [Fez Vrasta](https://github.com/FezVrasta)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)
* Updated Brazilian Portuguese translation by [Jimmy Brian Anamaria Torres](https://github.com/Azakur4)

## 0.8.10 (13/02/2014)
* Restyle of the interface by [Fez Vrasta](https://github.com/FezVrasta)

## 0.8.9 (12/02/2014)
* Do not display 'not a git repo' anymore [#111](https://github.com/zaggino/brackets-git/issues/111)
* Removed obsolete status bar [#110](https://github.com/zaggino/brackets-git/issues/110)

## 0.8.8 (07/02/2014)
* Add toggle panel keyboard shortcut in settings dialog.
* Add amend checkbox to the commit dialog.

## 0.8.7 (04/02/2014)
* Added Brazilian Portuguese translation by [Rodrigo Tavares](https://github.com/rodrigost23)
* Fixed dialog size bug.

## 0.8.6 (23/01/2014)
* Push now asks for origin url when no origin is defined.

## 0.8.5 (21/01/2014)
* Basic branches switching implemented.

## 0.8.4 (20/01/2014)
* Adds an option to disable adding newline at the end of the file.
* Updated Simplified Chinese translation by [Zhi](https://github.com/yfwz100)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.8.3 (17/01/2014)
* Git gutters are now clickable.

## 0.8.2 (16/01/2014)
* Basic Git gutter support - you can turn on/off this feature in settings.

## 0.8.1 (28/11/2014)
* Fixes for new Brackets' CodeInspection API (requires Sprint 36).

## 0.8.0 (09/01/2014)
* You can now add files and directory entries to .gitignore file by right clicking.

## 0.7.12 (07/01/2014)
* Minor fix in produced error messages for github bug reports.

## 0.7.11 (30/12/2013)
* Fixes bug when commiting files moved with git mv command.

## 0.7.10 (27/12/2013)
* Fixes of previous release.

## 0.7.9 (27/12/2013)
* Test if project folder is writable before doing Git Init.
* Extended commit now works without extra line breaks.

## 0.7.8 (26/12/2013)
* Do not display files in panel that are hidden by Brackets by default.

## 0.7.7 (25/12/2013)
* Added Simplified Chinese translation by [Zhi](https://github.com/yfwz100)

## 0.7.6 (23/12/2013)
* Fixes buggy releases 0.7.5 & 0.7.4

## 0.7.5 (23/12/2013)
* Button to hide untracked files from panel.

## 0.7.4 (23/12/2013)
* Experimental support for multi-line commit messages.

## 0.7.3 (20/12/2013)
* Git Init now experimentally works in projects that are not a git repository.

## 0.7.2 (19/12/2013)
* Updated German translation by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.7.1 (07/01/2014)
* Added bug reporting button to the git panel which prefills some Brackets info.

## 0.7.0 (17/12/2013)
* Improvements towards error handling and reporting.

## 0.6.19 (25/11/2013)
* Fixed issue with corrupting image files [#31](https://github.com/zaggino/brackets-git/issues/31)
* Fixed issue with delete button not working.

## 0.6.18 (13/11/2013)
* Added Git panel to the menu (View > Git) with keyboard shortcut Ctrl+Alt+G.

## 0.6.17 (11/11/2013)
* Changes to move on from deprecated APIs to new ones - requires Brackets 34.

## 0.6.16 (04/11/2013)
* Add box to show commit message length.

## 0.6.15 (01/11/2013)
* Fix the cygwin path conversion using a more reliable method by [Zhi](https://github.com/yfwz100)

## 0.6.14 (01/11/2013)
* Added pull button with fast-forward only mode. (No functionality to resolve merge conflicts)

## 0.6.13 (30/10/2013)
* Some improvements in error handling and logging.
* Fixed a bug when file contained spaces [#21](https://github.com/zaggino/brackets-git/issues/21)

## 0.6.12 (24/10/2013)
* Fix [Extension failed to load](https://github.com/zaggino/brackets-git/issues/19)

## 0.6.11 (23/10/2013)
* Fix a bug when deleting uncommited files from Git panel.

## 0.6.10 (23/10/2013)
* Fix a bug when commit/diff dialogs fail to display when first line of file is modified.
* Fix a bug in diff formatting.

## 0.6.9 (20/10/2013)
* German translation by [Marcel Gerber](https://github.com/MarcelGerber)

## 0.6.8 (19/10/2013)
* Fix bug where extension breaks on Linux by [Fabio Massaioli](https://github.com/fbbdev)

## 0.6.7 (18/10/2013)
* Add support for cygwin git by [Zhi](https://github.com/yfwz100)

## 0.6.6 (15/10/2013)
* Removed polyfills for older Brackets, sprint 32 required from now.

## 0.6.5 (04/10/2013)
* Push button will now show if there are any unpushed commits.

## 0.6.4 (03/10/2013)
* Enabled experimental push button. Pushes only to default remote.

## 0.6.3 (03/10/2013)
* Added button to remove unmodified files from working tree.

## 0.6.2 (29/09/2013)
* Fix diff output to use --no-color do avoid having color codes in output on some machines.

## 0.6.1 (25/11/2013)
* Fix bug where whitespace cleanup function corrupts binary files.
* Code checking features delayed for Sprint 32 ([adobe/brackets#5125](https://github.com/adobe/brackets/pull/5125))

## 0.6.0 (08/09/2013)
* Using new CodeInspection API from Brackets to check files for errors before commiting. (Sprint >= 31)
* Current document is now selected in the git panel for easier navigation.
* Added feature (see Git Settings) to cleanup whitespace when commiting.
* Added hover titles to the Git icon when there's a problem.

## 0.5.3 (04/09/2013)
* Fixed issue [#5](https://github.com/zaggino/brackets-git/issues/5)
* Added focus to input when commit dialog is shown.

## 0.5.2 (02/09/2013)
* Added delete button for untracked files
* Untracked files are now shown (instead of untracked directory)

## 0.5.1 (27/08/2013)
* Undo changes now works and is no longer disabled.

## 0.5.0 (27/08/2013)
* Added new diff button to show next to the every modified file.
* Little bit of UX tuning.

## 0.4.6 (27/08/2013)
* Panel now properly disables when switching between projects with and without git repository.

## 0.4.5 (25/08/2013)
* Click in the git panel now opens the file, doubleclick adds file to the working tree.

## 0.4.4 (25/08/2013)
* Great new icon and UI tweaks by [Larz](https://github.com/larz0)
* Commit dialog should be now a bit bigger depending on the screen size.

## 0.4.3 (23/08/2013)
* Settings dialog has now a restore defaults button which restores platform specific defaults (Win, Mac).
* Settings dialog has now a button to show changelog.
* Minor UI tweaks.

## 0.4.2 (22/08/2013)
* Default preferences are different for platforms.

## 0.4.1 (22/08/2013)
* Changelog is not shown on the first startup, when settings are shown.

## 0.4.0 (22/08/2013)
* Added settings panel to File > Git Settings...
* Git Settings dialog will open on first startup after the extension is installed.
* Changelog will open in dialog after the extension is updated.

## 0.3.0 (21/08/2013)
* Added diff displaying to commit dialog.

## 0.2.1 (21/08/2013)
* Added i18n support.
* Fixed styling in commit dialog.

## 0.2.0 (20/08/2013)
* Added shortcut to bash console for msysgit users.
* Added configuration file that is created on the first extension run (thx for idea to [Rajani Karuturi](https://github.com/karuturi))

## 0.1.0 (19/08/2013)
* Initial release.
* Added handlers to refresh branch name on project change or file tree refresh.
* Display current branch name in file tree if working folder is a git repository.
* Display current Git version in status bar.
* First real functionality, basic commit from brackets is now available.
