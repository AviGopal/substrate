# Backend Version Management

## Current Setup

### ✅ Running from Local Code

The backend is **correctly configured** to run from the local development code in `repos/metabob-rpc-api`.

**Current Branch**: `refactor-code-similarity`

### Docker Compose Configuration

The backend uses the `api-dev` profile which mounts local directories:

```yaml
server-dev:
  profiles: ["api-dev"]
  build:
    context: .
    dockerfile: ./docker/Dockerfile.server
  volumes:
    - "./server:/opt/app/server"      ✅ Server code mounted
    - "./tasks:/opt/app/tasks"        ✅ Tasks code mounted
    - "./pyproject.toml:/opt/app/pyproject.toml"
    - "./uv.lock:/opt/app/uv.lock"
```

### Verification

**Container Version**: 0.16.0
**Local Version**: 0.16.0
✅ **Versions Match**

**Mounted Directories Confirmed**:
```bash
$ docker exec metabob-rpc-api-server-dev-1 ls /opt/app/server
__init__.py  actions/  app.py  cli.py  config.py  models/  routes/  utils/
✅ Local code is mounted and accessible
```

---

## How It Works

### 1. Code Mounting (Volume Mounts)
- **Server code** (`./server`) is mounted to `/opt/app/server`
- **Tasks code** (`./tasks`) is mounted to `/opt/app/tasks`
- Changes to Python files are immediately visible inside the container

### 2. Development Build Stage
The Dockerfile uses a development stage:
```dockerfile
FROM base AS development
# Installs dev dependencies + watchdog for auto-reload
RUN uv sync --frozen
RUN uv pip install -e . --system
RUN uv pip install watchdog --system
```

### 3. Current Limitation: No Auto-Reload

⚠️ **The server is NOT currently configured with auto-reload**

**Command running**:
```bash
python -m server.cli start --host 0.0.0.0 --port 8080 --workers 16
```

**To enable auto-reload**, the command should include `--reload`:
```bash
# NOT CURRENTLY ENABLED
uvicorn server:app --reload --host 0.0.0.0 --port 8080
```

---

## Enabling Auto-Reload (Optional)

### Option 1: Modify docker-compose.yaml

Change the command in `server-dev` service:

```yaml
server-dev:
  command: ["start", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--reload"]
  # Note: --workers must be 1 for reload to work
```

### Option 2: Manual Restart After Changes

When you make changes, restart the container:

```bash
cd repos/metabob-rpc-api
docker-compose restart server-dev

# Or rebuild and restart
docker-compose up -d --build server-dev
```

### Option 3: Use dev.sh Commands

```bash
# Restart server
./dev.sh restart server-dev

# Rebuild and restart
./dev.sh stop
docker-compose build server-dev
./dev.sh start
```

---

## Updating to Latest Code

### Current Branch Workflow

**You're on branch**: `refactor-code-similarity`

### When You Make Changes

**Local changes are immediately available** because of volume mounts, but the server needs to restart to load them.

### Switching Branches

```bash
cd repos/metabob-rpc-api

# Switch branch
git checkout main  # or any other branch

# Restart to load new code
docker-compose restart server-dev

# If dependencies changed, rebuild
docker-compose up -d --build server-dev
```

### After Pulling Changes

```bash
git pull origin refactor-code-similarity

# If only Python code changed
docker-compose restart server-dev

# If pyproject.toml or uv.lock changed
docker-compose up -d --build server-dev
```

---

## Recommended Development Workflow

### For Active Development (with auto-reload)

1. **Enable auto-reload** (one-time setup):
   ```bash
   cd repos/metabob-rpc-api
   
   # Edit docker-compose.yaml
   # Change server-dev command to include --reload with --workers 1
   ```

2. **Start services**:
   ```bash
   ./dev.sh start
   ```

3. **Make changes**:
   - Edit files in `server/` or `tasks/`
   - Server automatically reloads
   - No manual restart needed

### For Stable Development (current setup)

1. **Make changes** to code in `repos/metabob-rpc-api`

2. **Restart server** to apply:
   ```bash
   ./dev.sh restart server-dev
   ```

3. **Verify changes**:
   ```bash
   curl http://localhost:8080/
   ```

---

## Branch-Specific Considerations

### Current Branch: `refactor-code-similarity`

This branch may have:
- Different code structure
- Modified API endpoints
- Updated dependencies

**To ensure you're running the correct version**:

```bash
# Check current branch
git branch --show-current
# Output: refactor-code-similarity ✅

# Check if container is running branch code
docker exec metabob-rpc-api-server-dev-1 \
  python -c "import server; print(server.__version__)"
# Output: 0.16.0 ✅

# Verify specific file exists
docker exec metabob-rpc-api-server-dev-1 \
  ls /opt/app/server/routes/session.py
# Should show the file from your branch ✅
```

---

## Dependency Updates

### When pyproject.toml Changes

```bash
cd repos/metabob-rpc-api

# Rebuild the image (installs new dependencies)
docker-compose build server-dev

# Restart with new image
docker-compose up -d server-dev
```

### When uv.lock Changes

Same as above - rebuild required:
```bash
docker-compose build server-dev
docker-compose up -d server-dev
```

---

## Quick Reference Commands

### Check What's Running
```bash
cd repos/metabob-rpc-api
docker-compose ps
./dev.sh status
```

### Restart Server Only
```bash
./dev.sh restart server-dev
```

### Restart Everything
```bash
./dev.sh restart
```

### Rebuild After Code/Dependency Changes
```bash
docker-compose build server-dev
docker-compose up -d server-dev
```

### View Logs
```bash
./dev.sh logs server-dev
./dev.sh follow server-dev  # Follow in real-time
```

### Check Mounted Code Version
```bash
docker exec metabob-rpc-api-server-dev-1 cat /opt/app/server/__version__
```

---

## Summary

### ✅ Current State
- Running from local code in `repos/metabob-rpc-api`
- On branch: `refactor-code-similarity`
- Version: 0.16.0
- Code properly mounted via Docker volumes
- Changes visible immediately in container

### ⚠️ To Apply Changes
- **Without auto-reload**: Restart server after changes
- **With auto-reload**: Changes apply automatically (needs configuration)

### 📋 Workflow
1. Make changes to code in `repos/metabob-rpc-api`
2. Restart: `./dev.sh restart server-dev`
3. Verify: `curl http://localhost:8080/`

**The backend WILL always match your current branch and local changes!** ✅
