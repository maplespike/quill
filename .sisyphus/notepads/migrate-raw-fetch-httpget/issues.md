# Issues — Migrate raw fetch() → httpGet()

## TypeScript issues

- `resp.json()` returns `Promise<unknown>`, not `Promise<any>`. Native `fetch` `r.json()` returns `Promise<any>`. This caused 3 build errors where code accessed `.result` on the result without a type assertion. Fixed by adding `: any` type annotations.
