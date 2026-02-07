# Starting the Metabob RPC API Backend Server

## Quick Start

The Metabob RPC API backend server needs to run on your host machine to be accessible by both:
- **Local environment** (host machine OpenCode/metabob-cli)
- **DevBob containers** (Docker containers via `host.docker.internal`)

### Prerequisites

1. Redis and SurrealDB must be running
2. Python environment with dependencies installed

### Start Backend Services

```bash
# Option 1: Start with Docker Compose (recommended)
cd /home/avi/documents/work/exp-repo/metabob-devbob
export DEVBOB_MODE=full
./devbob backend  # Starts redis, surreal, metabob-rpc-api-server, worker

# Option 2: Start locally (for development)
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

# Start Redis and SurrealDB first
docker-compose up -d redis surreal

# Then start the API server
uvicorn server.main:app --host 0.0.0.0 --port 8080 --reload
```

### Verify Backend is Running

```bash
# Check backend health
curl http://localhost:8080/

# Expected response: {"status":"ok","message":"Metabob RPC API is running"}
```

### Configuration Summary

All projects are now configured to use project_id: `exp-repo-dev`

**Host Machine (Local)**:
- metabob-cli: `http://localhost:8080` with `project_id: exp-repo-dev`
- OpenCode config: `~/.opencode/opencode.json` → `http://localhost:8080`

**DevBob Containers**:
- All containers: `http://host.docker.internal:8080` with `project_id: exp-repo-dev`
- Config mounted at: `/config/opencode.devbob.json`

**Project Organization**:
- Organization: `exp-repo`
- Project ID: `exp-repo-dev`
- All codebases (metabob-cli, metabob-rpc-api, metabob-opencode) share the same project_id

### Next Steps

1. Start the backend (see above)
2. Configure host OpenCode: `./devbob config init`
3. Verify configuration: `./devbob config verify`
4. Start DevBob containers: `./devbob start`
5. Access the dashboard: `http://localhost:8080/docs` (API docs)
