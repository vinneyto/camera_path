import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createBackendRole(scope: Construct): iam.Role {
  const role = new iam.Role(scope, 'BackendRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  });
  // Modern SSM Agent uses message channels for Run Command and Session Manager.
  // No account-wide Parameter Store read, inventory, patch or EC2 administration.
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['ssm:UpdateInstanceInformation', 'ssmmessages:CreateControlChannel',
      'ssmmessages:CreateDataChannel', 'ssmmessages:OpenControlChannel', 'ssmmessages:OpenDataChannel'],
    resources: ['*'], // Message-channel APIs require this resource scope.
  }));
  return role;
}
