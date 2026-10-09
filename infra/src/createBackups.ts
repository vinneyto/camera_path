import { RemovalPolicy, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createBackups(scope: Construct): s3.Bucket {
  const backups = new s3.Bucket(scope, 'DatabaseBackups', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: RemovalPolicy.RETAIN,
  });
  return backups;
}
