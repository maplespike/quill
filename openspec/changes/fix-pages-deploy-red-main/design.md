# Design: Pages deploy gating for deploy-docs.yml (issue #1086)

## Approach

Classify the repository's Pages state at run time, then gate — do not
hard-code "disabled" or delete the deploy path. Three verdicts, one probe:

| `GET /repos/{repo}/pages` | verdict | workflow behaviour |
|---|---|---|
| 200 | `enabled` | deploy steps run (unchanged) |
| 404 | `not-enabled` | skip deploy only, `::warning::`, green run |
| anything else / crash | `error` | fail loud (fail-closed) |

## The probe step

`scripts/gates/pages-probe.sh` runs BEFORE `actions/configure-pages` and
writes `verdict=<…>` to `$GITHUB_OUTPUT`:

- exit 0 + `verdict=enabled` — a Pages site exists.
- exit 3 + `verdict=not-enabled` — 404. `gh`'s exact live stderr shape is
  `gh: Not Found (HTTP 404)`; the script greps for `HTTP 404`, not the
  message text, so a re-worded error still classifies correctly.
- exit 1 + `verdict=error` — any other failure, and every missing
  precondition (no `GH_TOKEN`/`GITHUB_TOKEN`, no `gh` on PATH, no
  `GH_REPO`). Each also emits `::error::`.

The workflow step carries `continue-on-error: true` — but that is safe only
because a separate "Fail loud on probe error" step re-fails the job whenever
the verdict is neither `enabled` nor `not-enabled`. A probe that crashes
before writing a verdict therefore fails the run; it can never silently skip
a deploy on a repo where Pages is enabled.

## Why skip-green rather than disable the workflow

`deploy-demo-pages.yml` was disabled by hand on 2026-10-08 for the same
disease. Disposing of the workflow entirely (or disabling it) also disposes
of its build verification: nothing else in CI builds the docs HTML via
`scripts/build-docs.mjs` on a clean hosted runner (the `docs` package build
and `docs-validation.yml` do not). Keeping the workflow running with the
deploy gated preserves that signal and self-heals the moment Pages becomes
available — no human has to remember to re-enable anything.

## Why the build steps are NOT gated

Every step above the probe (checkout → pnpm → node → install → workspace
build → portal build → docs build → asset copy) is real verification this
repo can still perform. They run unconditionally. Only the three Pages
steps are gated.

## Rollout and rollback

- Rollout: merge to main; the next docs/portal push (or manual dispatch)
  exercises the probe. Expected result today: green run, warning annotation,
  no deploy.
- Rollback: revert the commit — the workflow returns to its previous
  always-red state. No cluster component consumes anything this workflow
  produces (production traffic routes through the Cloudflare tunnel, not
  Pages; see docs/ROUTING.md).
- Enabling the real deploy later needs no code change: flip the repo public
  or upgrade the org plan, enable Pages with Source "GitHub Actions"
  (custom domain `maplespike.ca`), re-run the workflow. verdict=enabled
  fires the deploy steps as they are.

## Test plan

`scripts/test-deploy-docs-pages-gating.mts` (tsx --test):

1. Probe contract, executed for real against a stubbed `gh`: rc 0 →
   enabled; the live 404 stderr shape → rc 3 / not-enabled; 401 / 422 /
   bare crash → rc 1 / error; every missing precondition → rc 1 / error;
   `GITHUB_TOKEN` accepted as the token name.
2. Workflow wiring, asserted on the file: the probe step exists with
   `GH_TOKEN: ${{ github.token }}` in scope; every deploy step carries
   `if: … verdict == 'enabled'`; the fail-closed step exists; the
   not-enabled skip is loud.

Wired into CI as "Pages deploy gating unit tests" and into the root
`pnpm test` chain as `test:pages-gating`.
