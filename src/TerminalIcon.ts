/* global $ */

import * as Events from "./Events";
import EventEmitter from "./EventEmitter";

$("<a id='git-toolbar-terminalicon' href='#'></a>")
    .appendTo("#main-toolbar .buttons")
    .on("click", EventEmitter.emitFactory(Events.TERMINAL_OPEN));
