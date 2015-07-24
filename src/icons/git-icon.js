import Events from '../events';
import EventEmitter from '../event-emitter';
import * as Panel from '../panel';
import Strings from 'strings';

const $icon = $('<a id="git-toolbar-icon" href="#"></a>')
  .attr('title', Strings.LOADING)
  .addClass('loading')
  .appendTo($('#main-toolbar .buttons'));

EventEmitter.on(Events.GIT_WORKING, function () {
  $icon
    .removeClass('loading')
    .removeAttr('title')
    .off('click')
    .on('click', Panel.toggle);
});

EventEmitter.on(Events.GIT_NOT_WORKING, function (err) {
  $icon
    .addClass('error')
    .attr('title', Strings.CHECK_GIT_SETTINGS + ' - ' + err.toString());
});

EventEmitter.on(Events.GIT_ENABLED, function () {
  $icon
    .removeAttr('title')
    .removeClass('warning');
});

EventEmitter.on(Events.GIT_DISABLED, function (reason) {
  $icon
    .removeClass('dirty')
    .addClass('warning')
    .attr('title', reason);
});

EventEmitter.on(Events.GIT_STATUS_RESULTS, function (results) {
  $icon
    .toggleClass('dirty', results.length !== 0);
});

EventEmitter.on(Events.PANEL_TOGGLED, function (bool) {
  $icon
    .toggleClass('on', bool);
});
