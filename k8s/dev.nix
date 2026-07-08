# MapleSpike Dev environment — Nix-generated K8s manifests
# Namespace: maplespike
# NodePorts: portal=30965, api=31284, mcp=31746
{ lib, ... }:

let
  # Common dev affinity — prefer nexus/sentry/forge, avoid zephyr
  devAffinity = {
    nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution = {
      _namedlist = true;
      prefer-nodes = {
        weight = 100;
        preference.matchExpressions = {
          _namedlist = true;
          hostname = {
            key = "kubernetes.io/hostname";
            operator = "In";
            values = [ "nexus" "sentry" "forge" ];
          };
        };
      };
      avoid-zephyr = {
        weight = 1;
        preference.matchExpressions = {
          _namedlist = true;
          hostname = {
            key = "kubernetes.io/hostname";
            operator = "NotIn";
            values = [ "zephyr" ];
          };
        };
      };
    };
  };

  # Common dev toleration
  devTolerations = {
    _namedlist = true;
    mining = {
      key = "node.forge/mining";
      operator = "Exists";
      effect = "NoSchedule";
    };
  };

  # Common security context for dev containers
  devSecurityContext = {
    runAsNonRoot = true;
    allowPrivilegeEscalation = false;
    capabilities.drop = [ "ALL" ];
    seccompProfile.type = "RuntimeDefault";
  };

