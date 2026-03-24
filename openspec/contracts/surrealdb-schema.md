# SurrealDB Schema Contract

**Contract ID:** `surrealdb-schema`
**Version:** 1.0.0
**Owner:** Contract Agent (Database Schema)
**Status:** Draft

---

## Purpose

Defines the shared database schema used by all analysis and activity components in the `activity_system.learning_loop` namespace.

## Ontological Context

This schema stores data across all three ontological states:

**Instructional State (Vessel):**
- `activity_templates` table: Stores templates (instructions for what CAN happen)
- Templates are static, versionable blueprints that spawn executions

**Functional State (Instance):**
- `execution_traces` table: Completed executions with state snapshots
- `analysis_problems` table: Detected issues in actual code
- `code_components` table: Parsed components from real codebases
- Instances represent realized outcomes at specific points in time

**Learning from Becoming (Process):**
- `composition_edges` table: Captures relationships between executions
- `cochange_patterns` table: Historical patterns from transformation sequences
- `impact_relations` table: Dependencies discovered during execution
- These tables store patterns extracted from the continuous transformation itself

**Key Insight:** The becoming (process-of-becoming) happens BETWEEN vessel and instance. While we cannot store the transformation itself, we capture its traces and patterns to inform future executions through Thompson Sampling and learning loops.

## Domain Mapping

These schemas serve all system domains, with the same structure used differently per domain:

**Software Development Domain:**
- `execution_traces`: Activity executions (file edits, git commits)
- `code_components`: Functions, classes being modified
- Example: Storing traces of MiniBob self-improvement activities

**Analysis & Understanding Domain:**
- `analysis_problems`: Issues detected via CPG analysis
- `component_annotations`: Design decisions and rationale
- `design_patterns`: Architectural patterns identified
- Example: Static analysis results, co-change predictions

**Deployment & Infrastructure Domain:**
- `execution_traces`: Helm deployments, Kubernetes operations
- Example: Infrastructure-as-code deployments tracked

**Learning & Optimization Domain:**
- `composition_edges`: Activity composition graph
- Thompson Sampling metrics aggregated from traces
- Example: Learning which templates perform best

**Meta-work & Validation Domain:**
- `execution_traces`: Test executions, validation runs
- Example: E2E test results, contract validations

**Key Insight:** Same schema, different semantic meaning based on domain context.

## Namespace and Database

```sql
USE NS activity_system;
USE DB learning_loop;
```

**Critical:** All components MUST use this namespace. Do not create separate databases.

---

## Shared Tables

### Organizations, Projects, Sessions

**Owner:** metabob-activity-api (existing)

```sql
-- Reused from existing activity system
DEFINE TABLE organizations SCHEMAFULL;
DEFINE TABLE projects SCHEMAFULL;
DEFINE TABLE sessions SCHEMAFULL;
```

**Contract:** Analysis components MUST NOT modify these tables. Read-only access via foreign keys.

---

## Analysis Tables

### analysis_problems

**Owner:** metabob-analysis-api

```sql
DEFINE TABLE analysis_problems SCHEMAFULL;

DEFINE FIELD problem_id ON analysis_problems TYPE string;
DEFINE FIELD session_id ON analysis_problems TYPE string;
DEFINE FIELD project_id ON analysis_problems TYPE option<string>;
DEFINE FIELD org_id ON analysis_problems TYPE option<string>;

DEFINE FIELD file_path ON analysis_problems TYPE string;
DEFINE FIELD component_id ON analysis_problems TYPE option<string>;
DEFINE FIELD category ON analysis_problems TYPE string;
DEFINE FIELD severity ON analysis_problems TYPE string;
DEFINE FIELD summary ON analysis_problems TYPE string;
DEFINE FIELD description ON analysis_problems TYPE option<string>;

DEFINE FIELD impact_score ON analysis_problems TYPE option<number>;
DEFINE FIELD affected_components ON analysis_problems TYPE option<number>;

DEFINE FIELD status ON analysis_problems TYPE string DEFAULT "open";
DEFINE FIELD resolved_at ON analysis_problems TYPE option<datetime>;
DEFINE FIELD resolution_summary ON analysis_problems TYPE option<string>;
DEFINE FIELD fixed_in_commit ON analysis_problems TYPE option<string>;

DEFINE FIELD created_at ON analysis_problems TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON analysis_problems TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_session ON analysis_problems FIELDS session_id;
DEFINE INDEX idx_status ON analysis_problems FIELDS status;
DEFINE INDEX idx_severity ON analysis_problems FIELDS severity;
```

