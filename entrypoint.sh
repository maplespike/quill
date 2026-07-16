#!/bin/sh
# Wrapper entrypoint for quill-api.
# Issue #778: ensure Node trusts outbound TLS by pointing it at our consolidated
# CA bundle. The path is parameterized via CA_CERT_PATH (defaults below) so it can
# be overridden at runtime without rebuilding the image.
set -e

export NODE_EXTRA_CA_CERTS="${CA_CERT_PATH:-/usr/local/share/ca-certificates/ca-bundle.crt}"
exec node "$@"
