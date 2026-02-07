# Protocol-Derived Activity Template - Design & Intent

**Date**: February 6, 2026  
**Source**: `repos/metabob-proto/proto/metabob/activity/variant.proto`

---

## Executive Summary

The **canonical activity template** is defined in Protocol Buffers (proto3) as `ActivityVariant`. This is the **single source of truth** for activity structure across all systems (backend storage, RPC API, MCP tools, OpenCode execution).

**Key Design Intent**: Content-addressable, evolutionarily-tracked, A/B testable activity implementations with comprehensive metrics and genealogy.

---

## The Protocol Definition

### Source of Truth
```
repos/metabob-proto/proto/metabob/activity/variant.proto
```

### Core Message Types

1. **ActivityVariant** - The complete activity definition
2. **TaskStep** - Individual execution steps (embedded, no separate table)
3. **VariantPerformanceMetrics** - Thompson Sampling optimization data
4. **Genealogy** - Content-addressable lineage tracking

---

## ActivityVariant Schema

### Identity (Lines 186-200)

```protobuf
string variant_id = 1;        // Unique: {activity_id}-{content_hash_prefix}
string activity_id = 2;       // Parent category: "bug-fix", "feature-impl"
string variant_name = 3;      // Human-readable: "v1-baseline", "optimized-for-speed"
string description = 4;       // What makes this variant different
int32 version = 5;            // Incremented on refinements
```

**Design Intent**:
- `variant_id` is **content-addressed**: Changing the template changes the hash
- `activity_id` is **stable**: Agents query by this (never see variant_id)
- Multiple variants can coexist for A/B testing
- Version tracks refinement iterations

### Genealogy (Line 206)

```protobuf
metabob.common.Genealogy genealogy = 6;
```

**Genealogy Structure** (from `common/types.proto`):
```protobuf
message Genealogy {
  string content_hash = 1;           // SHA-256 (first 16 hex)
  optional string parent_hash = 2;   // null for root
  repeated string lineage = 3;       // Ancestor chain
  EvolutionType evolution_type = 4;  // ROOT, DERIVED, MERGED, REFINED, SPLIT
  string evolution_note = 5;         // Why this evolution happened
}
```

**Design Intent**:
- **Content-addressable**: Every variant has unique hash of its content
- **Traceable lineage**: Can reconstruct full evolution tree
- **Evolution types**:
  - `ROOT`: Original seed template
  - `DERIVED`: Evolved from single parent
  - `MERGED`: Combined multiple successful patterns
  - `REFINED`: Same structure, improved prompts/logic
  - `SPLIT`: Focused subset of broader parent

**Use Cases**:
- Track which variants descend from which
- Identify successful lineages
- Rollback to previous versions
- Understand what changed and why

### Implementation (Lines 210-223)

```protobuf
repeated TaskStep task_steps = 7;        // Ordered execution steps
map<string, string> variables = 8;      // Prompt interpolation vars
string prompt_strategy = 9;             // "guided", "minimal", "detailed"
int32 context_budget_tokens = 10;       // Token budget for context
```

**Design Intent**:
- `task_steps`: Ordered array of steps to execute
- `variables`: Can be referenced in prompts via `{{variable_name}}`
- `prompt_strategy`: How verbose/detailed prompts should be
- `context_budget_tokens`: Limit for context window management

### Performance Expectations (Lines 228-234)

```protobuf
int32 expected_duration_ms = 11;       // How long execution should take
double expected_cost = 12;             // Expected cost in USD
double expected_quality_score = 13;    // Expected quality (0.0-1.0)
```

**Design Intent**:
- Set **expectations** for variant performance
- Used by **MAB algorithm** to initialize priors
- Helps with **resource planning** and **cost estimation**
- Provides **baseline** for learning

### Status & Metadata (Lines 239-244)

```protobuf
metabob.common.EntityStatus status = 14;     // DRAFT, TESTING, ACTIVE, DEPRECATED
google.protobuf.Timestamp created_at = 15;
```

**EntityStatus Values**:
- `DRAFT`: Being developed, not yet ready
- `TESTING`: In A/B test, collecting metrics
- `ACTIVE`: Production-ready, preferred variant
- `DEPRECATED`: Superseded by better variant

