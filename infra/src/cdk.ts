import { spawnSync } from 'node:child_process';
import { awsReader } from './getBackendImage';
import { cliProfile, prepareCdkCommand } from './cdkCommand';

const args = process.argv.slice(2);
const region = process.env.CP_AWS_REGION ?? 'us-east-1';
const prepared = prepareCdkCommand(args, awsReader(region, cliProfile(args)));
const result = spawnSync(process.execPath, [require.resolve('aws-cdk/bin/cdk'), ...prepared.args], {
  stdio: 'inherit', env: { ...process.env, CDK_DEFAULT_REGION: region,
    ...(prepared.account ? { CDK_DEFAULT_ACCOUNT: prepared.account } : {}) },
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`CDK terminated by ${result.signal}`);
process.exitCode = result.status ?? 1;
