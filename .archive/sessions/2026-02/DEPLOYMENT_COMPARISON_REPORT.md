# Deployment State vs Local Container Changes - Comparison Report

**Generated:** Mon Feb 16 2026  
**Cluster Context:** metabob-production  
**Analysis Period:** Last 14 days of container changes

---

## Executive Summary

This report compares the current deployment state in the `repos/platform` Kubernetes cluster with recent local container development changes in the `docker/` directory.

### Key Findings

1. **Cluster Connection:** ⚠️  Kubectl commands are timing out - cluster may require authentication or is slow to respond
2. **Local Development:** ✅ Active development on devbob containers with significant improvements
3. **Image Versions:** Mixed state between production deployment configs and local development images
4. **Architecture Shift:** Local development has moved to profile-based architecture

---

## 1. Current Deployment State (repos/platform)

### 1.1 Helmfile Configuration

**Main Helmfile:** `repos/platform/environments/helmfile.yaml`

#### Deployed Services (from helmfile):
- **Infrastructure:**
  - `minio` - bitnami/minio v7.1.1
  - `redis` - bitnami/redis
  
- **Core Services:**
  - `config` - Local chart
  - `backend` - Local chart
  - `authentication` - Local chart
  - `bitbucket` - Local chart
  - `github` - Local chart
  - `workflows` - Local chart
  - `frontend` - Local chart
  - `metabob-site` - Local chart
  - `istio-application` - Local chart

- **Supporting Services:**
  - `argo-workflows` (via helmfile)
  - `argo-events` (via helmfile)

### 1.2 Production Environment Configuration

**File:** `repos/platform/environments/production/production.yaml`

```yaml
imageRegistry: metabobapp
release: production

application:
  backend:
    tag: 0.5.23
  frontend:
    tag: 0.4.0-integration
  workflow:
    tag: 2.0.1
```

### 1.3 Cluster Status

**Current Context:** `metabob-production`

**Attempted Commands:**
```bash
# kubectl get deployments --all-namespaces
# kubectl get pods --all-namespaces
# kubectl get services --all-namespaces
```

**Status:** ⚠️ **Timeout** - Commands exceeded 60s timeout period

**Possible Causes:**
- Cluster authentication required
- Network latency or connectivity issues
- Large cluster with many resources
- API server performance issues

**Recommendation:** 
```bash
# Verify cluster connectivity
kubectl cluster-info

# Check authentication
kubectl auth can-i get pods --all-namespaces

# Try with specific namespace
kubectl get pods -n default
kubectl get pods -n metabob
```

---

## 2. Local Container Changes (Last 14 Days)

### 2.1 Recent Container-Related Commits

```
be361a3  docs: Complete session summary for deduplication fix testing
23a6bd3  test: Comprehensive deduplication fix verification with test harness
f3ba48e  docs: Document deduplication fix deployment and verification
4709295  feat: Self-improvement feedback loop implementation
ea37542  fix: Use correct bun run command for OpenCode
7b38571  feat: Complete devbob Docker image build with Bun
17e0c97  wip: Dockerfile improvements for container isolation
cdacbfb  feat: Implement container configuration isolation
21cf60e  docs: Document delegation test results and root cause
3c43295  chore: Standardize on profile-based docker-compose
a499c0b  docs: Complete devbob clean environment setup
a58ecb1  feat: Start devbob clean container environment
b5c7f7a  feat: Add profile-based docker-compose architecture
c798001  docs: Document root cause of search_activities returning empty
8838f83  feat: add DevBob quick mode and streamline infrastructure
```

### 2.2 Major Changes Summary

#### **1. Devbob Image Build (Commits: 17e0c97, 7b38571, ea37542)**

**Achievement:** Successfully built devbob Docker image from source with OpenCode and metabob-cli integration.

**Key Components:**
- Base image: `node:20-slim`
- Python 3.11 venv for metabob-cli
- Bun package manager for OpenCode
- Multi-stage build architecture

**Stages:**
1. `devbob-base` - Base image with OpenCode + metabob-cli
2. `devbob-clean` - Clean testing environment (no code)
3. `devbob-dev` - Development environment (code mounted)

