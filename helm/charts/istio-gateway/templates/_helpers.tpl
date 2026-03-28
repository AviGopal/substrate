{{/*
Expand the name of the chart.
*/}}
{{- define "istio-gateway.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "istio-gateway.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s" $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "istio-gateway.labels" -}}
{{- toYaml .Values.labels }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Get the domain for the current environment
*/}}
{{- define "istio-gateway.domain" -}}
{{- $env := .Values.environment | default "development" }}
{{- index .Values.domains $env }}
{{- end }}

{{/*
Get the hostname for a service
*/}}
{{- define "istio-gateway.hostname" -}}
{{- $env := .Values.environment | default "development" }}
{{- $domain := index .Values.domains $env }}
{{- printf "%s.%s" .subdomain $domain }}
{{- end }}
