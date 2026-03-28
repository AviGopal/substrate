# Legacy RPC API - Istio Configuration & Deployment Guide

## Overview

The legacy metabob-rpc-api service is exposed at `ide.metabob.com` through a centralized Istio Gateway configuration. This document explains the complete setup.

## Architecture

```
┌─────────────────┐
│ ide.metabob.com │ (External DNS)
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   Istio Ingress Gateway (Port 443)    │
│   Namespace: istio-system              │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   Gateway: metabob-gateway             │
│   Namespace: metabob                   │
│   Hosts: *.metabob.com                 │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   VirtualService: legacy-rpc-api-vs    │
│   Namespace: metabob (same as gateway) │
│   Host: ide.metabob.com                │
│   Route: /api → backend service        │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   Service: metabob-rpc-api             │
│   Namespace: metabob-legacy            │
│   Port: 8080                           │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   Pods: metabob-rpc-api                │
│   - API Server (2 replicas)            │
│   - Celery Workers (2 replicas)        │
└────────────────────────────────────────┘
```

## Configuration Files

### 1. Istio Gateway Configuration

**File**: `helm/charts/istio-gateway/values.yaml`

The legacy RPC API is defined in the centralized gateway configuration:

```yaml
services:
  legacy-rpc-api:
    subdomain: ide                        # Creates ide.metabob.com
    service: metabob-rpc-api             # Service name
    namespace: metabob-legacy            # Cross-namespace reference
    port: 8080
    enabled:
      development: false
      production: true                    # Only in production
    settings:
      timeout: 300s                       # Long timeout for analysis
      retries:
        attempts: 3
        perTryTimeout: 100s
      cors:
        allowOrigins: ["*"]
      loadBalancer: ROUND_ROBIN
```

### 2. Legacy Deployment Configuration

**File**: `helm/legacy-rpc-api.yaml`

The deployment helmfile is simplified - it only deploys the application:

```yaml
releases:
  - name: metabob-rpc-api-legacy
    chart: ./charts/metabob-rpc-api
    namespace: metabob-legacy
    values:
      - namespace: metabob-legacy
      - ./charts/metabob-rpc-api.production.values.yaml
      - istio:
          enabled: false  # VirtualService managed by istio-gateway chart
```

**Key Point**: The VirtualService is NOT created by the legacy chart. It's managed by the centralized `istio-gateway` chart.

## Deployment Order

### 1. Prerequisites

Ensure these secrets exist in `metabob-legacy` namespace:

```bash
# Create namespace
kubectl create namespace metabob-legacy

# Create secrets (see LEGACY_RPC_API_DEPENDENCIES.md)
kubectl create secret generic minio -n metabob-legacy \
  --from-literal=access-key=$MINIO_ACCESS_KEY \
  --from-literal=secret-key=$MINIO_SECRET_KEY

kubectl create secret generic postgres-client -n metabob-legacy \
  --from-literal=postgresql-username=$POSTGRES_USER \
  --from-literal=postgresql-password=$POSTGRES_PASSWORD

kubectl create secret generic surrealdb-credentials -n metabob-legacy \
  --from-literal=username=$SURREALDB_USER \
  --from-literal=password=$SURREALDB_PASSWORD
```

### 2. Deploy Istio Gateway (if not already deployed)

```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl \
  -l name=istio-gateway \
  -e production \
  sync
```

This creates:
- Gateway: `metabob-gateway` (namespace: `metabob`)
- VirtualService: `legacy-rpc-api-vs` (namespace: `metabob`)
  - Host: `ide.metabob.com`
  - Routes to: `metabob-rpc-api.metabob-legacy.svc.cluster.local:8080`

### 3. Deploy Legacy RPC API

```bash
cd helm
helmfile -f legacy-rpc-api.yaml sync
```

This creates:
- Deployment: `metabob-rpc-api` (API server, 2 replicas)
- Deployment: `metabob-rpc-api-dry-workers` (Celery workers, 2 replicas)
- Service: `metabob-rpc-api` (ClusterIP, port 8080)
- ConfigMap: `universal-config` (with all required config)

## Verification

### 1. Check Gateway

```bash
# Verify gateway exists and has ide.metabob.com
kubectl get gateway metabob-gateway -n metabob -o yaml | grep -A 10 hosts

# Expected output includes:
# - '*.metabob.com'
```

### 2. Check VirtualService

```bash
# Check if VirtualService for legacy RPC API exists
kubectl get virtualservices -n metabob | grep legacy

# Get full configuration
kubectl get virtualservice legacy-rpc-api-vs -n metabob -o yaml

# Expected:
# spec:
#   hosts:
#     - ide.metabob.com
#   gateways:
#     - metabob-gateway
#   http:
#     - route:
#         - destination:
#             host: metabob-rpc-api.metabob-legacy.svc.cluster.local
#             port:
#               number: 8080
```

### 3. Check Service and Pods

```bash
# Check service in metabob-legacy namespace
kubectl get svc -n metabob-legacy

# Check pods
kubectl get pods -n metabob-legacy

# Expected:
# metabob-rpc-api-<hash> (2 replicas)
# metabob-rpc-api-dry-workers-<hash> (2 replicas)
```

