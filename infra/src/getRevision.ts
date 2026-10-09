import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function getRevision(): string {
  const revision = process.env.CP_BACKEND_REVISION ?? execFileSync(
    'git', ['rev-parse', 'HEAD'], { cwd: resolve(__dirname, '../..'), encoding: 'utf8' },
  ).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error('CP_BACKEND_REVISION must be a full commit SHA');
  }
  return revision;
}
