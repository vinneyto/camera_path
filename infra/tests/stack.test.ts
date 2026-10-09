import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../src/stack';

function template(revision = 'a'.repeat(40), localAccess = false) {
  const app = new App({ context: {
    'availability-zones:account=992382434156:region=us-east-1': ['us-east-1a', 'us-east-1b'],
  } });
  return Template.fromStack(new BackendStack(app, 'test', {
    env: { account: '992382434156', region: 'us-east-1' },
    deploymentId: 'test-deployment', domain: { domainName: 'example.com', hostedZoneId: 'ZTEST123', tlsEmail: 'ops@example.com' }, revision, frontendOrigins: ['http://localhost:3000'], localAccess,
  }));
}

test('public EC2, HTTPS domain and retained encrypted storage without NAT or CloudFront', () => {
  const t = template();
  t.resourceCountIs('AWS::EC2::NatGateway', 0);
  t.resourceCountIs('AWS::EC2::Instance', 1);
  t.resourceCountIs('AWS::CloudFront::VpcOrigin', 0)
  t.resourceCountIs('AWS::CloudFront::Distribution', 0);
  t.resourceCountIs('AWS::EC2::EIP', 1);
  t.resourceCountIs('AWS::EC2::EIPAssociation', 1);
  t.resourceCountIs('AWS::Route53::HostedZone', 0);
  t.hasResourceProperties('AWS::Route53::RecordSet', { HostedZoneId: 'ZTEST123', Name: 'api.example.com.', Type: 'A' });
  t.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 0);
  t.resourceCountIs('AWS::IAM::AccessKey', 0);
  t.resourceCountIs('AWS::IAM::User', 0);
  t.hasResourceProperties('AWS::EC2::Instance', {
    BlockDeviceMappings: Match.arrayWith([Match.objectLike({ Ebs: Match.objectLike({ Encrypted: true }) })]),
  });
  t.hasResourceProperties('AWS::EC2::LaunchTemplate', {
    LaunchTemplateData: Match.objectLike({ MetadataOptions: Match.objectLike({ HttpTokens: 'required' }) }),
  });
  t.hasResourceProperties('AWS::SecretsManager::Secret', {
    Name: 'camera-path-test-deployment/openai', GenerateSecretString: Match.absent(), SecretString: Match.absent(),
  });
  t.hasResource('AWS::EC2::Volume', { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain',
    Properties: Match.objectLike({ Encrypted: true }) });
  const json = t.toJSON();
  const instance = Object.values<any>(json.Resources).find(r => r.Type === 'AWS::EC2::Instance');
  assert.equal(instance.Properties.NetworkInterfaces[0].AssociatePublicIpAddress, true);
  assert.ok(instance.Properties.NetworkInterfaces[0].SubnetId.Ref.includes('public'));
  const groups = Object.values<any>(json.Resources).filter(r => r.Type === 'AWS::EC2::SecurityGroup');
  const ingress = groups.flatMap(group => group.Properties.SecurityGroupIngress ?? []);
  assert.deepEqual(ingress.map(rule => rule.FromPort).sort((a, b) => a - b), [80, 443]);
  for (const rule of ingress) {
    assert.equal(rule.CidrIp, '0.0.0.0/0');
    assert.equal(rule.ToPort, rule.FromPort);
  }
  const buckets = Object.values<any>(json.Resources).filter(r => r.Type === 'AWS::S3::Bucket');
  assert.equal(buckets.length, 2);
  for (const bucket of buckets) assert.equal(bucket.DeletionPolicy, 'Retain');
});

test('release is tied to exact revision, script and instance, without replacing instance for code changes', () => {
  const a = template('a'.repeat(40)).toJSON();
  const b = template('b'.repeat(40)).toJSON();
  const instances = (j: any) => Object.entries(j.Resources).filter(([, r]: any) => r.Type === 'AWS::EC2::Instance');
  assert.deepEqual(instances(a), instances(b));
  const release = Object.values<any>(b.Resources).find(r => r.Type === 'AWS::CloudFormation::CustomResource');
  assert.equal(release.Properties.Revision, 'b'.repeat(40));
  assert.ok(release.Properties.Script);
  assert.ok(release.DependsOn.some((id: string) => id.includes('DatabaseAttachment')));
  assert.ok(release.DependsOn.some((id: string) => id.includes('Api')));
});

test('optional local identity has no generated credentials', () => {
  const t = template('a'.repeat(40), true);
  t.resourceCountIs('AWS::IAM::User', 1);
  t.resourceCountIs('AWS::IAM::AccessKey', 0);
});


test('EC2 permissions are restricted to library prefix, backup uploads, secrets and SSM channels', () => {
  const json = template().toJSON();
  const roleId = Object.keys(json.Resources).find(id => id.startsWith('BackendRole') && json.Resources[id].Type === 'AWS::IAM::Role')!;
  assert.equal(json.Resources[roleId].Properties.ManagedPolicyArns, undefined);
  const policies = Object.values<any>(json.Resources).filter(r => r.Type === 'AWS::IAM::Policy' &&
    r.Properties.Roles?.some((ref: any) => ref.Ref === roleId));
  const statements = policies.flatMap(p => p.Properties.PolicyDocument.Statement);
  const backups = statements.find(s => JSON.stringify(s.Resource).includes('database/*'));
  assert.deepEqual(backups.Action, ['s3:PutObject', 's3:AbortMultipartUpload']);
  const wildcardStatements = statements.filter(s => s.Resource === '*');
  assert.equal(wildcardStatements.length, 1);
  assert.deepEqual(wildcardStatements[0].Action, [
    'ssm:UpdateInstanceInformation', 'ssmmessages:CreateControlChannel', 'ssmmessages:CreateDataChannel',
    'ssmmessages:OpenControlChannel', 'ssmmessages:OpenDataChannel',
  ]);
  assert.ok(!JSON.stringify(statements).includes('route53:'));
  assert.ok(!JSON.stringify(statements).includes('ssm:GetParameter'));
});
