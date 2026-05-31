import { getAllTools } from './src/tools/index.js';

const failures = [];
for (const t of getAllTools()) {
  const start = Date.now();
  try {
    const result = await Promise.race([
      t.handler({ query: '' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    if (!result || !result.content) {
      failures.push(`${t.definition.name}: null/undefined`);
    }
  } catch (e) {
    failures.push(`${t.definition.name}: ${e.message} (${Date.now() - start}ms)`);
  }
}
console.log(`Failures: ${failures.length}/${getAllTools().length}`);
for (const f of failures.slice(0, 15)) console.log(`  - ${f}`);
