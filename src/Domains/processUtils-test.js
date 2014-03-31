var ProcessUtils = require("./ProcessUtils");

var pid = 5064;

ProcessUtils.getChildrenOfPid(pid, function (err, children) {
    console.log(children);
    /*
	children.push(pid);
    children.forEach(function (pid) {
        ProcessUtils.killSingleProcess(pid);
    });
    */
});
