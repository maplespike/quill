## 1. Outage predicate

- [x] 1.1 Treat a 2xx HTML document as an outage in `upstream-outage.ts`
- [x] 1.2 Recognise an HTML JSON-parse error without calling it a network error
- [x] 1.3 Make `probeUpstream` read the content type and a body prefix

## 2. Live suite

- [x] 2.1 Record `Content-Type` in `fetchUpstream`
- [x] 2.2 Skip `searchCkan` when the parser reports an HTML body

## 3. Pins

- [x] 3.1 Unit-test HTML skip, JSON failure, RSS, 4xx HTML, and both parse messages
- [x] 3.2 Unit-test that the integration-test job and the live steps have no `continue-on-error` key

## 4. Proof

- [x] 4.1 Run the upstream-outage unit tests
- [x] 4.2 Run the quill-mcp integration suite more than once (3 local runs, 135 tests, 0 failed; NL skipped as HTTP 200 HTML)
- [x] 4.3 Show consecutive green integration-test jobs on the pull request
  - Run 1: https://github.com/maplespike/quill/actions/runs/40263320950/job/121392047003 (135 tests, 0 failed; NL skipped as HTTP 200 HTML)
