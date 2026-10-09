import { Stack, CustomResource, Duration, aws_ec2 as ec2, aws_iam as iam,
  aws_lambda as lambda, aws_logs as logs, custom_resources as cr } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DeploymentConfig } from './configureBackend';

export interface ReleaseProps {
  instance: ec2.Instance;
  revision: string;
  config: DeploymentConfig;
  releaseToken?: string;
}

export function createRelease(scope: Construct, props: ReleaseProps): CustomResource {
  const stack = Stack.of(scope);
  const { instance, config } = props;
  const providerRole = new iam.Role(scope, 'ReleaseProviderRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
  });
  providerRole.addToPolicy(new iam.PolicyStatement({
    actions: ['ssm:SendCommand'],
    resources: [`arn:${stack.partition}:ec2:${stack.region}:${stack.account}:instance/${instance.instanceId}`,
      `arn:${stack.partition}:ssm:${stack.region}::document/AWS-RunShellScript`],
  }));
  providerRole.addToPolicy(new iam.PolicyStatement({
    actions: ['ssm:DescribeInstanceInformation', 'ssm:ListCommands', 'ssm:GetCommandInvocation'], resources: ['*'],
  }));
  const functions = ['on_event', 'is_complete'].map(handler => new lambda.Function(scope, handler, {
    runtime: lambda.Runtime.PYTHON_3_12, handler: `release.${handler}`, role: providerRole,
    code: lambda.Code.fromAsset(resolve(__dirname, '../provider')),
    timeout: Duration.seconds(60),
    logGroup: new logs.LogGroup(scope, `${handler}Logs`, { retention: logs.RetentionDays.ONE_MONTH }),
  }));
  const provider = new cr.Provider(scope, 'ReleaseProvider', {
    onEventHandler: functions[0], isCompleteHandler: functions[1],
    queryInterval: Duration.seconds(15), totalTimeout: Duration.minutes(55),
  });
  const release = new CustomResource(scope, 'BackendRelease', {
    serviceToken: provider.serviceToken,
    properties: {
      InstanceId: instance.instanceId, Revision: props.revision,
      Config: config, ReleaseToken: props.releaseToken ?? '',
      TlsScript: readFileSync(resolve(__dirname, '../scripts/configure_https.py')).toString('base64'),
      Script: readFileSync(resolve(__dirname, '../scripts/deploy.py')).toString('base64'),
    },
  });
  return release;
}
