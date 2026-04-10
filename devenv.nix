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

  # Packages for native module builds (better-sqlite3)
  packages = with pkgs; [
    # Build essentials for native Node modules
    python3
    stdenv.cc.cc
    # Useful dev tools
    git
    jq
    curl
  ];

  # Environment variables for native module compilation
  env = {
    # Make node-gyp able to find the compiler
    CC = "gcc";
    CXX = "g++";
  };

  # Scripts for common tasks
  scripts = {
    dev.exec = "pnpm dev";
    build.exec = "pnpm build";
    test.exec = "pnpm test";
    lint.exec = "pnpm lint";
    typecheck.exec = "pnpm typecheck";
    clean.exec = ''
      rm -rf node_modules packages/*/node_modules
      rm -rf .next packages/*/.next
      rm -rf dist packages/*/dist
      rm -f *.tsbuildinfo packages/*/*.tsbuildinfo
    '';
  };

  # Pre-commit hooks (using simple ones that work without project deps)
  git-hooks.hooks = {
    check-merge-conflicts.enable = true;
    detect-private-keys.enable = true;
    trim-trailing-whitespace.enable = true;
    mixed-line-endings.enable = true;
  };

  # Shell greeting
  enterShell = ''
    echo ""
    echo "🏛️  CivicIntel Development Environment"
    echo "====================================="
    echo ""
    echo "Available commands:"
    echo "  pnpm dev       - Start development server"
    echo "  pnpm build     - Build all packages"
    echo "  pnpm test      - Run tests"
    echo "  pnpm lint      - Lint code"
    echo "  pnpm typecheck - Type check"
    echo ""
    echo "Shortcuts (devenv scripts):"
    echo "  dev, build, test, lint, typecheck, clean"
    echo ""
  '';
}
