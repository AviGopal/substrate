# SurrealDB Schema Specification

**Component:** metabob-analysis-api data layer
**Database:** SurrealDB 3.x
**Purpose:** Define persistent storage for analysis results, components, and learning data

---

## Schema Organization

### Namespaces

```sql
-- Shared namespace with metabob-activity-api
USE NS activity_system;
USE DB learning_loop;
```

**Rationale:** Use the same namespace/database as metabob-activity-api for:
- Shared session/org/project hierarchy
- Unified querying across activity + analysis data
- Single SurrealDB instance deployment

---

## Table Hierarchy

```
Organizations (shared with activity-api)
    ├── Projects (shared with activity-api)
    │   ├── Sessions (shared with activity-api)
    │   │   ├── Analysis Jobs
    │   │   │   └── Analysis Problems
    │   │   ├── Code Components
    │   │   │   ├── Component Annotations
    │   │   │   └── Impact Relations
    │   │   └── Cochange Patterns
    │   └── Design Patterns
    └── API Keys (shared with activity-api)
```

---

## Shared Tables (from metabob-activity-api)

These tables are **already defined** by metabob-activity-api. We reference but don't redefine them.

### organizations

```sql
-- REFERENCE ONLY (defined in metabob-activity-api)
DEFINE TABLE organizations SCHEMAFULL;
DEFINE FIELD org_id ON organizations TYPE string;
DEFINE FIELD name ON organizations TYPE string;
DEFINE FIELD created_at ON organizations TYPE datetime;
DEFINE FIELD updated_at ON organizations TYPE datetime;

DEFINE INDEX org_id_idx ON organizations FIELDS org_id UNIQUE;
```

### projects

```sql
-- REFERENCE ONLY (defined in metabob-activity-api)
DEFINE TABLE projects SCHEMAFULL;
DEFINE FIELD project_id ON projects TYPE string;
DEFINE FIELD org_id ON projects TYPE string;
DEFINE FIELD name ON projects TYPE string;
DEFINE FIELD repository_url ON projects TYPE option<string>;
DEFINE FIELD branch ON projects TYPE option<string>;
DEFINE FIELD created_at ON projects TYPE datetime;
DEFINE FIELD updated_at ON projects TYPE datetime;

DEFINE INDEX project_id_idx ON projects FIELDS project_id UNIQUE;
DEFINE INDEX org_id_idx ON projects FIELDS org_id;
```

### sessions

```sql
-- REFERENCE ONLY (defined in metabob-activity-api)
DEFINE TABLE sessions SCHEMAFULL;
DEFINE FIELD session_id ON sessions TYPE string;
DEFINE FIELD org_id ON sessions TYPE option<string>;
DEFINE FIELD project_id ON sessions TYPE option<string>;
DEFINE FIELD api_key ON sessions TYPE option<string>;
DEFINE FIELD created_at ON sessions TYPE datetime;
DEFINE FIELD last_active_at ON sessions TYPE datetime;
DEFINE FIELD expired_at ON sessions TYPE option<datetime>;

DEFINE INDEX session_id_idx ON sessions FIELDS session_id UNIQUE;
DEFINE INDEX project_id_idx ON sessions FIELDS project_id;
```

---

## Analysis-Specific Tables

### analysis_jobs

**Purpose:** Track analysis job execution (maps to Redis job tracking).

```sql
DEFINE TABLE analysis_jobs SCHEMAFULL;

-- Identity
DEFINE FIELD job_id ON analysis_jobs TYPE string;
DEFINE FIELD session_id ON analysis_jobs TYPE string;
DEFINE FIELD org_id ON analysis_jobs TYPE option<string>;
DEFINE FIELD project_id ON analysis_jobs TYPE option<string>;

-- Job metadata
DEFINE FIELD status ON analysis_jobs TYPE string;
  -- VALUES: "pending", "running", "complete", "failed"
DEFINE FIELD progress ON analysis_jobs TYPE number;
  -- 0-100 percentage

-- Files processed
DEFINE FIELD files_submitted ON analysis_jobs TYPE array;
DEFINE FIELD files_analyzed ON analysis_jobs TYPE array;

-- Timing
DEFINE FIELD created_at ON analysis_jobs TYPE datetime;
DEFINE FIELD started_at ON analysis_jobs TYPE option<datetime>;
DEFINE FIELD completed_at ON analysis_jobs TYPE option<datetime>;
DEFINE FIELD duration_ms ON analysis_jobs TYPE option<number>;

-- Results summary
DEFINE FIELD problems_found ON analysis_jobs TYPE number DEFAULT 0;
DEFINE FIELD components_extracted ON analysis_jobs TYPE number DEFAULT 0;

-- Error handling
DEFINE FIELD error_message ON analysis_jobs TYPE option<string>;

-- Indexes
DEFINE INDEX job_id_idx ON analysis_jobs FIELDS job_id UNIQUE;
DEFINE INDEX session_id_idx ON analysis_jobs FIELDS session_id;
DEFINE INDEX project_id_idx ON analysis_jobs FIELDS project_id;
DEFINE INDEX status_idx ON analysis_jobs FIELDS status;
DEFINE INDEX created_at_idx ON analysis_jobs FIELDS created_at;
```

