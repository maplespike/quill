# Kelos Default Image AI Inference Gateway Verification

This test verifies that the default Kelos Docker image uses the AI Inference Gateway endpoint instead of the Zen free tier.

## Acceptance Criteria
- No `Invalid API key` or `Model not found` errors during task initialization.
- Logs show the gateway URL being called (e.g., `http://ai-inference-gateway.ai-inference.svc.cluster.local:8080/v1`), not `zen.opencode.ai`.
- Branch created, PR created and merged.

## How to Verify
1. Run a trivial Kelos task (e.g., `kelos task run --image=default`).
2. Check task logs for gateway URL usage.
3. Ensure no API key or model errors appear.

## Notes
- No code changes required; this is a verification checklist.
- Close the issue after successful PR merge.