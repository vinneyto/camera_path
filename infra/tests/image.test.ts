import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBackendImage, UBUNTU_IMAGE_PARAMETER } from '../src/getBackendImage';

const stackName = 'camera-path-test';
const account = '123456789012';
const original = 'ami-0123456789abcdef0';
const next = 'ami-0fedcba9876543210';
const instanceId = 'i-0123456789abcdef0';
function missing() {
  return Object.assign(new Error('AWS CLI exited 254'), { stderr:
    `An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id ${stackName} does not exist\n` });
}
function fixture() {
  const state: any = {
    identity: { Account: account },
    stack: { StackName: stackName, StackStatus: 'UPDATE_ROLLBACK_COMPLETE',
      Outputs: [{ OutputKey: 'InstanceId', OutputValue: instanceId }] },
    instances: { Reservations: [{ Instances: [{ InstanceId: instanceId, ImageId: original,
      State: { Name: 'running' } }] }] },
    current: { Parameter: { Value: next } }, calls: [] as string[],
  };
  const read = (service: string, operation: string, args: string[]) => {
    state.calls.push(`${service}:${operation}`);
    if (service === 'sts') return state.identity;
    if (service === 'cloudformation') {
      assert.deepEqual(args, ['--stack-name', stackName]);
      if (state.error) throw state.error;
      return { Stacks: [state.stack] };
    }
    if (service === 'ec2') {
      assert.deepEqual(args, ['--instance-ids', instanceId]);
      return state.instances;
    }
    assert.deepEqual(args, ['--name', UBUNTU_IMAGE_PARAMETER]);
    return state.current;
  };
  return { state, read };
}

test('new stack reads Ubuntu once; subsequent fresh invocation adopts live EC2 despite changed current', () => {
  const first = fixture();
  first.state.error = missing();
  first.state.current.Parameter.Value = original;
  assert.equal(getBackendImage(stackName, account, first.read), original);
  assert.equal(first.state.calls.filter((s: string) => s.startsWith('ssm:')).length, 1);
  // New resolver, no local context/cache. CloudFormation/EC2 now contain the deployed state.
  const second = fixture();
  assert.equal(getBackendImage(stackName, account, second.read), original);
  second.state.current.Parameter.Value = 'ami-aaaaaaaaaaaaaaaaa';
  assert.equal(getBackendImage(stackName, account, second.read), original);
  assert.ok(!second.state.calls.some((s: string) => s.startsWith('ssm:')));
});

test('legacy stack without saved image state is adopted automatically', () => {
  const { read } = fixture();
  assert.equal(getBackendImage(stackName, account, read), original);
});

for (const error of [new Error('network timeout'), new SyntaxError('invalid JSON'),
  Object.assign(new Error(), { stderr: 'An error occurred (AccessDenied) when calling the DescribeStacks operation: denied' }),
  Object.assign(new Error(), { stderr: 'An error occurred (ValidationError) when calling the DescribeStacks operation: invalid request' }),
  Object.assign(new Error(), { stderr: 'An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id another-stack does not exist' })]) {
  test(`AWS read failure never selects latest: ${String((error as any).stderr ?? error)}`, () => {
    const { state, read } = fixture(); state.error = error;
    assert.throws(() => getBackendImage(stackName, account, read), /Cannot safely resolve/);
    assert.deepEqual(state.calls, ['sts:get-caller-identity', 'cloudformation:describe-stacks']);
  });
}

for (const mutate of [
  (s: any) => { s.identity.Account = '999999999999'; },
  (s: any) => { s.stack.StackName = 'wrong'; },
  (s: any) => { s.stack.StackStatus = 'UPDATE_IN_PROGRESS'; },
  (s: any) => { s.stack.Outputs = []; },
  (s: any) => { s.stack.Outputs.push(s.stack.Outputs[0]); },
  (s: any) => { s.instances.Reservations = []; },
  (s: any) => { s.instances.Reservations[0].Instances.push(s.instances.Reservations[0].Instances[0]); },
  (s: any) => { s.instances.Reservations[0].Instances[0].InstanceId = 'i-other'; },
  (s: any) => { s.instances.Reservations[0].Instances[0].State.Name = 'terminated'; },
  (s: any) => { delete s.instances.Reservations[0].Instances[0].ImageId; },
]) {
  test(`ambiguous or unsafe existing state fails closed: ${mutate}`, () => {
    const { state, read } = fixture(); mutate(state);
    assert.throws(() => getBackendImage(stackName, account, read), /Cannot safely resolve/);
    assert.ok(!state.calls.some((s: string) => s.startsWith('ssm:')));
  });
}

test('new stack also rejects invalid SSM results and read failures', () => {
  const { state, read } = fixture(); state.error = missing();
  state.current = {};
  assert.throws(() => getBackendImage(stackName, account, read), /Cannot safely resolve/);
  assert.throws(() => getBackendImage(stackName, account, (service, op, args) => {
    if (service === 'ssm') throw new Error('AccessDenied');
    return read(service, op, args);
  }), /Cannot safely resolve/);
});
