# Istio Gateway Chart

Configurable Istio Gateway for Activity System with support for metrics tracking, CORS policies, and traffic management.

## Overview

This chart creates:
- **Gateway**: Ingress point for external traffic on port 80
- **VirtualServices**: Route definitions for Dashboard and API services
- **DestinationRules**: Traffic policies, load balancing, and outlier detection

## Configuration

### Hostnames

Configure the external hostnames for your services:

```yaml
virtualServices:
  dashboard:
    hostname: dashboard.minibob.local
  api:
    hostname: api.minibob.local
```

### Metrics Tracking

Enable metrics collection on virtual services:

```yaml
metrics:
  enabled: true
  prometheus:
    enabled: true
    interval: 30s
  tracking:
    - request_count
    - request_duration
    - error_rate
```

Per-service metrics labels:

```yaml
virtualServices:
  dashboard:
    metrics:
      enabled: true
      labels:
        service: dashboard
        component: ui
  api:
    metrics:
      enabled: true
      labels:
        service: api
        component: backend
```

### Traffic Policies

Configure timeouts, retries, and load balancing:

```yaml
virtualServices:
  api:
    timeout: 60s
    retries:
      attempts: 3
      perTryTimeout: 20s

destinationRules:
  api:
    loadBalancer: LEAST_REQUEST
    connectionPool:
      http:
        http1MaxPendingRequests: 200
        http2MaxRequests: 200
```

### CORS Configuration

Customize CORS policies per service:

```yaml
virtualServices:
  api:
    cors:
      allowOrigins:
        - exact: "*"
        - regex: "https://.*\.example\.com"
      allowMethods:
        - GET
        - POST
        - PUT
        - DELETE
        - OPTIONS
      allowHeaders:
        - content-type
        - authorization
        - x-api-key
      maxAge: 24h
```

### Outlier Detection

Configure automatic removal of unhealthy instances:

```yaml
destinationRules:
  api:
    outlierDetection:
      enabled: true
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

### Load Balancing

Choose load balancing algorithms:

```yaml
destinationRules:
  dashboard:
    loadBalancer: ROUND_ROBIN
  api:
    loadBalancer: LEAST_REQUEST
```

Other options: `RANDOM`, `PASSTHROUGH`, `MAGLEV`

## Example Values Override

Create a custom values file to override defaults:

```yaml
# custom-values.yaml
virtualServices:
  dashboard:
    hostname: dashboard.prod.example.com
    metrics:
      enabled: true

  api:
    hostname: api.prod.example.com
    timeout: 120s
    metrics:
      enabled: true

metrics:
  enabled: true
  prometheus:
    enabled: true
    interval: 15s
  tracking:
    - request_count
    - request_duration
    - request_size
    - error_rate
```

Deploy with overrides:

```bash
helmfile -f helm/activity-system-minimal.yaml apply \
  --values custom-values.yaml
```

## Monitoring

### Prometheus Metrics

When metrics tracking is enabled, metrics are available at:

```
http://api.minibob.local:8883/stats/prometheus
```

Tracked metrics:
- `istio_requests_total` - Total requests by service
- `istio_request_duration_milliseconds` - Request latency
- `istio_request_bytes` - Request payload size
- `istio_response_bytes` - Response payload size

### Service Monitor

Enable Prometheus ServiceMonitor for automatic scraping:

```yaml
metrics:
  prometheus:
    serviceMonitor:
      enabled: true
      interval: 30s
      namespace: monitoring
```

## Troubleshooting

### Check Gateway Status

```bash
kubectl -n activity-system get gateway
kubectl -n activity-system describe gateway activity-system-gateway
```

### Check VirtualServices

```bash
kubectl -n activity-system get vs
kubectl -n activity-system describe vs activity-dashboard
```

### Check DestinationRules

```bash
kubectl -n activity-system get dr
kubectl -n activity-system describe dr metabob-activity-api
```

### Test Connectivity

```bash
# Port-forward to test without Istio
kubectl -n activity-system port-forward svc/activity-dashboard 3000:3000
kubectl -n activity-system port-forward svc/metabob-activity-api 8080:8080
```

### View Istio Logs

```bash
# Check proxy sidecar logs
kubectl -n activity-system logs <pod-name> -c istio-proxy

# Check gateway pod logs
kubectl -n istio-system logs -l app=istio-ingressgateway
```

## Requirements

- Istio 1.15+ installed in cluster
- `istio: ingressgateway` label on Istio Ingress Gateway pods
- Services in `activity-system` namespace with Istio injection enabled

## References

- [Istio Gateway Documentation](https://istio.io/latest/docs/reference/config/networking/gateway/)
- [Istio VirtualService Documentation](https://istio.io/latest/docs/reference/config/networking/virtual-service/)
- [Istio DestinationRule Documentation](https://istio.io/latest/docs/reference/config/networking/destination-rule/)
