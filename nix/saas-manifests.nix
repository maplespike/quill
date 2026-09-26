# SaaS K8s manifests — generated from Nix (single source of truth).
#
# Produces the SAME shape as the hand-maintained k8s/base/*.yaml set:
#   - namespace (default `maplespike`)
#   - cloudflared Deployment + ConfigMap (traffic for *.maplespike.ca)  [prod only]
#   - quill-api / quill-mcp / quill-portal Deployments + Services
#   - LAN Traefik Ingress
#
# The image registry/tag, public domain, namespace, and environment are
# parameters so prod vs dev are just different call sites (see flake.nix
# packages.saas-manifests / dev-manifests).
#
# `dev = true` renders a LAN-only bundle into the given namespace:
#   - no cloudflared tunnel, no GlobalNetworkPolicy, no VAP (those are
#     cluster-scoped and owned by the prod bundle — the dev bundle is
#     namespace-scoped only)
#   - dynamic Service ClusterIPs (nothing dials dev by literal IP; the
#     pinned 10.43.100.x range is unique cluster-wide and prod-owned)
#   - dev.* ingress hosts routed to the dev services
#   - API secrets read from `secretsRef` (default quill-dev-secrets) with
#     pii-hash-secret optional, so a fresh dev namespace boots before any
#     secret exists (prod keeps it required — Decision 0002)
#
# Output: a derivation with `manifests.yaml` (all objects concatenated,
# `---` separated) ready for `kubectl apply -f`.
{ pkgs, registry, tag, apiTag ? tag, mcpTag ? tag, portalTag ? tag, domain
, namespace ? "maplespike"
, secretsRef ? (if dev then "quill-dev-secrets" else "maplespike-secrets")
, dev ? false
# qdrant runs in the ai-inference namespace. The reference manifest
# (k8s/maplespike/quill-api-deployment.yaml) pins the FQDN — the bare
# `http://qdrant:6333` was stale drift (would resolve to nothing in the
# maplespike namespace). Aligned 2026-08-11 while parameterizing for dev.
, qdrantEndpoint ? "http://qdrant-service.ai-inference.svc.cluster.local:6333"
}:
let
  # Image paths MUST match `flake.nix packages.push-all`'s tag scheme
  # (`${REGISTRY}/quill-${svc}:${TAG}`) AND `mkImage { name = "quill-${svc}" }` —
  # otherwise the registry hosts nexus:5000/quill-<svc>:*  while the
  # manifests request nexus:5000/<svc>:* (flip drifted; resolved 2026-07-11).
  #
  # TAG MUST BE IMMUTABLE (git SHA or date+sha, e.g. 2026-08-13-14aef96c).
  # Reusing a mutable tag (bare date, `latest`) with imagePullPolicy:
  # IfNotPresent makes containerd serve a STALE cached layer when the same tag
  # is rebuilt — the 2026-08-13 incident (pods crashed with
  # ERR_MODULE_NOT_FOUND because the cached image predated a symlink fix).
  # The `deploy.sh` script derives this tag automatically; pass the same value
  # here. Do NOT pass a reusable tag.
  #
  # Each service allows its own tag override (apiTag/mcpTag/portalTag) so
  # images can be pinned independently. The shared `tag` param is the default
  # for any service without a specific override. This avoids cluster admission
  # policies that deny `:latest` tags and lets per-service build revisions
  # coexist (e.g. api/mcp on -3, portal on base date tag).
  apiImage = "${registry}/quill-api:${apiTag}";
  mcpImage = "${registry}/quill-mcp:${mcpTag}";
  portalImage = "${registry}/quill-portal:${portalTag}";

  # Ingress hostnames for the LAN side (.lan). Prod owns the bare +
  # portal/api/mcp hosts; dev owns the dev.* variants (which the prod bundle
  # previously listed but misrouted to the portal — hasPrefix "api"/"mcp"
  # never matched "dev-api.…"/"dev-mcp.…", so all three hit the portal).
  lanHosts = if dev then [
    "dev.${domain}" "dev-api.${domain}" "dev-mcp.${domain}"
  ] else [
    "maplespike.ca" "portal.maplespike.ca" "api.maplespike.ca" "mcp.maplespike.ca"
  ];

  # Host → service routing. Strips the dev- prefix before matching, so
  # dev-api.maplespike.ca routes to quill-api (the prod ingress bug above).
  route = h:
    let base = pkgs.lib.removePrefix "dev-" h; in
    if pkgs.lib.hasPrefix "mcp" base then { svc = "quill-mcp"; port = 3001; }
    else if pkgs.lib.hasPrefix "api" base then { svc = "quill-api"; port = 8082; }
    else { svc = "quill-portal"; port = 8080; };

  # ClusterIP pins are prod-only: cloudflared dials literal IPs, and the
  # 10.43.100.10/11/12 range must stay unique cluster-wide. Dev services get
  # dynamic ClusterIPs (Traefik resolves Service DNS names).
  apiClusterIP = if dev then "" else "      clusterIP: 10.43.100.10  # pinned for cloudflared ClusterIP-literal ingress\n";
  mcpClusterIP = if dev then "" else "      clusterIP: 10.43.100.11  # pinned for cloudflared ClusterIP-literal ingress\n";
  portalClusterIP = if dev then "" else "      clusterIP: 10.43.100.12  # pinned for cloudflared ClusterIP-literal ingress\n";

  # ── YAML fragments (heredocs → store paths) ─────────────────────
  # PSA labels on these namespaces are REQUIRED for local-path provisioning:
  # the local-path-provisioner creates its helper pod (hostPath + root +
  # privilege escalation — impossible under `restricted`/`baseline`) in the
  # PVC's namespace for maplespike, and ALWAYS in kube-system regardless of
  # claim namespace. kube-system ships privileged by default in k3s; the
  # `restricted` label that appeared on it broke local-path provisioning
  # cluster-wide (2026-08-11: quill-api-data, nix-store, qdrant all Pending;
  # fixed live by relabeling). A rebuild must reproduce these labels or
  # storage breaks again.
  namespaceYaml = if dev then pkgs.writeText "00-namespace.yaml" ''
    apiVersion: v1
    kind: Namespace
    metadata:
      name: ${namespace}
      labels:
        pod-security.kubernetes.io/audit: privileged
        pod-security.kubernetes.io/audit-version: latest
        pod-security.kubernetes.io/enforce: privileged
        pod-security.kubernetes.io/enforce-version: latest
        pod-security.kubernetes.io/warn: privileged
        pod-security.kubernetes.io/warn-version: latest
  '' else pkgs.writeText "00-namespace.yaml" ''
    apiVersion: v1
    kind: Namespace
    metadata:
      name: ${namespace}
      labels:
        pod-security.kubernetes.io/audit: privileged
        pod-security.kubernetes.io/audit-version: latest
        pod-security.kubernetes.io/enforce: privileged
        pod-security.kubernetes.io/enforce-version: latest
        pod-security.kubernetes.io/warn: privileged
        pod-security.kubernetes.io/warn-version: latest
    ---
    apiVersion: v1
    kind: Namespace
    metadata:
      name: ai-inference
    ---
    # kube-system is where local-path helper pods ALWAYS run (verified in
    # provisioner logs 2026-08-11). Must stay privileged or storage breaks.
    apiVersion: v1
    kind: Namespace
    metadata:
      name: kube-system
      labels:
        pod-security.kubernetes.io/audit: privileged
        pod-security.kubernetes.io/audit-version: latest
        pod-security.kubernetes.io/enforce: privileged
        pod-security.kubernetes.io/enforce-version: latest
        pod-security.kubernetes.io/warn: privileged
        pod-security.kubernetes.io/warn-version: latest
  '';

  # Cluster-wide Calico GlobalNetworkPolicy (default-deny-enforced).
  # SINGLE SOURCE OF TRUTH: k8s/gnp-default-deny.yaml — read directly so the
  # nix pipeline and the committed file can never drift. Included in the prod
  # manifest bundle so every `nix build .#saas-manifests` + `kubectl apply`
  # ships the canonical default-deny posture (incl. TCP/UDP 7844 for the
  # cloudflared edge), so a cluster rebuild can never regress to the broken
  # 12-rule form that blocked the tunnel. Cluster-scoped CRD — applies
  # cleanly alongside the namespace resources below. Excluded from the dev
  # bundle (cluster-scoped; prod owns it).
  gnpDefaultDeny = pkgs.writeText "03-gnp-default-deny.yaml" (
    builtins.readFile ../k8s/gnp-default-deny.yaml
  );

  # Cluster-wide ValidatingAdmissionPolicy (resources + security) WITH the
  # local-path helper-pod matchConditions exclusion. SINGLE SOURCE OF TRUTH:
  # k8s/maplespike/vap-require-resources-and-security.yaml — read directly so
  # the nix pipeline and the committed file never drift. The exclusion is
  # REQUIRED for local-path provisioning (helper pods run as root + hostPath
  # in kube-system); without it every local-path PVC is Pending cluster-wide
  # (2026-08-11 incident). Included in the prod manifest bundle so a rebuild
  # reproduces it. Excluded from the dev bundle (cluster-scoped; prod owns it).
  vapResourcesSecurity = pkgs.writeText "08-vap-require-resources.yaml" (
    builtins.readFile ../k8s/maplespike/vap-require-resources-and-security.yaml
  );

  # ── Cloudflared (tunnel) — prod only ─────────────────────────────
  # MUST stay in lockstep with k8s/cloudflared/cloudflared.yaml — the live
  # cluster runs THAT manifest (namespace `cloudflared`), and the nix
  # pipeline exists so a rebuild ships the SAME object. Two cloudflareds
  # with the same tunnel ID (one in maplespike, one in cloudflared) would
  # fight for tunnel registration and take the public site down.
  #
  # Requirements (validated by the 2026-08-10 redeploy):
  #   - Namespace `cloudflared` MUST carry the label
  #     app.kubernetes.io/name: cloudflared — the API NetworkPolicy
  #     (k8s/maplespike/quill-networkpolicy.yaml) allows ingress ONLY from
  #     that namespaceSelector. Missing label = tunnel connects but every
  #     API host 502s.
  #   - protocol: http2 — QUIC (UDP 7844) is dropped by the LAN firewall;
  #     the modern edge also serves HTTP/2 on 7844/TCP, and the GNP allows
  #     TCP+UDP 7844 egress.
  #   - Upstreams are literal PINNED ClusterIPs (NOT DNS names):
  #     cloudflared's Go resolver on the minimal image dials 1.1.1.1 for
  #     *.svc.cluster.local and gets NXDOMAIN -> edge 502s. The IPs must
  #     match the Service clusterIP pins in k8s/maplespike/*-service.yaml.
  cloudflared = pkgs.writeText "05-cloudflared.yaml" ''
    apiVersion: v1
    kind: Namespace
    metadata:
      name: cloudflared
      labels:
        app.kubernetes.io/name: cloudflared
    ---
    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: cloudflared-config
      namespace: cloudflared
      labels:
        app: cloudflared
        component: tunnel
    data:
      config.yaml: |
        tunnel: 66d76492-036b-4177-8fac-8682e0eda37e
        credentials-file: /etc/cloudflared/credentials.json
        # QUIC (UDP 7844) dropped by LAN firewall; force HTTP/2 over 443.
        # Upstreams use pinned literal ClusterIPs (see file header).
        protocol: http2
        metrics: 0.0.0.0:2000
        ingress:
          - hostname: quill.${domain}
            service: http://10.43.100.12:8080
          - hostname: api.${domain}
            service: http://10.43.100.10:8082
          - hostname: mcp.${domain}
            service: http://10.43.100.11:3001
          - service: http_status:404
    ---
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: cloudflared
      namespace: cloudflared
      labels:
        app: cloudflared
        component: tunnel
    spec:
      replicas: 2
      selector:
        matchLabels:
          app: cloudflared
      template:
        metadata:
          labels:
            app: cloudflared
        spec:
          nodeSelector:
            kubernetes.io/hostname: nexus
          containers:
          - name: cloudflared
            image: cloudflare/cloudflared:2025.4.0
            imagePullPolicy: IfNotPresent
            args:
            - tunnel
            - --no-autoupdate
            - --config
            - /etc/cloudflared/config.yaml
            - --metrics
            - 0.0.0.0:2000
            - run
            readinessProbe:
              httpGet:
                path: /ready
                port: 2000
              initialDelaySeconds: 15
              periodSeconds: 15
              timeoutSeconds: 5
            resources:
              limits:
                cpu: 100m
                memory: 64Mi
              requests:
                cpu: 25m
                memory: 32Mi
            securityContext:
              runAsNonRoot: true
              runAsUser: 1001
              runAsGroup: 1001
              allowPrivilegeEscalation: false
            volumeMounts:
            - name: creds
              mountPath: /etc/cloudflared/credentials.json
              subPath: credentials.json
              readOnly: true
            - name: config
              mountPath: /etc/cloudflared/config.yaml
              subPath: config.yaml
              readOnly: true
          volumes:
          - name: creds
            secret:
              secretName: cloudflared-creds
          - name: config
            configMap:
              name: cloudflared-config
  '';

  # Persistent volume for the Quill API claims store + sqlite DB.
  # Single-node k3s uses the local-path StorageClass (hostPath-backed).
  # MUST stay in lockstep with k8s/maplespike/quill-api-data-pvc.yaml.
  # NOT emptyDir: /data holds citation_records + api_keys + tenants, so a
  # pod rollout or node reboot must not wipe it (2026-08-11 incident — claims
  # and registrations silently vanished on every rollout).
  apiDataPvc = pkgs.writeText "09-api-data-pvc.yaml" ''
    apiVersion: v1
    kind: PersistentVolumeClaim
    metadata:
      name: quill-api-data
      namespace: ${namespace}
      labels:
        app: quill-api
    spec:
      accessModes:
        - ReadWriteOnce
      resources:
        requests:
          storage: 10Gi
  '';

  apiDeploy = pkgs.writeText "10-api-deploy.yaml" ''
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: quill-api
      namespace: ${namespace}
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
          # nexus-only while forge/sentry are unhealthy (no Calico dataplane
          # on forge + LAN firewall drops 5000/5473): pods on forge have no
          # network and cannot pull images. Remove when the cluster is fully
          # healthy. The RWO quill-api-data PVC is local-path on nexus anyway.
          nodeSelector:
            kubernetes.io/hostname: nexus
          containers:
          - name: api
            image: ${apiImage}
            # IfNotPresent: images are pinned tags loaded into the local
            # containerd store; the nexus:5000 registry is a bare podman
            # container that does NOT survive node reboots, and with Always
            # every restart round-tripped the (dead) registry -> ImagePullBackOff
            # took the whole site down (2026-08-11 reboot). IfNotPresent is the
            # sovereign/local-first posture. Do NOT revert to Always.
            imagePullPolicy: IfNotPresent
            ports:
            - containerPort: 8082
            env:
            # NOTE: JWT_SECRET is optional. In the homelab deploy it is set
            # directly on the Deployment (see k8s/maplespike/quill-api-deployment.yaml);
            # for BYOK self-hosters it can be injected via a secret. We keep
            # a safe dev default so the manifest applies without a secret.
            # The value lives in `quill-secrets/jwtSecret` — the pair the Helm
            # chart renders in production and scripts/sops-sync-k8s.sh writes.
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: quill-secrets
                  key: jwtSecret
                  optional: true
            # Decision 0002: registration/Auth REQUIRES a stable 64-char hex
            # QUILL_PII_HASH_SECRET in production — the api-server refuses to
            # start the register flow without it. MUST stay in lockstep with
            # k8s/maplespike/quill-api-deployment.yaml. The value lives in
            # `maplespike-secrets/pii-hash-secret` (synced by
            # scripts/sops-sync-k8s.sh from secrets/runtime.yaml). In dev the
            # ref is optional so the namespace boots before the dev secret is
            # created (the deploy-dev app bootstraps it with a random value).
            - name: QUILL_PII_HASH_SECRET
              valueFrom:
                secretKeyRef:
                  name: ${secretsRef}
                  key: pii-hash-secret
                  optional: ${if dev then "true" else "false"}
            # Stripe monetization — secret + webhook signing keys, read from
            # `maplespike-secrets` (synced by scripts/sops-sync-k8s.sh from
            # secrets/runtime.yaml). MUST stay in lockstep with the Helm chart
            # (charts/quill/templates/deployments.yaml) — ArgoCD renders the
            # chart in production, and this bundle is the Nix-era path.
            # RESTRICTED to api-server only (mcp + portal do not need keys).
            # STRIPE_ACCOUNT_ID / STRIPE_PUBLISHABLE_KEY are deliberately NOT
            # injected here: no K8s Secret carries those keys (verified on the
            # live cluster 2026-09-22), api-server reads the account id as
            # optional, and the publishable key is a *portal build* variable
            # (PUBLIC_STRIPE_PUBLISHABLE_KEY, see .github/workflows/ci.yml).
            - name: STRIPE_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: maplespike-secrets
                  key: stripe-secret-key
                  optional: true
            - name: STRIPE_WEBHOOK_SECRET
              valueFrom:
                secretKeyRef:
                  name: maplespike-secrets
                  key: stripe-webhook-secret
                  optional: true
            # Billing admin secret — gates the /v1/billing/* admin endpoints
            # (reconcile-expiry etc.). MUST stay in lockstep with
            # k8s/maplespike/quill-api-deployment.yaml: read from
            # `maplespike-secrets/quill-billing-secret` (synced by
            # scripts/sops-sync-k8s.sh from secrets/runtime.yaml). Optional
            # so dev boots without it.
            - name: QUILL_BILLING_SECRET
              valueFrom:
                secretKeyRef:
                  name: ${secretsRef}
                  key: quill-billing-secret
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
              value: "${qdrantEndpoint}"
            - name: QUILL_QDRANT_COLLECTION
              value: "maplespike"
            - name: QUILL_EMBED_MODEL
              value: "nvidia/llama-3.2-nv-embedqa-1b-v2"
            # Probe timeouts are 5s (not the 1s k8s default) — the 1s default
            # kills healthy pods during CPU-throttled cold start (2026-08-11
            # incident). Do NOT "clean up" these to defaults.
            livenessProbe:
              httpGet:
                path: /v1/health
                port: 8082
              initialDelaySeconds: 10
              periodSeconds: 20
              timeoutSeconds: 5
            readinessProbe:
              httpGet:
                path: /v1/health
                port: 8082
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
            securityContext:
              allowPrivilegeEscalation: false
              runAsGroup: 1001
              runAsNonRoot: true
              runAsUser: 1001
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
          securityContext:
            fsGroup: 1001
          volumes:
          - name: data
            persistentVolumeClaim:
              claimName: quill-api-data
  '';

  # Service for quill-api. Kept as its own fragment: the clusterIP
  # interpolation line starts at column 0, which forces nix indented-string
  # stripping to 0 for the whole fragment — a col-0 `---` inside it would
  # render indented and break kubectl's multi-doc parse (2026-08-15 fix;
  # the separators come from the concat loop below instead).
  apiService = pkgs.writeText "10-api-service.yaml" ''
    apiVersion: v1
    kind: Service
    metadata:
      name: quill-api
      namespace: ${namespace}
    spec:
