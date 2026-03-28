# DevBob Container Deployment and Activity Updates - Entry Points Documentation

## Executive Summary

This document maps the complete deployment workflow from local development to devbob containers running in Docker, covering:
1. Activity template deployment to containers
2. Vessel binary updates in running containers  
3. Multi-container orchestration with docker-compose
4. Entry points for deployment automation

---

## 1. Container Build and Deployment Pipeline

### Entry Point: Build Script
**File:** `scripts/build-devbob.sh`  
**Function:** Main build orchestration  
**Trigger:** Manual CLI invocation  
**Line:** 1

```bash
./scripts/build-devbob.sh [--no-cache] [--push] [--dev]
```

**Input:**
- Source code from `repos/metabob-opencode/` and `repos/metabob-cli/`
- Dockerfile at `docker/Dockerfile.devbob`
- Entrypoint script at `docker/entrypoint.sh`

**Output:**
- Docker image: `devbob:latest` or `devbob:dev`
- Optional push to `$DOCKER_REGISTRY/devbob:*`

**Process:**
1. Validates prerequisites (OpenCode binaries, metabob-cli source)
2. Builds multi-stage Docker image
3. Tags with version
4. Optionally pushes to registry

---

### Entry Point: Dockerfile Multi-Stage Build
**File:** `docker/Dockerfile.devbob`  
**Targets:** 
- `metabob-cli-builder` (line 13)
- `opencode-builder` (line 47)  
- `runtime` (line 77)

**Build Stages:**

#### Stage 1: metabob-cli-builder (line 13)
```dockerfile
FROM python:3.11-slim AS metabob-cli-builder
```
- Builds metabob-cli Python package
- Creates virtualenv at `/opt/metabob-cli/.venv`
- Installs all dependencies (anthropic, mcp, surrealdb, etc.)

#### Stage 2: opencode-builder (line 47)
```dockerfile
FROM oven/bun:1.1.45-debian AS opencode-builder
```
- Builds OpenCode standalone binary from TypeScript source
- Uses bun to compile: `bun run build --single`
- Output: `/build/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode`

#### Stage 3: runtime (line 77)
```dockerfile
FROM debian:12-slim AS runtime
```
- Minimal production image
- Copies binaries from builders:
  - OpenCode binary → `/usr/local/bin/opencode`
  - metabob-cli venv → `/opt/metabob-cli/.venv`
  - Templates → `/opt/opencode/templates`
- Exposes ports: 3000 (ACP), 8080 (server), 8082 (MCP)

**Key Feature:** No source code in final image - only standalone binaries

---

### Entry Point: Container Entrypoint
**File:** `docker/entrypoint.sh`  
**Function:** `main()` (line 1)  
**Trigger:** Docker container start  
**Input Type:** Command-line arguments + environment variables

**Services Started:**
1. **metabob-cli dashboard** (line 183) - SSE mode on port 8001
2. **opencode ACP server** (line 209) - Agent protocol on port 3000
3. **metabob-cli MCP** - Stdio sidecar (auto-started by opencode)

**Process Flow:**
```
1. Validate environment (line 50)
   ↓
2. Process opencode config with env var substitution (line 68)
   ↓
3. Wait for backend availability (line 163)
   ↓
4. Start metabob-cli dashboard (line 183)
   ↓
5. Start opencode ACP server (line 209)
   ↓
6. Wait for services (line 244)
```

**Configuration Sources:**
- Priority 1: `$OPENCODE_CONFIG` (Docker-provided, with env var substitution)
- Priority 2: Generated default at `/workspace/.opencode/opencode.json`

**Environment Variables Processed:**
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` - LLM providers
- `METABOB_API_URL` - Backend API URL
- `METABOB_PROJECT_ID` - Project identifier
- `ACP_PORT`, `ACP_HOSTNAME` - ACP server binding
- `DASHBOARD_PORT`, `DASHBOARD_HOST` - Dashboard binding

---

## 2. Multi-Container Orchestration

### Entry Point: Docker Compose Configuration
**File:** `docker-compose.yaml`  
**Profiles:**
- `stable` - Backend services (Redis, SurrealDB, API server, Celery worker)
- `devbob` - Single clean test container
- `devbob-dev` - Multiple codebase manager containers

**Usage:**
```bash
# Start stable backend only
docker-compose --profile stable up -d

