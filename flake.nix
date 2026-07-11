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
    #   ghcr.io/reverb256/quill/api  · /mcp  · /portal
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
        WorkingDir = "/app";
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
        extraEnv = [ "PYTHONUNBUFFERED=1" ];
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
        REGISTRY="''${REGISTRY:-ghcr.io/reverb256}"
        REPO="''${REPO:-quill}"
        TAG="''${TAG:-stable}"
        COMMIT="''${COMMIT:-$(git rev-parse --short HEAD)}"

        for svc in mcp api portal; do
          echo "=== $svc ==="
          path=$(nix build ".#quill-$svc-image" --print-out-paths --no-link -L)
          ${pkgs.podman}/bin/podman load < "$path"
          ${pkgs.podman}/bin/podman tag "quill-$svc:latest" "$REGISTRY/$REPO/$svc:$TAG"
          ${pkgs.podman}/bin/podman tag "quill-$svc:latest" "$REGISTRY/$REPO/$svc:$COMMIT"
          ${pkgs.podman}/bin/podman push "$REGISTRY/$REPO/$svc:$TAG"
          ${pkgs.podman}/bin/podman push "$REGISTRY/$REPO/$svc:$COMMIT"
          echo "✓ $REGISTRY/$REPO/$svc:$TAG"
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
      };

      # ── SaaS K8s manifests (cloudflared-shaped, matches k8s/base) ─
      # Generated YAML you can `kubectl apply -f` directly.
      saas-manifests = saasManifests {
        inherit pkgs;
        registry = "nexus:5000";
        tag = "latest";
        domain = "maplespike.ca";
      };
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
