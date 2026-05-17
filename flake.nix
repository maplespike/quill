{
  description = "MapleSpike — Canadian sovereign data pipeline: ingestion, verification, audit, and civic intelligence";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
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
          buildInputs = [ nodejs pnpm pkgs.python3 pkgs.gcc ];
          buildPhase = ''
            export HOME=$TMPDIR
            pnpm install --frozen-lockfile
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

      in {
        packages = {
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

          maplespike-push-all = pkgs.writeShellScriptBin "maplespike-push-all" ''
            set -euo pipefail
            REGISTRY="ghcr.io/reverb256"
            TAG="''${TAG:-stable}"
            COMMIT="''${COMMIT:-$(git rev-parse --short HEAD)}"

            for img in maplespike-mcp maplespike-api maplespike-portal; do
              echo "=== $img ==="
              path=$(nix build ".#$img-image" --print-out-paths --no-link -L)
              docker load < "''$path"
              docker tag "maplespike-$img:latest" "$REGISTRY/$img:$TAG"
              docker tag "maplespike-$img:latest" "$REGISTRY/$img:$COMMIT"
              docker push "$REGISTRY/$img:$TAG"
              docker push "$REGISTRY/$img:$COMMIT"
              echo "✓ $REGISTRY/$img:$TAG"
            done
          '';
        };

        apps.default = {
          type = "app";
          program = "${pnpm}/bin/pnpm";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs pnpm typescript typescript-language-server
            python3 docker-client kubectl
          ];
          shellHook = ''
            echo "MapleSpike dev shell — pnpm build | docker build | nix build"
          '';
        };
      }
    );
}
