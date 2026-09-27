#!/usr/bin/env tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = dirname(__dirname); // scripts/ -> repo root
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'ci.yml');

test('gitleaks step includes GITLEAKS_LICENSE environment variable', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  // Find the gitleaks (full history) step
  const lines = workflow.split('\n');
  let inGitleaksStep = false;
  let foundLicense = false;
  for (const line of lines) {
    if (line.includes('- name: gitleaks (full history)')) {
      inGitleaksStep = true;
      continue;
    }
    if (inGitleaksStep && line.trim().startsWith('- name:')) {
      // We've moved to the next step
      break;
    }
    if (inGitleaksStep && line.includes('GITLEAKS_LICENSE:')) {
      foundLicense = true;
      break;
    }
  }
  assert.ok(inGitleaksStep, 'Could not find gitleaks (full history) step in workflow');
  assert.ok(foundLicense, 'GITLEAKS_LICENSE environment variable not set in gitleaks step');
});