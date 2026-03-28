# Critical Architecture Errors - What We Got Wrong

> **Ontological Context**: This document analyzes architectural errors within the framework of the [three-state ontology model](./ONTOLOGY_OF_BECOMING.md). OpenCode is a **vessel** (provides capacity for execution), not the system itself. The process-of-becoming is the unnamed continuous transformation that manifests through this vessel. Understanding this distinction helps clarify where components and responsibilities should reside.

## Overview

After implementing the activity execution tracking fix and analyzing the architecture, we've identified several fundamental errors in our approach and understanding.

---

## Error 1: ActivityManager Lives in the WRONG Component ❌❌❌

### What We Did Wrong
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

We implemented ActivityManager in **metabob-cli**, making it responsible for:
- Activity execution orchestration
- Step-by-step execution tracking
- Trailblazing (adaptive recovery)
- Recording execution outcomes to backend

### Why This Is Wrong
**metabob-cli is supposed to be a stateless MCP server** providing code quality tools. It should NOT:
- Orchestrate activity execution
- Track execution state
- Manage trailblazing
- Know about agents or sessions

### Where It Should Be
**Location**: `repos/metabob-opencode/packages/plugin-activities/`

ActivityManager belongs in **metabob-opencode** because:
- OpenCode vessel provides the capacity for orchestration
- OpenCode vessel has the session context (instructional state)
- OpenCode vessel spawns agents for each task (initiates becoming)
- The process-of-becoming (execution) manifests through the OpenCode vessel
- Execution state tracking is part of the vessel's responsibility

### Impact
- ✅ The fix works (endpoint now correct)
- ❌ The fix is in the wrong component
- ❌ metabob-cli has grown beyond its intended scope
- ❌ Execution logic duplicated between cli and opencode

---

## Error 2: We Fixed the Symptom, Not the Root Cause ❌

### What We Fixed
Changed endpoint from `/v2/activities/record/complete` to `/v2/activities/executions`

### What We Should Have Fixed
**The root cause**: ActivityManager shouldn't be in metabob-cli at all!

### The Real Problem
```
Current (Wrong):
  metabob-cli ActivityManager
    ↓
  POST /v2/activities/executions

Should Be:
  metabob-opencode ActivityManager
    ↓
  POST /v2/activities/executions (or via MCP tool)
```

### Why This Matters
We fixed the **immediate bug** (wrong endpoint) but didn't fix the **architectural problem** (wrong component owns execution).

---

## Error 3: Template Storage is Chaotic ❌❌

### What Exists Now
**3 separate storage locations**:

1. **Backend Redis**: `activity:template:{variant_id}`
   - Full templates with tasks, prompts, validation
   - Thompson Sampling metrics
   - Single source of truth

2. **metabob-cli local cache**: `~/.metabob/activities/`
   - Full templates (why?)
   - Never synced with backend
   - Unused in current flow

3. **OpenCode local storage**: `~/.local/share/opencode/storage/activity-template/`
   - Full templates
   - Manually synced (inconsistent)
   - Used by activity tool

### Why This Is Wrong
- **No single source of truth** - templates can be out of sync
- **Duplication of data** - same template in 3 places
- **Sync problems** - updating one doesn't update others
- **Confusion** - which storage is authoritative?

### What Should Exist
**2 locations only**:

1. **Backend Redis** (source of truth)
   - All templates
   - All metrics
   - Master copy

2. **OpenCode local cache** (performance optimization)
   - Read-only cache
   - Fetched on-demand from backend via MCP
   - Auto-invalidated on template updates

**metabob-cli should have ZERO local storage** - pure pass-through

---

## Error 4: MCP Gateway Pattern Violated ❌

### The Intended Pattern
```
OpenCode → (MCP only) → metabob-cli → (HTTP only) → Backend
```

**Rule**: OpenCode should NEVER make direct HTTP calls to backend

### What We Might Be Doing Wrong
We need to audit if OpenCode is calling backend directly:

**Potential violations**:
```typescript
// WRONG: Direct HTTP call from OpenCode
httpx.post("https://ide.metabob.com/v2/activities/executions", ...)

// CORRECT: Via MCP tool
await mcp.call("metabob_record_execution", {...})
```

### Why This Matters
- Breaks abstraction layer
- Bypasses MCP gateway
- Makes testing harder
- Creates tight coupling

### What We Need to Check
```bash
# Search for direct backend calls in OpenCode
grep -r "ide.metabob.com" repos/metabob-opencode/
grep -r "localhost:8080" repos/metabob-opencode/ | grep -v config
grep -r "metabob-rpc-api" repos/metabob-opencode/
```

---

## Error 5: Execution Recording Responsibility Unclear ❌

