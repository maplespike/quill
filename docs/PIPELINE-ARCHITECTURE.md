---
last-reviewed: 2026-06-11
status: archived
---

# CI/CD Pipeline Architecture

**Status:** ARCHIVED — This document was aspirational fiction. The actual CI pipeline is at `.github/workflows/ci.yml` (ubuntu-latest, build+test only).

## What exists

- `.github/workflows/ci.yml` — validates build + runs tests on push to main/prod
- No K8s deployment manifests exist
- No container images are published
- No self-healing, rollback, or escalation infrastructure exists

## For deployment plans

See `ROADMAP.md` and the `docker-compose.yml` in the repo root for the local development stack.
