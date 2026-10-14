## Context

`initialize` hardcoded `serverVersion = '0.1.0'`. `src/` and `dist/` both sit one directory below `packages/quill-mcp/package.json`, so one relative read serves both. `tool-index.json` is `[{n, d}]` with descriptions sliced to 200 characters. Runtime `quill://tool-index` is built from the registry. Portal generators do not read the file. Regenerating it can still trigger the portal drift workflow because the path matches `packages/quill-mcp/src/tools/**`.

## Decisions

1. Throw if the package version is missing or empty.
2. Change only the root `version` field to `0.4.0`. Do not change the API header version, chart `appVersion`, or other package versions.
3. Regenerate the index from `getAllTools()` in the existing file format.
4. Keep the readiness note factual. Production is not updated. `http-cache-semantics` stays unpatched. Licensing and privacy work stay out.

## Rollout

Version text changes on the next MCP image. Discovery files change on the next portal image. No config or secret change. Rollback restores the previous JSON and the hardcoded `0.1.0`.

## Verification

The protocol test compares `initialize` `serverInfo.version` to the quill-mcp package version. The tool-index test deep-equals the file to the live registry. The portal smoke test compares discovery dates to `docs/metrics.json` when `dist/` exists.
