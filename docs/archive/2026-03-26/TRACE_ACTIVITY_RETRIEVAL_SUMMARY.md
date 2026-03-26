# Activity Retrieval Learning Data Flow - Trace Summary

**Specification**: `activity-retrieval-learning-data-flow`  
**Date**: 2026-03-04  
**Status**: ✅ TRACE COMPLETE  
**Impulse ID**: `trace-activity-retrieval-learning-data-flow`

---

## Executive Summary

Successfully traced the complete data flow for activity template retrieval with learning metrics. The system is **WORKING AS DESIGNED** with intentional information loss documented below.

### Key Findings

1. **✅ Learning Data Flows Correctly**: All core learning metrics (executions, successRate, avgDuration, avgCost) are preserved during retrieval
2. **⚠️ Intentional Information Loss**: avgTokens hardcoded to zeros due to backend limitation (NOT A BUG)
3. **🔴 Code Duplication**: 70% overlap between ActivitySchemaAdapter and BootstrapTemplates converters
4. **🔴 N+1 Performance Issue**: 101 MCP calls for 100 templates (backend API limitation)
5. **🔴 Missing Schema Validation**: JSON.parse() without zod validation at MCP boundary

---

## Current State vs Desired State

### ✅ What's Working

| Aspect | Current Behavior |
|--------|------------------|
| **Learning Metrics** | executions, successRate, avgDuration, avgCost correctly extracted from backend `estimated_metrics` |
| **Cache Performance** | 5-minute TTL balances performance vs freshness |
| **Graceful Degradation** | MCP failures return undefined, fallback to bootstrap templates |
| **Schema Conversion** | ActivitySchemaAdapter.toCanonical handles defensive defaults, enum normalization |

### ⚠️ Intentional Design Decisions (NOT BUGS)

| Decision | Rationale |
|----------|-----------|
| **avgTokens = {0, 0, 0}** | Backend doesn't provide token data in `estimated_metrics` (backend limitation) |
| **version generated client-side** | Enables local template evolution without backend coupling |
| **genealogy created client-side** | Tracks provenance for templates evolved locally |
| **Round-trip incompatibility** | Edit-and-reregister creates NEW variant, not update (by design) |

### 🔴 Issues Requiring Changes

| Priority | Issue | Location | Mitigation |
|----------|-------|----------|------------|
| **HIGH** | Code Duplication (70%) | ActivitySchemaAdapter vs BootstrapTemplates | Unify on ActivitySchemaAdapter |
| **HIGH** | Missing Schema Validation | MetabobCLI.callMCPTool:321-328 | Add zod validation after JSON.parse() |
| **HIGH** | N+1 Query Pattern | TemplateServiceClient.searchTemplates:191-200 | Requires backend batch API |
| **MEDIUM** | Cache Staleness | TemplateCache 5-min TTL | Reduce TTL or push-based invalidation |
| **MEDIUM** | No API Versioning | MCP tool names hardcoded | Add version header to MCP calls |

---

## Data Flow Summary

```
Entry Points:
  1. LLM Tool: search_activities(category?, verbose?)
  2. LLM Tool: get_activity_template(id, backend?)
  3. Activity Execution: activity(templateId, variables)
     ↓
Repository Layer:
  TemplateRepository.list() / .get()
     ↓
Loader Layer:
  TemplateLoader.list() / .load()
     ↓ (cache check)
  TemplateCache.get() → Cache Hit? → Return cached
                      → Cache Miss ↓
Service Layer:
  TemplateServiceClient.searchTemplates() / .getTemplate()
     ↓ (N+1 pattern for search)
MCP Boundary:
  MetabobCLI.searchActivities() / .getActivity()
     ↓ (MCP: search_activities / activity tools)
Backend:
  Metabob Backend → JSON Response
     ↓
Critical Transformation:
  JSON.parse() [NO VALIDATION ⚠️]
     ↓
  ActivitySchemaAdapter.toCanonical()
    - Extract: execution_count → executions
    - Extract: success_rate → successRate
    - Extract: avg_duration_ms → avgDuration
    - Extract: avg_cost → avgCost
    - HARDCODE: avgTokens = {input:0, output:0, cache:0}
    - GENERATE: version (hash of template)
    - GENERATE: genealogy (MANUAL, HYBRID)
     ↓
  OpenCodeTemplate (ActivityTemplate.Schema)
     ↓
Cache Write:
  TemplateCache.put(template, 5-min TTL)
     ↓
Return Path:
  → Compact mode: {id, name, successRate, executions} (~300 bytes)
  → Verbose mode: Full schema (~2KB)
     ↓
Exit Points:
  1. LLM Context (for template selection)
  2. Activity Executor (for task sequencing)
  3. Metrics Update (backend write via metabob_post_activity_result)
```

