/* eslint no-var:0 */

define(function (require, exports, module) {

  // launch compiled js code
  require(window._babelPolyfill ? [] : ['babel-polyfill'], function () {
    require(['dist/main']);
  });

});
