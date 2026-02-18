# SurrealDB Data Usage Guide

**Complete Reference: How Data Flows Through the Activity System**

Date: February 15, 2026  
Purpose: Answer all questions about SurrealDB data usage, processing, responsibilities, and tracking

---

## Executive Summary: The 5 Core Questions

### 1. **How does our data in SurrealDB get used?**
Data flows through a recommendation funnel: **Impressions → Selections → Conversions → Metrics**
- **Impressions**: When activities are shown to agents (CTR tracking)
- **Selections**: When agents choose an activity (engagement tracking)
- **Conversions**: When executions complete (success tracking)
- **Metrics**: Aggregated performance for Thompson Sampling (recommendation optimization)

### 2. **When is data processed?**
Processing happens at **4 key lifecycle points**:
1. **At recommendation time** (read: metrics, activities, variants)
2. **At execution start** (write: impressions, selections, executions)
3. **At execution complete** (write: conversions, update: metrics)
4. **At aggregation time** (batch: recalculate Thompson Sampling parameters)

### 3. **What components are responsible for what data?**
**3-tier architecture with clear separation**:
- **Backend (metabob-rpc-api)**: Owns all SurrealDB data (source of truth)
- **CLI (metabob-cli)**: Bridges MCP calls, maps fields, manages execution state
- **OpenCode (metabob-opencode)**: Orchestrates execution, tracks local session state

### 4. **How do we prevent data duplication?**
**4 deduplication mechanisms**:
1. **Unique indexes** on primary keys (variant_id, execution_id, etc.)
2. **Content-addressable hashing** for variants (same content = same hash)
3. **Idempotent APIs** (re-posting same execution_id is safe)
4. **Single source of truth** (backend owns data, CLI/OpenCode cache only)

### 5. **How do we keep track of core details?**
**5 tracking systems**:
1. **Activity Registry** (activities table): Template metadata
2. **Variant Registry** (activity_variants table): Version history
3. **Execution Log** (activity_executions table): What ran, when, outcome
4. **Recommendation Funnel** (impressions/selections/conversions): CTR tracking
5. **Performance Metrics** (variant_performance_metrics): Aggregated success rates

### 6. **What is the source of each item?**
**Source tracking via metadata fields**:
- `created_by`: "agent" | "manual" | "activity-create" | "commissioning"
- `source`: "manual" | "trailblazing" | "evolution" | "import"
- `source_execution`: execution_id that created this variant
- `parent_hash`: content hash of parent variant (for genealogy)

---

## Part 1: Data Tables and Responsibilities

### Overview: 10 Core Tables

```
┌─────────────────────────────────────────────────────────────┐
│ ACTIVITY SYSTEM TABLES                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. consumer_profiles          - Agent behavior tracking      │
│ 2. activities                 - Activity templates (unified) │
│ 3. activity_variants          - Template versions (A/B test) │
│ 4. activity_impressions       - Recommendations shown        │
│ 5. activity_selections        - Agent choices                │
│ 6. activity_conversions       - Execution outcomes           │
│ 7. activity_executions        - Full execution records       │
│ 8. variant_performance_metrics- Aggregated performance       │
│ 9. impulse_registry           - Impulse tracking             │
│ 10. impulse_usage             - Per-execution impulse usage  │
└─────────────────────────────────────────────────────────────┘
```

---

### Table 1: `consumer_profiles` - Agent Behavior Tracking

**Purpose**: Track agent preferences and success patterns for personalized recommendations

**Created**: When agent first requests recommendations (auto-created)  
**Updated**: After every impression, selection, conversion

**Responsible Component**: `activity_recommendations.py` (backend)

#### Fields
```python
consumer_id: str              # SHA-256 hash of (org_id + project_id + agent_config)
org_id: str                   # Organization identifier
project_id: str               # Project identifier
primary_language: str         # Most common language (learned from executions)
primary_framework: str?       # Most common framework (optional)
tech_stack: list[str]         # Technologies detected in project
selection_history: dict       # Category → activity_id mapping (what agent prefers)
success_rate_by_category: dict# Category → success rate (0-1)
prefers_speed: float          # 0-1 score (learned from selections)
prefers_cost: float           # 0-1 score (learned from selections)
prefers_quality: float        # 0-1 score (learned from selections)
total_impressions: int        # Total activities shown to this agent
total_selections: int         # Total activities selected
total_successes: int          # Total successful executions
overall_ctr: float            # Click-through rate (selections / impressions)
overall_conversion_rate: float# Conversion rate (successes / selections)
created_at: datetime
updated_at: datetime
```

#### Usage Pattern
```python
# 1. GET (auto-create if not exists)
async def _get_or_create_consumer(db, consumer_id) -> ConsumerProfile:
    """Called at recommendation time"""
    
# 2. UPDATE (after impression)
async def _update_consumer_impressions(db, consumer_id):
    """Increment total_impressions by 1"""
    
# 3. UPDATE (after selection)
async def _update_consumer_selections(db, consumer_id):
    """Increment total_selections by 1, recalculate CTR"""
    
# 4. UPDATE (after conversion)
async def _update_consumer_conversions(db, consumer_id, success):
    """Increment total_successes if success=true, recalculate conversion rate"""
```

**Source**: Auto-generated from execution context  
**Deduplication**: UNIQUE index on `consumer_id`

---

### Table 2: `activities` - Activity Templates (Unified)

**Purpose**: Store activity metadata (not the steps - those are in variants)

**Created**: When new activity is registered (manual or via activity-create)  
**Updated**: After each execution (aggregate metrics updated)

**Responsible Component**: `activities.py` (backend)

#### Fields
```python
activity_id: str              # Kebab-case identifier (e.g., "add-feature-complete")
name: str                     # Human-readable name
description: str              # What this activity does
category: str                 # "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
tags: list[str]               # Searchable tags
org_id: str                   # Organization scope (or "global")
project_id: str               # Project scope (or "global")
primary_language: str         # Python, TypeScript, etc.
framework: str?               # Optional framework (React, Django, etc.)
tech_stack: list[str]         # Required technologies
intent_keywords: list[str]    # Keywords for intent matching
intent_patterns: list[str]    # Regex patterns for intent matching
author_id: str?               # Creator (optional)
source: str                   # "manual" | "activity-create" | "import"

# Composition support
is_composed: bool             # Is this a composed activity?
composed_activity_ids: list[str]  # Child activity IDs (if composed)

# Aggregate metrics (from ALL variant executions)
execution_count: int          # Total executions across all variants
success_rate: float           # Overall success rate (0-1)
avg_duration_ms: int          # Average duration
avg_cost: float               # Average cost in USD
avg_tokens: dict              # {input, output, cache}

status: str                   # "active" | "deprecated" | "archived"
created_at: datetime
updated_at: datetime
```

#### Usage Pattern
```python
# 1. SEARCH (recommendation time)
async def get_recommendations(db, request):
    """Query activities by category, intent_keywords"""
    
# 2. GET (execution time)
async def batch_get_activities(db, activity_ids) -> dict[str, Activity]:
    """Fetch multiple activities by ID"""
    
# 3. UPDATE (after execution)
async def _update_activity_metrics(db, activity_id):
    """Aggregate metrics from all variant executions"""
```

**Source**: `source` field tracks origin  
**Deduplication**: UNIQUE index on `activity_id` + org/project scope

---

### Table 3: `activity_variants` - Template Versions

**Purpose**: Store actual task steps and versions (A/B testing support)

**Created**: When activity is created, or variant is commissioned  
**Updated**: Rarely (variants are immutable by design)

