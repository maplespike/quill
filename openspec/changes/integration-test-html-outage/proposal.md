# Proposal: Make the integration-test job a reliable merge gate

## Why

The live integration suite fails whenever a government portal is down in a shape the outage check does not recognise. Since 2026-10-26 every completed `build-and-test` job has failed on one assertion, `opendata.gov.nl.ca returns datasets`, because that portal returns HTTP 200 and an HTML error page. The integration-test job never starts, because it needs `build-and-test`. A red main from an upstream error page is the same class of failure that `continue-on-error` used to hide.

## What Changes

- Treat a 2xx HTML document as an upstream outage. Skip the live test and name the host.
- Keep failing on a 4xx, and on a 2xx whose body is JSON that does not parse or does not match the expected shape.
- Treat a JSON parse error caused by an HTML body the same way, for callers that consume the body inside the tool.
- Keep the integration-test job free of a `continue-on-error` key, and pin that with a test.
- Do not retry live calls. Do not skip a named host forever.

## Capabilities

### New Capabilities

- `integration-upstream-outage`: The rule for when a live integration test skips and when it fails.

### Modified Capabilities

- None. `openspec/specs/` has no existing requirement for this gate.

## Impact

- `packages/quill-mcp/src/testing/upstream-outage.ts` and its unit tests.
- `packages/quill-mcp/src/__integration__/upstream.test.ts` records `Content-Type` and uses the HTML parse skip.
- `packages/quill-mcp/src/__integration__/e2e.test.ts` picks the new probe behaviour up with no call-site change.
- `.github/workflows/ci.yml` comments only. The job already has no `continue-on-error` key (removed in #1146). This change keeps it that way.
- No dependency changes. No API change. Compatible with Node 22 and Node 24.
