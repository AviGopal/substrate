# Hierarchical Tag System - Implementation Tasks

## Commit Milestones

| Milestone | Description | Testable State |
|-----------|-------------|----------------|
| M1 | Schema addition | Database accepts tags, existing data unchanged |
| M2 | API dual-mode | API accepts both category and tags |
| M3 | MiniBob integration | MiniBob sends/receives tags |
| M4 | Data migration | All existing activities have tags |
| M5 | Query optimization | Tag-based filtering works efficiently |
| M6 | Deprecation complete | category field removed |

---

## Milestone 1: Schema Addition (Non-Breaking)

**Goal:** Add tags infrastructure without breaking existing functionality

### Task 1.1: Add tags field to activity_registry schema
**File:** `repos/metabob-activity-api/sql/schemas/010-activity-registry.surql`

```surql
DEFINE FIELD IF NOT EXISTS tags ON activity_registry TYPE array<string>
  DEFAULT []
  COMMENT "Hierarchical tags using dot-notation (e.g., feature.vessel.state)";
```

- [ ] Add field definition after line 54
- [ ] Keep existing `category` field unchanged
- [ ] Add basic index: `DEFINE INDEX IF NOT EXISTS idx_activity_tags ON activity_registry FIELDS tags;`

### Task 1.2: Add tag_prefixes computed field
**File:** `repos/metabob-activity-api/sql/schemas/010-activity-registry.surql`

```surql
DEFINE FIELD IF NOT EXISTS tag_prefixes ON activity_registry TYPE array<string>
  VALUE <computed expression>
  COMMENT "Auto-computed tag prefixes for hierarchical queries";
```

- [ ] Add computed field that extracts all prefixes from tags
- [ ] Add index: `DEFINE INDEX IF NOT EXISTS idx_activity_tag_prefixes ON activity_registry FIELDS tag_prefixes;`

### Task 1.3: Add goal_tags to goal_execution_paths
**File:** `repos/metabob-activity-api/sql/schemas/012-composition.surql`

- [ ] Add `goal_tags` field (array<string>)
- [ ] Keep existing `goal_category` unchanged
- [ ] Add index for goal_tags

### Task 1.4: Add tags to paradigm activity table
**File:** `repos/metabob-activity-api/sql/schemas/020-paradigm-core-tables.surql`

- [ ] Add `tags` field to `activity` table
- [ ] Update compatibility views if needed

### Task 1.5: Create migration script
**File:** `repos/metabob-activity-api/sql/migrations/032-add-tags-field.surql`

- [ ] Create migration that adds fields without modifying data
- [ ] Ensure idempotent (IF NOT EXISTS)

**Commit M1:** `feat(schema): add tags field infrastructure to activity tables`

**Verification:**
```bash
# Deploy schema
helmfile -f activity-system-minimal.yaml.gotmpl sync

# Verify field exists
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'INFO FOR TABLE activity_registry' | jq '.fields.tags'

# Existing queries still work
curl http://activity.metabob.local/v2/activities/templates | jq '.[0].category'
```

---

## Milestone 2: API Dual-Mode

**Goal:** API accepts both `category` (legacy) and `tags` (new) in requests

### Task 2.1: Update Zod schemas
**File:** `repos/metabob-activity-api/src/models/schemas.ts`

- [ ] Add `TagSchema` with validation regex: `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/`
- [ ] Update `CreateTemplateRequestSchema` to accept optional `tags: z.array(TagSchema)`
- [ ] Keep `category` as optional for backward compat
- [ ] Add validation: require at least one of `tags` or `category`

### Task 2.2: Add category-to-tags conversion utility
**File:** `repos/metabob-activity-api/src/utils/tags.ts` (new file)

```typescript
export function categoryToTags(category: string): string[] {
  return [category];
}

export function ensureTags(input: { tags?: string[], category?: string }): string[] {
  if (input.tags?.length) return input.tags;
  if (input.category) return categoryToTags(input.category);
  return ['uncategorized'];
}

export function computeTagPrefixes(tags: string[]): string[] {
  // Extract all prefixes from dot-notation tags
}
```

- [ ] Implement `categoryToTags`
- [ ] Implement `ensureTags`
- [ ] Implement `computeTagPrefixes`
- [ ] Add unit tests

### Task 2.3: Update POST /v2/activities/templates route
**File:** `repos/metabob-activity-api/src/routes/activities.ts`