**Responsible Component**: `activities.py` + `variant_commissioning.py` (backend)

#### Fields
```python
variant_id: str               # Unique identifier (e.g., "add-feature-complete-v1")
activity_id: str              # Parent activity
variant_name: str             # Human-readable variant name
version: int                  # Version number (1, 2, 3, ...)
description: str              # What's different in this variant
task_steps: list[dict]        # Actual step definitions (proto format)
variables: dict               # Required/optional variables
prompt_strategy: str          # "guided" | "minimal" | "detailed"
context_budget_tokens: int    # Budget per step
expected_duration_ms: int     # Expected execution time
expected_cost: float          # Expected cost in USD
expected_quality_score: float # Expected quality (0-1)

# Genealogy tracking
content_hash: str             # SHA-256 of task_steps (deduplication)
parent_hash: str?             # Content hash of parent variant
lineage: list[str]            # [root_hash, parent_hash, this_hash]
evolution_type: str           # "root" | "trailblazing" | "optimization" | "fix"

status: str                   # "testing" | "active" | "deprecated"
created_at: datetime
```

#### Usage Pattern
```python
# 1. GET (recommendation/execution time)
async def get_variant(db, variant_id) -> ActivityVariant:
    """Fetch variant with task steps"""
    
async def batch_get_variants(db, variant_ids) -> dict[str, ActivityVariant]:
    """Fetch multiple variants efficiently"""
    
# 2. CREATE (commissioning time)
async def create_variant(db, variant_data) -> ActivityVariant:
    """Create new variant, calculate content_hash, check for duplicates"""
```

**Source**: `evolution_type` tracks how variant was created  
**Deduplication**: UNIQUE index on `variant_id`, content-addressable via `content_hash`

---

### Table 4: `activity_impressions` - Recommendations Shown

**Purpose**: Track which activities were shown to agents (CTR funnel - step 1)

**Created**: When recommendations are returned to agent  
**Updated**: When agent selects one (mark `was_selected=true`)

**Responsible Component**: `activity_recommendations.py` (backend)

#### Fields
```python
impression_id: str            # Unique identifier (e.g., "imp_abc123")
consumer_id: str              # Agent identifier
session_id: str               # Session identifier
variant_id: str               # Variant shown
activity_id: str              # Activity shown
intent: str                   # User's intent string
rank: int                     # Position in recommendation list (1, 2, 3, ...)
total_shown: int              # How many recommendations were shown total
predicted_ctr: float          # Predicted click-through rate (0-1)
predicted_conversion: float   # Predicted conversion rate (0-1)
expected_value: float         # CTR × Conversion × Quality
experiment_id: str?           # A/B test experiment ID (optional)
treatment_group: str?         # "control" | "treatment" (optional)
was_selected: bool            # Did agent select this? (updated later)
selection_time_ms: int?       # Time to decision (updated later)
shown_at: datetime            # When impression created
selected_at: datetime?        # When selected (updated later)
```

#### Usage Pattern
```python
# 1. CREATE (after generating recommendations)
async def record_impression(db, impression: ActivityImpression):
    """Store impression record"""
    await db.create("activity_impressions", impression.model_dump())
    await _increment_variant_impressions(db, impression.variant_id)
    
# 2. UPDATE (when agent selects)
async def record_selection(db, notification: SelectionNotification):
    """Mark impression as selected"""
    await db.update(
        f"activity_impressions:{impression_id}",
        {"was_selected": True, "selection_time_ms": ..., "selected_at": ...}
    )
```

**Source**: Generated by recommendation engine  
**Deduplication**: UNIQUE index on `impression_id`

---

### Table 5: `activity_selections` - Agent Choices

**Purpose**: Track which activities agents chose to execute (CTR funnel - step 2)

**Created**: When agent starts execution (via `/v2/activities/record/start`)  
**Updated**: When execution completes (mark `converted=true`)

**Responsible Component**: `activity_recommendations.py` (backend)

#### Fields
```python
selection_id: str             # Unique identifier (e.g., "sel_abc123")
impression_id: str            # Link to impression
consumer_id: str              # Agent identifier
variant_id: str               # Variant selected
activity_id: str              # Activity selected
time_to_decision_ms: int      # How long agent took to choose
competing_options: int        # How many other options were available
execution_id: str             # Link to execution
converted: bool               # Did execution succeed? (updated later)
conversion_quality: float?    # Quality score (updated later)
selected_at: datetime         # When selected
execution_completed_at: datetime?  # When execution finished (updated later)
```

#### Usage Pattern
```python
# 1. CREATE (at execution start)
async def record_selection(db, notification: SelectionNotification):
    """Store selection record"""
    await db.create("activity_selections", selection.model_dump())
    await _increment_variant_selections(db, variant_id)
    
# 2. UPDATE (at execution complete)
async def _create_conversion(db, execution, quality_scores, variant):
    """Mark selection as converted"""
    await db.query("""
        UPDATE activity_selections 
        SET converted = true, 
            conversion_quality = $quality,
            execution_completed_at = time::now()
        WHERE selection_id = $selection_id
    """)
```

**Source**: Generated when agent calls `activity()` tool  
**Deduplication**: UNIQUE index on `selection_id`

---

### Table 6: `activity_conversions` - Execution Outcomes

**Purpose**: Track execution results with quality scores (CTR funnel - step 3)

**Created**: When execution completes (auto-created from execution record)  
**Updated**: Never (immutable record)

**Responsible Component**: `activities.py` → `_create_conversion()` (backend)

#### Fields
```python
conversion_id: str            # Unique identifier (e.g., "conv_abc123")
selection_id: str             # Link to selection
execution_id: str             # Link to execution
consumer_id: str              # Agent identifier
variant_id: str               # Variant executed
activity_id: str              # Activity executed
success: bool                 # Did execution succeed?
duration_ms: int              # Actual duration
cost: float                   # Actual cost in USD
tokens_used: dict             # {input, output, cache}
quality_score: float          # Overall quality (0-1)
correctness_score: float      # Correctness (0-1)
speed_score: float            # Speed vs expected (0-1)
efficiency_score: float       # Cost vs expected (0-1)
duration_delta_ms: int        # Actual - expected (positive = slower)
cost_delta: float             # Actual - expected (positive = more expensive)
converted_at: datetime        # When conversion recorded
```

#### Quality Score Calculation
```python
def _calculate_quality_scores(
    correctness: float,        # User-provided or default 0.5
    actual_duration: int,
    expected_duration: int,
    actual_cost: float,
    expected_cost: float,
) -> dict[str, float]:
    # Speed: faster is better (max 2.0, normalized to 0-1)
    speed_score = min(2.0, expected_duration / actual_duration) / 2.0
    
    # Efficiency: cheaper is better (max 2.0, normalized to 0-1)
    efficiency_score = min(2.0, expected_cost / actual_cost) / 2.0
    
    # Overall: weighted average
    overall = 0.6 * correctness + 0.2 * speed_score + 0.2 * efficiency_score
    
    return {"overall": overall, "correctness": correctness, 
            "speed": speed_score, "efficiency": efficiency_score}
```

#### Usage Pattern
```python
# 1. CREATE (auto-created when execution completes)
async def record_activity_execution(db, request: RecordExecutionRequest):
    """When execution completes, auto-create conversion if selection_id exists"""
    if request.selection_id:
        conversion_id = await _create_conversion(db, execution, quality_scores, variant)
        
# 2. READ (for metrics aggregation)
async def _update_variant_metrics(db, execution, variant):
    """Query all conversions for this variant to recalculate metrics"""
    conversions = await db.query(
        "SELECT * FROM activity_conversions WHERE variant_id = $variant_id"
    )
```

