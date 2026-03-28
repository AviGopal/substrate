# Hierarchical Tag System for Activity Classification

## Overview

Replace the fixed `category` enum with a flexible hierarchical tag system supporting:
- Multiple tags per activity (set-based)
- Dot-notation hierarchy (e.g., `feature.vessel.state.communication`)
- Prefix matching for hierarchical queries
- Optional embedding-based semantic search

## Problem Statement

Current `category` field limitations:
- Fixed 6-value enum: `feature`, `bugfix`, `refactor`, `tool`, `infrastructure`, `meta`
- Single classification per activity
- Cannot express multi-dimensional classification
- Cannot capture hierarchical relationships

**Desired capabilities:**
```
feature.vessel.state.communication  → Find all vessel work, or all state work
utility.code.trace.cpg              → Find all code utilities, or all tracing
research.question.user.terminal     → Find all research, or all user-facing
meta.develop.activity               → Find all meta work, or development activities
analysis                            → Simple single-level tag
```

## Interface Boundaries

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ MiniBob (repos/minibob)                                         │
│ ├─ src/types.ts:384 → ActivityTemplate.category (5 enum values) │
│ ├─ src/activity.ts:803 → Ribosome inherits category             │
│ └─ src/mcp.ts:300 → Sends category to API                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /v2/activities/templates
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ metabob-activity-api (repos/metabob-activity-api)               │
│ ├─ src/models/schemas.ts:105 → Zod enum (6 values + 'meta')     │
│ ├─ src/routes/activities.ts:405 → Validates category            │
│ └─ src/routes/activities.ts:441,496 → Dual-writes to DB         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ INSERT INTO activity_registry
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ SurrealDB                                                       │
│ ├─ activity_registry.category (ASSERT constraint, 6 values)     │
│ ├─ goal_execution_paths.goal_category (separate concept)        │
│ └─ activity.category (optional, new paradigm table)             │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ MiniBob                                                         │
│ ├─ src/types.ts → ActivityTemplate.tags: string[]               │
│ ├─ src/activity.ts → Ribosome inherits/merges tags              │
│ └─ src/mcp.ts → Sends tags array to API                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /v2/activities/templates
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ metabob-activity-api                                            │
│ ├─ src/models/schemas.ts → z.array(z.string()) for tags         │
│ ├─ src/routes/activities.ts → Validates tags, computes prefixes │
│ └─ Database layer → Writes tags + computed fields               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ INSERT INTO activity_registry
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ SurrealDB                                                       │
│ ├─ activity_registry.tags: array<string>                        │
│ ├─ activity_registry.tag_prefixes: array<string> (computed)     │
│ └─ activity_registry.tag_embedding: array<float> (optional)     │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema Changes

### Current Schema (activity_registry)

```surql
-- repos/metabob-activity-api/sql/schemas/010-activity-registry.surql:51-54
DEFINE FIELD IF NOT EXISTS category ON activity_registry TYPE string
  ASSERT $value IN ['feature', 'bugfix', 'refactor', 'tool', 'infrastructure', 'meta']
  VALUE $value OR 'infrastructure'
  COMMENT "Activity category (meta = self-referential activities)";

DEFINE INDEX IF NOT EXISTS idx_activity_category ON activity_registry FIELDS category;
DEFINE INDEX IF NOT EXISTS idx_activity_scope_category ON activity_registry FIELDS scope, category;
```

### Proposed Schema

