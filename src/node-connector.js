import { ExtensionUtils, NodeConnection } from './brackets';
import { toError } from './error-handler';
import Promise from 'bluebird';

const moduleDirectory = ExtensionUtils.getModulePath(module);
const domainsFolder = moduleDirectory + 'node/';

const connectionsPool = {};
const connectDomainCache = {};

function connectDomain(domainName) {

  // if we're already trying to connect this domain, do not open another connection
  if (connectDomainCache[domainName]) {
    return connectDomainCache[domainName];
  }

  connectDomainCache[domainName] = new Promise(function (resolve, reject) {

    let nodeConnection = connectionsPool[domainName];

    if (!nodeConnection) {
      nodeConnection = connectionsPool[domainName] = new NodeConnection();
    }

    if (nodeConnection.connected()) {
      // already connected
      return resolve(true);
    }

    // false means we don't want automatic reconnections to node
    nodeConnection.connect(false)
      .done(() => {
        nodeConnection.loadDomains([domainsFolder + domainName], false)
          .done(() => resolve(false))
          .fail(err => {
            // failed to load the domain, disconnect from node
            nodeConnection.disconnect();
            reject(toError(err));
          });
      })
      .fail(err => reject(toError(err)));

  });

  // after the connection is resolved, stop keeping the promise in cache, in case of disconnects
  connectDomainCache[domainName]
    .finally(() => connectDomainCache[domainName] = null);

  return connectDomainCache[domainName];
}

export async function call(domainName, methodName, opts) {

  await connectDomain(domainName);

  let defer = Promise.defer();

  connectionsPool[domainName].domains[domainName][methodName](opts)
    .progress(msg => defer.progress(msg))
    .done(res => defer.resolve(res))
    .fail(err => defer.reject(err));

  return defer.promise;
}
