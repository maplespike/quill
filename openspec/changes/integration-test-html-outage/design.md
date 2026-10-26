## Context

`skipIfUpstreamDown` treats status 0, 429, and 5xx, plus transport errors, as outages. Everything else fails the test. That split landed in #1146 so a federal outage would not need `continue-on-error` on the integration job.

Measured on the CI history for `.github/workflows/ci.yml`:

- 2026-10-14 to 2026-10-16: the integration-test job passed on 17 of 17 runs where it was not skipped.
- 2026-10-22 to 2026-10-24, before #1146: 10 integration-test failures. Every one failed `opendata.gov.nl.ca returns datasets` with `NL CKAN: 500`. Three of those also failed `ouvert.canada.ca` and the CanLII fallback with status 0 after a 10 second timeout, and `searchCkan` with `TimeoutError`.
- After #1146 those two shapes skip. From 2026-10-26 02:19, every completed `build-and-test` failed the same NL test with `malformed JSON on HTTP 200` and body `<!DOCTYPE`. A direct fetch of `https://opendata.gov.nl.ca/api/3/action/package_search` returns `Content-Type: text/html` and the page "An error has occurred". The province took the portal offline on 2026-10-21 (`https://www.gov.nl.ca/releases/2026/exec/1021n03/`), already recorded as `announcedIncident` on `nl-open-data`.
- The other CKAN portals, both Gazette feeds, StatCan, and the Open Parliament API returned JSON or RSS at the time of that check.
- The 10 skipped tests in the red run are the smoke cases gated on `CI=true`. They are not flakes.
- `node --test` on Node 22.23 runs each file in its own process and runs tests inside a file one after another. The fetch mock in `upstream-fetcher.test.ts` does not leak into the live file. Shared sqlite state is not what this suite fails on.

The integration-test job already has no `continue-on-error` key. It does not run when `build-and-test` fails, and `build-and-test` runs the same quill-mcp suite first.

## Goals / Non-Goals

**Goals:**

- One outage has one result, whether the dead portal emits 500 or an HTML document on 200.
- A JSON contract break and a 4xx still fail the job.
- The integration-test job remains a merge gate.

**Non-Goals:**

- Retries. A retry hides the same outage for one attempt and fails the next.
- A permanent skip of `opendata.gov.nl.ca`. When the portal returns JSON again, the test runs.
- Moving live checks out of CI. A moved endpoint (4xx, or JSON of the wrong shape) must still fail a pull request.
- Changing production fetch behaviour in `upstream-fetcher.ts`.

## Decisions

1. **Classify the body, not a host name.** `isHtmlDocument` is true when the body is an HTML document, or when `Content-Type` is `text/html` or `application/xhtml+xml` and the body is not JSON. A JSON body wins over a wrong content type. RSS (`<?xml` then `<rss`) is not HTML. The check applies only to status 200–299. A 404 HTML page still fails.

   Alternative rejected: skip only `opendata.gov.nl.ca` while the shutdown notice is open. That fixes today's red build and leaves the next portal that serves an HTML error page red again. The measured failures are that class, not one host.

   Alternative rejected: retry on 5xx. #1146 already skips 5xx. The remaining failure is not a 5xx.

2. **`searchCkan` throws after it has read the body.** `skipIfHtmlParseError` recognises both Node 22 (`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`) and the older `Unexpected token < in JSON at position 0`. A truncated JSON token does not match. This stays out of `isNetworkError`, so a bad JSON body is still not called a network error.

3. **`probeUpstream` reads a 512-character prefix and the content type.** The e2e suite uses that probe to decide whether to skip a describe block. A status-only probe treated the NL page as healthy.

4. **Pin the workflow key in the unit test.** The test reads `ci.yml` and rejects a `continue-on-error` key on the integration-test job and on the two live steps inside `build-and-test`. Comments may still mention the old key.

## Risks / Trade-offs

- [A wrong URL that returns the portal homepage skips instead of failing] → The homepage is HTML on 200, which is the outage shape. A removed API that returns 404 still fails. A JSON shape change still fails. The URLs are literals in the test file.
- [A portal labels real JSON as `text/html`] → The body prefix `{` or `[` wins. The test does not skip.
- [Node 24 changes the JSON parse message] → The matcher accepts both the Node 22 message and the older message, and both contain `<` plus either `not valid JSON` or `Unexpected token <`.

## Migration Plan

No deploy step. The next CI run uses the new predicate. Rollback is reverting the commit. The integration-test job stays a required failure if the predicate is wrong.

## Open Questions

None.
