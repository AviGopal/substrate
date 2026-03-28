# Istio Configuration Analysis - Legacy RPC API

## Current State (Production)

### Gateway Configuration
**Name**: `metabob-gateway` (namespace: `metabob`)

**Hosts**:
- `metabob.com`
- `*.metabob.com` (includes `ide.metabob.com` ✅)
- `production.metabob.com`
- `*.production.metabob.com`

**Ports**:
- Port 80 (HTTP2) - Redirects to HTTPS
- Port 443 (HTTPS) - TLS with cert `istio-ingressgateway-certs`

**Selector**: `istio: ingressgateway`

### VirtualService Configuration
**Name**: `metabob-rpc-api` (namespace: `metabob`)

**Current Configuration** (PROBLEM):
```yaml
spec:
  gateways:
    - metabob-gateway
  hosts:
    - metabob-rpc-api.metabob.svc.cluster.local  ❌ (cluster-internal only)
  http:
    - match:
        - uri:
            prefix: /api
      route:
        - destination:
            host: metabob-rpc-api.metabob.svc.cluster.local
            port:
              number: 8080
```

**Issue**: The VirtualService only has the cluster-internal host, NOT `ide.metabob.com`.

## Problem Analysis

### What's Working
✅ Gateway allows `ide.metabob.com` (via `*.metabob.com` wildcard)
✅ Gateway has TLS configured
✅ VirtualService is attached to the gateway
✅ VirtualService routes to the correct backend service

### What's Broken
❌ **VirtualService hosts list missing `ide.metabob.com`**

This means:
- External traffic to `ide.metabob.com` hits the gateway ✅
- But there's NO VirtualService with `ide.metabob.com` in its hosts ❌
- So Istio returns 404 (no route configured) ❌

## Root Cause

The `helm/charts/metabob-rpc-api/templates/virtualservice.yaml` template includes the external host conditionally:

```yaml
hosts:
- metabob-rpc-api.{{ .Values.namespace }}.svc.cluster.local
{{- if .Values.istio.gateway }}
- {{ .Values.istio.gateway.host | quote }}  # <-- This should add ide.metabob.com
{{- end }}
```

But the `helm/legacy-rpc-api.yaml` helmfile doesn't provide the correct structure. It has:

```yaml
istio:
  enabled: true
  virtualService:          # ❌ Wrong key
    enabled: true
    hosts:
      - ide.metabob.com
    gateways:
      - istio-system/metabob-gateway
```

The template expects:
```yaml
istio:
  enabled: true
  gateway:               # ✅ Correct key
    host: ide.metabob.com
    name: metabob-gateway
```

## Fix Required

### Option 1: Update helmfile values (RECOMMENDED)

Update `helm/legacy-rpc-api.yaml`:

```yaml
releases:
  - name: metabob-rpc-api-legacy
    chart: ./charts/metabob-rpc-api
    namespace: metabob-legacy
    values:
      - namespace: metabob-legacy  # ❌ Wrong - should be 'metabob' for service discovery

      # Fix Istio configuration
      - istio:
          enabled: true
          gateway:
            host: ide.metabob.com
            name: metabob/metabob-gateway  # gateway-namespace/gateway-name
```

**BUT**: The namespace is problematic. The VirtualService needs to be in the same namespace as the gateway (`metabob`), but the deployment is in `metabob-legacy`.

### Option 2: Create standalone VirtualService

Create a separate VirtualService manifest in the `metabob` namespace that references the service in `metabob-legacy`:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: legacy-rpc-api-external
  namespace: metabob  # Same as gateway
spec:
  hosts:
    - ide.metabob.com
  gateways:
    - metabob-gateway
  http:
    - match:
        - uri:
            prefix: /
      route:
        - destination:
            host: metabob-rpc-api.metabob-legacy.svc.cluster.local
            port:
              number: 8080
      timeout: 300s
      retries:
        attempts: 3
        perTryTimeout: 100s
```

### Option 3: Update VirtualService template

Make the template more flexible to support cross-namespace references.

## Recommended Solution

**Use Option 2**: Create a standalone VirtualService in the `metabob` namespace.

### Why?
1. ✅ Gateway and VirtualService in same namespace (best practice)
2. ✅ Service can be in different namespace (metabob-legacy)
3. ✅ Keeps legacy deployment isolated
4. ✅ Doesn't require changing the chart template
5. ✅ Easy to add/remove without touching main gateway config

### Implementation

1. Create `helm/charts/metabob-rpc-api-legacy-vs/` chart
2. Template creates VirtualService in `metabob` namespace
3. Points to service in `metabob-legacy` namespace
4. Update `helm/legacy-rpc-api.yaml` to deploy both charts

OR

Simply add to the istio-gateway values:

```yaml
services:
  # ... existing services ...

  # Legacy RPC API (ide.metabob.com)
  legacy-rpc-api:
    subdomain: ide
    service: metabob-rpc-api
    namespace: metabob-legacy  # Cross-namespace reference
    port: 8080
    enabled:
      development: false
      production: true
    settings:
      timeout: 300s
      retries:
        attempts: 3
        perTryTimeout: 100s
      cors:
        allowOrigins:
          - exact: "*"
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        allowHeaders: ["content-type", "authorization"]
        maxAge: 24h
```

This is the cleanest approach - everything goes through the centralized gateway configuration.

## Service Mapping Matrix (Updated)

| Service | Host | Namespace | Port | Environment |
|---------|------|-----------|------|-------------|
| metabob-cloud-dashboard | app.metabob.com | activity-system | 3000 | production |
| metabob-activity-api | activity.metabob.com | activity-system | 8080 | production |
| metabob-analysis-api | api.metabob.com | activity-system | 8080 | production |
| **metabob-rpc-api (legacy)** | **ide.metabob.com** | **metabob-legacy** | **8080** | **production** |
| surrealdb | surql.metabob.local | activity-system | 8000 | development only |
| activity-dashboard | graph.metabob.local | activity-system | 3000 | development only |
| internal-dashboard | internal.metabob.local | activity-system | 3001 | development only |
