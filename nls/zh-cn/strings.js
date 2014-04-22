/*jshint maxlen:false */

define({
    // ADVANCED_FEATURES_WARNING:          "This features are not recommended for basic Git users as they may cause you to lose code that has been already commited if used inproperly. Use with caution.",
    // TODO: localize ADVANCED_FEATURES_WARNING to zh-cn
    // ADD_ENDLINE_TO_THE_END_OF_FILE:     "Add endline at the end of file",
    ADD_ENDLINE_TO_THE_END_OF_FILE:        "在文件末尾添加空行",
    // ADD_TO_GITIGNORE:                   "Add to .gitignore",
    ADD_TO_GITIGNORE:                      "添加到 .gitignore",
    // AMEND_COMMIT:                       "Amend last commit",
    AMEND_COMMIT:                          "修改上一次提交",
    // AMEND_COMMIT_FORBIDDEN:             "Cannot amend commit when there are no unpushed commits",
    AMEND_COMMIT_FORBIDDEN:                "不能修改已经上传的提交",
    // AUTHOR:                             "Author",
    // TODO: localize AUTHOR to zh-cn
    // AUTHORS_OF:                         "Authors of",
    // TODO: localize AUTHORS_OF to zh-cn
    // BASH_NOT_AVAILABLE:                 "Bash is not available or properly configured",
    BASH_NOT_AVAILABLE:                    "Bash 不存在或者配置有误",
    // BASIC_CONFIGURATION:                "Basic configuration",
    BASIC_CONFIGURATION:                   "基本设置",
    // BRACKETS_GIT_ERROR:                 "Brackets Git encountered an error\u2026",
    BRACKETS_GIT_ERROR:                    "Brackets Git 遇到了一个错误\u2026",
    // BRANCH_NAME:                        "Branch name",
    BRANCH_NAME:                           "分支名称",
    // BUTTON_CANCEL:                      "Cancel",
    BUTTON_CANCEL:                         "取消",
    // BUTTON_CHANGELOG:                   "Show changelog",
    BUTTON_CHANGELOG:                      "显示更改（Changelog）",
    // BUTTON_CLOSE:                       "Close",
    BUTTON_CLOSE:                          "关闭",
    // BUTTON_DEFAULTS:                    "Restore defaults",
    BUTTON_DEFAULTS:                       "重置默认值",
    // BUTTON_OK:                          "OK",
    BUTTON_OK:                             "确认",
    // BUTTON_REPORT:                      "Report",
    BUTTON_REPORT:                         "报告错误",
    // BUTTON_SAVE:                        "Save",
    BUTTON_SAVE:                           "保存",
    // BUTTON_COMMIT:                      "Commit",
    BUTTON_COMMIT:                         "提交",
    // BUTTON_INIT:                        "Init",
    BUTTON_INIT:                           "初始化 Git 仓库",
    // BUTTON_CLONE:                       "Clone",
    BUTTON_CLONE:                          "克隆远程 Git 仓库",
    // BUTTON_CHECKOUT_COMMIT:             "Checkout",
    // TODO: localize BUTTON_CHECKOUT_COMMIT to zh-cn
    // BUTTON_RESET:                       "Reset index",
    // TODO: localize BUTTON_RESET to zh-cn
    // BUTTON_RESET_HARD:                  "Reset to this commit and discard the changes that came after it. (reset --hard)",
    // TODO: localize BUTTON_RESET_HARD to zh-cn
    // BUTTON_RESET_SOFT:                  "Reset to this commit and retain changes that came after it staged for a new commit. (reset --soft)",
    // TODO: localize BUTTON_RESET_SOFT to zh-cn
    // BUTTON_RESET_MIXED:                 "Reset to this commit and retain changes that came after it unstaged. (reset --mixed)",
    // TODO: localize BUTTON_RESET_MIXED to zh-cn
    // CHANGELOG:                          "Changelog",
    CHANGELOG:                             "更改记录（Changelog）",
    // CHANGE_USER_NAME:                   "Change git username",
    // TODO: localize CHANGE_USER_NAME to zh-cn
    // CHANGE_USER_EMAIL:                  "Change git email",
    // TODO: localize CHANGE_USER_EMAIL to zh-cn
    // CHECK_GIT_SETTINGS:                 "Check Git settings",
    CHECK_GIT_SETTINGS:                    "检查 Git 设置",
    // CODE_INSPECTION_PROBLEMS:           "Code inspection problems:",
    // TODO: localize CODE_INSPECTION_PROBLEMS to zh-cn
    // COMMAND_ARGUMENTS:                  "Command arguments",
    // TODO: localize COMMAND_ARGUMENTS to zh-cn
    // COMMIT:                             "Commit",
    COMMIT:                                "提交",
    // COMMIT_ALL_SHORTCUT:                "Commit all files",
    COMMIT_ALL_SHORTCUT:                   "提交所有修改",
    // COMMIT_CURRENT_SHORTCUT:            "Commit current file",
    COMMIT_CURRENT_SHORTCUT:               "提交当前文件",
    // COMMIT_MESSAGE_PLACEHOLDER:         "Enter commit message here\u2026",
    COMMIT_MESSAGE_PLACEHOLDER:            "在此编辑提交信息\u2026",
    // CLONE_REPOSITORY:                   "Clone repository",
    CLONE_REPOSITORY:                      "克隆远程仓库",
    // CREATE_NEW_BRANCH:                  "Create new branch\u2026",
    CREATE_NEW_BRANCH:                     "新建分支",
    // CREATE_NEW_REMOTE:                  "Create new remote\u2026",
    // TODO: localize CREATE_NEW_REMOTE to zh-cn
    // CREATE_NEW_GITFTP_SCOPE:            "Create new Git-FTP remote\u2026",
    // TODO: localize CREATE_NEW_GITFTP_SCOPE to zh-cn
    // CUSTOM_TERMINAL_COMMAND:            "Custom terminal command (sample: gnome-terminal or complete path to executable)",
    CUSTOM_TERMINAL_COMMAND:               "自定义终端命令（例如 gnome-terminal --window --working-directory=$1）",
    // CUSTOM_TERMINAL_COMMAND_HINT:       "Sample arguments: --window --working-directory=$1<br>$1 in arguments will be replaced by current project directory.",
    // TODO: localize CUSTOM_TERMINAL_COMMAND_HINT to zh-cn
    // DATE_FORMAT:                        "YYYY-MM-DD HH:mm:ss",
    // TODO: localize DATE_FORMAT to zh-cn
    // DATE_MODE_0:                        "Formatted using local date format",
    // TODO: localize DATE_MODE_0 to zh-cn
    // DATE_MODE_1:                        "Relative time",
    // TODO: localize DATE_MODE_1 to zh-cn
    // DATE_MODE_2:                        "Intelligent mode (relative/formatted)",
    // TODO: localize DATE_MODE_2 to zh-cn
    // DATE_MODE_3:                        "Formatted using your own format",
    // TODO: localize DATE_MODE_3 to zh-cn
    // DATE_MODE_4:                        "Original Git date",
    // TODO: localize DATE_MODE_4 to zh-cn
    // DEBUG:                              "Debug",
    DEBUG:                                 "调试",
    // DEBUG_MODE_SETTING:                 "DEBUG mode &mdash; Leave this OFF unless you need to find a problem with the extension. All Git communication will be forwarded to Brackets console!",
    DEBUG_MODE_SETTING:                    "启用调试模式",
    // DELETE_FILE:                        "Delete file",
    DELETE_FILE:                           "删除文件",
    // DELETE_REMOTE:                      "Delete remote",
    // TODO: localize DELETE_REMOTE to zh-cn
    // DELETE_REMOTE_NAME:                 "Do you really wish to delete remote \"{0}\"?",
    // TODO: localize DELETE_REMOTE_NAME to zh-cn
    // DELETE_LOCAL_BRANCH:                "Delete local branch",
    // TODO: localize DELETE_LOCAL_BRANCH to zh-cn
    // DELETE_LOCAL_BRANCH_NAME:           "Do you really wish to delete local branch \"{0}\"?",
    // TODO: localize DELETE_LOCAL_BRANCH_NAME to zh-cn
    // TITLE_CHECKOUT:                     "Do you really wish to checkout this commmit?",
    // TODO: localize TITLE_CHECKOUT to zh-cn
    // DIALOG_CHECKOUT:                    "When checking out a commit, the repo will go into a DETACHED HEAD state. You can't make any commits unless you create a branch based on this.",
    // TODO: localize DIALOG_CHECKOUT to zh-cn
    // TITLE_RESET:                        "Do you really wish to reset?",
    // TODO: localize TITLE_RESET to zh-cn
    // DIALOG_RESET_HARD:                  "You will lose all changes after this commit!",
    // TODO: localize DIALOG_RESET_HARD to zh-cn
    // DIALOG_RESET_MIXED:                 "Changes after this commit will be unstaged.",
    // TODO: localize DIALOG_RESET_MIXED to zh-cn
    // DIALOG_RESET_SOFT:                  "Changes after this commit will be staged for a new commmit.",
    // TODO: localize DIALOG_RESET_SOFT to zh-cn
    // DIFF:                               "Diff",
    DIFF:                                  "运行 Diff 查看更改",
    // DIFF_FAILED_SEE_FILES:              "Git diff failed to provide diff results. This is the list of staged files to be commited:",
    // TODO: localize DIFF_FAILED_SEE_FILES to zh-cn
    // ENTER_PASSWORD:                     "Enter password:",
    ENTER_PASSWORD:                        "输入密码：",
    // ENTER_USERNAME:                     "Enter username:",
    ENTER_USERNAME:                        "输入用户名：",
    // ENTER_REMOTE_GIT_URL:               "Enter Git URL of the repository you want to clone:",
    ENTER_REMOTE_GIT_URL:                  "输入远程 Git 地址",
    // ENTER_REMOTE_NAME:                  "Enter name of the new remote:",
    // TODO: localize ENTER_REMOTE_NAME to zh-cn
    // ENTER_GITFTP_SCOPE_NAME:            "Enter name of the new Git-FTP remote:",
    // TODO: localize ENTER_GITFTP_SCOPE_NAME to zh-cn
    // ENTER_REMOTE_URL:                   "Enter URL of the new remote:",
    // TODO: localize ENTER_REMOTE_URL to zh-cn
    // ENTER_GITFTP_SCOPE_URL:             "Enter FTP URL of the new Git-FTP remote specifing username and password:",
    // TODO: localize ENTER_GITFTP_SCOPE_URL to zh-cn
    // ERROR_TERMINAL_NOT_FOUND:           "Terminal was not found for your OS, you can define a custom Terminal command in the settings",
    ERROR_TERMINAL_NOT_FOUND:              "在您的系统里找不到预设置的终端，您可以在设置中手动定义终端命令。",
    // ERROR_CONNECT_NODEJS:               "Failed to connect to NodeJS. If you just updated the extension close all instances of Brackets and try starting again.",
    // TODO: localize ERROR_CONNECT_NODEJS to zh-cn
    // EXTENDED_COMMIT_MESSAGE:            "EXTENDED",
    // TODO: localize EXTENDED_COMMIT_MESSAGE to zh-cn
    // EXTENSION_WAS_UPDATED_TITLE:        "The extension was updated to {0}",
    EXTENSION_WAS_UPDATED_TITLE:           "扩展已经更新到 {0} 版本",
    // ENTER_NEW_USER_NAME:                "Enter username",
    // TODO: localize ENTER_NEW_USER_NAME to zh-cn
    // ENTER_NEW_USER_EMAIL:               "Enter email",
    // TODO: localize ENTER_NEW_USER_EMAIL to zh-cn
    // ENABLE_ADVANCED_FEATURES:           "Enable advanced features",
    // TODO: localize ENABLE_ADVANCED_FEATURES to zh-cn
    // FEATURES:                           "Features",
    FEATURES:                              "特性",
    // FILE_STAGED:                        "Staged",
    FILE_STAGED:                           "被跟踪的文件",
    // FILE_UNMODIFIED:                    "Unmodified",
    // TODO: localize FILE_UNMODIFIED to zh-cn
    // FILE_IGNORED:                       "Ignored",
    // TODO: localize FILE_IGNORED to zh-cn
    // FILE_UNTRACKED:                     "Untracked",
    FILE_UNTRACKED:                        "未被跟踪的文件",
    // FILE_MODIFIED:                      "Modified",
    FILE_MODIFIED:                         "已修改",
    // FILE_ADDED:                         "New file",
    FILE_ADDED:                            "新加入",
    // FILE_DELETED:                       "Deleted",
    FILE_DELETED:                          "已删除",
    // FILE_RENAMED:                       "Renamed",
    FILE_RENAMED:                          "重命名",
    // FILE_COPIED:                        "Copied",
    // TODO: localize FILE_COPIED to zh-cn
    // FILE_UNMERGED:                      "Unmerged",
    // TODO: localize FILE_UNMERGED to zh-cn
    // FOR_MAC_LINUX_USERS:                "For Mac/Linux users",
    FOR_MAC_LINUX_USERS:                   "对于 Mac/Linux 用户",
    // FOR_WINDOWS_USERS:                  "For Windows users",
    FOR_WINDOWS_USERS:                     "对于 Windows 用户",
    // GIT_COMMIT:                         "Git commit\u2026",
    GIT_COMMIT:                            "Git 提交\u2026",
    // GIT_CONFIGURATION:                  "Git configuration",
    GIT_CONFIGURATION:                     "Git 配置",
    // GIT_DIFF:                           "Git diff &mdash;",
    GIT_DIFF:                              "Git diff &mdash;",
    // GIT_PULL_RESPONSE:                  "Git Pull response",
    GIT_PULL_RESPONSE:                     "Git Pull 的回应",
    // GIT_PUSH_RESPONSE:                  "Git Push response",
    GIT_PUSH_RESPONSE:                     "Git Push 的回应",
    // GITFTP_PUSH_RESPONSE:               "Git-FTP Push response",
    // TODO: localize GITFTP_PUSH_RESPONSE to zh-cn
    // GIT_SETTINGS:                       "Git Settings\u2026",
    GIT_SETTINGS:                          "Git 设置\u2026",
    // GIT_REMOTES:                        "Git remotes",
    // TODO: localize GIT_REMOTES to zh-cn
    // GITFTP_SCOPES:                      "Git-FTP remotes",
    // TODO: localize GITFTP_SCOPES to zh-cn
    // GOTO_PREVIOUS_GIT_CHANGE:           "Go to previous Git change",
    GOTO_PREVIOUS_GIT_CHANGE:              "回到前一个修改位置",
    // GOTO_NEXT_GIT_CHANGE:               "Go to next Git change",
    GOTO_NEXT_GIT_CHANGE:                  "跳到下一个修改位置",
    // HIDE_UNTRACKED:                     "Hide untracked",
    // TODO: localize HIDE_UNTRACKED to zh-cn
    // INIT_GITFTP_SCOPE:                  "Initialize Git-FTP remote",
    // TODO: localize INIT_GITFTP_SCOPE to zh-cn
    // INIT_GITFTP_SCOPE_NAME:             "Initialize Git-FTP remote \"{0}\"?",
    // TODO: localize INIT_GITFTP_SCOPE_NAME to zh-cn
    // LAUNCH_BASH_SHORTCUT:               "Bash/Terminal shortcut",
    LAUNCH_BASH_SHORTCUT:                  "运行终端的快捷键",
    // LOADING:                            "Loading\u2026",
    LOADING:                               "加载中\u2026",
    // LINES:                              "Lines",
    // TODO: localize LINES to zh-cn
    // _LINES:                             "lines",
    // TODO: localize _LINES to zh-cn
    // LIST_MODIFIED_FILES:                "Modified files",
    LIST_MODIFIED_FILES:                   "列出修改的文件",
    // MARK_MODIFIED_FILES_IN_TREE:        "Mark modified files in file tree",
    MARK_MODIFIED_FILES_IN_TREE:           "在文件树（File tree）中标记修改的文件",
    // MERGE_BRANCH:                       "Merge branch",
    // TODO: localize MERGE_BRANCH to zh-cn
    // MERGE_RESULT:                       "Merge result",
    // TODO: localize MERGE_RESULT to zh-cn
    // MERGE_MESSAGE:                      "Merge message",
    // TODO: localize MERGE_MESSAGE to zh-cn
    // NORMALIZE_LINE_ENDINGS:             "Normalize line endings (to \\n)",
    // TODO: localize NORMALIZE_LINE_ENDINGS to zh-cn
    // NOTHING_TO_COMMIT:                  "Nothing to commit, working directory clean.",
    NOTHING_TO_COMMIT:                     "没有更改，不需要提交。",
    // ORIGIN_BRANCH:                      "Origin branch",
    // TODO: localize ORIGIN_BRANCH to zh-cn
    // PANEL_COMMAND:                      "Show Git panel",
    PANEL_COMMAND:                         "显示 Git 面板",
    // PANEL_SHORTCUT:                     "Toggle panel",
    PANEL_SHORTCUT:                        "显示/关闭 Git 面板",
    // PASSWORDS:                          "Passwords",
    PASSWORDS:                             "密码",
    // PATH_TO_GIT_EXECUTABLE:             "Path to Git executable",
    PATH_TO_GIT_EXECUTABLE:                "Git 执行文件路径",
    // PATH_TO_GIT_MSYSGIT:                "Path to msysgit folder",
    PATH_TO_GIT_MSYSGIT:                   "msysgit 的路径",
    // PULL_SHORTCUT:                      "Pull from remote repository",
    PULL_SHORTCUT:                         "Git Pull",
    // PUSH_SHORTCUT:                      "Push to remote repository",
    PUSH_SHORTCUT:                         "Git Push",
    // Q_DELETE_FILE:                      "Are you sure you wish to delete the file <span class='dialog-filename'>{0}</span>?",
    Q_DELETE_FILE:                         "你确认要删除 <span class='dialog-filename'>{0}</span> 文件吗？",
    // Q_RESTART_BRACKETS:                 "Do you wish to restart Brackets to apply new settings?",
    Q_RESTART_BRACKETS:                    "希望现在重启 Brackets 并应用更改吗？",
    // Q_UNDO_CHANGES:                     "Reset changes to file <span class='dialog-filename'>{0}</span>?",
    Q_UNDO_CHANGES:                        "确认重置对 <span class='dialog-filename'>{0}</span> 文件的更改？",
    // REMOVE_BOM:                         "Remove BOM from files",
    // TODO: localize REMOVE_BOM to zh-cn
    // REMOVE_FROM_GITIGNORE:              "Remove from .gitignore",
    REMOVE_FROM_GITIGNORE:                 "从 .gitignore 中删除",
    // RESTART:                            "Restart",
    RESTART:                               "重新启动",
    // RESET_LOCAL_REPO:                   "Discard all changes since last commit",
    // TODO: localize RESET_LOCAL_REPO to zh-cn
    // RESET_LOCAL_REPO_CONFIRM:           "Do you wish to discard all changes done since last commit? This action can't be reverted.",
    // TODO: localize RESET_LOCAL_REPO_CONFIRM to zh-cn
    // SAVE_PASSWORD_QUESTION:             "Save username/password?",
    SAVE_PASSWORD_QUESTION:                "保存用户名和密码？",
    // SET_ORIGIN_URL:                     "Set origin URL",
    SET_ORIGIN_URL:                        "设置 origin 的地址",
    // SHORTCUTS:                          "Shortcuts",
    SHORTCUTS:                             "快捷键",
    // SHORTCUTS_HINT:                     "Separate keys with dash, like this: Ctrl-Alt-G<br>You can use the english key identifiers Ctrl, Cmd (Mac), Alt and Shift.",
    SHORTCUTS_HINT:                        "提示：用“-”分割按键",
    // SHOW_BASH_TERMINAL_BUTTON:          "Show Bash/Terminal button in the panel",
    SHOW_BASH_TERMINAL_BUTTON:             "在面板中显示终端按钮",
    // SHOWN_DATE_FORMAT:                  "Format of commit dates in history",
    // TODO: localize SHOWN_DATE_FORMAT to zh-cn
    // SHOW_REPORT_BUG_BUTTON:             "Show Report Bug button in the panel",
    SHOW_REPORT_BUG_BUTTON:                "在面板中显示错误报告按钮",
    // SHOW_UNTRACKED:                     "Show untracked",
    // TODO: localize SHOW_UNTRACKED to zh-cn
    // STRIP_WHITESPACE_FROM_COMMITS:      "Strip trailing whitespace from commits",
    STRIP_WHITESPACE_FROM_COMMITS:         "去除提交信息后的空白字符",
    // TARGET_BRANCH:                      "Target branch",
    // TODO: localize TARGET_BRANCH to zh-cn
    // TOOLTIP_BUG:                        "Report bug",
    TOOLTIP_BUG:                           "报告错误",
    // TOOLTIP_OPEN_BASH:                  "Open Bash/Terminal console",
    TOOLTIP_OPEN_BASH:                     "打开终端",
    // TOOLTIP_PULL:                       "Git Pull",
    TOOLTIP_PULL:                          "从远程拉取代码",
    // TOOLTIP_PUSH:                       "Git Push",
    TOOLTIP_PUSH:                          "推送到远程服务器",
    // TOOLTIP_GITPUSH:                    "Git-FTP Push",
    // TODO: localize TOOLTIP_GITPUSH to zh-cn
    // TOOLTIP_CLOSE_NOT_MODIFIED:         "Close files not modified in Git",
    TOOLTIP_CLOSE_NOT_MODIFIED:            "关闭没有修改的文件",
    // TOOLTIP_INIT:                       "Initialize repository",
    TOOLTIP_INIT:                          "初始化 Git 仓库",
    // TOOLTIP_CHECKOUT_COMMIT:            "Checkout a specific commit",
    // TODO: localize TOOLTIP_CHECKOUT_COMMIT to zh-cn
    // TOOLTIP_CLONE:                      "Clone existing repository",
    TOOLTIP_CLONE:                         "克隆远程仓库",
    // TOOLTIP_COMMIT:                     "Commit the selected files",
    TOOLTIP_COMMIT:                        "提交所选择的文件",
    // TOOLTIP_REFRESH_PANEL:              "Refresh panel",
    TOOLTIP_REFRESH_PANEL:                 "刷新面板",
    // TOOLTIP_HIDE_HISTORY:               "Hide history",
    TOOLTIP_HIDE_HISTORY:                  "隐藏历史记录",
    // TOOLTIP_SHOW_HISTORY:               "Show history",
    TOOLTIP_SHOW_HISTORY:                  "显示历史记录",
    // TOOLTIP_HIDE_FILE_HISTORY:          "Hide file history",
    // TODO: localize TOOLTIP_HIDE_FILE_HISTORY to zh-cn
    // TOOLTIP_SHOW_FILE_HISTORY:          "Show file history",
    // TODO: localize TOOLTIP_SHOW_FILE_HISTORY to zh-cn
    // TOOLTIP_PICK_REMOTE:                "Pick preferred remote",
    TOOLTIP_PICK_REMOTE:                   "选择首选的远程地址",
    // TOOLTIP_MORE:                       "More actions\u2026",
    // TODO: localize TOOLTIP_MORE to zh-cn
    // USER_ABORTED:                       "User aborted!",
    // TODO: localize USER_ABORTED to zh-cn
    // UNDO_CHANGES:                       "Discard changes",
    UNDO_CHANGES:                          "撤销更改",
    // UNDO_LAST_LOCAL_COMMIT:             "Undo last local (not pushed) commit",
    // TODO: localize UNDO_LAST_LOCAL_COMMIT to zh-cn
    // URL:                                "URL",
    URL:                                   "地址",
    // USE_CODE_INSPECTION:                "Use Code inspection",
    USE_CODE_INSPECTION:                   "使用代码检查",
    // USE_GIT_GUTTER:                     "Use Git gutter marks",
    USE_GIT_GUTTER:                        "使用 Git gutter 标记修改记录",
    // USER_DATE_FORMAT:                   "Own date format (<a href='http://momentjs.com/docs/#/displaying/format/'>Syntax</a>)",
    // TODO: localize USER_DATE_FORMAT to zh-cn
    // USE_GITFTP:                         "Use Git-FTP",
    // TODO: localize USE_GITFTP to zh-cn
    // USING_GIT_VERSION:                  "Git version",
    USING_GIT_VERSION:                     "Git 版本"
    // VIEW_AUTHORS_SELECTION:             "View authors of selection",
    // TODO: localize VIEW_AUTHORS_SELECTION to zh-cn
    // VIEW_AUTHORS_FILE:                  "View authors of file"
    // TODO: localize VIEW_AUTHORS_FILE to zh-cn
});
