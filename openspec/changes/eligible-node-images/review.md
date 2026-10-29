# Review

Cross-node ssh is not allowed, so the tarball copy cannot run. The registry
at `registry.registry.svc.cluster.local:5000` is already mirrored on nexus
and sentry-agent over plain HTTP. Pushing there, and pulling with
IfNotPresent, is the path that does not add a secret and does not depend
on one machine's containerd.

The pin is the registry's `Docker-Content-Digest`, checked before the commit.
Prune deletes manifest links only. Garbage-collect stays in the registry pod
because the API cannot free the 50Gi volume by itself.

quill-search is pushed from the nexus store. There is no Dockerfile for it
in this repo. If the bytes are missing, the push fails and says so.
