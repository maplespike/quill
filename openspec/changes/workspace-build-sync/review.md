## Pre-implementation Review

- The QA failure is `ERR_MODULE_NOT_FOUND` for `@maplespike/database/dist` during portal generation.
- Moving the existing repair loop before `portal build` matches the Dockerfile repair and does not add packages.
- The sync hook does not replace the loop, because `tsc -b` skips package scripts.
- Override bumps stay in a separate PR. The sync block and the override block do not share lines.
- No auth, billing, or workflow change.

## Verdict

Proceed with the build-sync slice. Do not deploy from this change.
