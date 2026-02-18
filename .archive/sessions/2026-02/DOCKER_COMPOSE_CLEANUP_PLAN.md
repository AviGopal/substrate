# Docker Compose Cleanup & Standardization Plan

## Current Situation ⚠️

### Running Containers (Mixed Sources)
```
devbob-clean              → from metabob-devbob (docker-compose.yaml) ✅
metabob-rpc-api-server-*  → from metabob-rpc-api (different project) ❌
metabob-redis             → from metabob-devbob (docker-compose.yaml) ✅
metabob-surreal           → from metabob-devbob (docker-compose.yaml) ✅
metabob-surrealist        → from metabob-devbob (docker-compose.yaml) ✅
```

**Problem**: Backend API was started from a different compose file, causing:
- DNS name mismatch (expected `api-server-dev`, got `metabob-rpc-api-server-dev-1`)
- Configuration drift
- Confusion about which compose file to use

### Docker Compose Files Inventory

**✅ KEEP - Main orchestration**:
- `docker-compose.yaml` (root) - 3 profiles: stable, devbob, devbob-dev

**❌ REMOVE/ARCHIVE - Obsolete**:
- `configs/docker-compose.devbob.yaml` - Superseded by main file
- `configs/docker-compose.devbob-integration.yaml` - Superseded
- `configs/docker-compose.devbob-integration-clean.yaml` - Superseded

**📦 NEED TO CREATE - Per-repo build/push**:
- `repos/metabob-rpc-api/docker-compose.build.yaml` - Build & push backend images
- `repos/metabob-cli/docker-compose.build.yaml` - Build & push CLI images
- `repos/metabob-opencode/docker-compose.build.yaml` - Build & push OpenCode/devbob images
- `repos/metabob-dashboard/docker-compose.build.yaml` - Build & push dashboard images

## Standardization Strategy

### 1. Single Source of Truth
**File**: `/docker-compose.yaml` (already exists)

**3 Profiles**:
```bash
# Profile 1: Backend services only
docker-compose --profile stable up -d

# Profile 2: Backend + single clean devbob (testing)
docker-compose --profile stable --profile devbob up -d

# Profile 3: Backend + 4 devbob agents (development)
docker-compose --profile stable --profile devbob-dev up -d
```

### 2. Per-Repo Build Compose Files
Each repo gets a `docker-compose.build.yaml` for CI/CD:

