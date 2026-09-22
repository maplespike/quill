# Quill Secrets — SOPS + age

Status: **working.** All four encrypted files in this directory decrypt with
`sops -d` on zephyr and on nexus (verified 2026-09-22).

Server-side secrets live here, encrypted with [sops](https://getsops.io) and
[age](https://age-encryption.org). The `*.yaml.example` files are plaintext
templates.

## Recipients

`.sops.yaml` holds one canonical recipient set for every file in this directory.
SOPS uses OR-semantics: any one identity decrypts.

| Alias | Recipient | Where the private key lives |
|-------|-----------|-----------------------------|
| `cluster_age` | `age1567g6raae4adh97lrfhalc9wwhmtsulh89k9pkx24m5ezfh8a4xqndrt6l` | zephyr `~/.config/sops/age/cluster-age-key.txt` (0600) |
| `zephyr_age_v2` | `age12k7ch5r9sczu42zc6eutxtl6leudn47uv5fvsjrlq5ms0f0hz9nshm3t7q` | same file as `cluster_age` (one file, two identities) |
| `homelab_dev` | `age1p98yp8w64rdugp03332gxnz5q2vcnucn69cs5qm6s2l2u7epqfcqmu2pqe` | zephyr `~/.age/key.txt` (0600) |
| `yubikey_nano` | `age1yubikey1qtrfqkheehc6dlyux9stwq67dq3kcledlwzzrckx0wk639mh0wqh54auh7v` | YubiKey 5 Nano, serial 11115841, slot 1 |
| `yubikey_nfc` | `age1yubikey1qvh5yeguawe89kr9muzn6xvfwjkcja7rf0j6afxgyula6p9vql4kkjh52h2` | YubiKey 5 NFC, serial 12251564, slot 2 |
| `offline_recovery` | `age1td0zl0eexvgssdz2yljjg3wxnm60m3wytatg4uf3fgmn4z29kevstmgl6j` | air-gapped break-glass; not stored on any host |

The set matches `reverb256/nixos-secrets/.sops.yaml`, so the fleet has one key
story. The YubiKeys are the host-independent backstop. `offline_recovery`
survives losing zephyr and both YubiKeys. Do not count six recipients as six
independent controls — `cluster_age`, `zephyr_age_v2` and `homelab_dev` all sit
in plaintext files on zephyr today.

## Decrypt

```bash
export SOPS_AGE_KEY_FILE=~/.age/key.txt           # or cluster-age-key.txt
cd <quill checkout>
sops -d secrets/runtime.yaml                      # whole file
sops -d --extract '["JWT_SECRET"]' secrets/runtime.yaml
sops -d --extract '["INTERNAL_JWT_SECRET"]' secrets/runtime.yaml
```

`sops` and `age` are in Arch `extra`: `sudo pacman -S --needed sops age`. Nexus
has `/usr/bin/sops` but not `age`; take `age`/`age-keygen` from the release
tarball at https://github.com/FiloSottile/age/releases when you need keygen.

## Edit a secret

Decrypt to a scratch path first. Never redirect a decrypt onto the encrypted
file — the shell truncates the target before sops reads it.

```bash
export SOPS_AGE_KEY_FILE=~/.age/key.txt
cp secrets/runtime.yaml /tmp/runtime.yaml.bak         # belt
sops -d secrets/runtime.yaml > /tmp/runtime.yaml
$EDITOR /tmp/runtime.yaml
cp /tmp/runtime.yaml secrets/runtime.yaml             # plaintext must sit at the matching repo path
sops --encrypt --in-place secrets/runtime.yaml        # re-encrypts to the rule recipients
sops -d secrets/runtime.yaml | grep -E '^[A-Z_]+:'   # check the round trip
rm -P /tmp/runtime.yaml /tmp/runtime.yaml.bak         # or shred -u
```

Two traps. A plaintext staged at `/tmp/<file>.yaml` matches no creation rule —
the rule regex is `secrets/.*\.yaml$` — so `sops --encrypt /tmp/...` fails.
`sops --decrypt file.yaml > file.yaml` zeroes the file.

Encryption to an `age1yubikey1…` recipient needs `age-plugin-yubikey` on the
**encrypting** host. The physical key is not needed. Run the encrypt step on
zephyr, or restrict edits to a host with the plugin.

## Rotate or change recipients

1. Add the new recipient to `age:` in `.sops.yaml`.
2. From a host with a working identity, re-wrap the data keys:
   `sops updatekeys secrets/runtime.yaml secrets/billing.yaml secrets/cloudflared.yaml secrets/build.yaml`
3. Remove the old recipient from `.sops.yaml` and run `updatekeys` again.
4. Distribute the new private key. Verify with `sops -d`.

## Sync to the cluster

`scripts/sops-sync-k8s.sh` decrypts and writes the `maplespike-secrets` and
`maplespike-stripe-secrets` K8s Secrets. It reads the identity from
`SOPS_AGE_KEY_FILE` (default `~/.age/key.txt`), so run it on a host that holds a
key.

For day-to-day changes, the live `quill-secrets` Secret is authoritative: add the
value there first, then mirror it into `runtime.yaml`. The 2026-09-22 recovery
showed that a key loss can strand the sops copy while the live Secret stays
correct.

**Do not regenerate these values casually.** They are load-bearing: JWT sessions,
PII hashes and billing records depend on them.

## Recovery history

- **2026-08-15** — the first `nexus-prod` key (`age1rx6cf98…`) was lost. The
  runtime values were regenerated from `/dev/urandom` and re-sealed. `QUILL_API_KEY`
  joined `runtime.yaml` in the same pass, because the MCP server had accepted the
  well-known default `dev-key` in production.
- **2026-09-22** — the second `nexus-prod` key
  (`age1fwmxsy0la3sp6d2txz4z8yqq2fwtu5yya6pkl4l2927m0x4csemqrrnnmd`) was missing
  too: `/etc/nixos/.age/nexus-prod-key.txt` died with the Omarchy migration, and
  no copy existed on any host. The recipient was dropped from every file and all
  four files were re-sealed to the canonical set above. The `homelab_dev`
  identity was re-discovered at zephyr `~/.age/key.txt` — the earlier hunt had
  checked only `~/.config/sops/age/keys.txt`, which holds `cluster_age` and
  `zephyr_age_v2`. The decrypted values matched the live `quill-secrets` K8s
  Secret, so nothing was regenerated this time. `INTERNAL_JWT_SECRET` was added
  to `runtime.yaml` in the same pass.

## What not to commit

- A private key, in any form. Ciphertext (`secrets/*.yaml`) is safe to commit.
- `*.dec`, `secrets/decrypted/` and plaintext scratch copies. Shred them.
- `.env` (plaintext env — gitignored).
