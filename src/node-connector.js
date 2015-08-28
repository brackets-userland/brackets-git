import Promise from 'bluebird';
import { ExtensionUtils, NodeConnection } from './brackets';
import { toError } from './error-handler';
import { debug } from './log';

const moduleDirectory = ExtensionUtils.getModulePath(module);
const domainsFolder = moduleDirectory + 'node/';
const nodeConnection = new NodeConnection();
let connectNodePromise;
const connectDomainCache = {};

function connectNode() {

  // cache to connectNodePromise

  return new Promise(function (resolve, reject) {
    if (nodeConnection.connected()) {
      return resolve();
    }
    debug(`estabilishing node connection...`);
    // false means we don't want automatic reconnections to node
    nodeConnection.connect(false)
      .done(() => {
        debug(`node connection ready`);
        resolve();
      })
      .fail(err => reject(toError(err)));
  });
}

function connectDomain(domainName) {

  // if we're already trying to connect this domain, do not open another connection
  if (connectDomainCache[domainName]) {
    return connectDomainCache[domainName];
  }

  connectDomainCache[domainName] = new Promise(function (resolve, reject) {
    // TODO: check if domain is not already loaded!
    debug(`loading node domain '${domainName}'...`);
    nodeConnection.loadDomains([domainsFolder + domainName], false)
      .done(() => {
        debug(`domain '${domainName}' has been loaded successfully`);
        resolve();
      })
      .fail(err => reject(toError(err)));
  });

  // after the connection is resolved, stop keeping the promise in cache, in case of disconnects
  connectDomainCache[domainName]
    .finally(() => connectDomainCache[domainName] = null);

  return connectDomainCache[domainName];
}

const babelPromise = connectDomain('babel-domain');

export async function call(domainName, methodName, opts) {

  await babelPromise;
  await connectDomain(domainName);

  let defer = Promise.defer();

  nodeConnection.domains[domainName][methodName](opts)
    .progress(msg => defer.progress(msg))
    .done(res => defer.resolve(res))
    .fail(err => defer.reject(err));

  return defer.promise;
}