```surql
-- Remove category field constraint (keep field for migration period)
DEFINE FIELD IF NOT EXISTS category ON activity_registry TYPE option<string>
  COMMENT "DEPRECATED: Use tags field instead";

-- Primary tags field
DEFINE FIELD IF NOT EXISTS tags ON activity_registry TYPE array<string>
  DEFAULT []
  COMMENT "Hierarchical tags using dot-notation (e.g., feature.vessel.state)";

-- Computed prefixes for efficient prefix queries
DEFINE FIELD IF NOT EXISTS tag_prefixes ON activity_registry TYPE array<string>
  VALUE {
    LET $prefixes = [];
    FOR $tag IN $this.tags {
      LET $parts = string::split($tag, ".");
      FOR $i IN 0..(array::len($parts) - 1) {
        LET $prefix = string::join(".", array::slice($parts, 0, $i + 1));
        IF NOT array::contains($prefixes, $prefix) {
          $prefixes = array::push($prefixes, $prefix);
        }
      }
    }
    RETURN $prefixes;
  }
  COMMENT "Auto-computed tag prefixes for hierarchical queries";

-- Optional: Embedding vector for semantic search
DEFINE FIELD IF NOT EXISTS tag_embedding ON activity_registry TYPE option<array<float>>
  COMMENT "Embedding vector of concatenated tags for semantic similarity";

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_activity_tags ON activity_registry FIELDS tags;
DEFINE INDEX IF NOT EXISTS idx_activity_tag_prefixes ON activity_registry FIELDS tag_prefixes;
```

### Goal Execution Paths

```surql
-- repos/metabob-activity-api/sql/schemas/012-composition.surql
-- goal_category stays separate - it categorizes GOALS not activities
-- But add tags support for goal-based filtering

DEFINE FIELD IF NOT EXISTS goal_tags ON goal_execution_paths TYPE array<string>
  DEFAULT []
  COMMENT "Tags for goal classification (mirrors activity tags)";
```

## Query Patterns

### Tag-Based Queries

```surql
-- Find all activities with exact tag
SELECT * FROM activity_registry WHERE tags CONTAINS "feature.vessel";

-- Find all activities with tag prefix (using computed prefixes)
SELECT * FROM activity_registry WHERE tag_prefixes CONTAINS "feature";

-- Find activities matching ANY of multiple tags
SELECT * FROM activity_registry WHERE tags CONTAINSANY ["feature.vessel", "utility.code"];

-- Find activities matching ALL tags
SELECT * FROM activity_registry WHERE tags CONTAINSALL ["feature", "vessel"];

-- Combined with scope
SELECT * FROM activity_registry
WHERE tag_prefixes CONTAINS "feature"
  AND org_id = $auth.org_id;
```

### Migration Query

```surql
-- Migrate existing category to tags
UPDATE activity_registry SET tags = [category] WHERE category IS NOT NONE;
```

## API Changes

### CreateTemplateRequest Schema

```typescript
// repos/metabob-activity-api/src/models/schemas.ts

// Before
export const CreateTemplateRequestSchema = z.object({
  category: z.enum(['feature', 'bugfix', 'refactor', 'tool', 'infrastructure', 'meta']),
  // ...
});

// After
export const CreateTemplateRequestSchema = z.object({
  tags: z.array(z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/))
    .min(1)
    .describe("Hierarchical tags using dot-notation"),
  // Deprecated, optional for migration
  category: z.enum(['feature', 'bugfix', 'refactor', 'tool', 'infrastructure', 'meta']).optional(),
  // ...
});
```

### Filter Parameters

```typescript
// repos/metabob-activity-api/src/routes/activities.ts

// Before
const category = c.req.query('category');

// After
const tags = c.req.query('tags')?.split(',');  // ?tags=feature,vessel
const tagPrefix = c.req.query('tag_prefix');    // ?tag_prefix=feature
```

### MiniBob Types

```typescript
// repos/minibob/src/types.ts

// Before
export interface ActivityTemplate {
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure";
  // ...
}

// After
export interface ActivityTemplate {
  tags: string[];
  // Deprecated
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure" | "meta";
  // ...
}
```

## Isolation Constraint Evaluation

### Components That MUST Change

| Component | Files | Change Type |
|-----------|-------|-------------|
| metabob-activity-api | schemas, routes, models | Schema + API |
| minibob | types.ts, activity.ts, mcp.ts | Types + Logic |

### Components That Should NOT Change (Evaluation)

| Component | Status | Reason |
|-----------|--------|--------|
| metabob-mcp | ✅ SAFE | Read-only - displays API responses |
| metabob-analysis-api | ✅ SAFE | Separate `ProblemCategory` system |
| microplastic | ⚠️ **NEEDS CHANGES** | Primordial templates have hardcoded `category` |
| minibob-tui | ✅ SAFE | Local dev templates, not critical path |

