define(function (require, exports) {
    "use strict";

    // Brackets modules
    var _                       = brackets.getModule("thirdparty/lodash"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        Mustache                = brackets.getModule("thirdparty/mustache/mustache"),
        Preferences             = require("./Preferences"),
        ChangelogDialog         = require("../src/ChangelogDialog"),
        Strings                 = require("../strings"),
        Git                     = require("./git/Git"),
        settingsDialogTemplate  = require("text!templates/git-settings-dialog.html");

    var dialog,
        $dialog;

    function setValues(values) {
        $("*[settingsProperty]", $dialog).each(function () {
            var $this = $(this),
                type = $this.attr("type"),
                tag = $this.prop("tagName").toLowerCase(),
                property = $this.attr("settingsProperty");
            if (type === "checkbox") {
                $this.prop("checked", values[property]);
            } else if (tag === "select") {
                $("option[value=" + values[property] + "]", $this).prop("selected", true);
            } else {
                $this.val(values[property]);
            }
        });
        $("#git-settings-dateFormat-container", $dialog).toggle(values.dateMode === 3);
    }

    function collectValues() {
        $("*[settingsProperty]", $dialog).each(function () {
            var $this = $(this),
                type = $this.attr("type"),
                property = $this.attr("settingsProperty"),
                prefType = Preferences.getType(property);
            if (type === "checkbox") {
                Preferences.set(property, $this.prop("checked"));
            } else if (prefType === "number") {
                var newValue = parseInt($this.val().trim(), 10);
                if (isNaN(newValue)) { newValue = Preferences.getDefaults()[property]; }
                Preferences.set(property, newValue);
            } else {
                Preferences.set(property, $this.val().trim() || null);
            }
        });
        Preferences.save();
    }

    function assignActions() {
        var $useDifftoolCheckbox = $("#git-settings-useDifftool", $dialog);

        Git.getConfig("diff.tool").then(function (diffToolConfiguration) {

            if (!diffToolConfiguration) {
                $useDifftoolCheckbox.prop({
                    checked: false,
                    disabled: true
                });
            } else {
                $useDifftoolCheckbox.prop({
                    disabled: false
                });
            }

        }).catch(function () {

            // an error with git
            // we were not able to check whether diff tool is configured or not
            // so we disable it just to be sure
            $useDifftoolCheckbox.prop({
                checked: false,
                disabled: true
            });

        });

        $("#git-settings-stripWhitespaceFromCommits", $dialog).on("change", function () {
            var on = $(this).is(":checked");
            $("#git-settings-addEndlineToTheEndOfFile,#git-settings-removeByteOrderMark,#git-settings-normalizeLineEndings", $dialog)
                .prop("checked", on)
                .prop("disabled", !on);
        });

        $("#git-settings-dateMode", $dialog).on("change", function () {
            $("#git-settings-dateFormat-container", $dialog).toggle($("option:selected", this).prop("value") === "3");
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
        var questionDialogTemplate = require("text!templates/git-question-dialog.html");
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
