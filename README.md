# brackets-git

Integration of Git into Brackets.

Developed (and working) on Windows 7 with [msysgit](https://code.google.com/p/msysgit/) installed.

## Installation

You can use Brackets built-in [extension registry](https://brackets-registry.aboutweb.com/).

Extension can be configured in File > Git Settings...

Alternatively, to use the development version, clone this repo into your brackets user extensions folder:

```
C:\Users\<username>\AppData\Roaming\Brackets\extensions\user
```

## Features

- Display current Git version in status bar.
- Display current branch name in file tree if working folder is a git repository.
- Display panel with information about modified and uncommited files.
- Commit files selected in panel.
- Handy shortcut to bash console for windows-msysgit users.

More features will come later, feel free to open issues with your ideas.

## Pull requests

This extension is developed in Brackets and pull requests always need to avoid any JSLint errors.
There is another [extension](https://github.com/MiguelCastillo/Brackets-Interactive-Linter) used for following JSHint rules specified in ```.jshintrc```
Please check for errors before opening any pull requests.

Another very handy extension to use is [brackets-todo](https://github.com/mikaeljorhult/brackets-todo) which helps you add bookmarks for things to be resolved later.