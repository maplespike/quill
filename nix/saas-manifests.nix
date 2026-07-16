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
  # Image paths MUST match `flake.nix packages.push-all`'s tag scheme
  # (`${REGISTRY}/quill-${svc}:${TAG}`) AND `mkImage { name = "quill-${svc}" }` —
  # otherwise the registry hosts nexus:5000/quill-<svc>:*  while the
  # manifests request nexus:5000/<svc>:* (flip drifted; resolved 2026-07-11).
  apiImage = "${registry}/quill-api:${tag}";
  mcpImage = "${registry}/quill-mcp:${tag}";
  portalImage = "${registry}/quill-portal:${tag}";

  # Ingress hostnames for the LAN side (.lan) and external side (.ca)
  lanHosts = [
    "maplespike.ca" "portal.maplespike.ca" "dev.maplespike.ca"
    "api.maplespike.ca" "dev-api.maplespike.ca"
    "mcp.maplespike.ca" "dev-mcp.maplespike.ca"
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
          # service URLs use literal ClusterIPs (DNS bypass for upstream).
          # cloudflared's Go resolver on the minimal Alpine image dials
          # 1.1.1.1 for *.svc.cluster.local lookups (does not honor the
          # /etc/resolv.conf nameserver order from the kubelet admission
          # controller), getting NXDOMAIN. Static IPs in this block avoid
          # that failure mode. ClusterIPs are pinned in the matching
          # Service specs below so they survive service restarts.
          # Recovery 2026-07-12 from 530/1033 + 502 in-cluster DNS failure.
          - hostname: api.${domain}
            service: http://10.43.100.10:8082
          - hostname: quill.${domain}
            service: http://10.43.100.12:8080
          - hostname: mcp.${domain}
            service: http://10.43.100.11:3001
          - hostname: datafabric.${domain}
            service: http://10.43.100.12:8080
          - hostname: data.${domain}
            service: http://10.43.100.12:8080
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
          # dnsPolicy intentionally defaults to ClusterFirst so CoreDNS
          # resolves in-cluster upstreams (*.svc.cluster.local -> A record).
          # The api.cloudflare.com A-record-stripping bug in Tailscale
          # MagicDNS upstream is sidestepped entirely by --edge-ip-version 4
          # below — Go uses a compiled-in list of Cloudflare IPv4 edge IPs
          # for tunnel-edge dialing, not DNS, so the bogus AAAA-only
          # response from the local upstream resolver is irrelevant here.
          # Verified TCP 7844 / UDP 7844 reachable to 198.41.0.0/16 from nexus.
          containers:
          - name: cloudflared
            image: cloudflare/cloudflared:2026.7.1
            # --edge-ip-version 4 forces IPv4-only tunnel-edge dialing.
            # Without it, Go's resolver prefers IPv6 when AAAA is returned,
            # but the pod network (cluster-cidr 10.42.0.0/16) is IPv4-only
            # so IPv6 dials get blackholed. TCP/UDP 7844 to 198.41.0.0/16
            # verified reachable from nexus. Surviving cluster restart:
            # 2026-07-12 recovery from 530/1033.
            args:
            - tunnel
            - --no-autoupdate
            - --edge-ip-version
            - "4"
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
                cpu: 500m
                memory: 256Mi
              requests:
                cpu: 100m
                memory: 128Mi
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
            imagePullPolicy: Always
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
            # Stripe monetization — secret + webhook signing keys. All read
            # from the `maplespike-stripe-secrets` K8s Secret, itself populated
            # by scripts/sops-sync-k8s.sh from quill/secrets/runtime.yaml.
            # RESTRICTED to api-server only (mcp + portal do not need keys).
            - name: STRIPE_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: maplespike-stripe-secrets
                  key: stripe-secret-key
                  optional: true
            - name: STRIPE_WEBHOOK_SECRET
              valueFrom:
                secretKeyRef:
                  name: maplespike-stripe-secrets
                  key: stripe-webhook-secret
                  optional: true
            - name: STRIPE_ACCOUNT_ID
              valueFrom:
                secretKeyRef:
                  name: maplespike-stripe-secrets
                  key: stripe-account-id
                  optional: true
            - name: STRIPE_PUBLISHABLE_KEY
              valueFrom:
                secretKeyRef:
                  name: maplespike-stripe-secrets
                  key: stripe-publishable-key
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
      clusterIP: 10.43.100.10  # pinned for cloudflared ClusterIP-literal ingress
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
            imagePullPolicy: Always
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
      clusterIP: 10.43.100.11  # pinned for cloudflared ClusterIP-literal ingress
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
            imagePullPolicy: Always
            ports:
            - name: http
              containerPort: 8080
            env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "8080"
            - name: API_UPSTREAM
              value: "http://quill-api:8082"
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
      clusterIP: 10.43.100.12  # pinned for cloudflared ClusterIP-literal ingress
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
      name: maplespike.ca
      namespace: maplespike
      annotations:
        cert-manager.io/cluster-issuer: stepca-lan
        traefik.ingress.kubernetes.io/router.entrypoints: websecure
        traefik.ingress.kubernetes.io/router.tls: "true"
    spec:
      ingressClassName: traefik
      tls:
      - hosts:
        ${pkgs.lib.concatMapStringsSep "\n    " (h: "  - ${h}") lanHosts}
        secretName: maplespike.ca-tls
      rules:
      ${pkgs.lib.concatMapStringsSep "\n  " (h: ''
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
