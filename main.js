/* eslint no-var:0 */

define(function (require, exports, module) {

  // dependencies that need to be loaded asynchronously or conditionally
  var deps = [];

  // this is required for linux, because its cef doesn't have generators
  if (brackets.platform === 'linux' && !window.regeneratorRuntime) {
    deps.push('babel-polyfill');
  }

  require(deps, function () {

    // extension entry point, require compiled es6 code
    require(['dist/main']);

  });

});
