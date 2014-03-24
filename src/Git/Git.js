define(function (require, exports, module) {

    var GitCli = require("src/Git/GitCli");

    function getRemotes() {
        return GitCli.getRemotes();
    }

    // Public API
    exports.getRemotes = getRemotes;

});