**Technical Details:**
```dockerfile
# System Dependencies
- curl, git, python3, python3-venv, build-essential, unzip

# metabob-cli Installation
- Python venv at /opt/metabob-cli/.venv
- Dependencies: anthropic, mcp, httpx, pydantic, python-dotenv, surrealdb, redis
- Source copied directly to venv (bypasses Python 3.12 requirement)

# OpenCode Installation
- Bun package manager
- Repos copied to /opt/repos/metabob-proto and /opt/repos/metabob-opencode
- Wrapper script: bun run --cwd packages/opencode --conditions=browser ./src/index.ts

# Configuration
- Container-first config strategy
- MCP integration configured
- ACP server on port 3000
```

**Issues Resolved:**
- ✅ JSX runtime error (React vs Solid.js) - Fixed by matching package.json dev script
- ✅ Catalog protocol support - Resolved by using Bun instead of npm
- ✅ Python 3.12 requirement - Bypassed by copying source to venv

**Image Size:** ~2GB (includes Node, Python, Bun, OpenCode, metabob-cli)  
**Build Time:** ~3-4 minutes

#### **2. Profile-Based Architecture (Commits: b5c7f7a, 3c43295)**

**New docker-compose.yaml** with three deployment profiles:

**Profile 1: `stable`** - Stable Backend Services
```yaml
Services:
- redis (Redis 7-alpine)
- surreal (SurrealDB latest)
- surrealist (SurrealDB UI)
- metabob-rpc-api-server (metabobapp/metabob-rpc-api:0.16.12)
- celery-worker (metabobapp/metabob-rpc-api:0.16.12)
```

**Profile 2: `devbob`** - Single Clean Container for Testing
```yaml
Services:
- devbob-clean (devbob:latest)
  - Empty workspace
  - ACP port: 3000
  - MCP port: 8082
  - No repo mounting
```

**Profile 3: `devbob-dev`** - Multiple Development Containers
```yaml
Services:
- devbob-rpc-api (devbob:latest, port 3001)
- devbob-cli (devbob:latest, port 3002)
- devbob-opencode (devbob:latest, port 3003)
- devbob-dashboard (devbob:latest, port 3004)

Each with:
- Mounted local repo
- Dedicated ACP port
- MCP server
- Agent role assignment
```

**Usage:**
```bash
# Start stable backend only
docker-compose --profile stable up -d

# Start clean devbob for testing
docker-compose --profile stable --profile devbob up -d

# Start full development environment
docker-compose --profile stable --profile devbob-dev up -d
```

#### **3. Container Configuration Isolation (Commit: cdacbfb)**

**Approach:** Container-first configuration strategy
- Always recreates configs on container start
- MCP section included in opencode.json
- Shared backend URL across containers
- Configuration via environment variables

---

## 3. Local Docker Images

### 3.1 Current Local Images

```
IMAGE                                       IMAGE ID         SIZE        USED SIZE
devbob:dev                                  51e95d25648e     3.81GB      945MB        
devbob:latest                               7cfbb2aad552     5.6GB       1.47GB       
metabob-rpc-api-api-worker-dev:latest       74d78676c4e5     1.67GB      382MB        
metabob-rpc-api-server-dev:latest           dfc75f98dae5     1.67GB      382MB        
metabobapp/metabob-dashboard:2.2.1          d611c63337c6     97.5MB      26.4MB        
metabobapp/metabob-rpc-api:0.12.0           7fc0281a366f     378MB       113MB        
metabobapp/metabob-rpc-api:0.12.1           d469b2401cf6     379MB       113MB        
metabobapp/metabob-rpc-api:0.16.12          d591156a47f7     1.87GB      430MB        
```

### 3.2 Currently Running Containers

```
NAME                          IMAGE                                STATUS                          PORTS
devbob-clean                  devbob:latest                        Up 2 days (healthy)             0.0.0.0:3000->3000/tcp, 8082
metabob-redis                 redis:7-alpine                       Up 2 days (healthy)             0.0.0.0:6379->6379/tcp
metabob-surreal               surrealdb/surrealdb:latest           Up 2 days (healthy)             0.0.0.0:8000->8000/tcp
metabob-surrealist            surrealdb/surrealist:latest          Up 2 days                       0.0.0.0:8001->8080/tcp
api-server-dev                metabobapp/metabob-rpc-api:0.16.12   Created                         
metabob-rpc-api-server-dev-1  metabob-rpc-api-server-dev           Up 19 minutes                   0.0.0.0:8080->8080/tcp
metabob-celery-worker         83549fef0419                         Restarting (2)                  
metabob-rpc-api-redis-1       redis                                Up 3 hours                      6379/tcp
metabob-rpc-api-surreal-1     surrealdb/surrealdb:latest           Up 3 hours                      8000/tcp
```