**Source**: Auto-generated from execution  
**Deduplication**: UNIQUE index on `conversion_id`

---

### Table 7: `activity_executions` - Full Execution Records

**Purpose**: Complete execution history with task-level details

**Created**: When execution starts (via `/v2/activities/record/start`)  
**Updated**: When execution completes, when each step completes

**Responsible Component**: `activities.py` (backend)

#### Fields
```python
# Identity & Links
execution_id: str             # Unique identifier (e.g., "exec_abc123")
activity_id: str              # Activity executed
variant_id: str               # Variant executed
org_id: str                   # Organization
project_id: str               # Project
user_id: str                  # User/agent identifier
project_hash: str             # Project context hash
session_id: str?              # Session identifier (optional)

# Recommendation links (if execution came from recommendation)
impression_id: str?           # Link to impression (optional)
selection_id: str?            # Link to selection (optional)
conversion_id: str?           # Link to conversion (added later)

# Timing
timestamp: float              # Unix timestamp (start time)
duration: int                 # Duration in ms

# Outcome
success: bool                 # Did execution succeed?
failure_reason: str?          # Error message if failed

# Cost
total_cost: float             # Total cost in USD
total_tokens: dict            # {input, output, cache}

# Quality metrics
quality_scores: dict          # {correctness, speed, efficiency, overall}
correctness_score: float      # Correctness (0-1, default 0.5)

# Detailed execution data
tasks: list[dict]             # Task-level results
  # Task object fields:
  # - task_index: int
  # - task_name: str
  # - status: "completed" | "failed" | "skipped"
  # - duration_ms: int
  # - tokens: {input, output}
  # - cost: float
  # - error: str? (if failed)
  # - tool_calls: int
  # - recorded_at: str (ISO datetime)

environment: dict             # Execution environment details
patterns: list[str]           # Detected code patterns
metabob: dict                 # Metabob integration data

# Phase 2: Learning loop data
impulses_used: list[dict]     # Impulses loaded during execution
component_changes: list[dict] # Components modified

created_at: datetime
```

#### Usage Pattern
```python
# 1. CREATE (at execution start)
async def record_activity_execution(db, request: RecordExecutionRequest):
    """Create execution record with initial data"""
    execution = ActivityExecution(
        execution_id=request.execution_id,
        activity_id=request.activity_id,
        variant_id=request.variant_id,
        ...
    )
    await db.create("activity_executions", execution.model_dump())
    
# 2. UPDATE (at execution complete)
# Auto-triggers:
#   - Conversion creation (if selection_id exists)
#   - Variant metrics update
#   - Activity metrics update
#   - Variant commissioning check (if trailblazing detected)

# 3. READ (for debugging, analytics, variant commissioning)
async def get_execution(db, execution_id) -> ActivityExecution:
    """Fetch execution record for analysis"""
```

**Source**: `source_execution` field in variants tracks which execution created them  
**Deduplication**: UNIQUE index on `execution_id`, idempotent (can re-post same execution_id)

---

### Table 8: `variant_performance_metrics` - Aggregated Performance

**Purpose**: Pre-aggregated metrics for fast recommendation queries (CTR funnel - reporting)

**Created**: When variant is created (initialized with zeros)  
**Updated**: After every impression, selection, conversion

**Responsible Component**: `activity_recommendations.py` (backend)

#### Fields
```python
variant_id: str               # Variant identifier
activity_id: str              # Parent activity

# Funnel metrics
total_impressions: int        # How many times shown
total_selections: int         # How many times selected
total_conversions: int        # How many successful executions
ctr: float                    # Click-through rate (selections / impressions)
conversion_rate: float        # Conversion rate (conversions / selections)
overall_conversion: float     # Overall rate (conversions / impressions)

# Quality metrics
avg_quality_score: float      # Average overall quality
avg_correctness: float        # Average correctness
avg_speed_score: float        # Average speed score
avg_efficiency_score: float   # Average efficiency score

# Cost metrics
avg_duration_ms: int          # Average duration
avg_cost: float               # Average cost in USD
avg_tokens: dict              # {input, output, cache}

# Recommendation scoring
expected_value: float         # CTR × Conversion × Quality (for sorting)
thompson_alpha: float         # Thompson Sampling: success + 1
thompson_beta: float          # Thompson Sampling: failure + 1
ucb_score: float              # Upper Confidence Bound score
confidence_score: float       # Statistical confidence (based on sample size)

# Segmentation (future)
performance_by_consumer_segment: dict  # Personalization data

# Timestamps
first_impression_at: datetime?
last_impression_at: datetime?
last_updated_at: datetime
```

#### Thompson Sampling Algorithm
```python
# Bayesian multi-armed bandit for recommendation optimization

# Parameters:
#   - alpha: success count + 1 (prior)
#   - beta: failure count + 1 (prior)

# Selection:
#   sample = random.beta(alpha, beta)  # Sample from Beta distribution
#   # Variants with higher alpha/beta ratio more likely to be selected

# Update:
#   if success:
#       alpha += 1
#   else:
#       beta += 1
```

#### Usage Pattern
```python
# 1. CREATE (when variant created)
async def _initialize_variant_metrics(db, variant_id, activity_id):
    """Initialize with default values"""
    metrics = {
        "variant_id": variant_id,
        "total_impressions": 0,
        "total_selections": 0,
        "total_conversions": 0,
        "ctr": 0.0,
        "conversion_rate": 0.0,
        "thompson_alpha": 1.0,  # Prior: uniform distribution
        "thompson_beta": 1.0,
        ...
    }
    await db.create("variant_performance_metrics", metrics)
    
# 2. UPDATE (after impression)
async def _increment_variant_impressions(db, variant_id):
    """Increment impression count"""
    await db.query("""
        UPDATE variant_performance_metrics
        SET total_impressions += 1,
            last_impression_at = time::now()
        WHERE variant_id = $variant_id
    """)
    
# 3. UPDATE (after selection)
async def _increment_variant_selections(db, variant_id):
    """Increment selection count, recalculate CTR"""
    await db.query("""
        UPDATE variant_performance_metrics
        SET total_selections += 1
        WHERE variant_id = $variant_id
    """)
    await _recalculate_variant_rates(db, variant_id)
    
# 4. UPDATE (after conversion)
async def _update_variant_conversion(db, variant_id, conversion):
    """Increment conversion count, update Thompson parameters"""
    if conversion.success:
        await db.query("""
            UPDATE variant_performance_metrics
            SET total_conversions += 1
            WHERE variant_id = $variant_id
        """)
        
    # Update Thompson Sampling
    await _update_thompson_parameters(db, variant_id, conversion.success)
    
# 5. READ (for recommendations)
async def _fetch_variant_metrics(db, variant_ids) -> dict[str, Metrics]:
    """Fetch metrics for recommendation scoring"""
```

**Source**: Auto-generated from funnel events  
**Deduplication**: UNIQUE index on `variant_id`, atomic increments

---

### Table 9: `impulse_registry` - Impulse Tracking

**Purpose**: Track impulse effectiveness over time

**Created**: When impulse is first used in an execution  
**Updated**: After each execution that uses this impulse

**Responsible Component**: `activities.py` (backend - Phase 2)

