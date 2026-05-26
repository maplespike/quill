{ config, lib, pkgs, ... }:
let
  cfg = config.services.maplespike;
  inherit (lib) mkEnableOption mkOption types;
in
{
  options.services.maplespike = {
    enable = mkEnableOption "MapleSpike — Canadian sovereign data pipeline";

    namespace = mkOption {
      type = types.str;
      default = "maplespike";
      description = "K8s namespace for dev deployment";
    };

    prodNamespace = mkOption {
      type = types.str;
      default = "maplespike-prod";
      description = "K8s namespace for prod deployment";
    };

    api = {
      port = mkOption {
        type = types.port;
        default = 8082;
        description = "API server port";
      };
      nodePort = mkOption {
        type = types.int;
        default = 31284;
        description = "Dev API NodePort";
      };
      prodNodePort = mkOption {
        type = types.int;
        default = 31283;
        description = "Prod API NodePort";
      };
      host = mkOption {
        type = types.str;
        default = "dev-api.maplespike.lan";
        description = "Dev API hostname";
      };
      prodHost = mkOption {
        type = types.str;
        default = "api.maplespike.lan";
        description = "Prod API hostname";
      };
    };

    mcp = {
      port = mkOption {
        type = types.port;
        default = 3001;
        description = "MCP server port";
      };
      nodePort = mkOption {
        type = types.int;
        default = 31746;
        description = "Dev MCP NodePort";
      };
      prodNodePort = mkOption {
        type = types.int;
        default = 31745;
        description = "Prod MCP NodePort";
      };
      host = mkOption {
        type = types.str;
        default = "dev-mcp.maplespike.lan";
        description = "Dev MCP hostname";
      };
      prodHost = mkOption {
        type = types.str;
        default = "mcp.maplespike.lan";
        description = "Prod MCP hostname";
      };
    };

    portal = {
      port = mkOption {
        type = types.port;
        default = 8080;
        description = "Portal port";
      };
      nodePort = mkOption {
        type = types.int;
        default = 30965;
        description = "Dev portal NodePort";
      };
      prodNodePort = mkOption {
        type = types.int;
        default = 30964;
        description = "Prod portal NodePort";
      };
      host = mkOption {
        type = types.str;
        default = "dev.maplespike.lan";
        description = "Dev portal hostname";
      };
      prodHost = mkOption {
        type = types.str;
        default = "maplespike.lan";
        description = "Prod portal hostname";
      };
    };
  };
}
