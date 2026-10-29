# Review

The tarball copy is the path `pin-images.sh` already implements. The bug
is the peer: forge, after workloads moved to sentry-agent. A registry
would need a credential. GHCR is retired. No new secret is added.

The store check runs in the nexus deploy job, before the pin commit.
CI checks the plan and the workflow wiring. CI does not SSH.

Redis memory stays at the 128mb cache budget. The probe change is what
stops exit 137 on a slow `PING`.
