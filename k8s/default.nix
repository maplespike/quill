# MapleSpike K8s Manifests — easykubenix entry point
#
# Called from flake.nix as:
#   easykubenixLib.easykubenix { inherit pkgs; modules = [ ... ]; }
#
# This file just re-exports the module list for flake.nix consumption.
# The actual easykubenix invocation happens in flake.nix so the input
# is properly pinned via flakes.
{
  imports = [
    ./cron.nix
    ./dev.nix
    ./prod.nix
    ./infra.nix
  ];
}
