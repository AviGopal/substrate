# Component Annotations: Bootstrap Template Filepath Compliance

**Feature:** bootstrap-template-filepath-compliance  
**Date:** 2026-03-02  
**Status:** Critical filepath issue identified - blocks production deployment

---

## Overview

This document annotates the key components involved in the bootstrap template loading data flow, with special focus on the filepath compliance issue that prevents deployment to production environments.

**Root Cause:** Hardcoded relative path to metabob-proto repository breaks in Docker containers and standalone binary distributions.

---

## Component 1: Entry Point - InstanceBootstrap

**File:** `repos/metabob-opencode/packages/opencode/src/project/bootstrap.ts`  
**Function:** `InstanceBootstrap()`  
**Line:** 15

### Purpose in Flow
Entry point for application initialization that triggers bootstrap template loading as part of the OpenCode instance setup.

### Data Transformation
```
Input:  None (uses Instance.directory from context)
Output: Promise<void> (side effect: initializes templates)
```

### Business Logic
Enforces that bootstrap templates are loaded at application startup before any user sessions can be created. This ensures that critical activity templates (create-activity, debug-activity, etc.) are always available for vessel self-configuration.

### Design Decision
**Why synchronous loading at startup?**
- Bootstrap templates are required dependencies for core functionality
- Loading them lazily would add complexity and error handling to every activity execution
- Fail-fast approach: If templates can't load, the application shouldn't start

**Alternative considered:** Lazy loading templates on first use
- **Rejected because:** Creates race conditions and complicates error handling
- **Trade-off:** Slower startup time, but guaranteed availability

### Constraints
- **Blocking operation:** Application won't start if template loading fails
- **No retry mechanism:** Single failure crashes initialization
- **Environment dependency:** Relies on Instance.directory being set correctly

### Critical Issue
**Line 23:** Calls `TemplateLibrary.initialize()` which triggers the filepath compliance violation downstream. This component has no knowledge that it's initiating a path resolution failure in production environments.

**Impact:** Every application start (CLI, HTTP server, Docker container) hits this code path, making the filepath issue a complete blocker.

---

