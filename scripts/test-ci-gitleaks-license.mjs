// SPDX-License-Identifier: AGPL-3.0-or-later
/* eslint-disable no-console */
// Test to ensure the CI workflow has the GITLEAKS_LICENSE environment variable set in the gitleaks step.

const { readFile } = await import('node:fs/promises');

async function main() {
  const workflowPath = '.github/workflows/ci.yml';
  const content = await readFile(workflowPath, 'utf8');

  // We are looking for the line that sets GITLEAKS_LICENSE in the gitleaks step.
  // The step looks like:
  //   - name: gitleaks (full history)
  //     uses: gitleaks/gitleaks-action@v2
  //     env:
  //       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  //       GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
  //
  // We'll check for the presence of the string "GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}"
  // in the content.

  const expected = 'GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}';
  if (!content.includes(expected)) {
    console.error(`❌ Expected to find "${expected}" in ${workflowPath}`);
    process.exit(1);
  }

  console.log(`✅ Found "${expected}" in ${workflowPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});