# Quick Reference: SurrealDB HTTP RPC + Persistence

## Verified Configuration

### Docker Images
- **metabob-rpc-api**: `metabobapp/metabob-rpc-api:0.16.18-http-rpc-complete`
- **SurrealDB**: `surrealdb/surrealdb:v2.6.0`

### Storage Configuration
```yaml
# SurrealDB StatefulSet
volumeMounts:
  - name: data
    mountPath: /data

volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### SurrealDB Startup
```bash
surreal start \
  --bind 0.0.0.0:8000 \
  --user root \
  --pass root \
  file:///data/database
```

## API Endpoints (Verified)

### Register Template
```bash
POST http://localhost:8080/v2/activities/templates
Content-Type: application/json

{
  "name": "Template Name",
  "activity_id": "template-id",
  "description": "Description",
  "category": "feature",
  ...
}

Response: HTTP 201 Created
{
  "variant_id": "template-id-<hash>",
  "activity_id": "template-id",
  ...
}
```

### Select Template by Activity ID (Thompson Sampling)
```bash
POST http://localhost:8080/v2/activities/templates/{activity_id}/select

Response: HTTP 200 OK
{
  "variant_id": "template-id-<hash>",
  "thompson_sample": 0.7267,
  "metrics": {...}
}
```

### Get Template by Variant ID
```bash
GET http://localhost:8080/v2/activities/templates/{variant_id}

Response: HTTP 200 OK
{
  "variant_id": "...",
  "activity_id": "...",
  "metrics": {...}
}
```

### List All Templates
```bash
GET http://localhost:8080/v2/activities/templates

Response: HTTP 200 OK
[
  {
    "variant_id": "...",
    "activity_id": "...",
    "metrics": {...}
  },
  ...
]
```

## Persistence Behavior

### Pod Restart
1. Pod deleted: `kubectl -n metabob delete pod <pod-name>`
2. StatefulSet creates new pod
3. New pod mounts existing PVC at `/data`
4. SurrealDB loads existing database from `/data/database`
5. Log message: "existing root users were found"
6. All data intact (zero data loss)

### Data Location
- **PVC Mount**: `/data`
- **Database Path**: `/data/database`
- **Storage Engine**: RocksDB
- **Files**: `/data/database/*.sst` (RocksDB files)

## Troubleshooting

### Check PVC Status
```bash
kubectl -n metabob get pvc
kubectl -n metabob describe pvc data-surrealdb-0
```

### Check Pod Logs
```bash
kubectl -n metabob logs surrealdb-<pod-id>
```

### Port-Forward for Testing
```bash
# SurrealDB
kubectl -n metabob port-forward svc/surrealdb 8000:8000

# RPC API
kubectl -n metabob port-forward svc/metabob-rpc-api 8080:8080
```

### Reset Data (WARNING: Destructive)
```bash
# Delete pod
kubectl -n metabob delete pod surrealdb-<pod-id>

# Delete PVC (deletes all data)
kubectl -n metabob delete pvc data-surrealdb-0

# StatefulSet will create new pod with new PVC
```

## Verification Commands

```bash
# Register test template
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @test-template.json

# Select by activity_id
curl -X POST http://localhost:8080/v2/activities/templates/test-template/select

# Get by variant_id
curl http://localhost:8080/v2/activities/templates/test-template-<hash>

# List all
curl http://localhost:8080/v2/activities/templates

# Restart pod and verify persistence
kubectl -n metabob delete pod surrealdb-<pod-id>
kubectl -n metabob wait --for=condition=ready pod -l app=surrealdb
curl http://localhost:8080/v2/activities/templates/test-template-<hash>
```

## Key Metrics (from E2E Test)

- Template registration: <1s
- Template retrieval: <100ms
- Pod restart time: ~30s
- Data loss on restart: 0 records
- Timestamp preservation: Exact
- Metrics preservation: 100%

## Production Checklist

- [x] HTTP RPC client working
- [x] Activity ID lookup via Thompson Sampling
- [x] PVC persistence verified
- [x] Pod restart tested
- [x] Zero data loss confirmed
- [ ] Monitoring for PVC disk usage
- [ ] Backup strategy implemented
- [ ] Prometheus metrics configured
- [ ] PVC snapshot policy defined
