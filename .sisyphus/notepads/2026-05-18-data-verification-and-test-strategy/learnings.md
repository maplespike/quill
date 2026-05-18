# Learnings — Data Verification & Test Strategy

## 2026-05-18

### Subagent reliability
- Subagents frequently claim work is done but files may not actually be written
- MUST verify every file exists and is correct before accepting
- Portal-side effects from agents corrupting worktree are a major problem

### registry.ts modification approach
- Adding a new optional field to ModuleInfo requires manually updating all 64 entries
- Batch edits using module `name:` as unique identifier for oldString matching
- Build passes after changes (tsc -b succeeds)

### Test patterns
- Use `node --test` with tsx and `node:test`/`node:assert/strict` imports
- Live tests gate behind `process.env.LIVE_DATA_TEST === 'true'`
- Module coverage test is purely informational, must not fail CI

### Portable Portal Prevention
- EVERY agent prompt must start with: `CRITICAL: Do NOT modify packages/portal/, Dockerfile.portal, or pnpm-lock.yaml`
- agents from `quick` category are most prone to portal side-effects — prefer `deep` for work near portal
- When agents must touch packages/ near portal, commit first then delegate

### JS/TS Gotchas That Cause Test Failures
- `Function.length` counts params BEFORE first default value: `function foo(x = 1)` has `length === 0`, NOT 1
- `as const` is compile-time ONLY — does NOT call `Object.freeze()` at runtime. `Object.isFrozen()` always returns `false`
- Dynamic imports from `__tests__/` resolve relative to test file location, NOT the ingestion root. Must use `new URL('../$(PATH)', import.meta.url)` or `path.join(INGESTION_DIR, path)`
- Default parameter values in async functions: `.length` is unreliable for verifying parameter acceptance. Use `toString().includes('paramName')` instead

### Session Hygiene
- `git add && git commit` after every verified batch — prevents portal agents from deleting untracked files
- Run `pnpm test` after EVERY delegation — catches assertion bugs immediately
- Verify generated scripts are callable immediately after creation: `node scripts/generate-metrics.mjs`
- When stashing, use `git stash -u` (includes untracked) to capture new files
- If stash pop fails on lockfile conflict: `git add pnpm-lock.yaml && git stash pop`

### Smoke test creation patterns
- 21 government-category modules needed smoke tests: committees, gic, gazette, oversight, elections, proactive-disclosure, ati, federal-budget, statcan, immigration, criminal-justice, indigenous-relations, federal, goc-spending, real-time-feeds, regional-authorities, municipal, municipal-long-tail, global-canada, geospatial, legislation
- Always verify exports by reading the module's index.ts barrel file — don't assume re-exports match registry.ts ingestFunctions
- GazettePart enum is NOT re-exported from gazette/index.ts (internal use only); test only what's in the barrel
- Dynamic import (`await import('..')`) works well for smoke tests — no need to import each named export
- Test files go in `__tests__/<module>.test.ts`, import paths use `../<module>/index.js` for subdirectory modules
- Verify with: `npx tsx --test src/ingestion/__tests__/<module>.test.ts`

### YAML workflow patterns
- ci.yml uses consistent patterns: checkout, pnpm setup, install, clean, build, test
- Live-data workflow needs `issues: write` permission for auto-issue creation
- Always double-check which file the agent is modifying (agents confuse auto-assign-milestone with ci.yml)
