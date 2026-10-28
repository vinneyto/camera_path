import { aws_ec2 as ec2, aws_iam as iam, CfnParameter, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface BackendResources {
  instance: ec2.Instance;
  subnet: ec2.ISubnet;
}

export function createBackend(scope: Construct, vpc: ec2.Vpc, role: iam.Role): BackendResources {
  const image = new CfnParameter(scope, 'BackendImageId', {
    type: 'AWS::EC2::Image::Id',
    description: 'Automatically supplied by npm run cdk from the existing EC2 or initial Ubuntu lookup.',
  });
  const sg = new ec2.SecurityGroup(scope, 'BackendSecurityGroup', { vpc, allowAllOutbound: true });
  sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'ACME HTTP challenge and HTTPS redirect');
  sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS API');
  const subnet = vpc.publicSubnets[0];
  const instance = new ec2.Instance(scope, 'Backend', {
    vpc, vpcSubnets: { subnets: [subnet] }, securityGroup: sg, role, associatePublicIpAddress: true,
    instanceType: new ec2.InstanceType('t3.small'), requireImdsv2: true,
    machineImage: ec2.MachineImage.genericLinux({ [Stack.of(scope).region]: image.valueAsString }),
    blockDevices: [{ deviceName: '/dev/sda1', volume: ec2.BlockDeviceVolume.ebs(20, {
      encrypted: true, volumeType: ec2.EbsDeviceVolumeType.GP3, deleteOnTermination: true,
    }) }],
  });
  instance.node.addDependency(vpc.selectSubnets({ subnets: [subnet] }).internetConnectivityEstablished);
  return { instance, subnet };
}