### analysis_problems

**Purpose:** Store detected code issues/bugs/problems.

```sql
DEFINE TABLE analysis_problems SCHEMAFULL;

-- Identity
DEFINE FIELD problem_id ON analysis_problems TYPE string;
DEFINE FIELD job_id ON analysis_problems TYPE string;
DEFINE FIELD session_id ON analysis_problems TYPE string;
DEFINE FIELD org_id ON analysis_problems TYPE option<string>;
DEFINE FIELD project_id ON analysis_problems TYPE option<string>;

-- Problem details
DEFINE FIELD file_path ON analysis_problems TYPE string;
DEFINE FIELD component_id ON analysis_problems TYPE option<string>;
  -- Format: "file.ts::ComponentName" (if problem is in specific component)

DEFINE FIELD category ON analysis_problems TYPE string;
  -- VALUES: "bug", "security", "performance", "maintainability", "style"
DEFINE FIELD severity ON analysis_problems TYPE string;
  -- VALUES: "HIGH", "MEDIUM", "LOW"

DEFINE FIELD summary ON analysis_problems TYPE string;
  -- One-line description
DEFINE FIELD description ON analysis_problems TYPE string;
  -- Detailed explanation

-- Location
DEFINE FIELD start_line ON analysis_problems TYPE number;
DEFINE FIELD end_line ON analysis_problems TYPE number;
DEFINE FIELD code_snippet ON analysis_problems TYPE option<string>;

-- Status
DEFINE FIELD status ON analysis_problems TYPE string DEFAULT "open";
  -- VALUES: "open", "resolved", "discarded", "endorsed"
DEFINE FIELD resolved_at ON analysis_problems TYPE option<datetime>;
DEFINE FIELD resolution_summary ON analysis_problems TYPE option<string>;
DEFINE FIELD fixed_in_commit ON analysis_problems TYPE option<string>;

-- Metadata
DEFINE FIELD created_at ON analysis_problems TYPE datetime;
DEFINE FIELD updated_at ON analysis_problems TYPE datetime;

-- Impact (denormalized for performance)
DEFINE FIELD impact_score ON analysis_problems TYPE option<number>;
  -- 0-100, computed from CPG
DEFINE FIELD affected_components_count ON analysis_problems TYPE option<number>;

-- Indexes
DEFINE INDEX problem_id_idx ON analysis_problems FIELDS problem_id UNIQUE;
DEFINE INDEX session_id_idx ON analysis_problems FIELDS session_id;
DEFINE INDEX project_id_idx ON analysis_problems FIELDS project_id;
DEFINE INDEX status_idx ON analysis_problems FIELDS status;
DEFINE INDEX category_severity_idx ON analysis_problems FIELDS category, severity;
DEFINE INDEX file_path_idx ON analysis_problems FIELDS file_path;
```

### code_components

**Purpose:** Store extracted code components (functions, classes, etc.).