in {
  config.kubernetes.objects = {

    # ── Namespace ───────────────────────────────────────────────
    maplespike.Namespace.maplespike = {
      metadata.labels = {
        pod-security.kubernetes.io.enforce = "baseline";
        pod-security.kubernetes.io.enforce-version = "latest";
      };
    };

    # ── BYOK: User-Provided API Keys ───────────────────────────
    # Users provide their own keys (CanLII, AI, etc.) - no hardcoded secrets
    # Secret must exist before deployment:
    #   kubectl create secret generic quill-api-keys \
    #     --from-literal=MAPLESPIKE_CANLII_API_KEY=your_key_here \
    #     --from-literal=QUILL_AI_ENDPOINT=your_endpoint_here \
    #     --from-literal=MAPLESPIKE_AI_API_KEY=your_ai_key_here \
    #     --from-literal=QUILL_AI_MODEL=your_model_here \
    #     -n maplespike
    maplespike.Secret.quill-api-keys = {
      type = "Opaque";
      stringData = {
        # User must provide keys (can be empty string if not using feature)
        MAPLESPIKE_CANLII_API_KEY = "";
        QUILL_AI_ENDPOINT = "";
        MAPLESPIKE_AI_API_KEY = "";
        QUILL_AI_MODEL = "";
      };
    };

    # ── Portal ConfigMap ────────────────────────────────────────
    maplespike.ConfigMap.portal-config = {
      metadata.labels = {
        app = "quill-portal";
        component = "portal";
      };
  data = {
    "config.js" = ''
// MapleSpike Portal Configuration — Dev Environment
// Mounted at /usr/share/nginx/html/config.js
window.MAPLESPIKE = window.MAPLESPIKE || {};
MAPLESPIKE.apiBase = "https://dev-api.maplespike.lan";
MAPLESPIKE.apiKey = "";
MAPLESPIKE.timeout = { health: 3000, quick: 5000, default: 8000 };
'';
  };
    };

    # ── API Deployment ──────────────────────────────────────────
    maplespike.Deployment.quill-api = {
      metadata.labels = {
        app = "quill-api";
        component = "api";
        tier = "backend";
      };
      spec = {
        replicas = 1;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "quill-api";
        template = {
          metadata.labels = {
            app = "quill-api";
            component = "api";
            tier = "backend";
          };
          spec = {
            automountServiceAccountToken = false;
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              api = {
                name = "api";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/quill/quill-api:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 8082; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "8082"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "development"; };
                  STORAGE = { name = "QUILL_STORAGE"; value = "memory"; };
                  # BYOK: User-provided CanLII API Key (optional)
                  CANLII_API_KEY = {
                    name = "MAPLESPIKE_CANLII_API_KEY";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "MAPLESPIKE_CANLII_API_KEY";
                      optional = true;
                    };
                  };
                  # BYOK: User-provided AI config (optional, with fallbacks)
                  AI_ENDPOINT = {
                    name = "QUILL_AI_ENDPOINT";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "QUILL_AI_ENDPOINT";
                      optional = true;
                    };
                    default = "http://ai-inference-gateway.ai-inference:8080/v1";
                  };
                  AI_MODEL = {
                    name = "QUILL_AI_MODEL";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "QUILL_AI_MODEL";
                      optional = true;
                    };
                    default = "qwen3.5-27b";
                  };
                  AI_API_KEY = {
                    name = "MAPLESPIKE_AI_API_KEY";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "MAPLESPIKE_AI_API_KEY";
                      optional = true;
                    };
                    default = "maplespike-dev-key";
                  };
                  # Qdrant vector DB for semantic RAG
                  QDRANT_ENDPOINT = {
                    name = "QUILL_QDRANT_ENDPOINT";
                    value = "http://qdrant:6333";
                  };
                  QDRANT_COLLECTION = {
                    name = "QUILL_QDRANT_COLLECTION";
                    value = "maplespike";
                  };
                  EMBED_MODEL = {
                    name = "QUILL_EMBED_MODEL";
                    value = "nvidia/llama-3.2-nv-embedqa-1b-v2";
                  };
                };
                resources = {
                  requests = { cpu = "50m"; memory = "64Mi"; };
                  limits   = { cpu = "200m"; memory = "256Mi"; };
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
              };
            };
          };
        };
      };
    };

    # ── API Service ─────────────────────────────────────────────
    maplespike.Service.quill-api = {
      metadata.labels = {
        app = "quill-api";
        component = "api";
        tier = "backend";
      };
      spec = {
        type = "NodePort";
        selector.app = "quill-api";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 8082; targetPort = 8082; nodePort = 31284; };
        };
      };
    };

    # ── MCP Deployment ──────────────────────────────────────────
    maplespike.Deployment.quill-mcp = {
      metadata.labels = {
        app = "quill-mcp";
        component = "mcp";
        tier = "backend";
      };
      spec = {
        replicas = 1;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "quill-mcp";
        template = {
          metadata.labels = {
            app = "quill-mcp";
            component = "mcp";
            tier = "backend";
          };
          spec = {
            automountServiceAccountToken = false;
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              mcp = {
                name = "mcp";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/quill/quill-mcp:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 3001; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "3001"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "development"; };
                  API_URL = { name = "QUILL_API_URL"; value = "http://quill-api.maplespike-dev.svc.cluster.local:8082/v1"; };
                  # BYOK: User-provided AI config (optional, with fallbacks)
                  AI_ENDPOINT = {
                    name = "QUILL_AI_ENDPOINT";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "QUILL_AI_ENDPOINT";
                      optional = true;
                    };
                    default = "http://ai-inference-gateway.ai-inference:8080/v1";
                  };
                  AI_MODEL = {
                    name = "QUILL_AI_MODEL";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "QUILL_AI_MODEL";
                      optional = true;
                    };
                    default = "qwen3.5-27b";
                  };
                  AI_API_KEY = {
                    name = "MAPLESPIKE_AI_API_KEY";
                    valueFrom.secretKeyRef = {
                      name = "quill-api-keys";
                      key = "MAPLESPIKE_AI_API_KEY";
                      optional = true;
                    };
                    default = "maplespike-dev-key";
                  };
                };
                resources = {
                  requests = { cpu = "50m"; memory = "64Mi"; };
                  limits   = { cpu = "200m"; memory = "256Mi"; };
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
    maplespike.Service.quill-mcp = {
      metadata.labels = {
        app = "quill-mcp";
        component = "mcp";
        tier = "backend";
      };
      spec = {
        type = "NodePort";
        selector.app = "quill-mcp";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 3001; targetPort = 3001; nodePort = 31746; };
        };
      };
    };

    # ── Portal Deployment ───────────────────────────────────────
    maplespike.Deployment.quill-portal = {
      metadata.labels = {
        app = "quill-portal";
        component = "portal";
        tier = "frontend";
      };
      spec = {
        replicas = 1;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "quill-portal";
        template = {
          metadata.labels = {
            app = "quill-portal";
            component = "portal";
            tier = "frontend";
          };
          spec = {
            automountServiceAccountToken = false;
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              portal = {
                name = "portal";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/quill/quill-portal:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 8080; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "8080"; };
                  API_URL = { name = "API_URL"; value = "http://quill-api.maplespike-dev.svc.cluster.local:8082/v1"; };
                };
                volumeMounts = {
                  _namedlist = true;
                  config = {
                    name = "portal-config";
                    mountPath = "/usr/share/nginx/html/config.js";
                    subPath = "config.js";
                  };
                };
                resources = {
                  requests = { cpu = "25m"; memory = "32Mi"; };
                  limits   = { cpu = "100m"; memory = "64Mi"; };
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
    maplespike.Service.quill-portal = {
      metadata.labels = {
        app = "quill-portal";
        component = "portal";
        tier = "frontend";
      };
      spec = {
        type = "NodePort";
        selector.app = "quill-portal";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 8080; targetPort = 8080; nodePort = 30965; };
        };
      };
    };

    # ── Dashboard Deployment ────────────────────────────────────
    maplespike.Deployment.maplespike-dashboard = {
      metadata.labels = {
        app = "maplespike-dashboard";
        component = "dashboard";
        tier = "frontend";
      };
      spec = {
        replicas = 1;
        strategy = {
          type = "RollingUpdate";
          rollingUpdate = { maxUnavailable = 0; maxSurge = 1; };
        };
        selector.matchLabels.app = "maplespike-dashboard";
        template = {
          metadata.labels = {
            app = "maplespike-dashboard";
            component = "dashboard";
            tier = "frontend";
          };
          spec = {
            automountServiceAccountToken = false;
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              dashboard = {
                name = "dashboard";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/quill/maplespike-dashboard:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 4322; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "4322"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "development"; };
                  API_BASE = { name = "NEXT_PUBLIC_API_BASE"; value = "https://dev-api.maplespike.lan/v1"; };
                };
                resources = {
                  requests = { cpu = "50m"; memory = "128Mi"; };
                  limits   = { cpu = "200m"; memory = "256Mi"; };
                };
                livenessProbe = {
                  httpGet = { path = "/"; port = 4322; };
                  initialDelaySeconds = 15;
                  periodSeconds = 20;
                };
                readinessProbe = {
                  httpGet = { path = "/"; port = 4322; };
                  initialDelaySeconds = 5;
                  periodSeconds = 10;
                };
              };
            };
          };
        };
      };
    };

    # ── Dashboard Service ───────────────────────────────────────
    maplespike.Service.maplespike-dashboard = {
      metadata.labels = {
        app = "maplespike-dashboard";
        component = "dashboard";
        tier = "frontend";
      };
      spec = {
        type = "ClusterIP";
        selector.app = "maplespike-dashboard";
        ports = {
          _namedlist = true;
          http = { name = "http"; port = 4322; targetPort = 4322; };
        };
      };
    };

  };
}