**Purpose**:
- Build Docker images
- Push to registry
- Tag versions
- No service orchestration (that's in main compose file)

**Example** (`repos/metabob-rpc-api/docker-compose.build.yaml`):
```yaml
services:
  build-api:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
      tags:
        - "metabobapp/metabob-rpc-api:${VERSION:-latest}"
        - "metabobapp/metabob-rpc-api:${GIT_SHA:-dev}"
    image: metabobapp/metabob-rpc-api:${VERSION:-latest}
```

### 3. Directory Structure
```
metabob-devbob/
├── docker-compose.yaml           # Main orchestration (3 profiles) ✅
├── .env.devbob                   # Environment variables ✅
├── docker/
│   ├── Dockerfile.devbob         # Devbob image
│   ├── devbob-entrypoint.sh      # Devbob startup
│   └── entrypoint.sh             # Generic startup
└── repos/
    ├── metabob-rpc-api/
    │   ├── docker-compose.build.yaml  # Build/push only 📦
    │   └── docker/
    │       └── Dockerfile.server
    ├── metabob-cli/
    │   └── docker-compose.build.yaml  # Build/push only 📦
    ├── metabob-opencode/
    │   └── docker-compose.build.yaml  # Build/push only 📦
    └── metabob-dashboard/
        └── docker-compose.build.yaml  # Build/push only 📦
```

## Migration Steps

### Step 1: Stop All Containers
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Stop everything
docker-compose down
docker stop metabob-rpc-api-server-dev-1 celery-worker-dev-1 2>/dev/null
```

### Step 2: Clean Up Obsolete Compose Files
```bash
# Archive old compose files
mkdir -p .archive/docker-compose-old
mv configs/docker-compose.*.yaml .archive/docker-compose-old/

# Keep only Dockerfile.devbob in configs (or move to docker/)
```

### Step 3: Verify Main Compose File
```bash
# Check profiles are correct
docker-compose config --profiles

# Should show: stable, devbob, devbob-dev
```

### Step 4: Start with Canonical Compose File
```bash
# Start backend + clean devbob
docker-compose --profile stable --profile devbob up -d

# Verify all services started correctly
docker-compose ps
```

### Step 5: Create Per-Repo Build Compose Files
For each repo, create `docker-compose.build.yaml` for CI/CD.

### Step 6: Update Documentation
Update all references to use canonical compose file.

## Detailed Actions

### Action 1: Archive Obsolete Files
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Create archive directory
mkdir -p .archive/docker-compose-obsolete-2026-02-16

# Move obsolete files
mv configs/docker-compose.devbob.yaml \
   configs/docker-compose.devbob-integration.yaml \
   configs/docker-compose.devbob-integration-clean.yaml \
   .archive/docker-compose-obsolete-2026-02-16/

# Add note
cat > .archive/docker-compose-obsolete-2026-02-16/README.md << 'EOF'
# Obsolete Docker Compose Files

Archived on: 2026-02-16
Reason: Superseded by main docker-compose.yaml with 3 profiles

These files are kept for historical reference only.
Do not use these files - use /docker-compose.yaml instead.

## Migration
All functionality moved to:
- docker-compose.yaml (stable, devbob, devbob-dev profiles)
- repos/*/docker-compose.build.yaml (per-repo build/push)
EOF
```

### Action 2: Create Build Compose Template
```bash
# Template for per-repo build files
cat > /tmp/docker-compose.build.template.yaml << 'EOF'
# Build and push images only - no service orchestration
# Usage:
#   docker-compose -f docker-compose.build.yaml build
#   docker-compose -f docker-compose.build.yaml push

services:
  build:
    build:
      context: .
      dockerfile: docker/Dockerfile.server  # Adjust per repo
      tags:
        - "metabobapp/REPO_NAME:${VERSION:-latest}"
        - "metabobapp/REPO_NAME:${GIT_SHA:-dev}"
    image: metabobapp/REPO_NAME:${VERSION:-latest}
EOF
```

### Action 3: Restart Everything Cleanly
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Stop everything
docker-compose down
docker stop metabob-rpc-api-server-dev-1 2>/dev/null

# Start with canonical compose file
docker-compose --profile stable --profile devbob up -d

# Wait for health checks
sleep 30

# Verify
docker-compose ps
curl http://localhost:8080/health  # Backend
curl http://localhost:3000/config  # Devbob ACP
```

## Expected Results

### After Cleanup
1. ✅ Single compose file for orchestration
2. ✅ All containers started from same compose project
3. ✅ DNS names work correctly (api-server-dev resolves)
4. ✅ Per-repo build files for CI/CD
5. ✅ No confusion about which compose file to use

### Container Naming (After Fix)
```
api-server-dev          # Backend API (correct name now!)
metabob-redis           # Redis cache
metabob-surreal         # SurrealDB
metabob-surrealist      # DB UI
celery-worker           # Async worker
devbob-clean            # Clean test environment
```

### Commands (Standardized)
```bash
# Backend only
docker-compose --profile stable up -d

# Backend + clean devbob for testing
docker-compose --profile stable --profile devbob up -d

# Backend + 4 devbob agents for development
docker-compose --profile stable --profile devbob-dev up -d

# Build an image (from repo directory)
cd repos/metabob-rpc-api
docker-compose -f docker-compose.build.yaml build

# Stop everything
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose down
```

## Benefits

1. **Single source of truth** - No confusion about which file to use
2. **Consistent naming** - Container names match service names
3. **Profile-based** - Easy to switch between configurations
4. **Separation of concerns** - Orchestration vs build/push
5. **Repo independence** - Each repo controls its own build process
6. **CI/CD ready** - Build files designed for automation

## Next Steps

1. [ ] Archive obsolete compose files
2. [ ] Stop all containers
3. [ ] Restart with canonical compose file
4. [ ] Verify DNS names work
5. [ ] Create per-repo build compose files
6. [ ] Update documentation
7. [ ] Test logging fixes in clean environment

## Quick Start After Cleanup

```bash
# One-liner to restart everything cleanly
cd /home/avi/documents/work/exp-repo/metabob-devbob && \
docker-compose down && \
docker-compose --profile stable --profile devbob up -d && \
sleep 30 && \
docker-compose ps && \
curl -sf http://localhost:3000/config | jq -r '.model'
```