**Status:**
- ✅ devbob-clean: Running for 2 days, healthy
- ✅ Backend services: Redis and SurrealDB stable
- ⚠️  metabob-celery-worker: Restarting (error state)
- ⚠️  Several containers created but not started

---

## 4. Version Comparison

### 4.1 Backend API Versions

| Environment | Version | Notes |
|-------------|---------|-------|
| **Production (helmfile)** | 0.5.23 | Tagged in production.yaml |
| **Local Running** | 0.16.12 | Much newer version! |
| **Local Images** | 0.12.0, 0.12.1, 0.16.12 | Multiple versions available |

**⚠️  CRITICAL DISCREPANCY:** Local containers are running version `0.16.12` while production deployment specifies version `0.5.23`. This could indicate:
1. Different versioning schemes (major.minor.patch vs 0.major.minor)
2. Local development ahead of production
3. Need for deployment update

### 4.2 Frontend Versions

| Environment | Version | Notes |
|-------------|---------|-------|
| **Production (helmfile)** | 0.4.0-integration | Tagged in production.yaml |
| **Local Dashboard** | 2.2.1 | Image available |

### 4.3 Infrastructure Versions

| Component | Production | Local | Match? |
|-----------|------------|-------|--------|
| Redis | bitnami/redis | redis:7-alpine | ❌ Different images |
| SurrealDB | N/A in helmfile | surrealdb:latest | ❌ Not in production config |
| Minio | bitnami/minio v7.1.1 | N/A | ❌ Not running locally |

---

## 5. Architecture Differences

### 5.1 Production (repos/platform)

**Orchestration:** Kubernetes via Helmfile
- Helm charts for each service
- Environment-based configuration
- Namespace isolation
- Service mesh (Istio)
- Ingress/Gateway configuration

**Services:**
- Backend (multiple replicas)
- Frontend
- Authentication service
- Integration services (GitHub, Bitbucket)
- Workflows (Argo)
- Minio storage
- Redis cache

### 5.2 Local Development

**Orchestration:** Docker Compose with profiles
- Profile-based deployment
- Direct container management
- Network isolation via Docker networks
- Volume mounting for development

**Services:**
- Backend API server (single instance)
- Celery worker
- Redis
- SurrealDB (not in production helmfile)
- Devbob agents (development containers)

---

## 6. Gap Analysis

### 6.1 Services in Production but not Local

1. **Minio** (Object Storage)
   - Production: bitnami/minio v7.1.1
   - Local: Not running
   - **Impact:** File/object storage functionality unavailable locally

2. **Frontend Service**
   - Production: metabobapp frontend:0.4.0-integration
   - Local: Not in main docker-compose
   - **Impact:** Full UI testing requires separate setup

3. **Authentication Service**
   - Production: Dedicated auth service
   - Local: Not running
   - **Impact:** Auth flows may differ

4. **Integration Services**
   - Production: GitHub and Bitbucket integration services
   - Local: Not running
   - **Impact:** Repository integrations unavailable

5. **Argo Workflows**
   - Production: Workflow orchestration
   - Local: Not running
   - **Impact:** Workflow features unavailable

### 6.2 Services Local but not in Production Config

1. **SurrealDB**
   - Local: surrealdb:latest (primary database)
   - Production: Not mentioned in helmfile
   - **Impact:** Database technology mismatch?

2. **Devbob Containers**
   - Local: 4 specialized agent containers
   - Production: Development-only, not for production
   - **Impact:** None - these are development tools

3. **Surrealist UI**
   - Local: Database management UI
   - Production: Development-only
   - **Impact:** None - admin tool

---

## 7. Recent Container Changes Impact

### 7.1 Positive Improvements ✅

1. **Build from Source**
   - Can now build devbob image completely from source
   - No dependency on pre-built binaries
   - Reproducible builds

2. **Profile Architecture**
   - Clean separation of concerns
   - Easy to spin up different environments
   - Resource-efficient (only start what you need)

3. **Container Isolation**
   - Each agent has dedicated environment
   - Configuration properly isolated
   - Better debugging and testing

