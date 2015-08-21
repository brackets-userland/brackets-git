import * as NodeConnector from './node-connector';

export function spawn(opts) {
  return NodeConnector.call('cli-domain', 'spawn', opts);
}

export function execute(opts) {
  return NodeConnector.call('cli-domain', 'execute', opts);
}
