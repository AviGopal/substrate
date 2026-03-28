# Activity System Deployment Architecture

## Overview

This document describes the new activity system deployment architecture using `metabob-activity-api` (TypeScript vessel), SurrealDB 3.x, and minibob for autonomous testing and learning loop closure.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Activity System Minimal                       │
│                    Namespace: activity-system                    │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
           ┌────────▼───────┐ ┌──▼──────────┐ ┌▼──────────────┐
           │  SurrealDB 3.x │ │   Redis     │ │ Activity API  │
           │   (Database)   │ │  (Cache)    │ │ (TypeScript)  │
           └────────┬───────┘ └──┬──────────┘ └┬──────────────┘
                    │             │             │
                    └─────────────┼─────────────┘
                                  │
                         ┌────────▼────────┐
                         │     minibob     │
                         │ (Autonomous     │
                         │   Vessel)       │
                         └─────────────────┘
```

### Components

#### 1. **SurrealDB 3.x** - Multi-Model Database
- **Purpose**: Primary storage for learning loop data
- **Storage**: Activity templates, executions, metrics, impulses
- **Configuration**:
  - Namespace: `metabob`
  - Database: `learning_loop`
  - Storage backend: File (RocksDB)
  - Persistence: 5-10Gi PVC
- **Port**: 8000
- **Tables**:
  - `activity_variants` - Template definitions
  - `activity_executions` - Execution history
  - `variant_performance_metrics` - Thompson Sampling state
  - `impulse_data` - Impulse content and metadata

#### 2. **Redis** - Cache Layer
- **Purpose**: High-speed cache for sessions and templates
- **Configuration**:
  - Master-only (no replicas in minimal deployment)
  - No authentication (internal cluster)
  - In-memory (can enable persistence)
- **Port**: 6379
- **Cached Data**:
  - Session tokens (24hr TTL)
  - Activity templates (1hr TTL)
  - Performance metrics (5min TTL)

#### 3. **metabob-activity-api** - Activity System Vessel
- **Purpose**: TypeScript REST API for activity system operations
- **Technology**: Bun runtime + Hono framework
- **Features**:
  - Session management with Bearer auth
  - Activity template CRUD
  - Impulse storage and retrieval
  - Execution tracking
  - Thompson Sampling for recommendations
- **Port**: 8080
- **Endpoints**:
  - `POST /v2/session` - Create session
  - `GET /v2/activities/templates` - List templates
  - `POST /v2/activities/templates` - Create template
  - `POST /v2/activities/executions` - Record execution
  - `POST /v2/impulses` - Store impulse
  - `GET /v2/impulses/:id` - Retrieve impulse
  - `GET /health` - Health check

#### 4. **minibob** - Autonomous Vessel
- **Purpose**: Autonomous agent for testing and boredom task execution
- **Features**:
  - Activity execution
  - Boredom task polling
  - MCP integration
  - Git operations
  - Learning loop participation
- **Port**: 8080
- **Configuration**:
  - MCP endpoint: Points to `metabob-activity-api`
  - Boredom enabled: Polls for tasks every 30s
  - ACP disabled: Single vessel (no gossip)

## Deployment

### Prerequisites

1. **Kubernetes cluster** (docker-desktop, minikube, or cloud)
2. **kubectl** configured
3. **helm** v3+
4. **helmfile**
5. **docker** for building images

### Quick Start

```bash
# Deploy to local environment
ENVIRONMENT=local bash scripts/deploy-activity-system.sh

# Deploy to testing environment
ENVIRONMENT=testing bash scripts/deploy-activity-system.sh
```

### Manual Deployment

```bash
# 1. Build Docker images
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

cd ../minibob
docker build -t minibob:latest .

# 2. Deploy with helmfile
cd ../..
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply

# 3. Wait for pods
kubectl wait --for=condition=ready pod -n activity-system --all --timeout=300s

# 4. Validate deployment
bash scripts/validate-activity-system.sh
```

## Environment Configuration

### Local Environment (`local`)
- **Resource allocation**: Minimal (for laptop development)
- **Persistence**: Enabled with small volumes
- **Replicas**: Single instance of each service
- **Logging**: Debug level, text format
- **Best for**: Development and local testing

### Testing Environment (`testing`)
- **Resource allocation**: Moderate (realistic testing)
- **Persistence**: Enabled with production-like volumes
- **Replicas**: 2x activity-api, 1x others
- **Logging**: Info level, JSON format
- **Best for**: Integration testing and validation

## Accessing Services

### Port Forwarding

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

### Testing Endpoints

```bash
# Health checks
curl http://localhost:8080/health  # Activity API
curl http://localhost:8000/health  # SurrealDB
curl http://localhost:8081/health  # minibob

# Create session
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: test-key"

# List templates
curl http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer <token>"
```

## Database Schema

### SurrealDB Tables

```sql
-- Activity template variants
DEFINE TABLE activity_variants SCHEMAFULL;
DEFINE FIELD activity_id ON activity_variants TYPE string;
DEFINE FIELD variant_id ON activity_variants TYPE string;
DEFINE FIELD name ON activity_variants TYPE string;
DEFINE FIELD description ON activity_variants TYPE string;
DEFINE FIELD category ON activity_variants TYPE string;
DEFINE FIELD task_steps ON activity_variants TYPE array;
DEFINE INDEX variant_id ON activity_variants COLUMNS variant_id UNIQUE;

-- Execution history
DEFINE TABLE activity_executions SCHEMAFULL;
DEFINE FIELD execution_id ON activity_executions TYPE string;
DEFINE FIELD variant_id ON activity_executions TYPE string;
DEFINE FIELD success ON activity_executions TYPE bool;
DEFINE FIELD duration ON activity_executions TYPE number;
DEFINE FIELD total_cost ON activity_executions TYPE number;
DEFINE FIELD timestamp ON activity_executions TYPE datetime;
DEFINE INDEX execution_id ON activity_executions COLUMNS execution_id UNIQUE;

