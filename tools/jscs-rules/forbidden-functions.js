var assert = require("assert");

module.exports = function () {};

module.exports.prototype = {

    configure: function (forbiddenFunctions) {
        assert(Array.isArray(forbiddenFunctions), "forbiddenFunctions option requires array value");
        this._forbiddenFunctions = forbiddenFunctions;
    },

    getOptionName: function () {
        return "forbiddenFunctions";
    },

    check: function (file, errors) {
        file.getLines().forEach(function (line, i) {

            this._forbiddenFunctions.forEach(function (obj) {

                if (Array.isArray(obj)) {

                    var forbidden = obj[0],
                        replacement = obj[1];
                    if (line.indexOf(forbidden) !== -1) {
                        errors.add("Do not use " + forbidden + ", use " + replacement + " instead.", i + 1);
                    }

                } else {

                    if (line.indexOf(obj) !== -1) {
                        errors.add("Do not use " + obj, i + 1);
                    }

                }

            });
        }, this);
    }

};