4. **Configuration Management**
   - Container-first approach
   - Environment variable driven
   - Consistent across containers

### 7.2 Potential Issues ⚠️

1. **Version Drift**
   - Local API version (0.16.12) vs Production (0.5.23)
   - Need to verify compatibility
   - May cause integration issues

2. **Database Mismatch**
   - SurrealDB used locally but not mentioned in production
   - Need to clarify production database strategy
   - Data migration concerns

3. **Missing Local Services**
   - Minio not running locally
   - Auth service not running
   - May cause feature parity issues

4. **Celery Worker Failing**
   - Currently in restart loop
   - Background job processing affected
   - Needs investigation

---

## 8. Recommendations

### 8.1 Immediate Actions

1. **Fix Cluster Connectivity** 🔴 HIGH
   ```bash
   # Verify cluster access
   kubectl cluster-info
   kubectl get nodes
   
   # If authentication needed
   doctl kubernetes cluster kubeconfig save <cluster-name>
   ```

2. **Fix Celery Worker** 🔴 HIGH
   ```bash
   # Check logs
   docker logs metabob-celery-worker
   
   # Verify configuration
   docker exec metabob-celery-worker env | grep CELERY
   
   # Restart with clean state
   docker-compose --profile stable restart celery-worker
   ```

3. **Verify Version Strategy** 🟡 MEDIUM
   - Clarify versioning scheme (0.5.x vs 0.16.x)
   - Document production vs development version alignment
   - Create version compatibility matrix

### 8.2 Documentation Improvements

1. **Deployment Guide**
   - Document kubectl setup for repos/platform
   - Create runbook for common deployment tasks
   - Add troubleshooting section

2. **Local Development Setup**
   - Document profile usage
   - Explain when to use each profile
   - Add quick start guide

3. **Version Management**
   - Document release process
   - Clarify version numbering
   - Track production vs staging vs local versions

### 8.3 Architecture Alignment

1. **Database Strategy** 🟡 MEDIUM
   - Clarify if SurrealDB is production database
   - If not, add appropriate database to local setup
   - Document data migration strategy

2. **Service Parity** 🟢 LOW
   - Consider adding Minio to local docker-compose
   - Add optional profile for frontend
   - Document which services are production-only

3. **Monitoring & Health Checks**
   - Add health check endpoints to all services
   - Implement container health monitoring
   - Set up logging aggregation

---

## 9. Commands for Further Investigation

### 9.1 Check Deployed Services

```bash
# Once cluster connectivity is restored
kubectl get all --all-namespaces | grep metabob
kubectl get deployments -n <namespace> -o wide
kubectl describe deployment <deployment-name> -n <namespace>

# Check running pods and their images
kubectl get pods -n <namespace> -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}'

# Get service endpoints
kubectl get svc --all-namespaces | grep metabob
```

### 9.2 Helmfile Status

```bash
cd repos/platform/environments
helmfile status
helmfile diff
helmfile list
```

### 9.3 Image Versions in Cluster

```bash
# Get all container images in use
kubectl get pods --all-namespaces -o jsonpath="{.items[*].spec.containers[*].image}" | tr -s '[[:space:]]' '\n' | sort | uniq -c
```

### 9.4 Local Container Investigation

```bash
# Check all container versions
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Inspect specific containers
docker inspect devbob-clean | jq '.[0].Config.Image'
docker inspect api-server-dev | jq '.[0].Config.Image'

# Check logs
docker-compose --profile stable logs metabob-rpc-api-server
docker logs metabob-celery-worker --tail 100
```

---

## 10. Summary

### Current State
- **Cluster:** `metabob-production` context active, but commands timing out
- **Local:** Active development with new devbob architecture running successfully
- **Images:** Multiple versions present, version 0.16.12 running locally vs 0.5.23 in production config
- **Architecture:** Production uses Kubernetes/Helmfile, local uses Docker Compose with profiles

### Key Gaps
1. Cannot verify actual deployed state due to cluster connectivity
2. Version discrepancy between local (0.16.12) and production config (0.5.23)
3. Database technology unclear (SurrealDB local vs production)
4. Service parity issues (Minio, Auth, Frontend)

### Next Steps
1. Restore cluster connectivity
2. Get actual deployment state via kubectl/helmfile
3. Compare image versions in detail
4. Align local development environment with production
5. Fix failing celery worker
6. Document version and architecture decisions

---

**Report End**