${apiClusterIP}      selector:
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
      namespace: ${namespace}
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
          # nexus-only while forge/sentry are unhealthy — see quill-api.
          nodeSelector:
            kubernetes.io/hostname: nexus
          containers:
          - name: mcp
            image: ${mcpImage}
            # IfNotPresent — see apiDeploy comment (2026-08-11 reboot incident).
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
            # QUILL_API_KEY gates the MCP gateway. Without it the server
            # falls back to the well-known default 'dev-key' (2026-08-15
            # auth audit). Value lives in quill-secrets/apiKey — the pair the
            # Helm chart renders and scripts/sops-sync-k8s.sh writes.
            - name: QUILL_API_KEY
              valueFrom:
                secretKeyRef:
                  name: quill-secrets
                  key: apiKey
            # Probe timeouts are 5s (not the 1s k8s default) — the 1s default
            # kills healthy pods during CPU-throttled cold start (2026-08-11
            # incident). Do NOT "clean up" these to defaults.
            livenessProbe:
              httpGet:
                path: /health
                port: 3001
              initialDelaySeconds: 15
              periodSeconds: 20
              timeoutSeconds: 5
            readinessProbe:
              httpGet:
                path: /health
                port: 3001
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
            securityContext:
              allowPrivilegeEscalation: false
              runAsGroup: 1001
              runAsNonRoot: true
              runAsUser: 1001
            resources:
              limits:
                cpu: 200m
                memory: 256Mi
              requests:
                cpu: 50m
                memory: 64Mi
  '';

  mcpService = pkgs.writeText "11-mcp-service.yaml" ''
    apiVersion: v1
    kind: Service
    metadata:
      name: quill-mcp
      namespace: ${namespace}
    spec:
