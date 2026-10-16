## 1. Probe

- [x] 1.1 `scripts/gates/pages-probe.sh`: classify `GET /repos/{repo}/pages` — enabled (exit 0) / not-enabled on 404 (exit 0, verdict carries the state) / error (exit 1, fail-closed preconditions for missing token, gh, repo)
- [x] 1.2 Emit `verdict=<…>` to `$GITHUB_OUTPUT` on every path (including errors) so the workflow gates on a value, never on absence

## 2. Workflow gating

- [x] 2.1 `deploy-docs.yml`: probe step (`continue-on-error: true`) before `configure-pages`, with `GH_TOKEN: ${{ github.token }}` and `GH_REPO: ${{ github.repository }}`
- [x] 2.2 "Fail loud on probe error" step: no verdict (or verdict=error) fails the job — a crashed probe must never read as not-enabled
- [x] 2.3 "Skip Pages deploy" step: verdict=not-enabled → loud `::warning::`, green run
- [x] 2.4 All three deploy steps gated on `if: steps.pages-probe.outputs.verdict == 'enabled'`
- [x] 2.5 Header note updated: current state (422 plan refusal), the gating, and the self-heal path

## 3. Regression lane (incident rule — every failure becomes a test)

- [x] 3.1 `scripts/test-deploy-docs-pages-gating.mts`: probe verdict contract executed against a stubbed `gh` (enabled / live 404 stderr / 401 / 422 / crash / no-token / no-gh / no-repo / GITHUB_TOKEN)
- [x] 3.2 Same lane pins the workflow wiring (probe step + token in scope, every deploy step gated, fail-closed step, loud skip)
- [x] 3.3 `package.json`: `test:pages-gating` script, added to the root `test` chain
- [x] 3.4 `ci.yml`: "Pages deploy gating unit tests" step

## 4. Verification

- [x] 4.1 Probe runs green locally against the live repo (verdict=not-enabled, exit 0)
- [x] 4.2 `pnpm run test:pages-gating` — all tests pass locally
- [x] 4.3 actionlint + workflow-YAML gate + gh-auth gate pass on the edited workflows
- [x] 4.4 CI green on the branch
- [x] 4.5 Manual `workflow_dispatch` of "Deploy Docs to GitHub Pages" on the branch merges green with the warning annotation (build verified, deploy skipped)
- [x] 4.6 After merge: green "Deploy Docs to GitHub Pages" run on main, linked in the task
