import { execFileSync } from 'node:child_process';

export const UBUNTU_IMAGE_PARAMETER =
  '/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id';

type AwsRead = (service: string, operation: string, args: string[]) => any;

export function awsReader(region: string, profile?: string): AwsRead {
  return (service, operation, args) => {
    const result = execFileSync('aws', [service, operation, ...args, '--region', region,
      '--output', 'json', '--no-cli-pager', ...(profile ? ['--profile', profile] : [])], {
      encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(result);
  };
}

function imageId(value: unknown): string {
  if (typeof value !== 'string' || !/^ami-(?:[a-f0-9]{8}|[a-f0-9]{17})$/.test(value)) {
    throw new Error('Missing or invalid backend ImageId in AWS response');
  }
  return value;
}

/** Read live AWS state on every invocation; never use CDK context or write AWS resources. */
export function getBackendImage(stackName: string, account: string, read: AwsRead): string {
  try {
    if (!/^\d{12}$/.test(account) || read('sts', 'get-caller-identity', []).Account !== account) {
      throw new Error('AWS CLI account must match CDK_DEFAULT_ACCOUNT (cross-account synthesis is unsupported)');
    }
    let response;
    try {
      response = read('cloudformation', 'describe-stacks', ['--stack-name', stackName]);
    } catch (error) {
      // Only this exact service error proves absence. AccessDenied, timeouts and malformed
      // responses must not authorize selecting current for an existing environment.
      const stderr = String((error as { stderr?: unknown }).stderr ?? '').trim();
      if (stderr !== `An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id ${stackName} does not exist`) {
        throw error;
      }
      return imageId(read('ssm', 'get-parameter', ['--name', UBUNTU_IMAGE_PARAMETER]).Parameter?.Value);
    }
    const stacks = response.Stacks;
    if (!Array.isArray(stacks) || stacks.length !== 1 || stacks[0].StackName !== stackName) {
      throw new Error('Expected exactly one matching deployed stack');
    }
    const stack = stacks[0];
    if (!['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE', 'IMPORT_COMPLETE',
      'IMPORT_ROLLBACK_COMPLETE'].includes(stack.StackStatus)) {
      throw new Error(`Stack is not in a stable deployable state: ${stack.StackStatus}`);
    }
    const outputs = stack.Outputs?.filter((o: any) => o.OutputKey === 'InstanceId');
    const instanceId = outputs?.[0]?.OutputValue;
    if (outputs?.length !== 1 || typeof instanceId !== 'string' || !/^i-[a-f0-9]+$/.test(instanceId)) {
      throw new Error('Expected one InstanceId output on existing stack');
    }
    const result = read('ec2', 'describe-instances', ['--instance-ids', instanceId]);
    const instances = result.Reservations?.flatMap((r: any) => r.Instances ?? []);
    if (instances?.length !== 1 || instances[0].InstanceId !== instanceId ||
        !['running', 'stopped'].includes(instances[0].State?.Name)) {
      throw new Error('Expected the stack backend instance in running or stopped state');
    }
    const image = imageId(instances[0].ImageId);
    return image;
  } catch (error) {
    throw new Error(`Cannot safely resolve backend AMI for ${stackName}; refusing latest fallback. Check AWS identity, permissions and stack state.`, { cause: error });
  }
}
