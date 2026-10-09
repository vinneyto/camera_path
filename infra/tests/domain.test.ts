import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDomainConfig } from '../src/getDomainConfig';

test('domain and zone come from the environment and have no deployment-specific defaults', () => {
  const names = ['CP_DOMAIN', 'CP_HOSTED_ZONE_ID', 'CP_TLS_EMAIL'] as const;
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) delete process.env[name];
    assert.throws(getDomainConfig, /CP_DOMAIN/);
    process.env.CP_DOMAIN = 'example.com';
    assert.throws(getDomainConfig, /CP_HOSTED_ZONE_ID/);
    process.env.CP_HOSTED_ZONE_ID = '/hostedzone/ZTEST123';
    assert.throws(getDomainConfig, /CP_TLS_EMAIL/);
    process.env.CP_TLS_EMAIL = 'ops@example.com';
    assert.deepEqual(getDomainConfig(), { domainName: 'example.com', hostedZoneId: 'ZTEST123', tlsEmail: 'ops@example.com' });
  } finally {
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});
