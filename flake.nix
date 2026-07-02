{
  description = "MapleSpike — Canadian sovereign data pipeline: ingestion, verification, audit, and civic intelligence";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    agenix.url = "github:ryantm/agenix";
    easykubenix.url = "github:lillecarl/easykubenix";
    easykubenix.flake = false;
  };

  outputs = { self, nixpkgs, flake-utils, agenix, easykubenix }:
  let
    # ── System-independent outputs ─────────────────────────────
    nixosModules.default = import ./nix;

    # K8s manifests require pkgs, so we build them per-system below
    # but also expose a convenience k8sManifests output
  in
  {
    inherit nixosModules;
  } //
  flake-utils.lib.eachDefaultSystem (system:
  let
    pkgs = import nixpkgs {
      inherit system;
      config.allowUnfree = true;
    };
    nodejs = pkgs.nodejs_22;
    pnpm = pkgs.pnpm.override { nodejs = nodejs; };

    # Source tree — clean out irrelevant files to avoid unnecessary rebuilds
    maplespike-src = pkgs.lib.cleanSourceWith {
      src = ./.;
      filter = path: type:
      let bn = baseNameOf path; in
      !(bn == "node_modules" || bn == "dist" || bn == ".git" ||
        bn == ".devenv" || bn == ".direnv" || bn == "result" ||
        bn == ".hermes" || bn == ".sisyphus" || bn == ".playwright-mcp" ||
        bn == "landing-page.png" || bn == "test-results");
    };

    # ── Build all packages ──────────────────────────────────────────
    # pnpm install (network access) + pnpm build (tsc -b across workspaces)
    maplespike-build = pkgs.stdenv.mkDerivation {
      name = "maplespike-build";
      src = maplespike-src;
      buildInputs = [ nodejs pnpm pkgs.python3 pkgs.gcc pkgs.cacert ];
      # Sandbox must be off for pnpm to reach npm registry
      __noChroot = true;
      buildPhase = ''
        export HOME=$TMPDIR
        export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
        export NIX_SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
        # Disable corepack auto-download to avoid TLS bootstrap issue
        export COREPACK_ENABLE_STRICT=0
        pnpm install --no-frozen-lockfile
        pnpm build
      '';
      installPhase = ''
        mkdir -p $out
        # Dereference pnpm symlinks so Docker COPY gets real files
        cp -r --dereference node_modules $out/node_modules
        cp -r packages $out/
        cp package.json pnpm-lock.yaml pnpm-workspace.yaml $out/
      '';
    };

    # ── Portal source: lightweight static files (no Node build) ────
    portal-src = pkgs.stdenv.mkDerivation {
      name = "maplespike-portal-src";
      src = builtins.path {
        path = ./packages/portal;
        name = "maplespike-portal-files";
      };
      installPhase = ''
        mkdir -p $out/app
        cp -r $src/. $out/app/
      '';
    };

    # ── OCI image builder ───────────────────────────────────────────
    mkImage = { name, cmd, port, extraEnv }: pkgs.dockerTools.buildLayeredImage {
      inherit name;
      tag = "latest";
      created = "now";
      contents = with pkgs; [ maplespike-build nodejs bash coreutils dumb-init ];
      config = {
        Env = [
          "NODE_ENV=production"
          "PORT=${toString port}"
          "HOME=/tmp"
        ] ++ extraEnv;
        Cmd = cmd;
        ExposedPorts = { "${toString port}/tcp" = {}; };
        Labels = {
          "org.opencontainers.image.title" = "MapleSpike ${name}";
          "org.opencontainers.image.description" = "Canadian sovereign data pipeline — ${name} service";
          "org.opencontainers.image.source" = "https://github.com/reverb256/maplespike";
          "org.opencontainers.image.version" = "${self.shortRev or "dirty"}";
        };
      };
    };

    # ── K8s manifests via easykubenix (local let binding ONLY) ──────
    # Defined as a local `let` binding — NOT as `packages.k8s-manifests` and
    # NOT as a top-level `k8sManifests` output. Reason: easykubenix's
    # internal.nix line 111 does `manifestYAML = builtins.readFile
    # manifestYAMLFile;`, which is Import-From-Derivation. `nix flake check
    # --no-build` cannot realise that derivation, so a `packages` /
    # `k8sManifests` attribute triggers the failure. Keeping the value in
    # local `let` keeps the attribute set's evaluation clean of IFD; the only
    # consumer is the `apps.k8s-manifests` shell app below, evaluated lazily.
    k8s-manifests-drv = (import easykubenix {
      inherit pkgs;
      modules = [
        ./k8s/cron.nix
        ./k8s/dev.nix
        ./k8s/prod.nix
        ./k8s/infra.nix
      ];
    }).manifestYAMLFile;

  in {
    packages = rec {
      default = self.packages.${system}.maplespike-mcp-image;

      maplespike-mcp-image = mkImage {
        name = "maplespike-mcp";
        cmd = [ "node" "packages/mcp-server/dist/index.js" ];
        port = 3001;
        extraEnv = [];
      };

      maplespike-api-image = mkImage {
        name = "maplespike-api";
        cmd = [ "node" "packages/api-server/dist/dev-server.js" ];
        port = 8082;
        extraEnv = [ "MAPLESPIKE_STORAGE=sqlite" ];
      };

      maplespike-ingest-image = mkImage {
        name = "maplespike-ingest";
        cmd = [ "node" "packages/pipeline-core/dist/cli/ingest.js" ];
        port = 0;
        extraEnv = [];
      };

      maplespike-engine-image = mkImage {
        name = "maplespike-engine";
        cmd = [ "node" "packages/engine/dist/sweep/run.js" ];
        port = 0;
        extraEnv = [];
      };

      # ── Portal image: lightweight Python-based static server ──────────
      maplespike-portal-image = pkgs.dockerTools.buildLayeredImage {
        name = "maplespike-portal";
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
            "org.opencontainers.image.source" = "https://github.com/reverb256/maplespike";
            "org.opencontainers.image.version" = "${self.shortRev or "dirty"}";
          };
        };
      };

      maplespike-all = pkgs.symlinkJoin {
        name = "maplespike-all-images";
        paths = [
          self.packages.${system}.maplespike-mcp-image
          self.packages.${system}.maplespike-api-image
          self.packages.${system}.maplespike-ingest-image
          self.packages.${system}.maplespike-engine-image
          self.packages.${system}.maplespike-portal-image
        ];
      };

      maplespike-build-all = pkgs.writeShellScriptBin "maplespike-build-all" ''
        set -euo pipefail
        for pkg in maplespike-mcp maplespike-api maplespike-portal; do
          echo "=== Building $pkg ==="
          nix build ".#$pkg-image" --print-out-paths -L
        done
        echo "=== All done ==="
      '';

      # NOTE: k8s-manifests was intentionally removed from `packages` — see
      # the `k8s-manifests-drv` let binding above and the IFD-comment for the
      # rationale. The same derivation is reachable via `nix run
      # .#maplespike-k8s-manifests`.

      maplespike-push-all = pkgs.writeShellScriptBin "maplespike-push-all" ''
        set -euo pipefail
        REGISTRY="ghcr.io/reverb256"
        TAG="''${TAG:-stable}"
        COMMIT="''${COMMIT:-$(git rev-parse --short HEAD)}"

        for img in maplespike-mcp maplespike-api maplespike-portal; do
          echo "=== $img ==="
          path=$(nix build ".#$img-image" --print-out-paths --no-link -L)
          docker load < "$path"
          docker tag "maplespike-$img:latest" "$REGISTRY/$img:$TAG"
          docker tag "maplespike-$img:latest" "$REGISTRY/$img:$COMMIT"
          docker push "$REGISTRY/$img:$TAG"
          docker push "$REGISTRY/$img:$COMMIT"
          echo "✓ $REGISTRY/$img:$TAG"
        done
      '';

      # ── Podman Quadlet Services (systemd .container + .service) ─────
      systemd-services = pkgs.symlinkJoin {
        name = "maplespike-systemd-services";
        paths = [
          (pkgs.writeText "maplespike-mcp.container" ''
[Container]
Image=ghcr.io/reverb256/maplespike/maplespike-mcp:${self.shortRev or "stable"}
ContainerName=maplespike-mcp
Environment=PORT=3001,NODE_ENV=production
PodmanArgs=--network=host
'')
          (pkgs.writeText "maplespike-mcp.service" ''
[Unit]
Description=Maplespike MCP Server
After=network-online.target
Wants=network-online.target
Requires=maplespike-mcp.container

[Service]
Restart=on-failure
ExecStart=/usr/bin/podman start maplespike-mcp
ExecStop=/usr/bin/podman stop -t 10 maplespike-mcp

[Install]
WantedBy=default.target
'')
          (pkgs.writeText "maplespike-api.container" ''
[Container]
Image=ghcr.io/reverb256/maplespike/maplespike-api:${self.shortRev or "stable"}
ContainerName=maplespike-api
Environment=PORT=8082,NODE_ENV=production,MAPLESPIKE_STORAGE=sqlite
Volumes=maplespike-api-data:/data
PodmanArgs=--network=host
'')
          (pkgs.writeText "maplespike-api.service" ''
[Unit]
Description=Maplespike API Server
After=network-online.target
Wants=network-online.target
Requires=maplespike-api.container

[Service]
Restart=on-failure
ExecStart=/usr/bin/podman start maplespike-api
ExecStop=/usr/bin/podman stop -t 10 maplespike-api

[Install]
WantedBy=default.target
'')
          (pkgs.writeText "maplespike-portal.container" ''
[Container]
Image=ghcr.io/reverb256/maplespike/maplespike-portal:${self.shortRev or "stable"}
ContainerName=maplespike-portal
Environment=PORT=8080,HOME=/tmp
PodmanArgs=--network=host
'')
          (pkgs.writeText "maplespike-portal.service" ''
[Unit]
Description=Maplespike Portal
After=network-online.target
Wants=network-online.target
Requires=maplespike-portal.container

[Service]
Restart=on-failure
ExecStart=/usr/bin/podman start maplespike-portal
ExecStop=/usr/bin/podman stop -t 10 maplespike-portal

[Install]
WantedBy=default.target
'')
        ];
      };

      # ── Docker/Podman Load Scripts ─────────────────────────────
      maplespike-load-all = pkgs.writeShellScriptBin "maplespike-load-all" ''
        set -euo pipefail
        RUNTIME=''${RUNTIME:-docker}

        for img in maplespike-mcp maplespike-api maplespike-portal; do
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
    MAPLESPIKE_STORAGE: "sqlite"
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
      name: maplespike-api-keys
      keys:
        - MAPLESPIKE_CANLII_API_KEY
    ai:
      create: true
      name: maplespike-ai-keys
      keys:
        - MAPLESPIKE_AI_ENDPOINT  # Custom AI endpoint URL
        - MAPLESPIKE_AI_API_KEY   # API key for external provider (OpenAI, Anthropic, etc.)
        - MAPLESPIKE_AI_MODEL      # Model name (e.g., gpt-4, claude-3-opus-20240229)

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
    # MAPLESPIKE_CANLII_API_KEY (from CI/CD or user environment)
    # MAPLESPIKE_AI_ENDPOINT (e.g., https://api.openai.com/v1, http://local-ai:8080)
    # MAPLESPIKE_AI_API_KEY (e.g., sk-ant-..., sk-or-...)
    # MAPLESPIKE_AI_MODEL (e.g., gpt-4, claude-3-opus-20240229)

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
  maplespike-api:
    image: maplespike-api:latest
    build:
      context: .
      dockerfile: Dockerfile
      target: api-server
    container_name: maplespike-api
    ports:
      - "8082:8082"
    environment:
      - NODE_ENV=production
      - MAPLESPIKE_STORAGE=sqlite
      - PORT=8082
      - JWT_SECRET=change-me-in-production
    volumes:
      - maplespike-api-data:/data
    networks:
      - maplespike

  maplespike-mcp:
    image: maplespike-mcp:latest
    build:
      context: .
      dockerfile: Dockerfile
      target: mcp-server
    container_name: maplespike-mcp
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    depends_on:
      - maplespike-api
    networks:
      - maplespike

  maplespike-portal:
    image: maplespike-portal:latest
    build:
      context: .
      dockerfile: Dockerfile
      target: portal
    container_name: maplespike-portal
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - HOME=/tmp
    depends_on:
      - maplespike-api
    networks:
      - maplespike

networks:
  maplespike:
    driver: bridge

volumes:
  maplespike-api-data:
'';

      docker-manifests = pkgs.runCommand "maplespike-docker-manifests" {} ''
        mkdir -p $out
        cp ${self.packages.${system}.docker-compose} $out/docker-compose.yml
        cp ${./Dockerfile} $out/Dockerfile
      '';
    };

    # NOTE: top-level `k8sManifests` was intentionally removed. The single
    # consumer (the `k8s-manifests` app) now references `k8s-manifests-drv`
    # directly. Putting this attribute on a flake output forced `nix flake
    # check` to walk the easykubenix manifest structure, which contains an
    # IFD readFile that is not allowed during --no-build.

    apps = {
      default = {
        type = "app";
        program = "${pnpm}/bin/pnpm";
      };

      build = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-build" ''
          set -euo pipefail
          pnpm build
        ''}/bin/maplespike-build";
      };

      test = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-test" ''
          set -euo pipefail
          pnpm test
        ''}/bin/maplespike-test";
      };

      deploy-dev = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-deploy-dev" ''
          set -euo pipefail
          TAG=''${TAG:-dev}
          for img in maplespike-mcp-image maplespike-api-image maplespike-portal-image; do
            nix build ".#$img" --print-out-paths -L
          done
          echo "✅ Dev images built. Deploy via kubectl apply -f k8s/dev/"
        ''}/bin/maplespike-deploy-dev";
      };

      deploy-prod = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-deploy-prod" ''
          set -euo pipefail
          TAG=''${TAG:-stable}
          for img in maplespike-mcp-image maplespike-api-image maplespike-portal-image; do
            nix build ".#$img" --print-out-paths -L
          done
          echo "✅ Prod images built. Deploy via kubectl apply -f k8s/prod/"
        ''}/bin/maplespike-deploy-prod";
      };

      # Show generated docker-compose.yml
      docker-compose = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-docker-compose" ''
          cat ${self.packages.${system}.docker-compose}
        ''}/bin/maplespike-docker-compose";
      };

      # Show generated Helm values.yaml
      helm-values = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-helm-values" ''
          cat ${self.packages.${system}.helm-values}
        ''}/bin/maplespike-helm-values";
      };

      # Show generated K8s manifests. References the local `k8s-manifests-drv`
      # let binding above (NOT `self.packages.k8s-manifests`) so that flake
      # check does not trigger the easykubenix internal readFile (IFD).
      k8s-manifests = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "maplespike-k8s-manifests" ''
          cat ${k8s-manifests-drv}
        ''}/bin/maplespike-k8s-manifests";
      };

      # Load all images into podman/docker
      load-all = {
        type = "app";
        program = "${self.packages.${system}.maplespike-load-all}/bin/maplespike-load-all";
      };

      # Build all images
      build-all = {
        type = "app";
        program = "${self.packages.${system}.maplespike-build-all}/bin/maplespike-build-all";
      };
    };

    checks = {
      images-exist = pkgs.runCommand "check-images-exist" { } ''
        mkdir -p $out
        echo "✅ ${builtins.toString (builtins.attrNames {
          mcp = self.packages.${system}.maplespike-mcp-image;
          api = self.packages.${system}.maplespike-api-image;
          ingest = self.packages.${system}.maplespike-ingest-image;
          engine = self.packages.${system}.maplespike-engine-image;
          portal = self.packages.${system}.maplespike-portal-image;
        })}" > $out/result
      '';
    };

    devShells.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        nodejs pnpm typescript typescript-language-server
        python3 docker-client kubectl age
      ];
      shellHook = ''
        # Decrypt GitHub PAT via agenix
        if [ -f "$HOME/.ssh/id_ed25519" ]; then
          # NOTE: passed as a relative path string so flake pure-eval does not
          # force the (gitignored) .age file into the Nix store. The shellHook
          # resolves the path at shell-startup time.
          export GITHUB_TOKEN=$(age --decrypt -i "$HOME/.ssh/id_ed25519" "./secrets/github-pat.age" 2>/dev/null || echo "")
          if [ -n "$GITHUB_TOKEN" ]; then
            echo "✓ GITHUB_TOKEN loaded from agenix secret"
          else
            echo "⚠ Could not decrypt github-pat.age — check SSH key"
          fi
        else
          echo "⚠ No SSH key at ~/.ssh/id_ed25519 — agenix secrets unavailable"
        fi
        echo "MapleSpike dev shell — pnpm build | docker build | nix build"
      '';
    };
  }
  );
}