#### Fields
```python
impulse_id: str               # Impulse identifier
content_hash: str             # SHA-256 of impulse content
impulse_type: str             # "file" | "memo" | "metabob-priorities" | etc.
pointer: dict                 # Impulse pointer (type, path/data)
first_seen: datetime          # When first used
last_used: datetime           # When last used
usage_count: int              # How many times used
success_count: int            # How many successful executions
failure_count: int            # How many failed executions
effectiveness_rate: float     # success_count / usage_count
org_id: str                   # Organization scope
project_id: str               # Project scope
created_at: datetime
```

#### Usage Pattern
```python
# 1. CREATE or UPDATE (when execution completes)
async def record_impulse_usage(db, execution_id, impulse):
    """Track impulse usage in execution"""
    # Check if impulse exists
    registry = await db.query(
        "SELECT * FROM impulse_registry WHERE content_hash = $hash",
        {"hash": impulse.content_hash}
    )
    
    if registry:
        # Update existing
        await db.query("""
            UPDATE impulse_registry
            SET usage_count += 1,
                success_count += $success,
                failure_count += $failure,
                effectiveness_rate = success_count / usage_count,
                last_used = time::now()
            WHERE content_hash = $hash
        """)
    else:
        # Create new
        await db.create("impulse_registry", {...})
```

**Source**: Auto-detected from execution impulse space  
**Deduplication**: UNIQUE index on `content_hash`, content-addressable

---

### Table 10: `impulse_usage` - Per-Execution Impulse Usage

**Purpose**: Track which impulses were used in each execution step

**Created**: During execution (when steps report impulse usage)  
**Updated**: Never (immutable log)

**Responsible Component**: `activities.py` (backend - Phase 2)

#### Fields
```python
execution_id: str             # Execution identifier
step_id: str                  # Step identifier
step_index: int               # Step number (0, 1, 2, ...)
impulse_id: str               # Impulse identifier
content_hash: str             # Impulse content hash
was_useful: bool              # Did agent use this impulse? (default: true)
tokens_loaded: int            # Tokens consumed
step_succeeded: bool          # Did step succeed?
org_id: str                   # Organization scope
project_id: str               # Project scope
session_id: str               # Session identifier
timestamp: datetime           # When used
```

#### Usage Pattern
```python
# 1. CREATE (during execution)
async def record_step_impulse_usage(db, execution_id, step_id, impulse):
    """Log impulse usage for a step"""
    await db.create("impulse_usage", {
        "execution_id": execution_id,
        "step_id": step_id,
        "impulse_id": impulse.id,
        "content_hash": impulse.content_hash,
        "tokens_loaded": impulse.tokenCount,
        ...
    })
    
# 2. QUERY (for impulse effectiveness analysis)
async def analyze_impulse_effectiveness(db, impulse_id):
    """Find all usages of this impulse"""
    usages = await db.query("""
        SELECT execution_id, step_succeeded, tokens_loaded
        FROM impulse_usage
        WHERE impulse_id = $impulse_id
        ORDER BY timestamp DESC
    """)
```

**Source**: Reported by OpenCode during execution  
**Deduplication**: No unique constraint (multiple rows per execution/impulse)

---

## Part 2: Data Flow Lifecycle

### Flow 1: Activity Recommendation → Execution → Conversion

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1: RECOMMENDATION (Read-Heavy)                           │
└────────────────────────────────────────────────────────────────┘

1. OpenCode calls: activity({activityId: "add-feature", ...})
   ↓
2. CLI MCP tool: search_activities(query="add-feature")
   ↓
3. Backend API: GET /v2/activities/templates?search=add-feature
   ↓
4. SurrealDB READS:
   - activities (WHERE intent_keywords CONTAINS "feature")
   - activity_variants (WHERE activity_id IN [...] AND status = 'active')
   - variant_performance_metrics (WHERE variant_id IN [...])
   ↓
5. Backend runs Thompson Sampling:
   - Sample from Beta(alpha, beta) for each variant
   - Sort by sample value (descending)
   - Return top 5 recommendations
   ↓
6. Backend WRITES:
   - activity_impressions (for each recommendation shown)
   - variant_performance_metrics (increment total_impressions)
   - consumer_profiles (increment total_impressions)
   ↓
7. Return recommendations to CLI → OpenCode

┌────────────────────────────────────────────────────────────────┐
│ PHASE 2: EXECUTION START (Write-Heavy)                         │
└────────────────────────────────────────────────────────────────┘

1. OpenCode selects variant, calls: start_execution(variant_id, ...)
   ↓
2. CLI MCP tool: activity_tool({activityId: variant_id, ...})
   ↓
3. Backend API: POST /v2/activities/record/start
   ↓
4. SurrealDB WRITES:
   - activity_selections (create selection record)
   - activity_executions (create execution record)
   ↓
5. SurrealDB UPDATES:
   - activity_impressions (SET was_selected=true)
   - variant_performance_metrics (total_selections += 1)
   - consumer_profiles (total_selections += 1)
   ↓
6. Return execution_id to CLI → OpenCode

┌────────────────────────────────────────────────────────────────┐
│ PHASE 3: EXECUTION LOOP (Mixed Read/Write)                     │
└────────────────────────────────────────────────────────────────┘

For each step in variant:
   1. OpenCode executes step
   2. Reports step result: POST /v2/activities/record/step
   3. SurrealDB WRITES:
      - activity_executions (UPDATE tasks array, append step result)
      - impulse_usage (if impulses used)

┌────────────────────────────────────────────────────────────────┐
│ PHASE 4: EXECUTION COMPLETE (Write-Heavy + Aggregation)        │
└────────────────────────────────────────────────────────────────┘

1. OpenCode calls: report_complete(execution_id, success, metrics)
   ↓
2. Backend API: POST /v2/activities/record/complete
   ↓
3. SurrealDB WRITES:
   - activity_executions (UPDATE: success, duration, cost, quality_scores)
   - activity_conversions (CREATE: auto-generated from execution)
   ↓
4. SurrealDB UPDATES:
   - activity_selections (SET converted=true, conversion_quality=...)
   - variant_performance_metrics (total_conversions += 1, recalculate rates)
   - variant_performance_metrics (Thompson: alpha += 1 if success, else beta += 1)
   - consumer_profiles (total_successes += 1 if success, recalculate rates)
   - impulse_registry (UPDATE usage_count, success_count, effectiveness_rate)
   ↓
5. SurrealDB AGGREGATIONS:
   - Recalculate variant CTR, conversion rate, expected value
   - Update activity aggregate metrics (sum across all variants)
   ↓
6. Check for variant commissioning:
   - If execution shows significant improvement → auto-create new variant
   ↓
7. Return completion status to CLI → OpenCode
```

---

### Flow 2: Variant Commissioning (Auto-Evolution)

```
┌────────────────────────────────────────────────────────────────┐
│ TRIGGER: Successful execution with novel approach detected     │
└────────────────────────────────────────────────────────────────┘

1. Execution completes (success=true)
   ↓
2. Backend checks: should_commission_variant(execution)
   ↓
3. Decision criteria:
   - Did execution use different impulses than template specified?
   - Was quality significantly higher than expected?
   - Did execution take novel approach (detected via component_changes)?
   ↓
4. If YES: commission_variant_from_execution(execution_id)
   ↓
5. SurrealDB READS:
   - activity_executions (get execution details)
   - activity_variants (get source variant)
   ↓
6. Extract differences:
   - impulses_used vs template impulse_refs
   - actual task flow vs template task_steps
   - component_changes (which components were modified)
   ↓