- [ ] Extract tags using `ensureTags(validated)`
- [ ] Compute prefixes using `computeTagPrefixes(tags)`
- [ ] Store both `tags` and `tag_prefixes` in database
- [ ] Continue storing `category` for backward compat (derive from first tag if needed)

### Task 2.4: Update GET /v2/activities/templates route
**File:** `repos/metabob-activity-api/src/routes/activities.ts`

- [ ] Add `tags` query param: `?tags=feature,vessel`
- [ ] Add `tag_prefix` query param: `?tag_prefix=feature`
- [ ] Keep `category` filter working
- [ ] Return both `category` and `tags` in response

### Task 2.5: Update response types
**File:** `repos/metabob-activity-api/src/models/schemas.ts`

- [ ] Add `tags: string[]` to ActivityTemplateSchema response
- [ ] Keep `category` in response for backward compat

### Task 2.6: Update goal paths endpoints
**File:** `repos/metabob-activity-api/src/routes/goal-paths.ts`

- [ ] Accept `goal_tags` in PathRecordRequest
- [ ] Auto-convert `goal_category` to `goal_tags` if only category provided
- [ ] Store both in database

**Commit M2:** `feat(api): add dual-mode support for tags and category`

**Verification:**
```bash
# Create template with tags
curl -X POST http://activity.metabob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-tags-001",
    "activity_id": "test-tags",
    "variant_name": "Test Tags",
    "description": "Testing tag system",
    "tags": ["feature.vessel.state", "utility.code"]
  }' | jq '.tags'

# Create template with legacy category (should auto-convert)
curl -X POST http://activity.metabob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-legacy-001",
    "variant_name": "Test Legacy",
    "description": "Testing backward compat",
    "category": "feature"
  }' | jq '.tags'
# Expected: ["feature"]

# Query by tag prefix
curl "http://activity.metabob.local/v2/activities/templates?tag_prefix=feature" | jq 'length'
```

---

## Milestone 3: MiniBob Integration

**Goal:** MiniBob sends and receives tags

### Task 3.1: Update ActivityTemplate type
**File:** `repos/minibob/src/types.ts`

```typescript
export interface ActivityTemplate {
  tags: string[];
  /** @deprecated Use tags instead */
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure";
  // ... rest unchanged
}
```

- [ ] Add `tags: string[]` field
- [ ] Make `category` optional with deprecation comment
- [ ] Update any other types that reference category

### Task 3.2: Update GoalEnrichment type
**File:** `repos/minibob/src/types.ts`

- [ ] Consider if GoalEnrichment should use tags
- [ ] If yes, update LLM prompt to return tags
- [ ] If no, add conversion from GoalEnrichment.category to tags

### Task 3.3: Update MCP client
**File:** `repos/minibob/src/mcp.ts`

- [ ] Update `registerTemplate` to send `tags` instead of `category`
- [ ] Handle responses that include both `tags` and `category`
- [ ] Update any template parsing to extract tags

### Task 3.4: Update ribosome/template extraction
**File:** `repos/minibob/src/activity.ts`

- [ ] Update `assembleTemplateFromExecution` call to pass tags
- [ ] Inherit tags from parent template
- [ ] Consider: merge parent tags with new tags?

### Task 3.5: Update template-generator
**File:** `repos/minibob/src/template-generator.ts`

- [ ] Update function signature to accept `tags: string[]`
- [ ] Remove category parameter or make it derive from tags

### Task 3.6: Update impulse system if needed
**File:** `repos/minibob/src/impulse.ts`

- [ ] Check if impulses reference category
- [ ] Update to use tags if applicable

**Commit M3:** `feat(minibob): integrate hierarchical tags into activity system`

**Verification:**
```bash
# Run MiniBob with a goal that creates a template
# Verify the created template has tags in the database

kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
# Look for: "tags": ["feature", "..."]
```

---

## Milestone 4: Data Migration

**Goal:** All existing activities have tags populated

### Task 4.1: Create data migration script
**File:** `repos/metabob-activity-api/sql/migrations/033-migrate-category-to-tags.surql`

```surql
-- Migrate category to tags for all records without tags
UPDATE activity_registry
SET tags = [category]
WHERE (tags IS NONE OR array::len(tags) = 0)
  AND category IS NOT NONE;

-- Compute prefixes for migrated records
UPDATE activity_registry
SET tag_prefixes = <compute expression>
WHERE array::len(tag_prefixes) = 0 AND array::len(tags) > 0;
```

