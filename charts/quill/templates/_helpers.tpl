{{- define "quill.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "quill.cronjob.name" -}}
{{- printf "%s-%s" (include "quill.fullname" .) .name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
  quill.image — the full image reference for one Quill service.

  Input: dict "svc" <api|mcp|portal> "ctx" $   ($ = the root template context)

  Precedence:
    1. images.<svc>.registry + images.<svc>.repository
       (set together by the deploy-prod pin commit)
    2. images.<svc>.repository alone, when it is already a full name
    3. image.repositoryPath → <image.registry>/<repositoryPath>/<svc>
    4. otherwise <image.registry>/quill-<svc>

  Until that pin commit, production has no per-image registry field, so the
  chart still renders docker.io/library/quill-<svc>@<digest> and the global
  pullPolicy (Never). See docs/IMAGE-PINNING.md.
*/}}
{{- define "quill.image" -}}
{{- $ctx := .ctx -}}
{{- $pin := index (default (dict) $ctx.Values.images) .svc | default (dict) -}}
{{- $repo := "" -}}
{{- if and $pin.registry $pin.repository -}}
{{- $repo = printf "%s/%s" $pin.registry $pin.repository -}}
{{- else if $pin.repository -}}
{{- $repo = $pin.repository -}}
{{- else -}}
{{- $prefix := $ctx.Values.image.repositoryPath | default "" -}}
{{- if $prefix -}}
{{- $repo = printf "%s/%s/%s" $ctx.Values.image.registry $prefix .svc -}}
{{- else -}}
{{- $repo = printf "%s/quill-%s" $ctx.Values.image.registry .svc -}}
{{- end -}}
{{- end -}}
{{- if $pin.digest -}}
{{- printf "%s@%s" $repo $pin.digest -}}
{{- else -}}
{{- $tag := default $ctx.Values.image.tag $pin.tag -}}
{{- if not $tag -}}
{{- fail (printf "charts/quill: images.%s needs a digest or a tag (see values-prod.yaml)" .svc) -}}
{{- end -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end }}

{{/*
  quill.imageAnnotations — pod-template annotations recording the pinned build.

  Input: dict "svc" <api|mcp|portal> "ctx" $
  Emits the whole `annotations:` block, or nothing when no build tag is recorded.
  The digest in the image reference is the pin; the build tag is the provenance
  (store tag → digest → git commit), so a live pod traces back to a build.
*/}}
{{/*
  quill.pullPolicy — per-image pullPolicy, else the chart-wide image.pullPolicy.
  The deploy-prod pin commit sets IfNotPresent on each migrated service.
  Services without that field keep the global policy (Never, until then).
*/}}
{{- define "quill.pullPolicy" -}}
{{- $pin := index (default (dict) .ctx.Values.images) .svc | default (dict) -}}
{{- $pin.pullPolicy | default .ctx.Values.image.pullPolicy -}}
{{- end }}

{{- define "quill.imageAnnotations" -}}
{{- $pin := index (default (dict) .ctx.Values.images) .svc | default (dict) -}}
{{- if $pin.tag -}}
annotations:
  quill.maplespike.ca/image-build-tag: {{ $pin.tag | quote }}
{{- end -}}
{{- end }}

{{/*
  quill.nodeAffinity — required hostname In affinityHosts + preferred preferredHost.

  Input: dict with optional keys:
    affinityHosts (list of kubernetes.io/hostname values; required for emit)
    preferredHost (string; optional preferredDuringScheduling weight 100)
    indent (int; spaces before "affinity:" — default 6 for pod spec)

  Emits nothing when affinityHosts is empty. Callers that already emit an
  `affinity:` block (portal podAntiAffinity) should use quill.nodeAffinityTerms
  instead and nest under affinity.nodeAffinity.
*/}}
{{- define "quill.nodeAffinity" -}}
{{- $hosts := .affinityHosts | default list -}}
{{- if $hosts -}}
{{- $pref := .preferredHost | default "" -}}
affinity:
  nodeAffinity:
{{- include "quill.nodeAffinityBody" (dict "affinityHosts" $hosts "preferredHost" $pref) | nindent 4 }}
{{- end -}}
{{- end }}

{{/*
  quill.nodeAffinityBody — required + preferred nodeAffinity contents only
  (no outer affinity:/nodeAffinity: keys). For merging into an existing affinity.
*/}}
{{- define "quill.nodeAffinityBody" -}}
{{- $hosts := .affinityHosts | default list -}}
{{- $pref := .preferredHost | default "" -}}
requiredDuringSchedulingIgnoredDuringExecution:
  nodeSelectorTerms:
    - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
{{- range $hosts }}
            - {{ . | quote }}
{{- end }}
{{- if $pref }}
preferredDuringSchedulingIgnoredDuringExecution:
  - weight: 100
    preference:
      matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
            - {{ $pref | quote }}
{{- end }}
{{- end }}

{{/*
  quill.rwoApiCoLocate — required podAffinity so CronJobs that mount the
  ReadWriteOnce quill-api-data PVC land on the same node as the live api pod.
  Soft hostname affinity (nexus|sentry) alone schedules onto the empty node
  and FailedAttachVolume for 30+ minutes (2026-11-04: sweep/ngo-rss on sentry
  while api held the volume on nexus).
*/}}
{{- define "quill.rwoApiCoLocate" -}}
affinity:
  podAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: quill-api
        topologyKey: kubernetes.io/hostname
{{- end }}

{{/*
  Claim names for the API SQLite, search index, and backups volumes.
  storageCutover.useLocalPathCopies defaults to false, so workloads keep the
  existing Longhorn PVCs and the local-path copies are not rendered. Flipping
  the flag both creates the three *-local claims and switches workloads onto
  them. The original Longhorn PVCs are never renamed or deleted by this flag.
*/}}
{{- define "quill.apiDataClaim" -}}
{{- if ((.Values.storageCutover | default dict).useLocalPathCopies | default false) -}}
{{- printf "%s-api-data-local" (include "quill.fullname" .) -}}
{{- else -}}
{{- printf "%s-api-data" (include "quill.fullname" .) -}}
{{- end -}}
{{- end }}

{{- define "quill.searchDataClaim" -}}
{{- if ((.Values.storageCutover | default dict).useLocalPathCopies | default false) -}}
{{- printf "%s-search-data-local" (include "quill.fullname" .) -}}
{{- else -}}
{{- printf "%s-search-data" (include "quill.fullname" .) -}}
{{- end -}}
{{- end }}

{{- define "quill.backupsClaim" -}}
{{- if ((.Values.storageCutover | default dict).useLocalPathCopies | default false) -}}
{{- printf "%s-backups-local" (include "quill.fullname" .) -}}
{{- else -}}
{{- printf "%s-backups" (include "quill.fullname" .) -}}
{{- end -}}
{{- end }}
