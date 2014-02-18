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
        $dialog,
        preferences;

    function setValues(values) {
        $("*[settingsProperty]", $dialog).each(function () {
            var $this = $(this),
                type = $this.attr("type"),
                property = $this.attr("settingsProperty");
            if (type === "checkbox") {
                $this.prop("checked", values[property]);
            } else {
                $this.val(values[property]);
            }
        });
        $("#git-settings-gitPath", $dialog).prop("disabled", values.gitIsInSystemPath);
        $("#git-settings-msysgitPath", $dialog).prop("disabled", brackets.platform !== "win");
        $("#git-settings-terminalCommand", $dialog).prop("disabled", brackets.platform === "win");
    }

    function collectValues(preferences) {
        $("*[settingsProperty]", $dialog).each(function () {
            var $this = $(this),
                type = $this.attr("type"),
                property = $this.attr("settingsProperty");
            if (type === "checkbox") {
                preferences.setValue(property, $this.prop("checked"));
            } else {
                preferences.setValue(property, $this.val().trim() || null);
            }
        });

        // We need trailing slash for folders.
        var msysgitPath = preferences.getValue("msysgitPath");
        if (msysgitPath[msysgitPath.length - 1] !== "\\") {
            preferences.setValue("msysgitPath", msysgitPath + "\\");
        }
    }

    function assignActions() {
        $("#git-settings-gitIsInSystemPath", $dialog).on("click", function () {
            $("#git-settings-gitPath", $dialog).prop("disabled", $(this).is(":checked"));
        });
        $("#git-settings-stripWhitespaceFromCommits", $dialog).on("change", function () {
            var on = $(this).is(":checked");
            $("#git-settings-addEndlineToTheEndOfFile", $dialog)
                .prop("checked", on)
                .prop("disabled", !on);
        });
        $("button[data-button-id='defaults']", $dialog).on("click", function (e) {
            e.stopPropagation();
            setValues(DefaultPreferences);
        });
        $("button[data-button-id='changelog']", $dialog).on("click", function (e) {
            e.stopPropagation();
            ChangelogDialog.show(preferences);
        });
    }

    function init() {
        setValues(preferences.getAllValues());
        assignActions();
        $(".windows-only", $dialog).toggle(brackets.platform === "win");
        $(".non-windows-only", $dialog).toggle(brackets.platform !== "win");
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
        $dialog = dialog.getElement();
        preferences = prefs;

        init();

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                // Save everything to preferences
                collectValues(preferences);
                // Restart brackets to reload changes.
                showRestartDialog();
            }
        });
    };
});
