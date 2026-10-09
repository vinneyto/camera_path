import { Duration, aws_ec2 as ec2, aws_route53 as route53 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DomainConfig } from './getDomainConfig';

export function createApi(scope: Construct, instance: ec2.Instance, domain: DomainConfig) {
  const address = new ec2.CfnEIP(scope, 'ApiAddress', { domain: 'vpc' });
  const association = new ec2.CfnEIPAssociation(scope, 'ApiAddressAssociation', {
    allocationId: address.attrAllocationId, instanceId: instance.instanceId,
  });
  const zone = route53.HostedZone.fromHostedZoneAttributes(scope, 'DomainZone', {
    hostedZoneId: domain.hostedZoneId, zoneName: domain.domainName,
  });
  const apiDomain = `api.${domain.domainName}`;
  const record = new route53.ARecord(scope, 'ApiDns', {
    zone, recordName: apiDomain, target: route53.RecordTarget.fromIpAddresses(address.ref),
    ttl: Duration.minutes(5),
  });
  return { address, association, record, apiDomain, apiUrl: `https://${apiDomain}` };
}
