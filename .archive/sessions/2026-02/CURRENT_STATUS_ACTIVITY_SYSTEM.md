# DevBob Activity System - Current Status

**Date**: February 12, 2026  
**Session**: Post-restart verification

---

## Executive Summary

✅ **Backend**: Working perfectly (http://localhost:8080)  
✅ **MCP Server**: Working perfectly (metabob-cli mcp)  
✅ **Activity Tools**: Functional and returning data  
❌ **OpenCode Integration**: `search_activities` returns empty (MCP client issue)

---

## Component Status

### 1. Backend API (metabob-rpc-api) ✅

**Container**: api-server-dev  
**Status**: Up 14 hours (healthy)  
**Port**: 8080  

**Test Results**:
```bash
$ curl http://localhost:8080/health
{"status":"ok","timestamp":"2026-02-12T07:12:09.306407","version":"0.16.0"}

$ curl "http://localhost:8080/v2/activities/templates?limit=3" \
  -H "Authorization: Bearer {session_token}"
{
  "templates": [
    {"variant_id": "REFACTOR-9c629da6", "variant_name": "Refactor", "task_count": 4},
    {"variant_id": "INFRASTRUCTURE-c0b9dfaa", "variant_name": "Code Analysis", "task_count": 4},
    {"variant_id": "INFRASTRUCTURE-d3b89954", "variant_name": "Boredom Task Processor", "task_count": 6}
  ]
}
```

**Available Activities**: 5+ activity templates registered  
**API Version**: 0.16.0

---

### 2. Metabob CLI ✅

**Installation**: `/home/avi/.pyenv/shims/metabob-cli`  
**Version**: 1.22.0  

**Configuration**:
```json
{
  "base_url": "http://localhost:8080",
  "api_key": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8",
  "state_directory": ".metabob",
  "project_id": "exp-repo-dev"
}
```

**Session Token**: Valid (from `.metabob/state`)  
```
c2Vzc2lvbnM6NjJhNGQ4NTMtNDY3My00NDUwLWIxN2UtNDUyMWY5NmU1YzBlOmV4cC1yZXBvLWRldjo1ODU4NTQ0NC03NjZjLTQyYWQtYTVkMy01OTU5NDE5OWJlZGY=
```

---

### 3. MCP Server ✅

**Command**: `metabob-cli mcp --transport stdio`  
**Transport**: stdio (JSON-RPC over stdin/stdout)  
**Protocol Version**: 2024-11-05

**Test Results**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "Metabob Agent Assistant",
      "version": "1.22.0"
    }
  }
}
```

**Available Tools**: 28 tools total  
**Activity Tools**:
- `search_activities` - Search for activity templates ✅
- `get_activity` - Get activity metadata ✅
- `start_activity_execution` - Start activity execution ✅
- `get_next_step` - Get next activity step ✅
- `report_step_result` - Report step completion ✅
- `activity` - Execute activity end-to-end ✅
- `create_activity_template` - Create new template ✅
- `evolve_activity_template` - Evolve existing template ✅

---

### 4. search_activities Tool ✅

**Tool Name**: `search_activities` (NOT `metabob_search_activities`)  
**Method**: `tools/call`  
**Parameters**:
```json
{
  "name": "search_activities",
  "arguments": {
    "query": "",
    "limit": 5,
    "min_success_rate": 0.0
  }
}
```

**Response**:
```json
{
  "status": "success",
  "count": 5,
  "activities": [
    {
      "id": "REFACTOR-9c629da6",
      "name": "Refactor",
      "description": "Refactor code to improve quality without changing behavior",
      "category": "REFACTOR",
      "task_count": 4,
      "success_rate": 0,
      "avg_cost": 0,
      "avg_duration": 0
    },
    ...
  ]
}
```

**Performance**: < 1 second response time

---

### 5. OpenCode Integration ❌

**Status**: MCP client not communicating properly with server  
**Symptom**: `search_activities({ verbose: true })` returns `{ activities: [], count: 0 }`

**OpenCode Configuration** (`.opencode/opencode.json`):
```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "enabled": true,
      "environment": {
        "METABOB_API_URL": "http://localhost:8080",
        "METABOB_PROJECT_ID": "exp-repo-dev",
        "METABOB_API_KEY": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8"
      }
    }
  }
}
```

**Possible Causes**:
1. **MCP Client Cache**: OpenCode might be caching empty results from previous failed attempts
2. **MCP Client Connection**: The MCP client might not be properly spawning/connecting to the server
3. **Tool Name Mismatch**: OpenCode might be calling `metabob_search_activities` instead of `search_activities`
4. **Timeout Issue**: The MCP client might be timing out before the server responds

**Evidence**:
- Direct MCP test shows server working perfectly
- Backend API returns 5 templates
- metabob-cli version 1.22.0 with all fixes applied
- OpenCode `test_metabob_mcp` tool times out after 60 seconds

---

## Configuration Files

### Host Machine (~/.opencode/opencode.json)
```json
{
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8",
    "project_id": "exp-repo-dev",
    "auto_inject": true,
    "headless": true
  }
}
```

### Container Configuration (configs/opencode.devbob.json)
```json
{
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://api-server-dev:8080",
    "api_key": "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs",
    "project_id": "exp-repo-dev"
  },
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_URL": "http://api-server-dev:8080",
        "METABOB_API_KEY": "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs"
      },
      "enabled": true
    }
  }
}
```

**Key Difference**: Containers use `api-server-dev:8080` (Docker network name)

---

## Docker Compose Architecture

### Backend Services
- **redis**: Port 6379 (task queue)
- **surreal**: Port 8000 (database)
- **api-server-dev**: Port 8080 (REST API)
- **metabob-rpc-api-worker**: Celery worker

### Agent Containers
- **devbob-rpc-api**: Port 3001 (ACP), 8081 (MCP)
- **devbob-dashboard**: Port 3002 (ACP), 8082 (MCP)
- **devbob-cli**: Port 3003 (ACP), 8083 (MCP)
- **devbob-opencode**: Port 3004 (ACP), 8084 (MCP) - **UNHEALTHY**
- **devbob**: Port 3005 (ACP), 8085 (MCP)

**Issue**: devbob-opencode container is unhealthy (Up 11 hours - unhealthy)

---

## Next Steps

### Immediate Actions

1. **Restart OpenCode Session**
   - Full restart (not resume) to clear MCP client cache
   - New session should spawn fresh MCP server

2. **Check MCP Client Logs**
   - Look for connection errors
   - Check if server is being spawned correctly
   - Verify tool name being called

3. **Test from Container**
   - SSH into devbob-opencode container
   - Run `metabob-cli mcp --transport stdio` test
   - Verify container can reach api-server-dev:8080

4. **Debug OpenCode MCP Integration**
   - Check if `search_activities` tool is registered
   - Verify tool is calling correct MCP method
   - Add logging to OpenCode MCP client

### Configuration Verification

**Host Machine**:
```bash
# Test backend
curl http://localhost:8080/health

