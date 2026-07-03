> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# Plan: Issue #130 — Email Notifications and Alerting System

**Status**: Draft
**Created**: 2026-05-18
**Owner**: Sisyphus
**Issue**: https://github.com/reverb256/quill/issues/130
**Labels**: `enhancement`, `p2`

---

## Overview

No alerting system exists for data changes, committee meeting updates, or regulatory changes. Users must poll the API. This plan adds email notifications for tracked topics with configurable per-user subscriptions.

### Current State

| Component | Status |
|-----------|--------|
| Email service (`api-server/src/email.ts`) | ✅ Exists — SendGrid + console fallback, supports verification/welcome/contact emails |
| User authentication | ✅ API keys, email verification flow exists |
| User preferences DB | ❌ No subscription/preferences table |
| Cron job infrastructure | ✅ K8s cron directory exists at `k8s/cron/` with ingestion cron jobs |
| Alert triggers | ❌ No data change detection mechanism |
| Related: blog RSS (#51) | ✅ Already wired |
| Related: journalism mode (#138) | Annotations could trigger alerts (separate issue) |

### What's Needed

1. **Subscription model** — per-user topic subscriptions stored in DB
2. **Alert engine** — cron job that checks for new/changed data matching subscriptions
3. **Email dispatch** — send templated notification emails via existing `email.ts`
4. **API endpoints** — manage subscriptions (CRUD)
5. **Portal UI** — subscription management page
6. **MCP tools** — (optional) subscribe/unsubscribe via MCP

---

## Execution Plan

### Phase 1: Database Schema

Add subscription table to all storage backends (`storage.ts`, `sqlite-storage.ts`, `pg-storage.ts`):

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  topic_type TEXT NOT NULL,     -- 'committee', 'gazette', 'lobbying', 'legislation', 'keyword'
  topic_id TEXT,                -- Specific committee ID, gazette part, etc.
  topic_keyword TEXT,           -- For keyword-based subscriptions
  frequency TEXT NOT NULL DEFAULT 'daily',  -- 'realtime', 'daily', 'weekly', 'digest'
  last_checked_at TEXT,         -- Last time alert engine checked this subscription
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, topic_type, topic_id, topic_keyword)
);

CREATE TABLE alert_history (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  target_url TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);
```

### Phase 2: Storage Interface Methods

Add to `QuillStorage`:
- `createSubscription(params)` → create subscription
- `getSubscriptions(tenantId)` → list active subscriptions
- `deleteSubscription(id)` → remove subscription
- `getAllActiveSubscriptions()` → for alert engine (all tenants)
- `recordAlert(alert)` → log sent alert
- `getAlertHistory(tenantId, limit)` → recent alerts for a tenant

### Phase 3: API Endpoints

Add `packages/api-server/src/routes/subscriptions.ts`:

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/v1/subscriptions` | List my subscriptions |
| `POST` | `/v1/subscriptions` | Create subscription |
| `DELETE` | `/v1/subscriptions/:id` | Remove subscription |
| `GET` | `/v1/alerts` | Recent alert history |

### Phase 4: Alert Engine (Cron Job)

New file: `packages/api-server/src/alert-engine.ts` (or `packages/engine/src/alert-engine/`)

The engine runs as a scheduled job and checks:

1. **Committee alerts**: Compare `last_checked_at` with committee evidence update timestamps. If new evidence exists since last check, send alert.

2. **Gazette keyword alerts**: Fetch Canada Gazette RSS, check each entry title/summary against subscriber keywords.

3. **Lobbying registration alerts**: Check OCL registry for new registrations matching subscribed organizations/keywords.

4. **Daily digest**: For `frequency='daily'` subscriptions, batch all new items into one email.

**Trigger schedule**:
- Realtime subscriptions: run every 15 min (committee, lobbying changes)
- Daily digest: run once per day (configurable at midnight ET)
- Weekly digest: run Sunday midnight ET

### Phase 5: Email Templates

Extend `email.ts` with new functions:
- `sendAlertEmail(params)` — single alert with title, summary, link
- `sendDigestEmail(params)` — batched digest: list of new items with links

Templates should be clean HTML (matching existing EmailConfig pattern) with:
- Alert title + brief summary
- Link to relevant page on portal
- Unsubscribe link (one-click)

### Phase 6: K8s Cron Job

Add `k8s/cron/alert-engine.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: alert-engine
  namespace: quill-prod
spec:
  schedule: "*/15 * * * *"   # Every 15 min for realtime
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: alert-engine
            image: ghcr.io/reverb256/quill/quill-api-server:latest
            command: ["node", "dist/alert-engine.js"]
            env:
            - name: SENDGRID_API_KEY
              valueFrom:
                secretKeyRef:
                  name: sendgrid
                  key: api-key
```

### Phase 7: Portal UI

Add subscription management to portal:
1. **Workspace page** (`workspace.astro`): Add "Notifications" section with subscription table
2. **New subscription form**: Select topic type, enter keyword/selection, choose frequency
3. **Alert history**: Show recent alerts with read/unread status (use localStorage or API)

---

## Related: Issue #138 (Journalism Mode)

When journalism mode is active:
- Data annotation changes can trigger alerts to subscribed journalists
- Citation overrides generate "citation change detected" alerts
- Anomaly flags can notify the journalist who created them when related data changes

---

## Verification

- [ ] Subscription CRUD works via API (authenticated)
- [ ] `createSubscription` validates topic_type in known list
- [ ] Alert engine fetches committee/gazette/lobbying changes correctly
- [ ] Email sent for new matching content (SendGrid in prod, console in dev)
- [ ] Digest batches multiple alerts into one email
- [ ] Unsubscribe link works (one-click, no auth required)
- [ ] Alert history shows in API response
- [ ] Portal subscription management UI works (create, list, delete)
- [ ] K8s CronJob deploys and runs without error
- [ ] No duplicate alerts for the same subscription+item (check alert_history before sending)

---

## Risks

| Risk | Mitigation |
|------|------------|
| High email volume during data dumps | Cooldown per subscription (min 15 min between alerts for same subscription) |
| Unsubscribed users still get mail | Unsubscribe link immediately deactivates subscription, no DB cascade issues |
| Alert engine fails silently | Log every engine run with item count + errors. Alert history stores failures too |
| Subscription DB joins across tables for checking | Keep query simple: each topic_type has its own check function |
| Sending from dev environment (console mode) | Engine checks `EMAIL_PROVIDER` before sending — console mode logs, doesn't send |
