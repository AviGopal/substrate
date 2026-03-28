# Template Storage Architecture - Backend-Only Model
## Trace Analysis

**STATUS: ✅ SPECIFICATION ALREADY IMPLEMENTED**

This specification enforces that templates are stored ONLY in the backend (metabob-proto/rpc-api), 
with metabob-opencode acting as a cache-only client that retrieves templates via MCP.

---

## Architecture Overview

### Current Architecture (3-Layer)

1. **metabob-opencode (Client Layer)**
   - `TemplateRepository` - Unified interface for template operations
   - `TemplateLoader` - Load order: Cache → Metabob → Embedded Bootstrap
   - `TemplateCache` - In-memory cache (no persistence)
   - `ActivityTemplate` - DEPRECATED local storage (blocked)
   - `BootstrapTemplates` - Embedded templates bundled in binary

   **Storage:**
   - ❌ REMOVED: Local storage writes (`Storage.write` blocked)
   - ✅ CACHE: In-memory `TemplateCache` only
   - ✅ EMBEDDED: Bootstrap templates in binary (cold-start fallback)

2. **metabob-cli (MCP Bridge)**
   - `metabob_search_activities` - List templates from backend
   - `metabob_register_activity_template` - Register with backend
   - `activity_template_tools.py` - MCP tool implementations

3. **metabob-rpc-api (Backend Layer)**
   - `template_data.py` - Primary storage in SurrealDB
   - `template_metrics.py` - Metrics and Thompson sampling
   - `/v2/activities/templates` - REST API endpoints

---

## Data Flow Diagrams

### Template Registration Flow
```
opencode (client)
  → TemplateRepository.save()
  → TemplateLoader.save() [rejects backend='local']
  → metabob.registerActivityTemplate()
  → MCP tool call
  → metabob-cli (MCP server)
  → Backend API POST /v2/activities/templates
  → SurrealDB (primary storage)
```

### Template Retrieval Flow
```
opencode (client)
  → TemplateRepository.get()
  → TemplateLoader.load()
  → TemplateCache.get() [MISS]
  → MCP tool call
  → metabob-cli (MCP server)
  → Backend API GET /v2/activities/templates/{id}
  → SurrealDB read
  → TemplateCache.put() [populate]
  → Return to client
```

### Cold Start Flow (Backend Unavailable)
```
opencode (client)
  → TemplateLoader.load()
  → TemplateCache.get() [MISS]
  → MCP tool call [UNAVAILABLE]
  → BootstrapTemplates.loadAll() [embedded in binary]
  → TemplateCache.put() [populate]
  → Return to client
```

---

## Component Analysis (All COMPLIANT)

### 1. ActivityTemplate (activity-template.ts:696-749)
- **save()** - Removed `Storage.write()`, logs deprecation warning
- **load()** - Only reads embedded bootstrap templates
- **list()** - Returns only embedded bootstrap templates
- **Gap:** NONE

### 2. TemplateLoader (template-loader.ts)
- **save() (298-333)** - Rejects `backend='local'`, only saves to metabob MCP
- **load() (77-146)** - Cache → Metabob → Embedded bootstrap
- **list() (160-236)** - Metabob → Embedded bootstrap fallback
- **Gap:** NONE

### 3. TemplateRepository (activity-template-repository.ts:162-183)
- **save()** - Rejects `backend='local'`, enforces `backend='metabob'`
- **Gap:** NONE

### 4. BootstrapTemplates (bootstrap-templates.ts:324-391)
- **registerAll()** - REMOVED local save, only registers with MCP
- **EMBEDDED_TEMPLATES** - Templates imported at build time
- **Gap:** NONE

### 5. Metabob Integration (metabob.ts:797-850)
- **registerActivityTemplate()** - No file writes, calls MCP only
- **Gap:** NONE

---

## Architectural Constraints (All Enforced ✅)

### 1. No Local Template Storage ✅
**Implementation:**
- `ActivityTemplate.save()` removed `Storage.write()` (line 698)
- `TemplateLoader.save()` rejects `backend='local'` (line 307-312)
- `TemplateRepository.save()` rejects `backend='local'` (line 167-172)

**Validation:**
- Filesystem: No `~/.local/share/opencode/storage/activity-template`
- Filesystem: No `.metabob/activities`
- Code: No `Storage.write()` in template code

### 2. Backend is Single Source of Truth ✅
**Implementation:**
- All template operations go through MCP to backend
- Backend stores templates in SurrealDB (`template_data.py`)

### 3. Embedded Bootstrap for Cold-Start ✅
**Implementation:**
- Bootstrap templates bundled at build time (`bootstrap-templates.ts:7-15`)
- Fallback when backend unavailable
- Core templates: `create-activity`, `debug-activity`, `evolve-activity`, `manage-session-memory`

### 4. Client-Side Cache Only ✅
**Implementation:**
- `TemplateCache` in-memory only (no persistence)
- Cache populated on backend fetch
- Cache invalidated on updates

### 5. MCP-Based Retrieval ✅
**Implementation:**
- `TemplateLoader` → `TemplateServiceClient` → MCP
- `metabob-cli` bridges MCP to backend API
- Backend serves from SurrealDB

---

## Gaps Analysis

### Implementation Gaps: NONE ✅
**All specification requirements are implemented and enforced in code.**

### Documentation Gaps
1. **Client Setup Guide** (Priority: MEDIUM)
   - Current: Scattered across multiple files
   - Needed: Single doc explaining: fork opencode + install cli + configure backend URL

2. **Bootstrap Template Management** (Priority: LOW)
   - Current: Not documented how to add new bootstrap templates
   - Needed: Guide for when/how to add templates to `EMBEDDED_TEMPLATES`

### Testing Gaps
1. **Backend Unavailability** (Priority: MEDIUM)
   - Current: Tests may not cover all backend-down scenarios
   - Needed: Test suite for cold-start with only embedded templates

---

## Validation Checklist

### Code Analysis (All Passing ✅)
- [x] `ActivityTemplate.save()` - No `Storage.write()`
- [x] `ActivityTemplate.load()` - Only embedded bootstrap
- [x] `TemplateLoader.save()` - Rejects `backend='local'`
- [x] `TemplateRepository.save()` - Rejects `backend='local'`
- [x] `BootstrapTemplates.registerAll()` - No local save
- [x] `metabob.registerActivityTemplate()` - No file writes

### Filesystem Validation (To be verified)
- [ ] `~/.local/share/opencode/storage/activity-template` does NOT exist
- [ ] `.metabob/activities` does NOT exist

### Runtime Validation (To be verified)
- [ ] Template registration writes to SurrealDB only
- [ ] Template retrieval works with MCP backend
- [ ] Cold-start works with embedded bootstrap only
- [ ] No templates persist to local filesystem after restart

---

## File References

**metabob-opencode:**
- `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
- `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
- `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**metabob-cli:**
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**metabob-rpc-api:**
- `repos/metabob-rpc-api/server/db/operations/template_data.py`
- `repos/metabob-rpc-api/server/db/operations/template_metrics.py`

**Validation:**
- `tests/validation-harnesses/template-storage-architecture-migration-harness.ts`

---

## Next Steps for Downstream Tasks

### Validation Task
Run `template-storage-architecture-migration-harness.ts` to verify:
1. No local template directories exist
2. No `Storage.write()` calls in template code
3. All template operations go through MCP

### Enforcement Task
**No enforcement needed** - specification already implemented.

### Documentation Task
1. Create client setup guide
2. Document bootstrap template management
3. Add architecture diagrams to docs

---

**Trace Complete** - Ready for validation and documentation tasks.
