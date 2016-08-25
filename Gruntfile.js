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

    grunt.loadNpmTasks("grunt-jslint");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-lesslint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-zip");
    grunt.loadNpmTasks("grunt-lineending");

    grunt.registerTask("package", ["lineending", "zip"]);
    grunt.registerTask("jslint-test", ["jslint"]);
    grunt.registerTask("jshint-test", ["jshint"]);
    grunt.registerTask("less-test", ["lesslint"]);
    grunt.registerTask("test", ["jshint", "jscs"]); // for Travis

};
