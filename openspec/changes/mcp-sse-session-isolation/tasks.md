## Tasks

- [x] Record proposal, design, acceptance scenarios, and security review.
- [x] Emit a plain endpoint URI and bind each stream to a random id, credential hash, and quota identity.
- [x] Re-authenticate the owner on POST and drop the stream when the credential fails.
- [x] Cap sessions, expire idle streams, drop slow clients, and reject bodies over 1 MiB.
- [x] Add HTTP tests for isolation, revocation, caps, idle expiry, oversize bodies, and disconnect.
- [ ] Review through the normal PR workflow. Do not deploy from this slice.

## Scope Notes

Build sync, dependency overrides, Rust CI, discovery artifacts, and version reporting are separate PRs. `http-cache-semantics` is unchanged. Licensing (#1044) and privacy/CASL (#1038) are untouched.
