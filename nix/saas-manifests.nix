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
{ pkgs, registry, tag, apiTag ? tag, mcpTag ? tag, portalTag ? tag, domain }:
let
  # Image paths MUST match `flake.nix packages.push-all`'s tag scheme
  # (`${REGISTRY}/quill-${svc}:${TAG}`) AND `mkImage { name = "quill-${svc}" }` —
  # otherwise the registry hosts nexus:5000/quill-<svc>:*  while the
  # manifests request nexus:5000/<svc>:* (flip drifted; resolved 2026-07-11).
  #
  # Each service allows its own tag override (apiTag/mcpTag/portalTag) so
  # images can be pinned independently. The shared `tag` param is the default
  # for any service without a specific override. This avoids cluster admission
  # policies that deny `:latest` tags and lets per-service build revisions
  # coexist (e.g. api/mcp on -3, portal on base date tag).
  apiImage = "${registry}/quill-api:${apiTag}";
  mcpImage = "${registry}/quill-mcp:${mcpTag}";
  portalImage = "${registry}/quill-portal:${portalTag}";

  # Ingress hostnames for the LAN side (.lan) and external side (.ca)
  lanHosts = [
    "maplespike.ca" "portal.maplespike.ca" "dev.maplespike.ca"
    "api.maplespike.ca" "dev-api.maplespike.ca"
    "mcp.maplespike.ca" "dev-mcp.maplespike.ca"
  ];
  caHosts = [ "quill.${domain}" "api.${domain}" "mcp.${domain}" ];

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
  namespace = pkgs.writeText "00-namespace.yaml" ''
    apiVersion: v1
    kind: Namespace
    metadata:
      name: maplespike
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
  # nix pipeline and the committed file can never drift. Included in the
  # manifest bundle so every `nix build .#saas-manifests` + `kubectl apply`
  # ships the canonical default-deny posture (incl. TCP/UDP 7844 for the
  # cloudflared edge), so a cluster rebuild can never regress to the broken
  # 12-rule form that blocked the tunnel. Cluster-scoped CRD — applies
  # cleanly alongside the namespace resources below.
  gnpDefaultDeny = pkgs.writeText "03-gnp-default-deny.yaml" (
    builtins.readFile ../k8s/gnp-default-deny.yaml
  );

  # Cluster-wide ValidatingAdmissionPolicy (resources + security) WITH the
  # local-path helper-pod matchConditions exclusion. SINGLE SOURCE OF TRUTH:
  # k8s/maplespike/vap-require-resources-and-security.yaml — read directly so
  # the nix pipeline and the committed file never drift. The exclusion is
  # REQUIRED for local-path provisioning (helper pods run as root + hostPath
  # in kube-system); without it every local-path PVC is Pending cluster-wide
  # (2026-08-11 incident). Included in the manifest bundle so a rebuild
  # reproduces it.
  vapResourcesSecurity = pkgs.writeText "08-vap-require-resources.yaml" (
    builtins.readFile ../k8s/maplespike/vap-require-resources-and-security.yaml
  );

  # ── Cloudflared (tunnel) ───────────────────────────────────────────
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
      namespace: maplespike
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
            # directly on the Deployment (see k8s/base/10-api-deploy.yaml);
            # for BYOK self-hosters it can be injected via a secret. We keep
            # a safe dev default so the manifest applies without a secret.
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: maplespike-secrets
                  key: jwt-secret
                  optional: true
            # Decision 0002: registration/Auth REQUIRES a stable 64-char hex
            # QUILL_PII_HASH_SECRET in production — the api-server refuses to
            # start the register flow without it. MUST stay in lockstep with
            # k8s/maplespike/quill-api-deployment.yaml. The value lives in
            # `maplespike-secrets/pii-hash-secret` (synced by
            # scripts/sops-sync-k8s.sh from secrets/runtime.yaml).
            - name: QUILL_PII_HASH_SECRET
              valueFrom:
                secretKeyRef:
                  name: maplespike-secrets
                  key: pii-hash-secret
                  optional: false
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
    for f in ${namespace} ${gnpDefaultDeny} ${vapResourcesSecurity} ${cloudflared} ${apiDataPvc} ${apiDeploy} ${mcpDeploy} ${portalDeploy} ${lanIngress}; do
      echo "---" >> $out/manifests.yaml
      cat "$f" >> $out/manifests.yaml
    done
    echo "wrote $out/manifests.yaml"
  '';
in
manifest