# Start clean devbob for testing
docker-compose --profile stable --profile devbob up -d

# Start full development environment
docker-compose --profile stable --profile devbob-dev up -d
```

### Container Definitions

#### devbob-clean (Profile: devbob, line 187)
**Purpose:** Isolated testing environment with empty workspace  
**Ports:**
- 3000 - OpenCode ACP
- 8082 - MCP Server

**Volumes:**
- `devbob_clean_workspace:/workspace` - Empty volume
- `./repos/cpg-inference:/opt/repos/cpg-inference:ro` - Runtime installation mount

**Environment:**
- `CODEBASE_NAME: clean-test`
- `REPO_URL: ""` - No git clone
- `REPO_CHECKOUT_MODE: skip`

**Dependencies:** `metabob-rpc-api-server` (must be healthy)

#### devbob-rpc-api (Profile: devbob-dev, line 248)
**Purpose:** Backend codebase manager  
**Ports:** 3001 (ACP), 8081 (MCP)  
**Volumes:** `./repos/metabob-rpc-api:/workspace` (bind mount)  
**Role:** `backend-codebase-manager`

#### devbob-cli (Profile: devbob-dev, line 304)
**Ports:** 3002 (ACP), 8083 (MCP)  
**Volumes:** `./repos/metabob-cli:/workspace`  
**Role:** `cli-codebase-manager`

#### devbob-opencode (Profile: devbob-dev, line 352)
**Ports:** 3003 (ACP), 8084 (MCP)  
**Volumes:** `./repos/metabob-opencode:/workspace`  
**Role:** `opencode-codebase-manager`

#### devbob-dashboard (Profile: devbob-dev, line 400)
**Ports:** 3004 (ACP), 8085 (MCP)  
**Volumes:** `./repos/metabob-dashboard:/workspace`  
**Role:** `dashboard-codebase-manager`

### Backend Services (Profile: stable)

#### redis (line 43)
**Container:** `metabob-redis`  
**Image:** `redis:7-alpine`  
**Port:** 6379  
**Command:** `redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru`

#### surreal (line 61)
**Container:** `metabob-surreal`  
**Image:** `surrealdb/surrealdb:latest`  
**Port:** 8000  
**Storage:** `/data/database.db`

#### metabob-rpc-api-server (line 103)
**Container:** `api-server-dev`  
**Image:** `metabobapp/metabob-rpc-api:${API_VERSION:-0.16.12}`  
**Port:** 8080  
**Networks:** `metabob-network`, `devbob-network`

#### celery-worker (line 149)
**Container:** `metabob-celery-worker`  
**Purpose:** Background task processing  
**Dependencies:** Redis, SurrealDB, API server

---

## 3. Activity Template Deployment

### Current State: File-Based Distribution

**Location:** Activity templates are stored in:
- Local: `.metabob/activities/*.json`
- Container: `/workspace/.metabob/activities/*.json`
- Shared templates: `/opt/opencode/templates/` (baked into image)

**Distribution Methods:**

#### Method 1: Baked into Image (Build-Time)
**Entry Point:** Dockerfile COPY instruction (line 96)
```dockerfile
COPY --from=opencode-builder /build/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/templates /opt/opencode/templates
```
**When:** Image build time  
**Limitation:** Requires image rebuild for updates

#### Method 2: Volume Mount (Dev Containers)
**Entry Point:** docker-compose.yaml volume definitions
```yaml
volumes:
  - ./repos/metabob-rpc-api:/workspace
```
**When:** Container start  
**Limitation:** Only works for dev profile, not clean containers

#### Method 3: Backend API (Runtime)
**Entry Point:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Function:** `registerActivityTemplate` (line ~800)  
**Trigger:** Activity registration tool call  

**Process:**
1. Template created locally or in container
2. Tool call: `register_activity_template({ file_path: "..." })`
3. Template saved to local `.metabob/activities/`
4. **Optional:** Registered with backend via MCP if `register_with_metabob: true`

**Backend Registration Flow:**
```typescript
// repos/metabob-opencode/packages/opencode/src/tool/activity.ts
async function registerActivityTemplate(options) {
  // 1. Load template from file or impulse
  const template = await loadTemplate(options.file_path || options.impulse_id)
  
  // 2. Generate ID from name
  const templateId = generateTemplateId(template.name)
  
  // 3. Save to local storage
  await TemplateRepository.save(templateId, template)
  
  // 4. Register with backend (if enabled)
  if (options.register_with_metabob) {
    await MCP.callTool("metabob_register_activity_template", {
      template: { ...template, id: templateId }
    })
  }
}
```

---

## 4. Vessel Binary Updates (Hot Deployment)

### Architecture: Self-Updating Vessels

**Design:** Containers can update their binaries at runtime without rebuild

### Entry Point: VesselUpdateManager
**File:** `repos/metabob-opencode/packages/opencode/src/vessel/update.ts`  
**Namespace:** `VesselUpdateManager` (line 17)

**Core Functions:**

#### getCurrentVersions() (line 181)
**Purpose:** Read vessel version tracking  
**Input:** `filePath: string = "/workspace/.vessel-versions.json"`  
**Output:** 
```typescript
interface VersionTracking {
  current: Record<string, VesselVersion>
  history: VesselUpdateRecord[]
}
```

**Tracking File Schema:**
```json
{
  "current": {
    "opencode": {
      "name": "opencode",
      "version": "1.0.64",
      "checksum": "sha256:...",
      "downloadUrl": "https://..."
    },
    "metabob-cli": {
      "name": "metabob-cli",
      "version": "0.5.2",
      "checksum": "sha256:...",
      "downloadUrl": "https://..."
    }
  },
  "history": [
    {
      "vessel": "opencode",
      "version": "1.0.64",
      "timestamp": "2026-02-24T10:00:00Z",
      "source": "github",
      "reason": "Critical bug fix"
    }
  ]
}
```

#### computeChecksum() (line 248)
**Purpose:** SHA-256 integrity verification  
**Input:** `filePath: string`  
**Output:** Hex checksum string

### Boredom Activities for Vessel Management

**Activity Template:** `update-vessel-opencode-binary` (planned)  
**Purpose:** Automated vessel binary updates during idle time

**Workflow:**
```
1. BoredomManager detects idle session
   ↓
2. Fetches boredom activities from backend
   ↓
3. Backend returns: update-vessel-opencode-binary (priority: HIGH)
   ↓
4. Activity executes in vessel:
   a. Check current version via VesselUpdateManager.getCurrentVersions()
   b. Query backend for latest version
   c. Download new binary to /tmp/
   d. Verify checksum
   e. Backup current binary
   f. Replace /usr/local/bin/opencode
   g. Update version tracking
   h. Restart ACP server
   ↓
5. Report execution results to backend
```

**Activity Template:** `configure-vessel-for-environment` (planned)  
**Purpose:** Environment-specific configuration updates

---

## 5. Deployment Automation Entry Points

### Current Manual Workflow

**Step 1: Build OpenCode**
```bash
cd repos/metabob-opencode/packages/opencode
bun run build --single
```

**Step 2: Build Docker Image**
```bash
./scripts/build-devbob.sh [--no-cache]
```

**Step 3: Start Containers**
```bash
docker-compose --profile stable --profile devbob up -d
```

### Identified Automation Needs

#### Need 1: Activity Template Sync to Running Containers
**Current Gap:** Templates created locally don't auto-sync to containers  
**Solution:** Activity template that:
1. Detects new/updated templates in `.metabob/activities/`
2. Copies to running containers via `docker cp`
3. Registers with container's local TemplateRepository
4. Optionally registers with backend

**Entry Point for Automation:** `scripts/sync-templates-to-containers.sh` (to be created)

#### Need 2: Vessel Binary Hot Update
**Current Gap:** Binary updates require container rebuild  
**Solution:** Boredom activities:
- `update-vessel-opencode-binary`
- `update-vessel-metabob-cli`

**Entry Point:** VesselUpdateManager functions (already implemented)

#### Need 3: Multi-Container Coordinated Updates
**Current Gap:** No orchestration for updating multiple devbob containers  
**Solution:** Activity template that:
1. Lists all running devbob containers
2. Checks versions in each
3. Updates in sequence (or parallel with safeguards)
4. Validates health after each update

**Entry Point for Automation:** `scripts/update-all-devbob-containers.sh` (to be created)

---

## 6. Key Files and Line Numbers Reference

### Docker Build and Deployment
- `docker-compose.yaml` - Multi-profile orchestration
  - Line 43: redis service
  - Line 61: surreal service
  - Line 103: metabob-rpc-api-server
  - Line 187: devbob-clean
  - Line 248: devbob-rpc-api
  - Line 304: devbob-cli
  - Line 352: devbob-opencode
  - Line 400: devbob-dashboard

- `docker/Dockerfile.devbob` - Multi-stage build
  - Line 13: metabob-cli-builder stage
  - Line 47: opencode-builder stage
  - Line 77: runtime stage (production)
  - Line 95: Binary copy (opencode)
  - Line 92: Binary copy (metabob-cli venv)

- `docker/entrypoint.sh` - Container startup
  - Line 50: Environment validation
  - Line 68: Config processing with env var substitution
  - Line 163: Backend health check
  - Line 183: Dashboard start
  - Line 209: ACP server start

### Build Scripts
- `scripts/build-devbob.sh` - Main build orchestration
  - Line 82: OpenCode binary check
  - Line 91: metabob-cli source check
  - Line 118: Docker build invocation
  - Line 135: Push to registry

### Vessel Management
- `repos/metabob-opencode/packages/opencode/src/vessel/update.ts`
  - Line 17: VesselUpdateManager namespace
  - Line 63: VesselVersion interface
  - Line 109: VersionTracking interface
  - Line 181: getCurrentVersions() function
  - Line 248: computeChecksum() function

### Activity System
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
  - Line ~800: registerActivityTemplate() (approximate)
  
- `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
  - Line 23: BoredomManager class
  - Line 66: startMonitoring() function
  - Line 107: checkIdleAndExecute() function
  - Line 161: fetchBoredomActivities() function
  - Line 201: executeBoredomActivity() function

---

## 7. Data Flow Diagrams

### Container Deployment Flow
```
┌─────────────────────────────────────────────────────────────┐
│ Local Development                                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Build OpenCode:                                          │
│    cd repos/metabob-opencode/packages/opencode             │
│    bun run build --single                                   │
│    → Output: dist/opencode-linux-x64/bin/opencode          │
│                                                             │
│ 2. Build Docker Image:                                     │
│    ./scripts/build-devbob.sh                               │
│    → Dockerfile.devbob (multi-stage)                       │
│    → Output: devbob:latest                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Container Runtime (entrypoint.sh)                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Validate environment (ANTHROPIC_API_KEY, etc.)          │
│ 2. Process opencode config (env var substitution)          │
│ 3. Wait for backend (METABOB_API_URL/health)               │
│ 4. Start metabob-cli dashboard (port 8001, SSE)            │
│ 5. Start opencode ACP server (port 3000)                   │
│    → metabob-cli MCP auto-started by opencode              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Container Ready                                             │
├─────────────────────────────────────────────────────────────┤
│ Services:                                                   │
│   ✓ OpenCode ACP (port 3000)                               │
│   ✓ metabob-cli dashboard (port 8001)                      │
│   ✓ metabob-cli MCP (stdio, child of opencode)             │
│                                                             │
│ Binaries:                                                   │
│   ✓ /usr/local/bin/opencode (standalone)                   │
│   ✓ /opt/metabob-cli/.venv/bin/metabob-cli                │
└─────────────────────────────────────────────────────────────┘
```

### Activity Template Distribution Flow
```
┌─────────────────────────────────────────────────────────────┐
│ Template Creation                                           │
├─────────────────────────────────────────────────────────────┤
│ Developer creates: my-template.json                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        │                                       │
        ↓ Method 1: Baked into Image           ↓ Method 2: Runtime Registration
┌───────────────────────┐              ┌────────────────────────────┐
│ Copy to templates/    │              │ Tool call:                 │
│ Rebuild image         │              │ register_activity_template │
│ Redeploy containers   │              │                            │
└───────────────────────┘              └────────────────────────────┘
                                                   ↓
                                       ┌────────────────────────────┐
                                       │ Local: .metabob/activities/│
                                       │ Backend: via MCP (optional)│
                                       └────────────────────────────┘
                                                   ↓
                                       ┌────────────────────────────┐
                                       │ Available in container     │
                                       └────────────────────────────┘
```

### Vessel Binary Update Flow (Hot Deployment)
```
┌─────────────────────────────────────────────────────────────┐
│ Trigger: Boredom Activity (update-vessel-opencode-binary)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Check Current Version                              │
│   VesselUpdateManager.getCurrentVersions()                 │
│   → Read /workspace/.vessel-versions.json                  │
│   → current.opencode.version = "1.0.64"                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Query Backend for Latest Version                   │
│   MCP.callTool("metabob_get_latest_vessel_version", {...}) │
│   → Response: version="1.0.65", downloadUrl="...",         │
│               checksum="sha256:..."                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Download and Verify                                │
│   curl -o /tmp/opencode-new ${downloadUrl}                 │
│   VesselUpdateManager.computeChecksum("/tmp/opencode-new") │
│   Compare checksums → PASS ✓                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Backup and Replace                                 │
│   cp /usr/local/bin/opencode /usr/local/bin/opencode.bak  │
│   cp /tmp/opencode-new /usr/local/bin/opencode            │
│   chmod +x /usr/local/bin/opencode                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Update Tracking and Restart                        │
│   Update .vessel-versions.json:                           │
│     current.opencode.version = "1.0.65"                   │
│     history += new record                                  │
│   Kill and restart ACP server process                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Report to Backend                                  │
│   MCP.callTool("metabob_report_vessel_update", {          │
│     vessel: "opencode",                                    │
│     old_version: "1.0.64",                                 │
│     new_version: "1.0.65",                                 │
│     success: true                                          │
│   })                                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Next Steps for Automation

### Priority 1: Deploy Boredom Activities
1. Create `update-vessel-opencode-binary.json` activity template
2. Create `configure-vessel-for-environment.json` activity template
3. Register with backend using `register_activity_template` tool
4. Test in devbob-clean container

### Priority 2: Template Sync Automation
1. Create `scripts/sync-templates-to-containers.sh`
2. Implement docker cp for file transfer
3. Trigger TemplateRepository.reload() via ACP

### Priority 3: Multi-Container Update Orchestration
1. Create `scripts/update-all-devbob-containers.sh`
2. Add health check validation
3. Add rollback capability

---

## Summary

**Activity Template Distribution:**
- Current: File-based (baked into image or runtime registration)
- Automation: Runtime sync via docker cp or backend API
- Entry Points: `register_activity_template` tool, docker-compose volumes

**Vessel Binary Updates:**
- Architecture: Hot deployment via VesselUpdateManager
- Entry Points: `VesselUpdateManager.getCurrentVersions()`, boredom activities
- Tracking: `/workspace/.vessel-versions.json`

**Container Orchestration:**
- Entry Points: `docker-compose.yaml` (3 profiles), `docker/entrypoint.sh`
- Build: `scripts/build-devbob.sh`, `docker/Dockerfile.devbob`
- Runtime: ACP (port 3000), Dashboard (port 8001), MCP (stdio)

**Deployment Workflow:**
1. Build OpenCode → Build Docker image → Start containers
2. Templates: Baked in or runtime registration
3. Binary updates: Hot deployment via boredom activities
