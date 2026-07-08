{ pkgs, ... }:

{
  # JavaScript/TypeScript with pnpm
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    pnpm = {
      enable = true;
      install.enable = false; # We run pnpm install manually
    };
  };
  languages.typescript.enable = true;

  # Python for the Python SDK (quill-sdk on PyPI)
  languages.python = {
    enable = true;
    package = pkgs.python3;
  };

  # Packages for native module builds and dev tooling
  packages = with pkgs; [
    # Build essentials for native Node modules (better-sqlite3)
    python3
    stdenv.cc.cc
    # Dev tools
    git jq curl
    # Container builds (podman preferred, docker fallback)
    podman
    docker-client
    # K8s tooling
    kubectl
    # Python packaging
    pyright
    # Cloudflare tooling (max-out the free tier)
    cloudflared         # Tunnel: expose localhost via *.trycloudflare.com
  ];

  # Environment variables for native module compilation
  env = {
    CC = "gcc";
    CXX = "g++";
    # Direnv-friendly
    DIRENV_LOG_FORMAT = "";
  };

  # Scripts for common tasks
  scripts = {
    dev.exec = "pnpm dev";
    build.exec = "pnpm build";
    test.exec = "pnpm test";
    lint.exec = "pnpm lint";
    typecheck.exec = "pnpm typecheck";
    generate.exec = "node packages/portal/scripts/generate-agents-json.mjs && node packages/portal/scripts/generate-pipeline-data.mjs";
    docker-build.exec = "bash scripts/build-images.sh";
    docker-push.exec = "bash scripts/build-images.sh --push";
    tunnel.exec = ''
      echo "Starting Cloudflare Tunnel to http://localhost:5173"
      echo "Press Ctrl+C to stop."
      cloudflared tunnel --url http://localhost:5173
    '';
    tunnel-api.exec = ''
      echo "Starting Cloudflare Tunnel to http://localhost:8788 (Cloudflare Workers)"
      cloudflared tunnel --url http://localhost:8787
    '';
    clean.exec = ''
      rm -rf node_modules packages/*/node_modules
      rm -rf dist packages/*/dist
      rm -f *.tsbuildinfo packages/*/*.tsbuildinfo
    '';
  };

  # Pre-commit hooks
  git-hooks.hooks = {
    check-merge-conflicts.enable = true;
    detect-private-keys.enable = true;
    trim-trailing-whitespace.enable = true;
    mixed-line-endings.enable = true;
  };

  # Shell greeting
  enterShell = ''
    echo ""
    echo "🍁 MapleSpike Development Environment"
    echo "======================================"
    echo ""
    echo "65 modules  |  113k lines TS  |  1,141 endpoints  |  22 MCP tools"
    echo ""
    echo "Available commands:"
    echo "  pnpm dev        - Start development server"
    echo "  pnpm build      - Build all packages"
    echo "  pnpm test       - Run tests"
    echo "  pnpm lint       - Lint code"
    echo "  pnpm typecheck  - Type check"
    echo "  generate        - Generate agents.json + pipeline-data.json"
    echo "  docker-build    - Build all 4 Docker images (podman/docker)"
    echo "  docker-push     - Build and push to GHCR"
    echo "  tunnel          - Expose localhost:5173 via Cloudflare Tunnel"
    echo "  tunnel-api      - Expose localhost:8787 (Workers dev)"
    echo ""
    echo "Quick links:"
    echo "  docs/compatibility.md  — External data standards"
    echo "  docs/ROADMAP.md        — Build roadmap"
    echo "  docs/GAP-ANALYSIS.md   — Coverage analysis"
    echo ""
  '';
}
