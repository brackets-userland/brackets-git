import Promise from 'bluebird';
import { ExtensionUtils, NodeConnection } from './brackets';
import { toError } from './error-handler';
import { debug } from './log';

const moduleDirectory = ExtensionUtils.getModulePath(module);
const domainsFolder = moduleDirectory + 'node/';
const nodeConnection = new NodeConnection();
let connectNodePromise;
let connectDomainPromises = {};

function isNodeConnected() {
  return nodeConnection.connected();
}

function connectNode() {

  if (isNodeConnected()) {
    return Promise.resolve();
  }

  if (connectNodePromise) {
    return connectNodePromise;
  }

  connectNodePromise = new Promise(function (resolve, reject) {

    if (nodeConnection.connected()) {
      return resolve();
    }

    debug(`[node-connector] estabilishing node connection...`);

    // false - we don't want automatic reconnections to node
    nodeConnection.connect(false)
      .done(() => {
        debug(`[node-connector] node connection ready`);
        resolve();
      })
      .fail(err => reject(toError(err)));

  }).finally(function () {
    connectNodePromise = null;
  });

  return connectNodePromise;
}

function hasNodeDomain(domainName) {
  return nodeConnection.domains[domainName] != null;
}

function connectDomain(domainName) {

  if (hasNodeDomain(domainName)) {
    return Promise.resolve();
  }

  // if we're already trying to connect this domain, do not open another connection
  if (connectDomainPromises[domainName]) {
    return connectDomainPromises[domainName];
  }

  connectDomainPromises[domainName] = new Promise(function (resolve, reject) {

    debug(`[node-connector] loading node domain '${domainName}'...`);
    nodeConnection.loadDomains([domainsFolder + domainName], false)
      .done(() => {
        debug(`[node-connector] domain '${domainName}' has been loaded successfully`);
        resolve();
      })
      .fail(err => reject(toError(err)));

  }).finally(function () {
    // after the connection is resolved, stop keeping the promise in cache, in case of disconnects
    connectDomainPromises[domainName] = null;
  });

  return connectDomainPromises[domainName];
}

export async function call(domainName, methodName, opts) {

  if (!isNodeConnected()) {
    await connectNode();
  }
  if (!hasNodeDomain(domainName)) {
    await connectDomain(domainName);
  }

  let defer = Promise.defer();

  nodeConnection.domains[domainName][methodName](opts)
    .progress(msg => defer.progress(msg))
    .done(res => defer.resolve(res))
    .fail(err => defer.reject(err));

  return defer.promise;
}