# Test MCP server
python3 test_search_activities_tool.py

# Test OpenCode tool
# (In OpenCode session)
search_activities({ verbose: true })
```

**Container**:
```bash
# Enter container
docker exec -it devbob-opencode bash

# Test backend from inside container
curl http://api-server-dev:8080/health

# Test MCP server
metabob-cli mcp --transport stdio
```

---

## Recent Work

### Commits Applied
1. **c5a0813** - Complete activity system testing and verification
2. **fae56c7** - Complete MCP integration fixes
3. **fff4484** - Add session state management

### Documentation Created
- ACTIVITY_SYSTEM_DEMONSTRATION.md
- ACTIVITY_SYSTEM_TEST_RESULTS.md
- READY_FOR_ACTIVITY_EXECUTION.md
- COMPLETE_FIX_SUMMARY.md

---

## Success Criteria

- [x] Backend API returns activity templates
- [x] MCP server starts and responds to requests
- [x] `search_activities` tool returns data via MCP
- [ ] OpenCode `search_activities` function returns data
- [ ] Can execute activity template via OpenCode
- [ ] Can create new activity template via OpenCode

---

## Status Summary

**Backend & MCP**: ✅ **FULLY FUNCTIONAL**  
**OpenCode Integration**: ❌ **NEEDS DEBUGGING**

The activity system infrastructure is working perfectly. The issue is isolated to
OpenCode's MCP client not properly communicating with the metabob-cli MCP server.