**Consumers:**
- metabob-analysis-api (CRUD)
- metabob-cloud-dashboard (READ)
- metabob-mcp (READ via API)

---

### code_components

**Owner:** metabob-analysis-api

```sql
DEFINE TABLE code_components SCHEMAFULL;

DEFINE FIELD component_id ON code_components TYPE string;
DEFINE FIELD session_id ON code_components TYPE string;
DEFINE FIELD file_path ON code_components TYPE string;
DEFINE FIELD component_type ON code_components TYPE string;
DEFINE FIELD name ON code_components TYPE string;

DEFINE FIELD start_line ON code_components TYPE number;
DEFINE FIELD end_line ON code_components TYPE number;

DEFINE FIELD embedding ON code_components TYPE option<array<number>>;
DEFINE FIELD embedding_version ON code_components TYPE option<string>;

DEFINE FIELD metadata ON code_components TYPE option<object>;
DEFINE FIELD last_annotated_at ON code_components TYPE option<datetime>;

DEFINE FIELD created_at ON code_components TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON code_components TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_session ON code_components FIELDS session_id;
DEFINE INDEX idx_file ON code_components FIELDS file_path;
DEFINE INDEX idx_component_id ON code_components FIELDS component_id UNIQUE;
```

**Consumers:**
- metabob-analysis-api (CRUD)
- metabob-cloud-dashboard (READ)

---

### component_annotations

**Owner:** metabob-analysis-api

```sql
DEFINE TABLE component_annotations SCHEMAFULL;

DEFINE FIELD annotation_id ON component_annotations TYPE string;
DEFINE FIELD component_id ON component_annotations TYPE string;
DEFINE FIELD session_id ON component_annotations TYPE string;

DEFINE FIELD content ON component_annotations TYPE string;
DEFINE FIELD annotation_type ON component_annotations TYPE string;
DEFINE FIELD tags ON component_annotations TYPE option<array<string>>;

DEFINE FIELD related_problem_id ON component_annotations TYPE option<string>;

DEFINE FIELD created_at ON component_annotations TYPE datetime DEFAULT time::now();
DEFINE FIELD created_by ON component_annotations TYPE string;

DEFINE INDEX idx_component ON component_annotations FIELDS component_id;
DEFINE INDEX idx_session ON component_annotations FIELDS session_id;
DEFINE INDEX idx_type ON component_annotations FIELDS annotation_type;
```

**Consumers:**
- metabob-analysis-api (CRUD)
- metabob-cloud-dashboard (READ)
- metabob-mcp (CREATE via API)

---

### cochange_patterns

**Owner:** metabob-analysis-api

```sql
DEFINE TABLE cochange_patterns SCHEMAFULL;

DEFINE FIELD pattern_id ON cochange_patterns TYPE string;
DEFINE FIELD project_id ON cochange_patterns TYPE string;

DEFINE FIELD file_pairs ON cochange_patterns TYPE array<string>;
DEFINE FIELD frequency ON cochange_patterns TYPE number DEFAULT 1;
DEFINE FIELD total_commits ON cochange_patterns TYPE number DEFAULT 1;
DEFINE FIELD confidence ON cochange_patterns TYPE number DEFAULT 0.5;

DEFINE FIELD first_seen ON cochange_patterns TYPE datetime;
DEFINE FIELD last_seen ON cochange_patterns TYPE datetime;
DEFINE FIELD updated_at ON cochange_patterns TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_project ON cochange_patterns FIELDS project_id;
```

