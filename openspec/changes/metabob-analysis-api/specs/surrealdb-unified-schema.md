# Unified SurrealDB Schema Specification

**Status:** Approved
**Created:** 2026-03-24
**Purpose:** Define shared SurrealDB schema for cross-system learning

---

## Overview

All services in the metabob-devbob stack share a **single SurrealDB instance** and **unified schema** to enable cross-system learning from activity composition graphs, runtime tracking, and impulse mapping.

### Services Using Shared SurrealDB

1. **minibob** - Activity execution and learning substrate
2. **metabob-activity-api** - Activity templates and Thompson Sampling
3. **metabob-analysis-api** - Code analysis and CPG operations
4. **metabob-mcp** - MCP tool usage tracking (via API)

---

## Connection Configuration

### SurrealDB Server

**Deployment:**
- Kubernetes StatefulSet in `activity-system` namespace
- Version: `3.0.0` (required for all clients)
- Service: `surrealdb.activity-system.svc.cluster.local:8000`

**Credentials:**
- Namespace: `activity-system`
- Database: `learning_loop`
- Auth: Username/password from Kubernetes secret

### Client Library

**Package:** `surrealdb@^2.0.3` (supports SurrealDB 3.x)

```typescript
import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect('http://surrealdb.activity-system.svc.cluster.local:8000');
await db.use({ namespace: 'activity-system', database: 'learning_loop' });
await db.signin({ username, password });
```

---

## Unified Schema Design

### Core Tables (Shared by All Services)

#### 1. `sessions`
Track analysis/activity sessions across all services.

```surql
DEFINE TABLE sessions SCHEMAFULL;
DEFINE FIELD session_id ON sessions TYPE string;
DEFINE FIELD project_id ON sessions TYPE string;
DEFINE FIELD org_id ON sessions TYPE string;
DEFINE FIELD created_at ON sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD last_active ON sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON sessions TYPE object;

DEFINE INDEX idx_session_id ON sessions FIELDS session_id UNIQUE;
```

#### 2. `activity_templates`
Shared activity definitions (created by activity-api, executed by minibob).

```surql
DEFINE TABLE activity_templates SCHEMAFULL;
DEFINE FIELD template_id ON activity_templates TYPE string;
DEFINE FIELD name ON activity_templates TYPE string;
DEFINE FIELD category ON activity_templates TYPE string;
DEFINE FIELD tasks ON activity_templates TYPE array;
DEFINE FIELD success_rate ON activity_templates TYPE number DEFAULT 0.0;
DEFINE FIELD total_executions ON activity_templates TYPE number DEFAULT 0;
DEFINE FIELD created_at ON activity_templates TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_template_id ON activity_templates FIELDS template_id UNIQUE;
DEFINE INDEX idx_category ON activity_templates FIELDS category;
```

#### 3. `activity_executions`
Runtime tracking of all activity executions (minibob records, all services query).

```surql
DEFINE TABLE activity_executions SCHEMAFULL;
DEFINE FIELD execution_id ON activity_executions TYPE string;
DEFINE FIELD template_id ON activity_executions TYPE string;
DEFINE FIELD session_id ON activity_executions TYPE string;
DEFINE FIELD status ON activity_executions TYPE string
  ASSERT $value IN ['pending', 'in_progress', 'completed', 'failed'];
DEFINE FIELD started_at ON activity_executions TYPE datetime DEFAULT time::now();
DEFINE FIELD completed_at ON activity_executions TYPE datetime;
DEFINE FIELD duration_ms ON activity_executions TYPE number;
DEFINE FIELD cost_usd ON activity_executions TYPE number;
DEFINE FIELD input_state ON activity_executions TYPE object;
DEFINE FIELD output_state ON activity_executions TYPE object;
DEFINE FIELD tool_calls ON activity_executions TYPE array;

DEFINE INDEX idx_execution_id ON activity_executions FIELDS execution_id UNIQUE;
DEFINE INDEX idx_template_session ON activity_executions FIELDS template_id, session_id;
```

#### 4. `impulses`
Unified impulse storage for context mapping (all services create/resolve).

```surql
DEFINE TABLE impulses SCHEMAFULL;
DEFINE FIELD impulse_id ON impulses TYPE string;
DEFINE FIELD type ON impulses TYPE string;
DEFINE FIELD pointer ON impulses TYPE object;
DEFINE FIELD budget ON impulses TYPE number;
DEFINE FIELD loaded ON impulses TYPE bool DEFAULT false;
DEFINE FIELD content ON impulses TYPE string FLEXIBLE;
DEFINE FIELD session_id ON impulses TYPE string;
DEFINE FIELD created_at ON impulses TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_impulse_id ON impulses FIELDS impulse_id UNIQUE;
DEFINE INDEX idx_session_type ON impulses FIELDS session_id, type;
```

