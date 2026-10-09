import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../src/stack';

function template(revision = 'a'.repeat(40), localAccess = false) {
  const app = new App({ context: {
    'availability-zones:account=992382434156:region=us-east-1': ['us-east-1a', 'us-east-1b'],
    'cc-api-provider:account=992382434156:expectedMatchCount=exactly-one:propertiesToReturn.0=PrefixListId:propertyMatch.PrefixListName=com.amazonaws.global.cloudfront.origin-facing:region=us-east-1:typeName=AWS$:$:EC2$:$:PrefixList': [{ PrefixListId: 'pl-3b927c52' }],
  } });
  return Template.fromStack(new BackendStack(app, 'test', {
    env: { account: '992382434156', region: 'us-east-1' },
    deploymentId: 'd9f856354df8', revision, frontendOrigins: ['http://localhost:3000'], localAccess,
  }));
}

test('private EC2, one NAT, direct VPC origin, uncached API, retained encrypted storage', () => {
  const t = template();
  t.resourceCountIs('AWS::EC2::NatGateway', 1);
  t.resourceCountIs('AWS::EC2::Instance', 1);
  t.resourceCountIs('AWS::CloudFront::VpcOrigin', 1);
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
    Name: 'camera-path-d9f856354df8/openai', GenerateSecretString: Match.absent(), SecretString: Match.absent(),
  });
  t.hasResource('AWS::EC2::Volume', { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain',
    Properties: Match.objectLike({ Encrypted: true }) });
  t.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({ DefaultCacheBehavior: Match.objectLike({
      ViewerProtocolPolicy: 'https-only',
      AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
      CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
    }) }),
  });
  const json = t.toJSON();
  const instance = Object.values<any>(json.Resources).find(r => r.Type === 'AWS::EC2::Instance');
  assert.ok(instance.Properties.SubnetId.Ref.includes('backend'));
  assert.equal(instance.Properties.NetworkInterfaces, undefined);
  const groups = Object.values<any>(json.Resources).filter(r => r.Type === 'AWS::EC2::SecurityGroup');
  for (const group of groups) for (const ingress of group.Properties.SecurityGroupIngress ?? []) {
    assert.equal(ingress.CidrIp, undefined);
    assert.equal(ingress.FromPort, 80);
    assert.ok(ingress.SourcePrefixListId);
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
