var fs = require("fs");

var dirContents = fs.readdirSync(__dirname);

var langs = dirContents.reduce(function (arr, entry) {
    if (entry.indexOf(".js") !== -1) { return arr; }
    if (entry.indexOf("root") !== -1) { return arr; }
    arr.push(entry);
    return arr;
}, []);

var rootFile = fs.readFileSync("./root/strings.js").toString("utf8");

langs.forEach(function (lang) {

    var fileName = "./" + lang + "/strings.js";

    var langFile = fs.readFileSync(fileName).toString("utf8");

    var langLines = langFile.split("\n").reduce(function (arr, line) {
        if (line.match(/^\s*[a-zA-Z0-9_]+:/)) {
            arr.push(line);
        } else {
            console.log("ignored line (" + lang + "): " + line);
        }
        return arr;
    }, []);

    var langObj = langLines.reduce(function (obj, line) {
        var m = line.match(/\s*(\S+):\s*(\S.*)/);
        obj[m[1]] = m[2];
        return obj;
    }, {});

    var newLines = rootFile.split("\n").reduce(function (arr, line) {

        var m = line.match(/^(\s*)(\S+):(\s*)(\S.*)/);
        if (m) {
            var white = m[1];
            var key = m[2];
            var white2 = m[3];
            var val = m[4];
            arr.push(white + "// " + key + ":" + white2 + val);
            var newVal = langObj[key];
            if (newVal) {
                arr.push(white + key + ":" + white2 + "   " + langObj[key]);
            } else {
                arr.push(white + "// TODO: localize " + key + " to " + lang);
            }
        } else {
            arr.push(line);
        }

        return arr;

    }, []);

    fs.writeFile(fileName, newLines.join("\n"));
    console.log(lang + " done!");

});
