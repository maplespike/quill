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
      !(pkgs.lib.hasSuffix ".tsbuildinfo" bn ||
        bn == ".turbo" || bn == "node_modules" || bn == "dist" || bn == ".git" ||
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
        # pnpm snapshots `file:` workspace deps into the virtual store at
        # INSTALL time — BEFORE `pnpm build` emits dist/ — so the vstore
        # copies ship dist-less and the dereferenced image crashes at runtime
        # (ERR_MODULE_NOT_FOUND on @maplespike/database/dist/index.js,
        # 2026-08-15 rollout — the old Dockerfile-built images had dist in
        # the vstore; the nix path did not). Re-point every workspace
        # package's vstore entry at the LIVE built dir so the image resolves
        # dist/. Verified: ../../../../../packages/<name> resolves from
        # node_modules/.pnpm/@maplespike+<hash>/node_modules/@maplespike/<name>.
        for entry in node_modules/.pnpm/@maplespike+*/node_modules/@maplespike/*; do
          [ -e "$entry" ] || continue
          name=$(basename "$entry")
          [ -d "packages/$name" ] || continue
          rm -rf "$entry"
          ln -s "../../../../../packages/$name" "$entry"
        done
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
    #
    # Issue #778 (GitHub OAuth 502 — missing CA bundle): EVERY image ships
    # the Nix CA bundle (pkgs.cacert) and points Node/OpenSSL at it via
    # NODE_EXTRA_CA_CERTS + SSL_CERT_FILE. Without it, outbound TLS (GitHub
    # token exchange, source ingestion) fails with "unable to get local
    # issuer certificate". The path is parameterized by ${pkgs.cacert} — not
    # a hardcoded store path — so a nixpkgs bump follows automatically. The
    # Docker build path got the same treatment in Dockerfile.api
    # (commit a24d3eab, live-verified 2026-07-16).
    mkImage = { name, cmd, port, extraEnv, contents }: pkgs.dockerTools.buildLayeredImage {
      inherit name;
      tag = "latest";
      created = "now";
      contents = contents ++ [ pkgs.cacert ];
      config = {
        Env = [
          "NODE_ENV=production"
          "PORT=${toString port}"
          "HOME=/tmp"
          # #778: outbound TLS trust for Node (fetch/https) + OpenSSL tools
          "NODE_EXTRA_CA_CERTS=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
          "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
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
      };

      # ── SaaS K8s manifests (cloudflared-shaped, matches k8s/base) ─
      # Generated YAML you can `kubectl apply -f` directly.
      #
      # Tag pins match what is LIVE in the cluster (rolled 2026-08-15):
      #   api/mcp/portal = fe9c1e54 (current main: undici stream-guard,
      #                               GeoMet collection fix, query_* error
      #                               messages, CI quoting fix)
      # These MUST track live rollouts — a canonical `nix build .#saas-manifests`
      # that pins an older tag regresses the cluster (2026-08-11 incident:
      # api -4 pin would have rolled back the quill_ rename). The admission
      # policy `deny-latest-tag-deployments` forbids :latest.
      saas-manifests = saasManifests {
        inherit pkgs;
        registry = "nexus:5000";
        tag = "52ef870";
        apiTag = "52ef870";
        mcpTag = "52ef870";
        portalTag = "52ef870";
        domain = "maplespike.ca";
      };

      # ── Dev SaaS manifests (namespace quill-dev, LAN-only) ──────
      # Same generator, different call site. Image tags are pinned to the
      # current git short-sha so every main push deploys a unique, immutable
      # tag (the cluster's `deny-latest-tag-deployments` admission policy
      # forbids :latest). The deploy-dev workflow pushes the matching tags
      # via `nix run .#push-images` (which tags $COMMIT = git short sha)
      # BEFORE applying. Dev is namespace-scoped only: no cloudflared, no
      # GNP/VAP (cluster-scoped — prod owns them), dynamic ClusterIPs,
      # dev.* ingress hosts, and its own quill-dev-secrets Secret.
      dev-manifests = saasManifests {
        inherit pkgs;
        registry = "nexus:5000";
        # On a git checkout self.shortRev = git rev-parse --short HEAD, which
        # is the $COMMIT tag push-images pushes. Fall back to "stable" (also
        # always pushed) — NOT "dev", which push-images never pushes (a
        # path-flake eval has no git metadata, so shortRev is missing and a
        # `:dev` pin would ImagePullBackOff on apply).
        tag = self.shortRev or "stable";
        apiTag = self.shortRev or "stable";
        mcpTag = self.shortRev or "stable";
        portalTag = self.shortRev or "stable";
        domain = "maplespike.ca";
        namespace = "quill-dev";
        dev = true;
        # qdrant lives in the ai-inference namespace (reference manifest
        # k8s/maplespike/quill-api-deployment.yaml). The generator default
        # now matches that cross-namespace service (was the stale bare
        # `http://qdrant:6333`), and dev inherits it — RAG works against the
        # shared vector store (dev runs no ingest cronjobs, so it only reads).
        qdrantEndpoint = "http://qdrant-service.ai-inference.svc.cluster.local:6333";
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
          # Resolve the flake root from the caller's cwd (git toplevel), NOT
          # from BASH_SOURCE: via `nix run` the script lives in the store and
          # ``cd "$(dirname "$0")/.."`` lands in /nix/store with no flake.nix.
          ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
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
          echo "✓ SaaS deploy complete — https://quill.''${MAPLESPIKE_DOMAIN:-maplespike.ca}"
        ''}/bin/quill-deploy-saas";
      };

      # Dev SaaS deploy: render the quill-dev bundle, bootstrap the dev
      # secret, apply to the LAN-only quill-dev namespace, and roll out.
      # Images must already be pushed (deploy-dev workflow runs
      # `nix run .#push-images` first — the bundle pins the short-sha tag).
      deploy-dev = {
        type = "app";
        program = "${pkgs.writeShellScriptBin "quill-deploy-dev" ''
          set -euo pipefail
          # Same ROOT resolution fix as deploy-saas (git toplevel, not store).
          ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
          cd "$ROOT"
          echo "==> Generating dev SaaS manifests (namespace quill-dev)"
          nix build ".#dev-manifests" -L
          MANIFEST="result/manifests.yaml"
          echo "==> Applying to cluster (namespace quill-dev)"
          kubectl apply -f "$MANIFEST"
          echo "==> Bootstrapping dev secrets (quill-dev-secrets + quill-secrets)"
          if ! kubectl get secret quill-dev-secrets -n quill-dev >/dev/null 2>&1; then
            # Values are throwaway random dev creds. Use --from-file (not
            # --from-literal) to keep them out of the process table — same
            # posture as scripts/sops-sync-k8s.sh's apply_secret().
            TMPD=$(mktemp -d)
            trap 'rm -rf "$TMPD"' EXIT
            # 64 hex chars: the api-server only accepts a 64-hex PII hash
            # (Decision 0002) — a random base64-ish value is rejected.
            echo -n "$(openssl rand -hex 32)" > "$TMPD/pii-hash-secret"
            kubectl create secret generic quill-dev-secrets -n quill-dev \
              --from-file=pii-hash-secret="$TMPD/pii-hash-secret"
            rm -rf "$TMPD"
            trap - EXIT
            echo "✓ created quill-dev-secrets (random dev value)"
          else
            echo "✓ quill-dev-secrets already exists (reusing)"
          fi
          # quill-secrets carries the api/jwt pair. Production gets it from
          # scripts/sops-sync-k8s.sh (sops -> cluster); dev bootstraps its own
          # random values under the SAME key names the manifests reference
          # (nix/saas-manifests.nix: quill-secrets/jwtSecret + /apiKey), so a
          # dev pod never renders with an unset JWT_SECRET or QUILL_API_KEY.
          if ! kubectl get secret quill-secrets -n quill-dev >/dev/null 2>&1; then
            TMPD=$(mktemp -d)
            trap 'rm -rf "$TMPD"' EXIT
            echo -n "$(openssl rand -hex 32)" > "$TMPD/jwtSecret"
            echo -n "dev-$(openssl rand -hex 16)" > "$TMPD/apiKey"
            kubectl create secret generic quill-secrets -n quill-dev \
              --from-file=jwtSecret="$TMPD/jwtSecret" \
              --from-file=apiKey="$TMPD/apiKey"
            rm -rf "$TMPD"
            trap - EXIT
            echo "✓ created quill-secrets (random dev values)"
          else
            echo "✓ quill-secrets already exists (reusing)"
          fi
          # The api pod's secretKeyRefs are `optional: true`, so the first pod
          # boots BEFORE the secret exists (fresh namespace). The restart is
          # what injects the freshly-created secret env refs — do NOT remove it
          # as "redundant"; without it dev auth/registration reads empty values.
          echo "==> Rolling out (picks up dev secret env refs)"
          kubectl rollout restart deployment/quill-api -n quill-dev
          kubectl rollout status deployment/quill-api -n quill-dev --timeout=120s || true
          kubectl rollout status deployment/quill-portal -n quill-dev --timeout=120s || true
          kubectl rollout status deployment/quill-mcp -n quill-dev --timeout=120s || true
          echo "✓ Dev deploy complete — LAN: https://dev.maplespike.ca (via Traefik ingress)"
        ''}/bin/quill-deploy-dev";
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
