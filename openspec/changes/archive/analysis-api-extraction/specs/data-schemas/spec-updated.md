# SurrealDB Schema Specification (Updated)

**Component:** metabob-analysis-api data layer
**Database:** SurrealDB 3.x
**Purpose:** Define persistent storage for analysis results, components, auth, and learning data

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

## Table Ownership

**metabob-analysis-api owns:**
- users
- api_keys
- organizations
- projects
- analysis_jobs
- analysis_problems
- code_components
- component_annotations
- impact_relations
- cochange_patterns

**metabob-activity-api owns (not redefined here):**
- sessions
- activity_templates
- activity_executions
- impulses
- activity_composition
- code_variants

Both APIs share the same SurrealDB namespace/database.

---

## Core Tables (Auth & Org Management)

### users

**Purpose:** Store user accounts. One user = one API key (1:1 relationship).

```sql
DEFINE TABLE users SCHEMAFULL;

-- Identity
DEFINE FIELD user_id ON users TYPE string;
  -- UUID, primary key
DEFINE FIELD username ON users TYPE string;
  -- Unique username, also used as API key name (1:1)
DEFINE FIELD email ON users TYPE string;
  -- Unique email for login
DEFINE FIELD password_hash ON users TYPE string;
  -- bcrypt hash

-- Organization
DEFINE FIELD org_id ON users TYPE string;
  -- Organization this user belongs to

-- Status
DEFINE FIELD status ON users TYPE string DEFAULT "active";
  -- VALUES: "active", "inactive", "suspended"

-- Timestamps
DEFINE FIELD created_at ON users TYPE datetime;
DEFINE FIELD updated_at ON users TYPE datetime;
DEFINE FIELD last_login_at ON users TYPE option<datetime>;

-- Indexes
DEFINE INDEX user_id_idx ON users FIELDS user_id UNIQUE;
DEFINE INDEX username_idx ON users FIELDS username UNIQUE;
DEFINE INDEX email_idx ON users FIELDS email UNIQUE;
DEFINE INDEX org_id_idx ON users FIELDS org_id;
```

### api_keys

**Purpose:** API keys for programmatic access. 1:1 with users (key_id = user_id).

```sql
DEFINE TABLE api_keys SCHEMAFULL;

-- Identity (1:1 with users)
DEFINE FIELD key_id ON api_keys TYPE string;
  -- Same as user.user_id (1:1 relationship)
DEFINE FIELD username ON api_keys TYPE string;
  -- Same as user.username (for display)
DEFINE FIELD org_id ON api_keys TYPE string;

-- Key data
DEFINE FIELD key_hash ON api_keys TYPE string;
  -- Hash of the full API key (never store plaintext)
DEFINE FIELD key_prefix ON api_keys TYPE string;
  -- First 8 chars for display (e.g., "sk-ant-")

-- Permissions
DEFINE FIELD permissions ON api_keys TYPE array<object>;
  -- Array of { resource: string, actions: string[] }
  -- Example: [{ resource: "projects", actions: ["read", "write"] }]

-- Usage tracking
DEFINE FIELD usage_count ON api_keys TYPE number DEFAULT 0;
DEFINE FIELD total_cost ON api_keys TYPE number DEFAULT 0.0;
  -- Total USD spent by this key
DEFINE FIELD last_used_at ON api_keys TYPE option<datetime>;

-- Status
DEFINE FIELD status ON api_keys TYPE string DEFAULT "active";
  -- VALUES: "active", "revoked"

-- Timestamps
DEFINE FIELD created_at ON api_keys TYPE datetime;
DEFINE FIELD updated_at ON api_keys TYPE datetime;

-- Indexes
DEFINE INDEX key_id_idx ON api_keys FIELDS key_id UNIQUE;
DEFINE INDEX key_hash_idx ON api_keys FIELDS key_hash UNIQUE;
DEFINE INDEX org_id_idx ON api_keys FIELDS org_id;
DEFINE INDEX username_idx ON api_keys FIELDS username;
```

