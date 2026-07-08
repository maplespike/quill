{{- define "maplespike.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "maplespike.cronjob.name" -}}
{{- printf "%s-%s" (include "maplespike.fullname" .) .name | trunc 63 | trimSuffix "-" }}
{{- end }}
