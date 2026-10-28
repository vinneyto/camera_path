import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../src/stack';
import { configureBackend } from '../src/configureBackend';

function template(revision = 'a'.repeat(40), localAccess = false) {
  const app = new App({ context: {
    'availability-zones:account=992382434156:region=us-east-1': ['us-east-1a', 'us-east-1b'],
  } });
  return Template.fromStack(new BackendStack(app, 'test', {
    env: { account: '992382434156', region: 'us-east-1' },
    backendImageId: 'ami-0123456789abcdef0', deploymentId: 'test-deployment', domain: { domainName: 'example.com', hostedZoneId: 'ZTEST123', tlsEmail: 'ops@example.com' }, revision, frontendOrigins: ['http://localhost:3000'], localAccess,
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
  assert.deepEqual(template().toJSON(), template().toJSON());
  const changed = Object.keys(a.Resources).filter(id =>
    JSON.stringify(a.Resources[id]) !== JSON.stringify(b.Resources[id]));
  assert.deepEqual(changed, [Object.keys(a.Resources).find(id => id.startsWith('BackendRelease'))]);
  const instance = instances(a)[0][1] as any;
  assert.deepEqual(instance.Properties.ImageId, { 'Fn::GetAtt': [Object.keys(a.Resources).find(id => a.Resources[id].Type === 'AWS::SSM::Parameter'), 'Value'] });
  assert.ok(!JSON.stringify(a).includes('/stable/current/'));

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

test('SES identity manages DKIM/MAIL FROM DNS and grants only the configured sender', () => {
  const t = template();
  t.resourceCountIs('AWS::SES::EmailIdentity', 1);
  t.hasResourceProperties('AWS::SES::EmailIdentity', {
    EmailIdentity: 'example.com',
    MailFromAttributes: Match.objectLike({ MailFromDomain: 'auth-mail.example.com' }),
  });
  const resources = Object.values<any>(t.toJSON().Resources);
  const dns = resources.filter(r => r.Type === 'AWS::Route53::RecordSet');
  assert.equal(dns.filter(r => r.Properties.Type === 'CNAME').length, 3);
  assert.ok(dns.some(r => r.Properties.Type === 'MX' && r.Properties.Name === 'auth-mail.example.com.'));
  assert.ok(dns.some(r => r.Properties.Type === 'TXT' && r.Properties.Name === 'auth-mail.example.com.'));
  assert.ok(!dns.some(r => r.Properties.Name === '_dmarc.example.com.'));
  const policies = resources.filter(r => r.Type === 'AWS::IAM::Policy');
  const statements = policies.flatMap(p => p.Properties.PolicyDocument.Statement);
  const send = statements.find(s => s.Action === 'ses:SendEmail');
  assert.deepEqual(send.Condition, { StringEquals: { 'ses:FromAddress': 'noreply@example.com' } });
  assert.notEqual(send.Resource, '*');
  assert.deepEqual(send.Resource, {
    'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':ses:us-east-1:992382434156:identity/*']],
  });
  const release = resources.find(r => r.Type === 'AWS::CloudFormation::CustomResource');
  assert.equal(release.Properties.Config.auth_email_from, 'noreply@example.com');
  const instance = resources.find(r => r.Type === 'AWS::EC2::Instance');
  assert.ok(!JSON.stringify(instance.Properties.UserData).includes('auth_email_from'));
});

test('email release settings preserve the pre-SES bootstrap payload byte for byte', () => {
  const legacyConfig = {
    region: 'us-east-1', library_bucket: 'library', backups_bucket: 'backups',
    jwt_secret: 'jwt', openai_secret: 'openai', volume_id: 'vol-test',
    repository: 'https://github.com/vinneyto/camera_path.git',
    api_domain: 'api.example.com', public_ip: '192.0.2.1', tls_email: 'ops@example.com',
  };
  const expected = [
    'install -d -m 0755 /etc/camera-path',
    `cat > /etc/camera-path/deployment.json <<'CP_CONFIG'\n${JSON.stringify(legacyConfig)}\nCP_CONFIG`,
    readFileSync(resolve(__dirname, '../scripts/bootstrap.sh'), 'utf8'),
  ];
  for (const sender of ['noreply@example.com', 'editor@example.com']) {
    let commands: string[] = [];
    const instance = { addUserData: (...lines: string[]) => { commands = lines; } } as unknown as ec2.Instance;
    configureBackend(instance, { ...legacyConfig, auth_email_from: sender });
    assert.deepEqual(commands, expected);
  }
});

test('assembly references the managed image state without a literal ImageId or W9010', () => {
  const app = new App({ context: {
    'availability-zones:account=992382434156:region=us-east-1': ['us-east-1a', 'us-east-1b'],
  } });
  const stack = new BackendStack(app, 'image-assembly', {
    env: { account: '992382434156', region: 'us-east-1' },
    deploymentId: 'test-deployment', domain: { domainName: 'example.com', hostedZoneId: 'ZTEST123', tlsEmail: 'ops@example.com' },
    revision: 'a'.repeat(40), frontendOrigins: [], backendImageId: 'ami-0123456789abcdef0',
  });
  const assembly = app.synth();
  const artifact = assembly.getStackArtifact(stack.artifactId);
  const image = Object.values<any>(artifact.template.Resources).find(r => r.Type === 'AWS::SSM::Parameter');
  assert.equal(image.Properties.Value, 'ami-0123456789abcdef0');
  const report = JSON.parse(readFileSync(resolve(assembly.directory, 'validation-report.json'), 'utf8'));
  assert.ok(!JSON.stringify(report).includes('W9010'));
});