**Consumers:**
- metabob-analysis-api (CRUD)
- metabob-cloud-dashboard (READ)

---

### impact_relations

**Owner:** metabob-analysis-api

```sql
DEFINE TABLE impact_relations SCHEMAFULL;

DEFINE FIELD from_component ON impact_relations TYPE string;
DEFINE FIELD to_component ON impact_relations TYPE string;
DEFINE FIELD relationship_type ON impact_relations TYPE string;
DEFINE FIELD session_id ON impact_relations TYPE string;

DEFINE FIELD metadata ON impact_relations TYPE option<object>;
DEFINE FIELD created_at ON impact_relations TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_from ON impact_relations FIELDS from_component;
DEFINE INDEX idx_to ON impact_relations FIELDS to_component;
DEFINE INDEX idx_session ON impact_relations FIELDS session_id;
```

**Consumers:**
- metabob-analysis-api (CRUD)
- metabob-cloud-dashboard (READ)

---

### design_patterns

**Owner:** metabob-analysis-api

```sql
DEFINE TABLE design_patterns SCHEMAFULL;

DEFINE FIELD pattern_id ON design_patterns TYPE string;
DEFINE FIELD session_id ON design_patterns TYPE string;
DEFINE FIELD pattern_name ON design_patterns TYPE string;

DEFINE FIELD component_id ON design_patterns TYPE string;
DEFINE FIELD file_path ON design_patterns TYPE string;

DEFINE FIELD metadata ON design_patterns TYPE option<object>;
DEFINE FIELD created_at ON design_patterns TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_session ON design_patterns FIELDS session_id;
DEFINE INDEX idx_pattern_name ON design_patterns FIELDS pattern_name;
```

**Consumers:**
- metabob-analysis-api (CRUD)
- metabob-cloud-dashboard (READ)

---

## Graph Relations

```sql
-- Problem documented by annotation
DEFINE TABLE documented_by SCHEMAFULL TYPE RELATION
  FROM analysis_problems TO component_annotations;

-- Component depends on component (CPG edges)
DEFINE TABLE depends_on SCHEMAFULL TYPE RELATION
  FROM code_components TO code_components;

DEFINE FIELD relationship_type ON depends_on TYPE string;
DEFINE FIELD metadata ON depends_on TYPE option<object>;
```

---

## Migration Strategy

### Version 1.0.0 (Initial)

**Actions Required:**
1. Apply schema to existing SurrealDB cluster
2. Verify namespace `activity_system` exists
3. Verify database `learning_loop` exists
4. Create all tables in single transaction

**SQL File:** `openspec/contracts/sql/001-analysis-schema.surql`

---

## Breaking Change Policy

**Major Version Bumps (X.0.0):**
- Table renames
- Field type changes
- Field deletions

**Minor Version Bumps (1.X.0):**
- New tables
- New fields (with defaults)
- New indexes

**Patch Version Bumps (1.0.X):**
- Index optimizations
- Documentation updates

**When Breaking Change Occurs:**
1. Contract agent creates migration guide
2. All consuming repos notified
3. Migration tasks created in dependent repos
4. Version updated in manifest.yaml

---

## Dependents

This contract is consumed by:

- **metabob-analysis-api** (repos/metabob-analysis-api/openspec/manifest.yaml)
- **metabob-activity-api** (repos/metabob-activity-api/openspec/manifest.yaml)
- **metabob-cloud-dashboard** (repos/metabob-cloud-dashboard/openspec/manifest.yaml)

**Change Notification Required:** YES

---

## Validation

```bash
# Verify schema applied correctly
surreal sql --endpoint http://surrealdb.activity-system.svc.cluster.local:8000 \
  --namespace activity_system --database learning_loop \
  --username root --password $SURREAL_PASS \
  -c "INFO FOR DB;"

# Expected output: All tables listed above
```

---

## Contact

**Contract Owner:** Database Schema Agent
**Repo:** N/A (shared contract)
**Updates:** openspec/contracts/surrealdb-schema.md