**Design Intent**:
- Lifecycle management
- Gradual rollout (testing → active)
- Clean deprecation (don't delete, mark deprecated)

---

## TaskStep Schema (Lines 24-80)

### Core Fields

```protobuf
string id = 1;                    // "analyze-docs", "create-summary"
string subagent = 2;              // "general", "tool", "config", "session"
string description = 3;           // Human-readable task purpose
repeated string dependencies = 4;  // Task IDs that must complete first
```

**Design Intent**:
- `id`: Unique within activity, used for dependency graph
- `subagent`: Which specialized agent executes this task
- `dependencies`: Enables parallel execution with proper ordering

### TaskPrompt (Lines 82-95)

```protobuf
message TaskPrompt {
  string template = 1;                  // Prompt with {{variables}}
  int32 max_tokens = 2;                 // Response token limit
  string compression_strategy = 3;      // "filter", "summarize", "truncate"
  repeated string variables = 4;        // Variables referenced in template
}
```

**Design Intent**:
- Template-based prompting with variable interpolation
- Token budget management per task
- Context compression strategies for long contexts

### TaskValidation (Lines 97-117)

```protobuf
message TaskValidation {
  repeated string required_files = 1;       // Files that must exist
  repeated string required_patterns = 2;    // Output must contain
  repeated string forbidden_patterns = 3;   // Output must NOT contain
  repeated ValidationCommand commands = 4;  // Shell commands (exit 0 = pass)
}
```

**Design Intent**:
- **Automatic validation** of task completion
- **File-based checks**: Ensure outputs were created
- **Pattern matching**: Verify content quality
- **Command-based**: Custom validation logic
- **Fail fast**: Catch errors before proceeding

### TaskRetry (Lines 119-129)

```protobuf
message TaskRetry {
  int32 max_attempts = 1;        // How many retries (default: 3)
  string strategy = 2;           // "simple", "exponential", "adaptive"
  string fallback_prompt = 3;    // Alternative prompt on retry
}
```

**Design Intent**:
- **Resilience**: Retry failed tasks automatically
- **Strategy selection**: Different backoff approaches
- **Adaptive prompting**: Change approach on retry
- **Graceful degradation**: Don't fail entire activity on transient errors

### TaskMetrics (Lines 131-144)

```protobuf
message TaskMetrics {
  double success_rate = 1;           // Historical success (0.0-1.0)
  int32 avg_tokens = 2;              // Average token usage
  int32 avg_duration = 3;            // Average duration (ms)
  repeated string common_failures = 4; // Most frequent failure reasons
}
```

**Design Intent**:
- **Learning from history**: Track what works
- **Resource estimation**: Predict token/time usage
- **Failure analysis**: Identify common problems
- **Evolution hints**: What needs improvement

---

## Variant Performance Metrics (Lines 255-297)

### Funnel Metrics (Lines 263-268)

```protobuf
int32 total_impressions = 3;   // Times shown to user (recommendation)
int32 total_selections = 4;    // Times chosen by user
int32 total_conversions = 5;   // Times completed successfully
int32 total_successes = 6;     // Count of successful executions
int32 total_failures = 7;      // Count of failed executions
```

**Design Intent**:
- **Funnel tracking**: Impression → Selection → Conversion
- **A/B testing foundation**: Compare variants
- **Success vs Failure**: Quality signal

### Thompson Sampling (Lines 286-290)

```protobuf
double thompson_alpha = 13;  // Successes + 1 (Beta distribution)
double thompson_beta = 14;   // Failures + 1 (Beta distribution)
```

**Design Intent**:
- **Multi-Armed Bandit (MAB)** optimization
- **Exploration vs Exploitation**: Balance trying new vs using proven
- **Bayesian approach**: Update beliefs with each outcome
- **Automatic variant selection**: System learns which variant is best

**How It Works**:
```
Initial state: alpha=1, beta=1 (uniform prior)

After 7 successes, 3 failures:
  alpha = 7 + 1 = 8
  beta = 3 + 1 = 4
  
Expected success rate: alpha / (alpha + beta) = 8/12 = 66.7%

Thompson Sampling draws from Beta(8, 4) to select variants probabilistically.
Better variants (higher alpha) get selected more often, but worse variants
still get some traffic to detect if they've improved.
```

---

## Design Patterns & Insights

### Pattern 1: Content-Addressable Variants

**Intent**: Immutable, verifiable, traceable

```
variant_id = activity_id + "-" + content_hash_prefix

Example:
  bug-fix-v1        → bug-fix-a3f8b291
  bug-fix-optimized → bug-fix-7c4e9f12
```

**Benefits**:
- Changing content creates new variant (no overwrite risk)
- Can deploy multiple simultaneously for A/B testing
- Content hash proves integrity
- Genealogy tracks evolution

### Pattern 2: Separation of Concerns

**Activity** (stable, canonical):
- What the activity does
- Required variables
- Expected behavior

**Variant** (versioned, testable):
- How it's implemented
- Specific prompts and logic
- Performance characteristics

**Design Intent**: Agents query activities, system manages variants transparently.

### Pattern 3: Evolution-Driven Improvement

```
1. Multiple variants exist
   ↓
2. Thompson Sampling selects variants
   ↓
3. Metrics captured (success, duration, quality)
   ↓
4. MAB updates alpha/beta
   ↓
5. Better variants get more traffic
   ↓
6. Boredom system triggers evolution
   ↓
7. New variant created (genealogy tracked)
   ↓
8. Cycle repeats (continuous improvement)
```

**Design Intent**: System automatically improves over time through learning.

### Pattern 4: Validation-First Execution

**Intent**: Fail fast, catch errors early

```
Task completes → Validate files → Validate patterns → Run commands → Success/Retry
```

**Benefits**:
- Prevents cascading failures
- Clear error messages
- Automatic retry with different approach
- Quality gates enforced

---

## Git History Insights

### Recent Evolution (from git log)

**Commit ab17e3a** (Feb 5, 2026):
```
"refactor: remove deprecated subagent fields from activity templates"
```

**Key Insight**: `subagent` field was **deprecated**. Agent behavior now comes from:
- `agentImpulses` (context-based selection)
- Defaults (general agent unless specified)

**Not from** named subagent strings in tasks.

**Commit 373f278** (Feb 6, 2026):
```
"docs: Complete architecture understanding of MCP-based activity system"
```

**Key Finding**:
- NO standalone mode
- ALL template operations require MCP + backend
- `register_activity_template` integrates via TemplateRepository
- Backend at localhost:8080 required
- Architecture flow: Tool → Repository → Loader → MCP → CLI → HTTP → Backend

---

## Alignment with Implementation

### What Matches Protocol ✅

1. **ActivityVariant message** → SurrealDB `activity_variants` table
2. **TaskStep repeated field** → `task_steps` array in database
3. **Genealogy tracking** → `genealogy` object in variants
4. **Thompson Sampling** → `variant_performance_metrics` table
5. **Status lifecycle** → DRAFT → TESTING → ACTIVE → DEPRECATED

### What's Broken 🔴

1. **Database serialization**: `task_steps` arrays are empty (should have objects)
2. **Architecture boundary**: Agents see `variant_id` (should only see `activity_id`)
3. **Missing abstraction**: No `activities` table (only `activity_variants`)

### What's Missing ⚠️

1. **`/activities/{id}` endpoint**: Should return canonical template with transparent variant selection
2. **Automatic variant selection**: MAB algorithm should select internally
3. **Activity table**: Canonical definitions separate from variants

---

## How jiggle-documentation Aligns

### Our Template Format

```json
{
  "id": "jiggle-documentation",
  "name": "Jiggle Documentation",
  "category": "refactor",
  "tasks": [...]
}
```

**This is OpenCode format** (for human authoring).

### Proto Format (what database needs)

```json
{
  "variant_id": "jiggle-documentation-772b239e",
  "activity_id": "jiggle-documentation",
  "variant_name": "v1-baseline",
  "task_steps": [...],
  "genealogy": { "evolution_type": "ROOT", ... }
}
```

**This is ActivityVariant proto format** (for storage/serving).

### Transformation

`metabob-cli register-template` transforms OpenCode → Proto:
1. Generates `variant_id` from content hash
2. Converts `tasks` → `task_steps`
3. Adds `genealogy` structure
4. Sets `status = TESTING`

**This is why** we need BOTH formats:
- **OpenCode format**: Human-friendly template authoring
- **Proto format**: Machine-optimized storage and serving

---

## Recommendations

### 1. Honor the Protocol

**DO**:
- Use `ActivityVariant` as canonical schema
- Store as defined in proto (with genealogy, task_steps, etc.)
- Follow status lifecycle (DRAFT → TESTING → ACTIVE)

**DON'T**:
- Invent custom schemas
- Skip genealogy tracking
- Expose variant_id to agents

### 2. Implement Missing Abstractions

**Create `activities` table**:
```sql
CREATE TABLE activities (
    activity_id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    category TEXT,
    status TEXT
);
```

**Link variants**:
```sql
ALTER TABLE activity_variants 
ADD FOREIGN KEY (activity_id) REFERENCES activities(activity_id);
```

### 3. Fix Serialization

**Use proper SDK or API**:
```python
# NOT this (string interpolation)
query = f"CREATE activity_variants SET task_steps = {json.dumps(steps)}"

# This (proper serialization)
db.create("activity_variants", variant_dict)
# OR
requests.post("/admin/variants", json=variant_dict)
```

### 4. Hide Variants from Agents

**Agents query**:
```
GET /activities/bug-fix  → Returns canonical template
```

**System handles internally**:
```
1. MAB selects variant (bug-fix-v1 vs bug-fix-optimized)
2. Records impression
3. Returns task_steps from selected variant
4. Agent never knows which variant
```

---

## Conclusion

The **protocol-derived activity template** (`ActivityVariant`) is a sophisticated design for:
- **Content-addressable** variant management
- **Evolutionarily-tracked** lineage
- **A/B testable** implementations
- **Automatically optimized** via Thompson Sampling

**Design Intent** (from proto comments and structure):
1. Activities are **stable canonical definitions**
2. Variants are **testable implementations**
3. Genealogy tracks **evolution history**
4. Metrics enable **automatic learning**
5. Thompson Sampling provides **optimal variant selection**

**Current Gap**: Implementation doesn't fully honor the protocol design. The infrastructure needs:
- Proper serialization (task_steps populated)
- Proper abstraction (activities separate from variants)
- Proper API (/activities/ not /variants/)

Once aligned, the system will work as designed: a self-improving activity execution platform with transparent A/B testing and automatic evolution.

---

**Key Takeaway**: The protocol IS the design. Any implementation that deviates from `ActivityVariant` proto schema is architecturally incorrect and should be fixed to match the canonical definition.
