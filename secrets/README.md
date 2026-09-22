# Quill Secrets — SOPS + age

Server-side secrets live here, encrypted with [sops](https://getsops.io) and
[age](https://age-encryption.org). The `*.yaml.example` files are plaintext
templates.

Status 2026-09-22: **working.** `secrets/runtime.yaml` round-trips with the cluster
key on zephyr. It was re-sealed in `47e9f0c` after the recipient it used to carry
turned out to be dead.

## Recipients

`.sops.yaml` seals every file in this directory to three recipients. SOPS uses
OR-semantics: any one identity decrypts.

| Alias | Recipient | Where the private key lives |
|-------|-----------|-----------------------------|
| `cluster_age` | `age1567g6raae4adh97lrfhalc9wwhmtsulh89k9pkx24m5ezfh8a4xqndrt6l` | zephyr `~/.config/sops/age/cluster-age-key.txt` (0600) |
| `zephyr_age_v2` | `age12k7ch5r9sczu42zc6eutxtl6leudn47uv5fvsjrlq5ms0f0hz9nshm3t7q` | same file as `cluster_age` (one file, two identities) |
| `yubikey_nano` | `age1yubikey1qtrfqkheehc6dlyux9stwq67dq3kcledlwzzrckx0wk639mh0wqh54auh7v` | YubiKey 5 Nano, serial 11115841, slot 1 |

The Nano is the host-independent backstop. It needs `pcscd.socket` running and the
plugin identity stub in `~/.config/sops/age/keys.txt`; touch policy is cached.

Three more keys exist in the fleet (`reverb256/nixos-secrets/.sops.yaml`) and can
be added with one `updatekeys` run:

| Alias | Recipient | Where it lives |
|-------|-----------|----------------|
| `yubikey_nfc` | `age1yubikey1qvh5yeguawe89kr9muzn6xvfwjkcja7rf0j6afxgyula6p9vql4kkjh52h2` | YubiKey 5 NFC, serial 12251564, slot 2 |
| `offline_recovery` | `age1td0zl0eexvgssdz2yljjg3wxnm60m3wytatg4uf3fgmn4z29kevstmgl6j` | air-gapped break-glass, on no host |
| `homelab_dev` | `age1p98yp8w64rdugp03332gxnz5q2vcnucn69cs5qm6s2l2u7epqfcqmu2pqe` | zephyr `~/.age/key.txt` (0600) |

`homelab_dev` is **not** lost. It was listed as dead in an earlier doc; it is alive
at `zephyr:~/.age/key.txt` and still decrypts every commit up to `961a5e1`. Use it to
read pre-rebuild history, not for new writes.

`cluster_age` and `zephyr_age_v2` sit in a plaintext file on zephyr, so zephyr is
still a single point of failure for decryption. Nothing in this repo changes that.

## Decrypt

```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt
cd <quill checkout>
sops -d secrets/runtime.yaml                      # whole file
sops -d --extract '["JWT_SECRET"]' secrets/runtime.yaml
sops -d --extract '["INTERNAL_JWT_SECRET"]' secrets/runtime.yaml
```

`sops` and `age` are in Arch `extra`: `sudo pacman -S --needed sops age`. Nexus has
`/usr/bin/sops` but not `age`; take `age`/`age-keygen` from
https://github.com/FiloSottile/age/releases when you need keygen.

## Edit a secret

Decrypt to a scratch path first. Never redirect a decrypt onto the encrypted file —
the shell truncates the target before sops reads it.

```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt
cp secrets/runtime.yaml /tmp/runtime.yaml.bak         # belt
sops -d secrets/runtime.yaml > /tmp/runtime.yaml
$EDITOR /tmp/runtime.yaml
cp /tmp/runtime.yaml secrets/runtime.yaml             # plaintext must sit at the matching repo path
sops --encrypt --in-place secrets/runtime.yaml        # re-encrypts to the rule recipients
sops -d secrets/runtime.yaml | grep -E '^[A-Z_]+:'   # check the round trip
rm -P /tmp/runtime.yaml /tmp/runtime.yaml.bak         # or shred -u
```

Two traps. A plaintext staged at `/tmp/<file>.yaml` matches no creation rule — the
rule regex is `secrets/.*\.yaml$` — so `sops --encrypt /tmp/...` fails.
`sops --decrypt file.yaml > file.yaml` zeroes the file.

Encryption to an `age1yubikey1…` recipient needs `age-plugin-yubikey` on the
**encrypting** host. The physical key is not needed. Run the encrypt step on zephyr,
or restrict edits to a host with the plugin.

## Rotate or change recipients

1. Add the new recipient to `age:` in `.sops.yaml`.
2. From a host with a working identity, re-wrap the data keys:
   `sops updatekeys secrets/runtime.yaml`
3. Remove the old recipient from `.sops.yaml` and run `updatekeys` again.
4. Distribute the new private key. Verify with `sops -d`.

## Sync to the cluster

`scripts/sops-sync-k8s.sh` decrypts and writes the `maplespike-secrets` and
`maplespike-stripe-secrets` K8s Secrets. It reads the identity from
`SOPS_AGE_KEY_FILE` (default `~/.age/key.txt`), so run it on a host that holds a key.

The live K8s Secrets are the delivery path for the running pods: the chart mounts
`quill-secrets` (`jwtSecret`, `apiKey`, `githubClientId`, `githubClientSecret`,
`internalJwtSecret`) and `maplespike-secrets` through `secretKeyRef`. The chart
deliberately does not render `quill-secrets` — it is operator-managed. For
day-to-day changes, set the live Secret first, then mirror it into `runtime.yaml`.

Do not regenerate these values casually. They are load-bearing: JWT sessions, PII
hashes and billing records depend on them.

## Recovery history

- **2026-08-15** — the first `nexus-prod` key (`age1rx6cf98…`) was lost. The runtime
  values were regenerated from `/dev/urandom` and re-sealed. `QUILL_API_KEY` joined
  `runtime.yaml` in the same pass, because the MCP server had accepted the
  well-known default `dev-key` in production.
- **2026-09-22** — the second `nexus-prod` key (`age1fwmxsy0…`) was dead too: its
  private half went to `/etc/nixos/.age/nexus-prod-key.txt`, `/etc/nixos` died with
  the Omarchy migration, and no copy exists on any host. `47e9f0c` rebuilt
  `secrets/runtime.yaml` from the live cluster Secrets and re-sealed it to the three
  recipients above. `INTERNAL_JWT_SECRET` was added in the same commit; it matches
  `quill-secrets/internalJwtSecret`.

  Independent check of `47e9f0c` (same day): `runtime.yaml` decrypts with
  `zephyr:~/.config/sops/age/cluster-age-key.txt`; the five values carried over from
  the live Secret match it key for key; `961a5e1:secrets/runtime.yaml` — the
  pre-rebuild file — still decrypts with `zephyr:~/.age/key.txt`. `ASTRAL_KEY_URL`
  and `MAPLESPIKE_BILLING_EMAIL` were dropped from the rebuild; both remain
  recoverable from history via that identity.

## Open items (not fixed here)

- The live `maplespike-secrets/quill-billing-secret` equals `quill-secrets/apiKey`;
  `runtime.yaml` now mirrors that. The pre-rebuild sops file held a distinct
  `QUILL_BILLING_SECRET`. Billing HMAC and API-key rotation are therefore coupled.
- Live `quill-db-secret` holds the same 10-character value for
  `postgres-user`, `postgres-password` and `postgres-database`. The running api uses
  sqlite (`QUILL_STORAGE=sqlite`), so nothing consumes it today, but the secret
  should be rotated before any Postgres cutover.

## What not to commit

- A private key, in any form. Ciphertext (`secrets/*.yaml`) is safe to commit.
- `*.dec`, `secrets/decrypted/` and plaintext scratch copies. Shred them.
- `.env` (plaintext env — gitignored).
