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
                        "define": true,
                        "Mustache": true
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
        compress: {
            main: {
                options: {
                    archive: "brackets-git.zip"
                },
                files: [
                    {src: ["nls/**"], dest: "/" },
                    {src: ["shell/**"], dest: "/" },
                    {src: ["src/**"], dest: "/" },
                    {src: ["styles/**"], dest: "/" },
                    {src: ["templates/**"], dest: "/" },
                    {src: ["thirdparty/**"], dest: "/" },
                    {src: ["LICENSE", "*.js", "*.json", "*.md"], dest: "/", filter: "isFile"}
                ]
            }
        }
    });

    grunt.loadNpmTasks("grunt-jslint");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-lesslint");
    grunt.loadNpmTasks("grunt-jscs-checker");
    grunt.loadNpmTasks("grunt-contrib-compress");

    grunt.registerTask("jslint-test", ["jslint"]);
    grunt.registerTask("jshint-test", ["jshint"]);
    grunt.registerTask("less-test", ["lesslint"]);
    grunt.registerTask("test", ["jshint", "jscs"]); // for Travis

};
