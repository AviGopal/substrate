# Legacy RPC API Dependencies

This document lists all dependencies required for the `metabob-rpc-api` legacy deployment on `ide.metabob.com`.

## Chart Source

The chart has been copied **verbatim** from `repos/platform/metabob-apps/charts/metabob-rpc-api/` to maintain exact compatibility with the original deployment.

## Required Kubernetes Secrets

The following secrets must exist in the `metabob-legacy` namespace before deploying:

### 1. MinIO Object Storage
```bash
kubectl create secret generic minio -n metabob-legacy \
  --from-literal=access-key=<MINIO_ACCESS_KEY> \
  --from-literal=secret-key=<MINIO_SECRET_KEY>
```

### 2. PostgreSQL Database
```bash
kubectl create secret generic postgres-client -n metabob-legacy \
  --from-literal=postgresql-username=<POSTGRES_USER> \
  --from-literal=postgresql-password=<POSTGRES_PASSWORD>
```

### 3. SurrealDB Credentials
```bash
kubectl create secret generic surrealdb-credentials -n metabob-legacy \
  --from-literal=username=<SURREALDB_USERNAME> \
  --from-literal=password=<SURREALDB_PASSWORD>
```

### 4. Image Pull Secrets (Optional)
```bash
kubectl create secret docker-registry regcred -n metabob-legacy \
  --docker-server=<REGISTRY_URL> \
  --docker-username=<REGISTRY_USER> \
  --docker-password=<REGISTRY_PASSWORD>
```

## ConfigMap (Auto-Generated)

The chart automatically creates a `universal-config` ConfigMap with the following configuration from `charts/metabob-rpc-api.production.values.yaml`:

### Environment Variables
- `ENVIRONMENT`: production
- `JWT_SECRET_KEY`: (from values)
- `SURREALDB_URL`: http://surrealdb:8000

### .env File Content
- `REDIS_URI`: redis-master.metabob.svc
- `OPENAI_API_KEY`: (from values)
- `OPENAI_ORG_KEY`: (from values)
- `MODEL_TYPE`: openai
- `MODEL_PATH`: ./models
- `GITHUB_CLIENT_ID`: (from values)
- `GITHUB_CLIENT_SECRET`: (from values)

## Required Services

The RPC API depends on the following services being available:

1. **Redis** - `redis-master.metabob.svc:6379` (or `redis-master:6379` in same namespace)
2. **MinIO** - `minio.metabob.svc:9000` (object storage)
3. **PostgreSQL** - External at `34.94.22.213:5432` (configured in values)
4. **SurrealDB** - `surrealdb:8000` (in same namespace or `surrealdb.metabob.svc:8000`)

## Deployment Command

```bash
cd helm
helmfile -f legacy-rpc-api.yaml sync
```

## Configuration Files

- **Chart**: `helm/charts/metabob-rpc-api/`
- **Base Values**: `helm/charts/metabob-rpc-api/values.yaml`
- **Production Values**: `helm/charts/metabob-rpc-api.production.values.yaml`
- **Helmfile**: `helm/legacy-rpc-api.yaml`

## Image Information

- **Repository**: `metabobapp/metabob-rpc-api`
- **Tag**: `0.16.13`
- **Registry**: Docker Hub (public)

## Resource Allocation

### API Service (2 replicas)
- CPU Request: 250m
- CPU Limit: 500m
- Memory Request: 512Mi
- Memory Limit: 1Gi

### Worker Service (2 replicas)
- CPU Request: 500m
- CPU Limit: 1000m
- Memory Request: 2Gi
- Memory Limit: 4Gi

## Istio Configuration

The deployment includes an Istio VirtualService for routing:
- **Host**: ide.metabob.com
- **Gateway**: istio-system/metabob-gateway
- **Target Service**: metabob-rpc-api:8080

## Notes

1. This is a **frozen deployment** - no updates should be applied
2. All templates are copied verbatim from the original `repos/platform/metabob-apps/` repository
3. The namespace is isolated as `metabob-legacy` to prevent conflicts with newer deployments
4. Secrets must be created manually before deployment
5. Service dependencies (Redis, MinIO, PostgreSQL, SurrealDB) must be available before deployment
