# V1 Implementation Cleanup Plan

**Date**: February 11, 2026  
**Goal**: Remove V1 bootstrap templates implementation and prevent confusion  
**Status**: 📋 Ready for Execution

---

## Files to Delete

### 1. OpenCode Bootstrap Implementation (metabob-opencode)

#### Source Files (DEPRECATED - Safe to Delete)
```
repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts
```
- Already marked as @deprecated
- No active imports in production code
- Only used by test files
- Contains V1 converter logic

#### Test Files (No Longer Needed)
```
repos/metabob-opencode/packages/opencode/test/session/bootstrap-templates.test.ts
repos/metabob-opencode/packages/opencode/test/session/bootstrap-fallback.test.ts
repos/metabob-opencode/packages/opencode/test/session/bootstrap-registration.test.ts
repos/metabob-opencode/packages/opencode/test/session/template-loader.test.ts
```
- Test V1 bootstrap loading
- No longer relevant with backend-only templates

### 2. Bootstrap Template Backups (metabob-proto)

```
repos/metabob-proto/activities/bootstrap/*.json.backup (9 files)
```
- Created during migration
- No longer needed (changes committed to git)
- Can restore from git if needed

### 3. Legacy Test/Debug Scripts (Root Directory)

```
register-hello-world-template.py
register-jiggle-activity.py
register-jiggle-v2.py
check-what-registered.py
fix-jiggle-template.py
```
- One-off scripts for testing
- Superseded by `scripts/register-bootstrap-templates.py`

---

## Files to Keep (But Update)

### 1. template-loader.ts - KEEP with cleanup

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

**Current state**: Has backward-compatible transformer that handles both `task_steps` and `tasks`

**Action**: Remove `task_steps` fallback since all templates are now V2

**Change**:
```typescript
// Line 22 - BEFORE
tasks: (activity.task_steps || activity.tasks || []).map(...)

// AFTER  
tasks: (activity.tasks || []).map(...)
```

**Reason**: Templates are now V2-only, no need to support `task_steps`

### 2. proto-converters.ts - KEEP (stub for future)

**File**: `repos/metabob-opencode/packages/opencode/src/session/proto-converters.ts`

**Status**: Stub implementation for future proto integration

**Action**: Keep as-is (not related to V1 cleanup)

### 3. Migration Scripts - KEEP

**Files**:
```
scripts/migrate-bootstrap-v1-to-v2.py
scripts/register-bootstrap-templates.py
```

**Reason**: Reusable for future template migrations or registration

---

## Code Changes Needed

### Change 1: Remove task_steps Fallback

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

**Line 22**:
```diff
- tasks: (activity.task_steps || activity.tasks || []).map((task: any, index: number) => ({
+ tasks: (activity.tasks || []).map((task: any, index: number) => ({
```

**Impact**: Backend must always send `tasks` field (which it does after V2 migration)

### Change 2: Remove V1 Converter References

**File**: `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`

**Action**: DELETE entire file

**Impact**: 
- No production code imports it (verified)
- Test files that import it will be deleted
- Template loading now 100% backend-only

---

## Verification Steps

### Before Deletion

1. **Verify no production imports**:
   ```bash
   cd repos/metabob-opencode
   grep -r "from.*bootstrap-templates" --include="*.ts" --exclude-dir=test --exclude-dir=node_modules
   # Should return: empty
   ```

2. **Verify all templates migrated**:
   ```bash
   cd repos/metabob-proto/activities/bootstrap
   jq '.tasks != null' *.json | grep -c true
   # Should return: 9 (or 8 if jiggle has no tasks)
   ```

3. **Verify backend has templates**:
   ```bash
   curl -H "x-api-key: ..." -H "Authorization: Bearer ..." \
     http://localhost:8080/v2/activities/templates | jq '.templates | length'
   # Should return: 13+
   ```

### After Deletion

1. **TypeScript compilation**:
   ```bash
   cd repos/metabob-opencode/packages/opencode
   bun run build
   # Should succeed with no errors
   ```

2. **Test suite** (remaining tests):
   ```bash
   cd repos/metabob-opencode/packages/opencode
   bun test
   # Should pass (excluding deleted bootstrap tests)
   ```

3. **Runtime check**:
   ```bash
   # Start OpenCode, verify template loading works
   # Templates should load from backend via MCP
   ```

---

## Execution Commands

### Step 1: Delete Bootstrap Implementation

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Delete deprecated bootstrap module
rm repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts

