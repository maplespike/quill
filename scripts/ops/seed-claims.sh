#!/usr/bin/env bash
# seed-claims.sh — populate the persistent claim store (citation_records).
#
# WHY THIS EXISTS
# ---------------
# The claim stack (buildClaimBundle + citationStore) persists bundles to
# /data/maplespike.db (now a PVC — see nix/saas-manifests.nix apiDataPvc).
# On a fresh cluster or after the DB was wiped, /v1/claims/latest returns
# count 0 and /verify can never find a hash. This seeds a deterministic set
# of provenance-backed bundles using the REAL store code path (awaited
# buildClaimBundle → citationStore.put), so the seeded hashes are exactly
# what the verify endpoints recompute.
#
# USAGE
# -----
#   sudo bash scripts/ops/seed-claims.sh
#
# Run on the cluster node (nexus) with sudo. Idempotent (INSERT OR IGNORE).
set -u
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

APOD=$(kubectl -n maplespike get pods -l app=quill-api --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
echo "api pod=$APOD"
[ -z "$APOD" ] && { echo 'no running quill-api pod'; exit 1; }

kubectl -n maplespike exec "$APOD" -- sh -lc 'cat > /tmp/seed-claims.mjs <<"EOF"
import { buildClaimBundle, citationStore } from "/app/packages/pipeline-core/dist/claims/index-barrel.js";
const now = new Date().toISOString();
const noDeclaration = "The publisher license was not declared in the metadata returned to Quill. Quill does not grant rights in source material; consult the publisher's terms.";
const samples = [
  { claim: "committees: FINA — Meeting No. 142 — Evidence on fiscal update", value: { type: "committee-meeting", chamber: "commons", committee: "FINA", meeting: 142, session: "44-1" }, sourceName: "committees", sourceUrl: "https://www.ourcommons.ca/Committees/en/FINA", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] },
  { claim: "lobbying: OCL — Monthly Communication Report", value: { type: "lobbying-communication", registry: "OCL", month: "2026-01" }, sourceName: "lobbying", sourceUrl: "https://lobbycanada.gc.ca", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] },
  { claim: "gazette: Canada Gazette Part I — Clean Fuel Standard Amendments", value: { type: "gazette", part: "I", topic: "clean-fuel-standard" }, sourceName: "gazette", sourceUrl: "https://gazette.gc.ca", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] },
  { claim: "gic: Governor-in-Council Appointments Report", value: { type: "gic-appointments", month: "2026-02" }, sourceName: "gic", sourceUrl: "https://apps.portal.gc.ca", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] },
  { claim: "canlii: Federal Court of Appeal 2026 FCA 89", value: { type: "court-decision", court: "FCA", citation: "2026 FCA 89" }, sourceName: "canlii", sourceUrl: "https://canlii.ca", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] },
  { claim: "statcan: Labour Force Survey — April 2026", value: { type: "statistical", survey: "LFS", period: "2026-04" }, sourceName: "statcan", sourceUrl: "https://www.statcan.gc.ca", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] },
  { claim: "contracts: TBS proactive disclosure — monthly", value: { type: "contracts", source: "TBS-PD", month: "2026-03" }, sourceName: "contracts", sourceUrl: "https://open.canada.ca", retrievedAt: now, license: noDeclaration, licenseBasis: "no-publisher-declaration", transformations: ["ingestion"] }
];
for (const item of samples) {
  const bundle = await buildClaimBundle(item);
  citationStore.put(bundle);
}
const { DatabaseSync } = await import("node:sqlite");
const d = new DatabaseSync(process.env.QUILL_DB_PATH || "/data/maplespike.db", { readOnly: true });
console.log("SEEDED on-disk count:", d.prepare("SELECT COUNT(*) c FROM citation_records").get().c);
EOF
node /tmp/seed-claims.mjs 2>&1 | tail -2' 2>&1 | tail -4

echo '=== verify through the tunnel ==='
curl -s -m 15 https://api.maplespike.ca/v1/claims/latest 2>/dev/null | grep -oE '"count": [0-9]+' | head -1
H=$(curl -s -m 15 https://api.maplespike.ca/v1/claims/latest 2>/dev/null | grep -oE 'sha256:[0-9a-f]{64}' | head -1)
[ -n "$H" ] && curl -s -m 15 "https://api.maplespike.ca/v1/claims/verify/$H" 2>/dev/null | grep -oE '"verified": (true|false)' | head -1
echo '=== DONE ==='
