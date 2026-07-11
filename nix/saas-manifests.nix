# SaaS K8s manifests — generated from Nix (single source of truth).
#
# Produces the SAME shape as the hand-maintained k8s/base/*.yaml set:
#   - namespace `maplespike`
#   - cloudflared Deployment + ConfigMap (traffic for *.maplespike.ca)
#   - quill-api / quill-mcp / quill-portal Deployments + Services
#   - LAN Traefik Ingress (15-ingress-lan.yaml)
#
# The image registry/tag and public domain are parameters so dev vs prod
# are just different call sites (see flake.nix packages.saas-manifests).
#
# Output: a derivation with `manifests.yaml` (all objects concatenated,
# `---` separated) ready for `kubectl apply -f`.
{ pkgs, registry, tag, domain }:
let
  apiImage = "${registry}/api:${tag}";
  mcpImage = "${registry}/mcp:${tag}";
  portalImage = "${registry}/portal:${tag}";

  # Ingress hostnames for the LAN side (.lan) and external side (.ca)
  lanHosts = [
    "maplespike.lan" "portal.maplespike.lan" "dev.maplespike.lan"
    "api.maplespike.lan" "dev-api.maplespike.lan"
    "mcp.maplespike.lan" "dev-mcp.maplespike.lan"
  ];
  caHosts = [ "quill.${domain}" "api.${domain}" "mcp.${domain}" ];

  # ── YAML fragments (heredocs → store paths) ─────────────────────
  namespace = pkgs.writeText "00-namespace.yaml" ''
    apiVersion: v1
    kind: Namespace
    metadata:
      name: maplespike
    ---
    apiVersion: v1
    kind: Namespace
    metadata:
      name: ai-inference
  '';

  cloudflared = pkgs.writeText "05-cloudflared.yaml" ''
    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: cloudflared-config
      namespace: maplespike
    data:
      config.yaml: |
        tunnel: 66d76492-036b-4177-8fac-8682e0eda37e
        credentials-file: /etc/cloudflared/credentials.json
        ingress:
          - hostname: api.${domain}
            service: http://quill-api.maplespike.svc.cluster.local:8082
          - hostname: quill.${domain}
            service: http://quill-portal.maplespike.svc.cluster.local:8080
          - hostname: mcp.${domain}
            service: http://quill-mcp.maplespike.svc.cluster.local:3001
          - hostname: datafabric.${domain}
            service: http://quill-portal.maplespike.svc.cluster.local:8080
          - hostname: data.${domain}
            service: http://quill-portal.maplespike.svc.cluster.local:8080
          - service: http_status:404
    ---
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: cloudflared
      namespace: maplespike
      labels:
        app: cloudflared
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: cloudflared
      template:
        metadata:
          labels:
            app: cloudflared
        spec:
          containers:
          - name: cloudflared
            image: cloudflare/cloudflared:2026.7.0
            args:
            - tunnel
            - --no-autoupdate
            - --metrics
            - 0.0.0.0:2000
            - --config
            - /etc/cloudflared/config.yaml
            - run
            livenessProbe:
              httpGet:
                path: /ready
                port: 2000
              initialDelaySeconds: 15
              periodSeconds: 30
            resources:
              limits:
                cpu: 100m
                memory: 128Mi
              requests:
                cpu: 25m
                memory: 64Mi
            volumeMounts:
            - name: creds
              mountPath: /etc/cloudflared/credentials.json
              subPath: credentials.json
            - name: config
              mountPath: /etc/cloudflared/config.yaml
              subPath: config.yaml
          volumes:
          - name: creds
            secret:
              secretName: cloudflared-creds
          - name: config
            configMap:
              name: cloudflared-config
  '';

  apiDeploy = pkgs.writeText "10-api-deploy.yaml" ''
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: quill-api
      namespace: maplespike
      labels:
        app: quill-api
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: quill-api
      template:
        metadata:
          labels:
            app: quill-api
        spec:
          containers:
          - name: api
            image: ${apiImage}
            imagePullPolicy: IfNotPresent
            ports:
            - containerPort: 8082
            env:
            # NOTE: JWT_SECRET is optional. In the homelab deploy it is set
            # directly on the Deployment (see k8s/base/10-api-deploy.yaml);
            # for BYOK self-hosters it can be injected via a secret. We keep
            # a safe dev default so the manifest applies without a secret.
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: quill-runtime-secrets
                  key: jwt-secret
                  optional: true
            - name: PORT
              value: "8082"
            - name: NODE_ENV
              value: "production"
            - name: QUILL_STORAGE
              value: "sqlite"
            - name: QUILL_DB_PATH
              value: "/data/maplespike.db"
            - name: QUILL_QDRANT_ENDPOINT
              value: "http://qdrant:6333"
            - name: QUILL_QDRANT_COLLECTION
              value: "maplespike"
            - name: QUILL_EMBED_MODEL
              value: "nvidia/llama-3.2-nv-embedqa-1b-v2"
            livenessProbe:
              httpGet:
                path: /v1/health
                port: 8082
              initialDelaySeconds: 10
              periodSeconds: 20
            readinessProbe:
              httpGet:
                path: /v1/health
                port: 8082
              initialDelaySeconds: 5
              periodSeconds: 10
            resources:
              limits:
                cpu: 200m
                memory: 256Mi
              requests:
                cpu: 50m
                memory: 64Mi
            volumeMounts:
            - name: data
              mountPath: /data
          volumes:
          - name: data
            emptyDir: {}
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: quill-api
      namespace: maplespike
    spec:
      selector:
        app: quill-api
      ports:
      - port: 8082
        targetPort: 8082
      type: ClusterIP
  '';

  mcpDeploy = pkgs.writeText "11-mcp-deploy.yaml" ''
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: quill-mcp
      namespace: maplespike
      labels:
        app: quill-mcp
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: quill-mcp
      template:
        metadata:
          labels:
            app: quill-mcp
        spec:
          containers:
          - name: mcp
            image: ${mcpImage}
            imagePullPolicy: IfNotPresent
            ports:
            - containerPort: 3001
            env:
            - name: PORT
              value: "3001"
            - name: NODE_ENV
              value: "production"
            - name: QUILL_API_URL
              value: "http://quill-api:8082/v1"
            livenessProbe:
              httpGet:
                path: /health
                port: 3001
              initialDelaySeconds: 15
              periodSeconds: 20
            readinessProbe:
              httpGet:
                path: /health
                port: 3001
              initialDelaySeconds: 5
              periodSeconds: 10
            resources:
              limits:
                cpu: 200m
                memory: 256Mi
              requests:
                cpu: 50m
                memory: 64Mi
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: quill-mcp
      namespace: maplespike
    spec:
      selector:
        app: quill-mcp
      ports:
      - port: 3001
        targetPort: 3001
      type: ClusterIP
  '';

  portalDeploy = pkgs.writeText "17-portal-service.yaml" ''
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: quill-portal
      namespace: maplespike
      labels:
        app: quill-portal
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: quill-portal
      template:
        metadata:
          labels:
            app: quill-portal
        spec:
          containers:
          - name: portal
            image: ${portalImage}
            imagePullPolicy: IfNotPresent
            ports:
            - name: http
              containerPort: 8080
            env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "8080"
            livenessProbe:
              httpGet:
                path: /
                port: http
              initialDelaySeconds: 15
              periodSeconds: 30
            readinessProbe:
              httpGet:
                path: /
                port: http
              initialDelaySeconds: 5
              periodSeconds: 10
            resources:
              limits:
                cpu: 200m
                memory: 128Mi
              requests:
                cpu: 50m
                memory: 32Mi
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: quill-portal
      namespace: maplespike
    spec:
      type: ClusterIP
      selector:
        app: quill-portal
      ports:
      - name: http
        port: 8080
        targetPort: http
  '';

  lanIngress = pkgs.writeText "15-ingress-lan.yaml" ''
    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: maplespike-lan
      namespace: maplespike
      annotations:
        cert-manager.io/cluster-issuer: stepca-lan
        traefik.ingress.kubernetes.io/router.entrypoints: websecure
        traefik.ingress.kubernetes.io/router.tls: "true"
    spec:
      ingressClassName: traefik
      tls:
      - hosts:
        ${pkgs.lib.concatMapStringsSep "\n" (h: "        - ${h}") lanHosts}
        secretName: maplespike-lan-tls
      rules:
      ${pkgs.lib.concatMapStringsSep "\n" (h: ''
        - host: ${h}
          http:
            paths:
            - path: /
              pathType: Prefix
              backend:
                service:
                  name: ${if (pkgs.lib.hasPrefix "mcp" h) then "quill-mcp" else if (pkgs.lib.hasPrefix "api" h) then "quill-api" else "quill-portal"}
                  port:
                    number: ${toString (if (pkgs.lib.hasPrefix "mcp" h) then 3001 else if (pkgs.lib.hasPrefix "api" h) then 8082 else 8080)}
      '') lanHosts}
  '';

  # Concatenate all fragments into a single manifests.yaml
  manifest = pkgs.runCommand "saas-manifests.yaml" { } ''
    mkdir -p $out
    : > $out/manifests.yaml
    for f in ${namespace} ${cloudflared} ${apiDeploy} ${mcpDeploy} ${portalDeploy} ${lanIngress}; do
      echo "---" >> $out/manifests.yaml
      cat "$f" >> $out/manifests.yaml
    done
    echo "wrote $out/manifests.yaml"
  '';
in
manifest
