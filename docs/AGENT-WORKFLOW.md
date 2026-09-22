---
last-reviewed: 2026-09-22
status: active
---

# How this repository is built — the agent-driven workflow

Quill is developed by a small fleet of autonomous agents under human
direction. This is deliberate, not incidental, and it is visible in the repo:
the kanban workflow, the dispatch scripts, and the `.hermes-profile` file are
part of the process, not clutter. This document explains the shape so a
newcomer can read the repository without guessing.

## The split

**Creative direction is human.** What to build, what matters, what the quality
bar is, what ships. That layer is not delegated.

**The operational layer is agent-owned.** How to build it, how to test it, how
to deploy it, how to keep it running. Agents hold this end to end.

## What runs where

| Piece | Role |
|---|---|
| `.github/workflows/kanban-ingest.yml` | Turns repository events into work items |
| `scripts/kanban-post.sh` | Posts a work item from a shell or an agent |
| `scripts/kanban-execute.sh` | A worker picks an item up and does it |
| `KANBAN-AUTOMATION.md`, `KANBAN-SETUP.md` | Setup and operating notes |
| `.hermes-profile` | The agent profile this repository is developed under |

Work is event-driven rather than polled: a CI failure, a new issue, or a
security alert becomes a card, and a dispatcher routes it to the agent that
owns that domain. Each domain has one owner, so two agents never fight over the
same failure mode.

## The rules this workflow runs under

These are enforced by review, not by hope:

1. **Everything declarative.** Persistent configuration lives in git. Cluster
   state is a rendering of the repo — see `scripts/sops-sync-k8s.sh`, whose
   `--check` mode proves the cluster matches the committed secrets and exits
   non-zero when it does not. A change that only exists in a running cluster is
   a bug.
2. **Root cause, not symptom.** A failing test, a red pipeline, or a broken
   deploy is diagnosed before it is patched. Workarounds that disable a feature
   are rejected.
3. **Every error becomes a test.** A failure that reaches production or CI gets
   a regression test in the same change that fixes it.
4. **No stubs.** A deliverable is complete and executed, or it is not done.
   Placeholders, `TODO`s and "implement later" do not pass.
5. **Verify, then claim.** A green check is evidence; a summary is not. Deploys
   are confirmed against live state, not against the intent behind a command.

## How to work with it

You do not need the fleet to contribute. The ordinary path works:

```
git clone https://github.com/reverb256/quill && cd quill
pnpm install
pnpm build && pnpm test
```

Open an issue or a pull request as you would anywhere else. Agents may pick up
labelled issues and open PRs, and they follow the same CI as a human
contributor — there is no privileged path.

## Why publish this

Because the workflow is the honest answer to "how is this moving so fast", and
because an open project should show its method. If you want to run the same
shape, `KANBAN-SETUP.md` is the starting point.
