import { Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createVpc } from './createVpc';
import { createLibrary, grantLibraryAccess } from './createLibrary';
import { createBackups } from './createBackups';
import { createSecrets } from './createSecrets';
import { createBackendRole } from './createBackendRole';
import { createBackend } from './createBackend';
import { createDatabaseVolume } from './createDatabaseVolume';
import { configureBackend, DeploymentConfig } from './configureBackend';
import { createApi } from './createApi';
import { createRelease } from './createRelease';
import { createLocalAccess } from './createLocalAccess';

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

    const vpc = createVpc(this);
    const library = createLibrary(this, props.frontendOrigins);
    const backups = createBackups(this);
    const { jwt, openai } = createSecrets(this, name);
    const role = createBackendRole(this);
    grantLibraryAccess(library, role);
    backups.grantReadWrite(role);
    jwt.grantRead(role);
    openai.grantRead(role);

    const { instance, subnet } = createBackend(this, vpc, role);
    const { volume, attachment } = createDatabaseVolume(this, subnet, instance);
    const config: DeploymentConfig = {
      region: this.region, library_bucket: library.bucketName, backups_bucket: backups.bucketName,
      jwt_secret: jwt.secretArn, openai_secret: openai.secretArn,
      volume_id: volume.ref, repository: 'https://github.com/vinneyto/camera_path.git',
    };
    configureBackend(instance, config);
    const distribution = createApi(this, instance);
    const release = createRelease(this, {
      instance, config, revision: props.revision, releaseToken: props.releaseToken,
    });
    release.node.addDependency(attachment, distribution);

    if (props.localAccess) {
      const user = createLocalAccess(this, name, library);
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
