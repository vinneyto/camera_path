export interface DomainConfig {
  domainName: string;
  hostedZoneId: string;
  tlsEmail: string;
}

/** Import the registrar-created DNS zone; registration is outside the app stack. */
export function getDomainConfig(): DomainConfig {
  const domainName = process.env.CP_DOMAIN ?? '';
  const hostedZoneId = (process.env.CP_HOSTED_ZONE_ID ?? '').replace(/^\/hostedzone\//, '');
  const tlsEmail = process.env.CP_TLS_EMAIL ?? '';
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domainName)) {
    throw new Error('CP_DOMAIN must be a lowercase domain name, e.g. camerapath.dev');
  }
  if (!/^Z[A-Z0-9]+$/.test(hostedZoneId)) throw new Error('CP_HOSTED_ZONE_ID must identify the public DNS zone');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tlsEmail)) throw new Error('CP_TLS_EMAIL must be a certificate contact email');
  return { domainName, hostedZoneId, tlsEmail };
}
