# DevBob Container Build & Deployment Guide

This guide covers building, testing, and deploying the DevBob container system with self-configuration capabilities.

## 🏗️ Architecture Overview

DevBob is a containerized AI agent system with:
- **OpenCode Standalone Binary**: CLI and ACP server (`metabob-opencode`)
- **Metabob CLI Tools**: Python MCP server (`metabob-cli`)
- **Self-Configuration**: Auto-detects environment and configures on startup
- **Backend Integration**: Connects to Metabob RPC API for code quality features

## 📦 Container Components

### Required Binaries
1. **metabob-opencode** (130MB standalone binary)
   - Built with Bun from TypeScript source
   - Includes activity templates embedded
   - Provides CLI, TUI, and ACP server

2. **metabob-cli** (Python venv)
   - MCP tools for code analysis
   - SurrealDB client for activity storage
   - Redis client for caching

### Container Profiles

#### 1. `stable` - Backend Services
```bash
docker-compose --profile stable up -d
```
**Services:**
- `redis` - Caching and pub/sub
- `surreal` - SurrealDB for activity/CPG storage
- `surrealist` - Web UI for SurrealDB
- `metabob-rpc-api-server` - Code analysis API
- `celery-worker` - Background job processing

#### 2. `devbob` - Single Clean Container
```bash
docker-compose --profile stable --profile devbob up -d
```
**Services:**
- `devbob-clean` - Isolated agent with empty workspace
- **Use case:** Testing activities in clean environment

#### 3. `devbob-dev` - Development Containers
```bash
docker-compose --profile stable --profile devbob-dev up -d
```
**Services:**
- `devbob-rpc-api` - Manages metabob-rpc-api codebase
- `devbob-cli` - Manages metabob-cli codebase
- `devbob-opencode` - Manages metabob-opencode codebase
- `devbob-dashboard` - Manages metabob-dashboard codebase
- **Use case:** Multi-agent codebase management

## 🔨 Building from Source

### Prerequisites
- Docker 20.10+
- Bun 1.1.45+ (for building OpenCode)
- Node.js 18+ (for fix scripts)

### Build Process

#### Step 1: Build OpenCode Binary
```bash
cd repos/metabob-opencode
bun install
cd packages/opencode
bun run build --single
```

**Output:** `dist/opencode-linux-x64/bin/opencode` (130MB)

#### Step 2: Build DevBob Container
```bash
docker build -f docker/Dockerfile.devbob -t devbob:latest .
```

**Build stages:**
1. `metabob-cli-builder` - Installs Python dependencies in venv
2. `opencode-binary` - Copies pre-built OpenCode binary
3. `runtime` - Lightweight Debian image with both binaries

**Build time:** ~2-3 minutes (with pre-built OpenCode)

#### Step 3: Tag for Registry
```bash
docker tag devbob:latest metabobapp/devbob:v1.0.X
docker tag devbob:latest metabobapp/devbob:latest
```

### Quick Build Script
```bash
#!/bin/bash
set -e

# Build OpenCode
cd repos/metabob-opencode
bun install
cd packages/opencode
bun run build --single

# Build DevBob container
cd ../../../
docker build -f docker/Dockerfile.devbob -t devbob:latest .

echo "✅ DevBob built successfully!"
docker run --rm devbob:latest --version
```

## 🚀 Deployment

### Local Development

#### 1. Start Backend Services
```bash
# Create networks
docker network create metabob-network
docker network create devbob-network

# Start services
docker-compose --profile stable up -d

# Wait for health checks
docker-compose --profile stable ps
```

#### 2. Start DevBob Container
```bash
docker run -d --name devbob-dev \
  --network metabob-network \
  -e METABOB_API_URL=http://api-server-dev:8080 \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e WAIT_FOR_BACKEND=true \
  -e SKIP_CONFIG=false \
  -p 3000:3000 \
  devbob:latest
```

#### 3. Check Logs
```bash
docker logs -f devbob-dev
```

**Expected output:**
```
===================================
DevBob Container Self-Configuration
===================================

[INFO] Step 1: Detecting environment...
[INFO]   Hostname: devbob-dev
[INFO]   Detected Environment: development
[INFO]   Config File: /workspace/opencode.json
[INFO] Step 2: Validating backend connectivity...
[INFO]   ✓ Backend is reachable at http://api-server-dev:8080
[INFO] Step 3: Validating environment variables...
[INFO]   ✓ ANTHROPIC_API_KEY is set
[INFO]   ✓ METABOB_API_URL: http://api-server-dev:8080
[INFO] Step 4: Running self-configuration...
[INFO]   Executing configure-vessel-for-environment activity...
[INFO] Step 5: Configuration Summary
[INFO]   Environment: development
[INFO]   Backend URL: http://api-server-dev:8080
===================================
DevBob Ready!
===================================
```

### Production Deployment

#### Environment Variables
```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...           # LLM provider credentials

# Backend connection
METABOB_API_URL=https://api.metabob.com
METABOB_PROJECT_ID=my-project-id
METABOB_API_KEY=metabob-api-key

# Container configuration
WAIT_FOR_BACKEND=true                  # Wait for backend before starting
SKIP_CONFIG=false                      # Run self-configuration
CONFIG_FILE=/workspace/opencode.json   # Config file path
LOG_LEVEL=INFO                         # Logging verbosity
```