### organizations

**Purpose:** Top-level tenant. Every org has a default project.

```sql
DEFINE TABLE organizations SCHEMAFULL;

-- Identity
DEFINE FIELD org_id ON organizations TYPE string;
  -- UUID, primary key
DEFINE FIELD name ON organizations TYPE string;
  -- Organization name

-- Default project (always exists)
DEFINE FIELD default_project_id ON organizations TYPE string;
  -- UUID of the default project (auto-created on org creation)

-- Settings
DEFINE FIELD settings ON organizations TYPE object;
  -- Flexible JSON object for org-wide settings
  -- Example: {
  --   cross_project_learning: false,
  --   max_api_keys: 10,
  --   max_projects: 50,
  --   retention_days: 90
  -- }

-- Timestamps
DEFINE FIELD created_at ON organizations TYPE datetime;
DEFINE FIELD updated_at ON organizations TYPE datetime;

-- Indexes
DEFINE INDEX org_id_idx ON organizations FIELDS org_id UNIQUE;
DEFINE INDEX name_idx ON organizations FIELDS name;
```

### projects

**Purpose:** Isolate code/analysis by repository. Every org has one default project.

```sql
DEFINE TABLE projects SCHEMAFULL;

-- Identity
DEFINE FIELD project_id ON projects TYPE string;
  -- UUID, primary key
DEFINE FIELD org_id ON projects TYPE string;
DEFINE FIELD name ON projects TYPE string;

-- Repository info
DEFINE FIELD repository_url ON projects TYPE option<string>;
  -- Git repository URL
DEFINE FIELD branch ON projects TYPE option<string>;
  -- Default branch (e.g., "main")
DEFINE FIELD git_root_hash ON projects TYPE option<string>;
  -- Unique identifier from git (commit hash or similar)

-- Default project flag
DEFINE FIELD is_default ON projects TYPE bool DEFAULT false;
  -- True for org's default project (one per org)

-- Settings
DEFINE FIELD settings ON projects TYPE object DEFAULT {};
  -- Project-specific settings
  -- Example: {
  --   auto_analyze: true,
  --   analysis_triggers: ["commit", "pr"]
  -- }

-- Statistics (denormalized for dashboard)
DEFINE FIELD stats ON projects TYPE object DEFAULT {};
  -- Example: {
  --   total_issues: 0,
  --   critical_issues: 0,
  --   files_analyzed: 0,
  --   components_extracted: 0,
  --   last_analysis: null
  -- }

-- Sync progress (from metabob-mcp)
DEFINE FIELD sync_status ON projects TYPE object DEFAULT {};
  -- Example: {
  --   files_indexed: 1234,
  --   components_found: 5678,
  --   embeddings_generated: 4321,
  --   last_sync_at: "2026-03-23T10:30:00Z"
  -- }

-- Timestamps
DEFINE FIELD created_at ON projects TYPE datetime;
DEFINE FIELD updated_at ON projects TYPE datetime;

-- Indexes
DEFINE INDEX project_id_idx ON projects FIELDS project_id UNIQUE;
DEFINE INDEX org_id_idx ON projects FIELDS org_id;
DEFINE INDEX is_default_idx ON projects FIELDS org_id, is_default;
  -- Ensure only one default project per org
```

---

## Analysis Tables

### analysis_jobs

**Purpose:** Track analysis job execution (from CLI or automated triggers).

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
  -- 0-100 percentage (deprecated - not meaningful for continuous sync)

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
  -- Format: "file.ts::ComponentName"

DEFINE FIELD category ON analysis_problems TYPE string;
  -- VALUES: "bug", "security", "performance", "maintainability", "style"
DEFINE FIELD severity ON analysis_problems TYPE string;
  -- VALUES: "critical", "high", "medium", "low"

