#!/usr/bin/env tsx
/**
 * The portal Pages workflow must stay a static deploy to maplespike-quill
 * on GitHub-hosted runners, production only from main, and must name a
 * missing Cloudflare secret in an ::error:: annotation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(ROOT, '.github/workflows/deploy-portal-pages.yml');

test('portal Pages workflow deploys static output to maplespike-quill', () => {
  const text = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(text, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(text, /self-hosted/);
  assert.match(text, /--project-name=maplespike-quill/);
  assert.match(text, /cd "\$\{GITHUB_WORKSPACE\}\/packages\/portal"/);
  assert.match(text, /pages deploy dist/);
  assert.match(text, /--commit-dirty/);
  assert.doesNotMatch(text, /--config[ =].*wrangler\.toml/);
  assert.match(text, /echo "::error::missing secret CLOUDFLARE_API_TOKEN"/);
  assert.match(text, /echo "::error::missing secret CLOUDFLARE_ACCOUNT_ID"/);
  assert.match(text, /GITHUB_REF\}" = "refs\/heads\/main"/);
  assert.match(text, /deploy_branch="main"/);
  assert.match(text, /refusing to deploy this event as the production branch/);
  assert.doesNotMatch(text, /\b(d1|kv|r2)_namespaces\b/i);
  assert.doesNotMatch(text, /--(kv|d1|r2)[\s=]/i);
  assert.match(text, /https:\/\/api\.maplespike\.ca/);
  const portalConfig = fs.readFileSync(path.join(ROOT, 'packages/portal/wrangler.toml'), 'utf8');
  assert.doesNotMatch(portalConfig, /\[\[(kv_namespaces|d1_databases|r2_buckets)\]\]/);
});