-- Thompson Sampling metrics
DEFINE TABLE variant_performance_metrics SCHEMAFULL;
DEFINE FIELD variant_id ON variant_performance_metrics TYPE string;
DEFINE FIELD success_count ON variant_performance_metrics TYPE number;
DEFINE FIELD total_count ON variant_performance_metrics TYPE number;
DEFINE FIELD alpha ON variant_performance_metrics TYPE number;
DEFINE FIELD beta ON variant_performance_metrics TYPE number;
DEFINE INDEX variant_id ON variant_performance_metrics COLUMNS variant_id UNIQUE;

-- Impulse storage
DEFINE TABLE impulse_data SCHEMAFULL;
DEFINE FIELD impulse_id ON impulse_data TYPE string;
DEFINE FIELD project_id ON impulse_data TYPE string;
DEFINE FIELD pointer ON impulse_data TYPE object;
DEFINE FIELD budget ON impulse_data TYPE number;
DEFINE FIELD timestamp ON impulse_data TYPE datetime;
DEFINE INDEX impulse_id ON impulse_data COLUMNS impulse_id UNIQUE;
```

## Learning Loop Flow

```
1. minibob polls for boredom tasks
   ↓
2. Receives task from activity-api
   ↓
3. Executes activity using templates
   ↓
4. Records execution metrics
   ↓ (POST /v2/activities/executions)
5. activity-api updates SurrealDB
   ↓
6. Thompson Sampling updated
   ↓
7. Better recommendations on next request
```

## Monitoring and Debugging

### View Logs

```bash
# Activity API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# SurrealDB logs
kubectl logs -n activity-system -l app=surrealdb -f

# minibob logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
```

### Check Pod Status

```bash
kubectl get pods -n activity-system -o wide
kubectl describe pod -n activity-system <pod-name>
```

### Check Services

```bash
kubectl get svc -n activity-system
kubectl get endpoints -n activity-system
```

### Query SurrealDB Directly

```bash
# Port-forward SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# Use surreal CLI or HTTP API
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: application/json" \
  -u root:surrealdb123 \
  -d '{"query": "SELECT * FROM activity_variants LIMIT 10;"}'
```

## Migration from metabob-rpc-api

### Compatibility

The new `metabob-activity-api` is **API-compatible** with the deprecated `metabob-rpc-api` for v2 endpoints:

| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /v2/session` | ✅ Compatible | Same request/response format |
| `GET /v2/activities/templates` | ✅ Compatible | Includes Thompson Sampling scores |
| `POST /v2/activities/templates` | ✅ Compatible | Same schema |
| `POST /v2/activities/executions` | ✅ Compatible | Records to SurrealDB |
| `POST /v2/impulses` | ✅ Compatible | Same schema |
| `GET /v2/impulses/:id` | ✅ Compatible | Same response format |

### Not Included (Intentionally)

- WebSocket streaming (`/v2/submit`)
- Celery task queuing
- GitHub OAuth endpoints
- Code analysis endpoints (Metabob ML logic)

These features are intentionally excluded to keep the vessel lightweight and focused on activity system operations.

### Configuration Changes

**Old (metabob-rpc-api)**:
```yaml
minibob:
  mcpEndpoint: "http://metabob-rpc-api.metabob.svc.cluster.local:3000/mcp"
```

**New (metabob-activity-api)**:
```yaml
minibob:
  mcpEndpoint: "http://metabob-activity-api.activity-system.svc.cluster.local:8080/mcp"
```

## Troubleshooting

### Pods Not Starting

```bash
# Check events
kubectl get events -n activity-system --sort-by='.lastTimestamp'

# Check pod details
kubectl describe pod -n activity-system <pod-name>

# Check resource limits
kubectl top pods -n activity-system
```

### Database Connection Errors

```bash
# Verify SurrealDB is running
kubectl get pods -n activity-system -l app=surrealdb

# Check SurrealDB logs
kubectl logs -n activity-system -l app=surrealdb --tail=50

# Test database connection
kubectl exec -it -n activity-system deployment/metabob-activity-api -- \
  curl http://surrealdb:8000/health
```

### Activity API 500 Errors

```bash
# Check API logs for stack traces
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100

# Verify environment variables
kubectl exec -it -n activity-system deployment/metabob-activity-api -- env | grep SURREAL
```

## Cleanup

```bash
# Destroy deployment
helmfile -f helm/helmfile-activity-minimal.yaml -e local destroy

# Delete namespace
kubectl delete namespace activity-system

# Remove persistent volumes
kubectl delete pvc -n activity-system --all
```

## Next Steps

1. **Test Learning Loop**: Execute activities via minibob and verify metrics are recorded
2. **Validate Thompson Sampling**: Ensure template recommendations improve over time
3. **Scale Testing**: Increase minibob replicas to test multi-vessel coordination
4. **Performance Tuning**: Optimize SurrealDB queries and Redis caching
5. **Production Readiness**: Add authentication, TLS, monitoring, backups

## Related Documentation

- [metabob-activity-api README](repos/metabob-activity-api/README.md)
- [minibob Architecture](repos/minibob/ARCHITECTURE.md)
- [SurrealDB Documentation](https://surrealdb.com/docs)
- [Helmfile Documentation](helm/helmfile-activity-minimal.yaml)

## Support

For issues or questions:
- Check pod logs first
- Run validation script: `bash scripts/validate-activity-system.sh`
- Review SurrealDB schema and data
- Verify network connectivity between services