DEFINE FIELD summary ON analysis_problems TYPE string;
DEFINE FIELD description ON analysis_problems TYPE string;

-- Location
DEFINE FIELD start_line ON analysis_problems TYPE number;
DEFINE FIELD end_line ON analysis_problems TYPE number;
DEFINE FIELD code_snippet ON analysis_problems TYPE option<string>;

-- Status
DEFINE FIELD status ON analysis_problems TYPE string DEFAULT "open";
  -- VALUES: "open", "resolved", "ignored"
DEFINE FIELD resolved_at ON analysis_problems TYPE option<datetime>;
DEFINE FIELD resolution_summary ON analysis_problems TYPE option<string>;
DEFINE FIELD fixed_in_commit ON analysis_problems TYPE option<string>;

-- Impact (from CPG analysis)
DEFINE FIELD impact_score ON analysis_problems TYPE option<number>;
  -- 0-100, computed from CPG graph traversal
DEFINE FIELD affected_components_count ON analysis_problems TYPE option<number>;

-- Timestamps
DEFINE FIELD created_at ON analysis_problems TYPE datetime;
DEFINE FIELD updated_at ON analysis_problems TYPE datetime;

-- Indexes
DEFINE INDEX problem_id_idx ON analysis_problems FIELDS problem_id UNIQUE;
DEFINE INDEX session_id_idx ON analysis_problems FIELDS session_id;
DEFINE INDEX project_id_idx ON analysis_problems FIELDS project_id;
DEFINE INDEX status_idx ON analysis_problems FIELDS status;
DEFINE INDEX category_severity_idx ON analysis_problems FIELDS category, severity;
DEFINE INDEX file_path_idx ON analysis_problems FIELDS file_path;
DEFINE INDEX component_id_idx ON analysis_problems FIELDS component_id;
```

### code_components

**Purpose:** Store extracted code components from CPG. Built by metabob-mcp.

```sql
DEFINE TABLE code_components SCHEMAFULL;

-- Identity
DEFINE FIELD component_id ON code_components TYPE string;
  -- Format: "project_id:file.ts::ComponentName"
DEFINE FIELD session_id ON code_components TYPE string;
DEFINE FIELD project_id ON code_components TYPE option<string>;

-- Component details
DEFINE FIELD file_path ON code_components TYPE string;
DEFINE FIELD component_type ON code_components TYPE string;
  -- VALUES: "function", "class", "method", "variable", "import", "module"
DEFINE FIELD name ON code_components TYPE string;

-- Location
DEFINE FIELD start_line ON code_components TYPE number;
DEFINE FIELD end_line ON code_components TYPE number;

-- Metadata (flexible)
DEFINE FIELD metadata ON code_components TYPE option<object>;
  -- Example: { params: ["user", "options"], returnType: "Promise<User>", complexity: 5 }

-- Embeddings (for semantic search)
DEFINE FIELD embedding ON code_components TYPE option<array<number>>;
  -- Vector from ONNX model (e.g., 384-dim)
DEFINE FIELD embedding_version ON code_components TYPE option<string>;
  -- Track model version for re-embedding

-- Annotations
DEFINE FIELD annotation_count ON code_components TYPE number DEFAULT 0;
DEFINE FIELD last_annotated_at ON code_components TYPE option<datetime>;

-- Git tracking
DEFINE FIELD git_commit_hash ON code_components TYPE option<string>;
  -- Last commit that modified this component

-- Timestamps
DEFINE FIELD created_at ON code_components TYPE datetime;
DEFINE FIELD updated_at ON code_components TYPE datetime;