```sql
DEFINE TABLE code_components SCHEMAFULL;

-- Identity
DEFINE FIELD component_id ON code_components TYPE string;
  -- Format: "file.ts::ComponentName"
DEFINE FIELD session_id ON code_components TYPE string;
DEFINE FIELD project_id ON code_components TYPE option<string>;

-- Component details
DEFINE FIELD file_path ON code_components TYPE string;
DEFINE FIELD component_type ON code_components TYPE string;
  -- VALUES: "function", "class", "method", "variable", "import"
DEFINE FIELD name ON code_components TYPE string;

-- Location
DEFINE FIELD start_line ON code_components TYPE number;
DEFINE FIELD end_line ON code_components TYPE number;

-- Metadata (flexible JSON)
DEFINE FIELD metadata ON code_components TYPE option<object>;
  -- Example: { params: ["user", "options"], returnType: "Promise<User>" }

-- Embeddings (for semantic search)
DEFINE FIELD embedding ON code_components TYPE option<array<number>>;
  -- 32-dim vector from ONNX model
DEFINE FIELD embedding_version ON code_components TYPE option<string>;

-- Documentation
DEFINE FIELD last_annotated_at ON code_components TYPE option<datetime>;
DEFINE FIELD annotation_count ON code_components TYPE number DEFAULT 0;

-- Timestamps
DEFINE FIELD created_at ON code_components TYPE datetime;
DEFINE FIELD updated_at ON code_components TYPE datetime;

-- Indexes
DEFINE INDEX component_id_idx ON code_components FIELDS component_id UNIQUE;
DEFINE INDEX session_id_idx ON code_components FIELDS session_id;
DEFINE INDEX file_path_idx ON code_components FIELDS file_path;
DEFINE INDEX name_idx ON code_components FIELDS name;
DEFINE INDEX component_type_idx ON code_components FIELDS component_type;
```

### component_annotations

**Purpose:** Store design decisions, rationale, and resolved challenges.

```sql
DEFINE TABLE component_annotations SCHEMAFULL;

-- Identity
DEFINE FIELD annotation_id ON component_annotations TYPE string;
DEFINE FIELD component_id ON component_annotations TYPE string;
DEFINE FIELD session_id ON component_annotations TYPE string;
DEFINE FIELD project_id ON component_annotations TYPE option<string>;

-- Annotation content
DEFINE FIELD content ON component_annotations TYPE string;
  -- Markdown-formatted explanation
DEFINE FIELD annotation_type ON component_annotations TYPE string;
  -- VALUES: "design_decision", "resolved_challenge", "implementation_note", "warning"

-- Linkage
DEFINE FIELD related_problem_id ON component_annotations TYPE option<string>;
  -- Link to problem that prompted this annotation

-- Metadata
DEFINE FIELD created_by ON component_annotations TYPE string;
  -- session_id or user identifier
DEFINE FIELD tags ON component_annotations TYPE array<string> DEFAULT [];
  -- Searchable tags (e.g., ["auth", "performance"])

-- Timestamps
DEFINE FIELD created_at ON component_annotations TYPE datetime;
DEFINE FIELD updated_at ON component_annotations TYPE datetime;

-- Indexes
DEFINE INDEX annotation_id_idx ON component_annotations FIELDS annotation_id UNIQUE;
DEFINE INDEX component_id_idx ON component_annotations FIELDS component_id;
DEFINE INDEX project_id_idx ON component_annotations FIELDS project_id;
DEFINE INDEX annotation_type_idx ON component_annotations FIELDS annotation_type;
DEFINE INDEX tags_idx ON component_annotations FIELDS tags;
```

### impact_relations

**Purpose:** Store CPG edges (component dependencies) for persistent queries.

```sql
DEFINE TABLE impact_relations SCHEMAFULL;

-- Identity
DEFINE FIELD relation_id ON impact_relations TYPE string;
DEFINE FIELD session_id ON impact_relations TYPE string;
DEFINE FIELD project_id ON impact_relations TYPE option<string>;

-- Relationship
DEFINE FIELD from_component_id ON impact_relations TYPE string;
DEFINE FIELD to_component_id ON impact_relations TYPE string;
DEFINE FIELD relationship_type ON impact_relations TYPE string;
  -- VALUES: "calls", "imports", "inherits", "data_flow", "contains"

-- Metadata (flexible)
DEFINE FIELD metadata ON impact_relations TYPE option<object>;
  -- Example: { line_number: 42, async: true }

-- Timestamps
DEFINE FIELD created_at ON impact_relations TYPE datetime;

-- Indexes
DEFINE INDEX from_component_idx ON impact_relations FIELDS from_component_id;
DEFINE INDEX to_component_idx ON impact_relations FIELDS to_component_id;
DEFINE INDEX relationship_type_idx ON impact_relations FIELDS relationship_type;
DEFINE INDEX project_id_idx ON impact_relations FIELDS project_id;

-- Composite index for traversal queries
DEFINE INDEX from_type_idx ON impact_relations FIELDS from_component_id, relationship_type;
DEFINE INDEX to_type_idx ON impact_relations FIELDS to_component_id, relationship_type;
```

