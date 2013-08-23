# brackets-git

Git extension for [Brackets](http://brackets.io/).

Developed on Windows with [msysgit](https://code.google.com/p/msysgit/) installed.

Also working on Mac with [Git for OS X](https://code.google.com/p/git-osx-installer/) installed.

Currently not working on Linux due to Brackets issues, this will hopefully change in the future.

## Installation

You can use Brackets built-in [extension registry](https://brackets-registry.aboutweb.com/).

Extension can be configured in "File > Git Settings..." (this window will show the first time after you install the extension).

## Features

- Displays current Git version in status bar (will be an red error when something is wrong).
- Displays current branch name in the file tree if working folder is a git repository.
- Displays panel with information about modified and uncommited files (can be toggled with icon on the right side of Brackets).
- Commit files selected in the panel, displays diff of what you are actually going to commit.
- Handy shortcut to bash console for windows-msysgit users.

More features will come later, feel free to __open issues with your ideas__.

## Pull requests

This extension is developed in Brackets and pull requests always need to avoid any JSLint errors, feel free to modify ```/*jslint``` settings in the particular file if needed.
There is another [extension](https://github.com/MiguelCastillo/Brackets-Interactive-Linter) used for following JSHint rules specified in ```.jshintrc```.
Please check for errors before opening any pull requests.

Another very handy extension to use is [brackets-todo](https://github.com/mikaeljorhult/brackets-todo) which helps you add bookmarks for things to be resolved later.