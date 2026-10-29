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
    1. images.<svc>.repository, if set
    2. image.repositoryPath → <registry>/<repositoryPath>/<svc>
       (production: registry.registry.svc.cluster.local:5000/quill/<svc>)
    3. otherwise <registry>/quill-<svc> (dev/self-host)

  Then:
    1. images.<svc>.digest → <repo>@sha256:<digest>
    2. images.<svc>.tag    → <repo>:<immutable build tag>
    3. image.tag           → <repo>:<tag>

  Production pins the digest and uses imagePullPolicy IfNotPresent. kubelet
  pulls from the in-cluster registry. Both eligible nodes mirror that host
  over plain HTTP. See docs/IMAGE-PINNING.md.
*/}}
{{- define "quill.image" -}}
{{- $ctx := .ctx -}}
{{- $pin := index (default (dict) $ctx.Values.images) .svc | default (dict) -}}
{{- $repo := $pin.repository -}}
{{- if not $repo -}}
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
