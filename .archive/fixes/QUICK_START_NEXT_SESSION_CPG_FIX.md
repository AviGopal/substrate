# Quick Start: Next Session After cpg-inference Fix

**Status**: ✅ devbob container is working with cpg-inference installed
**Date**: February 16, 2026
**Commit**: `06872d3`

---

## What's Working Now ✅

1. **Docker Build**: Completes in <2 minutes (no more timeout)
2. **cpg-inference**: Installed successfully at runtime (v0.5.2)
3. **ACP Server**: Healthy and responding on port 3000
4. **MCP Server**: Can import cpg_inference module
5. **Container**: devbob-clean is running and healthy

---

## Quick Verification Commands

```bash
# Check container health
docker ps --filter name=devbob-clean --format "{{.Names}}\t{{.Status}}"

# Verify cpg-inference installation
docker exec devbob-clean /opt/metabob-cli/.venv/bin/python -c "import cpg_inference; print(cpg_inference.__version__)"
# Expected: 0.5.2

# Test ACP config endpoint (from inside container)
docker exec devbob-clean curl -s http://localhost:3000/config | jq -r '.model'
# Expected: anthropic/claude-sonnet-4-5

# Check logs for errors
docker logs devbob-clean 2>&1 | tail -30
```

---

## Priority Tasks for Next Session

### 1. Test Logging Fixes (Ready)
**Branch**: `feat/acp-delegation-improvements`
**Commit**: `2834f687`

The logging fixes from the previous session are already committed but haven't been tested yet.

**Test Plan**:
```bash
# Current log level (should be INFO)
docker logs devbob-clean 2>&1 | grep -E "^(INFO|DEBUG|WARN)" | head -5

# Test OPENCODE_LOG_LEVEL env var
# Edit docker-compose.yaml to add:
#   environment:
#     OPENCODE_LOG_LEVEL: WARN
# Then restart and verify only WARN/ERROR logs appear

# Test different log levels
for level in DEBUG INFO WARN ERROR; do
  echo "Testing $level..."
  # Update env var, restart, check logs
done
```

### 2. Test ACP Delegation (High Priority)
Now that ACP is working, test the delegation functionality:

```bash
# Test basic ACP connection
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session", "cwd": "/workspace"}'

# Test activity execution via ACP
# (Use actual ACP client or delegation tool)

# Test impulse sharing
# (Verify impulses are serialized and passed correctly)
```

### 3. Test Activity Template Execution
```bash
# List available activities
docker exec devbob-clean /root/.bun/bin/bun --cwd /opt/repos/metabob-opencode run \
  packages/opencode/src/index.ts activity list

# Execute a simple activity
docker exec devbob-clean /root/.bun/bin/bun --cwd /opt/repos/metabob-opencode run \
  packages/opencode/src/index.ts activity execute \
  --activity-id feature-00c10340 \
  --variables '{}' \
  --reason "Test execution"
```

### 4. Apply Same Fix to Other Containers (Optional)
If `devbob-rpc-api`, `devbob-cli`, `devbob-opencode`, or `devbob-dashboard` also need cpg-inference:

```yaml
# Add to their volumes in docker-compose.yaml:
volumes:
  - ./repos/cpg-inference:/opt/repos/cpg-inference:ro
```

---

## Known Issues to Investigate

### Issue 1: Host Network Connectivity
**Symptom**: `curl http://localhost:3000/config` from host hangs
**Workaround**: Works fine from inside container
**Priority**: Low (container works normally)
**Investigation**:
```bash
# Test IPv4 explicitly
curl -4 http://127.0.0.1:3000/config

# Check network mode
docker inspect devbob-clean | jq '.[0].NetworkSettings.Networks'

# Try different network mode
# Edit docker-compose.yaml: network_mode: "host"
```

### Issue 2: MCP Server Session Timeout
**Symptom**: MCP server shows session timeout when run standalone with `--help`
**Impact**: None (works fine when spawned by OpenCode)
**Priority**: Very Low

---

## File Locations

### Modified Files (Committed)
- `docker/devbob-entrypoint.sh` - Added runtime cpg-inference installation
- `docker/Dockerfile.devbob` - Added Python dependencies, removed build-time install
- `docker-compose.yaml` - Added cpg-inference volume mount

### Documentation
- `SESSION_SUMMARY_FEB16_CPG_INFERENCE_FIX.md` - Full session details
- `QUICK_START_NEXT_SESSION_CPG_FIX.md` - This file

### Branch Status
- **Current Branch**: `master`
- **Last Commit**: `06872d3` - cpg-inference runtime installation fix
- **Previous Branch**: `feat/acp-delegation-improvements` (commit `2834f687`) - logging fixes ready to test

---

## If Something Breaks

### Container Won't Start
```bash
# Check logs
docker logs devbob-clean 2>&1 | tail -50

# Rebuild from scratch
docker-compose --profile stable --profile devbob down
docker rmi devbob:latest
docker build -t devbob:latest -f docker/Dockerfile.devbob --target devbob-base .
docker-compose --profile stable --profile devbob up -d devbob-clean
```

### cpg-inference Not Installing
```bash
# Check if volume is mounted
docker inspect devbob-clean | jq '.[0].Mounts[] | select(.Destination=="/opt/repos/cpg-inference")'

# Check if source exists
ls -la ./repos/cpg-inference/

# Manual installation test
docker exec devbob-clean /opt/metabob-cli/.venv/bin/pip install /opt/repos/cpg-inference
```

### ACP Not Responding
```bash
# Check OpenCode logs
docker logs devbob-clean 2>&1 | grep -E "(ERROR|error|Exception)"

# Test MCP server directly
docker exec devbob-clean /opt/metabob-cli/.venv/bin/python -m metabob_cli.mcp.server

# Restart container
docker-compose --profile stable --profile devbob restart devbob-clean
```

---

## Success Criteria for Next Session

- [ ] Logging level changes work (INFO → WARN → ERROR)
- [ ] ACP delegation successfully creates sessions
- [ ] Activity templates execute via ACP
- [ ] Impulse sharing works correctly
- [ ] No regressions in container startup

---

## Context for AI Assistant

**What was fixed**: Docker build timeout and missing cpg-inference dependency blocking MCP server startup.

**Solution**: Runtime installation of cpg-inference from mounted volume instead of build-time installation.

**Current State**: Container is healthy, ACP server responds on port 3000, ready for functional testing.

**Next Focus**: Test logging improvements and ACP delegation functionality now that infrastructure is working.
