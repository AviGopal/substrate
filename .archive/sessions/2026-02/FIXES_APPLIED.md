# Activity System Fixes Applied

**Date**: February 9, 2026  
**Method**: Iterative error fixing based on actual HTTP responses

---

## Problems Found and Fixed

### Problem 1: Template Variable Format Mismatch
**Error**: 422 Unprocessable Entity - "Input should be a valid string"

**Root Cause**: Template had variables as objects, backend expected strings

**Template format**:
```json
"variables": [{"name": "scope", "type": "string", ...}]
```

**Backend expected**:
```json
"variables": ["scope", "mode", "archiveInsteadOfDelete"]
```

**Fix**: Converted variables from objects to strings
- File: `fix-jiggle-template.py` 
- Output: `jiggle-fixed.json`
- Result: Registration succeeded (201 Created)

### Problem 2: Wrong Backend Endpoint
**Error**: 404 Not Found when fetching variant details

**Root Cause**: OpenCode calling wrong endpoint

**Code was calling**:
```
GET /activity-recommendations/variants/{id}/details
```

**Backend actually has**:
```
GET /v2/activities/templates/{id}
```

**Fix**: Updated metabob-api.ts line 379
- Changed: `/activity-recommendations/variants/${variantId}/details`
- To: `/v2/activities/templates/${variantId}`
- Result: OpenCode rebuilt successfully

---

## Current Status

### What Works Now:
1. Backend has 27 activities registered
2. GET /v2/activities/templates returns list
3. GET /v2/activities/templates/{id} returns details  
4. Jiggle activity registered as `refactor-5fccfc17`
5. OpenCode code path fixed to use correct endpoint
6. OpenCode rebuilt with fix

### What Still Needs Testing:
1. Does OpenCode binary actually work with the fix?
2. Can search_activities find the registered activities?
3. Can activity() tool execute them?
4. Do the tasks actually run?

---

## Files Modified

1. **repos/metabob-opencode/packages/opencode/src/util/metabob-api.ts**
   - Line 379: Fixed endpoint URL

2. **jiggle-fixed.json** (created)
   - Template with corrected variable format

3. **register-jiggle-v2.py** (created)
   - Successfully registered activity via API

---

## Test Scripts Created

- `test-activity-execution-flow.py` - Tests full flow
- `check-what-registered.py` - Verifies registration
- `test-correct-endpoint.py` - Proves correct endpoint works
- `fix-jiggle-template.py` - Converts template format

---

## Next Steps

1. Test search_activities returns results
2. Test activity tool can execute
3. Verify tasks run without errors
4. Fix any new errors that appear

---

## Evidence

All fixes based on actual HTTP responses:
- 422 error showed exact schema mismatch
- 404 error showed endpoint doesn't exist
- 200 success showed correct endpoint works
- 201 created showed registration succeeded

No speculation. Only responses from the actual backend.
