import { RemovalPolicy, aws_s3 as s3, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createLibrary(scope: Construct, frontendOrigins: string[]): s3.Bucket {
  const library = new s3.Bucket(scope, 'Library', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    encryption: s3.BucketEncryption.S3_MANAGED, enforceSSL: true,
    versioned: false, removalPolicy: RemovalPolicy.RETAIN,
    cors: [{ allowedOrigins: frontendOrigins,
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD, s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedHeaders: ['*'], exposedHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
      maxAge: 300 }],
  });
  return library;
}

/** Both EC2 and the optional local user receive the same library-only permissions. */
export function grantLibraryAccess(library: s3.IBucket, identity: iam.Role | iam.User): void {
  identity.addToPolicy(new iam.PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
    resources: [library.arnForObjects('library/*')],
  }));
  identity.addToPolicy(new iam.PolicyStatement({
    actions: ['s3:ListBucket'], resources: [library.bucketArn],
    conditions: { StringLike: { 's3:prefix': ['library/*'] } },
  }));
}
