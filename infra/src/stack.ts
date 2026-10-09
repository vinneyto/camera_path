import {
  Stack, StackProps, Duration, RemovalPolicy, CfnOutput, CustomResource, Tags,
  aws_ec2 as ec2, aws_iam as iam, aws_s3 as s3, aws_secretsmanager as secrets,
  aws_cloudfront as cloudfront, aws_cloudfront_origins as origins,
  aws_lambda as lambda, aws_logs as logs, custom_resources as cr,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BackendStackProps extends StackProps {
  deploymentId: string;
  revision: string;
  frontendOrigins: string[];
  localAccess?: boolean;
  releaseToken?: string;
}

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);
    Tags.of(this).add('DeploymentId', props.deploymentId);
    const name = `camera-path-${props.deploymentId}`;
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.43.0.0/16'), maxAzs: 2, natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'backend', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
      gatewayEndpoints: { S3: { service: ec2.GatewayVpcEndpointAwsService.S3 } },
    });
    const library = new s3.Bucket(this, 'Library', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED, enforceSSL: true,
      versioned: false, removalPolicy: RemovalPolicy.RETAIN,
      cors: [{ allowedOrigins: props.frontendOrigins,
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedHeaders: ['*'], exposedHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
        maxAge: 300 }],
    });
    const backups = new s3.Bucket(this, 'DatabaseBackups', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: RemovalPolicy.RETAIN,
    });
    const jwt = new secrets.Secret(this, 'JwtSecret', {
      secretName: `${name}/jwt`, generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });
    jwt.applyRemovalPolicy(RemovalPolicy.RETAIN);
    // No value is authored in CloudFormation; set this optional secret after deployment.
    const openaiResource = new secrets.CfnSecret(this, 'OpenAiSecret', {
      name: `${name}/openai`, description: 'Set SecretString to the OpenAI API key after deployment',
    });
    openaiResource.applyRemovalPolicy(RemovalPolicy.RETAIN);
    const openai = secrets.Secret.fromSecretCompleteArn(this, 'OpenAiReference', openaiResource.ref);
    const role = new iam.Role(this, 'BackendRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    const libraryPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [library.arnForObjects('library/*')],
    });
    role.addToPolicy(libraryPolicy);
    role.addToPolicy(new iam.PolicyStatement({ actions: ['s3:ListBucket'],
      resources: [library.bucketArn], conditions: { StringLike: { 's3:prefix': ['library/*'] } } }));
    backups.grantReadWrite(role);
    jwt.grantRead(role);
    openai.grantRead(role);
    const sg = new ec2.SecurityGroup(this, 'BackendSecurityGroup', { vpc, allowAllOutbound: true });
    // CloudFront's managed prefix list; no public IP, SSH or public CIDR ingress.
    const prefixList = ec2.PrefixList.fromLookup(this, 'CloudFrontPrefixList', {
      prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
    });
    sg.addIngressRule(ec2.Peer.prefixList(prefixList.prefixListId), ec2.Port.tcp(80), 'CloudFront origin');
    const subnet = vpc.privateSubnets[0];
    const instance = new ec2.Instance(this, 'Backend', {
      vpc, vpcSubnets: { subnets: [subnet] }, securityGroup: sg, role,
      instanceType: new ec2.InstanceType('t3.small'), requireImdsv2: true,
      machineImage: ec2.MachineImage.fromSsmParameter(
        '/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id',
      ),
      blockDevices: [{ deviceName: '/dev/sda1', volume: ec2.BlockDeviceVolume.ebs(20, {
        encrypted: true, volumeType: ec2.EbsDeviceVolumeType.GP3, deleteOnTermination: true,
      }) }],
    });
    const volume = new ec2.CfnVolume(this, 'DatabaseVolume', {
      availabilityZone: subnet.availabilityZone, size: 10, volumeType: 'gp3', encrypted: true,
    });
    instance.node.addDependency(vpc.selectSubnets({ subnets: [subnet] }).internetConnectivityEstablished);
    volume.applyRemovalPolicy(RemovalPolicy.RETAIN);
    const attachment = new ec2.CfnVolumeAttachment(this, 'DatabaseAttachment', {
      instanceId: instance.instanceId, volumeId: volume.ref, device: '/dev/sdf',
    });
    const config = {
      region: this.region, library_bucket: library.bucketName, backups_bucket: backups.bucketName,
      jwt_secret: jwt.secretArn, openai_secret: openai.secretArn,
      volume_id: volume.ref, repository: 'https://github.com/vinneyto/camera_path.git',
    };
    const bootstrap = readFileSync(resolve(__dirname, '../scripts/bootstrap.sh'), 'utf8');
    // Config contains only resource identifiers. Secret values are fetched on the instance.
    instance.addUserData(
      `install -d -m 0755 /etc/camera-path`,
      `cat > /etc/camera-path/deployment.json <<'CP_CONFIG'\n${JSON.stringify(config)}\nCP_CONFIG`,
      bootstrap,
    );
    const distribution = new cloudfront.Distribution(this, 'Api', {
      defaultBehavior: {
        origin: origins.VpcOrigin.withEc2Instance(instance, {
          httpPort: 80, protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: Duration.seconds(60),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });
    const providerRole = new iam.Role(this, 'ReleaseProviderRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });
    providerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:SendCommand'],
      resources: [`arn:${this.partition}:ec2:${this.region}:${this.account}:instance/${instance.instanceId}`,
        `arn:${this.partition}:ssm:${this.region}::document/AWS-RunShellScript`],
    }));
    providerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:DescribeInstanceInformation', 'ssm:ListCommands', 'ssm:GetCommandInvocation'], resources: ['*'],
    }));
    const functions = ['on_event', 'is_complete'].map(handler => new lambda.Function(this, handler, {
      runtime: lambda.Runtime.PYTHON_3_12, handler: `release.${handler}`, role: providerRole,
      code: lambda.Code.fromAsset(resolve(__dirname, '../provider')),
      timeout: Duration.seconds(60),
      logGroup: new logs.LogGroup(this, `${handler}Logs`, { retention: logs.RetentionDays.ONE_MONTH }),
    }));
    const provider = new cr.Provider(this, 'ReleaseProvider', {
      onEventHandler: functions[0], isCompleteHandler: functions[1],
      queryInterval: Duration.seconds(15), totalTimeout: Duration.minutes(55),
    });
    const release = new CustomResource(this, 'BackendRelease', {
      serviceToken: provider.serviceToken,
      properties: {
        InstanceId: instance.instanceId, Revision: props.revision,
        Config: config, ReleaseToken: props.releaseToken ?? '',
        Script: readFileSync(resolve(__dirname, '../scripts/deploy.py')).toString('base64'),
      },
    });
    release.node.addDependency(attachment, distribution);
    if (props.localAccess) {
      const user = new iam.User(this, 'LocalBackendUser', { userName: `${name}-local` });
      user.addToPolicy(libraryPolicy);
      user.addToPolicy(new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [library.bucketArn],
        conditions: { StringLike: { 's3:prefix': ['library/*'] } } }));
      // Access keys are created separately; never output secrets from CloudFormation.
      new CfnOutput(this, 'LocalBackendUserName', { value: user.userName });
    }
    new CfnOutput(this, 'ApiUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'DataVolumeId', { value: volume.ref });
    new CfnOutput(this, 'LibraryBucket', { value: library.bucketName });
    new CfnOutput(this, 'BackupBucket', { value: backups.bucketName });
    new CfnOutput(this, 'OpenAiSecretArn', { value: openai.secretArn });
    new CfnOutput(this, 'BackendRevision', { value: props.revision });
  }
}