- [ ] Create migration script
- [ ] Test on local data
- [ ] Make idempotent (safe to re-run)

### Task 4.2: Migrate goal_execution_paths
**File:** `repos/metabob-activity-api/sql/migrations/033-migrate-category-to-tags.surql`

```surql
UPDATE goal_execution_paths
SET goal_tags = [goal_category]
WHERE (goal_tags IS NONE OR array::len(goal_tags) = 0)
  AND goal_category IS NOT NONE;
```

- [ ] Add goal_tags migration
- [ ] Preserve goal_category for queries that use it

### Task 4.3: Add migration to Helm hooks
**File:** `helm/charts/metabob-activity-api/templates/migration-job.yaml`

- [ ] Ensure migration runs as part of deployment
- [ ] Verify hook ordering (after schema, before app startup)

### Task 4.4: Verify migration completeness
- [ ] Query for records with empty tags
- [ ] Query for records with empty tag_prefixes
- [ ] Generate migration report

**Commit M4:** `chore(migration): populate tags from existing category data`

**Verification:**
```bash
# Check migration completed
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'SELECT count() FROM activity_registry WHERE array::len(tags) = 0 GROUP ALL'
# Expected: 0

# Verify tag_prefixes computed
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'SELECT tags, tag_prefixes FROM activity_registry LIMIT 5'
```

---

## Milestone 5: Query Optimization

**Goal:** Tag-based filtering is efficient and feature-complete

### Task 5.1: Add full-text search on tags (optional)
**File:** `repos/metabob-activity-api/sql/schemas/010-activity-registry.surql`

```surql
DEFINE ANALYZER tag_analyzer TOKENIZERS blank FILTERS lowercase;
DEFINE INDEX idx_activity_tags_search ON activity_registry
  FIELDS tags SEARCH ANALYZER tag_analyzer;
```

- [ ] Evaluate if full-text search adds value beyond CONTAINS
- [ ] Implement if beneficial
- [ ] Benchmark query performance

### Task 5.2: Add tag suggestion endpoint
**File:** `repos/metabob-activity-api/src/routes/activities.ts`

```typescript
// GET /v2/activities/tags/suggest?prefix=feature
// Returns: ["feature", "feature.vessel", "feature.vessel.state", ...]
```

- [ ] Add endpoint to suggest tags based on prefix
- [ ] Query distinct tag_prefixes
- [ ] Cache results (tags change infrequently)

### Task 5.3: Add tag statistics endpoint
**File:** `repos/metabob-activity-api/src/routes/activities.ts`

```typescript
// GET /v2/activities/tags/stats
// Returns: { "feature": 42, "feature.vessel": 12, ... }
```

- [ ] Add endpoint for tag usage statistics
- [ ] Group by tag and count
- [ ] Include prefix rollups

### Task 5.4: Update Thompson Sampling to consider tags
**File:** `repos/metabob-activity-api/src/routes/activities.ts` (recommend endpoint)

- [ ] Allow filtering recommendations by tag prefix
- [ ] Consider tag similarity in scoring (optional)

### Task 5.5: Performance benchmarking
- [ ] Benchmark tag prefix queries at scale
- [ ] Compare with category enum queries
- [ ] Document performance characteristics

**Commit M5:** `feat(api): add tag query optimization and suggestion endpoints`

**Verification:**
```bash
# Test tag suggestion
curl "http://activity.metabob.local/v2/activities/tags/suggest?prefix=feat" | jq

# Test tag stats
curl "http://activity.metabob.local/v2/activities/tags/stats" | jq

# Benchmark query time
time curl "http://activity.metabob.local/v2/activities/templates?tag_prefix=feature"
```

---

## Milestone 6: Deprecation Complete

**Goal:** Remove category field, tags is the only classification

### Task 6.1: Remove category from schema constraints
**File:** `repos/metabob-activity-api/sql/schemas/010-activity-registry.surql`

```surql
-- Change from:
DEFINE FIELD IF NOT EXISTS category ON activity_registry TYPE string
  ASSERT $value IN [...]

-- To:
DEFINE FIELD IF NOT EXISTS category ON activity_registry TYPE option<string>
  COMMENT "DEPRECATED: Kept for read compatibility only";
```

