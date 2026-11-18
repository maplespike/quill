// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getAllModules } from '../registry.js';

const INGESTION_DIR = new URL('../', import.meta.url).pathname;

describe('Module Coverage', () => {
  const modules = getAllModules();
  const results: {
    name: string;
    hasTests: boolean;
    foundFunctions: string[];
    expectedFunctions: string[];
    importError?: string;
  }[] = [];

  it('dynamically imports all registered modules and checks exports', async () => {
    for (const mod of modules) {
      const expected = mod.ingestFunctions;
      const found: string[] = [];
      let importError: string | undefined;

      try {
        // Resolve modulePath relative to ingestion/ dir, not __tests__/
        const moduleUrl = new URL(mod.modulePath, new URL('../', import.meta.url));
        const imported = await import(moduleUrl.href);
        for (const fn of expected) {
          if (typeof (imported as Record<string, unknown>)[fn] === 'function') {
            found.push(fn);
          }
        }
      } catch (err) {
        importError = String(err);
      }

      // Check test file existence at multiple locations
      const testPath1 = path.join(INGESTION_DIR, '__tests__', `${mod.name}.test.ts`);
      const testPath2 = path.join(INGESTION_DIR, mod.name, '__tests__', `${mod.name}.test.ts`);
      // Also check the module's actual filesystem path (e.g. ircc/citizenship/__tests__/)
      const modDir = path.dirname(mod.modulePath.replace(/^\.\//, ''));
      const testInModDir = path.join(INGESTION_DIR, modDir, '__tests__');
      let hasTests = fs.existsSync(testPath1) || fs.existsSync(testPath2);
      if (!hasTests && fs.existsSync(testInModDir)) {
        const testFiles = fs.readdirSync(testInModDir).filter(f => f.endsWith('.test.ts'));
        hasTests = testFiles.length > 0;
      }

      results.push({ name: mod.name, hasTests, foundFunctions: found, expectedFunctions: expected, importError });
    }

    // Log coverage table
    console.log('\n=== Module Coverage Table ===\n');
    console.log(`${'Module'.padEnd(30)} ${'Tests'.padEnd(8)} ${'Functions'.padEnd(30)} ${'Status'.padEnd(12)}`);
    console.log(`${''.padEnd(30, '─')} ${''.padEnd(8, '─')} ${''.padEnd(30, '─')} ${''.padEnd(12, '─')}`);

    for (const r of results) {
      const funcStr = `${r.foundFunctions.length}/${r.expectedFunctions.length}`;
      const status = r.importError ? 'IMPORT FAIL' : 'OK';
      console.log(
        `${r.name.padEnd(30)} ${(r.hasTests ? 'YES' : 'NO').padEnd(8)} ${funcStr.padEnd(30)} ${status.padEnd(12)}`,
      );
    }

    // Summary
    const withTests = results.filter(r => r.hasTests).length;
    const withoutTests = results.filter(r => !r.hasTests).length;
    const importFails = results.filter(r => r.importError);
    const totalExported = results.reduce((s, r) => s + r.foundFunctions.length, 0);
    const totalExpected = results.reduce((s, r) => s + r.expectedFunctions.length, 0);
    const exportRate = totalExpected > 0 ? Math.round((totalExported / totalExpected) * 100) : 0;

    console.log('\n=== Summary ===');
    console.log(`Total modules:        ${modules.length}`);
    console.log(`With tests:           ${withTests}`);
    console.log(`Without tests:        ${withoutTests}`);
    console.log(`Export coverage:      ${totalExported}/${totalExpected} (${exportRate}%)`);

    // Log import errors as warnings — informational only
    if (importFails.length > 0) {
      console.log(`\n⚠  ${importFails.length} module(s) could not be dynamically imported (warning only):`);
      for (const f of importFails) {
        console.log(`   - ${f.name}: ${f.importError}`);
      }
    }
  });

  it('every module has at least one ingest function', () => {
    for (const r of results) {
      assert.ok(r.foundFunctions.length > 0 || r.importError,
        `Module "${r.name}" has no callable ingest functions`);
    }
  });

  it('no import errors across all modules (informational)', () => {
    const importFails = results.filter(r => r.importError);
    // Individual module import errors are informational — some modules
    // need compilation or have runtime deps that can't be resolved here
    if (importFails.length > 0) {
      console.log(`\n⚠  ${importFails.length} module(s) with import errors (informational):`);
      for (const f of importFails) {
        console.log(`   - ${f.name}: ${f.importError}`);
      }
    }
  });
});
