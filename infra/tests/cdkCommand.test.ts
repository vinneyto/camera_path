import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { prepareCdkCommand, cliProfile } from '../src/cdkCommand';

const account = '123456789012';
const image = 'ami-0123456789abcdef0';
const instance = 'i-0123456789abcdef0';

function withDeployment(run: () => void) {
  const before = process.env.CP_DEPLOYMENT_ID;
  process.env.CP_DEPLOYMENT_ID = 'test';
  try { run(); } finally {
    if (before === undefined) delete process.env.CP_DEPLOYMENT_ID;
    else process.env.CP_DEPLOYMENT_ID = before;
  }
}

function aws(existing = true) {
  return (service: string, _operation: string, _args: string[]) => {
    if (service === 'sts') return { Account: account };
    if (service === 'cloudformation') {
      if (!existing) throw Object.assign(new Error('missing'), { stderr:
        'An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id camera-path-test does not exist' });
      return { Stacks: [{ StackName: 'camera-path-test', StackStatus: 'UPDATE_ROLLBACK_COMPLETE',
        Outputs: [{ OutputKey: 'InstanceId', OutputValue: instance }] }] };
    }
    if (service === 'ec2') return { Reservations: [{ Instances: [{ InstanceId: instance,
      ImageId: image, State: { Name: 'running' } }] }] };
    if (service === 'ssm') return { Parameter: { Value: image } };
    throw new Error('Unexpected read');
  };
}

for (const existing of [true, false]) {
  test(`${existing ? 'existing' : 'new'} environment supplies a concrete image to both diff and deploy`, () => withDeployment(() => {
    const diff = prepareCdkCommand(['diff', '--profile', 'operator'], aws(existing));
    const deploy = prepareCdkCommand(['deploy', '--profile', 'operator'], aws(existing));
    assert.equal(diff.account, account);
    assert.deepEqual(diff.args, ['diff', '--profile', 'operator', '--method=change-set',
      '--parameters', `camera-path-test:BackendImageId=${image}`]);
    assert.deepEqual(deploy.args.slice(-2), diff.args.slice(-2));
    assert.deepEqual(prepareCdkCommand(['deploy'], aws(existing)), prepareCdkCommand(['deploy'], aws(existing)));
  }));
}

test('AWS read failures prevent invoking CDK with an unknown/default image', () => withDeployment(() => {
  assert.throws(() => prepareCdkCommand(['diff'], () => { throw new Error('AccessDenied'); }), /AccessDenied/);
}));

test('cannot bypass change-set review or supply a manual image/alternate assembly', () => withDeployment(() => {
  for (const flag of ['--method=template', '--no-change-set', '--template=old.json', '-a', '--app=cdk.out', '--hotswap', '--watch']) {
    assert.throws(() => prepareCdkCommand(['diff', flag], aws()), /unsupported/);
  }
  for (const value of ['BackendImageId=ami-bad', 'camera-path-test:BackendImageId=ami-bad']) {
    assert.throws(() => prepareCdkCommand(['deploy', '--parameters', value], aws()), /managed automatically/);
  }
}));

test('help/synthesis do not require AWS reads; profile syntax stays consistent', () => {
  const noAws = () => { throw new Error('unexpected AWS read'); };
  for (const args of [['diff', '--help'], ['synth'], ['bootstrap', '--help']]) {
    assert.deepEqual(prepareCdkCommand(args, noAws).args, args);
  }
  assert.equal(cliProfile(['diff', '--profile', 'operator']), 'operator');
  assert.equal(cliProfile(['deploy', '--profile=operator']), 'operator');
  assert.equal(cliProfile(['diff']), undefined);
  assert.throws(() => cliProfile(['diff', '--profile']), /requires a value/);
});

test('pinned real CDK CLI recognizes diff parameters and rejects template-only mode before AWS access', () => {
  const cli = require.resolve('aws-cdk/bin/cdk');
  const help = spawnSync(process.execPath, [cli, 'diff', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--parameters\s+Additional parameters passed to/);
  const result = spawnSync(process.execPath, [cli, 'diff', '--method=template', '--parameters',
    `camera-path-test:BackendImageId=${image}`, '--no-notices'], {
    encoding: 'utf8', env: { ...process.env, AWS_EC2_METADATA_DISABLED: 'true' }, timeout: 15_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /--parameters.*--method=template|--method=template.*--parameters/s);
});
