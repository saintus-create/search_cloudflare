#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const mode = args.has('--write') ? 'write' : 'check';
const verifyRemote = args.has('--verify-remote');
if ([...args].some((arg) => !['--write', '--check', '--verify-remote'].includes(arg))) {
  console.error('Usage: node scripts/configure-cloudflare.mjs [--check|--write] [--verify-remote]');
  process.exit(2);
}

const required = [
  'EXPECTED_CF_ACCOUNT_ID',
  'EXPECTED_PRODUCTION_D1_ID',
  'EXPECTED_PREVIEW_D1_ID',
  'EXPECTED_RATE_LIMIT_KV_ID',
  'INGEST_ALLOWED_HOSTS',
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing explicit infrastructure inputs: ${missing.join(', ')}`);
  process.exit(1);
}

const accountId = process.env.EXPECTED_CF_ACCOUNT_ID.trim();
const productionD1 = process.env.EXPECTED_PRODUCTION_D1_ID.trim();
const previewD1 = process.env.EXPECTED_PREVIEW_D1_ID.trim();
const rateLimitKv = process.env.EXPECTED_RATE_LIMIT_KV_ID.trim();
const allowedHosts = [...new Set(process.env.INGEST_ALLOWED_HOSTS
  .split(',').map((host) => host.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean))];

const assert = (condition, message) => {
  if (!condition) { console.error(message); process.exit(1); }
};
assert(/^[a-f0-9]{32}$/i.test(accountId), 'EXPECTED_CF_ACCOUNT_ID must be a 32-character hex account ID.');
assert(/^[a-f0-9-]{36}$/i.test(productionD1), 'EXPECTED_PRODUCTION_D1_ID must be a D1 UUID.');
assert(/^[a-f0-9-]{36}$/i.test(previewD1), 'EXPECTED_PREVIEW_D1_ID must be a D1 UUID.');
assert(productionD1 !== previewD1, 'Production and preview D1 IDs must be different.');
assert(/^[a-f0-9]{32}$/i.test(rateLimitKv), 'EXPECTED_RATE_LIMIT_KV_ID must be a 32-character KV ID.');
assert(allowedHosts.length > 0, 'INGEST_ALLOWED_HOSTS must contain at least one exact hostname.');
assert(allowedHosts.every((host) => /^[a-z0-9.-]+$/.test(host) && !host.includes('*')),
  'INGEST_ALLOWED_HOSTS accepts exact hostnames only; wildcards and URLs are forbidden.');

const config = {
  $schema: './node_modules/wrangler/config-schema.json',
  name: 'cloudflare-search-portal',
  main: '@astrojs/cloudflare/entrypoints/server',
  compatibility_date: '2026-08-16',
  account_id: accountId,
  d1_databases: [{
    binding: 'DB',
    database_name: 'worker_1_db',
    database_id: productionD1,
    preview_database_id: previewD1,
    migrations_dir: 'migrations',
  }],
  kv_namespaces: [{ binding: 'RATE_LIMIT', id: rateLimitKv }],
  ai: { binding: 'AI', remote: true },
  vars: { INGEST_ALLOWED_HOSTS: allowedHosts.join(',') },
  observability: { enabled: true },
};

const path = resolve('wrangler.jsonc');
const expected = `${JSON.stringify(config, null, 2)}\n`;
if (mode === 'write') {
  writeFileSync(path, expected, { mode: 0o600 });
  console.log(`Wrote ${path} from explicitly confirmed infrastructure inputs.`);
} else {
  assert(existsSync(path), 'wrangler.jsonc is missing. Run this script with --write after confirming IDs.');
  assert(readFileSync(path, 'utf8') === expected,
    'wrangler.jsonc does not exactly match confirmed environment inputs. Refusing to continue.');
  console.log('wrangler.jsonc matches the explicitly confirmed infrastructure inputs.');
}

if (verifyRemote) {
  assert(process.env.CLOUDFLARE_ACCOUNT_ID === accountId,
    'CLOUDFLARE_ACCOUNT_ID must match EXPECTED_CF_ACCOUNT_ID for remote verification.');
  const wrangler = resolve('node_modules/.bin/wrangler');
  assert(existsSync(wrangler), 'Wrangler is not installed. Run npm ci first.');
  const runJson = (...command) => JSON.parse(execFileSync(wrangler, command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: process.env,
  }));
  const databases = runJson('d1', 'list', '--json');
  assert(databases.some((item) => item.uuid === productionD1 || item.id === productionD1),
    'Confirmed production D1 database is not visible to this account.');
  assert(databases.some((item) => item.uuid === previewD1 || item.id === previewD1),
    'Confirmed preview D1 database is not visible to this account.');
  const namespaces = runJson('kv', 'namespace', 'list', '--json');
  assert(namespaces.some((item) => item.id === rateLimitKv),
    'Confirmed RATE_LIMIT KV namespace is not visible to this account.');
  console.log('Cloudflare account, D1 databases, and RATE_LIMIT KV namespace verified read-only.');
}
