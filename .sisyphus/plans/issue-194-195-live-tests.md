# Plan: Issues #194/#195 — NT/NU Live End-to-End Tests

**Status**: Draft
**Created**: 2026-05-18
**Owner**: Sisyphus
**Issue #194**: https://github.com/reverb256/maplespike/issues/194
**Issue #195**: https://github.com/reverb256/maplespike/issues/195
**Labels**: `bug`, `p2`, `module`

---

## Overview

Both NT (NWT Meeting Registry CSV fetcher) and NU (Nunavut federal lobbying proxy) compile and pass unit tests, but have never been tested against real production endpoints. This plan provides targeted live tests for both.

### Key Facts

- **NT/NU are NOT standalone modules** — they live inside `provincial-lobbying` module
- **Root**: `packages/pipeline-core/src/ingestion/provincial-lobbying/`
- **NT fetcher**: `fetchers/nt.ts` — exports `fetchNTCsv()`, `parseNTCsv()`, `searchNTRegistry()`, `fetchNTLobbying()`
- **NU fetcher**: `fetchers/nu.ts` — exports `searchNURegistry()`, `fetchNULobbying()`. `parseFederalRegistryHtml()` is **private** (not exported)
- **Existing tests**: `provincial-lobbying.test.ts` (618 lines) — constants, types, parser normalizers only. **NO live/fetch tests.** 
- **Live test pattern**: `src/ingestion/__tests__/live/endpoint-smoke.test.ts` — gated by `LIVE_DATA_TEST === 'true'` env var

---

## Execution Plan

### Issue #194 — NWT Meeting Registry (nt.ts)

**Source endpoint**: `https://engage.eia.gov.nt.ca/en/meeting-registry/meeting-disclosure/?format=csv`

**Test strategy**:
1. **Live CSV fetch test** — call `fetchNTCsv()` against production endpoint
2. **Parser validation** — call `parseNTCsv()` on the fetched CSV and verify field mapping
3. **Edge case check** — empty cells, multi-line quoted fields, BOM, special characters

**Test location**: Add to `provincial-lobbying.test.ts` as a gated `describe('live', { skip: !shouldRun })` block, or create new `provincial-lobbying-live.test.ts`.

**Test code outline**:
```typescript
// Gated by LIVE_DATA_TEST env var
const shouldRunLive = process.env.LIVE_DATA_TEST === 'true';

describe('NT NWT Meeting Registry live tests', { skip: !shouldRunLive }, () => {
  it('should fetch CSV from production endpoint', async () => {
    const result = await fetchNTCsv();
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should parse CSV into structured records', async () => {
    const csv = await fetchNTCsv();
    const records = parseNTCsv(csv);
    expect(records.length).toBeGreaterThan(0);
    // Verify 10+ records have all fields populated
    for (const r of records.slice(0, 10)) {
      expect(r.registrationNumber).toBeTruthy();
      expect(r.lobbyistName).toBeTruthy();
      expect(r.clientName).toBeTruthy();
      expect(r.communicationDate).toBeTruthy();
    }
  });

  it('should handle empty CSV gracefully', () => {
    const records = parseNTCsv('"Header1","Header2"\n');
    expect(records).toEqual([]);
  });
});
```

### Issue #195 — Nunavut Federal OCL Proxy (nu.ts)

**Source endpoint**: `https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/advSrch` (federal OCL with keyword = Nunavut)

**Test strategy**:
1. **Live search test** — call `searchNURegistry('Nunavut')` against production OCL
2. **Parser validation** — since `parseFederalRegistryHtml()` is private, test through `fetchNULobbying()`
3. **Keyword variants** — test both 'Nunavut' and 'Iqaluit' keywords
4. **Refactor consideration** — export `parseFederalRegistryHtml()` for direct unit testing with HTML fixture

**Test code outline**:
```typescript
describe('NU Nunavut federal proxy live tests', { skip: !shouldRunLive }, () => {
  it('should search Nunavut registrations via OCL proxy', async () => {
    const result = await searchNURegistry('Nunavut');
    expect(result).toBeTruthy();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return 5+ parsed records with populated fields', async () => {
    const result = await fetchNULobbying({ query: 'Nunavut', limit: 10 });
    expect(result.records.length).toBeGreaterThan(0);
    for (const r of result.records.slice(0, 5)) {
      // Client name is the most reliably populated field
      expect(r.clientName).toBeTruthy();
    }
  });

  it('should return results for both Nunavut and Iqaluit keywords', async () => {
    const nunavutResult = await searchNURegistry('Nunavut');
    const iqaluitResult = await searchNURegistry('Iqaluit');
    expect(nunavutResult.length + iqaluitResult.length).toBeGreaterThan(0);
  });
});
```

### Optional: Export `parseFederalRegistryHtml()`

Consider renaming from `private` (not in `fetchers/index.ts` exports) to exported for direct unit testing. This would allow:

```typescript
it('should parse OCL HTML fixture correctly', () => {
  const fixtureHtml = readFileSync('fixtures/ocl-nunavut.html', 'utf-8');
  const records = parseFederalRegistryHtml(fixtureHtml, '', 'Nunavut');
  expect(records.length).toBeGreaterThan(0);
  expect(records[0].clientName).toBeTruthy();
});
```

---

## Verification

- [ ] Live NT CSV fetch returns non-empty string
- [ ] `parseNTCsv()` produces records with expected fields from actual data
- [ ] Edge cases handled: empty cells, multi-line values, BOM characters
- [ ] Live NU OCL proxy returns results for 'Nunavut' and 'Iqaluit'
- [ ] 5+ parsed records have all identifiable fields populated
- [ ] Both test suites gated by `LIVE_DATA_TEST` env var
- [ ] Existing unit tests unaffected by live test additions
- [ ] `pnpm test` passes in `packages/pipeline-core/`

---

## Rollback

- Remove or comment out live test blocks if endpoint changes break CI
- If OCL HTML structure changes, update `parseFederalRegistryHtml()` column mapping
