# MapleSpike Sweep CronJob

A Kubernetes CronJob that periodically runs the MapleSpike intelligence pipeline
against all four Canadian government data sources:

- **spending**   — federal procurement/contract data (via proactive disclosure)
- **lobbying**   — federal lobbying registrations and communications
- **ciec**       — Elections Canada disclosures and donation summaries
- **gac**        — Global Affairs Canada international development projects

## What It Does

Every 6 hours the CronJob:

1. Creates a new `SweepEngine` instance
2. Runs a **full sweep** — parses all sources, resolves entities, builds the
   influence graph, detects signals, and generates an intelligence brief
3. Logs the result (duration, delta, brief id, thread count) and exits

This is the **periodic trigger** for the sweep pipeline. The `SweepScheduler`
class (used by the long-running MCP server for finer-grained intervals) is a
separate concept — this CronJob provides a simple, reliable, at-most-every-6h
invocation for environments that don't need the full scheduler running.

## Deployment

```bash
kubectl apply -f cronjob-sweep.yaml
```

This creates the CronJob in the `ai-inference` namespace.

## Verification

```bash
# List all cronjobs
kubectl get cronjobs -n ai-inference

# See the sweep cronjob details
kubectl describe cronjob maplespike-sweep -n ai-inference

# Watch recent job runs
kubectl get jobs -n ai-inference -l app=maplespike-sweep
kubectl logs -n ai-inference -l app=maplespike-sweep --tail=50
```

## Manual Testing

To trigger an immediate one-off run:

```bash
kubectl create job --from=cronjob/maplespike-sweep test-sweep -n ai-inference
```

Then watch the logs:

```bash
kubectl logs job/test-sweep -n ai-inference --follow
```

## Configuration

| Variable           | Value                                    |
|--------------------|------------------------------------------|
| Schedule           | `0 */6 * * *`  (every 6 hours)          |
| Image              | `nexus:5000/maplespike-mcp:latest`           |
| CPU request        | 200m                                     |
| Memory request     | 256Mi                                    |
| CPU limit          | 500m                                     |
| Memory limit       | 512Mi                                    |
| Restart policy     | OnFailure                                |
| Backoff limit      | 3                                        |

## Files

| File                       | Purpose                              |
|----------------------------|--------------------------------------|
| `cronjob-sweep.yaml`       | K8s CronJob manifest (batch/v1)      |
| `../src/sweep/run.ts`      | CLI entry point invoked by the job   |