# Delete bootstrap tests
rm repos/metabob-opencode/packages/opencode/test/session/bootstrap-templates.test.ts
rm repos/metabob-opencode/packages/opencode/test/session/bootstrap-fallback.test.ts
rm repos/metabob-opencode/packages/opencode/test/session/bootstrap-registration.test.ts
rm repos/metabob-opencode/packages/opencode/test/session/template-loader.test.ts
```

### Step 2: Delete Backup Files

```bash
# Delete migration backups (changes are in git)
rm repos/metabob-proto/activities/bootstrap/*.json.backup
```

### Step 3: Delete Legacy Scripts

```bash
# Delete one-off registration scripts
rm register-hello-world-template.py
rm register-jiggle-activity.py
rm register-jiggle-v2.py
rm check-what-registered.py
rm fix-jiggle-template.py
```

### Step 4: Update template-loader.ts

```bash
# Remove task_steps fallback
cd repos/metabob-opencode/packages/opencode/src/session
# Edit template-loader.ts line 22 manually or use sed
```

### Step 5: Verify Build

```bash
cd repos/metabob-opencode/packages/opencode
bun run build
```

### Step 6: Commit Changes

```bash
git add -A
git commit -m "cleanup: Remove V1 bootstrap templates implementation

- Delete deprecated bootstrap-templates.ts module
- Remove bootstrap template tests (no longer relevant)
- Delete migration backup files (*.json.backup)
- Remove legacy one-off registration scripts
- Update template-loader.ts to remove task_steps fallback
- Templates now loaded exclusively from backend via MCP

All templates migrated to V2 in commit b682c6c
V1 implementation no longer needed"
```

---

## Risk Assessment

### Low Risk ✅

- **Bootstrap module already deprecated**: Marked with @deprecated tag
- **No production imports**: Verified with grep
- **Backend is source of truth**: All templates in backend
- **Git safety**: Can restore deleted files from git history
- **Backups in git**: Original templates in commit history before b682c6c

### Medium Risk ⚠️

- **Test coverage reduced**: Deleting test files means less coverage
  - **Mitigation**: Backend integration tests cover template loading
  - **Mitigation**: E2E activity execution tests verify functionality

### High Risk ❌

- None identified

---

## Rollback Plan

If anything breaks:

```bash
# Restore deleted files from git
git checkout HEAD~1 -- repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts
git checkout HEAD~1 -- repos/metabob-opencode/packages/opencode/test/session/*.test.ts

# Or revert entire commit
git revert HEAD
```

---

## Expected Outcomes

### After Cleanup

✅ **Single source of truth**: Backend is the only template storage  
✅ **No confusion**: V1 implementation removed, can't be accidentally used  
✅ **Cleaner codebase**: ~5 files deleted, ~500 lines removed  
✅ **Simplified loading**: Only MCP path, no local fallback  
✅ **Future-proof**: Forces proper backend integration

### Directory Changes

**Before**:
```
repos/metabob-opencode/packages/opencode/src/session/
├── bootstrap-templates.ts (DEPRECATED)
├── template-loader.ts (has task_steps fallback)
└── ...

repos/metabob-proto/activities/bootstrap/
├── *.json (V2 templates)
└── *.json.backup (9 backup files)

Root:
├── register-hello-world-template.py
├── register-jiggle-activity.py
└── ... (5 legacy scripts)
```

**After**:
```
repos/metabob-opencode/packages/opencode/src/session/
├── template-loader.ts (V2 only, no fallback)
└── ...

repos/metabob-proto/activities/bootstrap/
└── *.json (V2 templates only)

Root:
└── (legacy scripts removed)
```

---

## Timeline

| Step | Duration | Risk |
|------|----------|------|
| Delete bootstrap module | 1 min | Low |
| Delete test files | 1 min | Low |
| Delete backup files | 30 sec | Low |
| Delete legacy scripts | 30 sec | Low |
| Update template-loader | 2 min | Low |
| Build verification | 1 min | Medium |
| Test verification | 3 min | Medium |
| Commit | 1 min | Low |
| **Total** | **~10 min** | **Low** |

---

## Success Criteria

- [ ] bootstrap-templates.ts deleted
- [ ] All bootstrap test files deleted
- [ ] All .json.backup files deleted
- [ ] Legacy registration scripts deleted
- [ ] template-loader.ts updated (no task_steps fallback)
- [ ] TypeScript compilation succeeds
- [ ] Remaining tests pass
- [ ] Template loading from backend works
- [ ] Changes committed to git

---

## Next Actions

1. ✅ **Review this plan** - Verify files to delete
2. ⏸️  **Execute deletions** - Run deletion commands
3. ⏸️  **Update template-loader** - Remove task_steps fallback
4. ⏸️  **Verify build** - Ensure TypeScript compiles
5. ⏸️  **Commit cleanup** - Save changes to git

---

**Status**: 📋 Plan Complete | Ready for Execution  
**Risk Level**: Low  
**Estimated Time**: 10 minutes  
**Dependencies**: None (V2 migration already complete)