### Current Implementation (v0.6.14)
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def _record_outcome(self, execution, success):
    """Record execution outcome to backend"""
    outcome = {
        "variant_id": execution.variant_id,
        "success": success,
        "duration_ms": duration_ms,
        "cost": execution.total_cost,
        ...
    }
    
    response = await client.post(
        "/v2/activities/executions",
        json=outcome
    )
```

### The Problem
**Who should record execution outcomes?**

- ❌ metabob-cli? (current) - NO, it's stateless MCP server
- ✅ metabob-opencode? (correct) - YES, it owns execution

### Why We Got This Wrong
We followed the existing code structure instead of questioning whether it was correct.

### What Should Happen
```typescript
// repos/metabob-opencode/packages/plugin-activities/ActivityManager.ts

async recordExecution(execution: ActivityExecution) {
  const outcome = {
    variant_id: execution.variantId,
    success: execution.success,
    duration_ms: execution.durationMs,
    cost: execution.totalCost,
  };
  
  // Option A: Via MCP tool (preferred - maintains gateway)
  await this.mcp.call("metabob_record_execution", outcome);
  
  // Option B: Direct HTTP (acceptable - execution recording is special case)
  await httpx.post(`${BACKEND_URL}/v2/activities/executions`, outcome);
}
```

---

## Error 6: We Created a "Quick Fix" Instead of Proper Refactoring ❌

### What We Should Have Done
**Proper approach (ideal world)**:

1. **Phase 1**: Audit architecture
2. **Phase 2**: Create refactoring plan
3. **Phase 3**: Move ActivityManager to OpenCode
4. **Phase 4**: Remove execution logic from metabob-cli
5. **Phase 5**: Fix endpoint and test

### What We Actually Did
**Quick fix approach (reality)**:

1. ✅ Found bug (wrong endpoint)
2. ✅ Fixed endpoint in metabob-cli
3. ✅ Added variant_id to payload
4. ✅ Tested end-to-end
5. ❌ Did NOT refactor architecture
6. ❌ Left ActivityManager in wrong place

### Why This Happened
- **Time pressure**: Needed working fix quickly
- **Pragmatism**: Fix what's broken, refactor later
- **Complexity**: Moving ActivityManager is a major refactor

### The Debt We Created
**Technical debt incurred**:
- ActivityManager still in wrong component
- Template storage still chaotic
- Execution recording still in metabob-cli
- Architecture violations remain

---

## Error 7: Information Hiding Incomplete ❌

### What We Did
Added `get_template_safe()` in metabob-cli to hide implementation details from MCP tools:
```python
def get_template_safe(template_id: str) -> dict:
    """Return only agent-safe fields"""
    return {
        "activity_id": ...,
        "name": ...,
        "description": ...,
        "category": ...,
        "variables": ...,  # Safe
        # NO tasks, prompts, validation, retry
    }
