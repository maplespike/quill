# NixOS sops-nix module — Quill runtime secrets
#
# This module is imported by the nexus host's configuration.nix (in the
# nixos-config repo, NOT this repo). It wires sops-nix to decrypt
# quill/secrets/runtime.yaml + cloudflared.yaml at boot using the
# nexus-prod age key.
#
# Usage in nixos-config:
#   imports = [
#     (builtins.fetchGit {
#       url = "https://github.com/reverb256/quill";
#       sparseCheckout = [ "nix/sops-nix-module.nix" ];
#       rev = "<pin-a-specific-commit>";
#     } + "/nix/sops-nix-module.nix")
#   ];
#
# Or copy this file into /etc/nixos/modules/quill-sops.nix and import it.
#
# Requirements on the nexus host:
#   /etc/nixos/.age/nexus-prod-key.txt  ← private age key for runtime secrets
#   quill repo checked out at /opt/quill (or adjust sopsFile paths below)

{ config, lib, pkgs, ... }:

let
  cfg = config.services.quill-sops;
in
{
  options.services.quill-sops = {
    enable = lib.mkEnableOption "Quill sops-nix secret decryption";

    repoPath = lib.mkOption {
      type = lib.types.path;
      default = /opt/quill;
      description = "Path to the quill repo checkout on this host.";
    };

    ageKeyFile = lib.mkOption {
      type = lib.types.path;
      default = /etc/nixos/.age/nexus-prod-key.txt;
      description = "Path to the nexus-prod age private key.";
    };
  };

  config = lib.mkIf cfg.enable {
    # sops-nix: decrypt secrets at boot
    sops.defaultSopsFile = "${cfg.repoPath}/secrets/runtime.yaml";
    sops.age.keyFile = cfg.ageKeyFile;
    sops.age.generateKey = false;

    # Runtime secrets → /run/secrets/quill/* (tmpfs, wiped on reboot)
    sops.secrets = {
      JWT_SECRET          = { owner = "root"; group = "k3s"; mode = "0440"; };
      QUILL_BILLING_SECRET = { owner = "root"; group = "k3s"; mode = "0440"; };
      POSTGRES_PASSWORD   = { owner = "postgres"; group = "postgres"; mode = "0440"; };
      QUILL_GATEWAY_API_KEY = { owner = "root"; group = "k3s"; mode = "0440"; };
      ASTRAL_KEY_URL      = { owner = "root"; group = "k3s"; mode = "0440"; };
      MAPLESPIKE_BILLING_EMAIL = { owner = "root"; group = "k3s"; mode = "0440"; };
    };

    # Cloudflared tunnel credentials → separate sopsFile (multi-recipient)
    sops.secrets.TUNNEL_TOKEN = {
      sopsFile = "${cfg.repoPath}/secrets/cloudflared.yaml";
      owner = "cloudflared";
      group = "cloudflared";
      mode = "0440";
    };

    # Systemd timer for syncing decrypted secrets to K8s Secret resources
    systemd.services.quill-sops-sync = {
      description = "Sync sops-decrypted Quill secrets to K8s";
      after = [ "sops-nix.service" ];
      wants = [ "sops-nix.service" ];
      serviceConfig = {
        Type = "oneshot";
        ExecStart = "${cfg.repoPath}/scripts/sops-sync-k8s.sh";
        Environment = [
          "KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
          "SOPS_AGE_KEY_FILE=${toString cfg.ageKeyFile}"
          "QUILL_REPO=${toString cfg.repoPath}"
        ];
      };
    };

    systemd.timers.quill-sops-sync = {
      description = "Periodic sync of Quill secrets to K8s";
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnBootSec = "30s";
        OnUnitActiveSec = "5min";
        Unit = "quill-sops-sync.service";
      };
    };
  };
}