-- Indexes
DEFINE INDEX component_id_idx ON code_components FIELDS component_id UNIQUE;
DEFINE INDEX session_id_idx ON code_components FIELDS session_id;
DEFINE INDEX project_id_idx ON code_components FIELDS project_id;
DEFINE INDEX file_path_idx ON code_components FIELDS file_path;
DEFINE INDEX name_idx ON code_components FIELDS name;
DEFINE INDEX component_type_idx ON code_components FIELDS component_type;
```

### component_annotations

**Purpose:** Store design decisions, rationale, and resolved challenges.
This is the knowledge graph - annotations accumulate over time across projects.

```sql
DEFINE TABLE component_annotations SCHEMAFULL;

-- Identity
DEFINE FIELD annotation_id ON component_annotations TYPE string;
DEFINE FIELD component_id ON component_annotations TYPE string;
DEFINE FIELD session_id ON component_annotations TYPE string;
DEFINE FIELD project_id ON component_annotations TYPE option<string>;
DEFINE FIELD org_id ON component_annotations TYPE option<string>;

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
  -- Username or session_id
DEFINE FIELD tags ON component_annotations TYPE array<string> DEFAULT [];
  -- Searchable tags (e.g., ["auth", "performance"])

-- Timestamps
DEFINE FIELD created_at ON component_annotations TYPE datetime;
DEFINE FIELD updated_at ON component_annotations TYPE datetime;

-- Indexes
DEFINE INDEX annotation_id_idx ON component_annotations FIELDS annotation_id UNIQUE;
DEFINE INDEX component_id_idx ON component_annotations FIELDS component_id;
DEFINE INDEX project_id_idx ON component_annotations FIELDS project_id;
DEFINE INDEX org_id_idx ON component_annotations FIELDS org_id;
DEFINE INDEX annotation_type_idx ON component_annotations FIELDS annotation_type;
DEFINE INDEX tags_idx ON component_annotations FIELDS tags;
```

### impact_relations

**Purpose:** Store CPG edges (component dependencies) for impact analysis.

```sql
DEFINE TABLE impact_relations SCHEMAFULL;

-- Identity
DEFINE FIELD relation_id ON impact_relations TYPE string;
DEFINE FIELD session_id ON impact_relations TYPE string;
DEFINE FIELD project_id ON impact_relations TYPE string;

-- Relationship
DEFINE FIELD source_component_id ON impact_relations TYPE string;
  -- Component that depends on or calls target
DEFINE FIELD target_component_id ON impact_relations TYPE string;
  -- Component being depended on or called
DEFINE FIELD relation_type ON impact_relations TYPE string;
  -- VALUES: "calls", "imports", "extends", "implements", "data_flow"

-- Weight (for traversal)
DEFINE FIELD weight ON impact_relations TYPE number DEFAULT 1.0;
  -- Higher weight = stronger relationship

-- Timestamps
DEFINE FIELD created_at ON impact_relations TYPE datetime;
DEFINE FIELD updated_at ON impact_relations TYPE datetime;

-- Indexes
DEFINE INDEX relation_id_idx ON impact_relations FIELDS relation_id UNIQUE;
DEFINE INDEX source_idx ON impact_relations FIELDS source_component_id;
DEFINE INDEX target_idx ON impact_relations FIELDS target_component_id;
DEFINE INDEX project_id_idx ON impact_relations FIELDS project_id;
DEFINE INDEX relation_type_idx ON impact_relations FIELDS relation_type;
```

### cochange_patterns

**Purpose:** Track files that co-change (learned from git history).

```sql
DEFINE TABLE cochange_patterns SCHEMAFULL;

-- Identity
DEFINE FIELD pattern_id ON cochange_patterns TYPE string;
DEFINE FIELD project_id ON cochange_patterns TYPE string;

-- Co-change data
DEFINE FIELD file_a ON cochange_patterns TYPE string;
DEFINE FIELD file_b ON cochange_patterns TYPE string;
DEFINE FIELD cochange_count ON cochange_patterns TYPE number DEFAULT 1;
  -- How many times these files changed together
DEFINE FIELD confidence ON cochange_patterns TYPE number;
  -- 0.0 to 1.0, computed from cochange_count and total changes

