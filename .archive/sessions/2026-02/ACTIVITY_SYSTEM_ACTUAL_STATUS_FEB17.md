# Activity System Actual Status - Feb 17, 2026

**Session Resume Analysis**: Critical infrastructure failures identified

---

## Executive Summary

**Status**: 🔴 **BACKEND CRITICALLY BROKEN**

Three fundamental infrastructure failures confirmed:

1. ✅ **Backend API server UNHEALTHY** (connection reset errors, 5 hours of restarts)
2. ✅ **Template persistence DISABLED** (templates created but not saved)
3. ✅ **Template retrieval BROKEN** (all template lookups fail with "Template not found")

---

## Evidence from Logs (Feb 16-17)

### 1. Backend Server Instability

**Container Status**:
```
api-server-dev: Up 51 minutes (unhealthy)
metabob-celery-worker: Restarting (2) Less than a second ago
```

**Core Log Evidence** (last 500 lines):
```
2026-02-16 16:44:53.359 | Connection reset by peer (repeating)
2026-02-16 16:44:54.362 | Can not write request body for http://localhost:8080/v2/submit
2026-02-16 16:44:56.367 | Connection reset by peer (continuing for 2+ minutes)
2026-02-16 16:45:02.559 | Batch processing error: Connection reset by peer
```

**Pattern**: Backend crashes/restarts continuously, cannot maintain connections

### 2. Template Execution vs. Persistence Mismatch

**Successful Execution** (Activity Create template):
```
[2026-02-16T20:05:00.278Z] CALLING MetabobCLI.startExecution
[2026-02-16T20:05:00.519Z] startExecution SUCCESS: execution_id=exec_e8d6d1504e0c

Task 1: identify-pattern - COMPLETED (409.7s)
Task 2: define-scope - COMPLETED (8.5s)
Task 3: design-steps - COMPLETED (9.0s)
Task 4: create-template - COMPLETED (14.8s)
Task 5: validate-template - COMPLETED (147.4s)

[2026-02-16T20:14:52.134Z] RESPONSE: complete=true
```

**But Template Not Found** (23 minutes later):
```
[2026-02-16T20:42:39.892Z] TEMPLATE-LOADER: MCP load FAILED
Error: Template not found: organize-documentation-v1
```

**Conclusion**: Activity executed successfully, template created, but **NOT PERSISTED TO DATABASE**

### 3. Template Retrieval Failures

**Pattern from activity-debug.log**:

**Morning failures** (Feb 16, 08:00-13:00):
```
08:24 - MetabobCLI.getActivityTemplate is not a function (API method missing)
08:57 - Template not found: add-unit-tests
10:36 - Template not found: fix-bug-complete (5 attempts over 3 hours)
```

**Evening failures** (Feb 16, 20:00-Feb 17, 00:00):
```
20:19 - Template not found: organize-documentation-v1
20:42 - Template not found: organize-documentation-v1 (retry)
20:43 - Template not found: organize-documentation-v1-b81ea152
00:07 - Template not found: refactor-5fccfc17
00:13 - Template not found: demo-315bfaf1
```

**100% failure rate**: Every template lookup attempt failed

---

## Root Causes Identified

### Root Cause 1: Backend API Server Unstable
**File**: Container `api-server-dev` (metabobapp/metabob-rpc-api:0.16.12)

**Symptoms**:
- Connection reset errors every 1-4 seconds
- Celery worker perpetually restarting
- Health check: UNHEALTHY
- Cannot complete batch submissions
- Cannot record tool invocations

**Impact**:
- ❌ Template registration fails (connection drops mid-request)
- ❌ Template queries fail (server disconnects)
- ❌ Activity tracking broken (cannot record sessions/steps)
- ❌ Success attribution impossible (no data reaches database)

### Root Cause 2: Template Persistence Disabled
**File**: `ACTIVITY_CREATE_FAILURE_ANALYSIS.md` (Feb 13)

**Evidence**:
```typescript
// Template repository save method
async save(template: ActivityTemplate): Promise<void> {
  // DISABLED - returns success without saving
  console.log("Template save called but DISABLED");
  return; // Early return, no database write
}
```

**Impact**:
- ✅ Activity execution succeeds
- ✅ Template validation passes
- ❌ Template never saved to database
- ❌ Template "vanishes" after execution completes

### Root Cause 3: Template Retrieval API Non-Functional
**Symptoms**:
- MCP tool `search_activities()` returns empty
- Backend endpoint `GET /v2/activities/templates` errors
- Template loader gets "Template not found" for ALL IDs
- Even bootstrap templates fail to load

**Likely Causes**:
1. Backend database connection broken (due to Root Cause 1)
2. Template table empty (due to Root Cause 2)
3. API method missing/renamed (`getActivityTemplate is not a function`)

---

## What Actually Works vs. Broken

### ✅ What Works
1. Activity execution engine (tasks run successfully)
2. Task orchestration (dependencies, retries, validation)
3. Impulse system (context injection)
4. Agent execution tracking (locally logged)
5. Template creation workflow (generates valid JSON)

