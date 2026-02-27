# Vessel Self-Configuration Validation Findings

**Date**: 2026-02-27  
**Validation Type**: Runtime Integration Testing  
**Result**: ⚠️ **PARTIAL IMPLEMENTATION**

---

## Executive Summary

The runtime validation revealed that **vessel self-configuration is partially implemented** but has critical gaps that prevent it from working as specified. The condition "vessel automatically configures itself on startup" is **NOT fully met**.

**Status**: 🔴 **CONDITION NOT MET** - Requires fixes before production deployment

---

## Validation Results

### ✅ What Works (5/13 tests passing)

1. **✅ Container Build**: Image builds successfully
2. **✅ Container Startup**: Container starts without immediate crashes
3. **✅ Environment Detection**: Correctly detects dev/staging/prod from hostname
4. **✅ ANTHROPIC_API_KEY Validation**: Checks for required API key
5. **✅ Backend URL Configuration**: Accepts METABOB_API_URL environment variable

### ❌ What Doesn't Work (8/13 tests failing)

6. **❌ Backend Connectivity Validation**: Blocks for 60 seconds waiting for backend (30 retries × 2s)
   - **Impact**: Container startup hangs if backend is unavailable
   - **Workaround**: Set `WAIT_FOR_BACKEND=false`
   
7. **❌ Activity Execution**: configure-vessel-for-environment activity is NOT executed
   - **Reason**: Activity execution requires `BACKEND_READY=true` (line 141 of entrypoint)
   - **Impact**: No automatic configuration happens
   
8. **❌ Config File Creation**: opencode.json not created automatically
   - **Reason**: `opencode auth setup --non-interactive` has incorrect parameters
   - **Error**: "Unknown arguments: non-interactive"
   
9. **❌ Config Backup**: No backups created because config creation fails

10. **❌ ACP Server Startup**: Server crashes on launch
    - **Error**: "Bootstrap template file read failed: ENOENT create-activity-self-contained.json"
    - **Reason**: Standalone binary expects templates at `/metabob-proto/activities/bootstrap/`
    - **Impact**: Container exits immediately after startup sequence
    
11. **❌ ConfigManager Tools**: Source files not in container
    - **Reason**: This is a standalone binary container, not a source deployment
    - **Impact**: Validation test assumption was incorrect
    
12. **❌ VesselUpdateManager Tools**: Source files not in container
    - **Reason**: Same as above - standalone binary deployment
    
13. **❌ Safe Configuration Updates**: Cannot test because container crashes

---

## Root Cause Analysis

### Issue 1: Incorrect Container Architecture Assumption

**Problem**: The validation test assumed a **source-based deployment** where TypeScript files exist in the container.

**Reality**: The Dockerfile creates a **standalone binary deployment**:
- Only contains `/usr/local/bin/opencode` (single binary)
- No source code in `/workspace/repos/`
- Templates are supposed to be embedded in the binary

**Impact**: Tests 12-13 were checking for files that will never exist in this deployment model.

### Issue 2: Activity Execution Conditional on Backend

**Problem**: Entrypoint script (line 141) only runs configuration activity if `BACKEND_READY=true`:

```bash
if [ "$BACKEND_READY" = "true" ]; then
    opencode activity execute configure-vessel-for-environment ...
else
    log_warn "  Skipping configuration activity (no backend connectivity)"
fi
```

**Impact**: If backend is unavailable (common during startup), **NO self-configuration happens**.

**Specification Violation**: The spec says "vessel automatically configures itself" but this is conditional, not automatic.

### Issue 3: Backend Connectivity Blocking

**Problem**: Entrypoint waits up to 60 seconds (30 × 2s) trying to reach backend:

```bash
MAX_RETRIES=30
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Try to connect
    sleep 2
done
```

**Impact**: 
- Container hangs for 60 seconds if backend is down
- Pods fail health checks in Kubernetes
- Development workflow is slow

**Specification Violation**: Vessel should be **self-sufficient**, not dependent on external services for startup.

### Issue 4: Bootstrap Templates Missing

**Problem**: Standalone binary crashes looking for templates:
```
error: Bootstrap template file read failed for create-activity: ENOENT: 
no such file or directory, open '/metabob-proto/activities/bootstrap/create-activity-self-contained.json'
```

**Impact**: ACP server cannot start at all - container exits immediately.

**Root Cause**: Binary was built without embedded templates, or template paths are wrong.

### Issue 5: Auth Setup Command Incorrect

**Problem**: Command `opencode auth setup --non-interactive` fails:
```
ERROR: Unknown arguments: non-interactive, nonInteractive, setup
```

**Impact**: Initial config file not created, so vessel has no starting configuration.

**Root Cause**: CLI command signature changed but entrypoint script wasn't updated.

---

## Gap Summary

| Component | Expected Behavior | Actual Behavior | Gap |
|-----------|------------------|-----------------|-----|
| **Entrypoint** | Runs on startup | ✅ Runs | None |
| **Environment Detection** | Detects dev/staging/prod | ✅ Works | None |
| **Backend Check** | Quick validation | ❌ Blocks 60s | High |
| **Activity Execution** | Automatic, regardless of backend | ❌ Conditional on backend | **Critical** |
| **Config Creation** | Creates opencode.json | ❌ Command fails | **Critical** |
| **Config Backup** | Creates backup before changes | ❌ N/A (no config) | Medium |
| **ACP Server** | Starts successfully | ❌ Crashes | **Critical** |
| **Safe Updates** | ConfigManager available | ❌ N/A (container crashes) | Medium |
| **Version Management** | VesselUpdateManager available | ❌ N/A (binary deployment) | Medium |

