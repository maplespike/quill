#!/usr/bin/env nix-shell
#!nix-shell -p kubectl jq bash -i bash

# =============================================================================
# K8s Manifest Validation Script
# =============================================================================
# ⚠️  ARCHIVED: This script validates K8s manifests that were never implemented.
# Current deployment uses Docker Compose for local development.
# K8s deployment is planned for ROADMAP.md Phase 3.
#
# Original Purpose:
# Validates Nix-generated K8s manifests for schema, security, and resource compliance
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  This script is ARCHIVED${NC}"
echo "K8s deployment does not exist. Current deployment uses Docker Compose."
echo "See ROADMAP.md Phase 3 and docs/K8S-NIX-MANIFESTS.md for details."
echo ""
echo -e "${RED}✗ Cannot validate K8s manifests - no K8s deployment exists${NC}"
exit 1