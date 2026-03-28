# MCP Tools ↔ Analysis API Visual Mapping

This document provides a visual representation of how MCP tools map to API endpoints.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent (Claude, etc.)                      │
│                                                                  │
│  User: "Find authentication bugs in the codebase"               │
└────────────────────────────┬────────────────────────────────────┘
                             │ MCP Protocol (JSON-RPC)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        metabob-mcp                               │
│  TypeScript/Bun MCP Server                                       │
│  Location: repos/metabob-mcp/                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Tool: search_codebase                                   │    │
│  │ - Validates input with Zod                              │    │
│  │ - Calls AnalysisAPIClient.post()                        │    │
│  │ - Formats response as text                              │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON
                             │ POST /v2/analysis/search
                             │ X-Session-ID: sess_abc123
                             │ { query: "authentication bugs", ... }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   metabob-analysis-api                           │
│  TypeScript/Bun/Hono HTTP Backend                                │
│  Location: repos/metabob-analysis-api/                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Route: POST /v2/analysis/search                         │    │
│  │ File: src/routes/search.ts                              │    │
│  │                                                          │    │
│  │ 1. Validate request with Zod schema                     │    │
│  │ 2. Check X-Session-ID header                            │    │
│  │ 3. Load CPG for session                                 │    │
│  │ 4. Perform semantic search                              │    │
│  │ 5. Return results with metadata                         │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ { results: [...], query_time_ms: 145 }
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Response to User                          │
│                                                                  │
│  "Search results for: authentication bugs                       │
│  Found 3 relevant issues:                                        │
│                                                                  │
│  1. [CRITICAL] security                                          │
│     Component: src/auth.ts::function::login::15                 │
│     Problem: SQL injection vulnerability detected               │
│     Similarity: 91.2%                                            │
│     ..."                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool-to-Endpoint Mapping

### ✅ Tool 1: get_priority_issues

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: get_priority_issues                                     │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/get-priority-issues.ts         │
│                                                                   │
│ Input:                                                            │
│   limit?: number (default: 10)                                   │
│   severity?: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')[]          │
│   category?: string[]                                             │
│   scope?: 'session' | 'project' | 'org'                          │
│                                                                   │
│ API Call:                                                         │
│   GET /v2/analysis/priority?limit=10&severity[]=CRITICAL         │
│                                                                   │
│ Output:                                                           │
│   Text-formatted list of priority issues                         │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: GET /v2/analysis/priority                          │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-analysis-api/src/routes/priority.ts          │
│ Mounted at: Line 112 in src/index.ts                             │
│                                                                   │
│ Query Params:                                                     │
│   limit: number (default: 10)                                    │
│   severity[]: enum[]                                              │
│   category[]: enum[]                                              │
│   scope: enum (default: 'session')                               │
│                                                                   │
│ Response:                                                         │
│   {                                                               │
│     issues: AnalysisProblem[]                                     │
│     total_issues: number                                          │
│     query_time_ms: number                                         │
│   }                                                               │
│                                                                   │
│ Status: ✅ WORKING                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

### ⚠️  Tool 2: search_codebase

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: search_codebase                                         │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/search-codebase.ts             │
│                                                                   │
│ Input:                                                            │
│   query: string (required)                                        │
│   limit?: number                                                  │
│   filters?: { severity, category, file_pattern, scope }          │
│                                                                   │
│ Expected Response Fields:                                         │
│   results[].similarity_score ← EXPECTS THIS                      │
│   results[].match_reason ← EXPECTS THIS                          │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: POST /v2/analysis/search                           │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-analysis-api/src/routes/search.ts            │
│                                                                   │
│ Response:                                                         │
│   {                                                               │
│     results: AnalysisProblem[]                                    │
│     total: number                                                 │
│     query: string                                                 │
│     query_time_ms: number                                         │
│   }                                                               │
│                                                                   │
│ ⚠️  ISSUE: Missing similarity_score and match_reason in results  │
│ Status: ⚠️  DEGRADED (displays undefined)                        │
│ Fix: Add fields to mock responses (lines 42-90)                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### ✅ Tool 3: annotate_component

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: annotate_component                                      │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/annotate-component.ts          │
│                                                                   │
│ Input:                                                            │
│   component_id: string                                            │
│   content: string ← Sends "content"                              │
│   type: enum                                                      │
│   tags?: string[]                                                 │
│   link_to_problem_id?: string                                     │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: POST /v2/analysis/annotations                      │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-analysis-api/src/routes/annotations.ts       │
│                                                                   │
│ Schema accepts BOTH:                                              │
│   content?: string                                                │
│   text?: string                                                   │
│ (At least one required)                                           │
│                                                                   │
│ Handler logic (line 50):                                          │
│   text: body.content || body.text || ''                          │
│                                                                   │
│ ✅ RESOLUTION: Dual field support handles both names             │
│ Status: ✅ WORKING                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

