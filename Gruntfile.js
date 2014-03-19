module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        jshint: {
            files: ["*.js", "src/**/*.js", "nls/**/*.js"],
            options: {
                jshintrc: true
            }
        },
        lesslint: {
            src: ["less/**/*.less"]
        }
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-lesslint");
    grunt.registerTask("default", ["jshint"]);
    grunt.registerTask("lesslint", ["lesslint"]);
};
