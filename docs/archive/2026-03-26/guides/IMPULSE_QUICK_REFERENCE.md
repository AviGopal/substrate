# Impulse System Quick Reference

**TL;DR**: Impulse system is 70% implemented. Core works, integration unclear.

---

## One-Minute Summary

**What it is**: Lazy-loaded, budget-aware context management for AI agents

**What exists**:
- ✅ Core implementation (resolver, cache, formatter)
- ✅ SurrealDB schema (2 tables, 4+8 records)
- ✅ Unit tests (22 passing tests)

**What's unclear**:
- ❓ Session Memory Agent automation
- ❓ Backend API endpoints
- ❓ Real production usage

**How to test**: `./test-impulse-system.sh` (7/7 checks pass ✅)

---

## Quick Test Commands

```bash
# Test entire impulse system
./test-impulse-system.sh

# Query impulse data
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob --database devbob \
  --username root --password root <<< \
  "SELECT * FROM impulse_registry LIMIT 5;"

# Run unit tests
cd repos/metabob-opencode/packages/opencode
bun test impulse-cache.test.ts
bun test impulse-system-validation.test.ts

# Access Web UI
open http://localhost:8001
# Credentials: metabob / devbob / root / root
```

---

## Data Flow (Confirmed vs. Unconfirmed)

```
User Request
  ↓
❓ Session Memory Agent (analyzes intent)
  ↓
❓ Creates Impulses (automatic)
  ↓
✅ Impulse Resolver (resolves pointers → content)
  ↓
✅ Impulse Formatter (creates markdown context)
  ↓
✅ Injected into LLM prompt
  ↓
✅ Activity executes
  ↓
✅ Results written to SurrealDB (confirmed: 4+8 records)
  ↓
❓ Success rates updated
  ↓
❓ Learning loop uses patterns
```

**Legend**: ✅ Confirmed working | ❓ Unclear/untested

---

## Impulse Types (All Supported)

| Type | Purpose | Example |
|------|---------|---------|
| `memo` | Inline text | Error messages, notes |
| `file` | Source code | `{path, offset, limit}` |
| `component` | Function/class | `{file, component_name}` |
| `commit` | Git diff | `{hash}` |
| `metabobIssue` | Code quality | `{issueId}` |
| `metabobAnnotation` | Design decisions | `{file, component}` |
| `activityOutput` | Activity result | `{activityId, taskId}` |
| `bashOutput` | Command output | `{command}` |
| `templateDefinition` | Activity template | `{definition}` |
| `activityRecommendation` | Suggestions | `{context, limit}` |
| `remoteSession` | Remote context | `{sessionId}` |
| `custom` | Extensible | `{resolver, data}` |

---

## Database Schema (SurrealDB)

### impulse_registry (Central Metadata)

```
impulse_id: string            # Unique ID
impulse_type: string          # One of 12 types above
pointer: object               # Type-specific data
budget: int                   # Token allocation
actual_tokens: int?           # Actual usage
usage_count: int              # Times used
success_rate: float           # Computed metric
created_by: string            # Agent ID
created_for: string           # Purpose/intent
session_id: string?           # Session scope
status: string                # active/archived
```

### impulse_usage (Junction Table)

```
execution_id: string          # Activity ID
step_id: string               # Step ID
impulse_id: string            # Which impulse
usage_type: string            # loaded/created/referenced
step_succeeded: bool          # Success correlation
tokens_used: int?             # Actual consumption
```

---

## Current Test Results

```
Docker Environment:         ✅ All services healthy
SurrealDB:                  ✅ Connected (localhost:8000)
Impulse Tables:             ✅ Created (2 tables)
Test Data:                  ✅ Present (4+8 records)
Unit Tests:                 ✅ 22 passing
Resolver Implementation:    ✅ 12+ types supported
Sample Data Queryable:      ✅ Working

End-to-End Flow:            ❓ Not tested
Session Memory Agent:       ❓ Not confirmed
Backend API:                ❓ Endpoints unclear
Production Usage:           ❓ Unknown
```

---

## Key Files

**Core Implementation**:
- `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts` (24KB)
- `repos/metabob-opencode/packages/opencode/src/session/impulse-cache.ts` (8KB)
- `repos/metabob-opencode/packages/opencode/src/session/impulse-formatter.ts` (5KB)
- `repos/metabob-opencode/packages/opencode/src/session/impulse-serializer.ts` (7KB)

**Database**:
- `sql/migrations/005-impulse-tables.surql` (schema definition)

**Tests**:
- `repos/metabob-opencode/packages/opencode/src/session/__tests__/impulse-cache.test.ts`
- `repos/metabob-opencode/packages/opencode/test/integration/impulse-system-validation.test.ts`

**Documentation**:
- `CONTEXT_ARCHITECTURE_COMPREHENSIVE_GUIDE.md` (detailed architecture)
- `ARCHITECTURE_QUICK_REFERENCE.md` (overview)
- `IMPULSE_SYSTEM_REALITY_CHECK.md` (this investigation)

---

## Next Investigation Steps

1. **Find Session Memory Agent**:
   ```bash
   find repos/metabob-opencode -name "*memory-agent*"
   grep -r "SessionMemoryAgent" repos/metabob-opencode/src/
   ```

2. **Trace Backend Integration**:
   ```bash
   grep -r "impulse_registry" repos/metabob-rpc-api/
   grep -r "/impulse" repos/metabob-rpc-api/ --include="*.py"
   ```

3. **Manual CLI Test**:
   ```bash
   cd repos/metabob-opencode/packages/opencode
   bun run dev
   # Run activity, observe logs for "impulse"
   ```

4. **Check Production Config**:
   ```bash
   cat repos/metabob-opencode/opencode.json | jq .sessionMemory
   ```

---

## Questions for Team

1. Is Session Memory Agent enabled in production?
2. How does metabob-cli write impulse data to DB?
3. Is the learning loop actively used?
4. What's the implementation priority?

---

## For More Details

- **Comprehensive Analysis**: `IMPULSE_SYSTEM_REALITY_CHECK.md` (479 lines)
- **Test Script**: `./test-impulse-system.sh` (automated validation)
- **Architecture Docs**: `CONTEXT_ARCHITECTURE_COMPREHENSIVE_GUIDE.md`
- **SurrealDB Web UI**: http://localhost:8001

---

**Last Updated**: 2026-02-19  
**Status**: 70% implemented, core working, integration unclear
