let
  # age public keys that can decrypt these secrets
  users = [
    # j_kro — local dev machine (derived from ~/.ssh/id_ed25519)
    "age100fwr7ddswy52gfagnumwm0lpc0ma95jwxugstxh66y5jzml63tsdu2e2k"
  ];
in {
  "github-pat.age".publicKeys = users;

  # Stripe keys live in secrets/billing.yaml (R3 ownership, #825) and are
  # synced into the k8s Secret `maplespike-stripe-secrets` (lower case keys).
  # See k8s/maplespike/README.md for the full secret contract.
  #
  # Placeholder definitions only: the operator must supply real ciphertext with
  # `sops -e --in-place secrets/<name>.age` (or seed via `sops secrets/<name>.age`).
  # DO NOT commit real Stripe keys.
  "stripe-secret-key.age".publicKeys = users;      # STRIPE_SECRET_KEY (sk_test_… / sk_live_…)
  "stripe-webhook-secret.age".publicKeys = users;  # STRIPE_WEBHOOK_SECRET (whsec_…)
  "quill-billing-secret.age".publicKeys = users;   # QUILL_BILLING_SECRET (reconcile-expiry auth)
}
