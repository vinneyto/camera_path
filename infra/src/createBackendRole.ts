import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createBackendRole(scope: Construct): iam.Role {
  const role = new iam.Role(scope, 'BackendRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
  });
  return role;
}
