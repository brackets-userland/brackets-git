/* eslint no-sync: 0, no-var: 0, object-shorthand: 0 */

var babel = require('gulp-babel');
var eslint = require('gulp-eslint');
var fs = require('fs-extra');
var gulp = require('gulp');
var gutil = require('gulp-util');
var path = require('path');
var rimraf = require('rimraf');
var sourcemaps = require('gulp-sourcemaps');
var through = require('through2');
var watch = require('gulp-watch');

var MAIN_FILES = './*.js';
var SRC_FILES = './src/**/*.js';
var DIST_DIR = './dist/';

// options for transpiling es6 to es5
var babelOptions = {
  modules: 'brackets-babel-module-formatter',
  optional: ['es7.classProperties']
};

// we need to check OS here because Linux doesn't have CEF with generators
// generators are available in Brackets' shell and also break sourcemaps
// node.js process bundled with brackets doesn't have generators so always false, for now
var hasNativeGenerators = false; // process.platform === 'darwin' || process.platform === 'win32';
if (hasNativeGenerators) {
  babelOptions.optional.push('bluebirdCoroutines');
  babelOptions.blacklist = ['regenerator'];
} else {
  babelOptions.optional.push('es7.asyncFunctions');
}

// provides pipe to log stuff to console when certain task finishes
function logPipe(str) {
  return through.obj(function (file, enc, cb) {
    cb();
  }, function (cb) {
    gutil.log(str);
    cb();
  });
}

// prevents watch from crashing on errors
function swallowError(error) {
  gutil.log(gutil.colors.red(error.toString()));
  this.emit('end');
}

// helper for transpiling es6 files to es5
function doBabel(globs, singleFile) {
  if (singleFile) {
    gutil.log(gutil.colors.cyan('Start Babel ' + globs[0]));
  }

  var task = gulp.src(globs, {base: 'src'})
    .pipe(sourcemaps.init())
    .pipe(babel(babelOptions))
    .on('error', swallowError)
    .pipe(sourcemaps.write('.', {
      sourceMappingURLPrefix: function (file) {
        var retVal = 'file:///' + file.cwd.replace(/\\/g, '/') + '/dist';
        var pathRelative = path.relative(file.base, file.path).replace(/\\/g, '/');

        if (pathRelative.indexOf('/') === -1) {
          retVal += '/';
        }

        return retVal;
      }
    }))
    .pipe(gulp.dest(DIST_DIR));

  return singleFile ?
    task.pipe(logPipe(gutil.colors.cyan('Finish Babel ' + globs[0]))) :
    task;
}

// helper for linting files
function doEslint(globs, singleFile) {
  if (singleFile) {
    gutil.log(gutil.colors.magenta('Start ESLint ' + globs[0]));
  }

  var task = gulp.src(globs)
    .pipe(eslint())
    .pipe(eslint.format());

  return singleFile ?
    task.pipe(logPipe(gutil.colors.magenta('Finish ESLint ' + globs[0]))) :
    task.pipe(eslint.failAfterError());
}

gulp.task('clean', function (cb) {
  rimraf(DIST_DIR, function (err1) {
    fs.ensureDir(DIST_DIR, function (err2) {
      cb(err1 || err2);
    });
  });
});

gulp.task('babel', ['clean'], function () {
  return doBabel([SRC_FILES], false);
});

gulp.task('eslint', function () {
  return doEslint([MAIN_FILES, SRC_FILES], false);
});

gulp.task('watch', function () {
  watch(SRC_FILES, function (file) {
    var filePath = path.relative(__dirname, file.path);
    if (fs.statSync(filePath).isFile()) {
      doEslint([filePath], true);
      doBabel([filePath], true);
    }
  });
});

gulp.task('build', ['babel']);
gulp.task('test', ['eslint']);
gulp.task('dev', ['build', 'watch']);
gulp.task('default', ['build', 'test']);
