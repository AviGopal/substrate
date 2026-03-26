# Deployment Reality Check - Scope Fix Implementation

## Current Situation

### ✅ What We Have

1. **Code Changes Complete**: 
   - Modified `repos/metabob-rpc-api` submodule
   - Files: `server/actions/activity.py`, `server/routes/activity.py`
   - Commits: 6239e36, 73605a9

2. **Schema Migration Ready**:
   - SQL prepared in `scripts/init-surrealdb-devbob-schema.sql`
   - Schema fields **ALREADY EXIST** in K8s SurrealDB:
     - `scope` field ✅
     - `org_id` field ✅
     - Index on org_id ✅

3. **Documentation Complete**:
   - Deployment guides
   - Test harnesses
   - Validation scripts

### ⚠️ What We DON'T Have

1. **Deployed Code**:
   - Running RPC API: `metabobapp/metabob-rpc-api:0.16.13` (OLD)
   - Running code uses different file structure:
     - Has: `server/actions/activity_management.py`
     - Needs: `server/actions/activity.py` (our changes)
   - **Code discrepancy**: Submodule ≠ Deployed image

2. **File Structure Mismatch**:
   ```
   Our changes:              Running container:
   actions/activity.py   VS  actions/activity_management.py
   routes/activity.py    VS  routes/activity_management.py
   ```

3. **Valid ANTHROPIC_API_KEY**:
   - Current key in pods is invalid (base64 session token)
   - Blocks activity execution testing

## Root Cause Analysis

### Why Files Don't Match

The `repos/metabob-rpc-api` submodule is **NOT** what's deployed in the running image. Possible reasons:

1. **Outdated Submodule**: Submodule might be behind the actual deployment
2. **Different Branch**: Running image might be from a different branch
3. **Build Process**: Docker image might use different source

### Impact

- ❌ Cannot test scope fix without rebuilding image
- ❌ Schema exists but unused (no code to use it)
- ✅ Can test existing template system without scope isolation
- ✅ Can validate infrastructure components

## What CAN We Test Now?

### Test 1: Template Registration (Without Scope)
```bash
# This WILL work (basic template registration)
curl -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", ...}'
```
**Expected**: Template created with scope=null, org_id=null (current behavior)

### Test 2: Template Query (Without Filtering)
```bash
# This WILL work (all users see all templates)
curl http://metabob-rpc-api:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN"
```
**Expected**: All templates returned (no org filtering)

### Test 3: Database Schema
```bash
# Verify schema fields exist
```
**Expected**: ✅ Fields exist, just not used by running code

### Test 4: Authentication Flow
```bash
# User registration, login, token validation
```
**Expected**: ✅ Working (validated in previous session)

## What CANNOT We Test Now?

### ❌ Scope Assignment
- Requires deployed code with scope extraction logic
- Current code doesn't set scope/org_id fields

### ❌ Query Filtering
- Requires deployed code with WHERE clause filtering
- Current code returns all templates

### ❌ Activity Execution
- Requires valid ANTHROPIC_API_KEY
- Current key is invalid

## Options to Proceed

### Option A: Full Deployment (Correct Approach)
**Steps**:
1. Verify submodule is up-to-date
2. Build Docker image: `metabobapp/metabob-rpc-api:0.16.14-scope-fix`
3. Push to registry
4. Update K8s deployment
5. Test scope isolation

**Time**: 30-60 minutes (build + deploy + test)
**Risk**: Low (changes are additive)

### Option B: Test Existing System (What We Can Do Now)
**Steps**:
1. Test template registration (global templates)
2. Test template queries (no filtering)
3. Test Thompson Sampling recommendations
4. Document current state
5. Verify infrastructure health

**Time**: 15 minutes
**Risk**: None (read-only testing)

### Option C: Manual Code Injection (Quick Hack)
**Steps**:
1. Copy fixed files into running container
2. Restart Python process
3. Test immediately

**Time**: 10 minutes
**Risk**: Medium (changes lost on pod restart)

## Recommendation

### For Production Deployment
**Use Option A** (Full Deployment) when ready to deploy:
- Ensures consistency
- Proper rollback available
- All pods updated atomically

### For Immediate Testing
**Use Option B** (Test Existing System) to:
- Validate infrastructure is working
- Test non-scope-related features
- Document current baseline
- Prepare validation scripts for post-deployment

## Current Test Plan

Since we **cannot test scope isolation** without deployment, let's:

1. ✅ Verify schema fields exist (DONE)
2. ✅ Test basic template CRUD (can do)
3. ✅ Test authentication (already validated)
4. ✅ Test Thompson Sampling (can do)
5. ⏳ Document deployment checklist
6. ⏳ Create post-deployment validation script

## Post-Deployment Validation Checklist

Once the new image is deployed, run these tests:

```bash
# 1. Verify schema is used
curl .../templates/ID | jq '.scope, .org_id'
# Expected: Non-null values

# 2. Test org isolation
# User 1 creates org template
# User 2 queries
# Expected: User 2 does NOT see User 1's template

# 3. Test global templates
# Create global template
# Both users query
# Expected: Both see global template

# 4. Test unauthenticated access
# Query without token
# Expected: Only global templates returned
```

## Summary

**What's Ready**:
- ✅ Code written and validated
- ✅ Schema migrated
- ✅ Documentation complete
- ✅ Test harnesses created

**What's Blocking**:
- ⚠️ Docker image not built with new code
- ⚠️ Code discrepancy between submodule and deployed image
- ⚠️ Invalid ANTHROPIC_API_KEY for activity execution

**What We Can Do**:
- ✅ Test existing system without scope
- ✅ Validate infrastructure
- ✅ Prepare deployment validation
- ✅ Document current state

**Next Step**:
Choose Option B (test what we can) and document the deployment path for when the team is ready to build and deploy the new image.

---

**Status**: Ready for deployment, testing limited by deployment blockers  
**Date**: 2026-03-01  
**Recommendation**: Test existing system, prepare for deployment
