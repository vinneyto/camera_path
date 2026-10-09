import { RemovalPolicy, aws_secretsmanager as secrets } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface BackendSecrets {
  jwt: secrets.Secret;
  openai: secrets.ISecret;
}

export function createSecrets(scope: Construct, name: string): BackendSecrets {
  const jwt = new secrets.Secret(scope, 'JwtSecret', {
    secretName: `${name}/jwt`, generateSecretString: { passwordLength: 64, excludePunctuation: true },
  });
  jwt.applyRemovalPolicy(RemovalPolicy.RETAIN);
  // No value is authored in CloudFormation; set this optional secret after deployment.
  const openaiResource = new secrets.CfnSecret(scope, 'OpenAiSecret', {
    name: `${name}/openai`, description: 'Set SecretString to the OpenAI API key after deployment',
  });
  openaiResource.applyRemovalPolicy(RemovalPolicy.RETAIN);
  const openai = secrets.Secret.fromSecretCompleteArn(scope, 'OpenAiReference', openaiResource.ref);
  return { jwt, openai };
}