## Component 2: Template Loading Orchestrator - TemplateLibrary.initialize

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-library.ts`  
**Function:** `TemplateLibrary.initialize()`  
**Line:** 176

### Purpose in Flow
Orchestrates the loading and registration of bootstrap templates by dynamically importing the BootstrapTemplates module and delegating to its registration logic.

### Data Transformation
```
Input:  InitializeOptions? (optional configuration)
Output: Promise<void> (side effect: templates registered to local storage and MCP)
```

### Business Logic
Coordinates the dual-write strategy for template persistence:
1. Local storage (SQLite) - required for offline operation
2. Remote MCP registration - optional for team-wide template sharing

**Critical business rule:** Local storage MUST succeed; MCP registration is best-effort.

### Design Decision
**Why dynamic import of BootstrapTemplates?**
```typescript
// Line 188: Dynamic import
const { BootstrapTemplates } = await import("./bootstrap-templates")
```

**Reason:** Circular dependency avoidance
- TemplateLibrary is imported by many modules
- BootstrapTemplates imports path resolution utilities
- Dynamic import breaks the dependency cycle at runtime

**Alternative considered:** Static import
- **Rejected because:** Creates circular dependency compiler errors
- **Trade-off:** Slightly slower initialization, but cleaner dependency graph

### Constraints
- **Initialization idempotency:** Can be called multiple times (subsequent calls are no-ops)
- **No partial loading:** All bootstrap templates must load or none are registered
- **No progress reporting:** User has no visibility into loading progress

### Critical Issue
**Line 191:** Calls `BootstrapTemplates.registerAll()` which eventually hits the hardcoded filepath. This component is unaware that it's triggering environment-specific behavior.

**Missing abstraction:** No environment detection or configuration layer to handle different deployment scenarios (dev, container, production).

---

## Component 3: Filepath Resolution - BootstrapTemplates.loadAll

**File:** `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`  
**Function:** `loadAll()`  
**Line:** 193

### Purpose in Flow
**CRITICAL COMPONENT - ROOT CAUSE OF FILEPATH COMPLIANCE ISSUE**

Resolves filesystem paths to bootstrap template JSON files and reads them into memory for conversion.

### Data Transformation
```
Input:  None (uses module-level constants BOOTSTRAP_DIR, TEMPLATE_FILES)
Output: Promise<ActivityTemplate.Schema[]> (array of proto JSON objects)
```

### Business Logic
Loads exactly 6 bootstrap templates required for vessel self-configuration:
1. `create-activity-self-contained.json` - Allows creating new activity templates
2. `debug-activity-self-contained.json` - Debugging failed activities
3. `evolve-activity-self-contained.json` - Template evolution and improvement
4. `manage-session-memory.json` - Session context management
5. `trace-data-flow-single-feature.json` - Data flow tracing
6. `trace-enforce-validate-loop.json` - Constraint validation workflows

**Critical constraint:** All 6 templates MUST load successfully or initialization fails completely.

### Design Decision - FILEPATH COMPLIANCE VIOLATION

**Line 17: Hardcoded relative path**
```typescript
const BOOTSTRAP_DIR = "../../../../../metabob-proto/activities/bootstrap"
```

**Why this approach was originally chosen:**
- Simple development setup (monorepo structure)
- No configuration needed (works out-of-the-box in dev)
- Direct access to proto source of truth

**Why it's WRONG for production:**
1. **Assumes monorepo structure:** Standalone binary doesn't have metabob-proto as sibling
2. **No environment detection:** Same path used in dev, container, and production
3. **Breaks in Docker:** `__dirname` in bundled binary doesn't resolve correctly
4. **No fallback:** Single hardcoded path with no alternatives

**Environment-specific failures:**

| Environment | `__dirname` | Resolved Path | Status |
|-------------|-------------|---------------|--------|
| **Development** | `/path/to/metabob-devbob/repos/metabob-opencode/packages/opencode/src/session/` | `/path/to/metabob-devbob/repos/metabob-proto/activities/bootstrap/` | ✅ Works |
| **Docker Container** | Embedded in binary | `<binary-location>/../../../../../metabob-proto/` | ❌ Broken |
| **Standalone Binary** | User installation directory | `<install-dir>/../../../../../metabob-proto/` | ❌ Broken |

### Constraints
- **Filesystem dependency:** Requires proto JSON files to exist at computed path
- **Bun runtime dependency:** Uses `Bun.file()` API (not portable to Node.js)
- **No caching:** Templates re-read from filesystem on every initialization
- **Synchronous path resolution:** `path.join(__dirname, BOOTSTRAP_DIR, filename)` computed at module load time

### Critical Issue - Error Handling

**Line 196-207: All-or-nothing loading**
```typescript
for (const [id, filePath] of Object.entries(TEMPLATE_FILES)) {
  try {
    const file = Bun.file(filePath)
    const json = await file.json()
    templates.push(json)
  } catch (error) {
    log.error("failed to read bootstrap template file", { id, filePath, error })
    throw new Error(
      `Bootstrap template file read failed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
```

**Problems:**
1. No file existence check before reading
2. First missing file crashes entire initialization
3. No partial loading capability
4. Generic error doesn't distinguish file-not-found vs JSON-parse-error

### Recommended Fix

**Short-term (deployment workaround):**
```typescript
const BOOTSTRAP_DIR = 
  process.env.BOOTSTRAP_TEMPLATES_DIR ?? 
  (process.env.CONTAINER_ENV === "true" 
    ? "/metabob-proto/activities/bootstrap"
    : "../../../../../metabob-proto/activities/bootstrap")
```

**Long-term (eliminate dependency):**
Embed template JSON files directly in the binary at build time using Bun's asset bundling:
```typescript
// At build time, inline JSON files
import createActivity from "./templates/create-activity-self-contained.json"
import debugActivity from "./templates/debug-activity-self-contained.json"
// ... etc

const TEMPLATES = {
  "create-activity": createActivity,
  "debug-activity-self-contained": debugActivity,
  // ... etc
}

async function loadAll(): Promise<any[]> {
  // No filesystem access needed - templates are embedded
  return Object.values(TEMPLATES)
}
```

**Benefits:**
- ✅ Works in all environments (no filesystem dependency)
- ✅ Faster loading (no I/O)
- ✅ Simpler deployment (single binary)
- ✅ No path resolution complexity

---

## Component 4: Schema Transformation - convertProtoToSchema

**File:** `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`  
**Function:** `convertProtoToSchema()`  
**Line:** 47

### Purpose in Flow
Bridges the protocol buffer schema (metabob-proto) with the TypeScript schema (OpenCode), converting field names, enum values, and generating version metadata.

### Data Transformation
```
Input:  Proto JSON (snake_case fields, enum values, minimal metadata)
Output: ActivityTemplate.Schema (camelCase fields, string literals, full metadata)
```

### Business Logic
Enforces the OpenCode schema contract while maintaining compatibility with metabob-proto source files:

**Field Mappings:**
- `activity_id` or `id` → `id` (with fallback handling)
- `category` (enum 0-4) → category (string: "feature", "bugfix", etc.)
- `task_id` → `id`
- `max_tokens` → `maxTokens`
- `compression_strategy` → `compressionStrategy`

**Generated Metadata:**
- `version`: Generated via `generateVersion()` using task content hash
- `genealogy`: Generated via `createGenealogy()` with evolution tracking
- `createdAt`/`updatedAt`: Timestamps
- `executions`/`successRate`: Initialized to 0 for bootstrap templates

**Default Values:**
- `status`: "stable" (bootstrap templates are production-ready)
- `retry.maxAttempts`: 3
- `retry.strategy`: "simple"
- `integration.requiresCleanGit`: true

### Design Decision

**Why generate version/genealogy at load time instead of storing in proto?**

**Reason:** Proto files are source of truth for CONTENT, not METADATA
- Version depends on content hash (derived property)
- Genealogy tracks evolution history (runtime property)
- Proto files remain simple and focused on task definitions
- Metadata generation ensures consistency across all templates

**Alternative considered:** Store version in proto files
- **Rejected because:** Requires manual version updates on every proto change
- **Trade-off:** More complex loading logic, but proto files stay clean

**Why use fallback fields (e.g., `subagent || agent`)?**

**Reason:** Proto schema evolution and backward compatibility
- Early proto files used `agent` field
- Later versions standardized on `subagent`
- Fallback ensures old proto files still load

### Constraints
- **No validation:** Assumes proto JSON is well-formed (fails on missing required fields)
- **Enum mapping hardcoded:** Proto category values 0-4 must match exactly
- **No version checking:** Breaking proto schema changes cause silent failures
- **Pure function:** No side effects, but assumes proto structure

### Critical Issue - Missing Input Validation

**Line 48-54: Enum mapping without validation**
```typescript
const categoryMap: Record<number, ActivityTemplate.Schema["category"]> = {
  0: "feature",
  1: "bugfix",
  2: "refactor",
  3: "tool",
  4: "infrastructure",
}

const category = categoryMap[protoJson.category] || "feature"
```

**Problem:** Invalid category values silently default to "feature"
- Proto file with `category: 99` will load as "feature" without warning
- No error thrown, no validation log

**Recommended fix:**
```typescript
const category = categoryMap[protoJson.category]
if (!category) {
  throw new Error(
    `Invalid proto category: ${protoJson.category}. Expected 0-4.`
  )
}
```

---

## Component 5: Storage Boundary - ActivityTemplate.save

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`  
**Function:** `save()`  
**Line:** 690

### Purpose in Flow
Persists templates to local SQLite storage, ensuring they're available offline and across sessions.

### Data Transformation
```
Input:  ActivityTemplate.Schema (TypeScript object)
Output: void (side effect: JSON file written to ~/.local/share/opencode/storage/)
```

### Business Logic
Enforces local-first data persistence strategy:
1. Mutate `updatedAt` timestamp to track last modification
2. Write to local storage (SQLite via Storage abstraction)
3. Trigger auto-registration with MCP (best-effort)

**Storage location by platform:**
- Linux: `~/.local/share/opencode/storage/activity-template/{id}.json`
- macOS: `~/Library/Application Support/opencode/storage/activity-template/{id}.json`
- Windows: `%LOCALAPPDATA%\opencode\storage\activity-template\{id}.json`

### Design Decision

**Why mutate input parameter?**
```typescript
template.updatedAt = Date.now()  // ← Mutates input
await Storage.write(["activity-template", template.id], template)
```

**Reason:** Avoid copying large template objects
- Templates can be 10KB+ (with genealogy, metrics, tasks)
- Copying would double memory usage for large template batches
- Caller doesn't need original timestamp after save

**HOWEVER:** This violates function purity and principle of least surprise
- Callers don't expect their objects to be mutated
- Can cause bugs if caller reuses template object
- Not thread-safe for concurrent saves

**Alternative considered:** Create immutable copy
```typescript
const templateToSave = { ...template, updatedAt: Date.now() }
```
- **Trade-off:** Better safety, slightly higher memory usage
- **Recommended:** Switch to immutable approach for safety

**Why local storage FIRST, then MCP?**

**Reason:** Local-first architecture ensures offline capability
1. Local save is synchronous and reliable
2. MCP registration is asynchronous and may fail (network, backend down)
3. Local templates always available even if MCP is unreachable

**Critical constraint:** Local save MUST succeed or entire operation fails

### Constraints
- **File locking:** Storage.write() uses locks to prevent concurrent writes
- **JSON serialization:** Templates stored as pretty-printed JSON (human-readable)
- **No transaction:** Save and MCP registration are separate operations (can leave inconsistent state)
- **No rollback:** If MCP fails after local save, local copy remains

### Critical Issue - Unsafe Mutation

**Line 691: Input parameter mutated**
```typescript
template.updatedAt = Date.now()
```

**Problem:** Violates function purity
- Caller doesn't expect mutation
- Can cause race conditions if template object reused
- Difficult to debug when unexpected timestamp appears

**Impact:** MEDIUM - Technical debt, not a blocker

**Recommended fix:**
```typescript
const templateToSave = {
  ...template,
  updatedAt: Date.now(),
}
await Storage.write(["activity-template", templateToSave.id], templateToSave)
```

---

## Component 6: Service Boundary - TemplateServiceClient.registerTemplate

**File:** `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts`  
**Function:** `registerTemplate()`  
**Line:** 293

### Purpose in Flow
Registers templates with Metabob MCP backend for team-wide sharing and synchronization. This is the exit point for remote persistence.

### Data Transformation
```
Input:  RegisterTemplateOptions { template: ActivityTemplate.Schema, overwrite?: boolean }
Output: RegisterTemplateResult { success: boolean, templateId?: string, error?: string }
```

### Business Logic
Implements graceful degradation strategy for remote registration:
1. Check MCP connection status (cached for 1 minute)
2. If MCP unavailable, return failure (don't crash)
3. If MCP available, send template via MetabobCLI.registerActivityTemplate()
4. Return success/failure result (never throw)

**Business rule:** Remote registration is OPTIONAL
- Local storage is source of truth
- MCP enhances team collaboration but isn't required
- Failures are logged but don't block initialization

### Design Decision

**Why cache connection status for 1 minute?**

**Reason:** Reduce network overhead during bootstrap
- Bootstrap loads 6 templates sequentially
- Without caching: 6+ connection checks = 6+ network round-trips
- With caching: 1 connection check amortized across all templates

**Trade-off:** Cached status may be stale (MCP goes down mid-bootstrap)
- **Acceptable because:** Registration failures are graceful
- **Benefit:** 6x fewer network calls during initialization

**Why non-blocking error handling?**

**Reason:** Local-first architecture requires MCP to be optional
```typescript
if (!status.connected) {
  log.warn("metabob not available for registerTemplate", { templateId })
  return { success: false, error: "Metabob TemplateService not available" }
}
```

**Critical:** Never throws, always returns result object
- Allows bootstrap to continue with local-only templates
- User gets warning but application doesn't crash
- Degraded mode (local-only) is acceptable

### Constraints
- **Network dependency:** Requires MCP server to be accessible
- **No retry logic:** Single registration attempt (TODO: add exponential backoff)
- **No batching:** Each template registered individually (could optimize)
- **Connection timeout:** No timeout on MCP calls (can hang indefinitely)

### Critical Issue - Missing Timeout

**Line 306: No timeout on MCP call**
```typescript
const success = await MetabobCLI.registerActivityTemplate(options.template)
```

**Problem:** Slow/hanging MCP server can block initialization indefinitely
- No timeout specified
- User has no feedback during long waits
- Container health checks may fail

**Impact:** MEDIUM - Degraded user experience during MCP outages

**Recommended fix:**
```typescript
const timeoutMs = 5000  // 5 second timeout
const success = await Promise.race([
  MetabobCLI.registerActivityTemplate(options.template),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error("MCP registration timeout")), timeoutMs)
  ),
]).catch((error) => {
  log.warn("MCP registration timed out", { templateId, timeoutMs })
  return false
})
```

---

## Summary of Annotated Components

### Components Documented: 6

1. **InstanceBootstrap** (Entry Point)
   - Triggers template loading at application startup
   - No knowledge of downstream filepath issue

2. **TemplateLibrary.initialize** (Orchestrator)
   - Coordinates dual-write to local storage and MCP
   - Uses dynamic import to avoid circular dependencies

3. **BootstrapTemplates.loadAll** (Filepath Resolution) 🔴 CRITICAL
   - **ROOT CAUSE of filepath compliance issue**
   - Hardcoded relative path breaks in production/container
   - No environment detection or fallback

4. **convertProtoToSchema** (Schema Transformation)
   - Bridges metabob-proto and OpenCode schemas
   - Generates version/genealogy metadata
   - Missing input validation (enum values, required fields)

5. **ActivityTemplate.save** (Storage Boundary)
   - Persists to local SQLite storage
   - Unsafe input mutation (violates function purity)
   - No rollback on MCP failure

6. **TemplateServiceClient.registerTemplate** (Service Boundary)
   - Registers with MCP backend (optional)
   - Graceful degradation on failure
   - Missing timeout (can hang indefinitely)

---

## Critical Findings

### Blocking Issues (Must Fix for Production)

1. **Filepath Compliance Violation** (Component 3: BootstrapTemplates.loadAll)
   - **Location:** `bootstrap-templates.ts:17`
   - **Issue:** Hardcoded relative path `../../../../../metabob-proto/activities/bootstrap`
   - **Impact:** Complete failure in Docker containers and standalone binaries
   - **Fix:** Add environment variable support or embed templates in binary

2. **Missing File Validation** (Component 3: BootstrapTemplates.loadAll)
   - **Location:** `bootstrap-templates.ts:196-207`
   - **Issue:** No file existence check, throws on first missing file
   - **Impact:** Single corrupted/missing file crashes entire initialization
   - **Fix:** Proactive validation and partial loading capability

### Technical Debt (Should Fix)

3. **No Proto Schema Validation** (Component 4: convertProtoToSchema)
   - **Location:** `bootstrap-templates.ts:47-188`
   - **Issue:** Invalid proto JSON silently defaults to fallback values
   - **Impact:** Corrupted templates may load with incorrect data

4. **Unsafe Input Mutation** (Component 5: ActivityTemplate.save)
   - **Location:** `activity-template.ts:690-691`
   - **Issue:** Mutates input parameter `template.updatedAt`
   - **Impact:** Violates function purity, potential race conditions

5. **Missing MCP Timeout** (Component 6: TemplateServiceClient.registerTemplate)
   - **Location:** `template-service-client.ts:306`
   - **Issue:** No timeout on MCP registration calls
   - **Impact:** Can hang indefinitely if MCP server is slow

---

## Data Flow Summary

```
User Command/HTTP Request
  ↓
