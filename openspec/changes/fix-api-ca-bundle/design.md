# Design: Fix API CA bundle (issue #778)

## Approach
Single consolidated CA bundle + env-driven `NODE_EXTRA_CA_CERTS`.

### Image changes (`Dockerfile.api`)
```
# Runtime stage (node:22-bookworm-slim)
RUN apt-get install -y ca-certificates ...
RUN mkdir -p /usr/local/share/ca-certificates && \
    cp /etc/ssl/certs/ca-certificates.crt /usr/local/share/ca-certificates/ca-bundle.crt

ENV CA_CERT_PATH=/usr/local/share/ca-certificates/ca-bundle.crt
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["packages/api-server/dist/dev-server.js"]
```

### `entrypoint.sh`
```sh
#!/bin/sh
set -e
export NODE_EXTRA_CA_CERTS="${CA_CERT_PATH:-/usr/local/share/ca-certificates/ca-bundle.crt}"
exec node "$@"
```

## Why this works
Debian's `ca-certificates` package writes the Mozilla CA bundle to
`/etc/ssl/certs/ca-certificates.crt`. Copying it to a stable, predictable path and
pointing `NODE_EXTRA_CA_CERTS` at it makes Node validate outbound TLS against the
full public CA set, resolving the `unable to get local issuer certificate` error
on the GitHub token exchange.

## Runtime override
Operators may set `CA_CERT_PATH` on the Deployment pod spec to point at a custom
bundle (e.g. to add an internal CA) without rebuilding the image.

## Build caveats
- Build with `podman build --format docker --no-cache` to guarantee the new CA
  layer is actually materialized (stale cache produced a no-op digest before).
- Push with `podman push --format docker ... --tls-verify=false` (nexus:5000 is a
  plain-HTTP registry; OCI format corrupts on it).
- Pin the Deployment to the pushed manifest digest (never `:latest` + IfNotPresent
  for a live fix).
