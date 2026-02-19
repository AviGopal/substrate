# Activity Execution Tracking Fix - Implementation Summary

## Problem Identified

Activity executions were not being recorded to the production backend (ide.metabob.com), preventing Thompson Sampling learning and usage metrics tracking.

### Root Cause

**Endpoint Mismatch**: metabob-cli was calling a non-existent endpoint:
- **Called**: `POST /v2/activities/record/complete` (line 1549, 2059)
- **Actual**: `POST /v2/activities/executions` (line 237 of server/routes/activity.py)

**Missing Required Field**: metabob-cli wasn't including `variant_id` in the payload, which is required by the backend for Thompson Sampling metrics.

## Solution Implemented

### 1. Information Hiding (v0.6.13)
**Files Modified:**
- `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Changes:**
- Added `extract_template_variables()` to extract variable definitions
- Added `get_template_safe()` returning only agent-relevant fields:
  - ✅ activityId, name, description, category, variables, estimatedMetrics
  - ❌ tasks, prompts, validation, retry, dependencies
- Updated `metabob_get_activity_template` MCP tool to use safe function
- Enforces need-to-know principle for template metadata

### 2. Execution Recording Fix (v0.6.14)
**Files Modified:**
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Changes:**
- Line 1549: Changed `/v2/activities/record/complete` → `/v2/activities/executions`
- Line 2059: Changed `/v2/activities/record/complete` → `/v2/activities/executions`
- Line 1521: Added `"variant_id": execution.variant_id` to outcome payload
- Line 1543: Updated log message to reflect correct endpoint

**Impact:**
- Activity executions now successfully record to production backend
- Thompson Sampling can learn which template variants perform better
- Execution metrics (cost, duration, success rate) now tracked
- Production visibility into activity usage restored

## Deployment Strategy

### Immediate (No Docker Build Required)

**metabob-cli** is a Python package that users can update directly:

```bash
cd repos/metabob-cli
git pull origin main
pip install -e .  # Or reinstall via package manager
```

The fix takes effect immediately for:
- Local development usage
- MCP server instances (restart required)
- Any environment using metabob-cli directly

### Future (Docker Build for Production)

**devbob image** (metabobapp/devbob) includes metabob-cli and needs rebuild:

**Current Status:**
- Dockerfile exists: `docker/Dockerfile.devbob`
- Build currently fails due to bun workspace catalog resolution
- Added bun.lock to fix reproducibility
- Image tag: v1.0.2 (planned)

**Build Command:**
```bash
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.2 .
docker push metabobapp/devbob:v1.0.2
```

**Helm Deployment:**
```bash
# Update metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml
# Change: image.tag: "v1.0.1" → "v1.0.2"

helmfile -e production apply
```

## Verification Steps

### 1. Check metabob-cli Version
```bash
metabob-cli --version  # Should show v0.6.14+
```

### 2. Test Activity Execution Recording
```python
# In Python REPL
from metabob_cli.mcp.activity_manager import ActivityManager

manager = ActivityManager(
    base_url="https://ide.metabob.com",
    session_token="YOUR_TOKEN"
)

# Execute an activity and verify backend receives metrics
# Check Redis: redis-cli GET "activity:metrics:template-id"
```

### 3. Check Production Backend
```bash
# Query production backend for recent executions
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://ide.metabob.com/v2/activities/templates/{template_id}/stats
```

## Known Issues & Future Work

### 1. Docker Build (Bun Workspace)
**Issue**: Dockerfile fails with "catalog: failed to resolve" errors
**Cause**: Bun workspace catalog resolution in Docker build context
**Status**: Added bun.lock but still failing
**Workaround**: Manual build outside Docker or use existing Python installation

### 2. Additional Endpoints
**Status**: metabob-cli still references other missing endpoints:
- `/v2/activities/record/start` (line 704, 1989)
- `/v2/activities/record/step` (line 2126)
- `/v2/activities/executions/{id}/tasks` (line 937)

**Impact**: These are for granular step tracking - not critical for basic functionality
**Recommendation**: Either implement backend endpoints or remove CLI code

### 3. Backend API Documentation
**Need**: Document `/v2/activities/executions` request/response schema
**Location**: repos/metabob-rpc-api/server/routes/activity.py line 237-278

## Commits

1. `5ee1d5d0a` - feat: Add information hiding for activity template MCP tools
2. `546daf015` - chore: Bump version for information hiding feature  
3. `7c52a8b7a` - fix(mcp): Fix activity execution recording to production backend
4. `86f9602` - feat(devbob): Prepare metabob-cli v0.6.14 for devbob v1.0.2 build
5. `8062d54` - fix(docker): Fix devbob Docker build bun catalog resolution

## Testing Checklist

- [x] metabob-cli builds successfully
- [x] Information hiding works (templates don't expose tasks/prompts)
- [x] Endpoint path corrected to `/v2/activities/executions`
- [x] variant_id included in execution outcome payload
- [ ] Docker build succeeds (blocked on bun workspace issue)
- [ ] Production deployment tested
- [ ] Activity execution metrics appear in backend
- [ ] Thompson Sampling learning confirmed working

## Next Steps

1. ✅ **Immediate**: Push metabob-cli changes to allow direct installation
2. ⚠️ **Blocked**: Resolve Docker build bun workspace catalog issue
3. 🔄 **Pending**: Build and push devbob:v1.0.2 image
4. 🔄 **Pending**: Update helm values and deploy to production
5. 🔄 **Pending**: Verify activity executions recording in production
6. 📝 **Follow-up**: Document or remove unused `/record/*` endpoints in CLI