### ❌ What's Broken
1. Backend API server stability (crashes/restarts)
2. Template persistence (save returns success but doesn't write)
3. Template retrieval (all lookups fail)
4. Success attribution (no data in database)
5. Activity discovery (search_activities empty)
6. Session tracking (backend cannot record)
7. Tool invocation tracking (connections drop)

---

## Discrepancy with Documentation

### Docs Claim (Feb 16):
- "Activity execution STABLE after Handlebars fix"
- "3 templates validated successfully"
- "System operational"

### Actual Reality (Feb 16-17):
- Backend server UNHEALTHY (continuous restarts)
- Template persistence DISABLED (intentionally)
- Template retrieval 100% failure rate
- No templates in production database

**Gap**: Documentation describes fixes that **were applied** but doesn't reflect **current broken state**

---

## Impact Assessment

### P0 - CRITICAL (System Unusable)
1. **Cannot use activity-first workflow** (templates don't persist)
2. **Cannot discover templates** (search_activities returns empty)
3. **Cannot track outcomes** (backend cannot record data)

### P1 - HIGH (Major Feature Broken)
1. **Template creation unreliable** (appears to work but templates vanish)
2. **Success attribution impossible** (no conversion tracking)
3. **Learning system disabled** (no data to learn from)

### P2 - MEDIUM (Workaround Exists)
1. **Local templates work** (filesystem fallback)
2. **Direct execution viable** (bypass activities)

---

## Immediate Next Steps (Priority Order)

### Step 1: Fix Backend Server Stability 🔥
**Priority**: P0 (nothing works until this is fixed)

**Actions**:
```bash
# Check backend logs for crash reason
docker logs api-server-dev --tail 100

# Check celery worker crash loop
docker logs metabob-celery-worker --tail 100

# Restart with fresh state
docker-compose down
docker-compose up -d

# Verify health
curl http://localhost:8080/health
```

**Success Criteria**: Backend stays up for 5+ minutes, health check passes

### Step 2: Re-enable Template Persistence 🔧
**Priority**: P0 (templates vanish without this)

**Actions**:
```bash
# Find the disabled save method
rg "Template save called but DISABLED" repos/metabob-rpc-api/

# Review and re-enable save logic
# Ensure database write happens

# Test registration
# Verify template appears in database
```

**Success Criteria**: Template saved and retrievable from database

### Step 3: Fix Template Retrieval API 🔍
**Priority**: P0 (cannot use templates without this)

**Actions**:
```bash
# Check if API method exists
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v2/activities/templates

# Fix backend endpoint
# Ensure MCP method `getActivityTemplate` exists

# Test search_activities MCP tool
```

**Success Criteria**: `search_activities()` returns templates

### Step 4: Validate End-to-End 🧪
**Priority**: P1 (verify fixes worked)

**Actions**:
1. Create template via activity
2. Verify template in database
3. Search for template via MCP
4. Execute template
5. Track execution outcome
6. Verify success attribution data

**Success Criteria**: All 6 steps succeed

---

## Questions to Answer

### Q1: Why is backend server crashing?
**Need to check**:
- Database connection issues?
- Resource exhaustion (memory/CPU)?
- Code errors in recent deployment?
- Environment variable misconfiguration?

### Q2: Why was template persistence intentionally disabled?
**Need to review**:
- Feb 13 commit message for disable
- Was there a reason (data corruption risk)?
- Is there a safer alternative implemented?

### Q3: What's the correct API method name?
**Need to verify**:
- Is it `getActivityTemplate` or `getTemplate` or something else?
- Did API change between versions 0.16.11 and 0.16.12?
- Is MCP client using wrong method signature?

---

## Recommended Approach

### Option A: Emergency Triage (Fastest)
1. Restart backend with clean state (5 min)
2. Check if backend stays up (10 min)
3. If yes → proceed to Step 2
4. If no → debug backend crash (1-2 hours)

### Option B: Root Cause Analysis (Thorough)
1. Read backend logs fully (30 min)
2. Identify exact crash reason (30 min)
3. Fix underlying issue (1-2 hours)
4. Then fix persistence + retrieval

### Option C: Workaround First (Pragmatic)
1. Use local template files (immediate)
2. Skip backend entirely for now
3. Fix backend stability later
4. Migrate to backend when stable

---

## Current Session Goal Revisited

**Original Goal**: Validate success attribution system

**Reality**: Cannot validate because infrastructure is broken

**Revised Goal Options**:
1. **Fix infrastructure first** (backend, persistence, retrieval)
2. **Validate locally** (bypass backend, use filesystem)
3. **Document failure modes** (what exactly is broken and why)

**Recommendation**: **Option 1** - Fix infrastructure, THEN validate

---

## Next Command to Run

**Immediate diagnostic**:
```bash
# Check backend crash reason
docker logs api-server-dev --tail 200 | grep -E "(ERROR|CRITICAL|Traceback|Exception)"
```

This will tell us **WHY** backend keeps crashing, which determines the fix strategy.

**Ready to proceed?** Choose approach:
- A) Emergency triage (restart and see if it works)
- B) Root cause analysis (understand before fixing)
- C) Workaround (bypass backend for now)
