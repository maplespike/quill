#!/bin/bash
# Cron job: Poll IMAP for Interac e-Transfer payments every 5 minutes
# Add to crontab: */5 * * * * /path/to/maplespike/scripts/billing-reconcile.sh

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_DIR/.env.deployment" ]; then
  set -a
  source "$PROJECT_DIR/.env.deployment"
  set +a
fi

# Call reconciliation endpoint with billing secret
curl -X POST http://localhost:8082/v1/billing/reconcile \
  -H "Content-Type: application/json" \
  -H "X-Billing-Secret: $MAPLESPIKE_BILLING_SECRET" \
  2>&1 | logger -t maplespike-billing