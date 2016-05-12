/* eslint no-var:0, prefer-arrow-callback:0 */
/* global define */

define(function (require, exports, module) {

  // launch compiled js code
  require(window._babelPolyfill ? [] : ['core-js-shim', 'regenerator-runtime'], function () {
    window._babelPolyfill = true;
    require(['dist/main']);
  });

});
