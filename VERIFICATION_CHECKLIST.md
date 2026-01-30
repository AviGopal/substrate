# DevBob Environment Verification Checklist

**Purpose**: Verify that the integrated backend + agent environment is properly configured and ready to use.

---

## Pre-Flight Checks

### 1. Configuration Files
- [ ] `.env.devbob` exists with all required variables
- [ ] `repos/metabob-rpc-api/.env.docker` exists with backend config
- [ ] `configs/docker-compose.devbob.yaml` is present
- [ ] `configs/Dockerfile.devbob` is present
- [ ] `./devbob` script is executable

**Verify**:
```bash
ls -la .env.devbob configs/docker-compose.devbob.yaml configs/Dockerfile.devbob repos/metabob-rpc-api/.env.docker ./devbob
```

### 2. Repository URLs Configured
- [ ] `DEVBOB_RPC_API_REPO` set in `.env.devbob`
- [ ] `DEVBOB_WEB_REPO` set in `.env.devbob`
- [ ] `DEVBOB_CLI_REPO` set in `.env.devbob`
- [ ] `DEVBOB_OPENCODE_REPO` set in `.env.devbob`

**Verify**:
```bash
grep "DEVBOB.*REPO=" .env.devbob
```

### 3. Docker Image Built
- [ ] `devbob:latest` image exists

**Verify**:
```bash
docker images | grep devbob
```

**Build if needed**:
```bash
./scripts/build-devbob.sh
```

---

## Startup Verification

### 4. Start All Services
```bash
./devbob start
```

**Expected**: 7 containers start:
- redis
- api-server-dev
- metabob-worker
- devbob-rpc-api
- devbob-dashboard
- devbob-cli
- devbob-opencode

### 5. Container Health
- [ ] All 7 containers running
- [ ] No containers in "restarting" state

**Verify**:
```bash
./devbob status
# or
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## Connectivity Verification

### 6. Backend Service Health

#### Redis
- [ ] Redis responds to ping

**Test**:
```bash
docker exec metabob-redis redis-cli ping
# Expected: PONG
```

#### API Server
- [ ] API server status endpoint accessible
- [ ] Returns healthy status

**Test**:
```bash
curl -s http://localhost:8080/status | jq
# Expected: {"status": "ok", ...}
```

### 7. Agent ACP Endpoints

#### RPC API Agent
- [ ] ACP config endpoint accessible

**Test**:
```bash
curl -s http://localhost:3001/config | jq
# Expected: OpenCode config JSON
```

#### Dashboard Agent
- [ ] ACP config endpoint accessible

**Test**:
```bash
curl -s http://localhost:3002/config | jq
```

#### CLI Agent
- [ ] ACP config endpoint accessible

**Test**:
```bash
curl -s http://localhost:3003/config | jq
```

#### OpenCode Agent
- [ ] ACP config endpoint accessible

**Test**:
```bash
curl -s http://localhost:3004/config | jq
```

### 8. Internal Network Connectivity

#### Agent → Backend
- [ ] Agents can reach backend from inside containers

**Test**:
```bash
docker exec devbob-opencode curl -sf http://api-server-dev:80/status
docker exec devbob-dashboard curl -sf http://api-server-dev:80/status
docker exec devbob-cli curl -sf http://api-server-dev:80/status
docker exec devbob-rpc-api curl -sf http://api-server-dev:80/status
```

**Expected**: All return `{"status": "ok", ...}`

---

## Repository Verification

### 9. Repository Cloning

#### Check if repos are cloned
- [ ] devbob-rpc-api has repository
- [ ] devbob-dashboard has repository
- [ ] devbob-cli has repository
- [ ] devbob-opencode has repository

**Verify**:
```bash
echo "=== devbob-rpc-api ==="
docker exec devbob-rpc-api ls -la /workspace | head -15

echo "=== devbob-dashboard ==="
docker exec devbob-dashboard ls -la /workspace | head -15

echo "=== devbob-cli ==="
docker exec devbob-cli ls -la /workspace | head -15

echo "=== devbob-opencode ==="
docker exec devbob-opencode ls -la /workspace | head -15
```

**Expected**: Each should show `.git/` directory and repository files

### 10. Git Configuration

#### Check branch and remote
```bash
docker exec devbob-rpc-api sh -c "cd /workspace && git branch && git remote -v"
docker exec devbob-dashboard sh -c "cd /workspace && git branch && git remote -v"
docker exec devbob-cli sh -c "cd /workspace && git branch && git remote -v"
docker exec devbob-opencode sh -c "cd /workspace && git branch && git remote -v"
```

**Expected**: Each shows correct branch and remote URL

---

## Functional Verification

### 11. Backend Analysis Request

Test that backend can process a simple code analysis request.

**Test**:
```bash
# Create test file
echo 'def test(): pass' > /tmp/test.py

