import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createVpc(scope: Construct): ec2.Vpc {
  const vpc = new ec2.Vpc(scope, 'Vpc', {
    ipAddresses: ec2.IpAddresses.cidr('10.43.0.0/16'), maxAzs: 2, natGateways: 1,
    subnetConfiguration: [
      { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      { name: 'backend', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
    ],
    gatewayEndpoints: { S3: { service: ec2.GatewayVpcEndpointAwsService.S3 } },
  });
  return vpc;
}
