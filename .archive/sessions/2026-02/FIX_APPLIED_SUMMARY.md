# DevBob Activity Execution Issue - FIX APPLIED

## 🎯 Root Cause Identified

**Problem**: Container config used `http://host.docker.internal:8080` instead of `http://api-server-dev:8080`

**Impact**: MCP tools couldn't reach the backend, causing activity execution to fail

## ✅ Fix Applied

### Changed Files

**File**: `configs/opencode.devbob.json`

**Changes Made**:
```diff
- "METABOB_API_URL": "http://host.docker.internal:8080"
+ "METABOB_API_URL": "http://api-server-dev:8080"

- "base_url": "http://host.docker.internal:8080"
+ "base_url": "http://api-server-dev:8080"
```

### Deployment

1. ✅ Updated config file on host
2. ✅ Copied into container: `/workspace/.opencode/opencode.json`
3. ✅ Restarted container: `docker restart devbob-opencode`

## ✅ Verification

### Config Verification
```bash
$ docker exec devbob-opencode cat /workspace/.opencode/opencode.json | jq '.metabob.base_url'
"http://api-server-dev:8080"  # ✅ CORRECT
```

### MCP Config Verification
```bash
$ docker exec devbob-opencode curl -s http://localhost:3004/config | jq '.mcp.metabob.environment.METABOB_API_URL'
"http://api-server-dev:8080"  # ✅ CORRECT
```

### Backend Connectivity
```bash
$ docker exec devbob-opencode curl http://api-server-dev:8080/
{"status":"ok","timestamp":"...","version":"0.16.0"}  # ✅ WORKS
```

## 📊 Before vs After

### Before ❌
```
devbob-opencode
  └─ Config: host.docker.internal:8080
      └─ Tries to reach host machine
          └─ Backend is in different container
              └─ ❌ Connection fails
                  └─ Activity execution fails
```

### After ✅
```
devbob-opencode
  └─ Config: api-server-dev:8080
      └─ Uses docker network
          └─ Reaches backend container directly
              └─ ✅ Connection works
                  └─ Activity execution ready
```

## 🧪 Next Steps for Testing

1. **Test MCP Tools**:
   ```bash
   # Access devbob-opencode ACP
   curl http://localhost:3004/sessions
   
   # Create session and test activity search
   ```

2. **Test Activity Execution**:
   ```bash
   # Via ACP, try running an activity
   # Should now work with backend connectivity fixed
   ```

3. **Monitor Logs**:
   ```bash
   docker logs devbob-opencode -f
   # Watch for successful MCP tool calls
   ```

## 📝 Documentation Updated

Created comprehensive diagnostic documentation:
- **DEVBOB_ACTIVITY_ISSUE_DIAGNOSIS.md** - Full root cause analysis
- **FIX_APPLIED_SUMMARY.md** - This document

## ✅ Success Criteria

- [x] Config corrected on host
- [x] Config deployed to container
- [x] Container restarted successfully
- [x] Backend connectivity verified
- [x] MCP config shows correct URL
- [ ] Activity execution tested (next step)

## 🔍 Related Issues

This fix resolves:
- "Unable to connect" errors in ACP status
- MCP tool failures
- Activity template search failures
- Activity execution failures

## 🎓 Lesson Learned

**Container Networking Rule**:
- Use `host.docker.internal` for **container → host**
- Use service names (`api-server-dev`) for **container → container**
- Docker Compose automatically creates DNS for service names

## 📚 References

- **V2_ACTIVITY_SYSTEM_STATUS.md** - Architecture is correct, config was wrong
- **TEST_E2E_ACTIVITY_FLOW.md** - Test script works (uses localhost)
- **DEVBOB_ACTIVITY_ISSUE_DIAGNOSIS.md** - Detailed analysis
- **docker-compose.yaml** - Service definitions and networking