# Submit to backend (requires API key if configured)
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{"code": "def test(): pass", "language": "python"}'
```

**Expected**: Returns analysis result (or authentication error if API key required)

### 12. Agent ACP Session

Test creating an ACP session with an agent.

**Test**:
```bash
# Use curl to test session creation
curl -X POST http://localhost:3004/acp/sessions \
  -H "Content-Type: application/json" \
  -d '{"capabilities": ["read", "write"]}'
```

**Expected**: Returns session ID

---

## Log Verification

### 13. Check for Errors

#### Backend Logs
```bash
docker logs api-server-dev | grep -i error | tail -20
docker logs metabob-worker | grep -i error | tail -20
```

**Expected**: No critical errors (some startup warnings are OK)

#### Agent Logs
```bash
docker logs devbob-rpc-api | grep -i error | tail -20
docker logs devbob-dashboard | grep -i error | tail -20
docker logs devbob-cli | grep -i error | tail -20
docker logs devbob-opencode | grep -i error | tail -20
```

**Expected**: No metabob connection errors, no DNS failures

---

## Configuration Consistency

### 14. Service Names Match

Verify docker-compose service names match environment expectations.

**Check**:
```bash
grep "container_name:" configs/docker-compose.devbob.yaml
```

**Expected**:
- `devbob-rpc-api`
- `devbob-dashboard`
- `devbob-cli`
- `devbob-opencode`
- `api-server-dev`
- `metabob-redis`
- `metabob-worker`

### 15. Volume Names Consistent

**Check**:
```bash
docker volume ls | grep devbob
```

**Expected volumes**:
- `devbob_rpc_api_workspace`
- `devbob_dashboard_workspace` (uses `DEVBOB_WEB_REPO`)
- `devbob_cli_workspace`
- `devbob_opencode_workspace`
- `devbob_config`
- `devbob_auth`

---

## Final Checks

### 16. Documentation Updated
- [ ] STATUS.md reflects current state
- [ ] INDEX.md includes STATUS.md
- [ ] README.md workflow is accurate
- [ ] Investigation reports in `docs/investigations/`

### 17. Environment Ready for Use
- [ ] All services running
- [ ] All health checks passing
- [ ] No connectivity errors
- [ ] Repositories cloned
- [ ] Backend processing requests

---

## Success Criteria

✅ **Environment is ready when**:
1. All 7 containers running and healthy
2. Backend responds to `/status` with `{"status": "ok"}`
3. All agent ACP endpoints return config JSON
4. Agents can reach backend internally
5. No DNS errors in logs
6. No metabob connection timeouts

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs <container-name>

# Rebuild image
./scripts/build-devbob.sh

# Restart specific service
./devbob restart <service-name>
```

### Repository not cloned
```bash
# Check SSH key
docker exec devbob-rpc-api ls -la /root/.ssh/

# Check environment
docker exec devbob-rpc-api env | grep REPO

# Manual clone (if needed)
docker exec -it devbob-rpc-api sh
cd /workspace
git clone $REPO_URL .
```

### Backend connection failures
```bash
# Check network
docker network ls | grep metabob

# Test DNS resolution
docker exec devbob-opencode nslookup api-server-dev

# Check backend is up
curl http://localhost:8080/status
```

### Agent won't connect to backend
```bash
# Check environment
docker exec devbob-opencode env | grep METABOB_API_URL

# Should be: http://api-server-dev:80
```

---

## Quick Verification Script

Run all checks automatically:

```bash
#!/bin/bash
# verification-script.sh

echo "🔍 DevBob Environment Verification"
echo "==================================="
echo ""

# 1. Check containers
echo "1. Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(devbob|metabob|redis|api-server)"
echo ""

# 2. Backend health
echo "2. Backend Health:"
curl -sf http://localhost:8080/status && echo "✅ Backend OK" || echo "❌ Backend FAIL"
echo ""

# 3. Agent endpoints
echo "3. Agent Endpoints:"
for port in 3001 3002 3003 3004; do
  curl -sf http://localhost:$port/config > /dev/null && echo "✅ Port $port OK" || echo "❌ Port $port FAIL"
done
echo ""

# 4. Internal connectivity
echo "4. Internal Connectivity:"
docker exec devbob-opencode curl -sf http://api-server-dev:80/status > /dev/null && echo "✅ Internal network OK" || echo "❌ Internal network FAIL"
echo ""

# 5. Repositories
echo "5. Repository Status:"
for agent in devbob-rpc-api devbob-dashboard devbob-cli devbob-opencode; do
  docker exec $agent test -d /workspace/.git && echo "✅ $agent repo OK" || echo "⚠️  $agent repo not cloned"
done
echo ""

echo "==================================="
echo "✅ Verification complete!"
```

---

**Last Updated**: 2026-01-27  
**Use this checklist** before beginning dogfooding or development work.