[1] InstanceBootstrap (Entry Point)
  ↓
[2] TemplateLibrary.initialize (Orchestrator)
  ↓
[3] BootstrapTemplates.loadAll (Filepath Resolution) 🔴 CRITICAL ISSUE
  ↓
[4] convertProtoToSchema (Schema Transformation)
  ↓
[5] ActivityTemplate.save (Storage Boundary)
  ↓
[6] TemplateServiceClient.registerTemplate (Service Boundary)
  ↓
Templates Available for Use
```

---

## Next Steps

### Immediate (Fix Blocking Issues)

1. **Add environment variable support** to `bootstrap-templates.ts:17`
   ```typescript
   const BOOTSTRAP_DIR = 
     process.env.BOOTSTRAP_TEMPLATES_DIR ?? 
     (process.env.CONTAINER_ENV === "true" 
       ? "/metabob-proto/activities/bootstrap"
       : "../../../../../metabob-proto/activities/bootstrap")
   ```

2. **Add file validation** to `bootstrap-templates.ts:196-207`
   - Proactive existence checks
   - Partial loading with warnings
   - Better error messages

### Short-term (Reduce Technical Debt)

3. **Add proto schema validation** with Zod
4. **Fix input mutation** in ActivityTemplate.save
5. **Add MCP timeout** in TemplateServiceClient

### Long-term (Architectural Improvement)

6. **Embed templates in binary** at build time (eliminates filepath dependency entirely)
7. **Add retry logic** to MCP registration
8. **Implement template reconciliation** for inconsistent local/remote state

---

## Documentation Metadata

- **Created:** 2026-03-02
- **Feature:** bootstrap-template-filepath-compliance
- **Critical Issue:** Hardcoded filepath breaks production deployment
- **Priority:** P0 (blocks release)
- **Estimated Fix Time:** 2-4 hours for environment variable support, 1-2 days for embedded templates
