define(function (require, exports, module) {
    "use strict";

    var EventEmitter2 = require("../thirdparty/eventemitter2");
    module.exports = new EventEmitter2({
        wildcard: false,
        newListener: false,
    });

});
