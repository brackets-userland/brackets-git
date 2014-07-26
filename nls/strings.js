/*
 *  @see: https://github.com/adobe/brackets/tree/master/src/extensions/samples/LocalizationExample
 */
define(function (require, exports, module) {
    // Code that needs to display user strings should call require("strings") to load
    // strings.js. This file will dynamically load strings.js for the specified by bracketes.locale.
    //
    // Translations for other locales should be placed in nls/<locale<optional country code>>/strings.js
    // Localization is provided via the i18n plugin.
    // All other bundles for languages need to add a prefix to the exports below so i18n can find them.
    module.exports = {
        root: true,
        "en-gb": true,
        "de": true,
        "pt-br": true,
        "zh-cn": true,
        "it": true,
        "fr": true
    };

});
