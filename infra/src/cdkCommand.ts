import { awsReader, getBackendImage } from './getBackendImage';
import { getDeploymentId } from './getDeploymentId';

type ReadAws = ReturnType<typeof awsReader>;

/** Resolve before starting CDK, so the value reaches CreateChangeSet, not only synthesis. */
export function prepareCdkCommand(args: string[], read: ReadAws): { args: string[]; account?: string } {
  const command = args[0];
  if (!['diff', 'deploy'].includes(command) || args.includes('--help') || args.includes('-h')) {
    return { args };
  }
  // Keep first adoption review deterministic; no template-only fallback or alternate assembly.
  if (args.some(arg => /^(--app|-a|--template|--method|-m|--change-set|--changeset|--no-change-set|--no-changeset|--hotswap|--watch)(=|$)/.test(arg))) {
    throw new Error('Use the source app and change-set workflow; app/template/method/change-set/hotswap/watch overrides are unsupported');
  }
  if (args.some(arg => /(?:^|:)BackendImageId(?:=|$)/.test(arg))) {
    throw new Error('BackendImageId is managed automatically; do not pass an AMI override');
  }
  const stackName = `camera-path-${getDeploymentId()}`;
  const account = read('sts', 'get-caller-identity', []).Account;
  const image = getBackendImage(stackName, account, read);
  console.error(`Backend AMI: ${image}; stack: ${stackName}; account: ${account}`);
  return { account, args: [...args, ...(command === 'diff' ? ['--method=change-set'] : []),
    '--parameters', `${stackName}:BackendImageId=${image}`] };
}

export function cliProfile(args: string[]): string | undefined {
  const index = args.findIndex(arg => arg === '--profile' || arg.startsWith('--profile='));
  if (index < 0) return undefined;
  const value = args[index].startsWith('--profile=') ? args[index].slice('--profile='.length) : args[index + 1];
  if (!value || value.startsWith('-')) throw new Error('--profile requires a value');
  return value;
}
