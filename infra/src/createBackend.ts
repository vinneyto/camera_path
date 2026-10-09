import { aws_ec2 as ec2, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface BackendResources {
  instance: ec2.Instance;
  subnet: ec2.ISubnet;
}

export function createBackend(scope: Construct, vpc: ec2.Vpc, role: iam.Role): BackendResources {
  const sg = new ec2.SecurityGroup(scope, 'BackendSecurityGroup', { vpc, allowAllOutbound: true });
  // CloudFront's managed prefix list; no public IP, SSH or public CIDR ingress.
  const prefixList = ec2.PrefixList.fromLookup(scope, 'CloudFrontPrefixList', {
    prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
  });
  sg.addIngressRule(ec2.Peer.prefixList(prefixList.prefixListId), ec2.Port.tcp(80), 'CloudFront origin');
  const subnet = vpc.privateSubnets[0];
  const instance = new ec2.Instance(scope, 'Backend', {
    vpc, vpcSubnets: { subnets: [subnet] }, securityGroup: sg, role,
    instanceType: new ec2.InstanceType('t3.small'), requireImdsv2: true,
    machineImage: ec2.MachineImage.fromSsmParameter(
      '/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id',
    ),
    blockDevices: [{ deviceName: '/dev/sda1', volume: ec2.BlockDeviceVolume.ebs(20, {
      encrypted: true, volumeType: ec2.EbsDeviceVolumeType.GP3, deleteOnTermination: true,
    }) }],
  });
  instance.node.addDependency(vpc.selectSubnets({ subnets: [subnet] }).internetConnectivityEstablished);
  return { instance, subnet };
}
