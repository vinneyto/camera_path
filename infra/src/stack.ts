import { Stack, StackProps, CfnOutput, Tags, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createVpc } from './createVpc';
import { createLibrary, grantLibraryAccess } from './createLibrary';
import { createBackups, grantBackupUploads } from './createBackups';
import { createSecrets } from './createSecrets';
import { createBackendRole } from './createBackendRole';
import { createBackend } from './createBackend';
import { createDatabaseVolume } from './createDatabaseVolume';
import { configureBackend, DeploymentConfig } from './configureBackend';
import { createApi } from './createApi';
import { createRelease } from './createRelease';
import { DomainConfig } from './getDomainConfig';
import { createAuthEmail } from './createAuthEmail';
import { createLocalAccess } from './createLocalAccess';

export interface BackendStackProps extends StackProps {
  deploymentId: string;
  domain: DomainConfig;
  revision: string;
  frontendOrigins: string[];
  localAccess?: boolean;
  releaseToken?: string;
  backendRuntime?: 'python' | 'rust';
  rustArtifactKey?: string;
  rustArtifactSha256?: string;
}

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);
    Tags.of(this).add('DeploymentId', props.deploymentId);
    const name = `camera-path-${props.deploymentId}`;

    const vpc = createVpc(this);
    const library = createLibrary(this, props.frontendOrigins);
    const backups = createBackups(this);
    const { jwt, openai } = createSecrets(this, name);
    const role = createBackendRole(this);
    const authEmail = createAuthEmail(this, role, props.domain);
    grantLibraryAccess(library, role);
    grantBackupUploads(backups, role);
    jwt.grantRead(role);
    openai.grantRead(role);

    const { instance, subnet } = createBackend(this, vpc, role);
    const { volume, attachment } = createDatabaseVolume(this, subnet, instance);
    const api = createApi(this, instance, props.domain);
    const config: DeploymentConfig = {
      region: this.region, library_bucket: library.bucketName, backups_bucket: backups.bucketName,
      auth_email_from: authEmail.sender,
      jwt_secret: jwt.secretArn, openai_secret: openai.secretArn,
      volume_id: volume.ref, repository: 'https://github.com/vinneyto/camera_path.git',
      api_domain: api.apiDomain, public_ip: api.address.ref, tls_email: props.domain.tlsEmail,
    };
    if (props.backendRuntime === 'rust') {
      if (!props.rustArtifactKey?.startsWith(`releases/${props.revision}/`) || !/^[a-f0-9]{64}$/.test(props.rustArtifactSha256 ?? '')) {
        throw new Error('Rust release requires an exact revision artifact key and SHA-256');
      }
      config.backend_runtime = 'rust';
      config.rust_artifact_key = props.rustArtifactKey;
      config.rust_artifact_sha256 = props.rustArtifactSha256;
      role.addToPolicy(new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: [backups.arnForObjects('releases/*')] }));
    }
    configureBackend(instance, config);
    const release = createRelease(this, {
      instance, config, revision: props.revision, releaseToken: props.releaseToken,
    });
    release.node.addDependency(attachment, api.association, api.record, authEmail.identity);

    if (props.localAccess) {
      const user = createLocalAccess(this, name, library);
      new CfnOutput(this, 'LocalBackendUserName', { value: user.userName });
    }
    new CfnOutput(this, 'AuthEmailFrom', { value: authEmail.sender });
    new CfnOutput(this, 'ApiUrl', { value: api.apiUrl });
    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'DataVolumeId', { value: volume.ref });
    new CfnOutput(this, 'LibraryBucket', { value: library.bucketName });
    new CfnOutput(this, 'BackupBucket', { value: backups.bucketName });
    new CfnOutput(this, 'OpenAiSecretArn', { value: openai.secretArn });
    new CfnOutput(this, 'BackendRevision', { value: props.revision });
  }
}
