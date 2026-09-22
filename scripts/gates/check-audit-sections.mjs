// Gate G5 oracle: the audit artifact must carry real content under each
// required section (>=200 chars), not just headings.
// Usage: node scripts/gates/check-audit-sections.mjs <audit.md>
import fs from 'node:fs';

const SECTIONS = ['## Live flow evidence', '## Frictions observed', '## Recommendations'];
const MIN_CHARS = 200;

const path = process.argv[2];
if (!path || !fs.existsSync(path)) {
  console.error(`audit not found: ${path}`);
  process.exit(2);
}

const text = fs.readFileSync(path, 'utf8');
let failed = false;

for (const sec of SECTIONS) {
  const idx = text.indexOf(sec);
  if (idx === -1) {
    console.error(`  missing section: ${sec}`);
    failed = true;
    continue;
  }
  const next = text.indexOf('\n## ', idx + sec.length);
  const body = text.slice(idx + sec.length, next === -1 ? undefined : next).trim();
  if (body.length < MIN_CHARS) {
    console.error(`  section ${sec} has only ${body.length} chars (need >= ${MIN_CHARS})`);
    failed = true;
  } else {
    console.log(`  ${sec}: ${body.length} chars`);
  }
}

if (failed) {
  console.error('audit sections: FAILED');
  process.exit(1);
}
console.log('audit sections: OK');
