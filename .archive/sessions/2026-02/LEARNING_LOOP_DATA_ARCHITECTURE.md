# Learning Loop Data Architecture - Complete Schema Design

**Date**: February 14, 2026  
**Status**: 📐 **DESIGN DOCUMENT** - Ready for Implementation  
**Context**: Comprehensive data model for activity/impulse learning, boredom tasks, and population management

---

## Executive Summary

This document defines the **complete data architecture** for OpenCode's learning loop system, encompassing:

1. **Data Collection**: What data we're capturing from recent work (Phase 2 enrichment, impulse tracking, agent sessions)
2. **Schema Organization**: How we organize SurrealDB schemas for optimal graph relationships
3. **Learning Operations**: Data requirements for activity and impulse evolution
4. **Boredom Activities**: Self-improvement tasks generated from data analysis
5. **MCP Integration**: Query interface for agents to access learning data

**Key Insight**: SurrealDB's graph capabilities enable rich relationship queries (activity→execution→steps→impulses) that power intelligent population management.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Data Collection Inventory](#2-data-collection-inventory)
3. [Complete Schema Architecture](#3-complete-schema-architecture)
4. [Learning Operations Data Flows](#4-learning-operations-data-flows)
5. [Boredom Activity System](#5-boredom-activity-system)
6. [MCP Query Interface](#6-mcp-query-interface)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Current State Analysis

### Existing Tables (Implemented ✅)

| Table | Status | Purpose | Key Fields |
|-------|--------|---------|------------|
| `activities` | ✅ | Activity definitions | activity_id, name, category |
| `activity_variants` | ✅ | Template variations | variant_id, parent_id, task_steps |
| `activity_executions` | ✅ | Execution outcomes | execution_id, success, duration |
| `execution_steps` | ✅ | Per-step data | step_id, impulses_loaded, success |
| `consumer_profiles` | ✅ | Agent preferences | consumer_id, selection_history |
| `activity_impressions` | ✅ | Recommendations shown | impression_id, activities |
| `activity_selections` | ✅ | Agent choices | selection_id, chosen_activity_id |
| `activity_conversions` | ✅ | Outcome tracking | conversion_id, success, quality |
| `agent_executions` | ✅ | Agent sessions | session_id, org_id, reflection |

### Missing Tables (To Implement 🔨)

| Table | Priority | Purpose | Reason Missing |
|-------|----------|---------|----------------|
| `tool_invocations` | HIGH | Tool usage with code context | Currently Redis-only (7-day TTL) |
| `impulse_registry` | HIGH | Impulse definitions and metadata | No centralized impulse tracking |
| `impulse_usage` | HIGH | Which impulses used in executions | Data exists but not queryable |
| `cochange_predictions` | MEDIUM | Predicted vs actual file changes | Integration complete but not persisted |
| `boredom_tasks` | MEDIUM | Self-improvement task queue | System doesn't exist yet |
| `population_analysis` | MEDIUM | Activity health metrics | No automated analysis |
| `variant_lineage` | LOW | Template evolution tree | Parent tracking exists but not graph |

---

## 2. Data Collection Inventory

### What We're Already Collecting ✅

#### A. Phase 2 Code Intelligence Enrichment (Redis only - needs SurrealDB)
**Source**: CLI MCP `record_tool_invocation()` → Backend API → Redis (7-day TTL)

**Data Captured**:
```python
code_context = {
    "operation": str,              # read, write, edit
    "timestamp": str,              # ISO timestamp
    "components": List[str],       # ["AuthService", "authenticate", "User"]
    "component_count": int,        # 9
    "impact_score": float,         # 0.45 (based on dependents)
    "dependents_count": int,       # 3
    "dependencies_count": int,     # 2
    "similar_files": List[str]     # ["auth_utils.py", "session.py"]
}
```

**Problem**: Lost after 7 days, not queryable for learning
**Solution**: Persist to `tool_invocations` table in SurrealDB

#### B. Impulse Tracking (Partial - needs completion)
**Source**: Activity execution → Step results → Backend

**Data Captured** (per step):
```python
{
    "impulses_loaded": ["design-doc", "api-spec"],      # Which context loaded
    "impulses_created": ["implementation-notes"],       # New context created
    "context_summary": {                                # What was in context
        "design-doc": {"type": "file", "size_kb": 12},
        "api-spec": {"type": "memo", "tokens": 450}
    }
}
```

**Problem**: No impulse metadata table, can't query "which activities benefit from X impulse"
**Solution**: Add `impulse_registry` and `impulse_usage` tables

#### C. Agent Session Data (Implemented ✅)
**Source**: OpenCode session completion → CLI MCP → Backend → SurrealDB

**Data Captured**:
```python
{
    "session_id": str,
    "org_id": str,                  # Multi-tenant scoping
    "project_id": str,              # Project-level tracking
    "agent_id": "metabob-opencode",
    "goal": str,
    "outcome": {
        "success": bool,
        "goal_achieved": bool,
        "tests_passed": bool
    },
    "reflection": {                 # Self-improvement data
        "what_worked": str,
        "what_didnt_work": str,
        "improvements_suggested": str
    },
    "tool_invocations": [...],      # Tool usage summary
    "activities_used": [...]        # Activities executed
}
```

**Status**: Complete and persisted to `agent_executions` table ✅

#### D. Cochange Predictions (Not persisted - needs table)
**Source**: CPG inference → CLI MCP → Activity context → Outcome recording

**Data Captured**:
```python
{
    "changed_files": ["auth.py"],
    "predicted_cochanges": [
        {"file": "session.py", "score": 0.85},
        {"file": "user.py", "score": 0.72}
    ],
    "actual_cochanges": ["session.py", "config.py"],  # From git diff
    "accuracy": 0.5,                                   # 1/2 predicted correctly
    "false_positives": ["user.py"],                    # Predicted but didn't change
    "false_negatives": ["config.py"]                   # Changed but not predicted
}
```

**Problem**: Data exists in activity outcome but not queryable for learning
**Solution**: Add `cochange_predictions` table

---

## 3. Complete Schema Architecture

### Design Principles

1. **Graph-First**: Use SurrealDB's graph relationships for rich queries
2. **Multi-Tenant**: All tables scoped by org_id/project_id
3. **Temporal**: Track created_at, updated_at for trend analysis
4. **Denormalization**: Store aggregated metrics for fast queries
5. **Lineage**: Track evolution chains (variant → parent → grandparent)

### Schema Organization

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENT & SESSION LAYER                            │
│  (Who executed, when, with what goal)                               │
├─────────────────────────────────────────────────────────────────────┤
│  agent_executions (sessions)                                        │
│  consumer_profiles (agent preferences)                              │
└────────────────┬────────────────────────────────────────────────────┘
                 │ session_id
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   ACTIVITY EXECUTION LAYER                          │
│  (What activity ran, how it performed)                              │
├─────────────────────────────────────────────────────────────────────┤
│  activities (definitions)                                           │
│  activity_variants (templates with A/B testing)                     │
│  activity_executions (outcome + metrics)                            │
│  activity_impressions/selections/conversions (CTR system)           │
└────────────────┬────────────────────────────────────────────────────┘
                 │ execution_id
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     STEP EXECUTION LAYER                            │
│  (Per-task granular data)                                           │
├─────────────────────────────────────────────────────────────────────┤
│  execution_steps (per-step outcomes)                                │
│  impulse_usage (which impulses loaded per step)                     │
└────────────────┬────────────────────────────────────────────────────┘
                 │ impulse_id
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTEXT LAYER                                  │
│  (What context was available/used)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  impulse_registry (impulse metadata)                                │
│  tool_invocations (tool usage + code context)                       │
│  cochange_predictions (file change predictions)                     │
└────────────────┬────────────────────────────────────────────────────┘
                 │ analyzed_by
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    LEARNING & EVOLUTION LAYER                       │
│  (Self-improvement and population management)                       │
├─────────────────────────────────────────────────────────────────────┤
│  population_analysis (activity health metrics)                      │
│  boredom_tasks (self-improvement queue)                             │
│  variant_lineage (evolution tree - graph edges)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### New Tables to Implement

#### Table 1: `tool_invocations` (HIGH PRIORITY)

**Purpose**: Persistent storage of tool usage with code intelligence enrichment

**Schema**:
```sql
DEFINE TABLE tool_invocations SCHEMAFULL;

-- Identity
DEFINE FIELD invocation_id ON tool_invocations TYPE string;
DEFINE FIELD session_id ON tool_invocations TYPE string;
DEFINE FIELD org_id ON tool_invocations TYPE string;
DEFINE FIELD project_id ON tool_invocations TYPE string;

-- Tool Info
DEFINE FIELD tool_name ON tool_invocations TYPE string;
DEFINE FIELD file_path ON tool_invocations TYPE option<string>;
DEFINE FIELD operation ON tool_invocations TYPE string;  -- read, write, edit
DEFINE FIELD timestamp ON tool_invocations TYPE datetime;

-- Phase 2 Enrichment (from code_context)
DEFINE FIELD components ON tool_invocations TYPE array DEFAULT [];
DEFINE FIELD component_count ON tool_invocations TYPE int DEFAULT 0;
DEFINE FIELD impact_score ON tool_invocations TYPE float DEFAULT 0.0;
DEFINE FIELD dependents_count ON tool_invocations TYPE int DEFAULT 0;
DEFINE FIELD dependencies_count ON tool_invocations TYPE int DEFAULT 0;
DEFINE FIELD similar_files ON tool_invocations TYPE array DEFAULT [];

-- Outcome
DEFINE FIELD success ON tool_invocations TYPE bool;
DEFINE FIELD duration_ms ON tool_invocations TYPE int;
DEFINE FIELD error ON tool_invocations TYPE option<string>;

-- Metadata
DEFINE FIELD created_at ON tool_invocations TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_tool_invocations_session ON tool_invocations FIELDS session_id;
DEFINE INDEX idx_tool_invocations_tool ON tool_invocations FIELDS tool_name;
DEFINE INDEX idx_tool_invocations_file ON tool_invocations FIELDS file_path;
DEFINE INDEX idx_tool_invocations_org_project ON tool_invocations FIELDS org_id, project_id;
DEFINE INDEX idx_tool_invocations_timestamp ON tool_invocations FIELDS timestamp;
```

**Graph Relationship**:
```
agent_executions -[invoked_tool]-> tool_invocations -[affected_file]-> files
```

**Query Examples**:
```sql
-- Most impactful tool operations
SELECT tool_name, avg(impact_score), count() 
FROM tool_invocations 
WHERE impact_score > 0.7 
GROUP BY tool_name;

-- Files with highest dependency churn
SELECT file_path, avg(dependents_count), count() as edit_frequency
FROM tool_invocations 
WHERE operation = 'write' AND project_id = 'my-project'
GROUP BY file_path 
ORDER BY edit_frequency DESC;
```

---

#### Table 2: `impulse_registry` (HIGH PRIORITY)

**Purpose**: Central registry of all impulses created, with metadata for learning

**Schema**:
```sql
DEFINE TABLE impulse_registry SCHEMAFULL;

-- Identity
DEFINE FIELD impulse_id ON impulse_registry TYPE string;
DEFINE FIELD session_id ON impulse_registry TYPE option<string>;  -- Which session created it
DEFINE FIELD org_id ON impulse_registry TYPE string;
DEFINE FIELD project_id ON impulse_registry TYPE string;

-- Type & Content
DEFINE FIELD impulse_type ON impulse_registry TYPE string;  -- file, memo, bashOutput, activity, etc.
DEFINE FIELD pointer ON impulse_registry TYPE object;       -- Full pointer data
DEFINE FIELD scope ON impulse_registry TYPE string;         -- session, activity, global

-- Budget Management
DEFINE FIELD budget ON impulse_registry TYPE int;           -- Token budget allocated
DEFINE FIELD actual_tokens ON impulse_registry TYPE option<int>;  -- Actual usage (if resolved)

-- Usage Statistics
DEFINE FIELD usage_count ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD success_when_used ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON impulse_registry TYPE float DEFAULT 0.0;

-- Context Metadata
DEFINE FIELD created_by ON impulse_registry TYPE string;    -- agent_id
DEFINE FIELD created_for ON impulse_registry TYPE string;   -- Purpose/reason
DEFINE FIELD tags ON impulse_registry TYPE array DEFAULT [];
DEFINE FIELD related_impulses ON impulse_registry TYPE array DEFAULT [];  -- Similar impulses

-- Lifecycle
DEFINE FIELD status ON impulse_registry TYPE string DEFAULT 'active';  -- active, archived, deprecated
DEFINE FIELD created_at ON impulse_registry TYPE datetime DEFAULT time::now();
DEFINE FIELD last_used_at ON impulse_registry TYPE option<datetime>;
DEFINE FIELD archived_at ON impulse_registry TYPE option<datetime>;

-- Indexes
DEFINE INDEX idx_impulse_registry_id ON impulse_registry FIELDS impulse_id UNIQUE;
DEFINE INDEX idx_impulse_registry_session ON impulse_registry FIELDS session_id;
DEFINE INDEX idx_impulse_registry_type ON impulse_registry FIELDS impulse_type;
DEFINE INDEX idx_impulse_registry_org_project ON impulse_registry FIELDS org_id, project_id;
DEFINE INDEX idx_impulse_registry_success_rate ON impulse_registry FIELDS success_rate;
```

**Graph Relationships**:
```
agent_executions -[created_impulse]-> impulse_registry
execution_steps -[loaded_impulse]-> impulse_registry
```

**Query Examples**:
```sql
-- Most effective impulses
SELECT impulse_id, impulse_type, usage_count, success_rate 
FROM impulse_registry 
WHERE usage_count > 5 
ORDER BY success_rate DESC 
LIMIT 10;

-- Underutilized impulses (candidates for archival)
SELECT impulse_id, created_at, last_used_at 
FROM impulse_registry 
WHERE usage_count < 3 AND created_at < time::now() - 30d;
```

---

#### Table 3: `impulse_usage` (HIGH PRIORITY)

**Purpose**: Junction table tracking which impulses were used in which steps

**Schema**:
```sql
DEFINE TABLE impulse_usage SCHEMAFULL;

-- Links
DEFINE FIELD execution_id ON impulse_usage TYPE string;
DEFINE FIELD step_id ON impulse_usage TYPE string;
DEFINE FIELD impulse_id ON impulse_usage TYPE string;

-- Usage Details
DEFINE FIELD usage_type ON impulse_usage TYPE string;      -- loaded, created, referenced
DEFINE FIELD resolution_time_ms ON impulse_usage TYPE option<int>;
DEFINE FIELD tokens_used ON impulse_usage TYPE option<int>;

-- Contribution to Success
DEFINE FIELD step_succeeded ON impulse_usage TYPE bool;
DEFINE FIELD contributed_to_success ON impulse_usage TYPE option<bool>;  -- Causal analysis

-- Metadata
DEFINE FIELD created_at ON impulse_usage TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_impulse_usage_execution ON impulse_usage FIELDS execution_id;
DEFINE INDEX idx_impulse_usage_step ON impulse_usage FIELDS step_id;
DEFINE INDEX idx_impulse_usage_impulse ON impulse_usage FIELDS impulse_id;
DEFINE INDEX idx_impulse_usage_composite ON impulse_usage FIELDS impulse_id, step_succeeded;
```

**Graph Relationships**:
```
execution_steps -[used_impulse]-> impulse_usage -[references]-> impulse_registry
```

**Query Examples**:
```sql
-- Which impulses correlate with success?
SELECT 
    iu.impulse_id,
    ir.impulse_type,
    count() as usage_count,
    math::sum(CASE WHEN iu.step_succeeded THEN 1 ELSE 0 END) as success_count,
    math::sum(CASE WHEN iu.step_succeeded THEN 1.0 ELSE 0.0 END) / count() as success_rate
FROM impulse_usage iu
JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
GROUP BY iu.impulse_id, ir.impulse_type
HAVING usage_count > 5
ORDER BY success_rate DESC;

-- What impulses do successful activities share?
SELECT 
    iu.impulse_id,
    array::group(ae.activity_id) as activities_using,
    count(DISTINCT ae.activity_id) as activity_count
FROM impulse_usage iu
JOIN execution_steps es ON iu.step_id = es.step_id
JOIN activity_executions ae ON es.execution_id = ae.execution_id
WHERE ae.success = true
GROUP BY iu.impulse_id
HAVING activity_count > 3;
```

---

#### Table 4: `cochange_predictions` (MEDIUM PRIORITY)

**Purpose**: Track cochange prediction accuracy for learning loop

**Schema**:
```sql
DEFINE TABLE cochange_predictions SCHEMAFULL;

-- Identity
DEFINE FIELD prediction_id ON cochange_predictions TYPE string;
DEFINE FIELD execution_id ON cochange_predictions TYPE string;
DEFINE FIELD session_id ON cochange_predictions TYPE option<string>;
DEFINE FIELD org_id ON cochange_predictions TYPE string;
DEFINE FIELD project_id ON cochange_predictions TYPE string;

-- Input
DEFINE FIELD changed_files ON cochange_predictions TYPE array;  -- Trigger files

-- Prediction
DEFINE FIELD predicted_cochanges ON cochange_predictions TYPE array;  -- [{file, score}]
DEFINE FIELD prediction_timestamp ON cochange_predictions TYPE datetime;

-- Actual Outcome
DEFINE FIELD actual_cochanges ON cochange_predictions TYPE array;  -- Files actually changed
DEFINE FIELD outcome_timestamp ON cochange_predictions TYPE option<datetime>;

-- Accuracy Metrics
DEFINE FIELD accuracy ON cochange_predictions TYPE option<float>;
DEFINE FIELD precision ON cochange_predictions TYPE option<float>;
DEFINE FIELD recall ON cochange_predictions TYPE option<float>;
DEFINE FIELD true_positives ON cochange_predictions TYPE array DEFAULT [];
DEFINE FIELD false_positives ON cochange_predictions TYPE array DEFAULT [];
DEFINE FIELD false_negatives ON cochange_predictions TYPE array DEFAULT [];

-- Metadata
DEFINE FIELD created_at ON cochange_predictions TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON cochange_predictions TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_cochange_predictions_execution ON cochange_predictions FIELDS execution_id;
DEFINE INDEX idx_cochange_predictions_org_project ON cochange_predictions FIELDS org_id, project_id;
DEFINE INDEX idx_cochange_predictions_accuracy ON cochange_predictions FIELDS accuracy;
```

**Query Examples**:
```sql
-- Cochange accuracy over time
SELECT 
    time::floor(created_at, 1d) as day,
    avg(accuracy) as avg_accuracy,
    avg(precision) as avg_precision,
    avg(recall) as avg_recall,
    count() as prediction_count
FROM cochange_predictions
WHERE accuracy IS NOT NONE
GROUP BY day
ORDER BY day DESC;

-- Which file patterns have worst predictions?
SELECT 
    changed_files[0] as primary_file,
    avg(accuracy) as avg_accuracy,
    count() as prediction_count
FROM cochange_predictions
WHERE array::len(changed_files) > 0
GROUP BY primary_file
HAVING prediction_count > 5 AND avg_accuracy < 0.5
ORDER BY prediction_count DESC;
```

---

#### Table 5: `boredom_tasks` (MEDIUM PRIORITY)

**Purpose**: Queue of self-improvement tasks generated by analysis, executable by agents

**Schema**:
```sql
DEFINE TABLE boredom_tasks SCHEMAFULL;

-- Identity
DEFINE FIELD task_id ON boredom_tasks TYPE string;
DEFINE FIELD org_id ON boredom_tasks TYPE string;
DEFINE FIELD project_id ON boredom_tasks TYPE string;

-- Task Definition
DEFINE FIELD task_type ON boredom_tasks TYPE string;  -- merge, split, refine, archive, validate
DEFINE FIELD category ON boredom_tasks TYPE string;   -- activity, impulse, template
DEFINE FIELD priority ON boredom_tasks TYPE string;   -- high, medium, low
DEFINE FIELD title ON boredom_tasks TYPE string;
DEFINE FIELD description ON boredom_tasks TYPE string;

-- Target
DEFINE FIELD target_id ON boredom_tasks TYPE string;      -- activity_id, impulse_id, variant_id
DEFINE FIELD target_type ON boredom_tasks TYPE string;    -- activity, impulse, variant
DEFINE FIELD related_targets ON boredom_tasks TYPE array DEFAULT [];  -- For merge operations

-- Analysis Data (why this task was suggested)
DEFINE FIELD analysis_data ON boredom_tasks TYPE object;  -- Evidence for suggestion
DEFINE FIELD rationale ON boredom_tasks TYPE string;      -- Human-readable reasoning

-- Execution Details
DEFINE FIELD activity_template_id ON boredom_tasks TYPE option<string>;  -- Which activity to run
DEFINE FIELD estimated_duration_min ON boredom_tasks TYPE int;
DEFINE FIELD estimated_impact ON boredom_tasks TYPE string;  -- high, medium, low

-- Status & Lifecycle
DEFINE FIELD status ON boredom_tasks TYPE string DEFAULT 'pending';  -- pending, in_progress, complete, skipped
DEFINE FIELD assigned_to ON boredom_tasks TYPE option<string>;       -- agent_id if in progress
DEFINE FIELD execution_id ON boredom_tasks TYPE option<string>;      -- Link to execution
DEFINE FIELD result ON boredom_tasks TYPE option<object>;            -- Outcome of task

-- Scheduling
DEFINE FIELD created_at ON boredom_tasks TYPE datetime DEFAULT time::now();
DEFINE FIELD scheduled_for ON boredom_tasks TYPE option<datetime>;
DEFINE FIELD started_at ON boredom_tasks TYPE option<datetime>;
DEFINE FIELD completed_at ON boredom_tasks TYPE option<datetime>;

-- Deduplication
DEFINE FIELD dedupe_key ON boredom_tasks TYPE string;  -- Hash to prevent duplicates

-- Indexes
DEFINE INDEX idx_boredom_tasks_id ON boredom_tasks FIELDS task_id UNIQUE;
DEFINE INDEX idx_boredom_tasks_status ON boredom_tasks FIELDS status;
DEFINE INDEX idx_boredom_tasks_priority ON boredom_tasks FIELDS priority;
DEFINE INDEX idx_boredom_tasks_type ON boredom_tasks FIELDS task_type;
DEFINE INDEX idx_boredom_tasks_target ON boredom_tasks FIELDS target_id;
DEFINE INDEX idx_boredom_tasks_org_project ON boredom_tasks FIELDS org_id, project_id;
DEFINE INDEX idx_boredom_tasks_dedupe ON boredom_tasks FIELDS dedupe_key UNIQUE;
```

**Query Examples**:
```sql
-- Get next pending boredom task for an agent
SELECT * FROM boredom_tasks 
WHERE status = 'pending' 
  AND project_id = 'my-project'
ORDER BY priority DESC, created_at ASC 
LIMIT 1;

-- Task backlog by type
SELECT task_type, priority, count() as task_count
FROM boredom_tasks
WHERE status IN ['pending', 'in_progress']
GROUP BY task_type, priority
ORDER BY priority DESC, task_count DESC;
```

---

#### Table 6: `population_analysis` (MEDIUM PRIORITY)

**Purpose**: Aggregated metrics for activity/impulse health, used to generate boredom tasks

**Schema**:
```sql
DEFINE TABLE population_analysis SCHEMAFULL;

-- Identity
DEFINE FIELD analysis_id ON population_analysis TYPE string;
DEFINE FIELD target_id ON population_analysis TYPE string;      -- activity_id or impulse_id
DEFINE FIELD target_type ON population_analysis TYPE string;    -- activity, impulse
DEFINE FIELD org_id ON population_analysis TYPE string;
DEFINE FIELD project_id ON population_analysis TYPE string;

-- Health Metrics
DEFINE FIELD usage_count ON population_analysis TYPE int;
DEFINE FIELD success_rate ON population_analysis TYPE float;
DEFINE FIELD avg_duration_ms ON population_analysis TYPE int;
DEFINE FIELD avg_cost ON population_analysis TYPE float;
DEFINE FIELD failure_patterns ON population_analysis TYPE array DEFAULT [];

-- Evolution Signals
DEFINE FIELD merge_candidate ON population_analysis TYPE bool DEFAULT false;
DEFINE FIELD merge_candidates ON population_analysis TYPE array DEFAULT [];  -- Similar activities
DEFINE FIELD merge_overlap_score ON population_analysis TYPE option<float>;

DEFINE FIELD split_candidate ON population_analysis TYPE bool DEFAULT false;
DEFINE FIELD split_reason ON population_analysis TYPE option<string>;
DEFINE FIELD split_breakpoints ON population_analysis TYPE array DEFAULT [];  -- Task indexes

DEFINE FIELD refine_candidate ON population_analysis TYPE bool DEFAULT false;
DEFINE FIELD refine_reason ON population_analysis TYPE option<string>;
DEFINE FIELD refine_suggestions ON population_analysis TYPE array DEFAULT [];

DEFINE FIELD archive_candidate ON population_analysis TYPE bool DEFAULT false;
DEFINE FIELD archive_reason ON population_analysis TYPE option<string>;

-- Timestamps
DEFINE FIELD analysis_timestamp ON population_analysis TYPE datetime;
DEFINE FIELD data_window_start ON population_analysis TYPE datetime;
DEFINE FIELD data_window_end ON population_analysis TYPE datetime;

-- Metadata
DEFINE FIELD created_at ON population_analysis TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_population_analysis_target ON population_analysis FIELDS target_id;
DEFINE INDEX idx_population_analysis_type ON population_analysis FIELDS target_type;
DEFINE INDEX idx_population_analysis_merge ON population_analysis FIELDS merge_candidate;
DEFINE INDEX idx_population_analysis_split ON population_analysis FIELDS split_candidate;
DEFINE INDEX idx_population_analysis_refine ON population_analysis FIELDS refine_candidate;
```

**Query Examples**:
```sql
-- All merge candidates
SELECT 
    target_id,
    merge_candidates,
    merge_overlap_score,
    usage_count,
    success_rate
FROM population_analysis
WHERE merge_candidate = true
ORDER BY merge_overlap_score DESC;

-- Activities needing refinement
SELECT 
    target_id,
    refine_reason,
    refine_suggestions,
    success_rate,
    failure_patterns
FROM population_analysis
WHERE refine_candidate = true AND target_type = 'activity'
ORDER BY usage_count DESC;
```

---

#### Table 7: `variant_lineage` (LOW PRIORITY - GRAPH EDGES)

**Purpose**: Track template evolution as a directed graph for ancestry queries

**Schema**:
```sql
DEFINE TABLE variant_lineage SCHEMAFULL;

-- Graph Edge
DEFINE FIELD parent_variant_id ON variant_lineage TYPE string;
DEFINE FIELD child_variant_id ON variant_lineage TYPE string;

-- Evolution Details
DEFINE FIELD evolution_type ON variant_lineage TYPE string;  -- trailblaze-fix, manual-refine, merge, split
DEFINE FIELD evolution_reason ON variant_lineage TYPE string;
DEFINE FIELD changes_summary ON variant_lineage TYPE object;  -- What changed

-- Metrics
DEFINE FIELD performance_delta ON variant_lineage TYPE object;  -- Parent vs child metrics

-- Metadata
DEFINE FIELD created_at ON variant_lineage TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_variant_lineage_parent ON variant_lineage FIELDS parent_variant_id;
DEFINE INDEX idx_variant_lineage_child ON variant_lineage FIELDS child_variant_id;
DEFINE INDEX idx_variant_lineage_type ON variant_lineage FIELDS evolution_type;
```

**Graph Relationships**:
```
activity_variants -[evolved_from]-> activity_variants
```

**Query Examples**:
```sql
-- Full evolution chain for a variant
SELECT * FROM variant_lineage
START WITH child_variant_id = 'my-variant-123'
CONNECT BY parent_variant_id = PRIOR parent_variant_id;

-- Most prolific parent templates
SELECT parent_variant_id, count() as child_count
FROM variant_lineage
GROUP BY parent_variant_id
ORDER BY child_count DESC;
```

---

## 4. Learning Operations Data Flows

### Operation 1: Activity Population Management

**Goal**: Identify activities to merge, split, or refine

**Data Flow**:
```
1. Scheduled Job (daily/weekly)
   ↓
2. Query activity_executions (last 30 days)
   - Group by variant_id
   - Calculate: success_rate, avg_duration, failure_patterns
   ↓
3. Analyze for merge candidates
   - Find activities with >70% task overlap
   - Check: similar categories, same tech stack
   - Store in population_analysis (merge_candidate = true)
   ↓
4. Analyze for split candidates
   - Find activities with >7 tasks AND <50% success
   - Identify failure breakpoints (which tasks fail most)
   - Store in population_analysis (split_candidate = true)
   ↓
5. Analyze for refine candidates
   - Find activities with consistent failure patterns
   - Check execution_steps for common failure points
   - Store in population_analysis (refine_candidate = true)
   ↓
6. Generate boredom_tasks
   - For each merge candidate → task_type = 'merge'
   - For each split candidate → task_type = 'split'
   - For each refine candidate → task_type = 'refine'
   - Set priority based on usage_count and impact
```

**SQL Queries**:
```sql
-- Find merge candidates (>70% task overlap)
WITH variant_tasks AS (
    SELECT 
        variant_id,
        tasks as task_list,
        array::len(tasks) as task_count
    FROM activity_variants
)
SELECT 
    v1.variant_id as variant_a,
    v2.variant_id as variant_b,
    array::intersect(v1.task_list, v2.task_list) as common_tasks,
    array::len(array::intersect(v1.task_list, v2.task_list)) / v1.task_count as overlap_score
FROM variant_tasks v1
JOIN variant_tasks v2 ON v1.variant_id < v2.variant_id
WHERE overlap_score > 0.7;

-- Find split candidates (>7 tasks, <50% success)
SELECT 
    ae.variant_id,
    count() as execution_count,
    math::sum(CASE WHEN ae.success THEN 1 ELSE 0 END) / count() as success_rate,
    av.tasks,
    array::len(av.tasks) as task_count
FROM activity_executions ae
JOIN activity_variants av ON ae.variant_id = av.variant_id
WHERE ae.timestamp > time::now() - 30d
GROUP BY ae.variant_id, av.tasks
HAVING task_count > 7 AND success_rate < 0.5;

-- Find refine candidates (consistent failure at same step)
SELECT 
    es.step_id,
    ae.variant_id,
    count() as failure_count,
    array::group(es.error) as error_patterns
FROM execution_steps es
JOIN activity_executions ae ON es.execution_id = ae.execution_id
WHERE es.success = false AND ae.timestamp > time::now() - 30d
GROUP BY es.step_id, ae.variant_id
HAVING failure_count > 10;
```

---

### Operation 2: Impulse Population Management

**Goal**: Identify impulses to archive, merge, or deprecate

**Data Flow**:
```
1. Scheduled Job (weekly)
   ↓
2. Query impulse_registry + impulse_usage
   - Calculate: usage_count, success_rate, last_used_at
   ↓
3. Identify archive candidates
   - Impulses with usage_count < 3 AND created_at > 30 days ago
   - Mark in impulse_registry (status = 'archived')
   ↓
4. Identify redundant impulses
   - Find impulses with identical pointers (same file, same range)
   - Suggest merge in boredom_tasks
   ↓
5. Identify low-value impulses
   - Success_rate < 0.3 AND usage_count > 10
   - Suggest deprecation or refinement
```

**SQL Queries**:
```sql
-- Archive candidates (low usage, old)
SELECT 
    impulse_id,
    impulse_type,
    usage_count,
    created_at,
    last_used_at
FROM impulse_registry
WHERE usage_count < 3 
  AND created_at < time::now() - 30d
  AND status = 'active';

-- Redundant impulses (same pointer)
SELECT 
    ir1.impulse_id as impulse_a,
    ir2.impulse_id as impulse_b,
    ir1.pointer,
    ir1.usage_count + ir2.usage_count as combined_usage
FROM impulse_registry ir1
JOIN impulse_registry ir2 ON ir1.impulse_id < ir2.impulse_id
WHERE ir1.pointer = ir2.pointer
  AND ir1.status = 'active'
  AND ir2.status = 'active';

-- Low-value impulses (hurt success rate)
SELECT 
    ir.impulse_id,
    ir.impulse_type,
    ir.usage_count,
    ir.success_rate,
    avg(CASE WHEN iu.step_succeeded THEN 1.0 ELSE 0.0 END) as actual_success_rate
FROM impulse_registry ir
JOIN impulse_usage iu ON ir.impulse_id = iu.impulse_id
GROUP BY ir.impulse_id, ir.impulse_type, ir.usage_count, ir.success_rate
HAVING ir.usage_count > 10 AND actual_success_rate < 0.3;
```

---

### Operation 3: Cochange Learning Loop

**Goal**: Improve cochange prediction accuracy over time

**Data Flow**:
```
1. Activity Execution (with cochange context)
   ↓
2. Cochange prediction stored (predicted files)
   ↓
3. Activity completes → git diff captures actual changes
   ↓
4. Compare predicted vs actual
   - Calculate accuracy, precision, recall
   - Store in cochange_predictions
   ↓
5. Aggregate metrics (weekly)
   - Identify file patterns with low accuracy
   - Generate boredom_task: "refine cochange model for auth/**"
   ↓
6. Feed back to CPG training (future: retrain embeddings)
```

**SQL Queries**:
```sql
-- Cochange accuracy trend
SELECT 
    time::floor(created_at, 7d) as week,
    avg(accuracy) as avg_accuracy,
    count() as prediction_count
FROM cochange_predictions
WHERE accuracy IS NOT NONE
GROUP BY week
ORDER BY week DESC;

-- File patterns needing model refinement
SELECT 
    changed_files[0] as file_pattern,
    avg(accuracy) as avg_accuracy,
    avg(recall) as avg_recall,
    count() as sample_count
FROM cochange_predictions
WHERE array::len(changed_files) > 0
GROUP BY file_pattern
HAVING sample_count > 10 AND avg_accuracy < 0.6;
```

---

## 5. Boredom Activity System

### What Are Boredom Activities?

**Definition**: Self-improvement tasks generated by automated analysis, executed by agents during idle time or low-priority windows.

**Purpose**: Continuous system improvement without manual intervention

**Types**:

| Type | Target | Example | Priority |
|------|--------|---------|----------|
| `merge` | Activities | Combine 2 redundant activities with 80% task overlap | High |
| `split` | Activities | Split complex 10-task activity with 40% success rate | High |
| `refine` | Activities | Fix step that fails 60% of the time | High |
| `archive` | Impulses | Archive 50 impulses unused for >30 days | Low |
| `validate` | Variants | Test 10 variants with 0 executions | Medium |
| `optimize` | Context | Reduce impulse budget from 5000→3000 tokens | Low |

### Generation Pipeline

```
Scheduled Job (Population Analyzer)
  ↓
1. Query metrics from last 30 days
2. Apply heuristics to identify issues
3. Generate boredom_tasks with:
   - Clear title/description
   - Evidence (analysis_data)
   - Activity template to execute
   - Estimated impact
  ↓
Boredom Task Queue (boredom_tasks table)
  ↓
Agent Queries "get next boredom task" (MCP tool)
  ↓
Agent Executes Activity
  ↓
Result Stored → Trigger Next Analysis
```

### Bootstrap Boredom Activities (Metabob Proto)

These are foundational activities included in the system:

#### 1. `merge-activities-v1`
**Purpose**: Merge two activities with high task overlap

**Variables**:
- `activity_a_id`: First activity variant ID
- `activity_b_id`: Second activity variant ID
- `overlap_score`: Similarity score (0.0-1.0)

**Tasks**:
1. Fetch both activity templates
2. Identify common tasks (keep unique ones)
3. Merge task lists intelligently
4. Test merged activity
5. Create new variant via derive_template
6. Mark originals as deprecated
7. Record outcome

#### 2. `split-activity-v1`
**Purpose**: Split complex activity into focused sub-activities

**Variables**:
- `activity_id`: Activity to split
- `breakpoint_indexes`: Where to split task list

**Tasks**:
1. Fetch activity template
2. Split tasks at breakpoints
3. Create 2-3 new focused activities
4. Test each independently
5. Create composition activity
6. Archive original
7. Record outcome

#### 3. `refine-failing-step-v1`
**Purpose**: Fix consistently failing step in activity

**Variables**:
- `activity_id`: Activity to refine
- `failing_step_index`: Which step fails
- `error_patterns`: Common error messages

**Tasks**:
1. Analyze failure patterns
2. Search codebase for similar fixes
3. Generate improved task prompt
4. Test refined step
5. Create variant with fix
6. Record outcome

#### 4. `archive-unused-impulses-v1`
**Purpose**: Clean up impulse registry

**Variables**:
- `impulse_ids`: Array of impulses to archive

**Tasks**:
1. Verify impulses are truly unused
2. Update status to 'archived'
3. Record archive reason
4. Generate summary report

#### 5. `validate-new-variants-v1`
**Purpose**: Test newly created variants with no executions

**Variables**:
- `variant_ids`: Array of untested variants

**Tasks**:
1. Create test execution context
2. Run each variant in sandbox
3. Record success/failure
4. Update variant metadata
5. Generate recommendations

### MCP Tool Interface

Agents query for boredom tasks via CLI MCP:

```python
# repos/metabob-cli/src/metabob_cli/mcp/tools.py

@mcp.tool()
async def get_next_boredom_task(
    project_id: str,
    priority: Optional[str] = None,  # high, medium, low
    task_types: Optional[List[str]] = None  # Filter by type
) -> dict:
    """
    Get next pending boredom task for self-improvement.
    
    Returns task definition with activity template to execute.
    """
    query = """
        SELECT * FROM boredom_tasks
        WHERE status = 'pending'
          AND project_id = $project_id
    """
    
    if priority:
        query += f" AND priority = '{priority}'"
    
    if task_types:
        query += f" AND task_type IN {task_types}"
    
    query += " ORDER BY priority DESC, created_at ASC LIMIT 1"
    
    result = await surreal.query(query, {"project_id": project_id})
    
    if not result:
        return {"status": "no_tasks", "message": "No pending boredom tasks"}
    
    task = result[0]
    
    # Mark as in_progress
    await surreal.query("""
        UPDATE boredom_tasks
        SET status = 'in_progress', started_at = time::now()
        WHERE task_id = $task_id
    """, {"task_id": task["task_id"]})
    
    return {
        "status": "success",
        "task": task,
        "activity_template_id": task["activity_template_id"],
        "variables": task["analysis_data"]["variables"]
    }
```

**Agent Usage**:
```typescript
// When agent is idle or user requests self-improvement

const boredo mTask = await mcpTools.call("get_next_boredom_task", {
    project_id: "my-project",
    priority: "high"
});

if (boredomeTask.status === "success") {
    // Execute the boredom activity
    await activity({
        activityId: boredomTask.activity_template_id,
        variables: boredomTask.variables,
        reason: boredomTask.task.description
    });
}
```

---

## 6. MCP Query Interface

### New MCP Tools for Learning Data

#### Tool 1: `query_tool_usage_patterns`
```python
@mcp.tool()
async def query_tool_usage_patterns(
    project_id: str,
    tool_name: Optional[str] = None,
    min_impact_score: float = 0.5
) -> dict:
    """Query tool usage patterns with code intelligence enrichment."""
    
    query = """
        SELECT 
            tool_name,
            count() as usage_count,
            avg(impact_score) as avg_impact,
            avg(dependents_count) as avg_dependents,
            array::group(file_path) as files_affected
        FROM tool_invocations
        WHERE project_id = $project_id
          AND impact_score >= $min_impact_score
    """
    
    if tool_name:
        query += f" AND tool_name = '{tool_name}'"
    
    query += " GROUP BY tool_name ORDER BY avg_impact DESC"
    
    return await surreal.query(query, {
        "project_id": project_id,
        "min_impact_score": min_impact_score
    })
```

#### Tool 2: `query_impulse_effectiveness`
```python
@mcp.tool()
async def query_impulse_effectiveness(
    project_id: str,
    min_usage_count: int = 5
) -> dict:
    """Find most effective impulses by success rate."""
    
    query = """
        SELECT 
            ir.impulse_id,
            ir.impulse_type,
            ir.usage_count,
            ir.success_rate,
            array::group(iu.step_id) as steps_used_in
        FROM impulse_registry ir
        JOIN impulse_usage iu ON ir.impulse_id = iu.impulse_id
        WHERE ir.project_id = $project_id
          AND ir.usage_count >= $min_usage_count
        GROUP BY ir.impulse_id, ir.impulse_type, ir.usage_count, ir.success_rate
        ORDER BY ir.success_rate DESC
        LIMIT 10
    """
    
    return await surreal.query(query, {
        "project_id": project_id,
        "min_usage_count": min_usage_count
    })
```

#### Tool 3: `query_activity_health`
```python
@mcp.tool()
async def query_activity_health(
    project_id: str,
    category: Optional[str] = None
) -> dict:
    """Get activity population health metrics."""
    
    query = """
        SELECT * FROM population_analysis
        WHERE project_id = $project_id
          AND target_type = 'activity'
          AND (merge_candidate = true 
               OR split_candidate = true 
               OR refine_candidate = true)
    """
    
    if category:
        query += f" AND target_id IN (SELECT activity_id FROM activities WHERE category = '{category}')"
    
    query += " ORDER BY usage_count DESC"
    
    return await surreal.query(query, {"project_id": project_id})
```

#### Tool 4: `query_cochange_accuracy`
```python
@mcp.tool()
async def query_cochange_accuracy(
    project_id: str,
    days: int = 30
) -> dict:
    """Get cochange prediction accuracy trends."""
    
    query = """
        SELECT 
            time::floor(created_at, 7d) as week,
            avg(accuracy) as avg_accuracy,
            avg(precision) as avg_precision,
            avg(recall) as avg_recall,
            count() as prediction_count
        FROM cochange_predictions
        WHERE project_id = $project_id
          AND created_at > time::now() - ${days}d
        GROUP BY week
        ORDER BY week DESC
    """
    
    return await surreal.query(query, {
        "project_id": project_id,
        "days": days
    })
```

---

## 7. Implementation Roadmap

### Phase 1: Critical Data Persistence (HIGH PRIORITY - 2 days)

**Goal**: Persist Phase 2 enrichment data and impulse tracking to SurrealDB

**Tasks**:
1. Create migration: `004-tool-invocations-table.surql` (2h)
2. Update backend: Persist code_context to tool_invocations (2h)
3. Create migration: `005-impulse-tables.surql` (impulse_registry, impulse_usage) (3h)
4. Update backend: Record impulse usage from execution_steps (3h)
5. Test end-to-end persistence (2h)

**Deliverables**:
- SQL migration files
- Backend persistence logic
- Test verification

---

### Phase 2: Learning Infrastructure (MEDIUM PRIORITY - 3 days)

**Goal**: Implement population analysis and boredom task generation

**Tasks**:
1. Create migration: `006-learning-tables.surql` (population_analysis, boredom_tasks) (2h)
2. Implement population analyzer job (activity merge/split/refine detection) (6h)
3. Implement boredom task generator (8h)
4. Add MCP tools: get_next_boredom_task, mark_boredom_task_complete (2h)
5. Test boredom task workflow (2h)

**Deliverables**:
- Scheduled analysis job
- Boredom task queue
- MCP integration

---

### Phase 3: Bootstrap Boredom Activities (MEDIUM PRIORITY - 2 days)

**Goal**: Create foundational self-improvement activity templates

**Tasks**:
1. Create `merge-activities-v1` template (3h)
2. Create `split-activity-v1` template (3h)
3. Create `refine-failing-step-v1` template (3h)
4. Create `archive-unused-impulses-v1` template (2h)
5. Create `validate-new-variants-v1` template (2h)
6. Test each bootstrap activity (3h)

**Deliverables**:
- 5 bootstrap activity templates
- Integration tests

---

### Phase 4: Cochange & Advanced Learning (LOW PRIORITY - 2 days)

**Goal**: Complete cochange learning loop and variant lineage

**Tasks**:
1. Create migration: `007-cochange-lineage-tables.surql` (2h)
2. Persist cochange predictions to DB (3h)
3. Implement cochange accuracy analysis (3h)
4. Implement variant lineage graph (3h)
5. Add MCP query tools (query_activity_health, query_impulse_effectiveness) (3h)

**Deliverables**:
- Cochange persistence
- Variant evolution tree
- Advanced MCP tools

---

## Summary

### What We're Collecting ✅
- **Agent sessions** (complete - `agent_executions`)
- **Activity executions** (complete - `activity_executions`)
- **Per-step data** (complete - `execution_steps`)
- **Impulse tracking** (per-step - `impulses_loaded`, `impulses_created`)
- **Code intelligence** (Phase 2 - `code_context` in Redis, needs SurrealDB)
- **Cochange predictions** (exists in outcomes, needs dedicated table)

### What's Missing 🔨
- **Tool invocations** persistence (Redis → SurrealDB)
- **Impulse registry** (no centralized tracking)
- **Population analysis** (no automated health metrics)
- **Boredom task queue** (no self-improvement system)

### Schema Organization 📊
- **Graph-first**: Rich relationships for complex queries
- **Multi-tenant**: org_id/project_id scoping everywhere
- **Temporal**: Track trends over time
- **Denormalized**: Fast aggregated metrics

### Learning Operations 🧠
- **Activity evolution**: Merge/split/refine based on execution data
- **Impulse management**: Archive unused, identify effective patterns
- **Cochange improvement**: Track accuracy, retrain models

### Boredom Activities 🤖
- **Self-improvement queue**: Generated from analysis
- **MCP accessible**: Agents query and execute
- **Bootstrap templates**: 5 foundational activities
- **No duplication**: Dedupe keys prevent repeat tasks

### Total Implementation Time
- **Phase 1** (Critical): 2 days
- **Phase 2** (Learning): 3 days
- **Phase 3** (Bootstrap): 2 days
- **Phase 4** (Advanced): 2 days
- **Total**: ~9 days for complete system

---

**Next Steps**: Review this design document, prioritize phases, and proceed with Phase 1 implementation (tool_invocations + impulse_registry persistence).

