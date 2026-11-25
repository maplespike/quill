## 1. Shared helper

- [x] 1.1 Add `applyCorsAndSecurityHeaders` and call it from the handler path
- [x] 1.2 Write every Node listener response through that helper

## 2. Early returns

- [x] 2.1 Cover the rate-limit 429 and the listener 500
- [x] 2.2 Confirm OPTIONS already uses the helper and that no 304 path exists
- [x] 2.3 Cover the public `/metrics` 404

## 3. Regression test

- [x] 3.1 Request `/v1/health` twice against a stub cache and compare the headers
- [x] 3.2 Show the test fails when the helper is skipped on the write path
