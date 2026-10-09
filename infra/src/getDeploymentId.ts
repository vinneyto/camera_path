export function getDeploymentId(): string {
  const deploymentId = process.env.CP_DEPLOYMENT_ID;
  if (!deploymentId || !/^[a-z0-9][a-z0-9-]{2,31}$/.test(deploymentId)) {
    throw new Error('CP_DEPLOYMENT_ID must contain 3–32 lowercase letters, digits or hyphens');
  }
  return deploymentId;
}
