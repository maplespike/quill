{ config, lib, pkgs, ... }:
let
  cfg = config.services.maplespike;
  inherit (lib) mkEnableOption mkOption types mdDoc;

  # Generate the quadlet units from the same module self-host uses, but
  # pointed at the Nix-built images (localhost registry == the local store
  # image loaded into the system podman). On a NixOS host we drop the units
  # into /etc/containers/systemd/ so they are managed by systemd.
  units = import ./selfhost.nix {
    inherit pkgs;
    registry = "localhost";
    tag = "latest";
    domain = cfg.portal.host;
  };

  # systemd units derived from the quadlet .container files. On NixOS the
  # podman generator (podman-systemd) reads /etc/containers/systemd/*.container
  # and produces the real .service files at boot. We just install the files
  # and enable the generator.
  unitDir = "/etc/containers/systemd";
in
{
  options.services.maplespike = {
    enable = mkEnableOption "MapleSpike (Quill) self-hosted services on this NixOS host";

    namespace = mkOption {
      type = types.str;
      default = "maplespike";
      description = "K8s namespace for dev deployment (documentation only here).";
    };

    prodNamespace = mkOption {
      type = types.str;
      default = "quill-prod";
      description = "K8s namespace for prod deployment (documentation only here).";
    };

    api = {
      port = mkOption { type = types.port; default = 8082; description = "API server port"; };
      host = mkOption { type = types.str; default = "dev-api.maplespike.lan"; description = "Dev API hostname"; };
      prodHost = mkOption { type = types.str; default = "api.maplespike.lan"; description = "Prod API hostname"; };
    };

    mcp = {
      port = mkOption { type = types.port; default = 3001; description = "MCP server port"; };
      host = mkOption { type = types.str; default = "dev-mcp.maplespike.lan"; description = "Dev MCP hostname"; };
      prodHost = mkOption { type = types.str; default = "mcp.maplespike.lan"; description = "Prod MCP hostname"; };
    };

    portal = {
      port = mkOption { type = types.port; default = 8080; description = "Portal port"; };
      host = mkOption { type = types.str; default = "dev.maplespike.lan"; description = "Dev portal hostname"; };
      prodHost = mkOption { type = types.str; default = "maplespike.lan"; description = "Prod portal hostname"; };
    };
  };

  config = lib.mkIf cfg.enable {
    # Podman + the systemd generator are required to consume the quadlets.
    virtualisation.containers.enable = true;
    virtualisation.podman.enable = true;
    # The generator is auto-enabled by podman; ensure the unit dir exists.
    environment.etc = lib.mkMerge (map (f: {
      "containers/systemd/${baseNameOf f}".source = f;
    }) (lib.attrVals [ "out" ] [ units ]));

    # Install each generated unit file.
    system.activationScripts.maplespike-quadlets = lib.stringAfter [ "users" ] ''
      mkdir -p ${unitDir}
      for f in ${units}/*; do
        ln -sf "$f" ${unitDir}/$(basename "$f")
      done
    '';

    # Enable the generated services at boot.
    systemd.services = {
      quill-api = { wantedBy = [ "multi-user.target" ]; };
      quill-mcp = { wantedBy = [ "multi-user.target" ]; };
      quill-portal = { wantedBy = [ "multi-user.target" ]; };
    };
  };
}
