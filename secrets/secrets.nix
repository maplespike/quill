let
  # age public keys that can decrypt these secrets
  users = [
    # j_kro — local dev machine (derived from ~/.ssh/id_ed25519)
    "age100fwr7ddswy52gfagnumwm0lpc0ma95jwxugstxh66y5jzml63tsdu2e2k"
  ];
in {
  "github-pat.age".publicKeys = users;
}
