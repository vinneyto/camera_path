import { RemovalPolicy, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DatabaseResources {
  volume: ec2.CfnVolume;
  attachment: ec2.CfnVolumeAttachment;
}

export function createDatabaseVolume(
  scope: Construct, subnet: ec2.ISubnet, instance: ec2.Instance,
): DatabaseResources {
  const volume = new ec2.CfnVolume(scope, 'DatabaseVolume', {
    availabilityZone: subnet.availabilityZone, size: 10, volumeType: 'gp3', encrypted: true,
  });
  volume.applyRemovalPolicy(RemovalPolicy.RETAIN);
  const attachment = new ec2.CfnVolumeAttachment(scope, 'DatabaseAttachment', {
    instanceId: instance.instanceId, volumeId: volume.ref, device: '/dev/sdf',
  });
  return { volume, attachment };
}