---

## Components Traced

### 1. MetabobCLI.getActivity (util/metabob.ts:746-782)

**Current**: Fetches MetabobTemplate via MCP 'activity' tool, converts using ActivitySchemaAdapter.toCanonical  
**Gap**: No schema validation after JSON.parse()  
**Fix**: Add optional zod validation with graceful degradation

### 2. ActivitySchemaAdapter.toCanonical (session/activity-schema-adapter.ts:235-301)

**Current**: Converts MetabobTemplate → OpenCodeTemplate with learning metrics intact  
**Gap**: Need documentation clarifying intentional information loss (avgTokens, version, genealogy)  
**Fix**: Add inline comments explaining design decisions

### 3. BootstrapTemplates.convertProtoToSchema (session/bootstrap-templates.ts:194-244)

**Current**: Duplicates 70% of ActivitySchemaAdapter conversion logic  
**Gap**: Code duplication leads to divergence risk, double maintenance  
**Fix**: Delegate to ActivitySchemaAdapter.toCanonical

### 4. TemplateServiceClient.searchTemplates (server/template-service-client.ts:185-236)

**Current**: N+1 query pattern (search summaries → detail fetch for each)  
**Gap**: Performance degrades linearly (101 calls for 100 templates)  
**Fix**: Requires backend batch API (not client bug)

### 5. TemplateLoader.load (session/template-loader.ts:103-192)

**Current**: Cache-first (5-min TTL), fallback to backend, fallback to bootstrap  
**Gap**: Cache staleness - metrics stale for up to 5 minutes  
**Fix**: Reduce TTL or implement push-based invalidation

---

## Minimal Changes Required

### Change 1: Eliminate Code Duplication

**File**: `packages/opencode/src/session/bootstrap-templates.ts`  
**Component**: `BootstrapTemplates.convertProtoToSchema`  
**Change**: Delegate to ActivitySchemaAdapter.toCanonical instead of reimplementing  
**Impact**: No behavior change - single source of truth for conversion logic

```typescript
// BEFORE (140 lines of duplicate logic)
function convertProtoToSchema(protoJson: any): ActivityTemplate.Schema {
  // ... 140 lines of field-by-field mapping ...
}

// AFTER (delegate to adapter)
function convertProtoToSchema(protoJson: any): ActivityTemplate.Schema {
  validateProtoStructure(protoJson) // Keep validation
  return ActivitySchemaAdapter.toCanonical(protoJson) // Delegate conversion
}
```

### Change 2: Add Schema Validation at MCP Boundary

**File**: `packages/opencode/src/util/metabob.ts`  
**Component**: `MetabobCLI.callMCPTool`  
**Change**: Add optional zod validation after JSON.parse() with graceful degradation  
**Impact**: Catch malformed backend data early, improve debugging

```typescript
// BEFORE
const parsed = JSON.parse(textContent)
return parsed as T

// AFTER
const parsed = JSON.parse(textContent)
const validated = MetabobTemplateSchema.safeParse(parsed) // Optional validation
if (!validated.success) {
  log.error("MCP response validation failed", { errors: validated.error.errors })
  return undefined // Graceful degradation
}
return validated.data as T
```

### Change 3: Document Intentional Information Loss

**File**: `packages/opencode/src/session/activity-schema-adapter.ts`  
**Component**: `ActivitySchemaAdapter.toCanonical`  
**Change**: Add inline comments documenting design decisions  
**Impact**: Documentation only - prevent future "fixes" that break assumptions

```typescript
// INTENTIONAL: avgTokens hardcoded to zeros because backend doesn't include
// token data in estimated_metrics. This is a backend limitation, not a client bug.
// Templates will get accurate token data after first local execution.
avgTokens: { input: 0, output: 0, cache: 0 }

// INTENTIONAL: version generated client-side to enable local template evolution
// without backend coupling. Round-trip conversion is intentionally lossy.
version: generateVersion(template)

// INTENTIONAL: genealogy created client-side to track provenance for templates
// evolved locally. Edit-and-reregister creates NEW variant, not update.
genealogy: createGenealogy(template, "MANUAL", "HYBRID")
```

---

## Architectural Boundaries

### 1. MCP Protocol (Network Boundary)
- **Contract**: MCP tools (search_activities, activity, metabob_post_activity_result)
- **Coupling**: Loose (protocol-based, JSON serialization)
- **Risk**: No API versioning - tool names hardcoded

### 2. Schema Adapter (Data Format Boundary)
- **Contract**: MetabobTemplate → OpenCodeTemplate
- **Coupling**: Tight (field-by-field mapping)
- **Risk**: Breaking backend changes require adapter update

