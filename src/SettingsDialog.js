/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define, Mustache */

define(function (require, exports) {
    "use strict";

    var CommandManager             = brackets.getModule("command/CommandManager"),
        Dialogs                    = brackets.getModule("widgets/Dialogs"),
        DefaultPreferences         = require("../DefaultPreferences"),
        ChangelogDialog            = require("../src/ChangelogDialog"),
        Strings                    = require("../strings"),
        settingsDialogTemplate     = require("text!htmlContent/git-settings-dialog.html");

    var dialog,
        preferences;

    function setValues(values) {
        // features
        ["stripWhitespaceFromCommits", "addEndlineToTheEndOfFile", "useGitGutter", "markModifiedInTree"].forEach(function (name) {
            $("#git-settings-" + name).prop("checked", values[name]);
        });
        // shortcuts
        $("#git-settings-panelShortcut").val(values.panelShortcut);
        $("#git-settings-commitCurrent").val(values.commitCurrentShortcut);
        $("#git-settings-commitAll").val(values.commitAllShortcut);
        // basic
        $("#git-settings-gitIsInSystemPath").prop("checked", values.gitIsInSystemPath);
        $("#git-settings-gitPath")
            .val(values.gitPath)
            .prop("disabled", values.gitIsInSystemPath);
        // windows
        $("#git-settings-msysgitPath")
            .val(values.msysgitPath)
            .prop("disabled", brackets.platform !== "win");
        // non-windows
        $("#git-settings-terminalCommand")
            .val(values.terminalCommand)
            .prop("disabled", brackets.platform === "win");
    }

    function restorePlatformDefaults() {
        setValues(DefaultPreferences);
    }

    function assignActions() {
        $("#git-settings-gitIsInSystemPath").on("click", function () {
            $("#git-settings-gitPath").prop("disabled", $(this).is(":checked"));
        });
        $("#git-settings-stripWhitespaceFromCommits").on("change", function () {
            var on = $(this).is(":checked");
            $("#git-settings-addEndlineToTheEndOfFile").prop("checked", on);
            $("#git-settings-addEndlineToTheEndOfFile").prop("disabled", !on);
        });
        $("button[data-button-id='defaults']").on("click", function (e) {
            e.stopPropagation();
            restorePlatformDefaults();
        });
        $("button[data-button-id='changelog']").on("click", function (e) {
            e.stopPropagation();
            ChangelogDialog.show(preferences);
        });
    }

    function init() {
        setValues(preferences.getAllValues());
        assignActions();
        $(".windows-only").toggle(brackets.platform === "win");
        $(".non-windows-only").toggle(brackets.platform !== "win");
    }

    function showRestartDialog() {
        var questionDialogTemplate = require("text!htmlContent/git-question-dialog.html");
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.RESTART,
            question: Strings.Q_RESTART_BRACKETS,
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                CommandManager.execute("debug.refreshWindow");
            }
        });
    }

    exports.show = function (prefs) {
        var compiledTemplate = Mustache.render(settingsDialogTemplate, Strings);

        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        preferences = prefs;

        init();

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                var $dialog = dialog.getElement();
                // features
                ["stripWhitespaceFromCommits", "addEndlineToTheEndOfFile", "useGitGutter", "markModifiedInTree"].forEach(function (name) {
                    preferences.setValue(name, $("#git-settings-" + name, $dialog).prop("checked"));
                });
                // shortcuts
                preferences.setValue("panelShortcut", $("#git-settings-panelShortcut", $dialog).val().trim());
                preferences.setValue("commitCurrentShortcut", $("#git-settings-commitCurrent", $dialog).val().trim());
                preferences.setValue("commitAllShortcut", $("#git-settings-commitAll", $dialog).val().trim());
                // basic
                preferences.setValue("gitIsInSystemPath", $("#git-settings-gitIsInSystemPath", $dialog).prop("checked"));
                preferences.setValue("gitPath", $("#git-settings-gitPath", $dialog).val());
                // We need trailing slash for folders.
                var msysgitPath = $("#git-settings-msysgitPath", $dialog).val();
                if (msysgitPath[msysgitPath.length - 1] !== "\\") {
                    msysgitPath = msysgitPath + "\\";
                }
                preferences.setValue("msysgitPath", msysgitPath);
                // Linux
                preferences.setValue("terminalCommand", $("#git-settings-terminalCommand", $dialog).val().trim());
                // Restart brackets to reload changes.
                showRestartDialog();
            }
        });
    };
});
