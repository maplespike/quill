{{- define "quill.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "quill.cronjob.name" -}}
{{- printf "%s-%s" (include "quill.fullname" .) .name | trunc 63 | trimSuffix "-" }}
{{- end }}