### 4. Test Connectivity

```bash
# From inside the cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -v http://metabob-rpc-api.metabob-legacy.svc.cluster.local:8080/

# From outside (requires DNS configured)
curl -v https://ide.metabob.com/api/health
```

### 5. Check Istio Configuration

```bash
# Verify Istio has the route configured
istioctl proxy-config routes deploy/istio-ingressgateway -n istio-system | grep ide.metabob.com
```

## Troubleshooting

### Issue: 404 Not Found

**Cause**: VirtualService not created or not attached to gateway

**Fix**:
```bash
# Check if VirtualService exists
kubectl get vs -n metabob | grep legacy

# If missing, check istio-gateway deployment:
kubectl get pods -n metabob | grep istio-gateway

# Redeploy istio-gateway with production environment
helmfile -f activity-system-minimal.yaml.gotmpl \
  -l name=istio-gateway \
  -e production \
  sync
```

### Issue: 503 Service Unavailable

**Cause**: Backend service not running or not reachable

**Fix**:
```bash
# Check backend pods
kubectl get pods -n metabob-legacy

# Check service endpoints
kubectl get endpoints -n metabob-legacy metabob-rpc-api

# If no endpoints, check pod logs
kubectl logs -n metabob-legacy -l app=metabob-rpc-api --tail=50
```

### Issue: TLS Certificate Error

**Cause**: Certificate not configured for ide.metabob.com

**Fix**:
```bash
# Check certificate
kubectl get secret istio-ingressgateway-certs -n istio-system

# Certificate should include ide.metabob.com in SAN
kubectl get secret istio-ingressgateway-certs -n istio-system -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout | grep DNS
```

### Issue: CORS Errors

**Cause**: CORS policy not configured correctly

**Fix**: Update `helm/charts/istio-gateway/values.yaml`:
```yaml
services:
  legacy-rpc-api:
    settings:
      cors:
        allowOrigins:
          - exact: "https://ide.metabob.com"  # Be specific in production
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        allowHeaders: ["content-type", "authorization", "x-api-key"]
        maxAge: 24h
```

## Environment-Specific Configuration

### Development (Not Exposed)

In development, the legacy RPC API is NOT exposed externally:

```yaml
# helm/charts/istio-gateway/values.yaml
services:
  legacy-rpc-api:
    enabled:
      development: false  # ← Not exposed in dev
      production: true
```

### Production (Exposed at ide.metabob.com)

In production, the service is exposed with TLS:

```yaml
# helm/environments/production.yaml
istioGateway:
  environment: production
  gateway:
    tls:
      enabled: true
      credentialName: istio-ingressgateway-certs
```

## Traffic Flow

1. **Client** → `https://ide.metabob.com/api/analyze`
2. **DNS** → Resolves to Istio Ingress Gateway LoadBalancer IP
3. **Istio Ingress Gateway** → Terminates TLS, checks Gateway hosts
4. **Gateway: metabob-gateway** → Matches `*.metabob.com` (includes `ide.metabob.com`)
5. **VirtualService: legacy-rpc-api-vs** → Routes based on host `ide.metabob.com`
6. **Destination** → `metabob-rpc-api.metabob-legacy.svc.cluster.local:8080`
7. **Service: metabob-rpc-api** → Load balances to pod endpoints
8. **Pod: metabob-rpc-api** → Handles request

## Monitoring

### Metrics

```bash
# Request rate to legacy RPC API
kubectl exec -n istio-system deploy/istio-ingressgateway -- \
  curl -s localhost:15000/stats/prometheus | grep legacy_rpc_api

# Response codes
istioctl dashboard prometheus
# Query: istio_requests_total{destination_service="metabob-rpc-api.metabob-legacy.svc.cluster.local"}
```

### Logs

```bash
# Ingress gateway logs
kubectl logs -n istio-system -l app=istio-ingressgateway --tail=100 | grep ide.metabob.com

# Backend logs
kubectl logs -n metabob-legacy -l app=metabob-rpc-api --tail=100 -f
```

## Maintenance

### Update Gateway Configuration

```bash
# Edit values
vim helm/charts/istio-gateway/values.yaml

# Apply changes (production)
helmfile -f activity-system-minimal.yaml.gotmpl \
  -l name=istio-gateway \
  -e production \
  sync
```

### Update Legacy Deployment

```bash
# Edit values
vim helm/charts/metabob-rpc-api.production.values.yaml

# Apply changes
helmfile -f legacy-rpc-api.yaml sync
```

## Security Considerations

1. **TLS**: Always use HTTPS in production (enabled via gateway TLS config)
2. **CORS**: Configure specific origins in production (not wildcard `*`)
3. **Rate Limiting**: Consider adding Istio rate limits for the legacy endpoint
4. **Authentication**: JWT validation should happen at the application level
5. **Network Policies**: Consider adding Kubernetes NetworkPolicies to restrict traffic

## Related Documentation

- `helm/LEGACY_RPC_API_DEPENDENCIES.md` - Required secrets and dependencies
- `helm/ISTIO_CONFIGURATION_ANALYSIS.md` - Detailed Istio analysis
- `helm/charts/istio-gateway/values.yaml` - Centralized gateway configuration
