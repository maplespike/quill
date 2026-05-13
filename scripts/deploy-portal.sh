#!/usr/bin/env bash
set -euo pipefail

# Auto-deploy script for civint-portal
# Runs on nexus — pulls prod, builds, pushes, restarts pod

REPO_DIR="/data/projects/own/civint"
IMAGE="localhost:5000/civint-portal:latest"
NAMESPACE="ai-inference"
POD_LABEL="app=civint-portal"

cd "$REPO_DIR"

# Pull latest prod
git fetch origin prod
if git diff --quiet origin/prod..prod -- 'packages/portal/'; then
  echo "No changes to portal — skipping build"
  exit 0
fi

git checkout prod
git pull origin prod

# Build and push image
cd packages/portal
docker build -t "$IMAGE" .
docker push "$IMAGE"

# Restart K8s pod
kubectl delete pod -n "$NAMESPACE" -l "$POD_LABEL" --ignore-not-found
sleep 3
kubectl wait --for=condition=ready pod -l "$POD_LABEL" -n "$NAMESPACE" --timeout=120s

echo "✅ Deployed civint-portal@$(git rev-parse --short HEAD)"
