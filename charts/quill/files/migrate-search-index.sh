#!/bin/sh
# Copy the legacy search claim onto the longhorn claim once.
# A later start is a no-op when the durable volume already has the index.
set -eu
if [ -f /data/index/quill-meta.json ]; then
  echo "search index already present on the durable volume"
  exit 0
fi
if [ -f /legacy/index/quill-meta.json ]; then
  mkdir -p /data/index
  cp -a /legacy/index/. /data/index/
  if [ ! -f /data/index/quill-meta.json ]; then
    echo "search index copy did not produce quill-meta.json" >&2
    exit 1
  fi
  echo "copied the legacy search index onto the durable volume"
  exit 0
fi
echo "search index: durable volume is empty and the legacy volume has no quill-meta.json"
exit 0
