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
        $("#git-settings-stripWhitespaceFromCommits").prop("checked", values.stripWhitespaceFromCommits);
        $("#git-settings-addEndlineToTheEndOfFile").prop("checked", values.addEndlineToTheEndOfFile);
        $("#git-settings-useGitGutter").prop("checked", values.useGitGutter);
        // shortcuts
        $("#git-settings-panelShortcut").val(values.panelShortcut);
        $("#git-settings-commitCurrent").val(values.commitCurrentShortcut);
        $("#git-settings-commitAll").val(values.commitAllShortcut);
        // basic
        $("#git-settings-gitIsInSystemPath").prop("checked", values.gitIsInSystemPath);
        $("#git-settings-gitPath")
            .val(values.gitPath)
            .prop("disabled", values.gitIsInSystemPath);
        $("#git-settings-msysgitPath")
            .val(values.msysgitPath)
            .prop("disabled", brackets.platform !== "win");
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

        if (brackets.platform !== "win") {
            $(".windows_only").hide();
        }
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
                preferences.setValue("stripWhitespaceFromCommits", $("#git-settings-stripWhitespaceFromCommits", $dialog).prop("checked"));
                preferences.setValue("addEndlineToTheEndOfFile", $("#git-settings-addEndlineToTheEndOfFile", $dialog).prop("checked"));
                preferences.setValue("useGitGutter", $("#git-settings-useGitGutter", $dialog).prop("checked"));
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
                // Restart brackets to reload changes.
                showRestartDialog();
            }
        });
    };
});
