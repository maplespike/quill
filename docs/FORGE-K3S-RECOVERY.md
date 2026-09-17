# forge k3s Recovery Runbook — 2026-09-17

forge (10.1.1.130, Tailscale 100.126.31.20) flapped twice and is currently
booting back (ICMP answers, sshd not yet listening). This is the exact
procedure to restore it as the third etcd voter.

## Context (verified before writing this)

- forge is a k3s **server** (control-plane + etcd voter), node-args show it
  joins via `--server https://10.1.1.120:6443 --token-file /run/secrets/k3s-cluster-token`
- Its k3s is **v1.36.1+k3s1**; nexus/sentry run **v1.37.0+k3s1** (the
  system-upgrade plan `k3s-server` completed cluster-wide but forge missed it)
- The whole stack (quill-api/mcp/portal) is pinned to nexus; zombie pods from
  forge remain `Terminating` and will clear once its kubelet returns
- Cluster currently runs on nexus + sentry (2/3 quorum). **Do NOT power-cycle
  nexus or sentry during this procedure.**

## Step 1 — Preflight (once SSH answers)

```bash
ssh forge "uptime; df -h / /var/lib/rancher; free -m | head -2"
ssh forge "systemctl status k3s --no-pager -l | head -20"
ssh forge "sudo journalctl -u k3s -b --no-pager | tail -40"
ssh forge "ls -la /run/secrets/k3s-cluster-token /var/lib/rancher/k3s/server/token 2>&1"
```

Decision points:
- **Disk full** → clear docker build cache (`docker system prune -af`) and
  old journal logs before anything else.
- **k3s enabled + failed** → go to Step 2.
- **k3s not enabled at all** → `sudo systemctl enable --now k3s`, go to Step 2.
- **Token file missing** (`/run/secrets/...` is on tmpfs; the unit should
  recreate it — if not) → copy from nexus:
  `ssh nexus "sudo cat /var/lib/rancher/k3s/server/token" | ssh forge "sudo tee /var/lib/rancher/k3s/server/token"`

## Step 2 — Start k3s and watch the rejoin

```bash
ssh forge "sudo systemctl restart k3s"
ssh forge "sudo journalctl -u k3s -f --no-pager"   # watch for: joined cluster / etcd member re-added
```

Expected: k3s starts, contacts nexus:6443, etcd re-adds `forge-98da13e8` as a
voter (it may first re-add as learner then promote). Give it 2–5 minutes.

If etcd reports the member as already present but conflicting (common after
long absence), the safe sequence is:
1. On nexus: `sudo k3s etcd member list` — note forge's member ID
2. On nexus: `sudo k3s etcd member remove <forge-member-id>`
3. On forge: `sudo systemctl stop k3s && sudo rm -rf /var/lib/rancher/k3s/server/db && sudo systemctl start k3s`
   (safe: forge re-joins as a fresh member from the live quorum; its local db
   is stale by definition)

## Step 3 — Verify from the workstation

```bash
kubectl get nodes                       # forge: Ready
kubectl get node forge -o jsonpath='{.metadata.annotations.etcd\.k3s\.cattle\.io/node-name}{"\n"}'
kubectl -n kube-system get pod -o wide | grep -E "etcd|local-path"   # LPP may now have a forge replica again
kubectl get --raw='/readyz?verbose' | tail -3
```

Also confirm 3/3: `ssh nexus "sudo k3s etcd member list | wc -l"` → 3 voting members.

## Step 4 — Post-recovery cleanup

1. Zombie pods on forge (Terminating for hours) should finalize automatically
   once the kubelet is back; if any linger >2 min:
   `kubectl -n maplespike delete pod <name> --force --grace-period=0`
2. Quill workloads stay pinned to nexus (values-prod) — do not move them back
   until forge proves stable for a full day.
3. Version skew: forge will likely be picked up by the system-upgrade plan to
   v1.37.0. Let it run; do NOT manually upgrade mid-rejoin.
4. Once 3/3 quorum is healthy for a day: consider uncordoning forge for
   workload capacity and re-importing the quill images there if it should ever
   serve as failover (`docker save | k3s ctr images import` per the doctrine).

## Last-resort (only if quorum itself is broken)

If the remaining cluster cannot serve (it currently can — do not use this now):
restore nexus from the newest etcd snapshot per k3s docs
(`k3s server --cluster-reset` with `--cluster-reset-restore-path`), using the
snapshots already present under `/var/lib/rancher/k3s/server/db/snapshots/`.
Never run `--cluster-reset` on more than one node.

---

## Attempt log — 2026-09-17 (blocked: no userspace on forge)

The runbook could not be executed remotely. Symptom progression while polling
for ~10 minutes:

- `No route to host` → `Connection refused` on :22 (host NIC + kernel are up,
  TCP RST coming back — the machine is booting or half-up)
- ICMP answers continuously; **no TCP port** of 13 common ones (22, 80, 443,
  8006, 8080, 9090, 10250, …) ever opens, on LAN or Tailscale
- Never recovers to a working sshd; intermittent full timeouts suggest the
  boot is retried/stuck (fsck on the large docker store or systemd failure)

Conclusion: forge boots to kernel but systemd never reaches
`multi-user.target` (no sshd, no tailscaled). **Physical/console access is
required** — watch the boot, complete any fsck, and check `systemctl`
/boot logs. Once sshd answers, execute Steps 1–4 above exactly as written.

While blocked, the cluster remains safely degraded on nexus + sentry (2/3
etcd voters). The moment forge comes back it should rejoin via Step 2; if it
presents a conflicting member, use the member-remove + clean-db sequence.