- [ ] Remove ASSERT constraint
- [ ] Make field optional
- [ ] Add deprecation comment

### Task 6.2: Remove category from API validation
**File:** `repos/metabob-activity-api/src/models/schemas.ts`

- [ ] Remove `category` from CreateTemplateRequestSchema
- [ ] Keep in response schema for read compatibility (or remove entirely)

### Task 6.3: Update MiniBob to not send category
**File:** `repos/minibob/src/mcp.ts`

- [ ] Remove category from template registration payload
- [ ] Ensure only tags are sent

### Task 6.4: Update MiniBob types
**File:** `repos/minibob/src/types.ts`

- [ ] Remove deprecated category field
- [ ] Update any code that references it

### Task 6.5: Remove category indexes
**File:** `repos/metabob-activity-api/sql/schemas/010-activity-registry.surql`

```surql
REMOVE INDEX IF EXISTS idx_activity_category ON activity_registry;
REMOVE INDEX IF EXISTS idx_activity_scope_category ON activity_registry;
```

- [ ] Remove category-specific indexes
- [ ] Keep scope index (scope is still used)

### Task 6.6: Final cleanup
- [ ] Remove backward compat conversion code
- [ ] Remove category from goal_execution_paths if unused
- [ ] Update all documentation

**Commit M6:** `refactor(schema): remove deprecated category field`

**Verification:**
```bash
# Verify category not required
curl -X POST http://activity.metabob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "no-category-001",
    "variant_name": "No Category",
    "description": "Created without category",
    "tags": ["feature.new"]
  }' | jq

# Verify old endpoints still work (graceful degradation)
curl "http://activity.metabob.local/v2/activities/templates?category=feature" | jq 'length'
# Should return 0 or warn, not error
```

---

## Deferred Tasks

### microplastic Primordial Templates
**Decision:** Defer until M4 complete, then evaluate

**Files to update when ready:**
- `repos/microplastic/src/primordials/bootstrap.ts` (8 template definitions)
- `repos/microplastic/src/primordials/index.ts` (3 template definitions)

### Embedding-Based Semantic Search
**Decision:** Defer to future milestone

**Tasks when ready:**
- Add embedding generation (API-side or MiniBob-side)
- Add vector index to SurrealDB
- Add semantic search endpoint

### Dashboard Tag Visualization
**Decision:** Defer until M2 complete

**Files to update:**
- `repos/activity-dashboard/src/lib/types.ts`
- `repos/activity-dashboard/src/components/` (filter components)

---

## Task Dependencies

```
M1.1 ─┬─► M1.2 ─┬─► M1.5 ─► [M1 COMMIT]
M1.3 ─┘        │
M1.4 ─────────┘

[M1] ─► M2.1 ─► M2.2 ─┬─► M2.3 ─┬─► M2.5 ─► [M2 COMMIT]
                      │         │
                      └─► M2.4 ─┘
                      │
                      └─► M2.6 ─┘

[M2] ─► M3.1 ─► M3.2 ─► M3.3 ─► M3.4 ─► M3.5 ─► [M3 COMMIT]

[M3] ─► M4.1 ─► M4.2 ─► M4.3 ─► M4.4 ─► [M4 COMMIT]

[M4] ─► M5.1 ─┬─► M5.4 ─► M5.5 ─► [M5 COMMIT]
              │
        M5.2 ─┤
              │
        M5.3 ─┘

[M5] ─► M6.1 ─► M6.2 ─► M6.3 ─► M6.4 ─► M6.5 ─► M6.6 ─► [M6 COMMIT]
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SurrealDB computed field performance | Medium | High | Benchmark in M1, fallback to application-computed |
| Backward compat breaks old clients | Low | Medium | Dual-mode in M2, gradual deprecation |
| Tag proliferation (too many unique tags) | Medium | Low | Add tag suggestion/validation in M5 |
| microplastic templates fail | Low | Medium | Defer until M4, then batch update |

---

## Estimated Effort

| Milestone | Complexity | Files Changed |
|-----------|------------|---------------|
| M1 | Low | 4-5 schema files |
| M2 | Medium | 3-4 TS files + tests |
| M3 | Medium | 5-6 TS files |
| M4 | Low | 1-2 migration scripts |
| M5 | Medium | 2-3 TS files |
| M6 | Low | 4-5 files (cleanup) |
