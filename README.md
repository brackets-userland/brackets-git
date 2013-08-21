# brackets-git

Integration of Git into Brackets.

Developed (and working) on Windows 7 with [msysgit](https://code.google.com/p/msysgit/) installed.

## Installation

You can use Brackets built-in [extension registry](https://brackets-registry.aboutweb.com/).

Alternatively, to use the latest version, which may or may not be in the registry:

Clone this repo into your brackets user extensions folder:

```
C:\Users\<username>\AppData\Roaming\Brackets\extensions\user
```

## Features

- Display current Git version in status bar.
- Display current branch name in file tree if working folder is a git repository.
- Display panel with information about modified and uncommited files.
- Commit files selected in panel.
- Handy shortcut to bash console for msysgit users.

More features will come later, feel free to open issues with your ideas.

## TODO

- Add an UI panel for the configuration file.
- Add diff icons to the currently edited document in a way interactive linter does it.

## Configuration

Extension will create a configuration file on the first run here:

```
C:\Users\<username>\AppData\Roaming\Brackets\extensions\user\zaggino.brackets-git\_configuration.json
```

You can alter this JSON file accordingly to your machine setup.

## Pull requests

This extension is developed in Brackets and pull requests always need to avoid any JSLint errors.
There is another [extension](https://github.com/MiguelCastillo/Brackets-Interactive-Linter) used for following JSHint rules specified in ```.jshintrc```
Please check for errors before opening any pull requests.

Another very handy extension to use is [brackets-todo](https://github.com/mikaeljorhult/brackets-todo) which helps you add bookmarks for things to be resolved later.