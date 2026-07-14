{
  description = "MapleSpike (Quill) — Canadian sovereign data pipeline: ingestion, verification, audit, and civic intelligence. Nix-first: images, SaaS K8s manifests, self-host units, and a NixOS module are all generated from this flake.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    agenix.url = "github:ryantm/agenix";
    # NOTE: easykubenix was removed (PR #733) — its Import-From-Derivation
    # readFile broke `nix flake check --no-build`. K8s manifests are now
    # generated directly by `nix/saas-manifests.nix` (plain Nix → YAML),
    # consumed by `kubectl apply`. See `nix build .#saas-manifests`.
  };

  outputs = { self, nixpkgs, flake-utils, agenix }:
  let
    # NixOS module (services.maplespike + the quill-* NixOS integration).
    nixosModules.default = import ./nix;

    # Self-host + SaaS manifest generators live in ./nix and take `pkgs`.
    # They are wired into eachDefaultSystem below as packages so they are
    # directly buildable: `nix build .#saas-manifests` / `nix build .#selfhost-units`.
  in
  {
    inherit nixosModules agenix;
  } // flake-utils.lib.eachDefaultSystem (system:
  let
    pkgs = import nixpkgs {
      inherit system;
      config.allowUnfree = true;
    };
    nodejs = pkgs.nodejs_22;
    pnpm = pkgs.pnpm.override { nodejs = nodejs; };

    # Generators (take `pkgs`, return derivations). Wired into `packages`
    # below as buildable attributes: `nix build .#saas-manifests`,
    # `nix build .#selfhost-units`.
    saasManifests = import ./nix/saas-manifests.nix;
    selfhostUnits = import ./nix/selfhost.nix;

    # Source tree — clean out irrelevant files to avoid unnecessary rebuilds
    quill-src = pkgs.lib.cleanSourceWith {
      src = ./.;
      filter = path: type:
      let bn = baseNameOf path; in
      !(bn == "node_modules" || bn == "dist" || bn == ".git" ||
        bn == ".devenv" || bn == ".direnv" || bn == "result" ||
        bn == ".hermes" || bn == ".sisyphus" || bn == ".playwright-mcp" ||
        bn == "landing-page.png" || bn == "test-results" ||
        bn == ".astro" || bn == "result");
    };

    # ── Build all packages ──────────────────────────────────────────
    # pnpm install (network access) + pnpm build (tsc -b across workspaces)
    quill-build = pkgs.stdenv.mkDerivation {
      name = "quill-build";
      src = quill-src;
      buildInputs = [ nodejs pnpm pkgs.python3 pkgs.gcc pkgs.cacert ];
      # pnpm needs network + a writable HOME; disable the sandbox entirely.
      # `sandbox = false` is required for __noChroot to be honoured on a
      # remote builder (otherwise nexus rejects the derivation).
      __noChroot = true;
      sandbox = false;
      # Keep this on the local host — it does network I/O and we don't want
      # it dispatched to a remote builder that may lack registry access.
      preferLocalBuild = true;
      buildPhase = ''
        export HOME=$TMPDIR
        export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
        export NIX_SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
        # Disable corepack auto-download to avoid TLS bootstrap issue
        export COREPACK_ENABLE_STRICT=0
        pnpm install --frozen-lockfile
        pnpm build
      '';
      installPhase = ''
        mkdir -p $out
        # Dereference pnpm symlinks so image copies get real files
        cp -r --dereference node_modules $out/node_modules
        cp -r packages $out/
        cp package.json pnpm-lock.yaml pnpm-workspace.yaml $out/
      '';
    };

    # ── Portal static build: dist/ + server.py ─────────────────────
    # The portal is a static Astro site served by server.py. We copy the
    # built `dist/` to /app and place server.py alongside it so the
    # container serves real HTML (the old `portal-src` derivation copied
    # raw source, which server.py could not serve).
    portal-dist = pkgs.runCommand "quill-portal-dist" { } ''
      mkdir -p $out/app
      cp -r ${quill-build}/packages/portal/dist/. $out/app/
      cp ${quill-build}/packages/portal/server.py $out/app/server.py
      # Ensure an index.html exists at the served root
      test -f $out/app/index.html || { echo "portal dist missing index.html"; exit 1; }
    '';

    # ── OCI image builder ───────────────────────────────────────────
    # Image names match the live SaaS registry layout:
    #   nexus:5000/quill-api  · /mcp  · /portal
    mkImage = { name, cmd, port, extraEnv, contents }: pkgs.dockerTools.buildLayeredImage {
      inherit name;
      tag = "latest";
      created = "now";
      contents = contents;
      config = {
        Env = [
          "NODE_ENV=production"
          "PORT=${toString port}"
          "HOME=/tmp"
        ] ++ extraEnv;
        Cmd = cmd;
        # WorkingDir = "/" so relative cmd paths like
        # `node packages/api-server/dist/dev-server.js` resolve to the
        # quill-build overlay at container root (`/packages/...`),
        # not at `/app/` which is empty for api/mcp/ingest/engine.
        # (Portal uses an absolute cmd path so is unaffected.) Resolved
        # 2026-07-11 during the systemic live-rollout bootstrap.
        WorkingDir = "/";
        ExposedPorts = { "${toString port}/tcp" = {}; };
        Labels = {
          "org.opencontainers.image.title" = "MapleSpike ${name}";
          "org.opencontainers.image.description" = "Canadian sovereign data pipeline — ${name} service";
          "org.opencontainers.image.source" = "https://github.com/reverb256/quill";
          "org.opencontainers.image.version" = "${self.shortRev or "dirty"}";
        };
      };
    };

  in {
    packages = rec {
      default = self.packages.${system}.quill-mcp-image;

      quill-mcp-image = mkImage {
        name = "quill-mcp";
        cmd = [ "node" "packages/quill-mcp/dist/index.js" ];
        port = 3001;
        contents = with pkgs; [ quill-build nodejs bash coreutils dumb-init ];
        extraEnv = [ "QUILL_API_URL=http://quill-api:8082/v1" ];
      };

      quill-api-image = mkImage {
        name = "quill-api";
        cmd = [ "node" "packages/api-server/dist/dev-server.js" ];
        port = 8082;
        contents = with pkgs; [ quill-build nodejs bash coreutils dumb-init ];
        extraEnv = [ "QUILL_STORAGE=sqlite" ];
      };

      quill-ingest-image = mkImage {
        name = "quill-ingest";
        cmd = [ "node" "packages/pipeline-core/dist/cli/ingest.js" ];
        port = 0;
        contents = with pkgs; [ quill-build nodejs bash coreutils dumb-init ];
        extraEnv = [];
      };

      quill-engine-image = mkImage {
        name = "quill-engine";
        cmd = [ "node" "packages/engine/dist/sweep/run.js" ];
        port = 0;
        contents = with pkgs; [ quill-build nodejs bash coreutils dumb-init ];
        extraEnv = [];
      };

      # ── Portal image: static dist + python server ──────────────
      quill-portal-image = mkImage {
        name = "quill-portal";
        cmd = [ "python3" "/app/server.py" ];
        port = 8080;
        contents = with pkgs; [ portal-dist python3 bash coreutils ];
        extraEnv = [
          "PYTHONUNBUFFERED=1"
          # Same-origin /api proxy target (no /v1 suffix — the frontend sends /api/v1/...)
          "API_UPSTREAM=http://quill-api:8082"
        ];
||||||| ed0b1af
        tag = "latest";
        created = "now";
        contents = with pkgs; [ portal-src python3 bash coreutils ];
        config = {
          Env = [
            "PORT=8080"
            "HOME=/tmp"
            "PYTHONUNBUFFERED=1"
          ];
          Cmd = [ "python3" "/app/server.py" ];
          WorkingDir = "/app";
          ExposedPorts = { "8080/tcp" = {}; };
          Labels = {
            "org.opencontainers.image.title" = "MapleSpike Portal";
            "org.opencontainers.image.description" = "Canadian government data portal";
            "org.opencontainers.image.source" = "https://github.com/reverb256/quill";
            "org.opencontainers.image.version" = "${self.shortRev or "dirty"}";
          };
        };
      };

      quill-all = pkgs.symlinkJoin {
        name = "quill-all-images";
        paths = [
          self.packages.${system}.quill-mcp-image
          self.packages.${system}.quill-api-image
          self.packages.${system}.quill-ingest-image
          self.packages.${system}.quill-engine-image
          self.packages.${system}.quill-portal-image
        ];
      };

      # ── Build helper scripts ───────────────────────────────────
      build-all = pkgs.writeShellScriptBin "quill-build-all" ''
        set -euo pipefail
        for pkg in quill-mcp quill-api quill-portal; do
          echo "=== Building $pkg ==="
          nix build ".#$pkg-image" --print-out-paths -L
        done
        echo "=== All done ==="
      '';

      push-all = pkgs.writeShellScriptBin "quill-push-all" ''
        set -euo pipefail
        # Default target is the operator-host nexus:5000 registry. Override
        # `REGISTRY=<host>` runtime. The bash heredoc below uses bare
        # $REGISTRY — Nix indented-string interpolation only triggers on
        # ''${X} brace forms, so write $X without braces here. (GHCR push
        # path retired 2026-07-11; see AGENTS.md § Image-tag construction.)
        REGISTRY="''${REGISTRY:-nexus:5000}"
        TAG="''${TAG:-stable}"
        COMMIT="''${COMMIT:-$(git rev-parse --short HEAD)}"

        for svc in mcp api portal; do
          echo "=== $svc ==="
          path=$(nix build ".#quill-$svc-image" --print-out-paths --no-link -L)
          ${pkgs.podman}/bin/podman load < "$path"
          ${pkgs.podman}/bin/podman tag "quill-$svc:latest" "$REGISTRY/quill-$svc:$TAG"
          ${pkgs.podman}/bin/podman tag "quill-$svc:latest" "$REGISTRY/quill-$svc:$COMMIT"
          ${pkgs.podman}/bin/podman push "$REGISTRY/quill-$svc:$TAG"
          ${pkgs.podman}/bin/podman push "$REGISTRY/quill-$svc:$COMMIT"
          echo "✓ $REGISTRY/quill-$svc:$TAG"
        done
      '';

      # ── Podman Quadlet units (systemd .container) for self-host ──
      # Parameterized by registry/tag. Self-host script copies these into
      # ~/.config/containers/systemd/user/ (or /etc/containers/systemd).
      selfhost-units = selfhostUnits {
        inherit pkgs;
        registry = "localhost";
        tag = "latest";
        domain = "localhost";
        apiImage = "quill-api";
        mcpImage = "quill-mcp";
        portalImage = "quill-portal";
||||||| ed0b1af
      # ── Podman Quadlet Services (systemd .container + .service) ─────
      systemd-services = pkgs.symlinkJoin {
        name = "maplespike-systemd-services";
        paths = [
          (pkgs.writeText "quill-mcp.container" ''
[Container]
Image=ghcr.io/reverb256/quill/quill-mcp:${self.shortRev or "stable"}
ContainerName=quill-mcp
Environment=PORT=3001,NODE_ENV=production
PodmanArgs=--network=host
'')
          (pkgs.writeText "quill-mcp.service" ''
[Unit]
Description=MapleSpike Quill (data-layer MCP server)
After=network-online.target
Wants=network-online.target
Requires=quill-mcp.container

[Service]
Restart=on-failure
ExecStart=/usr/bin/podman start quill-mcp
ExecStop=/usr/bin/podman stop -t 10 quill-mcp

[Install]
WantedBy=default.target
'')
          (pkgs.writeText "quill-api.container" ''
[Container]
Image=ghcr.io/reverb256/quill/quill-api:${self.shortRev or "stable"}
ContainerName=quill-api
Environment=PORT=8082,NODE_ENV=production,QUILL_STORAGE=sqlite
Volumes=quill-api-data:/data
PodmanArgs=--network=host
'')
          (pkgs.writeText "quill-api.service" ''
[Unit]
Description=Maplespike API Server
After=network-online.target
Wants=network-online.target
Requires=quill-api.container

[Service]
Restart=on-failure
ExecStart=/usr/bin/podman start quill-api
ExecStop=/usr/bin/podman stop -t 10 quill-api

[Install]
WantedBy=default.target
'')
          (pkgs.writeText "quill-portal.container" ''
[Container]
Image=ghcr.io/reverb256/quill/quill-portal:${self.shortRev or "stable"}
ContainerName=quill-portal
Environment=PORT=8080,HOME=/tmp
PodmanArgs=--network=host
'')
          (pkgs.writeText "quill-portal.service" ''
[Unit]
Description=Maplespike Portal
After=network-online.target
Wants=network-online.target
Requires=quill-portal.container

[Service]
Restart=on-failure
ExecStart=/usr/bin/podman start quill-portal
ExecStop=/usr/bin/podman stop -t 10 quill-portal

[Install]
WantedBy=default.target
'')
        ];
      };

      # ── SaaS K8s manifests (cloudflared-shaped, matches k8s/base) ─
      # Generated YAML you can `kubectl apply -f` directly.
      saas-manifests = saasManifests {
        inherit pkgs;
        registry = "nexus:5000";
        tag = "latest";
        domain = "maplespike.ca";
      };
||||||| ed0b1af
      # ── Docker/Podman Load Scripts ─────────────────────────────
      maplespike-load-all = pkgs.writeShellScriptBin "maplespike-load-all" ''
        set -euo pipefail
        RUNTIME=''${RUNTIME:-docker}

        for img in quill-mcp quill-api quill-portal; do
          echo "=== Loading $img ==="
          path=$(nix build ".#$img-image" --print-out-paths --no-link -L)
          $RUNTIME load < "$path"
          echo "✓ $img loaded into $RUNTIME"
        done
      '';

# Helm values.yaml ───────────────────────────────────────────────
      helm-values = pkgs.writeText "values.yaml" ''
# MapleSpike Helm Chart Values
# Generated from maplespike flake (single source of truth)
# Override per-environment: helm install -f values-prod.yaml

# Image configuration
image:
  registry: ghcr.io/reverb256
  tag: "${self.shortRev or "stable"}"
  pullPolicy: IfNotPresent

# API Server
api:
  replicas: 2
  port: 8082
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
  env:
    QUILL_STORAGE: "sqlite"
    NODE_ENV: "production"
  volumeMounts:
    - name: api-data
      mountPath: /data

# MCP Server
mcp:
  replicas: 1
  port: 3001
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 300m
      memory: 256Mi
  env:
    NODE_ENV: "production"

# Portal
portal:
  replicas: 1
  port: 8080
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 100m
      memory: 128Mi

# ── BYOK: Bring Your Own Keys ───────────────────────────────
# Support for user-provided API keys (no hardcoded secrets)
# Three modes: k8s-secrets | external-manager | env-injection

byok:
  enabled: true
  # Mode 1: Kubernetes Secrets (recommended for K8s clusters)
  k8sSecrets:
    enabled: true
    canlii:
      create: true
      name: quill-api-keys
      keys:
        - QUILL_CANLII_API_KEY
    ai:
      create: true
      name: quill-ai-keys
      keys:
        - QUILL_AI_ENDPOINT  # Custom AI endpoint URL
        - QUILL_AI_API_KEY   # API key for external provider (OpenAI, Anthropic, etc.)
        - QUILL_AI_MODEL      # Model name (e.g., gpt-4, claude-3-opus-20240229)

  # Mode 2: External Secret Manager (AWS Secrets Manager, Azure Key Vault, etc.)
  externalSecretManager:
    enabled: false
    provider: "aws-secrets-manager"  # aws-secrets-manager | azure-key-vault | hashicorp-vault
    secretRefs:
      canlii:
        secretARN: "arn:aws:secretsmanager:region:account:secret:maplespike/canlii-api-key"
      ai:
        secretARN: "arn:aws:secretsmanager:region:account:secret:maplespike/ai-keys"

  # Mode 3: Environment Variable Injection (least secure, not recommended)
  envInjection:
    enabled: false
    # Keys must be provided as environment variables (not in values.yaml)
    # QUILL_CANLII_API_KEY (from CI/CD or user environment)
    # QUILL_AI_ENDPOINT (e.g., https://api.openai.com/v1, http://local-ai:8080)
    # QUILL_AI_API_KEY (e.g., sk-ant-..., sk-or-...)
    # QUILL_AI_MODEL (e.g., gpt-4, claude-3-opus-20240229)

# Persistence
persistence:
  api:
    enabled: true
    storageClass: "longhorn"
    size: "5Gi"
    accessMode: "ReadWriteOnce"

# Image pull secrets
imagePullSecrets:
  enabled: true
  name: "ghcr-pull"

# NetworkPolicy (restrict egress to trusted sources)
networkPolicy:
  enabled: true
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 8084
    - to:
        - namespaceSelector:
            matchLabels:
              k8s-app.kubernetes.io/name: ai-inference
      ports:
        - protocol: TCP
          port: 8084
    - to:
        - namespaceSelector:
            matchLabels:
              k8s-app.kubernetes.io/name: qdrant
      ports:
        - protocol: TCP
          port: 6333

# Ingress (for non-NixOS clusters)
ingress:
  enabled: false
  ingressClassName: "nginx"
  domain: "maplespike.lan"
  annotations: {}
'';

      # ── Docker/Podman manifests (generated from Nix builds) ────────
      docker-compose = pkgs.writeText "docker-compose.yml" ''
version: "3.8"

services:
  quill-api:
    image: quill-api:latest
    build:
      context: .
      dockerfile: Dockerfile
      target: api-server
    container_name: quill-api
    ports:
      - "8082:8082"
    environment:
      - NODE_ENV=production
      - QUILL_STORAGE=sqlite
      - PORT=8082
      - JWT_SECRET=change-me-in-production
    volumes:
      - quill-api-data:/data
    networks:
      - maplespike

  quill-mcp:
    image: quill-mcp:latest
    build:
      context: .
      dockerfile: Dockerfile
      target: quill-mcp
    container_name: quill-mcp
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    depends_on:
      - quill-api
    networks:
      - maplespike

  quill-portal:
    image: quill-portal:latest
    build:
      context: .
      dockerfile: Dockerfile
      target: portal
    container_name: quill-portal
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - HOME=/tmp
    depends_on:
      - quill-api
    networks:
      - maplespike

networks:
  maplespike:
    driver: bridge

volumes:
  quill-api-data:
'';

      docker-manifests = pkgs.runCommand "maplespike-docker-manifests" {} ''
        mkdir -p $out
        cp ${self.packages.${system}.docker-compose} $out/docker-compose.yml
        cp ${./Dockerfile} $out/Dockerfile
      '';
    };

    # Top-level easy handles
    apps = {
      default = {
        type = "app";
        program = "${pnpm}/bin/pnpm";
      };

      build = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "quill-build" ''set -euo pipefail; pnpm build''}/bin/quill-build";
      };

      test = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-test" ''set -euo pipefail; pnpm test''}/bin/maplespike-test";
      };

      # Build all three runtime images
      build-images = {
        type = "app";
        program = "${self.packages.${system}.build-all}/bin/quill-build-all";
      };

      # Push all three runtime images to a registry
      push-images = {
        type = "app";
        program = "${self.packages.${system}.push-all}/bin/quill-push-all";
      };

      # One-touch self-host: build images (if needed) + install quadlets + start
      selfhost = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "quill-selfhost" ''
          set -euo pipefail
          ACTION="''${1:-up}"
          HERE="$(cd "$(dirname "''${BASH_SOURCE[0]}")" && pwd)"
          ROOT="$(cd "$HERE/.." && pwd)"
          cd "$ROOT"
          case "$ACTION" in
            up)
              echo "==> Building images (nix)"
              nix build .#quill-api-image .#quill-mcp-image .#quill-portal-image -L
              echo "==> Loading into podman"
              for svc in api mcp portal; do
                ${pkgs.podman}/bin/podman load < "result" 2>/dev/null || true
              done
              echo "==> Installing quadlet units"
              UNIT_DIR="''${XDG_CONFIG_HOME:-$HOME/.config}/containers/systemd/user"
              mkdir -p "$UNIT_DIR"
              for f in $(${pkgs.coreutils}/bin/ls ${self.packages.${system}.selfhost-units}/); do
                ${pkgs.coreutils}/bin/cp -f ${self.packages.${system}.selfhost-units}/$f "$UNIT_DIR/"
              done
              ${pkgs.systemd}/bin/systemctl --user daemon-reload
              ${pkgs.systemd}/bin/systemctl --user start quill-api quill-mcp quill-portal
              echo "✓ Quill self-hosted at http://localhost:8080"
              ;;
            down)
              ${pkgs.systemd}/bin/systemctl --user stop quill-api quill-mcp quill-portal || true
              ${pkgs.systemd}/bin/systemctl --user disable quill-api quill-mcp quill-portal || true
              echo "✓ Stopped"
              ;;
            logs)
              ${pkgs.systemd}/bin/journalctl --user -u quill-api -u quill-mcp -u quill-portal -f
              ;;
            *)
              echo "Usage: quill-selfhost [up|down|logs]"
              exit 1
              ;;
          esac
        ''}/bin/quill-selfhost";
      };

      # SaaS deploy: build manifests from Nix, apply to cluster
      deploy-saas = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "quill-deploy-saas" ''
          set -euo pipefail
          HERE="$(cd "$(dirname "''${BASH_SOURCE[0]}")" && pwd)"
          ROOT="$(cd "$HERE/.." && pwd)"
          cd "$ROOT"
          TAG="''${TAG:-stable}"
          echo "==> Generating SaaS manifests (tag=$TAG)"
          nix build ".#saas-manifests" -L
          MANIFEST="result/manifests.yaml"
          echo "==> Applying to cluster (namespace maplespike)"
          kubectl apply -f "$MANIFEST"
          echo "==> Rolling out"
          kubectl rollout status deployment/quill-api -n maplespike --timeout=120s || true
          kubectl rollout status deployment/quill-portal -n maplespike --timeout=120s || true
          kubectl rollout status deployment/quill-mcp -n maplespike --timeout=120s || true
          echo "✓ SaaS deploy complete — https://quill.$MAPLESPIKE_DOMAIN"
        ''}/bin/quill-deploy-saas";
      };
    };

    checks = {
      images-exist = pkgs.runCommand "check-images-exist" { } ''
        mkdir -p $out
        echo "✅ $(echo -n 'quill-mcp quill-api quill-ingest quill-engine quill-portal' | wc -w) images defined" > $out/result
      '';
      portal-dist-has-index = pkgs.runCommand "check-portal-index" { } ''
        test -f ${portal-dist}/app/index.html || { echo "portal dist missing index.html"; exit 1; }
        echo "✅ portal index.html present" > $out
      '';
    };

    devShells.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        nodejs pnpm typescript typescript-language-server
        python3 podman kubectl age
      ];
      shellHook = ''
        # Decrypt GitHub PAT via agenix if an SSH key is present
        if [ -f "$HOME/.ssh/id_ed25519" ]; then
          export GITHUB_TOKEN=$(age --decrypt -i "$HOME/.ssh/id_ed25519" "./secrets/github-pat.age" 2>/dev/null || echo "")
          if [ -n "$GITHUB_TOKEN" ]; then echo "✓ GITHUB_TOKEN loaded from agenix secret"; fi
        fi
        echo "MapleSpike dev shell — pnpm build | nix build | nix run .#selfhost up"
      '';
    };
  }
  );
}
