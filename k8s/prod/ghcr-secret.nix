# MapleSpike GHCR Image Pull Secret Configuration
# This module creates the ghcr-pull secret for pulling container images from GHCR
# The secret is populated from the GitHub CLI token stored in agenix
{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.maplespike-ghcr-secret;
in {
  options.services.maplespike-ghcr-secret = {
    enable = lib.mkEnableOption "MapleSpike GHCR image pull secret";

    namespace = lib.mkOption {
      type = lib.types.str;
      default = "maplespike-prod";
      description = "Kubernetes namespace for the secret";
    };

    secretName = lib.mkOption {
      type = lib.types.str;
      default = "ghcr-pull";
      description = "Name of the Kubernetes secret";
    };
  };

  config = lib.mkIf cfg.enable {
    # Create systemd service to bootstrap the GHCR pull secret
    systemd.services.maplespike-ghcr-secret = {
      description = "Bootstrap MapleSpike GHCR image pull secret";
      after = ["k3s.service"];
      requires = ["k3s.service"];
      before = ["k8s-nix-deploy.service"];
      wantedBy = ["multi-user.target"];
      serviceConfig = {
        Type = "oneshot";
        Environment = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml";
        RemainAfterExit = true;
      };
      path = [pkgs.kubectl pkgs.coreutils];
      script = ''
        set -euo pipefail

        echo "[maplespike-ghcr-secret] Waiting for K8s API..."
        elapsed=0
        until kubectl get nodes &>/dev/null; do
          sleep 5
          elapsed=$((elapsed + 5))
          if [ $elapsed -ge 120 ]; then
            echo "[maplespike-ghcr-secret] Timed out waiting for K8s API"
            exit 1
          fi
        done

        # Check if secret already exists
        if kubectl get secret ${cfg.secretName} -n ${cfg.namespace} &>/dev/null; then
          echo "[maplespike-ghcr-secret] Secret ${cfg.secretName} already exists in ${cfg.namespace}"
        else
          echo "[maplespike-ghcr-secret] Creating GHCR pull secret..."

          # Get GitHub token from agenix secret
          GITHUB_TOKEN=$(cat /run/agenix/github-token 2>/dev/null || echo "")

          if [ -z "$GITHUB_TOKEN" ]; then
            echo "[maplespike-ghcr-secret] ERROR: Could not read GitHub token from agenix"
            exit 1
          fi

          # Create docker registry secret
          kubectl create secret docker-registry ${cfg.secretName} \
            -n ${cfg.namespace} \
            --docker-server=ghcr.io \
            --docker-username=reverb256 \
            --docker-password="$GITHUB_TOKEN" \
            --docker-email=reverb256@users.noreply.github.com

          echo "[maplespike-ghcr-secret] Created secret ${cfg.secretName} in ${cfg.namespace}"
        fi

        echo "[maplespike-ghcr-secret] Done."
      '';
    };

    # Ensure secret is updated if GitHub token rotates
    systemd.timers.maplespike-ghcr-secret-sync = {
      description = "Sync MapleSpike GHCR secret daily";
      wantedBy = ["timers.target"];
      timerConfig = {
        OnCalendar = "daily";
        Persistent = true;
      };
    };

    systemd.services.maplespike-ghcr-secret-sync = {
      description = "Sync MapleSpike GHCR image pull secret";
      after = ["k3s.service" "maplespike-ghcr-secret.service"];
      requires = ["k3s.service"];
      serviceConfig = {
        Type = "oneshot";
        Environment = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml";
      };
      path = [pkgs.kubectl pkgs.coreutils pkgs.base64];
      script = ''
        set -euo pipefail

        # Get current token from agenix
        GITHUB_TOKEN=$(cat /run/agenix/github-token 2>/dev/null || echo "")

        if [ -z "$GITHUB_TOKEN" ]; then
          echo "[maplespike-ghcr-secret-sync] Could not read GitHub token, skipping sync"
          exit 0
        fi

        # Delete and recreate secret with new token
        kubectl delete secret ${cfg.secretName} -n ${cfg.namespace} --ignore-not-found
        kubectl create secret docker-registry ${cfg.secretName} \
          -n ${cfg.namespace} \
          --docker-server=ghcr.io \
          --docker-username=reverb256 \
          --docker-password="$GITHUB_TOKEN" \
          --docker-email=reverb256@users.noreply.github.com

        echo "[maplespike-ghcr-secret-sync] Synced secret ${cfg.secretName}"
      '';
    };
  };
}
