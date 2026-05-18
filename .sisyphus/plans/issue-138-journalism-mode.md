# Plan: Issue #138 — Journalism Mode with Editorial Overrides

**Status**: Draft
**Created**: 2026-05-18
**Owner**: Sisyphus
**Issue**: https://github.com/reverb256/maplespike/issues/138
**Labels**: `enhancement`, `p2`

---

## Overview

Journalists need editorial controls: annotate data points, override stale citations, add context notes, and flag anomalies. This requires a "journalism mode" toggle with backend API endpoints, MCP tools, and portal UI.

### Current State

| Component | Status |
|-----------|--------|
| `Tenant.journalismMode` field | ✅ Already exists in types, DB schemas (D1, SQLite, PG), and in-memory auth |
| Behavioral gating on `journalismMode` | ❌ No code reads this field — zero behavioral effect |
| Annotation DB schema | ❌ Does not exist |
| Annotation API endpoints | ❌ Do not exist |
| Annotation MCP tools | ❌ Do not exist |
| Editorial portal UI | ❌ Does not exist |
| Email service | ✅ Exists (`email.ts`) for notifications |
| Portal UI components | ✅ 20 shadcn/ui components available (Dialog, Sheet, Tabs, Textarea, Card, etc.) |

### Related

- Frostbite Gazette is the primary dogfood consumer
- Issue #64 (Backend-Driven UI) may provide the foundation
- Issue #130 (Email notifications) — annotations could trigger alerts

---

## Execution Plan

### Phase 1: Annotation Storage (backend foundation)

#### 1a. Database Schema

Add annotation table to all storage backends (`storage.ts`, `sqlite-storage.ts`, `pg-storage.ts`):

```sql
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  target_type TEXT NOT NULL,    -- 'citation', 'record', 'search_result', 'brief'
  target_id TEXT NOT NULL,      -- SHA-256 hash or record ID
  annotation_type TEXT NOT NULL DEFAULT 'note',  -- 'note', 'override', 'flag', 'correction'
  content TEXT NOT NULL,
  replaces_value TEXT,          -- For 'override' type: the corrected value
  citation_hash TEXT,           -- Optional new citation hash for overrides
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, target_type, target_id, annotation_type)
);
```

#### 1b. Storage Interface Methods

Add to `MapleSpikeStorage`:
- `createAnnotation(params)` → upsert annotation
- `getAnnotations(targetType, targetId)` → list annotations for a target
- `getAnnotationsByTenant(tenantId, limit, offset)` → all tenant annotations
- `deleteAnnotation(id)` → remove annotation

Implement in all 3 storage backends.

#### 1c. Gate annotation writes on `journalismMode`

In storage layer or route handler: if `!tenant.journalismMode`, reject annotation CRUD with 403.

### Phase 2: API Endpoints

Add to `packages/api-server/src/routes/` — new `annotations.ts`:

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| `GET` | `/v1/annotations/:targetType/:targetId` | `getAnnotations` | List annotations for a target |
| `POST` | `/v1/annotations` | `createAnnotation` | Create/update annotation |
| `DELETE` | `/v1/annotations/:id` | `deleteAnnotation` | Remove annotation |
| `GET` | `/v1/annotations` | `listMyAnnotations` | List all for current tenant |

Follow existing route patterns in `index.ts`:
```typescript
{ pattern: /^\/v1\/annotations\/?$/, method: 'POST', params: [], handler: handleCreateAnnotation },
{ pattern: /^\/v1\/annotations\/([^/]+)\/([^/]+)\/?$/, method: 'GET', params: ['targetType', 'targetId'], handler: handleGetAnnotations },
```

Use existing `validateBody()` for POST schema:
```typescript
validateBody(body, {
  target_type: { type: 'string', required: true, maxLength: 50 },
  target_id: { type: 'string', required: true, maxLength: 128 },
  annotation_type: { type: 'string', required: true, maxLength: 20 },
  content: { type: 'string', required: true, maxLength: 10000 },
});
```

### Phase 3: Citation Override & Resolver

When `annotation_type === 'override'`:
- The `replaces_value` and `citation_hash` fields contain the corrected data
- MCP tools check annotations when returning results for journalism-mode tenants
- Override appears in search results as a note: "Citation overridden by [user] on [date]"

### Phase 4: MCP Tools

Add to `packages/mcp-server/src/tools/`:

1. **`get_annotations`** — proxy tool via API client: `GET /v1/annotations/:targetType/:targetId`
2. **`annotate`** — proxy tool: `POST /v1/annotations`
3. **`search_annotations`** — proxy tool: `GET /v1/annotations` with search params

Register in `packages/mcp-server/src/tools/index.ts` following existing pattern:
```typescript
import * as getAnnotations from './get-annotations.js';
import * as annotate from './annotate.js';
import * as searchAnnotations from './search-annotations.js';
```

### Phase 5: Portal UI

Add annotation editor to relevant portal pages:

1. **Dashboard** (`dashboard.astro`): Add "Journalism Mode" toggle in user settings section. When enabled, show annotation controls on data displays.

2. **Citation page** (`citation.astro`): Add "Override" button next to each citation — opens Dialog with textarea for new citation hash + justification.

3. **Explorer/Workspace** (`explorer.astro`, `workspace.astro`): Search results show annotation badges (e.g., "📝 2 notes", "⚠️ 1 citation override").

4. **New annotation panel**: Use existing shadcn `Sheet` component (slide-over panel) for annotation editor, same pattern as workspace.astro's API keys slide-over.

### Phase 6: Frostbite Gazette Integration

The Gazette app should:
- Read `journalismMode` flag from auth context
- Display annotation badges on data records
- Surface citation overrides with "corrected" styling
- Allow journalists to add context notes from the Gazette UI

---

## Verification

- [ ] `annotations` table exists in D1, SQLite, and PG schemas
- [ ] Create/read/delete annotation works via API (authenticated)
- [ ] Tenant without `journalismMode=true` gets 403 on annotation write
- [ ] MCP `get_annotations` returns annotations for a given target
- [ ] Citation overrides appear in search results with override indicator
- [ ] Portal journalism mode toggle enables annotation UI
- [ ] Annotations survive tenant key rotation (keyed by tenant_id, not API key)
- [ ] `pnpm test` passes in api-server, mcp-server, pipeline-core
- [ ] Frostbite Gazette test app can consume annotations

---

## Risks

| Risk | Mitigation |
|------|------------|
| Annotation DB schema conflicts with existing migrations | Add as new migration (not schema change) |
| Journalists override citations with bad data | Audit trail: annotation created_by + created_at is immutable |
| Performance: annotations fetched on every search result | Cache annotations per target_id, TTL 5 min |
| Portal UI scope creep | Keep MVP to: citation override + notes on search results. Anomaly flagging = Phase 2 |