### cochange_patterns

**Purpose:** Store historical co-change patterns for prediction.

```sql
DEFINE TABLE cochange_patterns SCHEMAFULL;

-- Identity
DEFINE FIELD pattern_id ON cochange_patterns TYPE string;
DEFINE FIELD project_id ON cochange_patterns TYPE string;
  -- Co-change patterns are project-specific

-- Pattern
DEFINE FIELD file_pairs ON cochange_patterns TYPE array<string>;
  -- Sorted array of file paths (e.g., ["auth/login.ts", "auth/session.ts"])
DEFINE FIELD frequency ON cochange_patterns TYPE number DEFAULT 1;
  -- How many times these files changed together

-- Recency (for decay)
DEFINE FIELD last_cochange_at ON cochange_patterns TYPE datetime;
DEFINE FIELD first_cochange_at ON cochange_patterns TYPE datetime;

-- Confidence metrics
DEFINE FIELD confidence ON cochange_patterns TYPE number;
  -- 0-1, based on frequency and recency

-- Metadata
DEFINE FIELD commit_hashes ON cochange_patterns TYPE array<string>;
  -- Sample commits where this pattern occurred

-- Timestamps
DEFINE FIELD created_at ON cochange_patterns TYPE datetime;
DEFINE FIELD updated_at ON cochange_patterns TYPE datetime;

-- Indexes
DEFINE INDEX pattern_id_idx ON cochange_patterns FIELDS pattern_id UNIQUE;
DEFINE INDEX project_id_idx ON cochange_patterns FIELDS project_id;
DEFINE INDEX frequency_idx ON cochange_patterns FIELDS frequency;

-- NOTE: file_pairs searching requires application-level logic (array containment)
```

### design_patterns

**Purpose:** Store detected/documented design patterns in the codebase.

```sql
DEFINE TABLE design_patterns SCHEMAFULL;

-- Identity
DEFINE FIELD pattern_id ON design_patterns TYPE string;
DEFINE FIELD project_id ON design_patterns TYPE string;

-- Pattern details
DEFINE FIELD pattern_name ON design_patterns TYPE string;
  -- E.g., "Singleton", "Factory", "Middleware Chain"
DEFINE FIELD pattern_type ON design_patterns TYPE string;
  -- VALUES: "creational", "structural", "behavioral", "architectural"

-- Instances
DEFINE FIELD example_components ON design_patterns TYPE array<string>;
  -- Component IDs that implement this pattern
DEFINE FIELD usage_count ON design_patterns TYPE number DEFAULT 1;

-- Documentation
DEFINE FIELD description ON design_patterns TYPE option<string>;
DEFINE FIELD recommendation ON design_patterns TYPE option<string>;
  -- When/how to use this pattern

-- Timestamps
DEFINE FIELD created_at ON design_patterns TYPE datetime;
DEFINE FIELD updated_at ON design_patterns TYPE datetime;

-- Indexes
DEFINE INDEX pattern_id_idx ON design_patterns FIELDS pattern_id UNIQUE;
DEFINE INDEX project_id_idx ON design_patterns FIELDS project_id;
DEFINE INDEX pattern_name_idx ON design_patterns FIELDS pattern_name;
```

---

## Graph Relationships

SurrealDB supports graph relations. Define explicit edges for key relationships.

### Problem → Annotation

```sql
DEFINE TABLE documented_by SCHEMAFULL TYPE RELATION
  FROM analysis_problems
  TO component_annotations;

DEFINE FIELD created_at ON documented_by TYPE datetime;
```

### Component → Annotation

```sql
DEFINE TABLE annotated_with SCHEMAFULL TYPE RELATION
  FROM code_components
  TO component_annotations;

DEFINE FIELD created_at ON annotated_with TYPE datetime;
```

### Component → Component (Impact)

```sql
-- Alternative to impact_relations table: use graph edges
DEFINE TABLE depends_on SCHEMAFULL TYPE RELATION
  FROM code_components
  TO code_components;

DEFINE FIELD relationship_type ON depends_on TYPE string;
  -- Same values as impact_relations
DEFINE FIELD metadata ON depends_on TYPE option<object>;
DEFINE FIELD created_at ON depends_on TYPE datetime;
```

**Note:** We may use either `impact_relations` table OR `depends_on` graph edges. Graph edges are more idiomatic for SurrealDB but require different query syntax. Decision: **Start with impact_relations table for simpler queries, migrate to graph edges if performance requires**.