${mcpClusterIP}      selector:
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
      namespace: ${namespace}
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
          # nexus-only while forge/sentry are unhealthy — see quill-api.
          nodeSelector:
            kubernetes.io/hostname: nexus
          containers:
          - name: portal
            image: ${portalImage}
            # IfNotPresent — see apiDeploy comment (2026-08-11 reboot incident).
            imagePullPolicy: IfNotPresent
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
            # Probe timeouts are 5s (not the 1s k8s default) — the 1s default
            # kills healthy pods during CPU-throttled cold start (2026-08-11
            # incident). Do NOT "clean up" these to defaults.
            livenessProbe:
              httpGet:
                path: /
                port: http
              initialDelaySeconds: 20
              periodSeconds: 30
              timeoutSeconds: 5
            readinessProbe:
              httpGet:
                path: /
                port: http
              initialDelaySeconds: 8
              periodSeconds: 10
              timeoutSeconds: 5
            securityContext:
              allowPrivilegeEscalation: false
              runAsGroup: 1001
              runAsNonRoot: true
              runAsUser: 1001
            resources:
              limits:
                cpu: 200m
                memory: 128Mi
              requests:
                cpu: 50m
                memory: 32Mi
  '';

  portalService = pkgs.writeText "17-portal-service.yaml" ''
    apiVersion: v1
    kind: Service
    metadata:
      name: quill-portal
      namespace: ${namespace}
    spec:
      type: ClusterIP
