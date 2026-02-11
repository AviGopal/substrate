# Shared Backend Configuration - Complete Setup

## Summary

Successfully configured a shared Metabob RPC API backend server accessible by both local (host) and DevBob (container) environments, with all projects under the same organization and project_id.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    exp-repo Organization                     │
│                    project_id: exp-repo-dev                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│ metabob-cli   │     │ metabob-rpc  │     │ metabob-     │
│               │     │    -api      │     │   opencode   │
└───────────────┘     └──────────────┘     └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │   Metabob RPC API Server    │
                │   http://localhost:8080     │
                │   Status: ✅ RUNNING        │
                └─────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌────────────┐      ┌────────────┐
            │ SurrealDB  │      │   Redis    │
            │ :8000      │      │   :6379    │
            └────────────┘      └────────────┘
```

## Configuration Details

### 1. Backend Server (Running)

**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api`

**Status**: ✅ Running via Docker Compose
- API Server: http://localhost:8080
- SurrealDB: ws://localhost:8000
- Redis: redis://localhost:6379

**Started with**:
```bash
cd repos/metabob-rpc-api
./dev.sh start
```

**Verify**:
```bash
curl http://localhost:8080/
# Response: {"status":"ok","timestamp":"...","version":"0.16.0"}
```

### 2. Project Organization

**Organization**: `exp-repo`
**Project ID**: `exp-repo-dev`

All codebases are configured with `project_id: exp-repo-dev`:
- ✅ metabob-cli
- ✅ metabob-rpc-api  
- ✅ metabob-opencode

### 3. Host Machine Configuration

**OpenCode Config**: `~/.opencode/opencode.json`

```json
{
  "metabob": {
    "enabled": true,
    "base_url": "http://localhost:8080",
    "project_id": "exp-repo-dev",
    "cli_path": "metabob-cli"
  }
}
```

**metabob-cli Config**: `repos/metabob-cli/.metabob/config.json`

```json
{
    "base_url": "http://localhost:8080",
    "project_id": "exp-repo-dev",
    "state_directory": ".metabob",
    "watch_files": true,
    "batch_size": 5
}
```

**metabob-rpc-api Config**: `repos/metabob-rpc-api/.metabob/config.json`

```json
{
    "base_url": "http://localhost:8080",
    "project_id": "exp-repo-dev",
    "state_directory": ".metabob",
    "watch_files": true,
    "batch_size": 5
}
```

### 4. DevBob Container Configuration

**OpenCode Config**: `configs/opencode.devbob.json` (mounted in containers)

```json
{
  "metabob": {
    "enabled": true,
    "base_url": "http://host.docker.internal:8080",
    "project_id": "exp-repo-dev",
    "cli_path": "metabob-cli",
    "enable_cli_mcp": true
  }
}
```

**Key Points**:
- Containers use `host.docker.internal:8080` to access host's backend
- Same `project_id` as host machine
- MCP integration enabled for metabob-cli tools

### 5. Environment Variables

**File**: `.env.devbob`

```bash
METABOB_API_URL=http://localhost:8080
METABOB_PROJECT_ID=exp-repo-dev
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Verification Steps

### 1. Verify Backend is Running

```bash
curl http://localhost:8080/
# Expected: {"status":"ok","timestamp":"...","version":"0.16.0"}
```

### 2. Verify Configuration

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
source .env.devbob
./devbob config verify
```

**Expected Output**:
```
✓ Host config exists
✓ Metabob backend reachable at http://localhost:8080
✓ API key configured
✓ Metabob MCP enabled
✓ metabob-cli found in PATH
✓ DevBob container config exists
✓ All checks passed! Ready to run activities.
```

### 3. View API Documentation

Open in browser: http://localhost:8080/docs

This shows the FastAPI Swagger UI with all available endpoints for:
- Organizations
- Projects
- Activities
- Code Analysis
- Sessions

### 4. Test Project Access

```bash
# List all organizations (requires authentication)
curl http://localhost:8080/api/v1/organizations/

# Check project status
curl http://localhost:8080/api/v1/projects/exp-repo-dev
```

## Usage

### Start Backend Services

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api
./dev.sh start
```

### Start DevBob Containers

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./devbob start
```

### Use metabob-cli Locally

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli
metabob-cli analyze --path .
# Will use http://localhost:8080 with project_id=exp-repo-dev
```

### Use OpenCode with Metabob

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
opencode
# Will connect to http://localhost:8080 with project_id=exp-repo-dev
```

## Network Access Patterns

### From Host Machine

- metabob-cli → `http://localhost:8080`
- OpenCode → `http://localhost:8080`
- Browser → `http://localhost:8080/docs`

### From DevBob Containers

- devbob-opencode → `http://host.docker.internal:8080`
- devbob-cli → `http://host.docker.internal:8080`
- devbob-rpc-api → `http://host.docker.internal:8080`

## Project Benefits

✅ **Unified Backend**: Single source of truth for all code analysis
✅ **Shared Project Context**: All codebases under same organization
✅ **Consistent Configuration**: Same project_id across all environments
✅ **Activity Synchronization**: Activities accessible from both host and containers
✅ **Cross-Repository Learning**: Patterns and insights shared across codebases
✅ **Metrics Collection**: Unified metrics and activity tracking

## Files Modified

1. `configs/opencode.devbob.json` - Added `project_id` and updated `base_url`
2. `configs/opencode.host.json` - Added `project_id` template
3. `repos/metabob-cli/.metabob/config.json` - Added `project_id`
4. `repos/metabob-rpc-api/.metabob/config.json` - Added `project_id`
5. `.env.devbob` - Updated `METABOB_API_URL` for host access
6. `~/.opencode/opencode.json` - Regenerated with project_id

## Next Steps

### 1. Verify in Browser

Open http://localhost:8080/docs and explore:
- Available API endpoints
- Organization and project structure
- Activity templates
- Code analysis capabilities

### 2. Test Activity Execution

```bash
# From host machine
cd repos/metabob-opencode
opencode
# Run an activity template - it will use the shared backend

# From DevBob container
./devbob start devbob-opencode
./devbob shell devbob-opencode
opencode
# Run the same activity - will see shared project context
```

### 3. Monitor Backend

```bash
# View logs
cd repos/metabob-rpc-api
./dev.sh logs server-dev

# Check health
curl http://localhost:8080/health

# View metrics
curl http://localhost:8080/metrics
```

## Troubleshooting

### Backend Not Responding

```bash
cd repos/metabob-rpc-api
./dev.sh status
./dev.sh logs
```

### Configuration Issues

```bash
./devbob config verify
./devbob config show
```

### Container Network Issues

```bash
# From inside container
docker exec -it devbob-opencode curl http://host.docker.internal:8080/
```

## Success Criteria

✅ Backend server running on http://localhost:8080
✅ All configs have project_id: exp-repo-dev
✅ Host can access backend via localhost:8080
✅ Containers can access backend via host.docker.internal:8080
✅ Configuration verification passes
✅ API docs accessible in browser
✅ Ready to execute activities from any environment
