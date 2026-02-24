# Bootstrap Loader Fix Complete

**Date**: 2026-02-20  
**Issue**: loadAll() error when running bun run dev  
**Status**: ✅ **FIXED**

---

## Problem

After renaming `create-activity-self-contained` → `create-activity`, the bootstrap template loader in metabob-opencode was still looking for the old filename.

**Error Location**:
```
repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts
```

**File Not Found**:
```
create-activity-self-contained.json (deleted)
```

**New File**:
```
create-activity.json (not in loader)
```

---

## The Fix

Updated `bootstrap-templates.ts`:

**BEFORE**:
```typescript
const TEMPLATE_FILES = {
  "create-activity-self-contained": path.join(__dirname, BOOTSTRAP_DIR, "create-activity-self-contained.json"),
  // ...
}

export const TEMPLATE_IDS = [
  "create-activity-self-contained",
  // ...
] as const
```

**AFTER**:
```typescript
const TEMPLATE_FILES = {
  "create-activity": path.join(__dirname, BOOTSTRAP_DIR, "create-activity.json"),
  // ...
}

export const TEMPLATE_IDS = [
  "create-activity",
  // ...
] as const
```

---

## Commits

**metabob-opencode**:
- `ab83072f`: Fix bootstrap template loader for renamed template

**metabob-devbob**:
- `633219c`: Update metabob-opencode submodule pointer

---

## Impact

✅ `bun run dev` now starts without loadAll() errors  
✅ Bootstrap templates load correctly  
✅ create-activity template accessible  

---

## Related Changes

This completes the create-activity rename:
1. ✅ Renamed in metabob-proto
2. ✅ Updated cache
3. ✅ Seeded to SurrealDB
4. ✅ Updated bootstrap loader (this fix)

All references now use `create-activity` consistently.

