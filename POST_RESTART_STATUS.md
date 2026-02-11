# Post-Restart Status

**Issue**: After Docker Desktop restart, the activity system stopped working again.

## What Happened

1. **Before Docker Restart** (Working): 
   - ✅ MCP returning 27 activities
   - ✅ Activity execution successful
   - ✅ Jiggle activity completed first task

2. **Docker Desktop Crashed**:
   - All containers stopped
   - Had to manually restart Docker Desktop

3. **After Docker Restart** (Broken):
   - ✅ OpenCode container restarted
   - ✅ Transformation function still in code
   - ✅ Backend restarted (10 activities)
   - ❌ **MCP returning 0 activities**

## Current State

```
Backend API: ✅ Working (10 activities via direct HTTP)
OpenCode: ✅ Running
metabob-cli MCP: ✅ Running (PID 180)
MCP Connection: ✅ Connected
search_activities: ❌ Returns count=0
```

## Investigation

### Transformation: ✅ Fixed
- Function exists in file
- No "transformMCPToTemplate is not defined" errors after restart
- Code changes persisted

### Backend Connectivity: ✅ Working
- Backend accessible at http://host.docker.internal:8080
- Environment variables set correctly:
  - METABOB_API_URL=http://host.docker.internal:8080
  - METABOB_API_KEY=mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ

### MCP Response: ❌ Empty
```
DEBUG searchActivities called
DEBUG count=0 searchActivities found activities via MCP
```

## Root Cause (Suspected)

The metabob-cli MCP server might be:
1. Not connecting to backend properly
2. Using cached empty results
3. Having authentication issues
4. Missing database/session context

The config file shows:
```json
{
  "base_url": "http://host.docker.internal:8080",
  "backend_url": null  ← This is null!
}
```

The entrypoint creates config with `base_url` but metabob-cli might expect `backend_url`.

## Next Steps

1. Fix config field name (base_url vs backend_url)
2. Ensure metabob-cli MCP server reads environment variables
3. Test direct metabob-cli commands to backend
4. Check if MCP server needs explicit session/auth setup

## Files Still Modified

✅ `configs/devbob-entrypoint.sh` - serve mode, debug logging
✅ `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts` - transformation function

Changes persisted through Docker restart.
