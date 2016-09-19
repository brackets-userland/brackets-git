define(function (require) {

    // Local modules
    var Events        = require("./Events"),
        EventEmitter  = require("./EventEmitter").default;

    // Icon element
    var $terminalIcon = $("<a id='git-toolbar-terminalicon' href='#'></a>").appendTo("#main-toolbar .buttons");

    // Icon event
    $terminalIcon.on("click", EventEmitter.emitFactory(Events.TERMINAL_OPEN));

});
