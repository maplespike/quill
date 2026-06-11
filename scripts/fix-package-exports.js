#!/usr/bin/env node
/**
 * Fix package.json exports to point to dist/ for production container builds.
 * Local dev uses tsx which handles .ts files, but compiled Node needs .js.
 */
const fs = require('fs');

['database', 'engine', 'notification-service'].forEach(pkg => {
  const path = 'packages/' + pkg + '/package.json';
  if (!fs.existsSync(path)) return;
  const p = JSON.parse(fs.readFileSync(path, 'utf8'));
  let changed = false;

  if (p.main && p.main.startsWith('./src/')) {
    p.main = p.main.replace('./src/', './dist/');
    changed = true;
  }
  if (p.exports) {
    Object.keys(p.exports).forEach(k => {
      const v = p.exports[k];
      if (typeof v === 'string' && v.startsWith('./src/')) {
        p.exports[k] = v.replace('./src/', './dist/');
        changed = true;
      }
    });
  }

  if (changed) {
    fs.writeFileSync(path, JSON.stringify(p, null, 2) + '\n');
    console.log('Fixed ' + pkg + ' exports to dist/');
  }
});
