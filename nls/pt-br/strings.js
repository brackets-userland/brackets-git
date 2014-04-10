/*jshint maxlen:false */

define({
    // ADVANCED_FEATURES_WARNING:          "This features are not recommended for basic Git users as they may cause you to lose code that has been already commited if used inproperly. Use with caution.",
    // TODO: localize ADVANCED_FEATURES_WARNING to pt-br
    // ADD_ENDLINE_TO_THE_END_OF_FILE:     "Add endline at the end of file",
    ADD_ENDLINE_TO_THE_END_OF_FILE:        "Adicionar endline no fim do arquivo",
    // ADD_TO_GITIGNORE:                   "Add to .gitignore",
    ADD_TO_GITIGNORE:                      "Adicionar ao .gitignore",
    // AMEND_COMMIT:                       "Amend last commit",
    AMEND_COMMIT:                          "Emendar no último commit",
    // AMEND_COMMIT_FORBIDDEN:             "Cannot amend commit when there are no unpushed commits",
    AMEND_COMMIT_FORBIDDEN:                "Não é possível emendar o commit quando não tem unpushed commits",
    // AUTHOR:                             "Author",
    // TODO: localize AUTHOR to pt-br
    // AUTHORS_OF:                         "Authors of",
    // TODO: localize AUTHORS_OF to pt-br
    // BASH_NOT_AVAILABLE:                 "Bash is not available or properly configured",
    BASH_NOT_AVAILABLE:                    "O console de comando não está disponível ou propriamente configurado",
    // BASIC_CONFIGURATION:                "Basic configuration",
    BASIC_CONFIGURATION:                   "Configuração básica",
    // BRACKETS_GIT_ERROR:                 "Brackets Git encountered an error\u2026",
    BRACKETS_GIT_ERROR:                    "Brackets Git encontrou um erro\u2026",
    // BRANCH_NAME:                        "Branch name",
    BRANCH_NAME:                           "Nome do Branch",
    // BUTTON_CANCEL:                      "Cancel",
    BUTTON_CANCEL:                         "Cancelar",
    // BUTTON_CHANGELOG:                   "Show changelog",
    BUTTON_CHANGELOG:                      "Histórico de alterações",
    // BUTTON_CLOSE:                       "Close",
    BUTTON_CLOSE:                          "Fechar",
    // BUTTON_DEFAULTS:                    "Restore defaults",
    BUTTON_DEFAULTS:                       "Restaurar padrões",
    // BUTTON_OK:                          "OK",
    BUTTON_OK:                             "OK",
    // BUTTON_REPORT:                      "Report",
    BUTTON_REPORT:                         "Relatar",
    // BUTTON_SAVE:                        "Save",
    BUTTON_SAVE:                           "Salvar",
    // BUTTON_COMMIT:                      "Commit",
    BUTTON_COMMIT:                         "Fazer Commit",
    // BUTTON_INIT:                        "Init",
    BUTTON_INIT:                           "Init",
    // BUTTON_CLONE:                       "Clone",
    // TODO: localize BUTTON_CLONE to pt-br
    // BUTTON_CHECKOUT_COMMIT:             "Checkout",
    // TODO: localize BUTTON_CHECKOUT_COMMIT to pt-br
    // BUTTON_RESET:                       "Reset index",
    // TODO: localize BUTTON_RESET to pt-br
    // BUTTON_RESET_HARD:                  "Reset to this commit and discard the changes that came after it. (reset --hard)",
    // TODO: localize BUTTON_RESET_HARD to pt-br
    // BUTTON_RESET_SOFT:                  "Reset to this commit and retain changes that came after it staged for a new commit. (reset --soft)",
    // TODO: localize BUTTON_RESET_SOFT to pt-br
    // BUTTON_RESET_MIXED:                 "Reset to this commit and retain changes that came after it unstaged. (reset --mixed)",
    // TODO: localize BUTTON_RESET_MIXED to pt-br
    // CHANGELOG:                          "Changelog",
    CHANGELOG:                             "Histórico de alterações",
    // CHANGE_USER_NAME:                   "Change git username",
    // TODO: localize CHANGE_USER_NAME to pt-br
    // CHANGE_USER_EMAIL:                  "Change git email",
    // TODO: localize CHANGE_USER_EMAIL to pt-br
    // CHECK_GIT_SETTINGS:                 "Check Git settings",
    CHECK_GIT_SETTINGS:                    "Verificar configurações do Git",
    // CODE_INSPECTION_PROBLEMS:           "Code inspection problems:",
    // TODO: localize CODE_INSPECTION_PROBLEMS to pt-br
    // COMMAND_ARGUMENTS:                  "Command arguments",
    // TODO: localize COMMAND_ARGUMENTS to pt-br
    // COMMIT:                             "Commit",
    // TODO: localize COMMIT to pt-br
    // COMMIT_ALL_SHORTCUT:                "Commit all files",
    COMMIT_ALL_SHORTCUT:                   "Commit todos os arquivos",
    // COMMIT_CURRENT_SHORTCUT:            "Commit current file",
    COMMIT_CURRENT_SHORTCUT:               "Commit arquivo atual",
    // COMMIT_MESSAGE_PLACEHOLDER:         "Enter commit message here\u2026",
    COMMIT_MESSAGE_PLACEHOLDER:            "Insira a mensagem do commit aqui\u2026",
    // CLONE_REPOSITORY:                   "Clone repository",
    // TODO: localize CLONE_REPOSITORY to pt-br
    // CREATE_NEW_BRANCH:                  "Create new branch\u2026",
    CREATE_NEW_BRANCH:                     "Criar um novo branch\u2026",
    // CREATE_NEW_REMOTE:                  "Create new remote\u2026",
    // TODO: localize CREATE_NEW_REMOTE to pt-br
    // CREATE_NEW_GITFTP_SCOPE:            "Create new Git-FTP remote\u2026",
    // TODO: localize CREATE_NEW_GITFTP_SCOPE to pt-br
    // CUSTOM_TERMINAL_COMMAND:            "Custom terminal command (sample: gnome-terminal or complete path to executable)",
    CUSTOM_TERMINAL_COMMAND:               "Custom terminal command (sample: gnome-terminal --window --working-directory=$1)",
    // CUSTOM_TERMINAL_COMMAND_HINT:       "Sample arguments: --window --working-directory=$1<br>$1 in arguments will be replaced by current project directory.",
    // TODO: localize CUSTOM_TERMINAL_COMMAND_HINT to pt-br
    // DATE_FORMAT:                        "YYYY-MM-DD HH:mm:ss",
    // TODO: localize DATE_FORMAT to pt-br
    // DATE_MODE_0:                        "Formatted using local date format",
    // TODO: localize DATE_MODE_0 to pt-br
    // DATE_MODE_1:                        "Relative time",
    // TODO: localize DATE_MODE_1 to pt-br
    // DATE_MODE_2:                        "Intelligent mode (relative/formatted)",
    // TODO: localize DATE_MODE_2 to pt-br
    // DATE_MODE_3:                        "Formatted using your own format",
    // TODO: localize DATE_MODE_3 to pt-br
    // DATE_MODE_4:                        "Original Git date",
    // TODO: localize DATE_MODE_4 to pt-br
    // DEBUG:                              "Debug",
    // TODO: localize DEBUG to pt-br
    // DEBUG_MODE_SETTING:                 "DEBUG mode &mdash; Leave this OFF unless you need to find a problem with the extension. All Git communication will be forwarded to Brackets console!",
    // TODO: localize DEBUG_MODE_SETTING to pt-br
    // DELETE_FILE:                        "Delete file",
    DELETE_FILE:                           "Excluir arquivo",
    // DELETE_REMOTE:                      "Delete remote",
    // TODO: localize DELETE_REMOTE to pt-br
    // DELETE_REMOTE_NAME:                 "Do you really wish to delete remote \"{0}\"?",
    // TODO: localize DELETE_REMOTE_NAME to pt-br
    // DELETE_LOCAL_BRANCH:                "Delete local branch",
    // TODO: localize DELETE_LOCAL_BRANCH to pt-br
    // DELETE_LOCAL_BRANCH_NAME:           "Do you really wish to delete local branch \"{0}\"?",
    // TODO: localize DELETE_LOCAL_BRANCH_NAME to pt-br
    // TITLE_CHECKOUT:                     "Do you really wish to checkout this commmit?",
    // TODO: localize TITLE_CHECKOUT to pt-br
    // DIALOG_CHECKOUT:                    "When checking out a commit, the repo will go into a DETACHED HEAD state. You can't make any commits unless you create a branch based on this.",
    // TODO: localize DIALOG_CHECKOUT to pt-br
    // TITLE_RESET:                        "Do you really wish to reset?",
    // TODO: localize TITLE_RESET to pt-br
    // DIALOG_RESET_HARD:                  "You will lose all changes after this commit!",
    // TODO: localize DIALOG_RESET_HARD to pt-br
    // DIALOG_RESET_MIXED:                 "Changes after this commit will be unstaged.",
    // TODO: localize DIALOG_RESET_MIXED to pt-br
    // DIALOG_RESET_SOFT:                  "Changes after this commit will be staged for a new commmit.",
    // TODO: localize DIALOG_RESET_SOFT to pt-br
    // DIFF:                               "Diff",
    DIFF:                                  "Diff",
    // DIFF_FAILED_SEE_FILES:              "Git diff failed to provide diff results. This is the list of staged files to be commited:",
    // TODO: localize DIFF_FAILED_SEE_FILES to pt-br
    // ENTER_PASSWORD:                     "Enter password:",
    ENTER_PASSWORD:                        "Senha",
    // ENTER_USERNAME:                     "Enter username:",
    ENTER_USERNAME:                        "Usuário",
    // ENTER_REMOTE_GIT_URL:               "Enter Git URL of the repository you want to clone:",
    // TODO: localize ENTER_REMOTE_GIT_URL to pt-br
    // ENTER_REMOTE_NAME:                  "Enter name of the new remote:",
    // TODO: localize ENTER_REMOTE_NAME to pt-br
    // ENTER_GITFTP_SCOPE_NAME:            "Enter name of the new Git-FTP remote:",
    // TODO: localize ENTER_GITFTP_SCOPE_NAME to pt-br
    // ENTER_REMOTE_URL:                   "Enter URL of the new remote:",
    // TODO: localize ENTER_REMOTE_URL to pt-br
    // ENTER_GITFTP_SCOPE_URL:             "Enter FTP URL of the new Git-FTP remote specifing username and password:",
    // TODO: localize ENTER_GITFTP_SCOPE_URL to pt-br
    // ERROR_TERMINAL_NOT_FOUND:           "Terminal was not found for your OS, you can define a custom Terminal command in the settings",
    ERROR_TERMINAL_NOT_FOUND:              "Terminal was not found for your OS, you can define a custom Terminal command in the settings",
    // ERROR_CONNECT_NODEJS:               "Failed to connect to NodeJS. If you just updated the extension close all instances of Brackets and try starting again.",
    // TODO: localize ERROR_CONNECT_NODEJS to pt-br
    // EXTENDED_COMMIT_MESSAGE:            "EXTENDED",
    // TODO: localize EXTENDED_COMMIT_MESSAGE to pt-br
    // EXTENSION_WAS_UPDATED_TITLE:        "The extension was updated to {0}",
    EXTENSION_WAS_UPDATED_TITLE:           "A extensão foi atualizada para {0}",
    // ENTER_NEW_USER_NAME:                "Enter username",
    // TODO: localize ENTER_NEW_USER_NAME to pt-br
    // ENTER_NEW_USER_EMAIL:               "Enter email",
    // TODO: localize ENTER_NEW_USER_EMAIL to pt-br
    // ENABLE_ADVANCED_FEATURES:           "Enable advanced features",
    // TODO: localize ENABLE_ADVANCED_FEATURES to pt-br
    // FEATURES:                           "Features",
    FEATURES:                              "Recursos",
    // FILE_STAGED:                        "Staged",
    FILE_STAGED:                           "Staged",
    // FILE_UNMODIFIED:                    "Unmodified",
    // TODO: localize FILE_UNMODIFIED to pt-br
    // FILE_IGNORED:                       "Ignored",
    // TODO: localize FILE_IGNORED to pt-br
    // FILE_UNTRACKED:                     "Untracked",
    FILE_UNTRACKED:                        "Untracked",
    // FILE_MODIFIED:                      "Modified",
    FILE_MODIFIED:                         "Modificado",
    // FILE_ADDED:                         "New file",
    FILE_ADDED:                            "Adicionado",
    // FILE_DELETED:                       "Deleted",
    FILE_DELETED:                          "Exluído",
    // FILE_RENAMED:                       "Renamed",
    FILE_RENAMED:                          "Renomeado",
    // FILE_COPIED:                        "Copied",
    // TODO: localize FILE_COPIED to pt-br
    // FILE_UNMERGED:                      "Unmerged",
    // TODO: localize FILE_UNMERGED to pt-br
    // FOR_MAC_LINUX_USERS:                "For Mac/Linux users",
    FOR_MAC_LINUX_USERS:                   "Para usuários de Mac/Linux",
    // FOR_WINDOWS_USERS:                  "For Windows users",
    FOR_WINDOWS_USERS:                     "Para usuários de Windows",
    // GIT_COMMIT:                         "Git commit\u2026",
    GIT_COMMIT:                            "Git commit\u2026",
    // GIT_CONFIGURATION:                  "Git configuration",
    // TODO: localize GIT_CONFIGURATION to pt-br
    // GIT_DIFF:                           "Git diff &mdash;",
    GIT_DIFF:                              "Git diff &mdash;",
    // GIT_IS_IN_PATH:                     "Git can be called from anywhere (is in system path, might not work on Mac)",
    GIT_IS_IN_PATH:                        "O Git pode ser usado de qualquer lugar (está no caminho do sistema, pode não funcionar no Mac)",
    // GIT_PULL_RESPONSE:                  "Git Pull response",
    GIT_PULL_RESPONSE:                     "Resposta do Git Pull",
    // GIT_PUSH_RESPONSE:                  "Git Push response",
    GIT_PUSH_RESPONSE:                     "Resposta do Git Push",
    // GITFTP_PUSH_RESPONSE:               "Git-FTP Push response",
    // TODO: localize GITFTP_PUSH_RESPONSE to pt-br
    // GIT_SETTINGS:                       "Git Settings\u2026",
    GIT_SETTINGS:                          "Configurações do Git\u2026",
    // GIT_REMOTES:                        "Git remotes",
    // TODO: localize GIT_REMOTES to pt-br
    // GITFTP_SCOPES:                      "Git-FTP remotes",
    // TODO: localize GITFTP_SCOPES to pt-br
    // GOTO_PREVIOUS_GIT_CHANGE:           "Go to previous Git change",
    // TODO: localize GOTO_PREVIOUS_GIT_CHANGE to pt-br
    // GOTO_NEXT_GIT_CHANGE:               "Go to next Git change",
    // TODO: localize GOTO_NEXT_GIT_CHANGE to pt-br
    // HIDE_UNTRACKED:                     "Hide untracked",
    // TODO: localize HIDE_UNTRACKED to pt-br
    // INIT_GITFTP_SCOPE:                  "Initialize Git-FTP remote",
    // TODO: localize INIT_GITFTP_SCOPE to pt-br
    // INIT_GITFTP_SCOPE_NAME:             "Initialize Git-FTP remote \"{0}\"?",
    // TODO: localize INIT_GITFTP_SCOPE_NAME to pt-br
    // LAUNCH_BASH_SHORTCUT:               "Bash/Terminal shortcut",
    // TODO: localize LAUNCH_BASH_SHORTCUT to pt-br
    // LOADING:                            "Loading\u2026",
    LOADING:                               "Carregando\u2026",
    // LINES:                              "Lines",
    // TODO: localize LINES to pt-br
    // _LINES:                             "lines",
    // TODO: localize _LINES to pt-br
    // LIST_MODIFIED_FILES:                "Modified files",
    LIST_MODIFIED_FILES:                   "Lista de arquivos modificados",
    // MARK_MODIFIED_FILES_IN_TREE:        "Mark modified files in file tree",
    MARK_MODIFIED_FILES_IN_TREE:           "Marcar arquivos modificados na árvore de arquivos",
    // MERGE_BRANCH:                       "Merge branch",
    // TODO: localize MERGE_BRANCH to pt-br
    // MERGE_RESULT:                       "Merge result",
    // TODO: localize MERGE_RESULT to pt-br
    // MERGE_MESSAGE:                      "Merge message",
    // TODO: localize MERGE_MESSAGE to pt-br
    // NORMALIZE_LINE_ENDINGS:             "Normalize line endings (to \\n)",
    // TODO: localize NORMALIZE_LINE_ENDINGS to pt-br
    // NOTHING_TO_COMMIT:                  "Nothing to commit, working directory clean.",
    NOTHING_TO_COMMIT:                     "Nada para fazer commit, diretório de trabalho limpo.",
    // ORIGIN_BRANCH:                      "Origin branch",
    // TODO: localize ORIGIN_BRANCH to pt-br
    // PANEL_COMMAND:                      "Show Git panel",
    PANEL_COMMAND:                         "Git",
    // PANEL_SHORTCUT:                     "Toggle panel",
    PANEL_SHORTCUT:                        "Toggle panel",
    // PASSWORDS:                          "Passwords",
    PASSWORDS:                             "Senhas",
    // PATH_TO_GIT_EXECUTABLE:             "Path to Git executable",
    PATH_TO_GIT_EXECUTABLE:                "Caminho para executável do Git",
    // PATH_TO_GIT_MSYSGIT:                "Path to msysgit folder",
    PATH_TO_GIT_MSYSGIT:                   "Caminho para pasta do msysgit",
    // PULL_SHORTCUT:                      "Pull from remote repository",
    // TODO: localize PULL_SHORTCUT to pt-br
    // PUSH_SHORTCUT:                      "Push to remote repository",
    // TODO: localize PUSH_SHORTCUT to pt-br
    // Q_DELETE_FILE:                      "Are you sure you wish to delete the file <span class='dialog-filename'>{0}</span>?",
    Q_DELETE_FILE:                         "Tem certeza de que deseja excluir o arquivo <span class='dialog-filename'>{0}</span>?",
    // Q_RESTART_BRACKETS:                 "Do you wish to restart Brackets to apply new settings?",
    Q_RESTART_BRACKETS:                    "Deseja reiniciar o Brackets para aplicar as novas configurações?",
    // Q_UNDO_CHANGES:                     "Reset changes to file <span class='dialog-filename'>{0}</span>?",
    Q_UNDO_CHANGES:                        "Redefinir alterações ao arquivo <span class='dialog-filename'>{0}</span>?",
    // REMOVE_BOM:                         "Remove BOM from files",
    // TODO: localize REMOVE_BOM to pt-br
    // REMOVE_FROM_GITIGNORE:              "Remove from .gitignore",
    REMOVE_FROM_GITIGNORE:                 "Remover do .gitignore",
    // RESTART:                            "Restart",
    RESTART:                               "Reiniciar",
    // RESET_LOCAL_REPO:                   "Discard all changes since last commit",
    // TODO: localize RESET_LOCAL_REPO to pt-br
    // RESET_LOCAL_REPO_CONFIRM:           "Do you wish to discard all changes done since last commit? This action can't be reverted.",
    // TODO: localize RESET_LOCAL_REPO_CONFIRM to pt-br
    // SAVE_PASSWORD_QUESTION:             "Save username/password?",
    SAVE_PASSWORD_QUESTION:                "Salvar usuário/senha?",
    // SET_ORIGIN_URL:                     "Set origin URL",
    SET_ORIGIN_URL:                        "Definir URL da origem",
    // SHORTCUTS:                          "Shortcuts",
    // TODO: localize SHORTCUTS to pt-br
    // SHORTCUTS_HINT:                     "Separate keys with dash, like this: Ctrl-Alt-G<br>You can use the english key identifiers Ctrl, Cmd (Mac), Alt and Shift.",
    // TODO: localize SHORTCUTS_HINT to pt-br
    // SHOW_BASH_TERMINAL_BUTTON:          "Show Bash/Terminal button in the panel",
    // TODO: localize SHOW_BASH_TERMINAL_BUTTON to pt-br
    // SHOWN_DATE_FORMAT:                  "Format of commit dates in history",
    // TODO: localize SHOWN_DATE_FORMAT to pt-br
    // SHOW_REPORT_BUG_BUTTON:             "Show Report Bug button in the panel",
    // TODO: localize SHOW_REPORT_BUG_BUTTON to pt-br
    // SHOW_UNTRACKED:                     "Show untracked",
    // TODO: localize SHOW_UNTRACKED to pt-br
    // STRIP_WHITESPACE_FROM_COMMITS:      "Strip trailing whitespace from commits",
    STRIP_WHITESPACE_FROM_COMMITS:         "Remover espaços em branco extras dos commits",
    // TARGET_BRANCH:                      "Target branch",
    // TODO: localize TARGET_BRANCH to pt-br
    // TOOLTIP_BUG:                        "Report bug",
    TOOLTIP_BUG:                           "Relatar erro",
    // TOOLTIP_OPEN_BASH:                  "Open Bash/Terminal console",
    TOOLTIP_OPEN_BASH:                     "Abrir console de comandos",
    // TOOLTIP_PULL:                       "Git Pull",
    TOOLTIP_PULL:                          "Git Pull",
    // TOOLTIP_PUSH:                       "Git Push",
    TOOLTIP_PUSH:                          "Git Push",
    // TOOLTIP_GITPUSH:                    "Git-FTP Push",
    // TODO: localize TOOLTIP_GITPUSH to pt-br
    // TOOLTIP_CLOSE_NOT_MODIFIED:         "Close files not modified in Git",
    TOOLTIP_CLOSE_NOT_MODIFIED:            "Fechar não modificados",
    // TOOLTIP_INIT:                       "Initialize repository",
    TOOLTIP_INIT:                          "Inicializar repositório",
    // TOOLTIP_CHECKOUT_COMMIT:            "Checkout a specific commit",
    // TODO: localize TOOLTIP_CHECKOUT_COMMIT to pt-br
    // TOOLTIP_CLONE:                      "Clone existing repository",
    // TODO: localize TOOLTIP_CLONE to pt-br
    // TOOLTIP_COMMIT:                     "Commit the selected files",
    TOOLTIP_COMMIT:                        "Fazer Commit dos arquivos selecionados",
    // TOOLTIP_REFRESH_PANEL:              "Refresh panel",
    TOOLTIP_REFRESH_PANEL:                 "Recarregar painel",
    // TOOLTIP_HIDE_HISTORY:               "Hide history",
    // TODO: localize TOOLTIP_HIDE_HISTORY to pt-br
    // TOOLTIP_SHOW_HISTORY:               "Show history",
    // TODO: localize TOOLTIP_SHOW_HISTORY to pt-br
    // TOOLTIP_HIDE_FILE_HISTORY:          "Hide file history",
    // TODO: localize TOOLTIP_HIDE_FILE_HISTORY to pt-br
    // TOOLTIP_SHOW_FILE_HISTORY:          "Show file history",
    // TODO: localize TOOLTIP_SHOW_FILE_HISTORY to pt-br
    // TOOLTIP_PICK_REMOTE:                "Pick preferred remote",
    // TODO: localize TOOLTIP_PICK_REMOTE to pt-br
    // TOOLTIP_MORE:                       "More actions\u2026",
    // TODO: localize TOOLTIP_MORE to pt-br
    // USER_ABORTED:                       "User aborted!",
    // TODO: localize USER_ABORTED to pt-br
    // UNDO_CHANGES:                       "Discard changes",
    UNDO_CHANGES:                          "Desfazer alterações",
    // UNDO_LAST_LOCAL_COMMIT:             "Undo last local (not pushed) commit",
    // TODO: localize UNDO_LAST_LOCAL_COMMIT to pt-br
    // URL:                                "URL",
    URL:                                   "URL",
    // USE_CODE_INSPECTION:                "Use Code inspection",
    USE_CODE_INSPECTION:                   "Usar inspetor de código",
    // USE_GIT_GUTTER:                     "Use Git gutter marks",
    USE_GIT_GUTTER:                        "Usar marcas do Git na margem",
    // USER_DATE_FORMAT:                   "Own date format (<a href='http://momentjs.com/docs/#/displaying/format/'>Syntax</a>)",
    // TODO: localize USER_DATE_FORMAT to pt-br
    // USE_GITFTP:                         "Use Git-FTP",
    // TODO: localize USE_GITFTP to pt-br
    // USING_GIT_VERSION:                  "Git version",
    USING_GIT_VERSION:                     "Versão do Git"
    // VIEW_AUTHORS_SELECTION:             "View authors of selection",
    // TODO: localize VIEW_AUTHORS_SELECTION to pt-br
    // VIEW_AUTHORS_FILE:                  "View authors of file"
    // TODO: localize VIEW_AUTHORS_FILE to pt-br
});
