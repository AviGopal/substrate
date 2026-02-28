# Activity Variant System Architecture Analysis

## Overview

The activity variant system enables **A/B testing and evolutionary improvement** of activity templates through:
- Template genealogy tracking (parent-child relationships)
- Variant hash computation (content-based versioning)
- Evolution tracking (why variants were created)
- Experimentation (select best-performing variants)

## Architecture

```
Activity Template (JSON)
  ↓
Template Genealogy System (TypeScript)
  ├─ Compute variant_hash (content hash)
  ├─ Track parent_id (genealogy)
  ├─ Record evolution (reason, author, notes)
  └─ Increment generation (0 → 1 → 2 → ...)
  ↓
Variant Registration (seed_activities.py)
  ↓
Backend API (implicit - through seed script)
  ↓
SurrealDB (activity_variants table)
```

## Data Flow Stages

### Stage 1: Template Creation/Evolution
**Location**: OpenCode template files or runtime generation
**Components**:
- `template-genealogy.ts`: Track evolution
- `template-version.ts`: Compute variant hash
- `template-selector.ts`: Choose which variant to use

**Output**: Template with genealogy metadata

### Stage 2: Variant Hash Computation
**Method**: `computeVariantHash(template)`
**Input**: Template JSON
**Output**: SHA-256 hash of template content
**Purpose**: Content-based versioning (same content = same hash)

### Stage 3: Genealogy Tracking
**Fields**:
```typescript
{
  created_at: timestamp,
  parent_id: "parent-template-id",
  variant_hash: "sha256-hash",
  generation: 0 | 1 | 2 | ...,
  evolution: {
    reason: EVOLUTION_REASON_*,
    based_on_execution: "exec-id",
    improvised: boolean,
    author: TEMPLATE_AUTHOR_*,
    notes: "..."
  },
  variant_ids: ["child1", "child2", ...]
}
```

### Stage 4: Variant Registration
**Script**: `seed_activities.py`
**Action**: INSERT or UPDATE activity_variants table
**Query**:
```sql
CREATE activity_variants SET
  variant_id = '...',
  template_id = '...',
  variant_hash = '...',
  context_requirements = [...],
  ...
```

### Stage 5: Variant Selection (Experimentation)
**Component**: Template selector (TemplateSelector.ts)
**Strategy**:
- **Epsilon-greedy**: Exploit best variant (1-ε) or explore random (ε)
- **UCB** (Upper Confidence Bound): Balance exploration/exploitation
- **Thompson Sampling**: Bayesian approach

**Metrics**: Success rate, cost, duration tracked in activity_executions

## Evolution Reasons

| Reason | Trigger | Example |
|--------|---------|---------|
| `EVOLUTION_REASON_SUCCESS` | Execution succeeded with improvements | "Optimized token usage" |
| `EVOLUTION_REASON_FAILURE_RECOVERY` | Execution failed, needs fixing | "Fixed validation error" |
| `EVOLUTION_REASON_OPTIMIZATION` | Manual optimization | "Reduced complexity" |
| `EVOLUTION_REASON_MANUAL` | Human intervention | "Added new task" |

## Template Author Types

| Author | Description | Example |
|--------|-------------|---------|
| `TEMPLATE_AUTHOR_AGENT` | AI-generated | Trailblazing improvisation |
| `TEMPLATE_AUTHOR_HUMAN` | Human-written | Manual template creation |
| `TEMPLATE_AUTHOR_HYBRID` | Collaboration | Human edits AI-generated template |

## Tracing Strategy

### Trace ID Fields
- **Primary**: `variant_id` (unique variant identifier)
- **Secondary**: `template_id` (template family identifier)
- **Tertiary**: `variant_hash` (content hash for deduplication)

### Source Origin Fields
- **template_id**: Which template family
- **parent_id**: Evolved from which variant
- **evolution.author**: Who created it (AGENT/HUMAN/HYBRID)

### Timestamp Fields
- **genealogy.created_at**: When variant was created

### Relationships
- **variant_ids**: Child variants
- **parent_id**: Parent variant
- **based_on_execution**: Execution that spawned this variant

## SurrealDB Schema

**Table**: `activity_variants`
**Type**: SCHEMALESS
**Fields**:
- `context_requirements`: array (default: [])

## Test Data Structure

```json
{
  "variant_id": "test-variant-1771503700",
  "template_id": "validate-data-flow",
  "variant_hash": "sha256-abc123def456",
  "context_requirements": [],
  "genealogy": {
    "created_at": 1771503700000,
    "parent_id": "",
    "variant_hash": "sha256-abc123def456",
    "generation": 0,
    "evolution": {
      "reason": "EVOLUTION_REASON_MANUAL",
      "improvised": false,
      "author": "TEMPLATE_AUTHOR_HUMAN",
      "notes": "Initial variant for testing"
    },
    "variant_ids": []
  },
  "success_count": 0,
  "failure_count": 0,
  "total_cost": 0.0,
  "avg_duration": 0
}
```

## Validation Points

1. **Variant Creation**: variant_id generated correctly
2. **Hash Computation**: variant_hash computed from template content
3. **Genealogy Tracking**: parent_id, generation tracked
4. **Evolution Metadata**: reason, author, notes recorded
5. **Database Persistence**: activity_variants table populated
6. **Metrics Tracking**: success_count, failure_count updated

## Experimentation Flow

```
Request for template "add-feature-complete"
  ↓
TemplateSelector.selectVariant()
  ├─ Get all variants of "add-feature-complete"
  ├─ Compute selection score (based on success_rate, cost, duration)
  ├─ Apply strategy (epsilon-greedy/UCB/Thompson sampling)
  └─ Return selected variant_id
  ↓
Execute selected variant
  ↓
Record execution result (success/failure, duration, cost)
  ↓
Update variant metrics in activity_variants
  └─ success_count++, total_cost += cost, avg_duration = ...
  ↓
Future requests benefit from updated metrics
```

## Current Status

- ✅ Table exists: activity_variants
- ✅ Schema defined: context_requirements field
- ⚠️ Table empty (no variants registered yet)
- ⚠️ Need to trace: template → variant registration → database

## Data Flow for Validation

```
Source: Activity Template (JSON file)
  ↓
Processing: Template Genealogy (compute hash, track evolution)
  ↓
Processing: Variant Registration (seed_activities.py)
  ↓
Target: SurrealDB activity_variants table
```

## Trace Variables for validate-data-flow

- **dataFlowName**: "activity-variant-system"
- **sourceComponent**: "Activity Template JSON"
- **processingLayers**: "Template Genealogy → Variant Registration Script"
- **targetDatabase**: "SurrealDB"
- **targetTable**: "activity_variants"
- **traceIdField**: "variant_id"
- **sourceOriginField**: "template_id"
- **timestampField**: "genealogy.created_at"
- **relatedTables**: `[{"table": "activity_executions", "foreignKey": "variant_id"}]`

## Key Insights

1. **Variant = Template Version**: Each variant is a specific version of a template
2. **Content-Based Versioning**: variant_hash enables deduplication
3. **Genealogy = Evolution Tree**: Track how templates evolve over time
4. **Experimentation = A/B Testing**: Select best-performing variants
5. **Metrics Drive Selection**: success_rate, cost, duration inform choices

## Next Steps

1. Create test variant and insert into activity_variants
2. Verify hash computation matches expected algorithm
3. Test genealogy tracking (parent → child relationship)
4. Validate evolution metadata persistence
5. Test variant selection strategy
