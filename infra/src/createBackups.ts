import { RemovalPolicy, aws_s3 as s3, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createBackups(scope: Construct): s3.Bucket {
  const backups = new s3.Bucket(scope, 'DatabaseBackups', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: RemovalPolicy.RETAIN,
  });
  return backups;
}

/** Releases upload snapshots; the application cannot read/delete backup history. */
export function grantBackupUploads(bucket: s3.Bucket, role: iam.Role): void {
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
    resources: [bucket.arnForObjects('database/*')],
  }));
}
