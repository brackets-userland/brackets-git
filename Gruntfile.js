module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        jshint: {
            files: ["*.js", "src/**/*.js", "nls/**/*.js"],
            options: {
                jshintrc: true
            }
        },
        lesslint: {
            src: ["less/**/*.less"],
            options: {
                csslint: {
                    "ids": false,
                    "important": false,
                    "known-properties": false
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-lesslint");
    grunt.registerTask("default", ["jshint"]);
    grunt.registerTask("less", ["lesslint"]);

};
