import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Resource identifiers only; secret values are fetched on the instance. */
export interface DeploymentConfig {
  region: string;
  backend_runtime?: 'python' | 'rust';
  rust_artifact_key?: string;
  rust_artifact_sha256?: string;
  auth_email_from: string;
  api_domain: string;
  public_ip: string;
  tls_email: string;
  library_bucket: string;
  backups_bucket: string;
  jwt_secret: string;
  openai_secret: string;
  volume_id: string;
  repository: string;
}

export function configureBackend(instance: ec2.Instance, config: DeploymentConfig): void {
  const bootstrap = readFileSync(resolve(__dirname, '../scripts/bootstrap.sh'), 'utf8');
  // Keep the deployed bootstrap payload unchanged. Release settings are written
  // by the SSM provider before each deployment; putting them in UserData can
  // restart/replace EC2 and disturb its attached SQLite volume.
  const { auth_email_from: _sender, backend_runtime: _runtime, rust_artifact_key: _artifact,
    rust_artifact_sha256: _checksum, ...bootstrapConfig } = config;
  instance.addUserData(
    `install -d -m 0755 /etc/camera-path`,
    `cat > /etc/camera-path/deployment.json <<'CP_CONFIG'\n${JSON.stringify(bootstrapConfig)}\nCP_CONFIG`,
    bootstrap,
  );
}
