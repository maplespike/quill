# MapleSpike CronJob ingestion pipelines — Nix-generated K8s manifests
# All 24 pipeline CronJobs defined as easykubenix objects
{ lib, ... }:

let
  # Pipeline definitions: name → config
  # schedule: cron expression
  # restartPolicy: OnFailure (legacy) or Never (newer, with backoffLimit)
  pipelines = {
    canlii                  = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    committee               = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    corporate               = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    gazette                 = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    gic                     = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    influence               = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    lmia                    = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    oversight               = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };
    provincial-lobbying     = { schedule = "0 6 * * *";   restartPolicy = "OnFailure"; };

    # Pipelines with backoffLimit + Never restart
    cmhc                    = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    cra-charity             = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    defence                 = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    education-research      = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    federal-budget          = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    health-canada           = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    immigration             = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    indigenous-relations    = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    science-research        = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    social-programs         = { schedule = "0 6 * * *";   restartPolicy = "Never"; backoffLimit = 2; };
    transport-infrastructure = { schedule = "0 6 * * *";  restartPolicy = "Never"; backoffLimit = 2; };

    # Every 6 hours
    municipal               = { schedule = "0 */6 * * *"; restartPolicy = "Never"; backoffLimit = 2; };
    provincial-legislatures = { schedule = "0 */6 * * *"; restartPolicy = "Never"; backoffLimit = 2; };
    statcan                 = { schedule = "0 */6 * * *"; restartPolicy = "Never"; backoffLimit = 2; };
  };

  # Generate a single CronJob easykubenix object
  mkCronJob = name: cfg: {
    metadata.labels = {
      app = "quill-ingest";
      pipeline = name;
      tier = "backend";
    };
    spec = {
      schedule = cfg.schedule;
      jobTemplate.spec = {
        ${if cfg ? backoffLimit then "backoffLimit" else null} = cfg.backoffLimit or null;
        template = {
          metadata.labels = {
            app = "quill-ingest";
            pipeline = name;
            tier = "backend";
          };
          spec = {
            restartPolicy = cfg.restartPolicy;
            nodeName = "nexus";
            imagePullSecrets = { _namedlist = true; ghcr = { name = "ghcr-pull"; }; };
            containers = {
              _namedlist = true;
              ingest = {
                name = "quill-ingest";
                image = "ghcr.io/reverb256/quill/quill-ingest:dev";
                imagePullPolicy = "Always";
                env = {
                  _namedlist = true;
                  NODE_ENV = { name = "NODE_ENV"; value = "production"; };
                  PIPELINE = { name = "QUILL_PIPELINE"; value = name; };
                };
                resources = {
                  requests = { cpu = "100m"; memory = "128Mi"; };
                  limits   = { cpu = "500m"; memory = "512Mi"; };
                };
              };
            };
          };
        };
      };
    };
  };

  # SearXNG health check — special CronJob (different image, command, namespace)
  searxngHealth = {
    metadata.labels = {
      app = "quill-mcp";
      component = "monitoring";
    };
    spec = {
      schedule = "0 * * * *";
      successfulJobsHistoryLimit = 3;
      failedJobsHistoryLimit = 1;
      jobTemplate.spec.template = {
        metadata.labels = {
          app = "searxng-health-check";
          component = "monitoring";
        };
        spec = {
          restartPolicy = "OnFailure";
          containers = {
            _namedlist = true;
            health-check = {
              name = "health-check";
              image = "ghcr.io/reverb256/quill/quill-mcp:dev";
              imagePullPolicy = "Always";
              command = [
                "/bin/sh" "-c"
                ''
                  SEARXNG_URL="''${SEARXNG_URL:-http://searxng.search.svc.cluster.local:8080}"
                  echo "[$(date -Iseconds)] Checking SearXNG health at $SEARXNG_URL"
                  STATS=$(curl -s -S -m 10 "$SEARXNG_URL/stats" || echo '{"error":"failed_to_fetch"}')
                  if echo "$STATS" | grep -q "error"; then
                    echo "[ERROR] Failed to fetch SearXNG stats"
                    exit 1
                  fi
                  TOTAL_ENGINES=$(echo "$STATS" | jq -r '.engines | length' 2>/dev/null || echo "0")
                  SUSPENDED_COUNT=$(echo "$STATS" | jq -r '[.engine_stats[] | select(.suspension_time and .suspension_time > 0)] | length' 2>/dev/null || echo "0")
                  echo "[INFO] Total engines: $TOTAL_ENGINES"
                  echo "[INFO] Suspended engines: $SUSPENDED_COUNT"
                  if [ "$SUSPENDED_COUNT" -gt 0 ]; then
                    SUSPENDED_PERCENT=$((SUSPENDED_COUNT * 100 / TOTAL_ENGINES))
                    echo "[WARN] $SUSPENDED_COUNT engines suspended ($SUSPENDED_PERCENT%)"
                    if [ "$SUSPENDED_PERCENT" -gt 20 ]; then
                      echo "[ALERT] High engine suspension rate: $SUSPENDED_PERCENT%"
                      exit 1
                    fi
                  fi
                  TEST_QUERY="test"
                  SEARCH_RESULT=$(curl -s -S -m 10 "$SEARXNG_URL/search?q=$(printf '%s' "$TEST_QUERY" | jq -sRr @uri)&format=json&engines=" || echo '{"error":"search_failed"}')
                  if echo "$SEARCH_RESULT" | grep -q "error"; then
                    echo "[ERROR] SearXNG search endpoint not responding"
                    exit 1
                  fi
                  echo "[OK] SearXNG health check passed"
                ''
              ];
              env = {
                _namedlist = true;
                SEARXNG = { name = "SEARXNG_URL"; value = "http://searxng.search.svc.cluster.local:8080"; };
              };
              resources = {
                requests = { cpu = "50m"; memory = "64Mi"; };
                limits   = { cpu = "100m"; memory = "128Mi"; };
              };
            };
          };
        };
      };
    };
  };

in {
  config.kubernetes.objects = {
    # Standard ingestion pipeline CronJobs in ai-inference namespace
    ai-inference.CronJob =
      lib.mapAttrs mkCronJob pipelines
      // { searxng-health-check = searxngHealth; };
  };
}
