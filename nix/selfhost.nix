# Self-host units — generated Podman Quadlet files for one-touch bring-up.
#
# Produces a derivation containing three <svc>.container units
# (quill-api / quill-mcp / quill-portal) wired on a shared podman network,
# plus an optional .volume for API data. Copy these into
#   ~/.config/containers/systemd/user/   (rootless)
# or
#   /etc/containers/systemd/             (system)
# then `systemctl [--user] daemon-reload && systemctl [--user] start quill-*`.
#
# `./selfhost.sh up` (or `nix run .#selfhost up`) does exactly that.
{ pkgs, registry, tag, domain, apiImage ? "quill-api", mcpImage ? "quill-mcp", portalImage ? "quill-portal" }:
let
  apiRef = "${registry}/${apiImage}:${tag}";
  mcpRef = "${registry}/${mcpImage}:${tag}";
  portalRef = "${registry}/${portalImage}:${tag}";

  # Shared network name used by all three containers
  net = "quill-net";

  apiContainer = pkgs.writeText "quill-api.container" ''
    [Unit]
    Description=Quill API server
    After=network-online.target
    Wants=network-online.target

    [Container]
    Image=${apiRef}
    ContainerName=quill-api
    Environment=PORT=8082
    Environment=NODE_ENV=production
    Environment=QUILL_STORAGE=sqlite
    Environment=QUILL_DB_PATH=/data/maplespike.db
    Volume=quill-api-data:/data
    Network=${net}
    PublishPort=8082:8082

    [Service]
    Restart=on-failure

    [Install]
    WantedBy=default.target
  '';

  mcpContainer = pkgs.writeText "quill-mcp.container" ''
    [Unit]
    Description=Quill MCP server (data-layer tools)
    After=network-online.target quill-api.service
    Wants=network-online.target

    [Container]
    Image=${mcpRef}
    ContainerName=quill-mcp
    Environment=PORT=3001
    Environment=NODE_ENV=production
    Environment=QUILL_API_URL=http://quill-api:8082/v1
    Network=${net}
    PublishPort=3001:3001

    [Service]
    Restart=on-failure

    [Install]
    WantedBy=default.target
  '';

  portalContainer = pkgs.writeText "quill-portal.container" ''
    [Unit]
    Description=Quill Portal (static site + server.py)
    After=network-online.target quill-api.service
    Wants=network-online.target

    [Container]
    Image=${portalRef}
    ContainerName=quill-portal
    Environment=PORT=8080
    Environment=NODE_ENV=production
    Environment=PUBLIC_API_BASE=http://quill-api:8082/v1
    Network=${net}
    PublishPort=8080:8080

    [Service]
    Restart=on-failure

    [Install]
    WantedBy=default.target
  '';

  apiVolume = pkgs.writeText "quill-api-data.volume" ''
    [Volume]
    VolumeName=quill-api-data
    Driver=local
  '';

  network = pkgs.writeText "quill-net.network" ''
    [Network]
    NetworkName=${net}
    Driver=bridge
  '';

  # Aggregate into a single derivation (a directory of unit files)
  units = pkgs.runCommand "quill-selfhost-units" { } ''
    mkdir -p $out
    cp ${apiContainer}  $out/quill-api.container
    cp ${mcpContainer}  $out/quill-mcp.container
    cp ${portalContainer} $out/quill-portal.container
    cp ${apiVolume}    $out/quill-api-data.volume
    cp ${network}      $out/quill-net.network
  '';
in
units
