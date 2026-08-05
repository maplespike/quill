# Quill Secrets — SOPS + age

All secret values are encrypted with [SOPS](https://github.com/getsops/sops) +
[age](https://github.com/FiloSottile/age) and stored as `.yaml` files in this
directory. The `.yaml.example` files are the plaintext templates — copy them,
fill in real values, then encrypt.

## Architecture (hybrid namespace-split)

| File | Recipient key | Decrypted where | Consumed by |
|------|---------------|-----------------|-------------|
| `runtime.yaml` | nexus-prod | nexus host (sops-nix at boot) | K8s Secrets, api-server, quill-mcp |
| `build.yaml` | homelab-dev | dev workstations + CI | deploy.sh, GitHub Actions |
| `cloudflared.yaml` | both keys | both | cloudflared pod + deploy.sh |

See `.sops.yaml` at repo root for the creation_rules.

## First-time setup

### 1. Generate or obtain age keys

The homelab already has a key at `/etc/nixos/.age/key.txt`. The nexus-prod
key is at `/etc/nixos/.age/nexus-prod-key.txt` on the nexus host.

If you need to generate a new key:
```bash
age-keygen -o /path/to/key.txt
# The public key (age1...) goes into .sops.yaml. The private key file
# stays on the host that decrypts.
```

### 2. Create encrypted secret files

```bash
cd /home/j_kro/Projects/quill

# Copy templates
cp secrets/runtime.yaml.example secrets/runtime.yaml
cp secrets/build.yaml.example secrets/build.yaml
cp secrets/cloudflared.yaml.example secrets/cloudflared.yaml

# Fill in real values in each file...

# Encrypt (runtime → nexus-prod key)
SOPS_AGE_KEY_FILE=/etc/nixos/.age/nexus-prod-key.txt \
  sops --encrypt --in-place secrets/runtime.yaml

# Encrypt (build → homelab key)
SOPS_AGE_KEY_FILE=/etc/nixos/.age/key.txt \
  sops --encrypt --in-place secrets/build.yaml

# Encrypt (cloudflared → both keys; .sops.yaml handles recipients)
SOPS_AGE_KEY_FILE=/etc/nixos/.age/key.txt \
  sops --encrypt --in-place secrets/cloudflared.yaml
```

### 3. Decrypt for local dev

```bash
SOPS_AGE_KEY_FILE=/etc/nixos/.age/key.txt \
  sops -d secrets/build.yaml > /tmp/build-secrets.env
# Source it or export individual vars
```

### 4. Deploy to K3s

On the nexus host:
```bash
# One-shot: sync all secrets to K8s
QUILL_REPO=/home/j_kro/Projects/quill /home/j_kro/Projects/quill/scripts/sops-sync-k8s.sh

# Or rely on the systemd timer (every 5min) — it runs automatically.
```

### 5. Edit an existing encrypted secret

```bash
SOPS_AGE_KEY_FILE=/etc/nixos/.age/nexus-prod-key.txt \
  sops secrets/runtime.yaml
# Opens $EDITOR with decrypted values; re-encrypts on save.
```

## Key rotation

1. Generate new age keypair: `age-keygen -o /path/to/new-key.txt`
2. Add the new public key to `.sops.yaml` in the appropriate `age:` list.
3. Re-encrypt all files: `sops updatekeys secrets/*.yaml`
4. Remove the old key from `.sops.yaml`.
5. Re-encrypt again: `sops updatekeys secrets/*.yaml` (drops old recipient).
6. Distribute the new private key to the relevant hosts.

## What NOT to commit

- `secrets/runtime.yaml` (encrypted — safe to commit, but check it's encrypted!)
- `secrets/build.yaml` (same)
- `secrets/cloudflared.yaml` (same)
- Any `secrets/*.dec` or `secrets/decrypted/` files (plaintext — gitignored)
- Any `key.txt` / `*.age-key` files (private keys — never in repo)
- `.env` (plaintext env — gitignored)

The `.yaml.example` files ARE safe to commit — they contain placeholders only.
