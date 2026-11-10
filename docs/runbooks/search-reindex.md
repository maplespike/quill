---
last-reviewed: 2026-11-10
status: active
---

# Rebuild the search index

`quill-search serve` does not listen when the index directory is missing, when `quill-meta.json` is missing, or when the sidecar reports fewer than 31 docs. Thirty docs is the sample corpus `rust/fixtures/sample.jsonl`. That size is not a production index. `/health` stays down until a real index is in place. The backup job `quill-backup-search` also exits until `quill-meta.json` is inside the index directory it reads.

The search claim is `quill-search-data`. The process opens `/data/index` on that claim. The backup opens the same directory at `/search/index`. Both paths are the `index/` subdirectory. They are not the claim root.

## Check the claim before you rebuild

Scale the search deployment to 0 so the volume can attach to a one-off pod. The claim is ReadWriteOnce. Wait until the search pod is gone.

```bash
kubectl -n maplespike scale deploy/quill-search --replicas=0
kubectl -n maplespike wait --for=delete pod -l app=quill-search --timeout=180s
```

Start a pod that mounts the claim at `/data` and uses the search image. Keep it on `nexus` or `sentry`. Those are the hosts that can attach this claim. A pod on `forge` stays Pending.

```bash
IMAGE=$(kubectl -n maplespike get deploy quill-search -o jsonpath='{.spec.template.spec.containers[0].image}')
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: quill-search-reindex
  namespace: maplespike
spec:
  restartPolicy: Never
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/hostname
            operator: In
            values: ["nexus", "sentry"]
  containers:
  - name: reindex
    image: ${IMAGE}
    imagePullPolicy: IfNotPresent
    command: ["sleep", "3600"]
    securityContext:
      runAsNonRoot: true
      runAsUser: 1001
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: index
      mountPath: /data
  volumes:
  - name: index
    persistentVolumeClaim:
      claimName: quill-search-data
EOF
kubectl -n maplespike wait --for=condition=Ready pod/quill-search-reindex --timeout=180s
kubectl -n maplespike exec quill-search-reindex -- \
  ls -la /data/quill-meta.json /data/index/quill-meta.json
```

Read both sidecars when they exist:

```bash
kubectl -n maplespike exec quill-search-reindex -- cat /data/quill-meta.json
kubectl -n maplespike exec quill-search-reindex -- cat /data/index/quill-meta.json
```

Use the file whose `docs` value is greater than 30.

### The real sidecar is on the claim root

This is the old layout. The volume was mounted at `/data/index`, so the index files were written at the claim root. Serve and the backup now open the `index/` subdirectory. Move the root files into that subdirectory. Do not `mv /data/* /data/index/` while `index` is still inside `/data`.

```bash
kubectl -n maplespike exec quill-search-reindex -- sh -c '
  set -eu
  mkdir -p /data/recovered-index
  find /data -maxdepth 1 -type f -exec mv {} /data/recovered-index/ \;
  if [ -d /data/index ]; then
    mv /data/index /data/index-before-recover
  fi
  mv /data/recovered-index /data/index
  test -f /data/index/quill-meta.json
  cat /data/index/quill-meta.json
'
```

Confirm `docs` is greater than 30. Then delete the helper pod and scale search back to 1. Skip the export below.

```bash
kubectl -n maplespike delete pod quill-search-reindex --wait=true
kubectl -n maplespike scale deploy/quill-search --replicas=1
kubectl -n maplespike rollout status deploy/quill-search --timeout=180s
```

Check the log for `index at /data/index is ready` and a doc count above 30. From the API pod:

```bash
kubectl -n maplespike exec deploy/quill-api -- \
  node --input-type=module -e 'const r = await fetch("http://quill-search:8083/health"); console.log(await r.text())'
```

The `docs` value must match `quill-meta.json`.

### The subdirectory is missing, has no sidecar, or reports 30 docs

Rebuild from the API database. Keep the helper pod. It already mounts the claim.

## Export the corpus

Take a consistent copy of the API database. Do not copy the live file with `cat` while writers are open.

```bash
API_POD=$(kubectl -n maplespike get pod -l app=quill-api -o jsonpath='{.items[0].metadata.name}')
kubectl -n maplespike exec "$API_POD" -- \
  node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync("/data/quill/maplespike.db", { readOnly: true }); db.exec("VACUUM INTO '\''/tmp/maplespike-snapshot.db'\''");'
kubectl -n maplespike cp "$API_POD:/tmp/maplespike-snapshot.db" /tmp/maplespike-snapshot.db
kubectl -n maplespike exec "$API_POD" -- rm -f /tmp/maplespike-snapshot.db
```

On a checkout of this repo, with dependencies installed:

```bash
QUILL_DB_PATH=/tmp/maplespike-snapshot.db pnpm exec tsx scripts/export-search-corpus.mts --out /tmp/corpus.jsonl
```

The export prints the doc count on stderr. The count must be greater than 30. The module registry alone is already larger than the sample corpus. `rm /tmp/maplespike-snapshot.db` when you are done with it.

## Build the index on the claim

```bash
kubectl -n maplespike cp /tmp/corpus.jsonl quill-search-reindex:/tmp/corpus.jsonl
kubectl -n maplespike exec quill-search-reindex -- \
  quill-search index --corpus /tmp/corpus.jsonl --out /data/index
kubectl -n maplespike exec quill-search-reindex -- cat /data/index/quill-meta.json
```

The index command prints `wrote quill-meta.json`. The sidecar `docs` value must match the export and must be greater than 30. If `/data/index` already holds the sample index, the `index` command fails because the directory is not empty. Move it aside first:

```bash
kubectl -n maplespike exec quill-search-reindex -- \
  mv /data/index /data/index-sample-backup
```

Then run the index command again. `--out` creates the directory.

Remove the helper and start search:

```bash
kubectl -n maplespike delete pod quill-search-reindex --wait=true
kubectl -n maplespike scale deploy/quill-search --replicas=1
kubectl -n maplespike rollout status deploy/quill-search --timeout=180s
```

`/health` must report the same `docs` value as the sidecar. A count of 30 means the sample corpus is still what serve opened. Do not treat the pod as Ready in that case. The new process exits before it listens.

## Optional: rebuild on the next start

Put the corpus on a path the search container can read. Set `QUILL_SEARCH_CORPUS` to that file, or pass `--corpus`. On start, an unusable index is rebuilt from that file and the sidecar is written. A usable index is left unchanged. This needs a volume the corpus file lives on. The search image does not contain the API database or the exporter.

## After the index is back

Run the search backup once so freshness has an archive. The backup mounts the same claim. Scale is already 1, and the claim is ReadWriteOnce, so the backup pod must land on the same node as search. The job reads the index. It does not need the claim in write mode.

```bash
kubectl -n maplespike create job --from=cronjob/quill-backup-search quill-backup-search-manual
kubectl -n maplespike logs job/quill-backup-search-manual
```

A good run prints `search backup: wrote index-….tar.gz`. A missing sidecar prints `refused to archive` and the path it checked. It does not write a file.
