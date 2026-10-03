# Data Source License and Provenance Audit

**Status: source-by-source permissions are not fully cleared.** This is an engineering provenance record, not legal advice or a legal opinion. It does not assert that sources prohibit reuse, and it does not grant rights in publisher content.

## Scope and decision

Quill does not grant independent reuse rights in publisher data. A public endpoint, source portal, jurisdiction, or government publisher does not by itself establish reuse permission. Publishers may apply different terms at the dataset, API, record, or content level, and exclusions may apply to personal information, third-party works, official marks, or other protected material.

The machine-readable [`data-source-licenses.json`](../data-source-licenses.json) lists 203 source families. Its `no_quill_reuse_grant` value describes Quill's own legal position; it does **not** mean that the publisher forbids reuse. Its source URLs are review starting points, not evidence that every source-family dataset is covered by the linked terms. Do not treat the family-level URLs or notes as dataset clearance.

## Runtime behavior

- Search, discovery, ingestion, API, and MCP source paths remain available. This file is not a runtime gate and does not disable features.
- When source metadata supplies explicit license fields, Quill carries the label and URL into returned dataset records and citations as `publisher-metadata`. This records what the source response declared; it is not an independent verification of scope.
- Where no declaration is returned, Quill emits a notice that says no publisher license declaration was present in the returned metadata and directs the user to the source's terms. This is not a claim that reuse is prohibited.
- A source-specific label maintained in Quill code is identified as `source-configuration`, not represented as a publisher declaration.
- Catalog endpoints that omit per-dataset metadata say so; they do not assign a blanket federal, provincial, or municipal license to every result.

## Inventory status

There are **203 source-family entries**. They all record `no_quill_reuse_grant`; no count of publisher-cleared source families is asserted. Some entries include authoritative terms pages as leads. Those pages can have narrower scope than the related source family. Compound sources need source-level and dataset-level review before use of data beyond discovery, metadata, or the specific currently configured ingestion behavior.

## Required evidence for dataset-level clearance

For each dataset and actual Quill use, record:

1. Dataset identity, publisher/rightsholder, version or retrieval date, and the authoritative dataset/API terms URL.
2. The publisher's exact license declaration and required attribution text, if supplied.
3. Whether commercial access, extraction, redistribution, caching, republication, and derived databases are permitted.
4. Exclusions for third-party content, personal information, official marks, confidential information, or other rights.
5. The specific Quill feature, fields, transformations, retention, and output that use the data.
6. Evidence source and reviewer/date. Escalate ambiguous terms to qualified counsel.

## Selected source terms reviewed

The audit research consulted official or publisher terms for federal Open Government Licence – Canada, Statistics Canada Open Licence, CanLII Terms of Use, Ontario Open Data Terms of Use, BC Open Government Licence, Toronto Open Data Licence, Données Québec licence, Alberta Open Government Licence, Yukon Open Government Licence, and Newfoundland and Labrador licence pages. These sources differ in scope and exclusions. The registry links are not proof that every Quill dataset from those sources is covered by the terms.

## Software licensing is separate

This file concerns upstream data provenance only. It does not resolve the repository's own package/SPDX conflicts, dependency notices, code provenance, or OCI image licensing. See [`open-source-audit.md`](./open-source-audit.md), [`LICENSE.md`](../LICENSE.md), and [`CREDITS.md`](../CREDITS.md).

Observed software-license state as of 2026-09-30, carried here only so the two questions are not conflated:

- 13 workspace packages, with conflicting declarations: `@maplespike/portal` declares MIT in its manifest and Apache-2.0 in its adjacent license text; `@maplespike/quill-mcp` declares Apache-2.0 while most of its own files declare AGPL-3.0-or-later or MIT; `@maplespike/api-server` declares Apache-2.0 with two AGPL-tagged files; `@maplespike/database` and `@maplespike/notification-service` have **no** `license` metadata at all, and `database` is a runtime workspace dependency of other packages.
- 942 installed dependency records (654 production) with three production records lacking license metadata.
- A bounded attribution sweep recorded in [`CREDITS.md`](../CREDITS.md); no exhaustive similarity analysis has been performed.

None of this is resolved by anything in this file, and none of it changes the data-source conclusions above. In particular, **no software license in this repository licenses upstream data**, and no dataset entry in `data-source-licenses.json` grants reuse rights.