---

## Sample Queries

### Get priority issues for a project

```sql
SELECT *,
  (SELECT COUNT() FROM code_components WHERE component_id IN $parent.component_id) AS affected_count
FROM analysis_problems
WHERE project_id = $project_id
AND status = "open"
ORDER BY severity DESC, impact_score DESC
LIMIT 10;
```

### Search issues with annotations

```sql
SELECT *,
  (SELECT * FROM component_annotations WHERE component_id = $parent.component_id) AS annotations
FROM analysis_problems
WHERE project_id = $project_id
AND status = "open"
AND summary ~ $search_query; -- Full-text search (SurrealDB 3.x feature)
```

### Get component with all annotations

```sql
SELECT *,
  ->annotated_with->component_annotations AS annotations
FROM code_components
WHERE component_id = $component_id;
```

### Find components that depend on a given component

```sql
SELECT from_component_id, relationship_type
FROM impact_relations
WHERE to_component_id = $component_id
AND relationship_type IN ["calls", "imports"];
```

### Get co-change patterns for a file

```sql
SELECT *
FROM cochange_patterns
WHERE project_id = $project_id
AND file_pairs CONTAINS $file_path
ORDER BY confidence DESC, frequency DESC
LIMIT 10;
```

---

## Migration Strategy

### Phase 1: Initial Schema

Create all tables with SCHEMAFULL enforcement.

```sql
-- Run in sequence
SOURCE 001-organizations.surql;  -- Shared (if not exists)
SOURCE 002-projects.surql;        -- Shared (if not exists)
SOURCE 003-sessions.surql;        -- Shared (if not exists)
SOURCE 004-analysis-jobs.surql;
SOURCE 005-analysis-problems.surql;
SOURCE 006-code-components.surql;
SOURCE 007-component-annotations.surql;
SOURCE 008-impact-relations.surql;
SOURCE 009-cochange-patterns.surql;
SOURCE 010-design-patterns.surql;
SOURCE 011-graph-relations.surql;
```

### Phase 2: Data Migration (if needed)

If migrating from Redis:

```typescript
// Pseudo-code
const redisProblems = await redis.hgetall('sessions:problems:*');
for (const [key, value] of Object.entries(redisProblems)) {
  const problem = JSON.parse(value);
  await surreal.create('analysis_problems', {
    problem_id: problem.id,
    // ... map fields
  });
}
```

### Phase 3: Optimize

Add indexes based on actual query patterns:

```sql
-- Example: If we frequently query by (project_id, status, severity)
DEFINE INDEX project_status_severity_idx ON analysis_problems
  FIELDS project_id, status, severity;
```

---

## Data Retention

### Cleanup Policies

```sql
-- Delete old resolved problems (after 90 days)
DELETE FROM analysis_problems
WHERE status = "resolved"
AND resolved_at < (time::now() - 90d);

-- Delete orphaned components (session expired)
DELETE FROM code_components
WHERE session_id NOT IN (SELECT session_id FROM sessions WHERE expired_at IS NULL);

-- Archive old co-change patterns (low frequency, old)
DELETE FROM cochange_patterns
WHERE frequency < 3
AND last_cochange_at < (time::now() - 180d);
```

### Archival

For long-term storage:

```sql
-- Export to JSON for archival
SELECT * FROM analysis_problems
WHERE created_at < (time::now() - 1y)
INTO FILE '/archive/problems-2025.json';
```

---

## Performance Considerations

### Indexing Strategy

- **Unique indexes** on all ID fields (fast lookups)
- **Composite indexes** for common filter combinations
- **Selective indexes** on high-cardinality fields (avoid low-cardinality like status)

### Denormalization

Some fields are denormalized for performance:
- `impact_score` in `analysis_problems` (computed from CPG, cached)
- `annotation_count` in `code_components` (avoid COUNT query)
- `affected_components_count` in `analysis_problems`

Update these fields via triggers or application logic when dependent data changes.

### Query Optimization

Use SurrealDB's `EXPLAIN` to analyze query performance:

```sql
EXPLAIN SELECT * FROM analysis_problems WHERE project_id = $id AND status = "open";
```

---

## Next Steps

With schemas defined, we can now specify:
1. **API Implementation** - How endpoints query these tables
2. **MCP Implementation** - How tools format responses from API
3. **Integration Tests** - Seed data and query validation