${portalClusterIP}      selector:
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
      name: ${if dev then "quill-dev" else "maplespike.ca"}
      namespace: ${namespace}
      annotations:
        cert-manager.io/cluster-issuer: stepca-lan
        traefik.ingress.kubernetes.io/router.entrypoints: websecure
        traefik.ingress.kubernetes.io/router.tls: "true"
    spec:
      ingressClassName: traefik
      tls:
      - hosts:
        ${pkgs.lib.concatMapStringsSep "\n    " (h: "  - ${h}") lanHosts}
        secretName: ${if dev then "quill-dev-tls" else "maplespike.ca-tls"}
      rules:
      ${pkgs.lib.concatMapStringsSep "\n  " (h: ''
        - host: ${h}
            http:
              paths:
              - path: /
                pathType: Prefix
                backend:
                  service:
                    name: ${(route h).svc}
                    port:
                      number: ${toString (route h).port}
      '') lanHosts}
  '';

  # Prod owns the cluster-scoped resources (GNP, VAP, cloudflared, the
  # ai-inference/kube-system namespace labels). The dev bundle is
  # namespace-scoped only — it must never re-apply cluster-scoped objects.
  fragments = [ namespaceYaml ] ++ (pkgs.lib.optionals (!dev) [
    gnpDefaultDeny vapResourcesSecurity cloudflared
  ]) ++ [ apiDataPvc apiDeploy apiService mcpDeploy mcpService portalDeploy portalService lanIngress ];

  # Concatenate all fragments into a single manifests.yaml
  manifest = pkgs.runCommand "saas-manifests.yaml" { } ''
    mkdir -p $out
    : > $out/manifests.yaml
    for f in ${pkgs.lib.concatStringsSep " " fragments}; do
      echo "---" >> $out/manifests.yaml
      cat "$f" >> $out/manifests.yaml
    done
    echo "wrote $out/manifests.yaml"
  '';
in
manifest
