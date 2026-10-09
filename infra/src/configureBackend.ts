import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Resource identifiers only; secret values are fetched on the instance. */
export interface DeploymentConfig {
  region: string;
  library_bucket: string;
  backups_bucket: string;
  jwt_secret: string;
  openai_secret: string;
  volume_id: string;
  repository: string;
}

export function configureBackend(instance: ec2.Instance, config: DeploymentConfig): void {
  const bootstrap = readFileSync(resolve(__dirname, '../scripts/bootstrap.sh'), 'utf8');
  instance.addUserData(
    `install -d -m 0755 /etc/camera-path`,
    `cat > /etc/camera-path/deployment.json <<'CP_CONFIG'\n${JSON.stringify(config)}\nCP_CONFIG`,
    bootstrap,
  );
}
