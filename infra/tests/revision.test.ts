import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getRevision } from '../src/getRevision';

test('unset revision follows HEAD; an exported older SHA still explicitly wins', () => {
  const previous = process.env.CP_BACKEND_REVISION;
  try {
    delete process.env.CP_BACKEND_REVISION;
    assert.equal(getRevision(), execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
    process.env.CP_BACKEND_REVISION = 'a'.repeat(40);
    assert.equal(getRevision(), 'a'.repeat(40));
    process.env.CP_BACKEND_REVISION = 'main';
    assert.throws(getRevision, /full commit SHA/);
  } finally {
    if (previous === undefined) delete process.env.CP_BACKEND_REVISION;
    else process.env.CP_BACKEND_REVISION = previous;
  }
});
