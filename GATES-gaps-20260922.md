# GATES — quill issues & gaps (2026-09-22)

Scope: every open issue + every gap logged this session. Each gate states one observable
outcome. `CHECK:` is runnable; `EXPECT:` is the decisive evidence. j_kro directive:
"address all issues and gaps."

Owner key: **[A]** agent-executable (dispatched to the kanban board / done here),
**[J]** needs j_kro (money, pricing, destructive, or direction),
**[L]** another lane (not quill — flag only).

---

## A. Production gaps — the system is not yet serving its purpose

- [x] **A1 · Production ingestion is deployed and running** (#889) — DONE 2026-09-22
      CHECK: `bash scripts/gates-run.sh A1` (wraps `scripts/quill-health-check.sh`)
      EXPECT: CronJobs present, each scheduled pipeline leaving a run row the API reads
      back, no pipeline stale, and a finished Job pod `Completed`.
      Evidence: 7 CronJobs in `maplespike` (`committees`, `corporate`, `gazette`,
      `influence`, `ngo-rss`, `oversight`, `realtime`), each `nodeName: nexus` +
      digest-pinned `docker.io/library/quill-ingest@sha256:17eab819…` (annotation
      `quill.maplespike.ca/image-build-tag: 2026-09-21-sha.17eab81984d8`).
      `quill-ingest-ngo-rss-29834160` Completed 3m15s / `quill-ingest-realtime-29834160`
      Completed 3m15s, logs ending `[claims] Registered 94 claim bundle(s)` and
      `[CLI] ✅ ngo-influence-rss complete`. `curl https://api.maplespike.ca/v1/ingest/status`
      → `success: true`, `status: ok`, `stalePipelines: []`, rows
      `ngo-rss|success|94 records|*/15` (age 69s) and `realtime|success|5 records|5 claims|*/30`
      (age 63s). `curl /v1/claims/latest` → 25 claims, incl. `source_name: real-time-feeds`
      written by the job. `bash scripts/gates-run.sh A1` → `A1 PASS`.
      Bugs fixed on the way: the runner passed a stub D1 handle into `runModule()`, so every
      db-first module threw `No database configured` and persisted nothing; the chart's
      `committees`/`social` keys were not CLI aliases; `cross-reference` (a query engine) was
      schedulable; the CronJob rendered `quill-ingest:` (empty chart-wide tag →
      `InvalidImageName`); `/v1/ingest/status` was 402'd by the Free-tier boundary; and the
      health probe matched compact JSON, reporting every pipeline as "never reported a run".

- [x] **A2 · A real cache/rate-limit backend answers** (#764, #770) — DONE 2026-09-22
      CHECK: `ssh nexus 'kubectl get svc -A | grep -i redis'` + api env/logs
      EXPECT: the endpoint the API is configured with resolves AND the rate limiter stops
      running in pass-through/degraded mode.
      Evidence: `kubectl get svc -A | grep -i redis` → `maplespike quill-redis ClusterIP
      10.43.131.229 6379/TCP`; `REDIS_URL=redis://quill-redis:6379` on the api Deployment;
      `getent hosts quill-redis` from inside the pod → `10.43.131.229
      quill-redis.maplespike.svc.cluster.local`; api banner `Cache: Redis / Rate-limit: Redis`
      and `[rate-limiter] Connected to Redis`; 0 connection-failure lines in 10m of logs.
      Burst test (115 requests, one IP): 30×200 + 85×429, `X-RateLimit-Limit: 100`,
      `x-ratelimit-remaining: 0`, `retry-after: 57`; Redis held `ratelimit:FREE:127.0.0.1`
      and a real tunnel client's key. Cache: MISS then HIT with `v1:GET:/v1/health` present
      in Redis. Chose option (a) — a dedicated Redis in `maplespike`, rendered by
      `charts/quill/templates/redis.yaml` and synced by ArgoCD — not (b) `media/redis`
      (another app's lifecycle, wrong blast radius) and not (c) alone (#764/#770 ask for a
      distributed backend; the chart defaults to `api.replicas: 2`). The phantom default is
      gone from the code, and no `REDIS_URL` now means an explicit in-process window instead
      of a guessed host.
      Two real bugs surfaced while verifying, both fixed with regression tests in the same
      change: the clients gave up reconnecting after 2–3 attempts (a pod that lost the
      start-up race stayed in pass-through until a manual restart), and `extractIP()` read
      the Express-only `req.ip`, so every request without `X-Forwarded-For` shared one
      `ratelimit:FREE:unknown` bucket.
      #899 + #900 + #901 + #903 (chart, code, tests); api image re-pinned in #902 and #906.
      Owner: [A]

- [x] **A3 · Container images are pinned, not `:local`** (#755) — DONE 2026-09-22
      CHECK: `bash scripts/gates-run.sh A3`
      EXPECT: `A3 PASS` — rendered manifests carry no `:local`, the live refs match
      `charts/quill/values-prod.yaml`, and each digest resolves in the node store.
      Evidence: helm render → 0 `:local`; live `quill-{api,mcp,portal}` and all 7
      ingestion CronJobs → `docker.io/library/quill-<svc>@sha256:<digest>`; a repeat
      ArgoCD sync of the same digests created no new ReplicaSet; api/mcp/portal and
      `llms.txt` all 200. NOTE the pin also caught a real regression: an empty
      chart-wide `image.tag` rendered `quill-ingest:` and every ingest run died
      `InvalidImageName` until the CronJob was pinned by digest too.
      Chart + `scripts/pin-images.sh` + gate + `docs/IMAGE-PINNING.md` in d8580d7;
      ingest CronJob pin + CronJob coverage in A3 in 1ffbadd.
      Owner: [A]

## B. Customer-experience gaps (found by the new journey tests)

- [ ] **B1 · The API key is revealed once at signup** (#890)
      EXPECT: portal shows the minted key with a copy affordance + a "this is the only time" note.
      Owner: [A]
- [ ] **B2 · A free tenant can read its own usage** (#891)
      EXPECT: `/v1/usage` (or `meta.usage` on 402) answers for the key's own tenant; journey test updated.
      Owner: [A]
- [ ] **B3 · The identity model is documented** (#892) — passkeys are device-bound; what a second
      key means; how tiers interact. EXPECT: docs page exists and is linked from onboarding.
      Owner: [A]
- [ ] **B4 · The portal has tests** (#897)
      EXPECT: `pnpm --filter @maplespike/portal test` runs a real suite (SignupForm key reveal,
      402 rendering) and the coverage floor script covers the portal.
      Owner: [A]

## C. Verification integrity

- [ ] **C1 · #859 closed with evidence** — the reported coverage failure must be re-verified green
      (the root cause fixed tonight: mock ZIP fixture + test glob). EXPECT: issue closed + CI green.
      Owner: [A]
- [ ] **C2 · CI + QA green on current main** (the coverage floor + quoted globs are new gates)
      CHECK: `gh run list --limit 10`
      EXPECT: CI, QA, Live Data Check all success on the HEAD that carries the floor change.
      Owner: [A]
- [ ] **C3 · Function coverage ratcheted up** (api 39.9%, mcp 48.5%) — raise the floors once
      dead helpers are exercised or removed. EXPECT: floors raised with the numbers to match.
      Owner: [A]

## D. Housekeeping / honesty

- [ ] **D1 · #731 closed** — the onboarding psychology audit was delivered tonight (artifact exists).
      Owner: [A]
- [ ] **D2 · #825 DRY consolidation** — single manifest source, single secret-sync path.
      Owner: [A]
- [ ] **D3 · `astral-key-jwt` is in sops** — it exists in-cluster only (a rebuilt cluster loses it).
      EXPECT: `sops -d secrets/runtime.yaml | grep astral` returns the key material path.
      Owner: [A]
- [ ] **D4 · The OWASP/audit page tells the truth** — real `audit.json` baked into the image (today:
      empty fallback + false "No known CVEs"; real count 28), no epoch-zero timestamp, the
      `@simplewebauthn/server` bump applied. Owner: [A]

## E. Needs j_kro — do not self-authorize

- [ ] **E1 · #854 history rewrite** (age keys in git history). Destructive: rewrites every SHA;
      it is the public-flip gate. Needs a coordinated window + explicit GO. [J]
- [ ] **E2 · Money/pricing/direction**: #811 (taxable-revenue tracker + GST/HST threshold),
      #814 (production + live income spec), #790 (MapleSpike MVP scope), #798 (wayfinder map),
      #827 (Phase 7 gap map). These define what "done" means commercially — j_kro's call. [J]
- [ ] **E3 · Public flip / launch** — gated on E1 + E2. [J]

## F. Other lanes — flagged, not touched (quill is not the owner)

- [ ] **F1 · ArgoCD drift (11 apps)**: `trading-*` ×7 (Progressing/Degraded), `csi-driver-smb`
      (Progressing), `media-helm` + `trading-helm` (OutOfSync parents), **`activepieces` = Unknown**
      (app status unreadable — worth a look by whoever owns it).
- [ ] **F2 · Longhorn admission webhook has no backend** — intercepts PVC ops cluster-wide.

## G. Long-tail roadmap (ws1/ws2/ws3/ws5 — ~25 enhancement issues)

Modules, MCP features, i18n phases, docs passes (#741–#849). Not gaps in what exists — they are
unbuilt features. Disposition: keep `agent-ready` ones flowing through the board; the rest stay
deferred until E2 fixes the definition of done. No silent closing.

---

### Amended gates
(none yet)

### Abandoned gates
(none yet)
