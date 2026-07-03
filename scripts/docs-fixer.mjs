#!/usr/bin/env node
/**
 * docs-fixer.mjs — Find and fix documentation issues
 *
 * Usage: node scripts/docs-fixer.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// Current correct metrics from metrics.json
const CORRECT_METRICS = {
  modules: 144,
  mcpTools: 129,
  mcpToolFiles: 164,
  tsLines: 188000, // ~188K
  tsFiles: 1410,
  packages: 13
};

// Common wrong metrics patterns
const WRONG_PATTERNS = [
  { pattern: /130 MCP tools/, correct: '129 MCP tools' },
  { pattern: /135 MCP tools/, correct: '129 MCP tools' },
  { pattern: /140 MCP tools/, correct: '129 MCP tools' },
  { pattern: /164 MCP tools/, correct: '129 MCP tools' },
  { pattern: /126 data modules/, correct: '144 data modules' },
  { pattern: /142 data modules/, correct: '144 data modules' },
  { pattern: /~182K lines TS/, correct: '~188K lines TS' },
  { pattern: /~178K lines TS/, correct: '~188K lines TS' },
  { pattern: /12 packages/, correct: '13 packages' },
  { pattern: /\b34 tools\b/, correct: '129 tools' },
  { pattern: /\b53 tools\b/, correct: '129 tools' },
  { pattern: /\b94 tools\b/, correct: '129 tools' },
  { pattern: /\b22 tools\b/, correct: '129 tools' },
  { pattern: /\b87 search.*files/, correct: '164 tool definition files' },
];

// Files to check
const DOCS_FILES = [
  'README.md',
  'AGENTS.md',
  'ROADMAP.md',
  'docs/ARCHITECTURE.md',
  'packages/docs/guide/what-is-maplespike.md',
  'packages/docs/guide/getting-started.md',
  'packages/quill-mcp/README.md',
];

console.log('🔍 Documentation Metrics Fixer');
console.log('================================\n');

let totalIssues = 0;
let totalFixed = 0;

for (const docPath of DOCS_FILES) {
  const fullPath = join(ROOT, docPath);
  try {
    const content = readFileSync(fullPath, 'utf-8');
    let issues = [];
    let fixed = false;

    for (const { pattern, correct } of WRONG_PATTERNS) {
      if (pattern.test(content)) {
        const matches = content.match(pattern);
        issues.push({
          pattern: pattern.source,
          found: matches[0],
          correct: correct,
          line: getLineNumber(content, matches[0])
        });
      }
    }

    if (issues.length > 0) {
      console.log(`📄 ${docPath}`);
      console.log(`   Found ${issues.length} issue(s):`);

      let newContent = content;
      for (const issue of issues) {
        console.log(`   ❌ Line ${issue.line}: "${issue.found}" → "${issue.correct}"`);
        newContent = newContent.replace(issue.pattern, issue.correct);
        totalIssues++;
      }

      // Write fixed content
      writeFileSync(fullPath, newContent, 'utf-8');
      totalFixed += issues.length;
      fixed = true;
      console.log(`   ✅ Fixed ${issues.length} issue(s)\n`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  File not found: ${docPath}\n`);
    } else {
      console.error(`❌ Error processing ${docPath}: ${error.message}\n`);
    }
  }
}

console.log('================================');
console.log(`📊 Summary: ${totalFixed}/${totalIssues} issues fixed`);
if (totalIssues > 0) {
  console.log('💡 Review the changes and commit them');
} else {
  console.log('✅ No issues found!');
}

function getLineNumber(content, searchString) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return '?';
}