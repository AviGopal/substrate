# Activity System Helmfile Deployment

## Overview

This directory contains Helm charts and Helmfile configurations for deploying the complete activity system infrastructure.

## Quick Deploy

```bash
# From project root
ENVIRONMENT=local bash scripts/deploy-activity-system.sh
```

## Architecture

The activity system consists of 4 main components deployed to the `activity-system` namespace:

1. **Redis** - Cache layer (Bitnami chart)
2. **SurrealDB 3.x** - Database backend (Custom chart)
3. **metabob-activity-api** - TypeScript REST API (Custom chart)
4. **minibob** - Autonomous vessel (Custom chart)

## Files

### Helmfile
- `helmfile-activity-minimal.yaml` - Main deployment orchestration

### Helm Charts
- `charts/metabob-activity-api/` - Activity API vessel chart
- `charts/surrealdb/` - SurrealDB 3.x database chart

### Environment Configurations
- `environments/activity-minimal-local.values.yaml` - Local development
- `environments/activity-minimal-testing.values.yaml` - Testing environment

## Deployment Commands

### Deploy
```bash
# Local environment (minimal resources)
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply

# Testing environment (realistic resources)
helmfile -f helm/helmfile-activity-minimal.yaml -e testing apply
```

### Verify
```bash
# Check deployment status
kubectl get pods -n activity-system

# Check services
kubectl get svc -n activity-system

# Check persistent volumes
kubectl get pvc -n activity-system
```

### Destroy
```bash
# Remove deployment
helmfile -f helm/helmfile-activity-minimal.yaml -e local destroy

# Delete namespace
kubectl delete namespace activity-system
```

## Port Forwarding

```bash
# Activity API
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080

# SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# minibob
kubectl port-forward -n activity-system svc/minibob 8081:8080

# Redis
kubectl port-forward -n activity-system svc/redis-master 6379:6379
```

## Environment Variables

### Local Environment
- Minimal resource allocation
- Debug logging
- Single replicas
- In-memory Redis

### Testing Environment
- Moderate resource allocation
- Info logging (JSON format)
- 2 replicas for activity-api
- Persistent Redis

## Chart Configuration

### metabob-activity-api

**Key Configuration**:
```yaml
config:
  surrealdb:
    url: "http://surrealdb.activity-system.svc.cluster.local:8000"
    namespace: "metabob"
    database: "learning_loop"
  redis:
    url: "redis://redis-master.activity-system.svc.cluster.local:6379"
```

### SurrealDB

**Key Configuration**:
```yaml
persistence:
  enabled: true
  size: 5Gi
database:
  namespace: metabob
  name: learning_loop
```

## Dependencies

The deployment has the following dependency chain:

```
Redis
  └─> SurrealDB
       └─> metabob-activity-api
            └─> minibob
```

Helmfile ensures components deploy in the correct order.

## Troubleshooting

### Pods Not Starting
```bash
# Check events
kubectl get events -n activity-system --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod -n activity-system <pod-name>
```

### Database Connection Issues
```bash
# Test SurrealDB connectivity
kubectl exec -it -n activity-system deployment/metabob-activity-api -- \
  curl http://surrealdb:8000/health
```

### Redis Connection Issues
```bash
# Test Redis connectivity
kubectl exec -it -n activity-system deployment/metabob-activity-api -- \
  sh -c 'echo PING | nc redis-master 6379'
```

## Related Documentation

- [Quick Start Guide](../ACTIVITY_SYSTEM_QUICKSTART.md) - 5-minute setup
- [Deployment Guide](../ACTIVITY_SYSTEM_DEPLOYMENT.md) - Comprehensive guide
- [Setup Complete](../ACTIVITY_SYSTEM_SETUP_COMPLETE.md) - Full summary
- [Checklist](../ACTIVITY_SYSTEM_CHECKLIST.md) - Deployment checklist

## Support

For issues:
1. Run validation: `bash scripts/validate-activity-system.sh`
2. Check pod logs: `kubectl logs -n activity-system <pod-name>`
3. Review documentation above
