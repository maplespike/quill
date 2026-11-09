## Decision

Use `ubuntu-latest` for the dependency audit job. Its existing GitHub-hosted setup installs pnpm and Node. Retain the checkout, frozen install, native-binding check, critical advisory gate, audit snapshot, triggers, and dependency ordering.

This avoids consuming an ARC slot and does not change the runner cap or GPU scheduling. GitHub-hosted runners isolate fork code from the homelab. The repository is private, so hosted-runner quota and cost must be observed. No secrets are added.

## Verification

Run the workflow runner-security gate and its tests. Check workflow syntax and CI job results. Compare queue and step timings against previous runs without claiming a speedup until measured.

## Rollback

Revert the runner selection. No deployment or application changes are involved.
