import { Duration, aws_ec2 as ec2, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export function createApi(scope: Construct, instance: ec2.Instance): cloudfront.Distribution {
  const distribution = new cloudfront.Distribution(scope, 'Api', {
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
  return distribution;
}
