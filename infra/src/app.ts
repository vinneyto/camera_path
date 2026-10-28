import { awsReader, getBackendImage } from './getBackendImage';
import { App } from 'aws-cdk-lib';
import { getDeploymentId } from './getDeploymentId';
import { getRevision } from './getRevision';
import { getDomainConfig } from './getDomainConfig';
import { BackendStack } from './stack';

const app = new App();
const deploymentId = getDeploymentId();
const revision = getRevision();
const stackName = `camera-path-${deploymentId}`;
const region = process.env.CP_AWS_REGION ?? 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT ?? '';
const backendImageId = getBackendImage(stackName, account, awsReader(region));
console.error(`Backend release: ${revision} (${process.env.CP_BACKEND_REVISION === undefined ? 'checkout HEAD' : 'CP_BACKEND_REVISION'}); adopted AMI: ${backendImageId}; stack: ${stackName}`);
new BackendStack(app, stackName, {
  env: { account, region }, backendImageId,
  deploymentId, revision, domain: getDomainConfig(),
  frontendOrigins: (process.env.CP_FRONTEND_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  localAccess: process.env.CP_LOCAL_ACCESS === 'true',
  releaseToken: process.env.CP_RELEASE_TOKEN,
});
