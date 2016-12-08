import { _, CommandManager, Dialogs, Mustache } from "./brackets-modules";
import * as Preferences from "./Preferences";
import * as ChangelogDialog from "./ChangelogDialog";
import * as Strings from "strings";
import * as Git from "./git/GitCli";

const settingsDialogTemplate = require("text!templates/git-settings-dialog.html");
const questionDialogTemplate = require("text!templates/git-question-dialog.html");

let dialog;
let $dialog;

function setValues(values) {
    $("*[settingsProperty]", $dialog).each(function () {
        const $this = $(this);
        const type = $this.attr("type");
        const tag = $this.prop("tagName").toLowerCase();
        const property = $this.attr("settingsProperty");
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
        const $this = $(this);
        const type = $this.attr("type");
        const property = $this.attr("settingsProperty");
        const prefType = Preferences.getType(property);
        if (type === "checkbox") {
            Preferences.set(property, $this.prop("checked"));
        } else if (prefType === "number") {
            let newValue = parseInt($this.val().trim(), 10);
            if (isNaN(newValue)) { newValue = Preferences.getDefaults()[property]; }
            Preferences.set(property, newValue);
        } else {
            Preferences.set(property, $this.val().trim() || null);
        }
    });
    Preferences.save();
}

function assignActions() {
    const $useDifftoolCheckbox = $("#git-settings-useDifftool", $dialog);

    Git.getConfig("diff.tool").then((diffToolConfiguration) => {

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

    }).catch(() => {

        // an error with git
        // we were not able to check whether diff tool is configured or not
        // so we disable it just to be sure
        $useDifftoolCheckbox.prop({
            checked: false,
            disabled: true
        });

    });

    $("#git-settings-stripWhitespaceFromCommits", $dialog).on("change", function () {
        const on = $(this).is(":checked");
        $(
            "#git-settings-addEndlineToTheEndOfFile," +
            "#git-settings-removeByteOrderMark," +
            "#git-settings-normalizeLineEndings",
            $dialog
        ).prop("checked", on).prop("disabled", !on);
    });

    $("#git-settings-dateMode", $dialog).on("change", function () {
        $("#git-settings-dateFormat-container", $dialog).toggle($("option:selected", this).prop("value") === "3");
    });

    $("button[data-button-id='defaults']", $dialog).on("click", (e) => {
        e.stopPropagation();
        setValues(Preferences.getDefaults());
    });

    $("button[data-button-id='changelog']", $dialog).on("click", (e) => {
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
    const compiledTemplate = Mustache.render(questionDialogTemplate, {
        title: Strings.RESTART,
        question: _.escape(Strings.Q_RESTART_BRACKETS),
        Strings
    });
    Dialogs.showModalDialogUsingTemplate(compiledTemplate).done((buttonId) => {
        if (buttonId === "ok") {
            CommandManager.execute("debug.refreshWindow");
        }
    });
}

export function show() {
    const compiledTemplate = Mustache.render(settingsDialogTemplate, Strings);

    dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
    $dialog = dialog.getElement();

    init();

    dialog.done((buttonId) => {
        if (buttonId === "ok") {
            // Save everything to preferences
            collectValues();
            // Restart brackets to reload changes.
            showRestartDialog();
        }
    });
}