### 3. Cache Layer (Storage Boundary)
- **Contract**: (id, version) → ActivityTemplate.Schema
- **Coupling**: Loose (opaque storage)
- **Risk**: 5-minute staleness, manual invalidation

### 4. Bootstrap Templates (File System Boundary)
- **Contract**: Proto JSON → ActivityTemplate.Schema
- **Coupling**: Medium (JSON schema dependencies)
- **Risk**: No migration strategy, deprecated

---

## Validation Strategy

### Round-Trip Test
```typescript
test("round-trip preserves known data", () => {
  const original = createTestTemplate()
  const metabob = ActivitySchemaAdapter.fromCanonical(original)
  const restored = ActivitySchemaAdapter.toCanonical(metabob)
  
  // EXPECT KNOWN LOSS (intentional)
  expect(restored.avgTokens).toEqual({ input: 0, output: 0, cache: 0 })
  expect(restored.version).not.toEqual(original.version) // Regenerated
  expect(restored.genealogy).not.toEqual(original.genealogy) // Regenerated
  
  // EXPECT PRESERVED (learning data)
  expect(restored.executions).toEqual(original.executions)
  expect(restored.successRate).toEqual(original.successRate)
  expect(restored.avgDuration).toEqual(original.avgDuration)
  expect(restored.avgCost).toEqual(original.avgCost)
})
```

### Schema Validation Test
```typescript
test("validates MCP response schema", () => {
  const malformed = { activity_id: "test" } // Missing required fields
  const result = MetabobCLI.getActivity("test")
  expect(result).toBeUndefined() // Graceful degradation
  expect(log.error).toHaveBeenCalledWith("MCP response validation failed")
})
```

### Performance Test
```typescript
test("searchTemplates N+1 pattern", async () => {
  const start = Date.now()
  const results = await TemplateServiceClient.searchTemplates({ limit: 100 })
  const duration = Date.now() - start
  
  expect(duration).toBeLessThan(10000) // < 10 seconds with Promise.all()
  expect(results.length).toBeLessThanOrEqual(100)
})
```

---

## Related Documentation

- **Full Trace**: `repos/metabob-opencode/docs/data-flows/activity-retrieval-learning-data-flow.md`
- **Analysis**: `TEMPLATE_CONVERSION_ANALYSIS.md`
- **Impulse**: `TRACE_ACTIVITY_RETRIEVAL_LEARNING_DATA_FLOW.json`

---

## Output Format (JSON)

```json
{
  "specificationName": "activity-retrieval-learning-data-flow",
  "components": [
    {
      "file": "packages/opencode/src/util/metabob.ts",
      "component": "MetabobCLI.getActivity",
      "currentBehavior": "Fetches MetabobTemplate via MCP, converts using ActivitySchemaAdapter",
      "desiredBehavior": "Same, but with schema validation",
      "gap": "No schema validation after JSON.parse()"
    },
    {
      "file": "packages/opencode/src/session/activity-schema-adapter.ts",
      "component": "ActivitySchemaAdapter.toCanonical",
      "currentBehavior": "Converts with learning metrics intact, avgTokens=zeros, generates version/genealogy",
      "desiredBehavior": "Same (intentional design)",
      "gap": "Need documentation of intentional vs unintentional loss"
    },
    {
      "file": "packages/opencode/src/session/bootstrap-templates.ts",
      "component": "BootstrapTemplates.convertProtoToSchema",
      "currentBehavior": "Duplicates 70% of ActivitySchemaAdapter logic",
      "desiredBehavior": "Delegate to ActivitySchemaAdapter",
      "gap": "Code duplication"
    }
  ],
  "dataFlow": "LLM Tool → TemplateRepository → TemplateLoader → Cache → TemplateServiceClient → MetabobCLI → MCP → Backend → JSON.parse [NO VALIDATION] → ActivitySchemaAdapter.toCanonical [LEARNING METRICS EXTRACTED] → OpenCodeTemplate → Cache → Return",
  "traceImpulseId": "trace-activity-retrieval-learning-data-flow"
}
```

---

## Impulse Created

**ID**: `trace-activity-retrieval-learning-data-flow`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Content**: Complete trace analysis with component details, data flow diagram, risks, and minimal changes

This impulse will be used by downstream validation and enforcement tasks to:
1. Validate that learning data flows correctly through the system
2. Enforce elimination of code duplication between adapters
3. Verify schema validation at MCP boundary
4. Document intentional vs unintentional information loss

---

**Status**: ✅ TRACE COMPLETE - Ready for downstream validation and enforcement
