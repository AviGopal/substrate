# Next Steps - Impulse Tracking Verification

**Quick Status**: ✅ Code fix complete | 🟡 E2E testing ready but blocked | ⏳ Waiting for templates

---

## What We Just Did (This Session)

### 1. Reviewed Previous Work ✅
- Confirmed bug fix is in place (commit `7282694d1`)
- Verified unit tests proved the fix works
- Reviewed comprehensive documentation from previous session

### 2. Attempted E2E Verification 🟡
- Backend is running and healthy (port 8080)
- Database is running (SurrealDB on port 8000)
- **Issue found**: No activity templates registered (0 templates)
- Cannot execute activities without templates

### 3. Created E2E Verification Tools ✅
Created two new resources ready to use:

**a) `IMPULSE_TRACKING_E2E_VERIFICATION_PLAN.md`**
- Comprehensive step-by-step verification plan
- Database queries to check impulse tracking
- Learning loop API tests
- Troubleshooting guide

**b) `verify_impulse_tracking_e2e.py`**
- Automated end-to-end verification script
- Creates test impulses
- Executes activity with impulses
- Verifies tracking in database
- Tests learning loop APIs
- **Ready to run** (just needs templates first)

---

## What You Need to Do Next

### Step 1: Register Activity Templates

The backend database has no templates. Register them using one of these scripts:

**Option A: Use existing script** (Recommended)
```bash
# Check which registration scripts are available
ls scripts/register*bootstrap*

# Run the registration script
python3 scripts/register_bootstrap_templates.py

# OR
python3 scripts/register-bootstrap-templates.py
```

**Option B: Bootstrap database**
```bash
# If init/bootstrap scripts exist
python3 scripts/init-db.py

# OR
bash scripts/init-database.sh
```

**Verify templates were registered**:
```bash
curl -s http://localhost:8080/v2/activities/templates | jq '.templates | length'
# Should show > 0
```

### Step 2: Run E2E Verification

Once templates are registered:

```bash
# Run the automated verification script
python3 verify_impulse_tracking_e2e.py
```

**Expected output**:
```
======================================================================
End-to-End Impulse Tracking Verification
======================================================================

[1/6] Loading configuration...
   ✓ Base URL: http://localhost:8080
   ✓ Session token loaded

[2/6] Initializing activity manager...
   ✓ Activity manager ready

[3/6] Searching for activity templates...
   ✓ Found 17 template(s)
   ✓ Using: INFRASTRUCTURE-0013e379 (Activity Create)

[4/6] Creating test impulses...
   ✓ Created 2 test impulses
      - e2e-test-impulse-memo (memo, 25 tokens)
      - e2e-test-impulse-file (file, 150 tokens)

[5/6] Executing activity with impulses...
   ✓ Execution started: exec_abc123...
   ✓ Impulses sent: 2

[6/6] Verifying impulses in database...
   ✓ Database query successful
   ✓ Execution record found: exec_abc123...
   ✓ Impulses tracked in DB: 2

   Impulse data verification:
      Expected IDs: ['e2e-test-impulse-memo', 'e2e-test-impulse-file']
      Tracked IDs:  ['e2e-test-impulse-memo', 'e2e-test-impulse-file']

   ✓ Data integrity verified

======================================================================
✅ SUCCESS: End-to-End Impulse Tracking Verified!
======================================================================
```

### Step 3: Test Learning Loop APIs (Optional)

The verification script will automatically test these if Step 2 succeeds:

```bash
# Query learned impulses
curl -s http://localhost:8080/v2/impulses/learned?min_success_rate=0.5 \
  -H "Authorization: Bearer mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E" | jq '.'

# Query impulses for specific activity
curl -s http://localhost:8080/v2/impulses/for-activity/INFRASTRUCTURE-0013e379 \
  -H "Authorization: Bearer mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E" | jq '.'
```

---

## Troubleshooting

### If Template Registration Fails

