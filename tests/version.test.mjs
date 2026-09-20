// The version an open tab compares against must always match the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p, base = root) => readFileSync(path.join(base, p), 'utf8');
const appVersion = (base = root) => read('src/App.jsx', base).match(/const APP_VERSION = '([^']+)'/)[1];

test('public/version.json, App.jsx and package.json agree', () => {
  const v = appVersion();
  assert.equal(JSON.parse(read('public/version.json')).version, v);
  assert.equal(JSON.parse(read('package.json')).version, v);
});

test('the version bump script keeps version.json in step', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'bump-'));
  for (const f of ['package.json', 'src/App.jsx', 'public/version.json', 'scripts/bump-version.cjs']) {
    mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
    cpSync(path.join(root, f), path.join(tmp, f));
  }
  execFileSync('node', [path.join(tmp, 'scripts/bump-version.cjs')]);
  const v = appVersion(tmp);
  assert.notEqual(v, appVersion(), 'bumped');
  assert.equal(JSON.parse(read('public/version.json', tmp)).version, v);
  assert.equal(JSON.parse(read('package.json', tmp)).version, v);
});
