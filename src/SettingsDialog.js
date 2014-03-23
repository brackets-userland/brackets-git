/*jslint plusplus: true, vars: true, nomen: true */
/*global $, brackets, define, Mustache */

define(function (require, exports) {
    "use strict";

    var _                       = brackets.getModule("thirdparty/lodash"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        Preferences             = require("./Preferences"),
        ChangelogDialog         = require("../src/ChangelogDialog"),
        Strings                 = require("../strings"),
        settingsDialogTemplate  = require("text!htmlContent/git-settings-dialog.html");

    var dialog,
        $dialog;

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
    }

    function collectValues() {
        $("*[settingsProperty]", $dialog).each(function () {
            var $this = $(this),
                type = $this.attr("type"),
                property = $this.attr("settingsProperty");
            if (type === "checkbox") {
                Preferences.set(property, $this.prop("checked"));
            } else {
                Preferences.set(property, $this.val().trim() || null);
            }
        });
        Preferences.save();
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
            setValues(Preferences.getDefaults());
        });
        $("button[data-button-id='changelog']", $dialog).on("click", function (e) {
            e.stopPropagation();
            ChangelogDialog.show();
        });
    }

    function init() {
        setValues(Preferences.getAll());
        assignActions();
        $("#git-settings-tabs a", $dialog).click(function (e) {
            e.preventDefault();
            $(this).tab("show");
        });
    }

    function showRestartDialog() {
        var questionDialogTemplate = require("text!htmlContent/git-question-dialog.html");
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: Strings.RESTART,
            question: _.escape(Strings.Q_RESTART_BRACKETS),
            Strings: Strings
        });
        Dialogs.showModalDialogUsingTemplate(compiledTemplate).done(function (buttonId) {
            if (buttonId === "ok") {
                CommandManager.execute("debug.refreshWindow");
            }
        });
    }

    exports.show = function () {
        var compiledTemplate = Mustache.render(settingsDialogTemplate, Strings);

        dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        $dialog = dialog.getElement();

        init();

        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                // Save everything to preferences
                collectValues();
                // Restart brackets to reload changes.
                showRestartDialog();
            }
        });
    };
});
