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
    1. images.<svc>.digest → <registry>/quill-<svc>@sha256:<digest>  (content pin)
    2. images.<svc>.tag    → <registry>/quill-<svc>:<immutable build tag>
    3. image.tag           → <registry>/quill-<svc>:<tag>  (dev/self-host fallback)

  Production pins the digest form (charts/quill/values-prod.yaml, gate
  A3-IMAGEPIN / #755): kubelet resolves that exact content from the node
  containerd store, so re-tagging a build tag cannot change what a rollout
  serves. The image must already exist in the store (pullPolicy: Never) —
  create it with scripts/pin-images.sh. See docs/IMAGE-PINNING.md.
*/}}
{{- define "quill.image" -}}
{{- $ctx := .ctx -}}
{{- $pin := index (default (dict) $ctx.Values.images) .svc | default (dict) -}}
{{- $repo := default (printf "%s/quill-%s" $ctx.Values.image.registry .svc) $pin.repository -}}
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
