# DevCtl Usage Guide

## Current Status

Your system has backend services running that were NOT started by the docker-compose.yaml file:
- `metabob-surreal` (running, but not managed by compose)
- `metabob-redis` (running, but not managed by compose)  
- `api-server-dev` (running, but not managed by compose)
- `metabob-surrealist` (running, but not managed by compose)

The `docker-compose.yaml` file tries to create containers with the same names, causing conflicts.

## Solution: Choose Your Approach

### Approach 1: Fresh Start with Compose (Recommended)

Stop and remove existing containers, then use devctl:

```bash
# Stop all metabob containers
docker stop $(docker ps -q --filter name=metabob) $(docker ps -q --filter name=api-server) 2>/dev/null

# Remove containers
docker rm $(docker ps -aq --filter name=metabob) $(docker ps -aq --filter name=api-server) 2>/dev/null

# Start with devctl (will create fresh containers)
./bin/devctl start

# Check status
./bin/devctl status
```

### Approach 2: Use Existing Backend + Manual Devbob Start

Keep your existing backend running and start devbob containers manually:

```bash
# Build devbob image
docker build -t devbob:latest -f docker/Dockerfile.devbob .

# Create devbob network if needed
docker network create devbob-network 2>/dev/null || true

# Start a single devbob vessel (example: CLI)
docker run -d \
  --name devbob-cli \
  --network metabob-network \
  --network devbob-network \
  -p 3002:3000 \
  -p 8083:8082 \
  -v $(pwd)/repos/metabob-cli:/workspace \
  -e METABOB_API_URL=http://api-server-dev:8080 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e SURREAL_URL=ws://metabob-surreal:8000 \
  -e REDIS_URI=redis://metabob-redis:6379 \
  devbob:latest

# Check it's running
docker ps --filter name=devbob-cli
```

### Approach 3: Use Unified Compose File

The `docker-compose.unified.yaml` uses different service names:

```bash
# Start everything with unified compose
docker-compose -f docker-compose.unified.yaml --profile all up -d

# Or just infra + devbob
docker-compose -f docker-compose.unified.yaml --profile infra --profile devbob up -d

# Access devbob
docker exec -it devbob-clean sh
```

## DevCtl Commands

Once vessels are running (using any approach):

```bash
# Check status
./bin/devctl status

# Check health
./bin/devctl health

# View logs
./bin/devctl logs cli -f

# Open shell
./bin/devctl shell cli

# Execute command
./bin/devctl exec cli -- pytest

# Stop vessels
./bin/devctl stop

# Restart vessels
./bin/devctl restart
```

## Troubleshooting

### "Container name is already in use"
- Existing containers conflict with compose names
- Use **Approach 1** (fresh start) or **Approach 2** (manual)

### "depends on undefined service"
- Missing `--profile stable` when starting devbob-dev services
- Fixed in devctl script (includes both profiles)

### "Backend services not accessible"
- Check ports: `docker ps --filter name=metabob`
- Verify: http://localhost:8080/ (API), localhost:8000 (SurrealDB), localhost:6379 (Redis)

### Vessels show "stopped" in status
- They may not have been created yet
- Try: `./bin/devctl start` again
- Or use manual docker run (Approach 2)

## Recommended: Fresh Start

For the cleanest setup:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Clean slate
docker-compose down -v 2>/dev/null || true
docker stop $(docker ps -q --filter name=metabob) 2>/dev/null || true
docker stop $(docker ps -q --filter name=api-server) 2>/dev/null || true  
docker stop $(docker ps -q --filter name=devbob) 2>/dev/null || true
docker rm $(docker ps -aq --filter name=metabob) 2>/dev/null || true
docker rm $(docker ps -aq --filter name=api-server) 2>/dev/null || true
docker rm $(docker ps -aq --filter name=devbob) 2>/dev/null || true

# Start fresh
./bin/devctl start

# Verify
./bin/devctl status
./bin/devctl health
```

This ensures all containers are created and managed by docker-compose, eliminating conflicts.
