# Contract Validation Fixes - Quick Reference

This document provides exact file locations and code changes needed to fix contract mismatches.

---

## Priority 1: Critical Fixes (Must Fix Before Integration)

### 1. Implement Missing Endpoint: generate_implementation_spec

**Status:** ❌ Endpoint does not exist

**Files to Create:**

#### A. Create route handler
**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/src/routes/specs.ts`

```typescript
/**
 * Implementation Spec Generation Endpoint
 * POST /v2/analysis/specs/generate
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { GenerateSpecRequestSchema } from '../models/schemas.js';
import type { CPGService } from '../services/cpg-service.js';

const app = new Hono<{
  Variables: {
    cpgService: CPGService;
  };
}>();

app.post(
  '/generate',
  zValidator('json', GenerateSpecRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const sessionId = c.req.header('X-Session-ID');

    if (!sessionId) {
      return c.json({ error: 'Missing X-Session-ID header' }, 401);
    }

    const startTime = performance.now();

    // TODO: Implement spec generation logic
    const mockSpec = {
      spec_id: `spec:${Date.now()}`,
      goal: body.goal,
      overview: `Implementation plan for: ${body.goal}`,
      steps: [
        {
          step_number: 1,
          title: 'Analyze entry points',
          description: 'Review the provided entry points to understand the current structure',
          files_to_modify: body.entry_points || [],
          files_to_create: [],
          dependencies: [],
          estimated_complexity: 'low' as const,
        },
      ],
      affected_components: [],
      estimated_effort: '2-4 hours',
      risks: ['Initial implementation may need refinement'],
      created_at: new Date().toISOString(),
    };

    const queryTimeMs = performance.now() - startTime;

    return c.json({
      ...mockSpec,
      query_time_ms: Math.round(queryTimeMs),
    });
  }
);

export default app;
```

#### B. Mount route in main server
**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/src/index.ts`

**Line 13:** Add import
```typescript
import specsRoutes from './routes/specs.js';
```

**Line 117:** Add mount (after problems route)
```typescript
app.route('/v2/analysis/specs', specsRoutes);
```

---

### 2. Fix Field Name Mismatch: mark_problem_complete

**Status:** ❌ Tool sends `create_annotation`, API expects `auto_annotate`

**Option A: Fix Tool (Recommended)**

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-mcp/src/tools/mark-problem-complete.ts`

**Line 28:** Change input schema property name
```typescript
// BEFORE
create_annotation: {
  type: 'boolean',
  description: 'Whether to automatically create an annotation documenting the fix (default: true)',
},

// AFTER
auto_annotate: {
  type: 'boolean',
  description: 'Whether to automatically create an annotation documenting the fix (default: true)',
},
```

**Line 40:** Change Zod schema
```typescript
// BEFORE
create_annotation: z.boolean().default(true),

// AFTER
auto_annotate: z.boolean().default(true),
```

**Line 75:** Change request body field
```typescript
// BEFORE
create_annotation: input.create_annotation,

// AFTER
auto_annotate: input.auto_annotate,
```

**Option B: Fix API (Alternative)**

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/src/models/schemas.ts`

**Line 92:** Add alias support
```typescript
// BEFORE
auto_annotate: z.boolean().default(true),

// AFTER
auto_annotate: z.boolean().default(true),
create_annotation: z.boolean().optional(),  // Alias for compatibility
}).transform(data => ({
  ...data,
  auto_annotate: data.auto_annotate ?? data.create_annotation ?? true
}));
```

---

### 3. Fix Response Structure: analyze_change_impact

**Status:** ❌ Tool expects nested `analysis` key, API returns flat

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/src/routes/impact.ts`

**Lines 121-129:** Wrap response in `analysis` key
```typescript
// BEFORE
return c.json({
  ...result,
  analysis_config: {
    direction: body.direction,
    max_depth: body.max_depth,
    include_tests: body.include_tests,
  },
  query_time_ms: Math.round(queryTimeMs),
});

// AFTER
return c.json({
  analysis: result,  // Nest result under 'analysis' key
  query_time_ms: Math.round(queryTimeMs),
});
```

---

## Priority 2: Medium Fixes (Degraded Functionality)

### 4. Add Missing Fields: search_codebase

**Status:** ⚠️ Response missing `similarity_score` and `match_reason`

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/src/routes/search.ts`

**Lines 42-90:** Add missing fields to mock results
```typescript
// BEFORE
mockResults.push({
  id: 'problem:search-1',
  session_id: sessionId,
  component_id: 'src/handlers.ts::function::processRequest::45',
  severity: 'HIGH',
  category: 'correctness',
  message: 'Unhandled promise rejection in error handler',
  impact_score: 0.82,
  status: 'open',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// AFTER
mockResults.push({
  id: 'problem:search-1',
  session_id: sessionId,
  component_id: 'src/handlers.ts::function::processRequest::45',
  severity: 'HIGH',
  category: 'correctness',
  message: 'Unhandled promise rejection in error handler',
  impact_score: 0.82,
  status: 'open',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  similarity_score: 0.87,  // ADD THIS
  match_reason: 'Keywords: error, handler, promise',  // ADD THIS
});
```

Repeat for all mock result objects (lines 48, 62, 77).

---

### 5. Add Missing Field: suggest_related_changes

**Status:** ⚠️ Response missing `model_version`

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/src/routes/cochange.ts`

**Lines 162-172:** Add model_version field
```typescript
// BEFORE
return c.json({
  suggestions,
  total: suggestions.length,
  changed_files: body.changed_files,
  config: {
    embedding_weight: config.embedding_weight,
    frequency_weight: config.frequency_weight,
    threshold: body.confidence_threshold,
  },
  query_time_ms: Math.round(queryTimeMs),
});

// AFTER
return c.json({
  suggestions,
  model_version: 'cochange-v1.0-session',  // ADD THIS
  total: suggestions.length,
  changed_files: body.changed_files,
  config: {
    embedding_weight: config.embedding_weight,
    frequency_weight: config.frequency_weight,
    threshold: body.confidence_threshold,
  },
  query_time_ms: Math.round(queryTimeMs),
});
```

---

### 6. Fix Default Port: API Client

**Status:** ⚠️ Default port is 8081, should be 8080

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-mcp/src/api-client.ts`

**Line 27:** Change default port
```typescript
// BEFORE
this.baseURL = config.baseURL || 'http://localhost:8081';

// AFTER
this.baseURL = config.baseURL || 'http://localhost:8080';
```

---

## Verification Checklist

After applying fixes, verify with these commands:

### 1. TypeScript Compilation
```bash
# metabob-analysis-api
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api
bun run typecheck

# metabob-mcp
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-mcp
bun run typecheck
```

### 2. Start API Server
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api
bun run start
```

### 3. Test Each Endpoint
```bash
# In another terminal
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api
bun run test-routes.ts
```

Expected output: `8/8 tests passed` (was 0/8, now includes specs endpoint)

### 4. Test MCP Tools
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-mcp
ANALYSIS_API_URL=http://localhost:8080 bun run test-tool-call.ts
```

---

## Summary of Changes

| Fix | Files Modified | Lines Changed | Complexity |
|-----|---------------|---------------|------------|
| 1. Add specs endpoint | 2 files (new route + mount) | ~60 | Medium |
| 2. Field name alignment | 1 file (tool schema) | 3 locations | Low |
| 3. Response structure | 1 file (impact route) | 10 lines | Low |
| 4. Add search fields | 1 file (search route) | 6 additions | Low |
| 5. Add model_version | 1 file (cochange route) | 1 line | Low |
| 6. Fix default port | 1 file (api-client) | 1 line | Low |
| **Total** | **6 files** | **~81 lines** | **1-2 hours** |

---

## Testing Commands Reference

### Unit Tests (if available)
```bash
# API
cd repos/metabob-analysis-api
bun test

# MCP
cd repos/metabob-mcp
bun test
```

### Integration Test
```bash
# Start API server in terminal 1
cd repos/metabob-analysis-api
bun run start

# Test routes in terminal 2
cd repos/metabob-analysis-api
bun run test-routes.ts

# Test MCP tools in terminal 3
cd repos/metabob-mcp
ANALYSIS_API_URL=http://localhost:8080 bun run test-with-mock-api.ts
```

---

## Related Documentation

- Contract Specification: `/home/avi/documents/work/exp-repo/metabob-devbob/ANALYSIS_API_MCP_CONTRACTS.md`
- Full Validation Report: `/home/avi/documents/work/exp-repo/metabob-devbob/CONTRACT_VALIDATION_REPORT.md`
- Route Verification: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-analysis-api/ROUTE_VERIFICATION.md`