### Critical Finding: microplastic

**The constraint is NOT fully satisfied.** Microplastic contains embedded primordial templates:

```typescript
// repos/microplastic/src/primordials/bootstrap.ts:30
{ category: "tool", ... }  // Create Template activity

// repos/microplastic/src/primordials/index.ts:36
{ category: "feature", ... }  // Develop Feature
```

**Options:**
1. **Accept microplastic changes** - Update 8+ template definitions
2. **Backward compatibility layer** - Auto-convert `category` to `tags: [category]`
3. **Defer microplastic** - Keep old templates working during transition

**Recommendation:** Option 2 - Add backward compat in API that converts category → tags

## Existing Patterns to Leverage

### 1. Scope Field (Already Hierarchical)

The `scope` field already handles multi-tenant hierarchy:
```surql
DEFINE FIELD IF NOT EXISTS scope ON activity_registry TYPE string
  ASSERT $value IN ['global', 'org', 'project', 'vessel']
```

**Lesson:** Keep scope separate from tags. Tags are for discovery, scope is for access control.

### 2. Array Fields (Already Used)

```surql
-- Already defined in 010-activity-registry.surql:153
DEFINE FIELD IF NOT EXISTS tags ON activity_registry TYPE option<array>
  COMMENT "Searchable tags for template discovery";
```

**Lesson:** The field exists but is unused. We're enhancing it, not creating it.

### 3. Prefix Matching (Proven Pattern)

```typescript
// repos/metabob-activity-api/src/resolvers/pattern-store.ts:224-226
// Uses prefix matching as a simple similarity heuristic
```

**Lesson:** Deterministic prefix matching is proven. No need for complex embedding search initially.

## Migration Strategy

### Phase 1: Schema Addition (Non-Breaking)

1. Add `tags` field with default `[]`
2. Add `tag_prefixes` computed field
3. Add indexes
4. Keep `category` field unchanged

### Phase 2: API Dual-Mode

1. Accept both `category` and `tags` in requests
2. Auto-convert: `category: "feature"` → `tags: ["feature"]`
3. Return both in responses
4. Update MiniBob to send `tags`

### Phase 3: Data Migration

1. Run migration: `UPDATE activity_registry SET tags = [category]`
2. Verify all records have tags
3. Update queries to use tags

### Phase 4: Deprecation

1. Mark `category` as deprecated in API docs
2. Log warnings when `category` is used without `tags`
3. Remove `category` validation (make optional)

### Phase 5: Cleanup

1. Remove `category` field from schema
2. Remove backward compat code
3. Update all documentation

## Tag Format Specification

### Syntax

```
tag := segment ("." segment)*
segment := [a-z][a-z0-9]*
```

### Examples

| Tag | Meaning |
|-----|---------|
| `feature` | Generic feature work |
| `feature.vessel` | Feature work on vessels |
| `feature.vessel.state` | Vessel state management features |
| `utility.code.trace.cpg` | Code tracing utility using CPG |
| `meta.develop.activity` | Meta-activity for developing activities |
| `research` | Research/exploration work |

### Reserved Prefixes

| Prefix | Purpose |
|--------|---------|
| `meta.` | Self-referential activities |
| `system.` | System-level activities |
| `test.` | Testing activities |

### Validation Rules

1. Tags must be lowercase alphanumeric with dots
2. Segments cannot start with numbers
3. Minimum 1 tag required per activity
4. Maximum 10 tags recommended (soft limit)
5. Maximum tag length: 100 characters

## Success Criteria

1. **Functional:** Activities can be created/queried with hierarchical tags
2. **Performance:** Tag prefix queries complete in <100ms
3. **Migration:** Existing activities retain classification via auto-conversion
4. **Isolation:** metabob-mcp, metabob-analysis-api remain unchanged
5. **Backward Compat:** Old API clients using `category` continue working

## Open Questions

1. **Embedding generation:** Who generates tag embeddings? MiniBob or API?
2. **Tag suggestions:** Should API suggest tags based on activity content?
3. **Tag normalization:** Should we auto-lowercase or reject mixed case?
4. **Microplastic primordials:** Update now or defer?
