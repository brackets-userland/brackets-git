/* eslint-env node */

const _ = require("lodash");
const exec = require("child_process").exec;
const glob = require("glob");
const path = require("path");

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        jslint: {
            all: {
                src: ["*.js", "src/**/*.js", "nls/**/*.js"],
                directives: {
                    "node": true,
                    "nomen": true,
                    "regexp": true,
                    "sloppy": true,
                    "todo": true,
                    "vars": true,
                    "unparam": true,
                    "globals": {
                        "$": true,
                        "document": true,
                        "brackets": true,
                        "define": true
                    }
                }
            }
        },
        jshint: {
            files: ["*.js", "src/**/*.js", "nls/**/*.js"],
            options: {
                jshintrc: true
            }
        },
        lesslint: {
            src: ["styles/**/*.less"],
            options: {
                csslint: {
                    "ids": false,
                    "important": false,
                    "known-properties": false
                }
            }
        },
        jscs: {
            src: ["*.js", "src/**/*.js", "nls/**/*.js"],
            options: {
                config: ".jscs.json"
            }
        },
        zip: {
            main: {
                dest: "brackets-git.zip",
                src: [
                    "nls/**",
                    "node_modules/**",
                    "shell/**",
                    "src/**",
                    "styles/**",
                    "templates/**",
                    "thirdparty/**",
                    "LICENSE", "*.js", "*.json", "*.md"
                ]
            }
        },
        lineending: {
            dist: {
                options: {
                    eol: "lf",
                    overwrite: true
                },
                files: {
                    "": [
                        "main.js",
                        "strings.js",
                        "Gruntfile.js",
                        "nls/**/*.js",
                        "shell/**/*.*",
                        "src/**/*.js",
                        "styles/**/*.less",
                        "templates/**/*.html",
                        "thirdparty/**/*.js"
                    ]
                }
            }
        }
    });

    function runNpmInstall(where, callback) {
        grunt.log.writeln("running npm install in " + where);
        exec("npm install", { cwd: "./" + where }, (err, stdout, stderr) => {
            if (err) {
                grunt.log.error(stderr);
            } else {
                if (stdout) { grunt.log.writeln(stdout); }
                grunt.log.writeln("finished npm install in " + where);
            }
            return err ? callback(stderr) : callback(null, stdout);
        });
    }

    grunt.registerTask("npm-install-subfolders", "install node_modules in src subfolders", function () {
        const doneWithTask = this.async();
        const globs = ["src/**/package.json"];
        const doneWithGlob = _.after(globs.length, doneWithTask);
        globs.forEach(g => {
            glob(g, (globErr, _files) => {
                if (globErr) {
                    grunt.log.error(globErr);
                    return doneWithTask(false);
                }
                const files = _files.filter((p) => p.indexOf("node_modules") === -1);
                const doneWithFile = _.after(files.length, doneWithGlob);
                files.forEach((file) => {
                    runNpmInstall(path.dirname(file), (err) => {
                        return err ? doneWithTask(false) : doneWithFile();
                    });
                });
            });
        });

    });

    grunt.loadNpmTasks("grunt-jslint");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-lesslint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-zip");
    grunt.loadNpmTasks("grunt-lineending");

    grunt.registerTask("postinstall", ["npm-install-subfolders"]);
    grunt.registerTask("package", ["lineending", "zip"]);
    grunt.registerTask("jslint-test", ["jslint"]);
    grunt.registerTask("jshint-test", ["jshint"]);
    grunt.registerTask("less-test", ["lesslint"]);
    grunt.registerTask("test", ["jshint", "jscs"]); // for Travis

};