### ⚠️  Tool 4: suggest_related_changes

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: suggest_related_changes                                 │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/suggest-related-changes.ts     │
│                                                                   │
│ Input:                                                            │
│   changed_files: string[]                                         │
│   limit?: number                                                  │
│   confidence_threshold?: number                                   │
│   config?: { embedding_weight, frequency_weight }                │
│                                                                   │
│ Expected Response:                                                │
│   suggestions: [...]                                              │
│   model_version: string ← EXPECTS THIS (line 108, 151)          │
│   query_time_ms: number                                           │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: POST /v2/analysis/cochange/suggest                 │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-analysis-api/src/routes/cochange.ts          │
│                                                                   │
│ Response (lines 162-172):                                         │
│   {                                                               │
│     suggestions: [...]                                            │
│     total: number                                                 │
│     changed_files: string[]                                       │
│     config: {...}                                                 │
│     query_time_ms: number                                         │
│   }                                                               │
│                                                                   │
│ ⚠️  ISSUE: Missing model_version field                           │
│ Status: ⚠️  DEGRADED (displays undefined)                        │
│ Fix: Add model_version to response (line 163)                    │
└──────────────────────────────────────────────────────────────────┘
```

---

### ❌ Tool 5: analyze_change_impact

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: analyze_change_impact                                   │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/analyze-change-impact.ts       │
│                                                                   │
│ Input:                                                            │
│   changed_files?: string[]                                        │
│   diff?: string                                                   │
│   direction?: 'forward' | 'backward' | 'both'                    │
│   max_depth?: number                                              │
│   include_tests?: boolean                                         │
│                                                                   │
│ Expected Response Structure:                                      │
│   {                                                               │
│     analysis: {          ← Expects nested under "analysis"       │
│       changed_components: [...]                                   │
│       direct_dependencies: [...]                                  │
│       indirect_dependencies: [...]                                │
│       affected_tests: [...]                                       │
│       risk_level: string                                          │
│     }                                                             │
│     query_time_ms: number                                         │
│   }                                                               │
│                                                                   │
│ Code expects (line 108):                                          │
│   const { analysis } = result;                                    │
│   text += `Risk Level: ${analysis.risk_level}`;                  │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: POST /v2/analysis/impact                           │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-analysis-api/src/routes/impact.ts            │
│                                                                   │
│ Actual Response (lines 121-129):                                  │
│   {                                                               │
│     ...result,           ← Spreads at TOP level (wrong!)         │
│     analysis_config: {...}                                        │
│     query_time_ms: number                                         │
│   }                                                               │
│                                                                   │
│ Returns:                                                          │
│   {                                                               │
│     changed_components: [...]  ← AT TOP LEVEL                    │
│     direct_dependencies: [...]                                    │
│     indirect_dependencies: [...]                                  │
│     affected_tests: [...]                                         │
│     risk_level: string                                            │
│     analysis_config: {...}                                        │
│     query_time_ms: number                                         │
│   }                                                               │
│                                                                   │
│ ❌ ISSUE: result.analysis is undefined → tool fails              │
│ Status: ❌ BROKEN                                                 │
│ Fix: Wrap result under "analysis" key                            │
└──────────────────────────────────────────────────────────────────┘
```

---