---

## Required Fixes (Priority Order)

### 🔴 Critical Fixes (Blocking)

1. **Fix Bootstrap Template Paths**
   - Problem: Binary can't find `/metabob-proto/activities/bootstrap/*.json`
   - Solution: Either embed templates in binary OR copy them to expected location in Dockerfile
   - Priority: **P0 - BLOCKING**

2. **Fix Config Creation Command**
   - Problem: `opencode auth setup --non-interactive` has wrong arguments
   - Solution: Update entrypoint to use correct CLI command (check `opencode auth --help`)
   - Priority: **P0 - BLOCKING**

3. **Make Activity Execution Unconditional**
   - Problem: Configuration only runs if backend is reachable
   - Solution: Run activity even without backend, just skip backend-dependent tasks
   - Priority: **P0 - BLOCKING**

### 🟡 High Priority Fixes (Important)

4. **Reduce Backend Connectivity Timeout**
   - Problem: 60-second wait blocks startup
   - Solution: Reduce to 3 retries (6 seconds max) or make non-blocking
   - Priority: **P1 - HIGH**

5. **Update Validation Tests for Binary Deployment**
   - Problem: Tests check for source files that don't exist
   - Solution: Test for binary-embedded functionality instead
   - Priority: **P1 - HIGH**

### 🟢 Medium Priority Fixes (Nice to Have)

6. **Add Health Checks**
   - Problem: No way to know when container is ready
   - Solution: Add `/health` endpoint that returns status
   - Priority: **P2 - MEDIUM**

7. **Implement Fallback Configuration**
   - Problem: If activity fails, vessel has no config
   - Solution: Ship default opencode.json in container
   - Priority: **P2 - MEDIUM**

---

## Corrected Validation Strategy

### Level 1: Static Analysis ✅ (Still Valid)
- Checks code structure exists
- **Status**: 10/10 passing
- **Note**: Still valuable for source code validation

### Level 2: Runtime Integration 🔄 (Needs Update)
- **Current approach**: Assumes source-based deployment
- **Needed approach**: Test standalone binary capabilities
- **New tests needed**:
  1. Binary starts without crash
  2. Environment detection works
  3. Config created (once command fixed)
  4. ACP server responds (once templates fixed)
  5. Configuration persists across restarts

### Level 3: Manual E2E 📋 (Needs Update)
- Update guide to test binary deployment, not source deployment
- Add tests for embedded vs. external configuration
- Test configuration via ACP server API, not filesystem

---

## Recommended Action Plan

### Immediate Actions (Today)

1. **Fix bootstrap template paths**
   ```bash
   # Option A: Copy templates to expected location in Dockerfile
   COPY repos/metabob-opencode/activities/bootstrap /metabob-proto/activities/bootstrap
   
   # Option B: Fix binary build to embed templates correctly
   cd repos/metabob-opencode && bun run build --single --embed-templates
   ```

2. **Fix auth setup command**
   ```bash
   # In entrypoint-self-config.sh line 134, change to:
   opencode auth login anthropic --non-interactive || true
   # OR
   opencode config init --minimal || true
   ```

3. **Make activity execution unconditional**
   ```bash
   # In entrypoint-self-config.sh line 141, remove if statement:
   # Run activity always, but handle backend-dependent tasks gracefully
   opencode activity execute configure-vessel-for-environment \
       --variable force_environment="$CONTAINER_ENV" \
       --variable config_path="$CONFIG_FILE" \
       --variable backend_available="$BACKEND_READY" \
       --reason "Self-configuration on container startup" \
       --non-interactive 2>&1 | tee /tmp/config-activity.log || {
           log_warn "  ⚠ Configuration activity failed, using fallback config"
       }
   ```

### Short-term Actions (This Week)

4. Reduce backend timeout to 3 retries (6 seconds)
5. Update validation tests for binary deployment model
6. Add default opencode.json fallback to Dockerfile
7. Implement health check endpoint

### Medium-term Actions (Next Sprint)

8. Add comprehensive E2E tests for binary deployment
9. Document binary vs. source deployment differences
10. Create troubleshooting guide for startup failures

---

## Conclusion

**Current Status**: ⚠️ **PARTIALLY IMPLEMENTED**

The vessel self-configuration system has the right **structure** (entrypoint script, environment detection, activity template) but has **critical implementation gaps** that prevent it from working:

- ✅ **Architecture is sound**: Good design with entrypoint orchestration
- ❌ **Execution fails**: Binary crashes, config not created, activity doesn't run
- ❌ **Specification not met**: Vessel does NOT automatically configure itself

**Condition Status**: 🔴 **NOT MET** - Requires 3 critical fixes before production deployment

**Estimated Fix Time**: 4-6 hours of development + testing

**Next Step**: Implement the 3 critical fixes (P0) to unblock validation

---

**Validation Date**: 2026-02-27  
**Validated By**: Runtime integration testing  
**Test Results**: 5/13 passing (38% pass rate)  
**Production Ready**: ❌ **NO** - Critical issues blocking deployment
