{
  description = "CivInt Canada — Canadian sovereign data pipeline: ingestion, verification, audit, and civic intelligence";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Build the CivInt MCP server OCI image
        civint-mcp-image = pkgs.dockerTools.buildImage {
          name = "civint-mcp";
          tag = "flake";

          copyToRoot = pkgs.buildEnv {
            name = "civint-mcp-root";
            paths = [
              # Entrypoint
              (pkgs.writeScriptBin "civint-mcp-entrypoint" ''
                #!${pkgs.runtimeShell}
                exec ${pkgs.nodejs_22}/bin/node /app/packages/mcp-server/dist/index.js "$@"
              '')
              pkgs.nodejs_22
              pkgs.bash
              pkgs.coreutils
            ];
            pathsToLink = [ "/bin" ];
            ignoreCollisions = true;
          };

          config = {
            Entrypoint = [ "civint-mcp-entrypoint" ];
            WorkingDir = "/app";
            Env = [
              "HOME=/tmp"
              "PATH=/bin"
              "PORT=3002"
              "NODE_ENV=production"
            ];
            ExposedPorts = { "3002/tcp" = {}; };
            Labels = {
              "org.opencontainers.image.title" = "CivInt MCP Server";
              "org.opencontainers.image.description" = "Canadian sovereign data pipeline — committees, corporate, influence tracking";
              "org.opencontainers.image.source" = "https://github.com/reverb256/civint";
              "org.opencontainers.image.version" = "${self.shortRev or "dirty"}";
            };
          };
        };

      in {
        packages = {
          default = civint-mcp-image;
          civint-mcp-image = civint-mcp-image;
        };

        apps.default = {
          type = "app";
          program = "${pkgs.pnpm}/bin/pnpm";
          # Usage: nix run . -- --filter @civint/pipeline-core build
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
            typescript
            nodePackages_latest.typescript-language-server
          ];
        };
      }
    );
}
