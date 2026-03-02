# Component Annotation Summary
## Feature: bootstrap-template-filepath-compliance

**Date:** 2026-03-02  
**Status:** 🔴 CRITICAL - Blocks production deployment  
**Root Cause:** Hardcoded development-only filepath

---

## Annotated Components: 6

### 1. **InstanceBootstrap** (Entry Point)
**File:** `repos/metabob-opencode/packages/opencode/src/project/bootstrap.ts:15`

**Role:** Application initialization entry point  
**Annotation:** Triggers template loading at startup; enforces fail-fast strategy (app won't start if templates fail to load). No knowledge of downstream filepath issues.

---

### 2. **TemplateLibrary.initialize** (Orchestrator)
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-library.ts:176`

**Role:** Template loading coordinator  
**Annotation:** Orchestrates dual-write strategy (local SQLite + optional MCP). Uses dynamic import to avoid circular dependencies. Delegates filepath resolution to BootstrapTemplates module.

---

### 3. **BootstrapTemplates.loadAll** 🔴 CRITICAL ISSUE
**File:** `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts:193`

**Role:** Filesystem path resolution and template loading  
**Annotation:** **ROOT CAUSE of filepath compliance violation**

**Critical Code (Line 17):**
```typescript
const BOOTSTRAP_DIR = "../../../../../metabob-proto/activities/bootstrap"
```

**Issue:** Hardcoded relative path assumes monorepo structure
- ✅ Works in development (metabob-proto is sibling directory)
- ❌ Breaks in Docker containers (path doesn't resolve)
- ❌ Breaks in standalone binaries (metabob-proto not distributed)

**Why this design:** Simple development setup, no configuration needed  
**Why it's wrong:** No environment detection, no fallback, single point of failure

**Impact:** Complete initialization failure in production environments

---

### 4. **convertProtoToSchema** (Schema Transformation)
**File:** `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts:47`

**Role:** Proto JSON → OpenCode schema conversion  
**Annotation:** Bridges metabob-proto (snake_case, enums) with OpenCode (camelCase, string literals). Generates version/genealogy metadata at load time.

**Design decision:** Generate metadata from content instead of storing in proto files  
**Why:** Proto files remain simple; version derived from content hash ensures consistency

**Issue:** No input validation - invalid proto JSON silently defaults to fallback values

---

### 5. **ActivityTemplate.save** (Storage Boundary)
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts:690`

**Role:** Local storage persistence  
**Annotation:** Implements local-first persistence strategy. Writes to SQLite, then triggers optional MCP auto-registration.

**Design decision:** Local save MUST succeed; MCP registration is best-effort  
**Why:** Ensures offline capability; degraded mode acceptable

**Issue:** Mutates input parameter (`template.updatedAt = Date.now()`) - violates function purity

---

### 6. **TemplateServiceClient.registerTemplate** (Service Boundary)
**File:** `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:293`

**Role:** Remote MCP registration  
**Annotation:** Registers templates with Metabob backend for team sharing. Implements graceful degradation - never throws, always returns result.

**Design decision:** Cache connection status for 1 minute  
**Why:** Reduces network overhead (6 templates = 6 connection checks without cache)

**Issue:** No timeout on MCP calls - can hang indefinitely if server is slow

---

## Critical Findings

### Blocking Issues (P0 - Must Fix)

| Issue | Component | Line | Impact |
|-------|-----------|------|--------|
| **Hardcoded filepath** | BootstrapTemplates.loadAll | 17 | Complete failure in production/container |
| **No file validation** | BootstrapTemplates.loadAll | 196-207 | Single missing file crashes initialization |

### Technical Debt (Should Fix)

| Issue | Component | Line | Impact |
|-------|-----------|------|--------|
| No proto validation | convertProtoToSchema | 47 | Silent data corruption |
| Unsafe mutation | ActivityTemplate.save | 690 | Function impurity, race conditions |
| Missing timeout | registerTemplate | 306 | Can hang during MCP outages |

---

## Data Flow Path

```
[1] InstanceBootstrap (bootstrap.ts:15)
      ↓ Triggers initialization
[2] TemplateLibrary.initialize (template-library.ts:176)
      ↓ Orchestrates loading
[3] BootstrapTemplates.loadAll (bootstrap-templates.ts:193) 🔴 FILEPATH ISSUE
      ↓ Resolves paths, reads files
[4] convertProtoToSchema (bootstrap-templates.ts:47)
      ↓ Converts proto → schema
[5] ActivityTemplate.save (activity-template.ts:690)
      ↓ Persists to local storage
[6] TemplateServiceClient.registerTemplate (template-service-client.ts:293)
      ↓ Registers with MCP (optional)
    Templates available for use
```

---

## Fix Recommendations

### Immediate (Production Blocker)

**Component 3: BootstrapTemplates.loadAll**

**Option A: Environment variable (2-4 hours)**
```typescript
const BOOTSTRAP_DIR = 
  process.env.BOOTSTRAP_TEMPLATES_DIR ?? 
  (process.env.CONTAINER_ENV === "true" 
    ? "/metabob-proto/activities/bootstrap"
    : "../../../../../metabob-proto/activities/bootstrap")
```

**Pros:** Quick fix, maintains filesystem approach  
**Cons:** Still requires proto files to be deployed

**Option B: Embed templates (1-2 days, RECOMMENDED)**
```typescript
import createActivity from "./templates/create-activity-self-contained.json"
import debugActivity from "./templates/debug-activity-self-contained.json"
// ... etc

const TEMPLATES = {
  "create-activity": createActivity,
  "debug-activity": debugActivity,
}

async function loadAll(): Promise<any[]> {
  return Object.values(TEMPLATES)  // No filesystem access
}
```

**Pros:** Eliminates filepath dependency, faster loading, simpler deployment  
**Cons:** Templates baked into binary (requires rebuild to update)

### Short-term (Technical Debt)

1. **Add file validation** (Component 3)
   - Proactive existence checks
   - Partial loading capability
   - Better error messages

2. **Fix input mutation** (Component 5)
   - Create immutable copy before mutation
   - Safer for concurrent access

3. **Add MCP timeout** (Component 6)
   - 5-second timeout on registration calls
   - Better user feedback during outages

---

## Deployment Workarounds (Current)

**Docker:** Templates copied to `/metabob-proto/` in Dockerfile (line 96-98)
```dockerfile
RUN mkdir -p /metabob-proto/activities/bootstrap
COPY repos/metabob-proto/activities/bootstrap /metabob-proto/activities/bootstrap
```

**Problem:** Workaround doesn't help standalone binaries or non-Docker deployments

---

## Next Steps

1. ✅ **Component analysis complete** - 6 critical components annotated
2. ⏭️ **Implement Option B** (embed templates) - eliminates filepath issue permanently
3. ⏭️ **Add validation** - prevent silent failures from corrupted proto files
4. ⏭️ **Add timeouts** - improve resilience during MCP outages

---

**Full details:** See `COMPONENT_ANNOTATIONS_bootstrap-template-filepath-compliance.md`