#### 5. `composition_graph`
Activity composition tracking (which activities follow which).

```surql
DEFINE TABLE composition_graph SCHEMAFULL;
DEFINE FIELD from_template_id ON composition_graph TYPE string;
DEFINE FIELD to_template_id ON composition_graph TYPE string;
DEFINE FIELD frequency ON composition_graph TYPE number DEFAULT 1;
DEFINE FIELD success_rate ON composition_graph TYPE number DEFAULT 0.0;
DEFINE FIELD last_seen ON composition_graph TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_composition ON composition_graph FIELDS from_template_id, to_template_id UNIQUE;
```

---

### Service-Specific Tables

#### metabob-analysis-api Tables

**analysis_problems**, **code_components**, **component_annotations**, **cochange_patterns**, **cochange_events**

See: `openspec/changes/metabob-analysis-api/design.md` for detailed schemas.

#### metabob-activity-api Tables

**thompson_sampling_arms**, **goal_mappings**, **prerequisite_relations**, **tool_usage_patterns**

See: `repos/metabob-activity-api/sql/` for migration files.

---

## Learning Flows

### 1. Activity Composition Learning

```
User executes activity A → minibob
  ↓
minibob records execution → activity_executions
  ↓
minibob calls backend for next recommendation
  ↓
Backend suggests activity B → composition_graph
  ↓
minibob executes B → activity_executions
  ↓
Backend updates composition: A→B frequency++
```

### 2. Impulse Mapping Learning

```
Activity template defines impulse needs
  ↓
minibob resolves impulses → impulses table
  ↓
Execution succeeds/fails → activity_executions
  ↓
Backend learns: which impulse types → which outcomes
```

### 3. MCP Tool Usage Learning

```
Agent calls MCP tool → metabob-mcp
  ↓
MCP tool calls analysis-api endpoint
  ↓
Analysis-api logs tool usage → surrealdb
  ↓
Dashboard shows: which tools used for which analyses
```

---

## Migration Strategy

### Phase 1: Shared Connection (Complete)

All services connect to same SurrealDB instance:
- ✅ metabob-activity-api: `surrealdb@2.0.3`
- ✅ metabob-analysis-api: `surrealdb@2.0.3` (upgraded from 1.x)
- ⏳ minibob: Add SurrealDB client dependency

### Phase 2: Unified Schema Deployment

1. **Deploy core tables** (sessions, activity_templates, activity_executions, impulses, composition_graph)
2. **Migrate existing data** from activity-api to unified schema
3. **Update services** to write to unified tables

### Phase 3: Cross-System Queries

Enable services to query across domains:
- Activity-api queries analysis results
- Analysis-api queries activity executions
- Dashboard queries unified activity composition graph

---

## Implementation Checklist

### metabob-analysis-api
- [x] Upgrade to `surrealdb@2.0.3`
- [ ] Add core table schemas to migrations
- [ ] Update session middleware to use `sessions` table
- [ ] Log analysis operations to `activity_executions`

### metabob-activity-api
- [x] Already using `surrealdb@2.0.3`
- [ ] Migrate from old schema to unified core tables
- [ ] Update Thompson Sampling to use `composition_graph`
- [ ] Store activity templates in unified `activity_templates`

### minibob
- [ ] Add `surrealdb@2.0.3` dependency
- [ ] Configure connection to shared instance
- [ ] Record executions to `activity_executions`
- [ ] Store/resolve impulses in `impulses` table

### metabob-mcp
- [x] No direct SurrealDB dependency (uses API)
- [ ] Ensure tool calls logged by analysis-api
- [ ] Add MCP-specific fields to activity tracking

---

## Benefits of Unified Schema

1. **Cross-Domain Learning**: Analysis results inform activity selection, activity success informs analysis priorities
2. **Unified Observability**: Single dashboard shows entire system behavior
3. **Composition Tracking**: See which analysis tools pair with which activities
4. **Impulse Optimization**: Learn which context types improve success rates
5. **Reduced Complexity**: One database, one schema, shared learning substrate

---

## References

- SurrealDB 3.x Documentation: https://surrealdb.com/docs
- JavaScript SDK 2.0: https://surrealdb.com/blog/introducing-javascript-sdk-2-0
- Activity System Design: `docs/architecture/ACTIVITY_BASED_IMPROVISATION.md`
- Impulse Architecture: `UNIFIED_IMPULSE_DRIVEN_ARCHITECTURE.md`
