# DevCtl Start Issue - Fix Instructions

## Problem
`./bin/devctl start` fails with:
```
Error response from daemon: Conflict. The container name "/metabob-surreal" is already in use
```

## Root Cause
- Existing containers (`metabob-surreal`, `api-server-dev`) conflict with docker-compose.yaml naming
- These containers were started manually or with a different compose file
- Docker Compose cannot create new containers with the same names

## Solutions

### Option 1: Clean Start (Recommended for Fresh Environment)
```bash
# Stop and remove conflicting containers
docker stop metabob-surreal metabob-redis api-server-dev metabob-surrealist metabob-celery-worker 2>/dev/null || true
docker rm metabob-surreal metabob-redis api-server-dev metabob-surrealist metabob-celery-worker 2>/dev/null || true

# Start with devctl
./bin/devctl start
```

### Option 2: Use Unified Compose (Different Service Names)
```bash
# Uses docker-compose.unified.yaml with non-conflicting names
docker-compose -f docker-compose.unified.yaml --profile all up -d

# Access devbob-clean
docker exec -it devbob-clean sh
```

### Option 3: Manual Start of DevBob Vessels (Use Existing Backend)
Since backend is already running, just start devbob containers:

```bash
# Build devbob image if needed
docker build -t devbob:latest -f docker/Dockerfile.devbob .

# Start individual vessels manually
docker run -d \
  --name devbob-rpc-api \
  --network metabob-network \
  -p 3001:3000 \
  -v ./repos/metabob-rpc-api:/workspace \
  -e METABOB_API_URL=http://api-server-dev:8080 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  devbob:latest
```

### Option 4: Update DevCtl to Work with Existing Containers
I've updated `devctl` to include profile fixes, but container name conflicts remain. 

## Changes Made to devctl
- ✅ Added `--profile stable` to devbob-dev start commands
- ✅ Added `--no-recreate` flag to avoid recreating existing containers  
- ✅ Added health checks for backend accessibility
- ✅ Better error handling and warnings

## Recommended Immediate Action
**Option 1** is cleanest for development. Run:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Clean up conflicting containers
docker stop $(docker ps -a --filter name=metabob --format "{{.Names}}") 2>/dev/null || true
docker rm $(docker ps -a --filter name=metabob --format "{{.Names}}") 2>/dev/null || true

# Start fresh with devctl
./bin/devctl start
```

## Verification
After starting, check status:
```bash
./bin/devctl status
./bin/devctl health
```

Expected output:
- All vessels: `running` status
- Health: `healthy` or `starting`
- Backend services accessible on:
  - API: http://localhost:8080
  - SurrealDB: http://localhost:8000
  - Redis: localhost:6379
