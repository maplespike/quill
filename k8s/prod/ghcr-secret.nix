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
      path = [pkgs.kubectl pkgs.coreutils pkgs.jq pkgs.age];
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

        # Decrypt vault with age key from agenix
        AGE_KEY=$(cat /run/agenix/age-key 2>/dev/null || echo "")
        if [ -z "$AGE_KEY" ]; then
          echo "[maplespike-ghcr-secret] ERROR: Age key not found at /run/agenix/age-key"
          exit 1
        fi

        VAULT="/var/lib/maplespike/.secrets/vault.age"
        if [ ! -f "$VAULT" ]; then
          echo "[maplespike-ghcr-secret] ERROR: Vault not found at $VAULT"
          exit 1
        fi

        GITHUB_TOKEN=$(echo "$AGE_KEY" | age --decrypt -i - "$VAULT" 2>/dev/null | jq -r '.ghcr.pat_token')

        if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "null" ]; then
          echo "[maplespike-ghcr-secret] ERROR: ghcr.pat_token not found in vault"
          exit 1
        fi

        # Check if secret already exists
        if kubectl get secret ${cfg.secretName} -n ${cfg.namespace} &>/dev/null; then
          # Update existing secret
          kubectl delete secret ${cfg.secretName} -n ${cfg.namespace} --ignore-not-found
        fi

        # Create docker registry secret
        kubectl create secret docker-registry ${cfg.secretName} \
          -n ${cfg.namespace} \
          --docker-server=ghcr.io \
          --docker-username=reverb256 \
          --docker-password="$GITHUB_TOKEN" \
          --docker-email=reverb256@users.noreply.github.com

        echo "[maplespike-ghcr-secret] Created/updated secret ${cfg.secretName} in ${cfg.namespace}"
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
      path = [pkgs.kubectl pkgs.coreutils pkgs.jq pkgs.age];
      script = ''
        set -euo pipefail

        AGE_KEY=$(cat /run/agenix/age-key 2>/dev/null || echo "")
        if [ -z "$AGE_KEY" ]; then
          echo "[maplespike-ghcr-secret-sync] Age key not found, skipping sync"
          exit 0
        fi

        VAULT="/var/lib/maplespike/.secrets/vault.age"
        if [ ! -f "$VAULT" ]; then
          echo "[maplespike-ghcr-secret-sync] Vault not found, skipping sync"
          exit 0
        fi

        GITHUB_TOKEN=$(echo "$AGE_KEY" | age --decrypt -i - "$VAULT" 2>/dev/null | jq -r '.ghcr.pat_token')

        if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "null" ]; then
          echo "[maplespike-ghcr-secret-sync] ghcr.pat_token not found in vault, skipping sync"
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
