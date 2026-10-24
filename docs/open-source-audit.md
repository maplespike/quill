# Open-Source License and Provenance Audit

> **Resolution (2026-10-24).** The rights holder chose `AGPL-3.0-only` for the whole
> repository ([#1044](https://github.com/maplespike/quill/issues/1044)). Every
> `package.json`, the Python and Rust manifests, 442 of the 453 tracked first-party
> source headers, and every per-package `LICENSE` copy now state `AGPL-3.0-only`.
> The 14 remaining paths are listed in `scripts/test-license-coherence.mjs`: they
> contain a Canadian city name that the fleet pre-commit gate reads as an identity
> string, so the gate refuses any commit which stages them.
> The statement, scope, and third-party carve-outs are in [`LICENSE.md`](../LICENSE.md)
> and [`NOTICE`](../NOTICE); `scripts/test-license-coherence.mjs` enforces them in CI.
> The observations below record the tree as it was on 2026-09-30 and are kept as the
> historical audit record. Where they describe conflicts, read them as "before the
> 2026-10-24 decision".

**Status: resolved for Quill's own code; third-party and data questions remain open.** This report separates repository observations from legal conclusions. It is not a legal opinion, copyright clearance, license-compatibility determination, or assurance that any package or image is safe to redistribute.

Last manually reviewed: 2026-09-30.

## Executive finding

Quill is **not presently in a state where its repository documentation supports a clear, reliable statement of the license for each distributed artifact**. There are material contradictions between root `LICENSE`, package manifests, package-local license texts, and source-file SPDX tags. Some runtime workspace dependencies are unlicensed in their package metadata, including `@maplespike/database`. The current documentation also overstates both AGPL consequences and public-data rights. Resolve the license policy with the rights holder and qualified open-source counsel before publishing a compliance claim or making a new distribution.

This audit does **not** conclude that Quill is infringing, that a license is incompatible, or that any repository needs to be taken down. It identifies factual questions that prevent a defensible affirmative clearance.

## Audit method and reproducibility

The source audit is deterministic for a given checkout and installed dependency tree. It reads workspace `package.json` files, package-local `LICENSE` texts, first-party source-file SPDX tags, runtime workspace dependency declarations, and pnpm's installed package-license metadata. It makes no network requests and does not rewrite licenses.

```bash
nix develop
pnpm install --frozen-lockfile
pnpm test:audit:open-source
pnpm audit:open-source
pnpm audit:open-source:prod
nix run .#audit-open-source
```

The audit also runs in `.github/workflows/open-source-audit.yml` after a frozen lockfile install and uploads the JSON report as a 90-day artifact. `nix build .#open-source-audit-script` checks that the scripts parse. The flake-level `open-source-audit` derivation is intended for installed/reproducible package metadata and should be run with the same pnpm environment as CI.

`scripts/test-audit-open-source.mjs` runs the generator against synthetic workspace fixtures (with a stubbed `pnpm licenses list`) so it covers license metadata shapes the live repository does not currently contain: an absent per-entry `license` field, a compound SPDX expression such as `MIT OR Apache-2.0`, and an unidentifiable license. Repeat runs are asserted byte-identical apart from the timestamp, and the `--prod` scope flag is asserted to be forwarded to pnpm rather than applied as a post-filter.

For OCI distribution, source-level dependency reports are not image SBOMs. A repository dependency inventory describes what the monorepo declares; it cannot see what is inside a built image, which is what a consumer of `nexus:5000/quill-<svc>` actually receives.

**Generated-artifact drift is now gated.** `scripts/check-portal-artifact-drift.mjs` (`pnpm check:artifact-drift`, wired into `.github/workflows/portal-artifact-drift.yml`) regenerates the nine tracked portal artifacts and compares them to the committed copies, and separately asserts that every tool count claimed in a committed file equals the catalog length in `tools.json`. That second check would have caught the 189-vs-184 discrepancy.

The portal tool generator now uses the built `quill-mcp` `getAllTools()` registry as its sole authority for membership and descriptions, and derives the displayed count from that exact set. The old fallback unioned `tools-base.json`, `tool-index.json`, and `fr-tools.json`; on a missing/stale build it included two unregistered tools. It now fails closed if the registry is absent or invalid. CI builds the SDK and MCP workspace dependencies first, then runs generators with `QUILL_GENERATOR_OFFLINE=1` so artifacts do not depend on live billing/API services. A clean-build simulation regenerated all nine artifacts with 184 tools and passed the drift gate.

The comparison deliberately **excludes the build timestamp**. A commit's artifacts necessarily carry the *parent* commit's date, because a commit cannot know its own date before it exists — so comparing timestamps would report drift on every commit that touches an artifact, which is the failure mode that let these fields rot in the first place. Content is compared exactly; the stamp is treated as metadata rather than as a claim.

**This is now enforced at the image chokepoint.** `scripts/pin-images.sh` calls `scripts/generate-sbom.sh` for each service after the build and **before** the image is saved and imported into the k3s containerd store. That placement is the point: an image cannot reach the cluster store without its contents having been enumerated. With syft unavailable the run aborts at the scan and `ctr images import` is never invoked.

`generate-sbom.sh` records the image digest alongside the SBOM, so the two provably describe the same artifact, and refuses to record an empty SBOM — syft can exit 0 having found nothing, and an empty file that looks like a successful scan is worse than no file because a reviewer ticks it off.

To scan an image by hand:

```bash
scripts/generate-sbom.sh <image-ref> ./sbom
```

**A correction worth recording.** This control was first wired into `flake.nix`'s `nix run .#push-images`, on the assumption that Nix was the build path — the workflows' `runs-on: [self-hosted, nixos]` label invites exactly that inference. It is not. The build hosts run Omarchy with docker; neither nix nor podman is installed on them, and `scripts/pin-images.sh` (docs/IMAGE-PINNING.md) is the path that produces the digest the cluster actually resolves. The control was moved there. The lesson generalises past this repo: a self-hosted runner label describes how a runner was *registered*, not what is installed on it, and a release control wired into a toolchain nobody runs is worse than no control because it looks like one.

**What this still does not do.** Syft is resolved from `PATH`, not pinned, so the scanner version is whatever the build host provides; pin it before treating the output as an attested control. The SBOMs are written to `sbom/` and are *not* committed or signed — they are evidence to be reviewed, not a published attestation. `SBOM=false` exists as an escape hatch and is documented as one. Nothing here establishes licence compatibility: an SBOM enumerates packages, it does not judge them. Helm and ArgoCD define deployment state; they do not settle source licensing or establish an image's embedded notices.

Known limits of the generator, stated so its output is not over-read:

- License comparison is textual, not SPDX-semantic. A package declaring `MIT OR Apache-2.0` next to Apache-2.0 text is not flagged as a manifest/text conflict, but a file whose SPDX tag names only one branch of that expression is still reported as `file-spdx-differs-from-manifest`. That over-reports; it errs toward review rather than toward clearance.
- `getLicenseTextKind` classifies license *texts* by their opening wording and reports `unclassified` when it cannot tell. `unclassified` text suppresses the manifest/text conflict check rather than proving agreement.
- The dependency inventory is whatever `pnpm licenses list` reports for the current install. It is not a lockfile enumeration, not a per-image SBOM, and does not cover Python or Rust dependencies. **This limit is now partly measured** — see "Image-level results" below.

### Image-level results (first measurement, 2026-10-02)

`scripts/generate-sbom.sh` was run for real against the live `nexus:5000/quill-mcp:latest` image on the build host, so the "not a per-image SBOM" limit above is no longer theoretical. Syft 1.52.0 (Arch `extra`), 19s, 5.9 MB SPDX-2.3 document, **5,925 SPDXID entries / 1,413 packages**, digest recorded alongside so the SBOM provably describes the scanned artifact. `syft convert` re-reads the file, which is an independent check that the document is well-formed.

The historical CI test-process hang remains unexplained. On 2026-10-02, three abandoned test processes on `nexus` were terminated by SIGTERM and the ops mutation was logged. The exact API test command passed on the same runner in 10 seconds; repeated sequential and concurrent runs passed. A synthetic slow-reader pipe test established that a blocked log pipe can block a writer, but did not prove that this occurred in the affected jobs. CI now captures test output to a temporary file, emits a bounded tail, and has job timeouts as safeguards; these are mitigations, not a confirmed root-cause fix.

`licenseDeclared` distribution inside the image:

| Licence | Packages |
|---|---|
| MIT | 956 |
| ISC | 132 |
| Apache-2.0 | 125 |
| BSD-3-Clause / BSD-2-Clause | 27 / 27 |
| NOASSERTION | 26 |
| BlueOak-1.0.0 | 14 |
| CC0-1.0 | 5 |
| Copyleft (GPL/LGPL/AGPL/MPL family) | 13 (Debian base layer) + first-party |

**This is exactly the class of fact a lockfile audit cannot produce.** Two things appear only at image level:

- **The Debian base layer is GPL.** `bash`, `coreutils`, `grep`, `gzip`, `dpkg`, `apt`, `ca-certificates` and the rest of the base filesystem are GPL-2.0/GPL-3.0. They are not npm dependencies and appear in no `package.json`. A consumer distributing the image receives them regardless of what the JavaScript manifest says.
- **First-party licensing is confirmed independently.** `@maplespike/pipeline-core` reports `AGPL-3.0-or-later` *from inside the built artifact*, which corroborates the AGPL file tags recorded elsewhere in this document from a completely separate source. `@img/sharp-libvips-linux-x64` is `LGPL-3.0-or-later` (a prebuilt native binary, not source we compile).

The distinction that matters for a release decision: base-layer GPL obligations attach to the Debian packages and are discharged by their own attribution requirements, not by Quill's licence. But they must be *disclosed* — an image-level notice is the only place they can be. That is a counsel question, listed below.
- Missing license metadata is preserved as missing. The generator never infers a license from a package name, directory, or neighbouring package.

## Findings

### Critical: package-license policy is internally inconsistent

Observed declarations include:

| Location | Observed declaration |
|----------|----------------------|
| Root `LICENSE` | AGPL-3.0 text |
| Root `package.json` | `AGPL-3.0-or-later` |
| `packages/pipeline-core/package.json` | `AGPL-3.0-or-later` |
| `packages/engine/package.json` | `AGPL-3.0-or-later` |
| `packages/api-server/package.json` and local `LICENSE` | Apache-2.0 |
| `packages/quill-mcp/package.json` and local `LICENSE` | Apache-2.0 |
| `packages/quill-mcp/src/**` | Multiple AGPL-3.0-or-later, MIT, and Apache-2.0 SPDX declarations |
| `packages/api-server/src/**` | Primarily Apache-2.0 declarations; `registry-snapshot.ts` is AGPL-3.0-or-later |
| `packages/portal/package.json` | MIT |
| `packages/portal/LICENSE` | Apache-2.0 text |
| `packages/engine/LICENSE` / `packages/pipeline-core/LICENSE` | AGPL-3.0 text |
| `packages/docs/package.json` and local `LICENSE` | Apache-2.0 |
| `packages/database/package.json` | No `license` field and no local LICENSE file found |
| `packages/notification-service/package.json` | No `license` field and no local LICENSE file found |

The machine scan found 91 source-file SPDX/package-manifest differences, eight high-severity metadata or unknown-license findings, plus review items. In particular, Quill MCP's top-level Apache-2.0 metadata does not describe many files that identify themselves as AGPL or MIT. A file header may be intentional, stale, generated, or a mistaken declaration; the scan cannot decide which.

The private/internal `database` package is consumed at runtime by `pipeline-core`, `engine`, and Quill MCP, among others. It must have a rights-holder-approved licensing statement. Do not infer MIT, Apache, or AGPL solely from adjacent package policy prose or from the fact that the root is AGPL.

The root `LICENSE` normally needs an explicit statement of what work it covers and how package/file exceptions work. Its presence alone does not settle the status of separately licensed files or contributors' rights.

### Critical: current AGPL explanations go beyond the license text

`LICENSE.md` and `packages/quill-mcp/NOTICE.md` claim broadly that linking an AGPL package makes a combined work inherit AGPL and that all users of a hosted modified service are entitled to its source. Those are not safe blanket conclusions. AGPLv3 §13 concerns a **modified version** that supports remote network interaction; whether software components form one covered/combined work, whether a version was modified, and what source must be offered are fact- and law-dependent. AGPL permits commercial use; it does not itself create a fee-based commercial-license requirement. The existing language should not be relied on as legal guidance until counsel reviews it.

The package architecture does create a concrete review issue: API/MCP OCI builds include workspace packages, and the package graphs include `pipeline-core`, `engine`, and `database`. Whether package boundaries, static/dynamic linking, module imports, aggregation, and distribution form covered works needs a component-by-component analysis. A container boundary is not a legal boundary by itself.

### High: Apache/MIT package claims are not reconciled with workspace composition

`api-server` and `quill-mcp` declare Apache-2.0, but their runtime dependency graphs include packages declared AGPL-3.0-or-later or with no declared license. The code is packaged together in Nix OCI images. Do not promote these images as simply Apache-2.0 without resolving the code and dependency scope. Equally, do not assert the entire image is AGPL without a supported analysis of its components and obligations.

The conflicting **declarations** are unchanged and still require an owner decision, but the prose that previously misdescribed them has been corrected. As of 2026-09-30: `LICENSE.md` re-dated and re-verified against current manifests with a per-package observed table; `CREDITS.md` carries an observed per-package table and no longer says all non-pipeline packages are MIT; `packages/quill-mcp/NOTICE.md` states that it is not a complete NOTICE or SBOM, that no artifact-specific SBOM has been generated, and that Apache-2.0 alone does not describe every file. None of these corrections resolves the underlying conflict, and none of them substitutes for a real licensing policy and per-artifact inventory.

### High: third-party dependency risks need artifact-specific review

On the installed workspace snapshot examined 2026-09-30, pnpm reported 942 installed package records overall, including development dependencies, and 654 production records across the workspace. That is metadata from the current install, not a verified immutable lockfile enumeration and not a count of packages present in each published image.

Observed license distribution, production records (654): MIT 502, Apache-2.0 72, ISC 26, BSD-3-Clause 20, BSD-2-Clause 10, BlueOak-1.0.0 4, Unknown 3, LGPL-3.0-or-later 1, LGPL-3.0-only 1, MPL-2.0 2, CC-BY-4.0 1, CC0-1.0 2, Python-2.0 1, Unlicense 1, 0BSD 1, BSD 1, MIT-0 1, MIT OR Apache-2.0 1, (MIT OR EUPL-1.1+) 1, (MIT OR WTFPL) 1, (BSD-2-Clause OR MIT OR Apache-2.0) 1.

Notable production metadata requiring review, with the dependency path observed via `pnpm why`:

- `rpc-websockets@9.3.9` — `LGPL-3.0-only`, reached as `@solana/web3.js` → `@dexterai/x402` → `@maplespike/api-server` (dependencies). Determine whether it is present in the shipped API artifact/image, how it is used/linked, and applicable LGPL compliance obligations.
- `@img/sharp-libvips-linux-x64@1.3.3` — `LGPL-3.0-or-later`, present through image/portal build dependencies. Determine whether any of the relevant package/build artifacts are conveyed in each image/package and preserve corresponding notices/source obligations as required.
- `lightningcss@1.32.0` and `lightningcss-linux-x64-gnu@1.32.0` — MPL-2.0, reached as `@tailwindcss/node` → `@tailwindcss/vite` → `@maplespike/portal` and via `vite`. Identify which portal/build artifacts carry MPL-covered source/object code and retain required notices/source for modified covered files if applicable.
- `caniuse-lite@1.0.30001810` — CC-BY-4.0, reached as `browserslist` → `@babel/helper-compilation-targets` → `@babel/core`. Its browser-compatibility data can carry attribution obligations in distributed artifacts.
- `argparse@2.0.1` — Python-2.0 (PSF License), reported in the production set; the observed `pnpm why` path (`js-yaml` → `read-yaml-file` → `@manypkg/get-packages` → `@changesets/cli`) is a development path, so confirm which artifact actually conveys it before treating it as a production obligation.
- `utf7@1.0.2` — reported as bare `BSD` with no SPDX identifier, reached as `imap@0.8.19` → `@maplespike/api-server` (dependencies). `imap` pulls in a package with a history of encoding-related advisories; confirm the version, its actual license text, and whether that dependency is still required.
- `@zone-eu/mailsplit` — `(MIT OR EUPL-1.1+)`; preserve the alternative expression and record the selected license basis for the artifact.
- Three **production** dependency records had unknown package metadata in this snapshot: internal `@maplespike/database` (no `license` field, no local `LICENSE` file), and third-party `eyes@0.1.8` and `text-encoding-utf-8@1.0.2`, both reached as `borsh`/`jayson` → `@solana/web3.js` → `@dexterai/x402` → `@maplespike/api-server`. A fourth unknown record, `spawndamnit@3.0.1` (also via `jayson` → `@solana/web3.js`), is development-only. Check exact versions and upstream license texts.

These are review candidates, **not findings of incompatibility**. `pnpm licenses` groups installed copies and can overcount versions/paths; Nix store contents, OCI layers, published npm/PyPI archives, optional native binaries, and runtime behavior need separate inspection. A release process should create an SBOM for each artifact/image by digest, preserve relevant `LICENSE` and `NOTICE` files, and fail or require review for unknown, copyleft, source-share-alike, or custom license expressions.

### High: current data-source classifications are not legal clearance

`data-source-licenses.json` currently lists **203** source-family records. Every entry records `no_quill_reuse_grant`: Quill grants no independent rights in source material. This is not a claim that the publisher prohibits reuse or that a source is uncleared for every use. Its terms URLs are leads, not dataset-level evidence. Sources may have distinct licenses, terms of use, API terms, Crown copyright notices, personal-information restrictions, database rights, or no open license at all. A source can change terms without the code changing. A site's government status or placement in a CKAN/Socrata/ArcGIS catalog is not itself a permission grant.

The inventory is not a runtime gate and does not disable discovery or ingestion. The product should preserve publisher declarations returned for each dataset while keeping permissions and terms review source-specific. Do not represent family-level entries as verified commercial-use approval or sufficient attribution.

Review source terms individually. Record authoritative terms URL, rights holder, dataset identity/version, access date, permitted acts, commercial/redistribution rules, attribution wording, exceptions, retention/withdrawal conditions, and the specific Quill feature/output using the data. Address personal data, confidential information, Crown copyright, third-party content, and contractual/API terms separately. Seek counsel on bulk republication, database extraction, paid access, and derived datasets.

### Resolved: provenance comparison against `mcp-canada` is now a measurement

The public `mcp-canada` predecessor was cloned and compared **whole-repository** against Quill, superseding the earlier three-file manual sample. Predecessor: `f2deb2285ebeb4868a278d1d9189add038afa27d`, MIT, © 2026 Reyem Tech, 111 source files / 35,417 tokens (Python). Quill: 1,371 files / 432,457 tokens (TypeScript).

[`scripts/compare-provenance.py`](../scripts/compare-provenance.py) reduces both trees to normalised token streams — comments and string literals removed, Python keywords removed so a `.py` file cannot match a `.ts` file on `import`/`return` alone — then reports shared token 5-grams and the longest common contiguous token run per file pair.

| Measure | Result |
|---|---|
| File pairs with any shared 5-gram | 14 |
| Longest common token run, any pair | **8 tokens** |
| Highest coverage of any predecessor file | **0.44%** |
| Intra-repo noise floor (Quill vs Quill, 120 pairs) | median 0.0000, max 0.3684 |

The longest runs are not code. The top matches are a pandas idiom (`e print f file sys stderr`), a NumPy limit phrase (`e g limit maximum number of`), and the public portal name `the government of canada open data portal`. Every one of the 14 is at or below the same-codebase noise floor.

**Conclusion: no substantial literal copying from `mcp-canada` at this revision.** Common endpoint, protocol, and algorithm patterns are expected where two tools wrap the same public APIs and do not alone establish copyright copying.

Reproduce with:

```bash
git clone --depth=50 https://github.com/reverb256/mcp-canada.git /tmp/mcp-canada
python3 scripts/compare-provenance.py . /tmp/mcp-canada --json /tmp/provenance.json
```

**Limitations that remain, stated rather than papered over.** This compares the predecessor at one revision, not its full history — deleted files and earlier revisions are not covered, and the clone is `--depth=50`. It compares normalised token streams, so a semantic reimplementation (different tokens, same algorithm and structure) would not register; that class of similarity is a reading task, not a fingerprinting one. Generated code, issues/PRs, other repositories, and code-agent output are not in scope. "No substantial literal copying **at this revision, by this method**" is the supportable claim — not "no code copied", which must not be published as a verified result.

One generated-file consequence is recorded and worth repeating: three sets of orphaned HTML snapshots (`packages/portal/docs/`, `packages/portal/docs-vitepress/`, and `packages/docs/**/*.html`) were never regenerated, so they carried superseded licensing and coverage statements — 6 of them still asserted the Open Government Licence, and `packages/portal/docs/` and `docs-vitepress/` each carried a full copy. They were served nowhere (the docs workflow uploads `packages/portal/dist`) and no script read or wrote them.

**Deleted 2026-10-01** (75 files, ~25,400 lines). The canonical inputs are untouched: `packages/docs/**/*.md` (25 files) still feed `scripts/build-docs.mjs`, which builds 23 pages plus a redirect into `packages/portal/dist/docs` — verified after the deletion. The earlier position was that removal is "a rights-holder decision, not an engineering one"; on review that was too cautious. These files asserted licence terms we had already established we could not support, were deployed to nobody, and existed only to be mistaken for current documentation. Leaving known-false licence claims in the repository is itself the compliance problem this audit exists to fix.

### Medium: Code of Conduct attribution and license

The Code of Conduct expressly attributes Contributor Covenant v2.1 and Mozilla's enforcement ladder. Contributor Covenant's adoption guidance identifies CC BY-SA 4.0. Retain the attribution and identify modifications if distributing adapted Covenant text; CC BY-SA may impose share-alike obligations on adaptations within its scope. The compatibility and scope of mixing that adapted text into the rest of the repository should be checked by counsel.

Verified 2026-09-30: the document's attribution link points at `mozilla/diversity`, which now redirects to **`mozilla/inclusion`**. That repository is licensed **MPL-2.0** and is where the `Consequence Ladder` and `Mozilla Community Participation Guidelines` documents are actually filed. Update the link to the canonical repository. Still unverified: **which historical revision** of that material Quill adopted, and whether MPL-2.0's file-level copyleft attaches to the adapted text as incorporated. Either verify the revision and scope, or rewrite in original wording while preserving accurate inspiration credit.

### Medium: bounded attribution sweep found one unattributed-source record

A repository-wide keyword sweep (2026-09-30) for explicit attribution, `SPDX-FileCopyrightText`, "adapted from / copied from / forked from / inspired by / vendored from / upstream", and generated-file markers — excluding build output, `node_modules`, and the three known stale snapshot directories — is recorded in [`CREDITS.md`](../CREDITS.md) "Bounded attribution sweep".

Result: four first-party items carry provenance statements (the Code of Conduct, an internal `ops/` copy note, a design-rationale header, and the generated-file set), and one item named an external source without a licence, version, or access date: `.agents/skills/review-animations/SKILL.md`, which credited Emil Kowalski's animation philosophy (animations.dev).

**Resolved 2026-10-01, and the initial assessment was wrong.** The first pass judged reuse "low" on the reasoning that the file describes a review *method* and a *philosophy*. A line-by-line comparison against `emilkowalski/skills` (`skills/review-animations/`, MIT, © 2026 Emil Kowalski) disproved that: 73 of 79 non-blank lines in `SKILL.md` and 134 of 136 in `STANDARDS.md` are identical. This is derivative reuse of MIT-licensed code that shipped with no licence notice — an MIT compliance defect, not a documentation nicety. The notice is now at `.agents/skills/review-animations/LICENSE`, with source URL, access date, and an itemised list of the three local modifications. The lesson generalises: a file that *describes* a method can still be a near-verbatim copy of one, and provenance cannot be inferred from how a file reads.

This is a keyword sweep. It does not cover file history, deleted content, notebooks, issue/PR text, or code-agent output, and it cannot rule out unattributed reuse.

## False or unsupported statements to correct

The current `LICENSE.md`, `CREDITS.md`, `packages/quill-mcp/NOTICE.md`, and data-source audit include statements that need correction or explicit qualification:

1. “All other packages are MIT” is contradicted by package manifests and file headers.
2. “Each package contains its own LICENSE file” is false for multiple workspace packages.
3. The root AGPL file is not, without scope language and complete rights data, a reliable table of every package's license.
4. “Linking means the combined work inherits AGPL” and the claim that any hosted Quill image necessarily creates source obligations are overbroad.
5. “Commercial license required” is not a general AGPL term; it is only a separate permission path if the rights holder can grant it.
6. “All source data is OGL-Canada” is unsubstantiated; the family inventory does not grant reuse rights or assert publisher prohibition.
7. `data-source-licenses.json` is not a runtime consumer or gate; it records Quill's no-independent-grant position and review leads.
8. The statement that Quill copied only ideas/no code has not been established by a repository-wide comparison.
9. Package NOTICE text must not call itself a complete SBOM or claim completed generation when it is not present.

`CREDITS.md`, `LICENSE.md`, and `packages/quill-mcp/NOTICE.md` have been revised to stop making those claims (status as of 2026-09-30). Correcting the prose does **not** resolve the underlying conflicts or establish clearance; do not treat this work as publishing-ready while the decisions in the next section remain open.

## Required owner and counsel decisions before public release or a compliance claim

1. Identify the copyright owner(s) for every first-party contribution, including contractors, AI-assisted outputs where relevant, and external contributors. Confirm employment/assignment/permission records. Git authorship is not proof of ownership.
2. Decide intended licensing per independently distributed artifact: source repository, API image, MCP image, portal image, packages published to npm/PyPI, CLI/SDK scripts, and docs/data. Define file-level exceptions and combined-work policy.
3. Confirm whether all contributors agreed to the proposed licensing/CLA. `LICENSE.md` describes a MapleSpike CLA, but this audit found no signed CLA process/artifact and no enforcement workflow proving acceptance. Do not represent the CLA as binding or as permission to relicense contributions until evidence exists.
4. Resolve `database` and `notification-service` license metadata, `portal` MIT-vs-Apache conflict, API/MCP AGPL/MIT/Apache file exceptions, and source files with unexpected licenses. Do not bulk-edit SPDX headers until provenance and rights are verified.
5. Have counsel analyze AGPLv3 / Apache-2.0 / MIT interactions by actual package/image and distribution mode, and prepare accurate source offers/notices if required.
6. Generate and review per-image SBOMs and source/package archive inventories, including transitive/optional/native/build dependencies; attach them to immutable image digests and release records.
7. Replace name-based data-source guesses with terms evidence and enforce a deny-by-default product gate until source permissions and privacy/contract constraints are documented.
8. Run a full repository similarity and history review against `mcp-canada`, known internal repos, templates, generated code, and attributed docs; manually review candidates and preserve upstream provenance.
9. Confirm that `CONTRIBUTING.md` and actual merge controls match any promised CLA, DCO, or contributor license process.

## Decision status

This is a harsh preliminary audit and an engineering evidence report. The new CI source audit is useful as a regression alarm. **It does not make Quill legally clear.** The high-severity license-policy, dependency metadata, artifact SBOM, and source-data issues remain unresolved and need rights-holder/counsel decisions.