**Check bootstrap directory exists**:
```bash
ls repos/metabob-proto/activities/bootstrap/
# OR
ls repos/metabob-opencode/packages/opencode/templates/built-in/
```

**Manually register a simple template**:
```bash
# Use the built-in templates
cd repos/metabob-opencode/packages/opencode/templates/built-in
ls *.json

# Register one manually (TODO: add registration command)
```

### If E2E Verification Fails

**1. Check impulse tracking fix is in place**:
```bash
grep -A 5 "def _capture_session_impulses" \
  repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py | head -15

# Should see:
#   if not execution.impulses_used:
#       return []
```

**2. Check database connection**:
```bash
curl -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM activity_executions LIMIT 1;"}' | jq '.'
```

**3. Run with debug output**:
```bash
python3 -u verify_impulse_tracking_e2e.py 2>&1 | tee verification.log
```

### If Learning APIs Return Empty

This is expected initially! The learning system needs:
1. Multiple activity executions with impulses
2. Success/failure data for each execution
3. Time to analyze effectiveness

After running a few activities with impulses, the learning APIs will start returning data.

---

## What Happens After Verification Succeeds

### Immediate Benefits
✅ **Impulse tracking working** - All impulses are tracked in database  
✅ **Learning loop foundation** - Data is being collected for analysis  
✅ **Debugging enabled** - Can query which impulses were used in any execution

### Short-Term Enhancements (Next Session)
1. **SessionMemoryAgent integration** - Pre-load proven impulses
2. **Activity optimization** - Use historical impulse data
3. **Dashboard integration** - Show impulse effectiveness metrics

### Long-Term Vision
1. **Automatic context optimization** - System learns best context for each activity
2. **Template evolution** - Templates improve based on impulse effectiveness
3. **Component micro-agents** - Metabob-discovered components get optimal context
4. **Zero-configuration AI** - System tunes itself based on usage patterns

---

## Files Reference

### New Files (Created This Session)
- `IMPULSE_TRACKING_E2E_VERIFICATION_PLAN.md` - Detailed verification plan
- `verify_impulse_tracking_e2e.py` - Automated verification script ⭐
- `SESSION_RESUME_FEB15_IMPULSE_TRACKING.md` - Session resume summary
- `NEXT_STEPS_IMPULSE_TRACKING.md` - This file (quick reference)

### Previous Session Files
- `IMPULSE_TRACKING_FIX_VERIFIED.md` - Bug fix technical details
- `IMPULSE_TRACKING_USAGE_AND_LEARNING.md` - System architecture and learning loop
- `SESSION_COMPLETE_FEB15_IMPULSE_TRACKING_FIX.md` - Previous session summary

### Code Files
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (line 1069-1084) - The fix

---

## Quick Command Reference

```bash
# 1. Register templates
python3 scripts/register_bootstrap_templates.py

# 2. Verify templates exist
curl -s http://localhost:8080/v2/activities/templates | jq '.templates | length'

# 3. Run E2E verification
python3 verify_impulse_tracking_e2e.py

# 4. Check database manually
curl -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT execution_id, array::len(impulses_used) AS count FROM activity_executions ORDER BY created_at DESC LIMIT 5;"}' | jq '.'

# 5. Test learning API
curl -s http://localhost:8080/v2/impulses/learned?min_success_rate=0.5 \
  -H "Authorization: Bearer mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E" | jq '.'
```

---

## Success Metrics

You'll know it's working when:
- ✅ Templates are registered (count > 0)
- ✅ E2E script completes successfully
- ✅ Database shows `impulses_used` with data
- ✅ Impulse count matches expected (2 in test script)
- ✅ Learning APIs are accessible (may be empty initially)

---

## TL;DR - Just Do This

```bash
# Register templates
python3 scripts/register_bootstrap_templates.py

# Run verification
python3 verify_impulse_tracking_e2e.py

# Expected: ✅ SUCCESS message
```

That's it! 🎉

---

**Current Status**: Code fix complete ✅ | Verification ready 🟡 | Just needs templates ⏳