### ❌ Tool 6: mark_problem_complete

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: mark_problem_complete                                   │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/mark-problem-complete.ts       │
│                                                                   │
│ Input:                                                            │
│   problem_id: string                                              │
│   resolution_summary: string                                      │
│   fixed_in_commit?: string                                        │
│   create_annotation: boolean ← Tool sends THIS name (line 30)    │
│                                                                   │
│ API Call (line 70-77):                                            │
│   PUT /v2/analysis/problems/{id}/complete                         │
│   Body: {                                                         │
│     resolution_summary,                                           │
│     fixed_in_commit,                                              │
│     create_annotation: input.create_annotation                    │
│   }                                                               │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: PUT /v2/analysis/problems/:id/complete             │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-analysis-api/src/routes/problems.ts          │
│                                                                   │
│ Schema (schemas.ts:90-94):                                        │
│   {                                                               │
│     resolution_summary: string                                    │
│     fixed_in_commit?: string                                      │
│     auto_annotate: boolean ← API expects THIS name               │
│   }                                                               │
│                                                                   │
│ ❌ FIELD NAME MISMATCH                                            │
│   Tool sends: create_annotation                                   │
│   API expects: auto_annotate                                      │
│                                                                   │
│ Result: Zod validation fails with 400 error                      │
│                                                                   │
│ Status: ❌ BROKEN                                                 │
│ Fix: Rename field in tool OR add alias in API schema             │
└──────────────────────────────────────────────────────────────────┘
```

---

### ❌ Tool 7: generate_implementation_spec

```
┌──────────────────────────────────────────────────────────────────┐
│ MCP Tool: generate_implementation_spec                            │
├──────────────────────────────────────────────────────────────────┤
│ File: repos/metabob-mcp/src/tools/generate-implementation-spec.ts│
│                                                                   │
│ Input:                                                            │
│   goal: string                                                    │
│   entry_points?: string[]                                         │
│   context?: string                                                │
│                                                                   │
│ Expected API Call (line 72):                                      │
│   POST /v2/analysis/specs/generate                                │
│                                                                   │
│ Expected Response:                                                │
│   {                                                               │
│     spec_id: string                                               │
│     goal: string                                                  │
│     overview: string                                              │
│     steps: ImplementationStep[]                                   │
│     affected_components: string[]                                 │
│     estimated_effort: string                                      │
│     risks: string[]                                               │
│     created_at: string                                            │
│   }                                                               │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Endpoint: POST /v2/analysis/specs/generate                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│                   ❌ ENDPOINT DOES NOT EXIST                      │
│                                                                   │
│ Evidence:                                                         │
│   ✅ Schema defined: schemas.ts:99-103                           │
│   ❌ No route file: src/routes/specs.ts                          │
│   ❌ Not mounted in src/index.ts                                 │
│   ❌ No handler implementation                                    │
│                                                                   │
│ ls src/routes/:                                                   │
│   - annotations.ts                                                │
│   - cochange.ts                                                   │
│   - impact.ts                                                     │
│   - priority.ts                                                   │
│   - problems.ts                                                   │
│   - search.ts                                                     │
│   (specs.ts missing!)                                             │
│                                                                   │
│ Status: ❌ NOT IMPLEMENTED                                        │
│ Impact: Tool completely non-functional                            │
│ Fix: Create route file and mount endpoint                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Status Legend

| Symbol | Meaning | Count |
|--------|---------|-------|
| ✅ | Working correctly | 2 |
| ⚠️  | Degraded (missing fields) | 2 |
| ❌ | Broken (blocking issues) | 3 |

---

## Quick Fix Reference

| Issue | File | Line | Change |
|-------|------|------|--------|
| Missing endpoint | Create `src/routes/specs.ts` | - | New file |
| Mount specs route | `src/index.ts` | 13, 117 | Add import + mount |
| Response structure | `src/routes/impact.ts` | 121 | Wrap in `analysis` key |
| Field name | `mark-problem-complete.ts` | 28,40,75 | Rename to `auto_annotate` |
| Missing fields | `src/routes/search.ts` | 48,62,77 | Add similarity_score, match_reason |
| Missing field | `src/routes/cochange.ts` | 163 | Add model_version |
| Wrong port | `src/api-client.ts` | 27 | Change 8081 → 8080 |

---

## Testing Flow

```
1. Apply fixes
   └─> Modify 6 files, create 1 file

2. Typecheck
   ├─> cd repos/metabob-analysis-api
   ├─> bun run typecheck
   ├─> cd repos/metabob-mcp
   └─> bun run typecheck

3. Start API server
   ├─> cd repos/metabob-analysis-api
   └─> bun run start
       └─> Server listening on http://localhost:8080

4. Test routes
   ├─> cd repos/metabob-analysis-api
   └─> bun run test-routes.ts
       └─> 8/8 tests passed ✅

5. Test MCP tools
   ├─> cd repos/metabob-mcp
   └─> ANALYSIS_API_URL=http://localhost:8080 bun run test-tool-call.ts
       └─> All 7 tools functional ✅
```

---

## Summary

- **Total Tools:** 7
- **Working:** 2 (28.6%)
- **Degraded:** 2 (28.6%)
- **Broken:** 3 (42.8%)
- **Fix Time:** 6-7 hours
- **Critical Issues:** 3
- **Medium Issues:** 3

See `CONTRACT_VALIDATION_REPORT.md` for detailed analysis.
See `CONTRACT_FIXES_QUICK_REFERENCE.md` for exact code changes.
