# Licensing decisions requiring the rights holder

**Status:** awaiting decision. **Prepared:** 2026-10-02. **Evidence:** [`docs/open-source-audit.md`](./open-source-audit.md), [`CREDITS.md`](../CREDITS.md), [`LICENSE.md`](../LICENSE.md), [`docs/licensing-audit.md`](./licensing-audit.md).

This file exists because the audit *listed* open questions but did not put them in a form a decision can be made from. Each item below states what was observed, what turns on it, and what the options cost. Nothing here is a recommendation presented as a conclusion — where the audit has a view, it is labelled as one.

Engineering work that did not need a decision has been done and is cited for context. What remains is genuinely a rights-holder or counsel call.

---

## D1 — Is there a single project license, or per-artifact licenses?

**Observed.** Four signals disagree. Root `LICENSE.md`; package manifests; package-local license texts; per-file SPDX headers. `pipeline-core` is AGPL-3.0-or-later by manifest with 8 MIT-tagged files under `src/ingestion/indigenous-services-directory/`. `quill-mcp` is Apache-2.0 by manifest with 95 AGPL, 28 MIT and 8 Apache file tags. `portal` is MIT by manifest with an Apache-2.0 text. `api-server` is Apache-2.0 with 2 AGPL files. `database` and `notification-service` declare no `license` field at all.

**Why it matters.** It determines what a recipient may do with each artifact, and whether the images you already ship are correctly licensed. It is the single largest open item.

**Options.**
- *(a)* One license for everything. Simplest to state, but it is a legal assertion about files whose provenance is not established — several SPDX tags contradict their own package. Cannot be chosen safely until D3 and D4 are settled.
- *(b)* Per-artifact, matching what each manifest already says, with the conflicting files treated as exceptions to resolve individually. Honest, and matches what the repo actually asserts today.
- *(c)* Per-artifact with an explicit file-level exception list published as a NOTICE.

**Audit's view.** (b) or (c). (a) is not currently supportable from the evidence in this repository.

**Blocked on.** D2, D3.

---

## D2 — Who owns the copyright in first-party code?

**Observed.** `LICENSE.md` describes a MapleSpike CLA. This audit found **no signed CLA process, no CLA artifact, and no enforcement workflow** proving any contributor accepted one. Git authorship is not proof of ownership.

**Why it matters.** Without it, relicensing (D1 option a) is not available to you at all, and any inbound contribution has unclear terms.

**Options.** Locate or reconstruct assignment records; adopt a DCO going forward; or accept the gap and license only what you can evidence.

**Audit's view.** This is the highest-priority item regardless of D1's outcome, because it constrains every other option. Do not represent the CLA as binding or as permission to relicense until evidence exists.

---

## D3 — What licence applies to the copied/forged skill and the Code of Conduct text?

**Observed.** Two cases, both now attributed but not cleared:

- `.agents/skills/review-animations/` was near-verbatim MIT code from `emilkowalski/skills` — 73/79 and 134/136 non-blank lines identical — redistributed with no notice. **Discharged** by adding the MIT text, source URL, access date, and an itemised modification list.
- `CODE_OF_CONDUCT.md` adapts Contributor Covenant v2.1 (**CC BY-SA 4.0**) and Mozilla's enforcement ladder from `mozilla/inclusion` (**MPL-2.0**). The link was retargeted 2026-10-01.

**Why it matters.** CC BY-SA 4.0 is **share-alike**: adapted text must be released under the same licence. MPL-2.0 is file-level copyleft. Both can attach to the adapted passages, not to the rest of the repository.

**Open questions.** Which historical revision of the Mozilla material was adopted. Whether the incorporated text is a sufficiently complete adaptation to trigger share-alike, or a short excerpt that does not. What attribution wording the CC BY-SA licence requires.

**Audit's view.** Genuine counsel questions. Deliberately not asserted either way — see `CODE_OF_CONDUCT.md` and `docs/open-source-audit.md`.

---

## D4 — Are the images correctly licensed for distribution?

