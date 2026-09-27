// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('CI workflow gitleaks license secret', () => {
  it('should have GITLEAKS_LICENSE secret in the gitleaks step', async () => {
    const workflowPath = '.github/workflows/ci.yml';
    const workflow = readFileSync(workflowPath, 'utf8');
    const lines = workflow.split('\n');

    // Find the index of the gitleaks step
    const gitleaksStepIndex = lines.findIndex(line => line.trim() === '- name: gitleaks (full history)');
    assert.notEqual(gitleaksStepIndex, -1, 'Could not find gitleaks step in CI workflow');

    // From that index, look for the env block and then the GITLEAKS_LICENSE line
    let foundEnv = false;
    for (let i = gitleaksStepIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('env:')) {
        foundEnv = true;
        continue;
      }
      if (foundEnv && line.trim() && !line.startsWith(' ')) {
        // We've left the env block (next non-indented line)
        break;
      }
      if (foundEnv && line.includes('GITLEAKS_LICENSE:')) {
        // Check that it uses the secret
        assert.match(line, /\${{ secrets\.GITLEAKS_LICENSE }}/, 'GITLEAKS_LICENSE secret not found in gitleaks step env');
        return; // Test passes
      }
    }

    // If we get here, we didn't find the secret
    assert.fail('GITLEAKS_LICENSE secret not found in gitleaks step env');
  });
});