#### Docker Compose Production
```yaml
services:
  devbob-prod:
    image: metabobapp/devbob:latest
    container_name: devbob-prod
    environment:
      - METABOB_API_URL=https://api.metabob.com
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - WAIT_FOR_BACKEND=true
      - SKIP_CONFIG=false
    ports:
      - "3000:3000"
    volumes:
      - devbob_workspace:/workspace
      - devbob_config:/root/.local/share/opencode
    restart: unless-stopped
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically builds and deploys DevBob on push to main/develop branches.

**Workflow:** `.github/workflows/build-devbob.yml`

#### Jobs

1. **build-opencode**
   - Checks out code with submodules
   - Installs Bun
   - Builds OpenCode binary
   - Uploads artifact for next job

2. **build-and-push**
   - Downloads OpenCode binary
   - Builds DevBob container
   - Pushes to Docker Hub
   - Tags: `latest`, `main-{sha}`, `v{version}`

3. **integration-test**
   - Starts backend services
   - Pulls DevBob image
   - Runs smoke tests
   - Validates self-configuration

#### Triggering Builds

**Automatic (on push):**
```bash
git push origin main
```

**Manual (workflow_dispatch):**
```bash
gh workflow run build-devbob.yml --ref main -f tag=v1.0.5
```

#### Required Secrets

Configure in GitHub Settings → Secrets:
- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password or token
- `ANTHROPIC_API_KEY` - For integration tests

### Continuous Deployment

After CI builds succeed:

1. **Update staging:**
```bash
kubectl set image deployment/devbob devbob=metabobapp/devbob:main-abc1234
```

2. **Promote to production:**
```bash
kubectl set image deployment/devbob devbob=metabobapp/devbob:v1.0.5 -n production
```

## 🧪 Testing

### Smoke Tests
```bash
# Version check
docker run --rm devbob:latest --version

# Help command
docker run --rm devbob:latest --help

# Binary verification
docker run --rm devbob:latest which opencode
docker run --rm devbob:latest python3 --version
```

### Integration Tests
```bash
# Start full environment
docker-compose --profile stable --profile devbob up -d

# Wait for services
sleep 30

# Check devbob-clean health
docker exec devbob-clean opencode --version

# Run activity test
docker exec devbob-clean opencode activity list

# Check Metabob connectivity
docker exec devbob-clean opencode metabob test
```

### Manual Testing
```bash
# Interactive shell
docker exec -it devbob-clean /bin/bash

# Inside container:
opencode --version
opencode activity list
opencode metabob test
python3 -c "import anthropic; print('✓ Anthropic SDK')"
```

## 🐛 Troubleshooting

### Build Failures

**Issue:** OpenCode binary not found
```
ERROR: "/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode": not found
```
**Solution:** Build OpenCode first:
```bash
cd repos/metabob-opencode && bun install && bun run build --single
```

**Issue:** Repos excluded by .dockerignore
```
ERROR: failed to calculate checksum of ref: "/repos/metabob-cli": not found
```
**Solution:** Check `.dockerignore` allows required repos:
```
!repos/metabob-cli/
!repos/metabob-opencode/
!repos/metabob-proto/
!repos/metabob-rpc-api/
```

### Runtime Issues

**Issue:** ANTHROPIC_API_KEY not set
```
[ERROR] ✗ ANTHROPIC_API_KEY not set
[ERROR] Container cannot function without LLM provider credentials
```
**Solution:** Pass API key via environment variable:
```bash
docker run -e ANTHROPIC_API_KEY="sk-ant-..." devbob:latest
```

**Issue:** Backend not reachable
```
[WARN] Backend not ready, retrying (30/30)...
[ERROR] ✗ Backend not reachable after 30 attempts
```
**Solution:** Check backend services are running:
```bash
docker ps | grep api-server
curl http://localhost:8080/health
```

**Issue:** ACP server fails to start
```
Error: Cannot find module '@openauthjs/openauth/pkce'
```
**Solution:** This is a known issue with optional dependencies. Skip ACP server:
```bash
docker run devbob:latest serve --port 8080
```

## 📚 Related Documentation

- [DEVBOB_DEPLOYMENT_WORKFLOW.md](DEVBOB_DEPLOYMENT_WORKFLOW.md) - Detailed deployment architecture
- [DEPLOYMENT_ARCHITECTURAL_BOUNDARIES.md](DEPLOYMENT_ARCHITECTURAL_BOUNDARIES.md) - Component boundaries
- [docker-compose.yaml](docker-compose.yaml) - Multi-profile compose configuration
- [docker/Dockerfile.devbob](docker/Dockerfile.devbob) - Container build definition

## 🔗 Container Registry

**Docker Hub:** https://hub.docker.com/r/metabobapp/devbob

**Tags:**
- `latest` - Latest stable build from main branch
- `main-{sha}` - Commit-specific builds from main
- `develop-{sha}` - Development builds
- `v{version}` - Semantic versioned releases

**Pull command:**
```bash
docker pull metabobapp/devbob:latest
```