**Observed.** Measured for the first time on 2026-10-02 against the live `nexus:5000/quill-mcp:latest` image (Syft 1.52.0, SPDX-2.3, 1,413 packages):

| | |
|---|---|
| MIT | 956 |
| ISC | 132 |
| Apache-2.0 | 125 |
| BSD-3/2-Clause | 54 |
| NOASSERTION | 26 |
| Copyleft, **Debian base layer** | 13 packages (`bash`, `coreutils`, `grep`, `gzip`, `dpkg`, `apt`, `ca-certificates`, …) |
| Copyleft, **first-party** | `@maplespike/pipeline-core` — **AGPL-3.0-or-later** |
| Native prebuilt | `@img/sharp-libvips-linux-x64` — LGPL-3.0-or-later |

**Why it matters.** A repository-level audit structurally cannot see any of this. The base-layer GPL packages reach every consumer of the image regardless of what the JavaScript manifests say, and they need their own attribution — a `NOTICE` for the image, not for the repo. The AGPL line is the sharpest item: if `pipeline-core` is AGPL and the image is distributed as a single artifact, network use of that image may trigger source-offer obligations. `packages/quill-mcp/NOTICE.md` currently covers the npm package, not the image.

**Options.** Publish a per-image NOTICE alongside each digest; request the corresponding source for the copyleft components and offer it; or determine that the distribution mode does not trigger the obligation.

**Audit's view.** Counsel question, and the one with the most operational urgency because the images are already built and pinned.

---

## D5 — What licence metadata do `database` and `notification-service` carry?

**Observed.** Neither package manifest has a `license` field. Every other workspace package declares one.

**Why it matters.** Absent metadata is not an implicit grant and not an implicit prohibition. It is simply an unanswered question about code you are shipping.

**Options.** Add the field once D1 settles. Leave absent and document.

**Audit's view.** Mechanical once D1 is decided. Blocked only on D1.

---

## D6 — What do the `mcp-canada` and other relationships permit?

**Observed.** `mcp-canada` is public, MIT (© 2026 Reyem Tech). Whole-repository comparison completed 2026-10-02 at `f2deb228`: longest shared token run **8**, highest coverage of any predecessor file **0.44%**, at or below Quill's own intra-repo noise floor. The longest matches are a pandas idiom, a NumPy limit phrase, and a public portal name — not code.

**Why it matters.** Low, and now measured rather than assumed.

**Residual limits.** One revision, not full history (the clone is `--depth=50`); token fingerprinting would not register a semantic reimplementation. `Frostbite-Gazette` is private and unaudited. `ai-inference-gateway` and `astral-key` are integrated but unexamined for reuse.

**Audit's view.** The supportable claim is "no substantial literal copying at this revision, by this method" — **not** "no code copied".

---

## D7 — What may be claimed about upstream data?

**Observed.** `data-source-licenses.json` records 203 source-family entries, every one `no_quill_reuse_grant`. No publisher terms have been read at dataset level.

**Why it matters.** Separate from software licensing and governed by different rules. No software licence in this repository licenses upstream data.

**Open.** Per-dataset terms review: rights holder, permitted acts, commercial and redistribution rules, attribution wording, retention conditions, personal-data and Crown-copyright constraints. Counsel on bulk republication, database extraction, paid access, and derived datasets.

**Audit's view.** This is the longest-running open item and is unaffected by any decision above.

---

## Summary

| # | Decision | Needs | Blocks |
|---|---|---|---|
| D2 | Copyright ownership / CLA evidence | rights holder + counsel | D1, D3 |
| D1 | Per-artifact licensing policy | rights holder | D5, release claims |
| D4 | Image-level obligations (AGPL, GPL base) | counsel | public release |
| D3 | Share-alike on adapted text | counsel | CoC publication |
| D5 | Missing package licence metadata | mechanical, after D1 | — |
| D6 | Predecessor provenance | closed, bounded | — |
| D7 | Upstream data terms | rights holder + counsel | data product claims |

D6 is closed. D5 is mechanical once D1 lands. D1, D2, D3, D4 and D7 need a person.
