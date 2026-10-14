/**
 * countTsFiles must sum every .ts file. The previous counter piped find into
 * `xargs wc -l | tail -1`, which kept only the last chunk once the file list
 * no longer fit in one exec. That recorded pipeline-core as 78 lines.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { countTsFiles } from './generate-metrics.mjs';

test('countTsFiles sums every file, including a list large enough to split xargs', () => {
  const root = mkdtempSync(join(tmpdir(), 'quill-count-ts-'));
  try {
    mkdirSync(join(root, 'keep'));
    mkdirSync(join(root, 'node_modules', 'dep'), { recursive: true });
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'dep', 'skip.ts'), 'no\n');
    writeFileSync(join(root, 'dist', 'skip.ts'), 'no\n');
    writeFileSync(join(root, 'note.txt'), 'no\n');
    writeFileSync(join(root, 'empty.ts'), '');

    let expected = 0;
    for (let i = 0; i < 200; i++) {
      const body = `export const n${i} = ${i};\n`;
      writeFileSync(join(root, 'keep', `f${i}.ts`), body);
      expected += 1;
    }
    writeFileSync(join(root, 'partial.ts'), 'one\ntwo');
    expected += 2;

    const counted = countTsFiles(root);
    assert.equal(counted.files, 202);
    assert.equal(counted.lines, expected);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
