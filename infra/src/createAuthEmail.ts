import { ArnFormat, Stack, aws_iam as iam, aws_route53 as route53, aws_ses as ses } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DomainConfig } from './getDomainConfig';

export function createAuthEmail(scope: Construct, role: iam.Role, domain: DomainConfig) {
  const zone = route53.PublicHostedZone.fromPublicHostedZoneAttributes(scope, 'AuthEmailZone', {
    hostedZoneId: domain.hostedZoneId, zoneName: domain.domainName,
  });
  const identity = new ses.EmailIdentity(scope, 'AuthEmailIdentity', {
    identity: ses.Identity.publicHostedZone(zone),
    mailFromDomain: `auth-mail.${domain.domainName}`,
  });
  const sender = `noreply@${domain.domainName}`;
  // SES can authorize the verified recipient identity too (e.g. in sandbox).
  // Cover identities in this account/region while fixing the actual From address.
  const identityResources = Stack.of(scope).formatArn({
    service: 'ses', resource: 'identity', resourceName: '*',
    arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
  });
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['ses:SendEmail'], resources: [identityResources],
    conditions: { StringEquals: { 'ses:FromAddress': sender } },
  }));
  return { identity, sender };
}