7. Generate new variant:
   - Copy source variant
   - Apply discovered improvements
   - Calculate content_hash
   - Check for duplicates (same content_hash = don't create)
   ↓
8. SurrealDB WRITES:
   - activity_variants (CREATE new variant)
   - variant_performance_metrics (INITIALIZE new variant metrics)
   ↓
9. Link genealogy:
   - parent_hash = source variant content_hash
   - evolution_type = "trailblazing"
   - lineage = [root, parent, this]
   ↓
10. Log commissioning event
```

---

## Part 3: Data Deduplication Strategies

### 1. Unique Indexes (Database-Level)

**Prevents**: Duplicate primary keys

```sql
-- All primary keys have unique indexes
DEFINE INDEX variant_id_idx ON activity_variants FIELDS variant_id UNIQUE;
DEFINE INDEX execution_id_idx ON activity_executions FIELDS execution_id UNIQUE;
DEFINE INDEX impression_id_idx ON activity_impressions FIELDS impression_id UNIQUE;
DEFINE INDEX selection_id_idx ON activity_selections FIELDS selection_id UNIQUE;
DEFINE INDEX conversion_id_idx ON activity_conversions FIELDS conversion_id UNIQUE;
```

**Behavior**: If you try to insert duplicate ID → SurrealDB returns error → application handles gracefully

---

### 2. Content-Addressable Hashing (Application-Level)

**Prevents**: Duplicate variants with same task steps

```python
def calculate_content_hash(task_steps: list) -> str:
    """Generate SHA-256 hash of task steps"""
    content = json.dumps(task_steps, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()

# Before creating variant:
content_hash = calculate_content_hash(variant.task_steps)

# Check if variant with same content exists
existing = await db.query(
    "SELECT * FROM activity_variants WHERE content_hash = $hash",
    {"hash": content_hash}
)

if existing:
    return existing[0]  # Return existing variant instead of creating duplicate
else:
    # Create new variant with content_hash
    await db.create("activity_variants", {...})
```

**Benefit**: Two variants with identical task steps → same hash → detected as duplicate → reuse existing

---

### 3. Idempotent APIs (Application-Level)

**Prevents**: Duplicate execution records if client retries

```python
# Client sends same execution_id on retry
POST /v2/activities/record/complete
{
  "execution_id": "exec_abc123",  # Same ID
  "success": true,
  ...
}

# Backend checks if execution already completed
existing = await db.query(
    "SELECT * FROM activity_executions WHERE execution_id = $id",
    {"id": request.execution_id}
)

if existing and existing[0]["success"] is not None:
    # Already completed, return success (idempotent)
    return {"status": "already_completed", "execution_id": request.execution_id}
else:
    # First time completing, process normally
    ...
```

**Benefit**: Network retry → same execution_id → detected → no duplicate record

---

### 4. Single Source of Truth (Architecture-Level)

**Prevents**: Data divergence between systems

**Rule**: Backend (metabob-rpc-api) is authoritative source for all data

```
┌─────────────────────────────────────────────────────────────┐
│ DATA OWNERSHIP                                               │
├─────────────────────────────────────────────────────────────┤
│ Backend (SurrealDB)     - OWNS data (source of truth)       │
│ CLI (metabob-cli)       - CACHES data (invalidates on change)│
│ OpenCode (TypeScript)   - DISPLAYS data (fetches on demand) │
└─────────────────────────────────────────────────────────────┘

# Example: Variant lookup
# OpenCode never stores variant → always fetches from CLI → CLI fetches from Backend

# CLI caching strategy:
class ActivityManager:
    def __init__(self):
        self._variant_cache = {}  # Short-lived cache (TTL: 5 minutes)
        
    async def get_variant(self, variant_id):
        # Check cache
        if variant_id in self._variant_cache:
            cached, timestamp = self._variant_cache[variant_id]
            if time.time() - timestamp < 300:  # 5 minutes
                return cached
        
        # Fetch from backend (source of truth)
        variant = await self.client.get(f"/v2/activities/templates/{variant_id}")
        
        # Update cache
        self._variant_cache[variant_id] = (variant, time.time())
        
        return variant
```

**Benefit**: No data conflicts, cache is only for performance, backend always wins

---

## Part 4: Core Details Tracking

### Detail 1: Who Created This Variant?

**Tracked via**: `author_id`, `source`, `evolution_type` fields

```python
# Manual creation
variant = {
    "author_id": "user_john_doe",
    "source": "manual",
    "evolution_type": "root",
    "created_at": datetime.now()
}

# Activity-create creation
variant = {
    "author_id": "activity-create",
    "source": "activity-create",
    "evolution_type": "root",
    "source_execution": "exec_creation_123",  # Which execution created this
    "created_at": datetime.now()
}

# Variant commissioning (auto-evolution)
variant = {
    "author_id": "commissioning-system",
    "source": "trailblazing",
    "evolution_type": "trailblazing",
    "source_execution": "exec_trailblaze_456",
    "parent_hash": "abc123...",  # Parent variant
    "created_at": datetime.now()
}
```

**Query Example**:
```python
# Find all variants created by activity-create
results = await db.query("""
    SELECT * FROM activity_variants
    WHERE author_id = 'activity-create'
    ORDER BY created_at DESC
""")

# Find all trailblazing variants
results = await db.query("""
    SELECT * FROM activity_variants
    WHERE evolution_type = 'trailblazing'
""")
```

---

### Detail 2: When Was This Executed?

**Tracked via**: `created_at` in `activity_executions`, `converted_at` in `activity_conversions`

```python
# Find all executions in last 7 days
results = await db.query("""
    SELECT * FROM activity_executions
    WHERE created_at > time::now() - 7d
    ORDER BY created_at DESC
""")

# Find successful executions for specific variant
results = await db.query("""
    SELECT * FROM activity_executions
    WHERE variant_id = $variant_id
      AND success = true
    ORDER BY created_at DESC
    LIMIT 10
""", {"variant_id": "add-feature-complete-v1"})
```

---

### Detail 3: How Well Is This Variant Performing?

**Tracked via**: `variant_performance_metrics` table

```python
# Get variant performance
metrics = await db.query("""
    SELECT variant_id, 
           total_impressions,
           total_selections,
           total_conversions,
           ctr,
           conversion_rate,
           overall_conversion,
           avg_quality_score,
           avg_cost,
           avg_duration_ms,
           thompson_alpha,
           thompson_beta,
           confidence_score
    FROM variant_performance_metrics
    WHERE variant_id = $variant_id
""", {"variant_id": "add-feature-complete-v1"})

# Interpret results:
# - CTR = 15% means 15% of times shown, agent selected it
# - Conversion rate = 85% means 85% of executions succeeded
# - Overall conversion = 12.75% means 12.75% of impressions led to success
# - Thompson alpha=120, beta=20 means 100 successes, 19 failures (ratio 6:1)
```

---

### Detail 4: What Components Were Modified?

**Tracked via**: `component_changes` field in `activity_executions`

```python
execution = {
    "execution_id": "exec_abc123",
    "component_changes": [
        {
            "file": "src/auth.ts",
            "component": "authenticate",
            "component_type": "function",
            "change_type": "modified",
            "lines_added": 15,
            "lines_removed": 8
        },
        {
            "file": "test/auth.test.ts",
            "component": "authenticate_tests",
            "component_type": "test",
            "change_type": "added",
            "lines_added": 50,
            "lines_removed": 0
        }
    ]
}

# Query: Find all executions that modified specific component
results = await db.query("""
    SELECT execution_id, variant_id, success, created_at
    FROM activity_executions
    WHERE component_changes[*].file CONTAINS 'src/auth.ts'
      AND component_changes[*].component CONTAINS 'authenticate'
    ORDER BY created_at DESC
""")
```

---

### Detail 5: Which Impulses Were Used?

**Tracked via**: `impulses_used` field in `activity_executions`, `impulse_usage` table

```python
execution = {
    "execution_id": "exec_abc123",
    "impulses_used": [
        {
            "impulse_id": "metabob-priorities-01KHDK",
            "impulse_type": "metabob-priorities",
            "tokens_loaded": 1500,
            "was_useful": true
        },
        {
            "impulse_id": "file-src-auth-ts",
            "impulse_type": "file",
            "tokens_loaded": 2100,
            "was_useful": true
        }
    ]
}

# Query: Find which impulses are most effective
results = await db.query("""
    SELECT impulse_id, 
           impulse_type,
           usage_count,
           success_count,
           effectiveness_rate
    FROM impulse_registry
    WHERE effectiveness_rate > 0.8
    ORDER BY usage_count DESC
    LIMIT 10
""")
```

---

## Part 5: When Is Data Processed?

### Processing Time 1: Recommendation Time (Read-Heavy)

**Frequency**: Every time agent calls `activity()` tool  
**Duration**: 50-200ms  
**Operations**:
```python
# 1. Read activities by intent/category (10-30ms)
activities = await db.query("SELECT * FROM activities WHERE ...")

# 2. Read variants for matching activities (20-50ms)
variants = await db.query("SELECT * FROM activity_variants WHERE ...")

# 3. Read performance metrics for variants (20-50ms)
metrics = await db.query("SELECT * FROM variant_performance_metrics WHERE ...")

# 4. Thompson Sampling (in-memory, 1-5ms)
for variant in variants:
    sample = np.random.beta(metrics.thompson_alpha, metrics.thompson_beta)
    
# 5. Write impressions (10-30ms)
await db.create("activity_impressions", {...})
```

---

### Processing Time 2: Execution Start (Write-Heavy)

**Frequency**: Every time execution starts  
**Duration**: 30-100ms  
**Operations**:
```python
# 1. Create selection record (10-20ms)
await db.create("activity_selections", {...})

# 2. Create execution record (10-20ms)
await db.create("activity_executions", {...})

# 3. Update impression (10-20ms)
await db.update("activity_impressions:...", {was_selected: true})

# 4. Increment variant metrics (10-20ms)
await db.query("UPDATE variant_performance_metrics SET total_selections += 1 ...")

# 5. Increment consumer metrics (10-20ms)
await db.query("UPDATE consumer_profiles SET total_selections += 1 ...")
```

---

### Processing Time 3: Execution Complete (Write-Heavy + Aggregation)

**Frequency**: Every time execution completes  
**Duration**: 100-500ms  
**Operations**:
```python
# 1. Update execution record (10-20ms)
await db.update("activity_executions:...", {success: true, duration: ..., cost: ...})

# 2. Create conversion record (10-20ms)
await db.create("activity_conversions", {...})

# 3. Update selection (10-20ms)
await db.update("activity_selections:...", {converted: true, conversion_quality: ...})

# 4. Increment variant conversions (10-20ms)
await db.query("UPDATE variant_performance_metrics SET total_conversions += 1 ...")

# 5. Update Thompson Sampling parameters (10-20ms)
await db.query("UPDATE variant_performance_metrics SET thompson_alpha += 1 ...")

# 6. Recalculate variant rates (50-150ms) ⚠️ EXPENSIVE
# This queries all conversions for the variant and recalculates aggregates
conversions = await db.query("SELECT * FROM activity_conversions WHERE variant_id = ...")
avg_quality = sum(c.quality_score for c in conversions) / len(conversions)
avg_cost = sum(c.cost for c in conversions) / len(conversions)
# ... etc

# 7. Update activity aggregate metrics (50-150ms) ⚠️ EXPENSIVE
# This queries all executions for the activity across all variants
executions = await db.query("SELECT * FROM activity_executions WHERE activity_id = ...")
success_rate = sum(e.success for e in executions) / len(executions)
# ... etc

# 8. Check variant commissioning (0-500ms, conditional)
# Only if execution shows significant improvement
if await should_commission_variant(execution):
    await commission_variant_from_execution(execution_id)
```

**Optimization Opportunities**:
- Recalculation is expensive (queries all conversions)
- Could be made incremental (update running averages instead of recalculating)
- Could be batched (recalculate every N executions instead of every execution)

---

### Processing Time 4: Background Aggregation (Batch)

**Frequency**: Periodic (every 1 hour, configurable)  
**Duration**: 1-10 seconds  
**Operations**:
```python
# 1. Recalculate all variant metrics (in case incremental updates missed anything)
for variant in all_variants:
    await _recalculate_variant_rates(db, variant.variant_id)

# 2. Recalculate all activity metrics
for activity in all_activities:
    await _update_activity_metrics(db, activity.activity_id)

# 3. Cleanup stale impressions (older than 30 days)
await db.query("DELETE FROM activity_impressions WHERE shown_at < time::now() - 30d")

# 4. Archive old executions (older than 90 days, success rate < 0.5)
await db.query("""
    UPDATE activity_executions 
    SET archived = true 
    WHERE created_at < time::now() - 90d 
      AND success = false
""")
```

---

## Part 6: Component Responsibilities

### Component 1: metabob-rpc-api (Backend) - Data Authority

**Role**: Source of truth for all SurrealDB data

**Responsibilities**:
1. **Data Storage**: All writes go through backend APIs
2. **Data Integrity**: Schema validation, unique constraints
3. **Business Logic**: Aggregations, Thompson Sampling updates
4. **Access Control**: Authentication, authorization (org/project scoping)

**Key Files**:
```
server/actions/activities.py              - CRUD for activities, variants, executions
server/actions/activity_recommendations.py- Recommendation engine, funnel tracking
server/actions/variant_commissioning.py   - Auto-variant creation
server/routes/v2_activities.py            - API endpoints
server/models/activity_recommendation.py  - Data models (Pydantic)
server/utils/surreal_client.py            - SurrealDB client wrapper
```

**API Endpoints**:
```python
# Recommendation
GET  /v2/activities/templates               - Search activities/variants
POST /v2/activities/recommendations         - Get recommendations (with Thompson Sampling)

# Execution lifecycle
POST /v2/activities/record/start            - Start execution (create selection + execution)
POST /v2/activities/record/step             - Record step result
POST /v2/activities/record/complete         - Complete execution (create conversion)

# Variant management
GET  /v2/activities/templates/{id}          - Get variant details
POST /v2/activities/templates/create        - Create new variant
POST /v2/activities/templates/create_variant- Create variant from execution

# Metrics
GET  /v2/activities/metrics/{variant_id}    - Get variant performance metrics
GET  /v2/activities/debug/thompson-state    - Debug Thompson Sampling state
```

---

### Component 2: metabob-cli (MCP Bridge) - Field Mapping & Execution Management

**Role**: Translate between OpenCode (camelCase) and Backend (snake_case)

**Responsibilities**:
1. **Field Mapping**: Convert field names between conventions
2. **MCP Server**: Implement MCP tool interfaces
3. **Execution Management**: Track execution state, coordinate steps
4. **Caching**: Short-lived cache for variant details

**Key Files**:
```
src/metabob_cli/mcp/tools.py               - MCP tool implementations
src/metabob_cli/mcp/activity_manager.py    - Execution coordination
src/metabob_cli/core/runtime_config.py     - Configuration management
```

**Field Mapping Example**:
```python
# Backend returns snake_case
backend_response = {
    "variant_id": "add-feature-complete-v1",
    "variant_name": "Add Feature Complete",
    "task_steps": [...],
    "impulse_refs": [...],
    "expected_duration_ms": 60000,
    "expected_cost": 0.5,
    "created_at": "2025-02-15T10:00:00Z"
}

# CLI maps to camelCase for OpenCode
opencode_response = {
    "id": backend_response["variant_id"],
    "name": backend_response["variant_name"],
    "tasks": backend_response["task_steps"],
    "impulseReferences": backend_response["impulse_refs"],
    "estimatedDurationMs": backend_response["expected_duration_ms"],
    "estimatedCost": backend_response["expected_cost"],
    "createdAt": backend_response["created_at"]
}
```

**MCP Tools**:
```python
# Tool: search_activities
async def search_activities_tool(query: str, limit: int = 10):
    """Search for activity templates"""
    manager = get_activity_manager(base_url, session_token)
    templates = await manager.search_activities(query, limit)
    return {"status": "success", "templates": templates}

# Tool: activity (execution)
async def activity_tool(activity_id: str, variables: dict, reason: str):
    """Execute activity template"""
    manager = get_activity_manager(base_url, session_token)
    execution_id = await manager.start_execution(activity_id, variables, reason)
    return {"status": "started", "execution_id": execution_id}

# Tool: report_complete
async def report_complete_tool(execution_id: str, success: bool, metrics: dict):
    """Report execution completion"""
    manager = get_activity_manager(base_url, session_token)
    await manager.complete_execution(execution_id, success, metrics)
    return {"status": "completed"}
```

---

### Component 3: metabob-opencode (Frontend) - Execution Orchestration

**Role**: Execute activity steps, manage impulse space, display results

**Responsibilities**:
1. **Step Execution**: Run each task step with agent
2. **Impulse Management**: Load impulses, build context
3. **User Interface**: Display progress, results
4. **Session Tracking**: Track file modifications, session state (in-memory)

**Key Files**:
```
packages/opencode/src/tool/activity.ts     - Activity tool implementation
packages/opencode/src/session/activity.ts  - Activity execution logic
packages/opencode/src/session/impulse.ts   - Impulse space management
packages/opencode/src/session/context.ts   - Session context tracking (IN-MEMORY)
```

**Data Flow**:
```typescript
// OpenCode does NOT store SurrealDB data
// It only:
// 1. Fetches data via CLI MCP calls
// 2. Executes steps
// 3. Reports results back via CLI

// Example: Activity execution
async function executeActivity(activityId: string, variables: any) {
  // 1. Fetch variant via MCP (CLI → Backend)
  const variant = await mcpClient.call("search_activities", {query: activityId})
  
  // 2. Start execution via MCP (CLI → Backend writes to SurrealDB)
  const {execution_id} = await mcpClient.call("start_execution", {
    activity_id: activityId,
    variables,
    session_id: getCurrentSessionId()
  })
  
  // 3. Execute steps locally
  for (const step of variant.tasks) {
    const result = await executeStep(step, impulseSpace)
    
    // 4. Report step result via MCP (CLI → Backend)
    await mcpClient.call("report_step_result", {
      execution_id,
      step_id: step.id,
      success: result.success,
      output: result.output
    })
  }
  
  // 5. Report completion via MCP (CLI → Backend)
  await mcpClient.call("report_complete", {
    execution_id,
    success: allStepsSucceeded,
    duration: totalDuration,
    cost: totalCost
  })
}
```

**Session Context (In-Memory Only)**:
```typescript
// SessionContext tracks file modifications IN MEMORY
// This data is NOT stored in SurrealDB
// It's used for:
// - Cochange prediction
// - Impact analysis
// - Component annotation

class SessionContext {
  private static modifiedFiles = new Map<string, Map<string, FileModification>>()
  
  static trackFileModification(sessionId: string, filePath: string, type: "read" | "write") {
    // Store in memory only
    // Cleared on process restart
  }
  
  static getModifiedFiles(sessionId: string): string[] {
    // Return files modified in this session
    // Used by Metabob integration for context
  }
}
```

---

## Part 7: Preventing Data Issues

### Issue 1: Duplicate Executions (Race Condition)

**Scenario**: Agent retries execution due to network timeout, causing duplicate records

**Prevention**:
```python
# Backend: Idempotent execution recording
@router.post("/v2/activities/record/start")
async def record_execution_start(request: RecordStartRequest):
    # Check if execution_id already exists
    existing = await db.query(
        "SELECT * FROM activity_executions WHERE execution_id = $id",
        {"id": request.execution_id}
    )
    
    if existing:
        # Already started, return existing (idempotent)
        return {"status": "already_started", "execution_id": request.execution_id}
    else:
        # First time, create new record
        await db.create("activity_executions", request.model_dump())
        return {"status": "started", "execution_id": request.execution_id}
```

---

### Issue 2: Variant Content Duplication

**Scenario**: Two agents independently create identical variants

**Prevention**:
```python
# Backend: Content-addressable hashing
async def create_variant(db, variant_data):
    # Calculate content hash
    content_hash = hashlib.sha256(
        json.dumps(variant_data["task_steps"], sort_keys=True).encode()
    ).hexdigest()
    
    # Check for existing variant with same content
    existing = await db.query(
        "SELECT * FROM activity_variants WHERE content_hash = $hash",
        {"hash": content_hash}
    )
    
    if existing:
        # Same content already exists, return existing
        return existing[0]
    else:
        # New content, create new variant
        variant_data["content_hash"] = content_hash
        return await db.create("activity_variants", variant_data)
```

---

### Issue 3: Stale Metrics After Batch Update

**Scenario**: Metrics become stale if incremental updates are skipped

**Prevention**:
```python
# Backend: Periodic background job
async def recalculate_all_metrics():
    """Run hourly to ensure metrics are accurate"""
    
    # 1. Recalculate variant metrics
    variants = await db.query("SELECT variant_id FROM activity_variants")
    for v in variants:
        await _recalculate_variant_rates(db, v["variant_id"])
    
    # 2. Recalculate activity metrics
    activities = await db.query("SELECT activity_id FROM activities")
    for a in activities:
        await _update_activity_metrics(db, a["activity_id"])
    
    # 3. Update Thompson Sampling parameters
    # (These are updated incrementally, but verify correctness)
    for v in variants:
        conversions = await db.query("""
            SELECT success FROM activity_conversions 
            WHERE variant_id = $variant_id
        """, {"variant_id": v["variant_id"]})
        
        expected_alpha = 1 + sum(1 for c in conversions if c["success"])
        expected_beta = 1 + sum(1 for c in conversions if not c["success"])
        
        # Verify Thompson parameters are correct
        metrics = await db.query("""
            SELECT thompson_alpha, thompson_beta 
            FROM variant_performance_metrics 
            WHERE variant_id = $variant_id
        """, {"variant_id": v["variant_id"]})
        
        if metrics:
            actual_alpha = metrics[0]["thompson_alpha"]
            actual_beta = metrics[0]["thompson_beta"]
            
            if abs(actual_alpha - expected_alpha) > 0.1 or abs(actual_beta - expected_beta) > 0.1:
                # Metrics drifted, correct them
                await db.query("""
                    UPDATE variant_performance_metrics 
                    SET thompson_alpha = $alpha, thompson_beta = $beta 
                    WHERE variant_id = $variant_id
                """, {
                    "variant_id": v["variant_id"],
                    "alpha": expected_alpha,
                    "beta": expected_beta
                })
```

---

### Issue 4: Lost Data on Network Failure

**Scenario**: OpenCode crashes mid-execution, execution record incomplete

**Prevention**:
```python
# Backend: Cleanup job for stale executions
async def cleanup_stale_executions():
    """Run daily to clean up incomplete executions"""
    
    # Find executions started > 24 hours ago with no completion
    stale = await db.query("""
        SELECT execution_id, activity_id, variant_id, created_at
        FROM activity_executions
        WHERE created_at < time::now() - 24h
          AND success IS NULL
          AND duration IS NULL
    """)
    
    for execution in stale:
        # Mark as failed with reason "timeout"
        await db.update(f"activity_executions:{execution['execution_id']}", {
            "success": False,
            "failure_reason": "Execution timeout (24h cleanup)",
            "duration": 86400000,  # 24 hours
            "total_cost": 0.0
        })
        
        # Do NOT create conversion for timeouts
        # Do NOT update Thompson Sampling (no new information)
```

---

## Part 8: Querying Data

### Query 1: Find Top-Performing Variants

```python
# Get variants with highest success rate (min 10 executions)
results = await db.query("""
    SELECT 
        v.variant_id,
        v.variant_name,
        v.activity_id,
        m.total_conversions,
        m.conversion_rate,
        m.avg_quality_score,
        m.avg_cost,
        m.avg_duration_ms,
        m.expected_value
    FROM activity_variants v
    INNER JOIN variant_performance_metrics m 
        ON v.variant_id = m.variant_id
    WHERE m.total_selections >= 10
    ORDER BY m.overall_conversion DESC
    LIMIT 20
""")
```

---

### Query 2: Find Variants Created from Execution

```python
# Trace variant genealogy
execution_id = "exec_trailblaze_123"

# Find variants commissioned from this execution
commissioned = await db.query("""
    SELECT 
        variant_id,
        variant_name,
        activity_id,
        evolution_type,
        parent_hash,
        created_at
    FROM activity_variants
    WHERE source_execution = $execution_id
""", {"execution_id": execution_id})

# For each variant, find its lineage
for variant in commissioned:
    lineage = []
    current_hash = variant["parent_hash"]
    
    while current_hash:
        parent = await db.query("""
            SELECT variant_id, variant_name, content_hash, parent_hash
            FROM activity_variants
            WHERE content_hash = $hash
        """, {"hash": current_hash})
        
        if parent:
            lineage.append(parent[0])
            current_hash = parent[0]["parent_hash"]
        else:
            break
    
    variant["lineage"] = lineage
```

---

### Query 3: Analyze Impulse Effectiveness

```python
# Find which impulses lead to successful executions
results = await db.query("""
    SELECT 
        ir.impulse_id,
        ir.impulse_type,
        ir.usage_count,
        ir.success_count,
        ir.effectiveness_rate,
        ir.last_used
    FROM impulse_registry ir
    WHERE ir.usage_count >= 5
    ORDER BY ir.effectiveness_rate DESC
    LIMIT 20
""")

# For specific impulse, find all executions that used it
impulse_id = "metabob-priorities-01KHDK"

usages = await db.query("""
    SELECT 
        e.execution_id,
        e.activity_id,
        e.variant_id,
        e.success,
        e.duration,
        e.cost,
        iu.tokens_loaded,
        iu.was_useful,
        e.created_at
    FROM impulse_usage iu
    INNER JOIN activity_executions e 
        ON iu.execution_id = e.execution_id
    WHERE iu.impulse_id = $impulse_id
    ORDER BY e.created_at DESC
    LIMIT 50
""", {"impulse_id": impulse_id})
```

---

### Query 4: Find Activities by Success Rate

```python
# Get activities with best aggregate success rate
results = await db.query("""
    SELECT 
        activity_id,
        name,
        category,
        execution_count,
        success_rate,
        avg_duration_ms,
        avg_cost,
        created_at
    FROM activities
    WHERE execution_count >= 10
      AND status = 'active'
    ORDER BY success_rate DESC
    LIMIT 20
""")
```

---

### Query 5: Debug Failed Executions

```python
# Find recent failures for specific activity
results = await db.query("""
    SELECT 
        e.execution_id,
        e.variant_id,
        e.failure_reason,
        e.duration,
        e.cost,
        e.tasks,
        e.created_at,
        v.variant_name,
        v.expected_duration_ms,
        v.expected_cost
    FROM activity_executions e
    INNER JOIN activity_variants v 
        ON e.variant_id = v.variant_id
    WHERE e.activity_id = $activity_id
      AND e.success = false
      AND e.created_at > time::now() - 7d
    ORDER BY e.created_at DESC
    LIMIT 50
""", {"activity_id": "add-feature-complete"})

# Analyze which step failed most often
step_failures = {}
for execution in results:
    for task in execution["tasks"]:
        if task["status"] == "failed":
            step_id = task["task_name"]
            if step_id not in step_failures:
                step_failures[step_id] = 0
            step_failures[step_id] += 1

# Most problematic step
worst_step = max(step_failures.items(), key=lambda x: x[1])
print(f"Most failures: {worst_step[0]} ({worst_step[1]} failures)")
```

---

## Summary: The Complete Picture

### Data Flow Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                    SURREALDB DATA FLOW                           │
└─────────────────────────────────────────────────────────────────┘

User Request (OpenCode)
         ↓
    ┌────────┐
    │  CLI   │ (Field mapping, MCP tools)
    └────────┘
         ↓
    ┌────────┐
    │Backend │ (Business logic, validation)
    └────────┘
         ↓
  ┌───────────┐
  │ SurrealDB │ (Source of truth)
  └───────────┘
         │
         ├─→ activities (template metadata)
         ├─→ activity_variants (task steps + versions)
         ├─→ activity_impressions (recommendations shown)
         ├─→ activity_selections (agent choices)
         ├─→ activity_conversions (execution outcomes)
         ├─→ activity_executions (complete execution log)
         ├─→ variant_performance_metrics (aggregated stats)
         ├─→ consumer_profiles (agent behavior)
         ├─→ impulse_registry (impulse tracking)
         └─→ impulse_usage (per-execution impulse log)
         
         ↓ (Aggregation)
         
  Thompson Sampling Updates (α, β)
  CTR Calculation (selections / impressions)
  Conversion Rate (conversions / selections)
  Quality Scores (correctness, speed, efficiency)
  
         ↓ (Read back)
         
  Recommendations (sorted by expected value)
         ↓
    ┌────────┐
    │  CLI   │ (Field mapping)
    └────────┘
         ↓
User sees ranked recommendations (OpenCode)
```

### Key Takeaways

1. **Data Ownership**: Backend is source of truth, CLI caches, OpenCode displays
2. **Deduplication**: Unique indexes + content hashing + idempotent APIs + single source
3. **Processing Times**: 
   - Recommendation: 50-200ms
   - Execution start: 30-100ms
   - Execution complete: 100-500ms (includes aggregation)
   - Background: 1-10s (hourly)
4. **Tracking**: Every variant/execution has source metadata (who, when, why)
5. **Funnel**: Impressions → Selections → Conversions (ad recommendation model)

### Next Steps for Improvement

1. **Optimize Aggregations**: Make metrics updates incremental instead of recalculating
2. **Add Indexes**: Composite indexes on frequently queried fields (activity_id + success)
3. **Batch Writes**: Buffer impression writes for high-traffic scenarios
4. **Archive Strategy**: Move old executions to cold storage (>90 days)
5. **Monitoring**: Add observability for slow queries, large aggregations
