# Deployment Quick Reference

## Check Cluster State

```bash
# Verify cluster connectivity
kubectl cluster-info
kubectl config current-context

# Get all deployments
kubectl get deployments --all-namespaces -o wide

# Get all pods with images
kubectl get pods --all-namespaces -o wide

# Get services
kubectl get svc --all-namespaces | grep metabob

# Get all images in use
kubectl get pods --all-namespaces -o jsonpath="{.items[*].spec.containers[*].image}" | tr -s '[[:space:]]' '\n' | sort | uniq
```

## Helmfile Commands

```bash
cd repos/platform/environments

# Check status
helmfile status

# Show differences
helmfile diff

# List releases
helmfile list

# Sync deployment
helmfile sync

# Apply specific environment
helmfile -e production sync
helmfile -e integration sync
```

## Local Container State

```bash
# View running containers
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# View all containers (including stopped)
docker ps -a

# Check images
docker images | grep -E "devbob|metabob"

# Check logs
docker logs devbob-clean --tail 100
docker logs api-server-dev --tail 100
docker logs metabob-celery-worker --tail 100
```

## Docker Compose Profiles

```bash
# Stable backend only
docker-compose --profile stable up -d

# Clean devbob testing
docker-compose --profile stable --profile devbob up -d

# Full development environment
docker-compose --profile stable --profile devbob-dev up -d

# View logs
docker-compose --profile stable logs -f

# Stop all
docker-compose --profile stable --profile devbob --profile devbob-dev down
```

## Version Checks

### Local Versions
```bash
# API Server
docker inspect api-server-dev | jq '.[0].Config.Image'

# Devbob
docker inspect devbob-clean | jq '.[0].Config.Image'
```

### Production Versions
```bash
cat repos/platform/environments/production/production.yaml
```

### Cluster Versions
```bash
kubectl get deployment <name> -n <namespace> -o jsonpath='{.spec.template.spec.containers[*].image}'
```

## Troubleshooting

### Fix Celery Worker
```bash
docker logs metabob-celery-worker --tail 100
docker-compose --profile stable restart celery-worker
```

### Rebuild Devbob Image
```bash
docker build -t devbob:latest --target devbob-base -f docker/Dockerfile.devbob .
```

### Reset Environment
```bash
# Stop all
docker-compose --profile stable --profile devbob --profile devbob-dev down

# Remove volumes (data loss!)
docker-compose --profile stable --profile devbob --profile devbob-dev down -v

# Rebuild and restart
docker-compose --profile stable build
docker-compose --profile stable up -d
```

## Health Checks

### Local Services
```bash
# API Server
curl http://localhost:8080/health

# Devbob ACP
curl http://localhost:3000/config

# Redis
redis-cli -h localhost -p 6379 ping

# SurrealDB
curl http://localhost:8000/health
```

### Cluster Services
```bash
kubectl get pods -n <namespace> -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'
```
