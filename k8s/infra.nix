# MapleSpike Infrastructure — Nix-generated K8s manifests
# Observability (Prometheus, Alertmanager, Loki, Promtail, Pushgateway)
# DevOps (Gitea), Monitoring (Uptime Kuma), Dev MCP deployment
{ lib, config, ... }:

{
  # Register CRD apiVersions not in the default easykubenix mapping
  config.kubernetes.apiMappings = {
    PrometheusRule = "monitoring.coreos.com/v1";
  };

  config.kubernetes.objects = {

    # ═══════════════════════════════════════════════════════════
    # Observability namespace
    # ═══════════════════════════════════════════════════════════
    observability.Namespace.observability = {};

    # ── Alertmanager ConfigMap ──────────────────────────────────
    observability.ConfigMap.alertmanager-config.data."alertmanager.yml" = ''
      global:
        smtp_smarthost: 'localhost:25'
        smtp_from: 'alertmanager@maplespike.lan'
        smtp_require_tls: false
      route:
        receiver: 'slack-critical'
        group_wait: 30s
        group_interval: 5m
        repeat_interval: 4h
        routes:
          - match:
              severity: critical
            receiver: slack-critical
            repeat_interval: 4h
          - match:
              severity: warning
            receiver: email-warning
            repeat_interval: 8h
      receivers:
        - name: 'slack-critical'
          slack_configs:
            - api_url: 'https://hooks.slack.com/services/PLACEHOLDER'
              channel: '#alerts'
              title: '{{ template "slack.default.title" . }}'
              text: '{{ template "slack.default.text" . }}'
        - name: 'email-warning'
          email_configs:
            - to: 'admin@maplespike.lan'
              from: 'alertmanager@maplespike.lan'
              smarthost: 'localhost:25'
              require_tls: false
      inhibit_rules:
        - source_match:
            severity: 'critical'
          target_match:
            severity: 'warning'
          equal: ['alertname', 'namespace']
    '';

    # ── Alertmanager Deployment ─────────────────────────────────
    observability.Deployment.alertmanager = {
      metadata.labels = { app = "alertmanager"; component = "monitoring"; };
      spec = {
        replicas = 1;
        selector.matchLabels.app = "alertmanager";
        template = {
          metadata.labels.app = "alertmanager";
          spec = {
            securityContext = { runAsNonRoot = true; seccompProfile.type = "RuntimeDefault"; };
            containers = {
              _namedlist = true;
              alertmanager = {
                name = "alertmanager";
                image = "prom/alertmanager:v0.28.1";
                args = [ "--config.file=/etc/alertmanager/alertmanager.yml" "--storage.path=/alertmanager" ];
                securityContext = { allowPrivilegeEscalation = false; capabilities.drop = [ "ALL" ]; };
                ports = { _namedlist = true; http = { containerPort = 9093; name = "http"; }; };
                volumeMounts = {
                  _namedlist = true;
                  config = { name = "config"; mountPath = "/etc/alertmanager"; };
                  data = { name = "data"; mountPath = "/alertmanager"; };
                };
                resources = { requests = { cpu = "50m"; memory = "64Mi"; }; limits = { cpu = "200m"; memory = "128Mi"; }; };
              };
            };
            volumes = {
              _namedlist = true;
              config = { name = "config"; configMap.name = "alertmanager-config"; };
              data = { name = "data"; emptyDir = {}; };
            };
          };
        };
      };
    };

    observability.Service.alertmanager = {
      metadata.labels.app = "alertmanager";
      spec = { type = "ClusterIP"; selector.app = "alertmanager"; ports = { _namedlist = true; http = { port = 9093; targetPort = 9093; name = "http"; }; }; };
    };

    # ── Prometheus ConfigMap ────────────────────────────────────
    observability.ConfigMap.prometheus-config.data."prometheus.yml" = ''
      global:
        scrape_interval: 15s
        evaluation_interval: 15s
      alerting:
        alertmanagers:
          - static_configs:
            - targets: ['alertmanager.observability:9093']
      rule_files:
        - /etc/prometheus/rules.yml
      scrape_configs:
        - job_name: 'prometheus'
          static_configs:
            - targets: ['localhost:9090']
        - job_name: 'pushgateway'
          honor_labels: true
          static_configs:
            - targets: ['prometheus-pushgateway.observability:9091']
        - job_name: 'maplespike-api'
          static_configs:
            - targets: ['maplespike-api.ai-inference:8084']
        - job_name: 'maplespike-mcp'
          static_configs:
            - targets: ['maplespike-mcp.ai-inference:3001']
        - job_name: 'kubernetes-pods'
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true
    '';

    # ── Prometheus Alerting Rules (PrometheusRule CRD) ──────────
    observability.PrometheusRule.maplespike-cronjob-alerts = {
      metadata.labels = { app = "maplespike"; component = "alerting"; };
      spec.groups = [{
        name = "maplespike-cronjobs";
        interval = "30s";
        rules = {
          _namedlist = true;
          CronJobFailed = {
            alert = "CronJobFailed";
            expr = ''increase(kube_job_status_failed{namespace="ai-inference"}[5m]) > 0'';
            "for" = "1m";
            labels = { severity = "critical"; team = "pipeline"; };
            annotations = { summary = "CronJob {{ $labels.job }} failed"; description = "CronJob {{ $labels.job }} in namespace {{ $labels.namespace }} has failed. Check logs with: kubectl logs job/{{ $labels.job }}"; };
          };
          CronJobRunningTooLong = {
            alert = "CronJobRunningTooLong";
            expr = ''time() - kube_job_status_start_time{namespace="ai-inference"} > 1800'';
            "for" = "2m";
            labels = { severity = "warning"; team = "pipeline"; };
            annotations = { summary = "CronJob {{ $labels.job }} running for >30m"; description = "Job {{ $labels.job }} has been running for more than 30 minutes. Investigate if it's stuck."; };
          };
          PipelineIngestionStale = {
            alert = "PipelineIngestionStale";
            expr = ''(time() - pushgateway_last_push_seconds{job="maplespike-ingest"}) > 7200'';
            "for" = "5m";
            labels = { severity = "warning"; team = "pipeline"; };
            annotations = { summary = "Pipeline ingestion stale for >2h"; description = "Last push to Pushgateway was {{ $value | humanizeDuration }} ago. One or more CronJobs may have stopped running."; };
          };
          NoPipelineData = {
            alert = "NoPipelineData";
            expr = ''(time() - pipeline_data_generated_at_seconds) > 86400'';
            "for" = "10m";
            labels = { severity = "critical"; team = "pipeline"; };
            annotations = { summary = "Pipeline data not generated for >24h"; description = "pipeline-data.json was last generated {{ $value | humanizeDuration }} ago. Run: node scripts/generate-pipeline-data.mjs"; };
          };
        };
      }];
    };

    # ── Prometheus Server Deployment ────────────────────────────
    observability.Deployment.prometheus-server = {
      metadata.labels = { app = "prometheus-server"; component = "monitoring"; };
      spec = {
        replicas = 1;
        selector.matchLabels.app = "prometheus-server";
        template = {
          metadata.labels.app = "prometheus-server";
          spec = {
            securityContext = { runAsNonRoot = true; runAsUser = 65534; fsGroup = 65534; };
            containers = {
              _namedlist = true;
              prometheus = {
                name = "prometheus";
                image = "prom/prometheus:v3.2.1";
                args = [ "--config.file=/etc/prometheus/prometheus.yml" "--storage.tsdb.path=/prometheus" "--storage.tsdb.retention.time=30d" "--web.console.libraries=/usr/share/prometheus/console_libraries" "--web.console.templates=/usr/share/prometheus/consoles" "--web.enable-lifecycle" ];
                ports = { _namedlist = true; http = { containerPort = 9090; name = "http"; }; };
                volumeMounts = {
                  _namedlist = true;
                  config = { name = "config"; mountPath = "/etc/prometheus"; };
                  data = { name = "data"; mountPath = "/prometheus"; };
                };
                resources = { requests = { cpu = "200m"; memory = "512Mi"; }; limits = { cpu = "1000m"; memory = "2Gi"; }; };
              };
            };
            volumes = {
              _namedlist = true;
              config = { name = "config"; configMap.name = "prometheus-config"; };
              data = { name = "data"; emptyDir = {}; };
            };
          };
        };
      };
    };

    observability.Service.prometheus-server = {
      metadata.labels.app = "prometheus-server";
      spec = { selector.app = "prometheus-server"; ports = { _namedlist = true; http = { port = 9090; targetPort = 9090; name = "http"; }; }; };
    };

    # ── Pushgateway Deployment ──────────────────────────────────
    observability.Deployment.prometheus-pushgateway = {
      metadata.labels = { app = "prometheus-pushgateway"; component = "monitoring"; };
      spec = {
        replicas = 1;
        selector.matchLabels.app = "prometheus-pushgateway";
        template = {
          metadata.labels.app = "prometheus-pushgateway";
          spec = {
            securityContext = { runAsNonRoot = true; seccompProfile.type = "RuntimeDefault"; };
            containers = {
              _namedlist = true;
              pushgateway = {
                name = "pushgateway";
                image = "prom/pushgateway:v1.11.0";
                securityContext = { allowPrivilegeEscalation = false; capabilities.drop = [ "ALL" ]; };
                ports = { _namedlist = true; http = { containerPort = 9091; }; };
                resources = { requests = { cpu = "50m"; memory = "64Mi"; }; limits = { cpu = "200m"; memory = "128Mi"; }; };
              };
            };
          };
        };
      };
    };

    observability.Service.prometheus-pushgateway = {
      metadata.labels.app = "prometheus-pushgateway";
      spec = { type = "ClusterIP"; selector.app = "prometheus-pushgateway"; ports = { _namedlist = true; http = { port = 9091; targetPort = 9091; }; }; };
    };

    # ── Loki ConfigMap ──────────────────────────────────────────
    observability.ConfigMap.loki-config.data."loki-config.yaml" = ''
      auth_enabled: false
      server:
        http_listen_port: 3100
      ingester:
        lifecycler:
          address: 127.0.0.1
          ring:
            kvstore:
              store: inmemory
          replication_factor: 1
        chunk_idle_period: 5m
        chunk_retain_period: 30s
      schema_config:
        configs:
          - from: 2020-10-24
            store: boltdb-shipper
            object_store: filesystem
            schema: v11
            index:
              prefix: index_
              period: 24h
      storage_config:
        boltdb_shipper:
          active_index_directory: /loki/index
          cache_location: /loki/cache
          shared_store: filesystem
        filesystem:
          directory: /loki/chunks
      limits_config:
        reject_old_samples: true
        reject_old_samples_max_age: 168h
    '';

    # ── Loki Deployment ─────────────────────────────────────────
    observability.Deployment.loki = {
      metadata.labels = { app = "loki"; component = "monitoring"; };
      spec = {
        replicas = 1;
        selector.matchLabels.app = "loki";
        template = {
          metadata.labels.app = "loki";
          spec = {
            securityContext.runAsNonRoot = true;
            containers = {
              _namedlist = true;
              loki = {
                name = "loki";
                image = "grafana/loki:3.4.2";
                args = [ "-config.file=/etc/loki/loki-config.yaml" ];
                ports = { _namedlist = true; http = { containerPort = 3100; name = "http"; }; };
                volumeMounts = {
                  _namedlist = true;
                  config = { name = "config"; mountPath = "/etc/loki"; };
                  data = { name = "data"; mountPath = "/loki"; };
                };
                resources = { requests = { cpu = "100m"; memory = "128Mi"; }; limits = { cpu = "500m"; memory = "512Mi"; }; };
              };
            };
            volumes = {
              _namedlist = true;
              config = { name = "config"; configMap.name = "loki-config"; };
              data = { name = "data"; emptyDir = {}; };
            };
          };
        };
      };
    };

    observability.Service.loki = {
      metadata.labels.app = "loki";
      spec = { type = "ClusterIP"; selector.app = "loki"; ports = { _namedlist = true; http = { port = 3100; targetPort = 3100; name = "http"; }; }; };
    };

    # ── Promtail ConfigMap ──────────────────────────────────────
    observability.ConfigMap.promtail-config.data."promtail-config.yaml" = ''
      server:
        http_listen_port: 9080
        grpc_listen_port: 0
      positions:
        filename: /tmp/positions.yaml
      clients:
        - url: http://loki.observability:3100/loki/api/v1/push
      scrape_configs:
        - job_name: kubernetes-pods
          pipeline_stages:
            - docker: {}
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels:
                - __meta_kubernetes_pod_label_app
              target_label: job
              replacement: maplespike
            - source_labels:
                - __meta_kubernetes_namespace
              target_label: namespace
            - source_labels:
                - __meta_kubernetes_pod_name
              target_label: pod
            - source_labels:
                - __meta_kubernetes_pod_container_name
              target_label: container
            - source_labels:
                - __meta_kubernetes_pod_node_name
              target_label: node
            - action: replace
              replacement: /var/log/pods/$1/*.log
              separator: /
              source_labels:
                - __meta_kubernetes_namespace
                - __meta_kubernetes_pod_name
              target_label: __path__
    '';

    # ── Promtail DaemonSet ──────────────────────────────────────
    observability.DaemonSet.promtail = {
      metadata.labels = { app = "promtail"; component = "monitoring"; };
      spec = {
        selector.matchLabels.app = "promtail";
        template = {
          metadata.labels.app = "promtail";
          spec = {
            securityContext.runAsNonRoot = true;
            containers = {
              _namedlist = true;
              promtail = {
                name = "promtail";
                image = "grafana/promtail:3.4.2";
                args = [ "-config.file=/etc/promtail/promtail-config.yaml" ];
                ports = { _namedlist = true; http = { containerPort = 9080; name = "http"; }; };
                volumeMounts = {
                  _namedlist = true;
                  config = { name = "config"; mountPath = "/etc/promtail"; };
                  docker-socket = { name = "docker-socket"; mountPath = "/var/run/docker.sock"; readOnly = true; };
                  pod-logs = { name = "pod-logs"; mountPath = "/var/log/pods"; readOnly = true; };
                };
                resources = { requests = { cpu = "50m"; memory = "64Mi"; }; limits = { cpu = "200m"; memory = "128Mi"; }; };
              };
            };
            volumes = {
              _namedlist = true;
              config = { name = "config"; configMap.name = "promtail-config"; };
              docker-socket = { name = "docker-socket"; hostPath = { path = "/var/run/docker.sock"; type = "Socket"; }; };
              pod-logs = { name = "pod-logs"; hostPath = { path = "/var/log/pods"; type = "Directory"; }; };
            };
          };
        };
      };
    };

    # ═══════════════════════════════════════════════════════════
    # ai-inference namespace (Gitea, MCP dev)
    # ═══════════════════════════════════════════════════════════

    # ── Gitea Deployment ────────────────────────────────────────
    ai-inference.Deployment.gitea = {
      metadata.labels = { app = "gitea"; component = "devops"; tier = "infrastructure"; };
      spec = {
        replicas = 1;
        selector.matchLabels.app = "gitea";
        template = {
          metadata.labels = { app = "gitea"; component = "devops"; };
          spec = {
            nodeName = "nexus";
            securityContext.fsGroup = 1000;
            containers = {
              _namedlist = true;
              gitea = {
                name = "gitea";
                image = "docker.io/gitea/gitea:latest-rootless";
                securityContext = { runAsUser = 1000; runAsGroup = 1000; allowPrivilegeEscalation = false; capabilities.drop = [ "ALL" ]; };
                ports = { _namedlist = true; http = { containerPort = 3000; name = "http"; }; };
                env = {
                  _namedlist = true;
                  DB_TYPE = { name = "GITEA__database__DB_TYPE"; value = "sqlite3"; };
                  DB_PATH = { name = "GITEA__database__PATH"; value = "/data/gitea/gitea.db"; };
                  DOMAIN = { name = "GITEA__server__DOMAIN"; value = "gitea.lan"; };
                  ROOT_URL = { name = "GITEA__server__ROOT_URL"; value = "https://gitea.lan"; };
                  HTTP_PORT = { name = "GITEA__server__HTTP_PORT"; value = "3000"; };
                  DISABLE_SSH = { name = "GITEA__server__DISABLE_SSH"; value = "true"; };
                  START_SSH = { name = "GITEA__server__START_SSH_SERVER"; value = "false"; };
                  INSTALL_LOCK = { name = "GITEA__security__INSTALL_LOCK"; value = "true"; };
                  SECRET_KEY = { name = "GITEA__security__SECRET_KEY"; value = "custom-maplespike-gitea-secret-2026"; };
                  MAILER = { name = "GITEA__mailer__ENABLED"; value = "false"; };
                };
                resources = { requests = { cpu = "100m"; memory = "128Mi"; }; limits = { cpu = "500m"; memory = "256Mi"; }; };
                livenessProbe = { httpGet = { path = "/"; port = 3000; }; initialDelaySeconds = 30; periodSeconds = 20; };
                readinessProbe = { httpGet = { path = "/"; port = 3000; }; initialDelaySeconds = 10; periodSeconds = 10; };
                volumeMounts = { _namedlist = true; data = { name = "data"; mountPath = "/data"; }; };
              };
            };
            volumes = { _namedlist = true; data = { name = "data"; emptyDir = {}; }; };
          };
        };
      };
    };

    ai-inference.Service.gitea = {
      metadata.labels = { app = "gitea"; component = "devops"; };
      spec = { type = "NodePort"; selector.app = "gitea"; ports = { _namedlist = true; http = { name = "http"; port = 3000; targetPort = 3000; }; }; };
    };

    # ── MCP Deployment (dev — ai-inference namespace) ───────────
    ai-inference.Deployment.maplespike-mcp = {
      metadata.labels = { app = "maplespike-mcp"; component = "mcp-server"; tier = "backend"; };
      spec = {
        replicas = 1;
        strategy = { type = "RollingUpdate"; rollingUpdate = { maxUnavailable = 0; maxSurge = 1; }; };
        selector.matchLabels.app = "maplespike-mcp";
        template = {
          metadata.labels = { app = "maplespike-mcp"; component = "mcp-server"; tier = "backend"; };
          spec = {
            nodeName = "nexus";
            containers = {
              _namedlist = true;
              mcp = {
                name = "maplespike-mcp";
                image = "ghcr.io/reverb256/maplespike/maplespike-mcp:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 3001; protocol = "TCP"; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "3001"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "production"; };
                  API_URL = { name = "MAPLESPIKE_API_URL"; value = "http://maplespike-api:8082/v1"; };
                  API_KEY = { name = "MAPLESPIKE_API_KEY"; value = "maplespike-dev-key"; };
                  AI_ENDPOINT = { name = "AI_ENDPOINT"; value = "http://ai-inference-gateway:8080/v1"; };
                  AI_MODEL = { name = "AI_MODEL"; value = "Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf"; };
                };
                resources = { requests = { cpu = "100m"; memory = "128Mi"; }; limits = { cpu = "500m"; memory = "512Mi"; }; };
                livenessProbe = { httpGet = { path = "/health"; port = 3001; }; initialDelaySeconds = 15; periodSeconds = 20; timeoutSeconds = 5; };
                readinessProbe = { httpGet = { path = "/health"; port = 3001; }; initialDelaySeconds = 5; periodSeconds = 10; timeoutSeconds = 3; };
              };
            };
          };
        };
      };
    };

    # ═══════════════════════════════════════════════════════════
    # maplespike namespace (Uptime Kuma)
    # ═══════════════════════════════════════════════════════════
    maplespike.Deployment.uptime-kuma = {
      metadata.labels = { app = "uptime-kuma"; component = "monitoring"; };
      spec = {
        replicas = 1;
        selector.matchLabels.app = "uptime-kuma";
        template = {
          metadata.labels = { app = "uptime-kuma"; component = "monitoring"; };
          spec = {
            nodeName = "nexus";
            containers = {
              _namedlist = true;
              uptime-kuma = {
                name = "uptime-kuma";
                image = "louislam/uptime-kuma:2";
                ports = { _namedlist = true; http = { containerPort = 3001; }; };
                env = { _namedlist = true; PORT = { name = "UPTIME_KUMA_PORT"; value = "3001"; }; };
                resources = { requests = { cpu = "100m"; memory = "128Mi"; }; limits = { cpu = "500m"; memory = "256Mi"; }; };
                livenessProbe = { httpGet = { path = "/"; port = 3001; }; initialDelaySeconds = 15; periodSeconds = 20; };
                readinessProbe = { httpGet = { path = "/"; port = 3001; }; initialDelaySeconds = 5; periodSeconds = 10; };
                volumeMounts = { _namedlist = true; data = { name = "data"; mountPath = "/app/data"; }; };
              };
            };
            volumes = { _namedlist = true; data = { name = "data"; emptyDir = {}; }; };
          };
        };
      };
    };

    maplespike.Service.uptime-kuma = {
      metadata.labels = { app = "uptime-kuma"; component = "monitoring"; };
      spec = { type = "NodePort"; selector.app = "uptime-kuma"; ports = { _namedlist = true; http = { port = 3001; targetPort = 3001; }; }; };
    };

  };
}
