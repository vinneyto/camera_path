import { aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { grantLibraryAccess } from './createLibrary';
export function createLocalAccess(scope: Construct, name: string, library: s3.IBucket): iam.User {
  const user = new iam.User(scope, 'LocalBackendUser', { userName: `${name}-local` });
  grantLibraryAccess(library, user);
  // Access keys are created separately; never output secrets from CloudFormation.
  return user;
}