-- Last observation
DEFINE FIELD last_commit_hash ON cochange_patterns TYPE option<string>;
DEFINE FIELD last_observed_at ON cochange_patterns TYPE datetime;

-- Timestamps
DEFINE FIELD created_at ON cochange_patterns TYPE datetime;
DEFINE FIELD updated_at ON cochange_patterns TYPE datetime;

-- Indexes
DEFINE INDEX pattern_id_idx ON cochange_patterns FIELDS pattern_id UNIQUE;
DEFINE INDEX project_id_idx ON cochange_patterns FIELDS project_id;
DEFINE INDEX file_a_idx ON cochange_patterns FIELDS file_a;
DEFINE INDEX file_b_idx ON cochange_patterns FIELDS file_b;
DEFINE INDEX confidence_idx ON cochange_patterns FIELDS confidence;
```

---

## Cross-Project Learning Query Pattern

When `organization.settings.cross_project_learning = true`:

```sql
-- Query annotations across all projects in org
SELECT * FROM component_annotations
WHERE org_id = $org_id
  AND tags ?@ $search_tags
ORDER BY created_at DESC;

-- Find similar components across org projects
SELECT * FROM code_components
WHERE project_id IN (
  SELECT project_id FROM projects WHERE org_id = $org_id
)
  AND name = $component_name
  OR similarity(embedding, $query_embedding) > 0.8;
```

When disabled (default):

```sql
-- Query annotations only in current project
SELECT * FROM component_annotations
WHERE project_id = $project_id
  AND tags ?@ $search_tags
ORDER BY created_at DESC;
```

---

## Data Lifecycle

### Organization Creation

```sql
-- 1. Create organization
INSERT INTO organizations {
  org_id: $org_id,
  name: $name,
  default_project_id: null,  -- Set after project creation
  settings: {
    cross_project_learning: false,
    max_api_keys: 10,
    max_projects: 50
  },
  created_at: time::now(),
  updated_at: time::now()
};

-- 2. Create default project
INSERT INTO projects {
  project_id: $default_project_id,
  org_id: $org_id,
  name: "Default",
  is_default: true,
  settings: {},
  stats: {},
  sync_status: {},
  created_at: time::now(),
  updated_at: time::now()
};

-- 3. Update org with default project
UPDATE organizations SET default_project_id = $default_project_id
WHERE org_id = $org_id;
```

### User/API Key Creation (1:1)

```sql
-- 1. Create user
INSERT INTO users {
  user_id: $user_id,
  username: $username,
  email: $email,
  password_hash: $hashed_password,
  org_id: $org_id,
  status: "active",
  created_at: time::now(),
  updated_at: time::now()
};

-- 2. Create API key (same ID)
INSERT INTO api_keys {
  key_id: $user_id,  -- Same as user_id (1:1)
  username: $username,
  org_id: $org_id,
  key_hash: $hashed_api_key,
  key_prefix: $key_prefix,
  permissions: $permissions,
  status: "active",
  created_at: time::now(),
  updated_at: time::now()
};
```

### Progressive Sync Updates (from metabob-mcp)

```sql
-- Update project sync status
UPDATE projects SET
  sync_status = {
    files_indexed: $files_count,
    components_found: $components_count,
    embeddings_generated: $embeddings_count,
    last_sync_at: time::now()
  },
  stats.components_extracted = $components_count,
  updated_at = time::now()
WHERE project_id = $project_id;
```

---

## Migration Notes

**From Python RPC API:**
- `analysis_jobs` replaces Redis job tracking
- `cochange_patterns` replaces in-memory co-change cache
- All data now survives restarts (persistent SurrealDB)

**Default Project Migration:**
- Existing orgs without default_project_id: Create default project automatically
- Set `is_default = true` on the first/oldest project per org

**Cross-Project Learning:**
- Defaults to `false` (project isolation)
- Orgs must explicitly opt-in via settings
