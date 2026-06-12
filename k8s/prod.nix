# MapleSpike Prod environment — Nix-generated K8s manifests
# Namespace: maplespike-prod
# NodePorts: portal=30964, api=31283, mcp=31745, uptime-kuma=31832
{ lib, ... }:

let
  # Common prod security context
  prodSecurityContext = {
    runAsNonRoot = true;
    allowPrivilegeEscalation = false;
    capabilities.drop = [ "ALL" ];
    seccompProfile.type = "RuntimeDefault";
  };

  # Tailscale funnel annotations for Ingress
  tailscaleFunnelAnnotations = {
    "tailscale.com/funnel" = "true";
    "tailscale.com/proxy-group" = "funnel-proxies";
  };

in {
  config.kubernetes.objects = {

    # ── Namespace ───────────────────────────────────────────────
    maplespike-prod.Namespace.maplespike-prod = {
      metadata.labels = {
        pod-security.kubernetes.io.enforce = "baseline";
        pod-security.kubernetes.io.enforce-version = "latest";
      };
    };

    # ── BYOK: User-Provided API Keys ───────────────────────────
    # Users provide their own keys (CanLII, AI, etc.) - no hardcoded secrets
    # Secret must exist before deployment:
    #   kubectl create secret generic maplespike-api-keys \
    #     --from-literal=MAPLESPIKE_CANLII_API_KEY=your_key_here \
    #     --from-literal=MAPLESPIKE_AI_ENDPOINT=your_endpoint_here \
    #     --from-literal=MAPLESPIKE_AI_API_KEY=your_ai_key_here \
    #     --from-literal=MAPLESPIKE_AI_MODEL=your_model_here \
    #     -n maplespike-prod
    maplespike-prod.Secret.maplespike-api-keys = {
      type = "Opaque";
      stringData = {
        # User must provide keys (can be empty string if not using feature)
        MAPLESPIKE_CANLII_API_KEY = "";
        MAPLESPIKE_AI_ENDPOINT = "";
        MAPLESPIKE_AI_API_KEY = "";
        MAPLESPIKE_AI_MODEL = "";
      };
    };

    # ── DB Secret ───────────────────────────────────────────────
    maplespike-prod.Secret.maplespike-db-secret = {
      type = "Opaque";
      stringData = {
        postgres-password = "maplespike-db-prod";
        postgres-user = "maplespike";
        postgres-database = "maplespike";
      };
    };

    # ── PostgreSQL StatefulSet ──────────────────────────────────
    maplespike-prod.StatefulSet.maplespike-db = {
      metadata.labels = {
        app = "maplespike-db";
        component = "database";
        tier = "data";
      };
      spec = {
        serviceName = "maplespike-db";
        replicas = 1;
        selector.matchLabels.app = "maplespike-db";
        template = {
          metadata.labels.app = "maplespike-db";
          spec = {
            automountServiceAccountToken = false;
            nodeName = "nexus";
            containers = {
              _namedlist = true;
              postgres = {
                name = "postgres";
                securityContext = prodSecurityContext;
                image = "postgres:17-alpine";
                ports = { _namedlist = true; psql = { containerPort = 5432; }; };
                env = {
                  _namedlist = true;
                  PGUSER = {
                    name = "POSTGRES_USER";
                    valueFrom.secretKeyRef = { name = "maplespike-db-secret"; key = "postgres-user"; };
                  };
                  PGPASSWORD = {
                    name = "POSTGRES_PASSWORD";
                    valueFrom.secretKeyRef = { name = "maplespike-db-secret"; key = "postgres-password"; };
                  };
                  PGDB = {
                    name = "POSTGRES_DB";
                    valueFrom.secretKeyRef = { name = "maplespike-db-secret"; key = "postgres-database"; };
                  };
                  PGDATA = { name = "PGDATA"; value = "/var/lib/postgresql/data/pgdata"; };
                };
                resources = {
                  requests = { cpu = "100m"; memory = "128Mi"; };
                  limits   = { cpu = "500m"; memory = "512Mi"; };
                };
                volumeMounts = {
                  _namedlist = true;
                  data = { name = "data"; mountPath = "/var/lib/postgresql/data"; };
                };
                readinessProbe = {
                  exec.command = [ "pg_isready" "-U" "maplespike" ];
                  initialDelaySeconds = 10;
                  periodSeconds = 10;
                };
                livenessProbe = {
                  exec.command = [ "pg_isready" "-U" "maplespike" ];
                  initialDelaySeconds = 30;
                  periodSeconds = 20;
                };
              };
            };
          };
        };
        volumeClaimTemplates = {
          _namedlist = true;
          data = {
            metadata.name = "data";
            spec = {
              accessModes = [ "ReadWriteOnce" ];
              resources.requests.storage = "5Gi";
            };
          };
        };
      };
    };

    # ── PostgreSQL Service ──────────────────────────────────────
    maplespike-prod.Service.maplespike-db = {
      metadata.labels.app = "maplespike-db";
      spec = {
        ports = { _namedlist = true; psql = { port = 5432; targetPort = 5432; }; };
        selector.app = "maplespike-db";
      };
    };

    # ── API Deployment ──────────────────────────────────────────
    maplespike-prod.Deployment.maplespike-api = {
      metadata.labels = {
        app = "maplespike-api";
        component = "api";
        tier = "backend";
      };
      spec = {
        replicas = 2;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "maplespike-api";
        template = {
          metadata.labels = {
            app = "maplespike-api";
            component = "api";
            tier = "backend";
          };
          spec = {
            automountServiceAccountToken = false;
            imagePullSecrets = { _namedlist = true; ghcr = { name = "ghcr-pull"; }; };
            nodeName = "nexus";
            containers = {
              _namedlist = true;
              api = {
                name = "api";
                securityContext = prodSecurityContext;
                image = "ghcr.io/reverb256/maplespike/maplespike-api:stable";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 8082; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "8082"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "production"; };
                  STORAGE = { name = "MAPLESPIKE_STORAGE"; value = "sqlite"; };
                  # BYOK: User-provided CanLII API Key (optional)
                  CANLII_API_KEY = {
                    name = "MAPLESPIKE_CANLII_API_KEY";
                    valueFrom.secretKeyRef = {
                      name = "maplespike-api-keys";
                      key = "MAPLESPIKE_CANLII_API_KEY";
                      optional = true;
                    };
                  };
                  # BYOK: User-provided AI config (optional, with fallbacks)
                  AI_ENDPOINT = {
                    name = "MAPLESPIKE_AI_ENDPOINT";
                    valueFrom.secretKeyRef = {
                      name = "maplespike-api-keys";
                      key = "MAPLESPIKE_AI_ENDPOINT";
                      optional = true;
                    };
                    default = "http://ai-inference-gateway.ai-inference:8080/v1";
                  };
                  AI_MODEL = {
                    name = "MAPLESPIKE_AI_MODEL";
                    valueFrom.secretKeyRef = {
                      name = "maplespike-api-keys";
                      key = "MAPLESPIKE_AI_MODEL";
                      optional = true;
                    };
                    default = "Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf";
                  };
                  AI_API_KEY = {
                    name = "MAPLESPIKE_AI_API_KEY";
                    valueFrom.secretKeyRef = {
                      name = "maplespike-api-keys";
                      key = "MAPLESPIKE_AI_API_KEY";
                      optional = true;
                    };
                    default = "maplespike-dev-key";
                  };
                  # Qdrant vector DB for semantic RAG
                  QDRANT_ENDPOINT = {
                    name = "MAPLESPIKE_QDRANT_ENDPOINT";
                    value = "http://qdrant:6333";
                  };
                  QDRANT_COLLECTION = {
                    name = "MAPLESPIKE_QDRANT_COLLECTION";
                    value = "maplespike";
                  };
                  EMBED_MODEL = {
                    name = "MAPLESPIKE_EMBED_MODEL";
                    value = "nvidia/llama-3.2-nv-embedqa-1b-v2";
                  };
                  # Database config (can be overridden by external Postgres)
                  DB_PATH = { name = "MAPLESPIKE_DB_PATH"; value = "/data/maplespike.db"; };
                  DB_HOST = {
                    name = "MAPLESPIKE_DB_HOST";
                    value = "";
                    optional = true;
                  };
                  DB_PORT = {
                    name = "MAPLESPIKE_DB_PORT";
                    value = "";
                    optional = true;
                  };
                  DB_NAME = { name = "MAPLESPIKE_DB_NAME"; value = "maplespike"; };
                  DB_USER = {
                    name = "MAPLESPIKE_DB_USER";
                    valueFrom.secretKeyRef = { name = "maplespike-db-secret"; key = "postgres-user"; };
                  };
                  DB_PASSWORD = {
                    name = "MAPLESPIKE_DB_PASSWORD";
                    valueFrom.secretKeyRef = { name = "maplespike-db-secret"; key = "postgres-password"; };
                  };
                };
                resources = {
                  requests = { cpu = "100m"; memory = "128Mi"; };
                  limits   = { cpu = "500m"; memory = "512Mi"; };
                };
                livenessProbe = {
                  httpGet = { path = "/v1/health"; port = 8082; };
                  initialDelaySeconds = 15;
                  periodSeconds = 20;
                };
                readinessProbe = {
                  httpGet = { path = "/v1/health"; port = 8082; };
                  initialDelaySeconds = 5;
                  periodSeconds = 10;
                };
                volumeMounts = {
                  _namedlist = true;
                  data = { name = "data"; mountPath = "/data"; };
                };
              };
            };
            volumes = {
              _namedlist = true;
              data = { name = "data"; emptyDir = {}; };
            };
          };
        };
      };
    };

    # ── API Service ─────────────────────────────────────────────
    maplespike-prod.Service.maplespike-api = {
      metadata.labels = {
        app = "maplespike-api";
        component = "api";
        tier = "backend";
      };
      spec = {
        type = "NodePort";
        selector.app = "maplespike-api";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 8082; targetPort = 8082; nodePort = 31283; };
        };
      };
    };

    # ── API Ingress (Tailscale funnel) ──────────────────────────
    maplespike-prod.Ingress.maplespike-api = {
      metadata = {
        labels = {
          app = "maplespike-api";
          "app.kubernetes.io/managed-by" = "easykubenix";
        };
        annotations = tailscaleFunnelAnnotations;
      };
      spec = {
        ingressClassName = "tailscale";
        rules = [{
          http.paths = [{
            path = "/";
            pathType = "Prefix";
            backend.service = {
              name = "maplespike-api";
              port.number = 8082;
            };
          }];
        }];
      };
    };

    # ── MCP Deployment ──────────────────────────────────────────
    maplespike-prod.Deployment.maplespike-mcp = {
      metadata.labels = {
        app = "maplespike-mcp";
        component = "mcp";
        tier = "backend";
      };
      spec = {
        replicas = 1;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "maplespike-mcp";
        template = {
          metadata.labels = {
            app = "maplespike-mcp";
            component = "mcp";
            tier = "backend";
          };
          spec = {
            automountServiceAccountToken = false;
            imagePullSecrets = { _namedlist = true; ghcr = { name = "ghcr-pull"; }; };
            nodeName = "nexus";
            containers = {
              _namedlist = true;
              mcp = {
                name = "mcp";
                securityContext = prodSecurityContext;
                image = "ghcr.io/reverb256/maplespike/maplespike-mcp:stable";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 3001; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "3001"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "production"; };
                  API_URL = { name = "MAPLESPIKE_API_URL"; value = "http://maplespike-api:8082/v1"; };
                  API_KEY = { name = "MAPLESPIKE_API_KEY"; value = "maplespike-dev-key"; };
                  AI_ENDPOINT = { name = "AI_ENDPOINT"; value = "http://ai-inference-gateway.ai-inference:8080/v1"; };
                  AI_MODEL = { name = "AI_MODEL"; value = "Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf"; };
                };
                resources = {
                  requests = { cpu = "100m"; memory = "128Mi"; };
                  limits   = { cpu = "500m"; memory = "512Mi"; };
                };
                livenessProbe = {
                  httpGet = { path = "/health"; port = 3001; };
                  initialDelaySeconds = 15;
                  periodSeconds = 20;
                };
                readinessProbe = {
                  httpGet = { path = "/health"; port = 3001; };
                  initialDelaySeconds = 5;
                  periodSeconds = 10;
                };
              };
            };
          };
        };
      };
    };

    # ── MCP Service ─────────────────────────────────────────────
    maplespike-prod.Service.maplespike-mcp = {
      metadata.labels = {
        app = "maplespike-mcp";
        component = "mcp";
        tier = "backend";
      };
      spec = {
        type = "NodePort";
        selector.app = "maplespike-mcp";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 3001; targetPort = 3001; nodePort = 31745; };
        };
      };
    };

    # ── MCP Ingress (Tailscale funnel) ──────────────────────────
    maplespike-prod.Ingress.maplespike-mcp = {
      metadata = {
        labels = {
          app = "maplespike-mcp";
          "app.kubernetes.io/managed-by" = "easykubenix";
        };
        annotations = tailscaleFunnelAnnotations;
      };
      spec = {
        ingressClassName = "tailscale";
        rules = [{
          http.paths = [{
            path = "/";
            pathType = "Prefix";
            backend.service = {
              name = "maplespike-mcp";
              port.number = 3001;
            };
          }];
        }];
      };
    };

    # ── Portal ConfigMap ────────────────────────────────────────
    maplespike-prod.ConfigMap.portal-config = {
      metadata.labels = {
        app = "maplespike-portal";
        component = "portal";
      };
  data = {
    "config.js" = ''
window.MAPLESPIKE = window.MAPLESPIKE || {};
MAPLESPIKE.apiBase = "https://maplespike-api.lan";
MAPLESPIKE.apiKey = "";
MAPLESPIKE.timeout = { health: 3000, quick: 5000, default: 8000 };
'';
  };
    };

    # ── Portal Deployment ───────────────────────────────────────
    maplespike-prod.Deployment.maplespike-portal = {
      metadata.labels = {
        app = "maplespike-portal";
        component = "portal";
        tier = "frontend";
      };
      spec = {
        replicas = 1;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "maplespike-portal";
        template = {
          metadata.labels = {
            app = "maplespike-portal";
            component = "portal";
            tier = "frontend";
          };
          spec = {
            automountServiceAccountToken = false;
            imagePullSecrets = { _namedlist = true; ghcr = { name = "ghcr-pull"; }; };
            nodeName = "nexus";
            containers = {
              _namedlist = true;
              portal = {
                name = "portal";
                securityContext = prodSecurityContext;
                image = "ghcr.io/reverb256/maplespike/maplespike-portal:stable";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 8080; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "8080"; };
                  API_URL = { name = "API_URL"; value = "http://maplespike-api:8082/v1"; };
                };
                volumeMounts = {
                  _namedlist = true;
                  config = {
                    name = "portal-config";
                    mountPath = "/app/config.js";
                    subPath = "config.js";
                  };
                };
                resources = {
                  requests = { cpu = "50m"; memory = "64Mi"; };
                  limits   = { cpu = "200m"; memory = "128Mi"; };
                };
                livenessProbe = {
                  httpGet = { path = "/"; port = 8080; };
                  initialDelaySeconds = 10;
                  periodSeconds = 20;
                };
                readinessProbe = {
                  httpGet = { path = "/"; port = 8080; };
                  initialDelaySeconds = 5;
                  periodSeconds = 10;
                };
              };
            };
            volumes = {
              _namedlist = true;
              config = {
                name = "portal-config";
                configMap = {
                  name = "portal-config";
                  items = {
                    _namedlist = true;
                    config-js = { key = "config.js"; path = "config.js"; };
                  };
                };
              };
            };
          };
        };
      };
    };

    # ── Portal Service ──────────────────────────────────────────
    maplespike-prod.Service.maplespike-portal = {
      metadata.labels = {
        app = "maplespike-portal";
        component = "portal";
        tier = "frontend";
      };
      spec = {
        type = "NodePort";
        selector.app = "maplespike-portal";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 8080; targetPort = 8080; nodePort = 30964; };
        };
      };
    };

    # ── Portal Ingress (Tailscale funnel) ───────────────────────
    maplespike-prod.Ingress.maplespike-portal = {
      metadata = {
        labels = {
          app = "maplespike-portal";
          "app.kubernetes.io/managed-by" = "easykubenix";
        };
        annotations = tailscaleFunnelAnnotations;
      };
      spec = {
        ingressClassName = "tailscale";
        rules = [{
          http.paths = [{
            path = "/";
            pathType = "Prefix";
            backend.service = {
              name = "maplespike-portal";
              port.number = 8080;
            };
          }];
        }];
      };
    };

  };
}
