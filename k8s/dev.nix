# MapleSpike Dev environment — Nix-generated K8s manifests
# Namespace: maplespike-dev
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
    maplespike-dev.Namespace.maplespike-dev = {
      metadata.labels = {
        pod-security.kubernetes.io.enforce = "baseline";
        pod-security.kubernetes.io.enforce-version = "latest";
      };
    };

    # ── Portal ConfigMap ────────────────────────────────────────
    maplespike-dev.ConfigMap.portal-config = {
      metadata.labels = {
        app = "maplespike-portal";
        component = "portal";
      };
  data = {
    "config.js" = ''
// MapleSpike Portal Configuration — Dev Environment
// Mounted at /usr/share/nginx/html/config.js
window.MAPLESPIKE = window.MAPLESPIKE || {};
MAPLESPIKE.apiBase = "https://dev-maplespike-api.lan";
MAPLESPIKE.apiKey = "";
MAPLESPIKE.timeout = { health: 3000, quick: 5000, default: 8000 };
'';
  };
    };

    # ── API Deployment ──────────────────────────────────────────
    maplespike-dev.Deployment.maplespike-api = {
      metadata.labels = {
        app = "maplespike-api";
        component = "api";
        tier = "backend";
      };
      spec = {
        replicas = 1;
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
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              api = {
                name = "api";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/maplespike/maplespike-api:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 8082; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "8082"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "development"; };
                  STORAGE = { name = "MAPLESPIKE_STORAGE"; value = "memory"; };
                  API_KEY = { name = "MAPLESPIKE_API_KEY"; value = "maplespike-dev-key"; };
                  AI_ENDPOINT = { name = "MAPLESPIKE_AI_ENDPOINT"; value = "http://ai-inference-gateway.ai-inference:8080/v1"; };
                  AI_MODEL = { name = "MAPLESPIKE_AI_MODEL"; value = "qwen3.5-27b"; };
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
    maplespike-dev.Service.maplespike-api = {
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
          http = { name = "http"; port = 8082; targetPort = 8082; nodePort = 31284; };
        };
      };
    };

    # ── MCP Deployment ──────────────────────────────────────────
    maplespike-dev.Deployment.maplespike-mcp = {
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
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              mcp = {
                name = "mcp";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/maplespike/maplespike-mcp:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 3001; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "3001"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "development"; };
                  API_URL = { name = "MAPLESPIKE_API_URL"; value = "http://maplespike-api.maplespike-dev.svc.cluster.local:8082/v1"; };
                  API_KEY = { name = "MAPLESPIKE_API_KEY"; value = "maplespike-dev-key"; };
                  AI_ENDPOINT = { name = "AI_ENDPOINT"; value = "http://ai-inference-gateway.ai-inference:8080/v1"; };
                  AI_MODEL = { name = "AI_MODEL"; value = "qwen3.5-27b"; };
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
    maplespike-dev.Service.maplespike-mcp = {
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
          http = { name = "http"; port = 3001; targetPort = 3001; nodePort = 31746; };
        };
      };
    };

    # ── Portal Deployment ───────────────────────────────────────
    maplespike-dev.Deployment.maplespike-portal = {
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
            affinity = devAffinity;
            tolerations = devTolerations;
            containers = {
              _namedlist = true;
              portal = {
                name = "portal";
                securityContext = devSecurityContext;
                image = "ghcr.io/reverb256/maplespike/maplespike-portal:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 8080; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "8080"; };
                  API_URL = { name = "API_URL"; value = "http://maplespike-api.maplespike-dev.svc.cluster.local:8082/v1"; };
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
    maplespike-dev.Service.maplespike-portal = {
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
          http = { name = "http"; port = 8080; targetPort = 8080; nodePort = 30965; };
        };
      };
    };

    # ── Dashboard Deployment ────────────────────────────────────
    maplespike-dev.Deployment.maplespike-dashboard = {
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
                image = "ghcr.io/reverb256/maplespike/maplespike-dashboard:dev";
                imagePullPolicy = "Always";
                ports = { _namedlist = true; http = { containerPort = 4322; }; };
                env = {
                  _namedlist = true;
                  PORT = { name = "PORT"; value = "4322"; };
                  NODE_ENV = { name = "NODE_ENV"; value = "development"; };
                  API_BASE = { name = "NEXT_PUBLIC_API_BASE"; value = "https://dev-maplespike-api.lan/v1"; };
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
    maplespike-dev.Service.maplespike-dashboard = {
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
