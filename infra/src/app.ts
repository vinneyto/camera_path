import { App } from 'aws-cdk-lib';
import { getDeploymentId } from './getDeploymentId';
import { getRevision } from './getRevision';
import { BackendStack } from './stack';

const app = new App();
const deploymentId = getDeploymentId();
const revision = getRevision();
new BackendStack(app, `camera-path-${deploymentId}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CP_AWS_REGION ?? 'us-east-1' },
  deploymentId, revision,
  frontendOrigins: (process.env.CP_FRONTEND_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  localAccess: process.env.CP_LOCAL_ACCESS === 'true',
  releaseToken: process.env.CP_RELEASE_TOKEN,
});
