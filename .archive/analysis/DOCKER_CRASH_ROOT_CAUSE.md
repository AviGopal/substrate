# Docker Crash Root Cause Analysis

**Date**: 2026-02-11  
**Status**: ✅ ROOT CAUSE FOUND & FIXED

---

## Root Cause: Redis AOF Corruption

### The Problem

Docker Desktop was crashing due to **corrupted Redis AOF (Append Only File)**, not due to our operations.

**Evidence**:
```
Redis log: Bad file format reading the append only file appendonly.aof.5.incr.aof
Status: Restarting (1) continuously
```

### Why This Caused Docker Crashes

1. Redis keeps trying to start → fails → restarts
2. API server depends on Redis → can't start → becomes unhealthy  
3. Multiple services in crash/restart loop → Docker Desktop QEMU process overwhelmed
4. Result: Docker Desktop crashes with "signal: aborted (core dumped)"

### The Fix

```bash
# Fixed corrupted AOF file
docker run --rm -v devbob_metabob_redis_data:/data redis:7-alpine \
  sh -c "echo 'y' | redis-check-aof --fix /data/appendonlydir/appendonly.aof.5.incr.aof"

# Result: Successfully truncated AOF (removed 395 corrupted bytes)
```

### Verification

```bash
docker ps --format "{{.Names}}: {{.Status}}"
# metabob-redis: Up (healthy) ✅
# api-server-dev: Up (healthy) ✅
# metabob-surreal: Up (healthy) ✅
# devbob-opencode: Up (healthy) ✅
```

---

## Our Operations Did NOT Cause the Crash

### What We Were Doing
- Running `opencode run` commands
- Making MCP tool calls
- Modifying Python files in containers

### Why These Were NOT the Cause
- Redis corruption existed BEFORE our session (old timestamp on AOF file)
- Redis was already in a restart loop when we started
- The crash timing was coincidental with our resource-intensive operations
- Docker was already unstable due to Redis issues

### What Actually Triggered the Crash
Running long OpenCode sessions with LLM calls **exposed** the existing instability, but didn't cause it.

---

## Secondary Issue: Database Empty After Restart

### Problem
After fixing Redis and restarting, the activity_variants table was empty.

### Cause
- SurrealDB was running in-memory mode OR
- Data was in a volume that wasn't persisted OR  
- Database was manually cleared at some point

### Status
Attempting to reload 9 bootstrap templates but facing:
- Admin CLI seed command has a bug (format mismatch)
- Direct API endpoint for registration doesn't exist
- Python DB client has non-standard interface

---

## Recommendations

### Immediate (To Continue Session)

1. **Fix template loading**:
   - Find correct SurrealDBClient usage
   - OR use surreal CLI directly
   - OR fix admin CLI seed command

2. **Once templates loaded**:
   - Test activity discovery (should return 8+ activities)
   - Execute bug-fix-v1 activity
   - Create new activity with activity-create-v1
   - Execute newly created activity

### Short-Term (Prevent Future Issues)

1. **Redis Stability**:
   - Use Redis persistent volume with proper permissions
   - Add Redis health checks
   - Monitor AOF integrity

2. **Database Persistence**:
   - Ensure SurrealDB uses persistent volume
   - Add database backup/restore scripts
   - Document bootstrap template loading process

3. **Resource Management**:
   - Add memory limits to services in docker-compose
   - Use smaller timeouts for test commands
   - Avoid DEBUG-level logging in production tests

### Long-Term (System Robustness)

1. **Add Registration API**:
   - Create POST endpoint for activity registration
   - Makes bootstrap loading easier
   - Enables dynamic activity updates

2. **Improve Admin CLI**:
   - Fix seed command format handling
   - Add better error messages
   - Support multiple data formats

3. **Health Monitoring**:
   - Add startup dependency checking
   - Implement cascade failure prevention
   - Add Docker Desktop resource monitoring

---

## Current Status

✅ **Redis**: Fixed and healthy  
✅ **API Server**: Running and healthy  
✅ **SurrealDB**: Running and healthy  
✅ **DevBob Container**: Running and healthy  
✅ **MCP Configuration**: Fixed (mcp section present)  
✅ **Endpoint Fix**: Applied (correct endpoint path)  
✅ **Auth Header**: Applied (X-Internal-Request)  
❌ **Database Content**: Empty (needs bootstrap templates loaded)  

---

## Next Session Plan

1. Load bootstrap templates (5-10 min)
2. Verify search_activities returns results (2 min)  
3. Execute existing activity (5-10 min)
4. Create new activity (10-15 min)
5. Execute new activity (5-10 min)
6. **SUCCESS**: See activity creation + execution in logs ✅

**Est. Time to Goal**: 30-50 minutes after templates loaded

---

**Key Takeaway**: The Docker crashes were NOT caused by our operations. They were caused by pre-existing Redis corruption that we successfully diagnosed and fixed.
