import { App } from 'aws-cdk-lib';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BackendStack } from './stack';

const app = new App();
const deploymentId = process.env.CP_DEPLOYMENT_ID;
if (!deploymentId || !/^[a-z0-9][a-z0-9-]{2,31}$/.test(deploymentId)) {
  throw new Error('CP_DEPLOYMENT_ID must contain 3–32 lowercase letters, digits or hyphens');
}
const revision = process.env.CP_BACKEND_REVISION ?? execFileSync(
  'git', ['rev-parse', 'HEAD'], { cwd: resolve(__dirname, '../..'), encoding: 'utf8' },
).trim();
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('CP_BACKEND_REVISION must be a full commit SHA');
new BackendStack(app, `camera-path-${deploymentId}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CP_AWS_REGION ?? 'us-east-1' },
  deploymentId, revision,
  frontendOrigins: (process.env.CP_FRONTEND_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  localAccess: process.env.CP_LOCAL_ACCESS === 'true',
  releaseToken: process.env.CP_RELEASE_TOKEN,
});
