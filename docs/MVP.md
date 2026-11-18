---
last-reviewed: 2026-11-10
status: active
---

# MVP acceptance checklist

Quill ships one MCP workflow. This file is the acceptance list for that ship. A reviewer, not the builder, marks the launch criteria. [Issue #790](https://github.com/maplespike/quill/issues/790) stays open until those five criteria are green.

Decision: Maple, 2026-11-09, on issue #790.

## Locked scope

The MVP is MCP-first. It proves one bill-tracking workflow, with provenance on every MCP response, on the free tier, and with a docs tutorial. English and French.

Work outside the five sections below is outside this MVP.

## Out of scope

- Signal, the monitoring product
- A CLI (`npx quill`)
- An AI citation index
- Polish of every module
- A mobile app
- Publishing every package to npm

Existing Signal code stays in the repo. It is outside this checklist.

## Launch criteria

A reviewer completes these five steps. The success metric is this list.

1. [ ] Visit [https://quill.maplespike.ca/](https://quill.maplespike.ca/) and see an MCP tool example in the hero.
2. [ ] Follow a 3-line setup and connect Claude Code to the Quill MCP server.
3. [ ] Ask "Track Bill C-69 through the Senate" and receive a structured report with committee evidence excerpts (300 characters or less) with source links, plus lobbying records.
4. [ ] Open the cited source links and confirm that they point at real Government of Canada pages.
5. [ ] Understand what Quill does without a blog post.

## Acceptance criteria

Checked boxes name code or docs that already meet the line. Open boxes are the remaining bar.

### MCP-first

- [ ] The landing-page hero shows an MCP tool example and a copy-paste setup for Claude Code, Codex, and Cursor. The page is `packages/portal/src/pages/index.astro`. The hero in `packages/portal/src/components/LandingBody.astro` is the title "The public record." plus a search form. An `mcp.json` block sits lower on the same page.
- [x] The agents page leads with MCP setup, in English and in French. See `packages/portal/src/pages/agents.astro`.
- [ ] The agents-page snippet connects a client. The snippet runs `npx @maplespike/mcp`. [`docs/products/quill.md`](products/quill.md) states that `@maplespike/quill-mcp` is not on npm. The local command is `node packages/quill-mcp/dist/cli.js`. Client notes for Claude Desktop and Cursor are in `packages/docs/mcp/setup.md`. The agents page does not name Claude Code or Codex.
- [x] The landing page and the agents page have English and French copy. See `packages/portal/src/components/LandingBody.astro`, `packages/portal/src/pages/agents.astro`, and `packages/portal/src/pages/fr/[...page].astro`.
- [x] MCP tool definitions can carry a French description. See `packages/quill-mcp/src/tools/bilingual-descriptions.ts`. `wrapTools` in `packages/quill-mcp/src/tools/index.ts` applies it.

### Bill-tracking workflow

One chain: search a bill, find the committee, return membership and committee evidence excerpts (300 characters or less) with source links, check lobbying, then surface related Gazette notices and court decisions. The result is one structured Markdown report with provenance links.

- [ ] A reviewer runs that chain for one bill and receives one report.
- [x] Bill search is an MCP tool. `search_bills` is `packages/quill-mcp/src/tools/search-bills.ts`, registered in `packages/quill-mcp/src/tools/index.ts`.
- [x] A combined bill tool exists for bills, debates, and votes. `track_bill` is `packages/quill-mcp/src/tools/track-bill.ts`. It returns JSON. It does not include committee membership, committee evidence excerpts (300 characters or less) with source links, lobbying, the Gazette, or courts.
- [x] Committee search is an MCP tool. `search_committees` is `packages/quill-mcp/src/tools/search-committees.ts`. `search_committees_op` is `packages/quill-mcp/src/tools/search-committees-op.ts`. `search_committees` queries the open.canada.ca package catalog. `search_committees_op` lists Open Parliament committees.
- [ ] Committee membership and committee evidence excerpts (300 characters or less) with source links come back for the bill's committee. Evidence ingestion lives in `packages/pipeline-core/src/ingestion/committees/index.ts`. The MCP committee tools above do not return that evidence for a chosen bill. `search_debates` (`packages/quill-mcp/src/tools/search-debates.ts`) searches House debates. `get_member_info` (`packages/quill-mcp/src/tools/get-member-info.ts`) looks up MPs.
- [ ] Lobbying activity for the bill is an MCP result. `search_provincial_lobbying` is `packages/quill-mcp/src/tools/search-provincial-lobbying.ts`. Federal search code is `searchFederallobbyingmonthly` in `packages/pipeline-core/src/ingestion/federal-lobbying-monthly/index.ts`. No MCP tool calls that function. `search_influence` (`packages/quill-mcp/src/tools/search-influence.ts`) searches NGOs, think tanks, and funding.
- [x] Gazette search is an MCP tool. `search_gazette` is `packages/quill-mcp/src/tools/search-gazette.ts`. Part tools are `search_gazette_part1`, `search_gazette_part2`, and `search_gazette_part3`.
- [x] Court search is an MCP tool. `search_canlii` is `packages/quill-mcp/src/tools/search-canlii.ts`. `search_tribunals` is `packages/quill-mcp/src/tools/search-tribunals.ts`.

### Provenance

Every MCP response carries `source_url`, `retrieved_at`, `license`, and `dataset_version`.

Committee content is stored in full internally and served only as excerpts of 300 characters or less with source links; parliamentary tools are free.

- [ ] Every MCP tool response includes those four fields.
- [x] Some tools attach a claim bundle with `sourceUrl`, `retrievedAt`, and `license`. The helper is `withClaims` in `packages/quill-mcp/src/tools/claims-helper.ts`. `track_bill` calls it. Public claim shape: `packages/quill-mcp/src/tools/claims-helper.ts`. Product note: [`docs/products/quill.md`](products/quill.md) (Verification-first).
- [ ] `search_bills` and the other bare search tools in this workflow return the same four fields. `search_bills` returns `results` and `totalCount` only (`packages/quill-mcp/src/tools/search-bills.ts`).
- [ ] Responses include `dataset_version`. The MCP server and the claim bundle have no `dataset_version` field.

### Free tier

The free tier covers the bill-tracking workflow. No credit card.

- [x] A Free plan is published at $0 with 1,000 calls per month, and the plan text lists citation and provenance. See `PLANS.free` in `packages/api-server/src/routes/billing.ts`, `packages/portal/src/data/plans.json`, `packages/docs/guide/billing.md`, and the rate table in `packages/portal/src/pages/docs.astro`.
- [x] The signup page and `POST /v1/register` are in the product. See `packages/portal/src/pages/signup.astro` and the register row in `packages/portal/src/pages/docs.astro`.
- [x] Hosted MCP quota code allows 1,000 calls per identity per month, then payment. See `DEFAULT_FREE_QUOTA` in `packages/quill-mcp/src/quota.ts`. The gate runs when `QUOTA_ENABLED=true`. Self-hosted callers are not counted.
- [ ] A reviewer on the free tier completes the five-call bill workflow on the hosted server with no paid upgrade. The Free plan text says "Public data modules" and "Basic MCP tools". It does not name this workflow.

### Docs tutorial

The docs include a narrative tutorial, "Track a bill in 5 MCP calls", in English and in French.

- [ ] That tutorial exists in English.
- [ ] That tutorial exists in French.
- [ ] The tutorial uses the five calls in the bill-tracking workflow and shows the provenance fields on each response.

These pages are reference and setup. They are not the tutorial:

- `packages/docs/mcp/setup.md`
- `packages/docs/mcp/tools.md`
- `packages/portal/src/pages/docs.astro` (the quickstart is a REST `curl` example)
- [`docs/products/quill.md`](products/quill.md)

## How to mark a box

Check a box after a reviewer completes the step. Point at the code or the doc that shows the result. Do not open a second tracker for the same line. Leave issue #790 open until the five launch criteria are green.
