# Metabob-CLI CI/CD Fix Plan

## Current State Analysis

### Issues Identified

1. **Git Submodule Problem** (CRITICAL - BLOCKING)
   - `dashboard` directory tracked as submodule (mode 160000) 
   - No .gitmodules file exists
   - Causes commitizen action to fail with: `fatal: No url found for submodule path 'dashboard' in .gitmodules`
   - **Impact**: Blocks version-check workflow on every push

2. **CI/CD Workflow Status**
   - ✅ build-and-release: PASSING (last run successful)
   - ❌ check-versioning: FAILING (git submodule error)
   - Unknown: tests, platform-compatibility (need to check)

3. **Dashboard Directory**
   - Empty directory (only `.` and `..`)
   - Likely orphaned submodule from previous implementation
   - Has related code: `src/metabob_cli/mcp/dashboard_api.py`

### Root Cause

Git submodule registered in git index but:
- No .gitmodules configuration
- Empty directory (submodule not initialized)
- Commitizen action tries to update submodules → fails

## Fix Strategy

### Approach 1: Remove Dashboard Submodule (RECOMMENDED)
**Rationale**: Empty directory, no .gitmodules, likely obsolete

**Steps**:
1. Remove submodule from git index
2. Remove dashboard directory  
3. Check if dashboard_api.py needs updates
4. Test CI/CD workflows

**Activity**: `fix-bug-complete`
- Bug: Git submodule without .gitmodules blocks versioning
- Fix: Remove orphaned dashboard submodule
- Test: Verify version-check workflow passes

### Approach 2: Restore Submodule Configuration
**Rationale**: If dashboard is needed, restore properly

**Steps**:
1. Find original dashboard repository URL
2. Create .gitmodules with correct config
3. Initialize submodule properly
4. Test CI/CD workflows

**Activity**: `fix-bug-complete` or `refactor-with-tests`

## Recommended Fix Plan

### Phase 1: Remove Orphaned Submodule (CRITICAL)
**Activity**: `fix-bug-complete`

```
Variables:
- bugDescription: "Git submodule 'dashboard' without .gitmodules blocks CI/CD versioning workflow"
- files: [".gitmodules", "dashboard/", "src/metabob_cli/mcp/dashboard_api.py"]
- priority: "critical"
```

**Expected Changes**:
```bash
git rm --cached dashboard
rm -rf dashboard/
# Check if dashboard_api.py needs updates
# Commit with clear explanation
```

### Phase 2: Verify CI/CD Workflows
**Activity**: `verify-http-rpc-and-persistence-end-to-end` or manual validation

**Tests**:
1. Push to staging branch
2. Verify version-check workflow passes
3. Verify build-and-release workflow passes
4. Check all GitHub Actions pass

### Phase 3: Additional CI/CD Improvements (If needed)
**Activities**: 
- `fix-bug-complete` for any remaining test failures
- `refactor-with-tests` for workflow improvements
- `add-comprehensive-tests` for coverage gaps

## Success Criteria

- ✅ version-check workflow passes on staging push
- ✅ build-and-release workflow passes
- ✅ All platform builds succeed (Linux, macOS, Windows)
- ✅ Staging releases can be created reliably
- ✅ No git submodule errors in any workflow

## Execution Order

1. **fix-bug-complete** (dashboard submodule) - IMMEDIATE
2. Validate by pushing to staging
3. Monitor CI/CD runs
4. Address any remaining issues with additional activities

## Risk Assessment

**Low Risk**: 
- Dashboard directory is empty
- No .gitmodules means it's not properly configured
- dashboard_api.py exists but may not depend on submodule

**Mitigation**:
- Review dashboard_api.py before removing
- Keep commit focused and reversible
- Test on staging before any production changes

## Timeline

- Phase 1 (Fix): 30-45 minutes (activity + validation)
- Phase 2 (Verify): 15-30 minutes (CI/CD runs)
- Phase 3 (Optional): As needed

**Total**: 1-2 hours for full resolution