```

### What We Missed
**The problem**: OpenCode can still get FULL templates!

**Two ways to get templates**:
1. **Via MCP** (safe): `metabob_get_activity_template()` → gets safe version
2. **Direct from backend** (unsafe?): If OpenCode calls backend directly, gets full template

**Question**: Can agents see full templates by calling backend API directly?

### Why This Matters
If agents can see full template implementation:
- Agents know exactly what steps will be executed
- Agents could game the system
- Defeats purpose of information hiding

### What We Need to Verify
```bash
# Check if OpenCode fetches templates from backend directly
grep -r "GET.*activities/templates" repos/metabob-opencode/
grep -r "fetch.*template" repos/metabob-opencode/
```

---

## Error 8: E2E Validation Only Tested Backend, Not Full Stack ❌

### What We Validated
✅ Backend endpoint works (`/v2/activities/executions`)
✅ Thompson Sampling updates correctly
✅ Metrics recorded to Redis
✅ Stats API returns aggregated data

### What We Did NOT Validate
❌ Does OpenCode ActivityManager call the right endpoint?
❌ Does OpenCode use metabob-cli or call backend directly?
❌ Does template sync work correctly?
❌ Does information hiding work end-to-end?

### The Test We Ran
```python
# test_activity_execution_e2e.py
# This tests BACKEND in isolation
httpx.post("http://localhost:8080/v2/activities/executions", ...)
```

### The Test We SHOULD Have Run
```bash
# Full stack test
opencode activity execute --template test-template
# Then verify:
# 1. Which component recorded execution?
# 2. Which API endpoints were called?
# 3. Was MCP gateway respected?
```

---

## Error 9: Docker Build Failure Blocking Deployment ❌

### The Problem
```bash
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.2 .
# ERROR: bun workspace catalog resolution failed
```

### Why It Fails
Bun workspace catalog in `repos/metabob-opencode/package.json` not copied correctly to Docker build context.

### What We Did
- Added `bun.lock` to fix reproducibility
- Did NOT fix the root cause (workspace catalog resolution)

### Why This Blocks Us
**Can't deploy the fix to production!**

The fix works locally but can't be packaged in Docker image.

### What We Should Do
**Option A**: Fix Docker build
- Debug bun workspace catalog issue
- Ensure `package.json` with catalog is copied
- Test build succeeds

**Option B**: Workaround
- Build locally outside Docker
- Copy binary to Docker image
- Deploy that

**Option C**: Skip Docker for now
- Deploy metabob-cli v0.6.14 to production directly
- Users install via `pip install -e .`
- Rebuild Docker later

---

## Error 10: Assumed Current Architecture Was Intentional ❌

### What We Assumed
"ActivityManager is in metabob-cli, so that must be correct"

### What Is Actually True
**The current architecture is WRONG** - it evolved incorrectly over time.

### Why This Matters
We spent time fixing code in the wrong place instead of moving it to the right place.

### The Real Lesson
**Always question existing structure before adding to it.**

---

## Summary of Errors

| # | Error | Severity | Fixed? | Effort to Fix |
|---|-------|----------|--------|---------------|
| 1 | ActivityManager in wrong component | 🔴 Critical | ❌ No | Large |
| 2 | Fixed symptom, not root cause | 🔴 Critical | ❌ No | Medium |
| 3 | Template storage chaos | 🟡 Major | ❌ No | Medium |
| 4 | MCP gateway pattern violated? | 🟡 Major | ❓ Unknown | Small |
| 5 | Execution recording unclear | 🟡 Major | ❌ No | Medium |
| 6 | Quick fix vs proper refactor | 🟡 Major | ❌ No | Large |
| 7 | Information hiding incomplete | 🟢 Minor | ❓ Unknown | Small |
| 8 | E2E validation incomplete | 🟢 Minor | ❌ No | Small |
| 9 | Docker build blocking deploy | 🔴 Critical | ❌ No | Medium |
| 10 | Assumed architecture was correct | 🟡 Major | ✅ Yes (now) | N/A |

---

## What We Should Do Now

### Immediate (Fix Production Block)
1. **Fix Docker build** - Unblock deployment
   - Debug bun workspace catalog
   - Test build succeeds
   - OR: Deploy via pip install (skip Docker)

2. **Deploy metabob-cli v0.6.14** - Get the fix to production
   - Push to git
   - Users update: `cd repos/metabob-cli && git pull && pip install -e .`

### Short Term (Fix Architecture)
3. **Move ActivityManager to OpenCode**
   - Create `metabob-opencode/packages/plugin-activities/ActivityManager.ts`
   - Port execution logic from Python to TypeScript
   - Update OpenCode activity tool to use new manager
   - Remove old ActivityManager from metabob-cli

4. **Centralize Template Storage**
   - Remove template storage from metabob-cli
   - OpenCode fetches templates via MCP only
   - Backend is single source of truth

5. **Validate MCP Gateway**
   - Audit OpenCode for direct backend calls
   - Ensure all backend communication via MCP
   - Add CI check to prevent violations

### Long Term (Clean Architecture)
6. **Refactor metabob-cli to Pure MCP Server**
   - Remove all execution logic
   - Remove all local storage
   - Pure stateless tool provider

7. **Document Intended Architecture**
   - ADR (Architecture Decision Records)
   - Component responsibilities
   - Communication protocols
   - CI validation

8. **Add Architecture Tests**
   - Check: metabob-cli has no execution logic
   - Check: OpenCode never calls backend directly
   - Check: Template storage only in backend + opencode cache
   - Check: No circular dependencies

---

## The Bigger Picture

### What We Learned
1. **Quick fixes accumulate technical debt**
2. **Existing code structure isn't always correct**
3. **Architecture violations compound over time**
4. **End-to-end testing must test the full stack**

### What We'll Do Better Next Time
1. **Question existing architecture** before extending it
2. **Refactor first, then fix** when architecture is wrong
3. **Test full stack**, not just individual components
4. **Document decisions** to prevent future confusion

### The Silver Lining
- ✅ We identified and documented all architectural issues
- ✅ We have a clear path forward
- ✅ The immediate fix works (even if in wrong place)
- ✅ We validated the backend works correctly
- ✅ We have comprehensive documentation of what's wrong

---

## Conclusion

**We got a lot wrong**, but we also got some things right:

**Right** ✅:
- Fixed the immediate bug (wrong endpoint)
- Added missing field (variant_id)
- Validated backend works correctly
- Documented architecture thoroughly
- Created E2E test
- Identified all architectural problems

**Wrong** ❌:
- Fixed code in the wrong component
- Didn't refactor architecture
- Left technical debt in place
- Docker build still broken
- Template storage still chaotic
- Full stack validation incomplete

**The Path Forward**: Fix the architecture properly, not just patch symptoms.

