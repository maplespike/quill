## Tasks

- [x] Record proposal, design, acceptance scenarios, and pre-implementation review.
- [x] Add real HTTP framing, ownership, discovery, call, and shutdown tests.
- [x] Repair endpoint framing, random session IDs, captured quota identity, and owner authentication.
- [x] Run MCP typecheck, 844 unit tests, 110 passing integration tests (10 skipped), and compiled route tests.
- [x] Repair injected workspace dependency synchronization after builds.
- [x] Repair mandatory portal generator failure propagation and verify fresh discovery artifacts.
- [x] Update vulnerable dependency resolutions and rerun builds, typechecks, API/MCP/portal/notification tests.
- [x] Repair Rust non-login PATH discovery; verify formatting, Clippy, library tests, and nexus preflight.
- [x] Verify existing stdio PR independently (19 passing tests); do not duplicate or merge it.
- [x] Document marketplace corrections and live rollout limitations in docs/QUILL-READINESS-2026-10-14.md.
- [ ] Review and integrate changes through the normal PR workflow; do not deploy implicitly.
- [ ] Verify authenticated live MCP after an approved rollout.

## Scope Notes

Runtime verification exposed missing injected build artifacts and mandatory generator failures hidden by the portal shell command. Those root causes had to be repaired to test the compiled interface. Dependency remediation follows existing issue #1047; Rust runner remediation follows #1048. The remaining unpatched high advisory is not suppressed. Privacy/credential/licensing decisions remain separate blockers, not completed tasks.
