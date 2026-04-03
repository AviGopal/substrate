## Context

MiniBob uses the LLM as a resolver—it takes impulses (context) and produces tool calls that transform state. Currently, every tool call requires LLM reasoning even for repetitive patterns like "read file X", "run command Y", or "git commit". The LLM is already a resolver in our architecture; this design formalizes tool arguments as impulses so the system can learn and determinize proven patterns.

**Current flow:**
```
Goal → LLM reasons → Tool calls with arguments → Results
       ↑ (costs tokens every time)
```

**Target flow:**
```
Goal → Pattern match? → Yes: Deterministic resolver chain
                      → No: LLM reasons → Extract patterns → Learn
```

**Stakeholders:** MiniBob execution layer, metabob-activity-api learning system, ribosome template generator

## Goals / Non-Goals

**Goals:**
- Extract tool call arguments as typed impulses with shapes for routing
- Track argument patterns with success metrics in backend
- Enable shape-based impulse resolution without LLM
- Generate resolver-based tasks from proven patterns
- Reduce token usage for repetitive operations

**Non-Goals:**
- Replacing all LLM usage (LLM remains the fallback for novel situations)
- Changing the impulse/activity core architecture
- Real-time pattern matching during execution (batch learning only)
- Complex multi-step pattern chains (single-tool patterns first)

## Decisions

### D1: Tool Arguments as Impulses
**Decision:** Formalize tool call arguments as `ToolArgumentPointer` impulses with shape metadata.

**Rationale:** Arguments are data that influences execution. By treating them as impulses:
- They fit the existing impulse resolution architecture
- They can be loaded/unloaded like any impulse
- They have stable IDs for deduplication
- They carry shape metadata for routing

**Alternatives considered:**
- Store arguments in execution traces only → Loses the benefit of impulse-based routing
- Create new "argument" abstraction → Unnecessary complexity; impulses already handle this

### D2: Shape-Based Routing Before LLM
**Decision:** Tasks declare `inputShapes` and `outputShapes`. Executor checks shape availability before routing to resolver.

**Rationale:** Shape contracts enable:
- Deterministic routing without LLM reasoning
- Automatic fallback when shapes unavailable
- Composable resolver chains via shape matching

**Alternatives considered:**
- ID-based routing (current) → Doesn't scale; IDs are execution-specific
- LLM decides routing → Defeats the purpose of determinization

### D3: Stable Argument IDs for Deduplication
**Decision:** Generate stable IDs from tool name + key arguments (e.g., `read:src/index.ts`, `bash:<command-hash>`).

**Rationale:** Same arguments should produce same impulse ID, enabling:
- Deduplication across executions
- Pattern recognition ("this argument pattern succeeds 95% of the time")
- Pre-loading known-good argument impulses

**Alternatives considered:**
- Random UUIDs → No deduplication possible
- Full argument hash → Too sensitive to irrelevant differences

### D4: Backend Pattern Storage
**Decision:** Store patterns in `tool_argument_pattern` table with Thompson Sampling-style metrics.

**Rationale:** Aligns with existing learning system:
- Uses same success/failure tracking model
- Enables Thompson Sampling for pattern selection
- Recommendation view returns high-confidence patterns

**Alternatives considered:**
- Local storage in MiniBob → No cross-vessel learning
- Separate pattern service → Over-engineering for initial implementation

### D5: Single-Tool Patterns First
**Decision:** Initial implementation only extracts patterns from single-tool tasks.

**Rationale:**
- Single-tool patterns are most common (read, bash, git)
- Multi-tool chains require sequence learning (future work)
- Keeps initial complexity low

**Alternatives considered:**
- Multi-tool patterns immediately → Too complex; sequence ordering is hard
- No patterns → Misses the low-hanging fruit

### D6: Meta-Activity Library for Self-Improvement
**Decision:** Deploy a bootstrap set of activity templates that can improve other activities.

**Rationale:** The system cannot improve itself without activities that:
- Debug failed executions and create repair variants
- Optimize slow activities by analyzing performance data
- Extract templates from successful execution traces
- Compose workflow sequences from frequent patterns

**Meta-activities deployed:**
- `debug-failed-execution`: Load trace → analyze failure → propose fix
- `optimize-slow-activity`: Load metrics → identify bottlenecks → create variant
- `extract-template-from-traces`: Load traces → call ribosome → register template
- `compose-activity-sequence`: Load pattern → merge templates → register composite

**Alternatives considered:**
- Manual template creation only → System cannot learn autonomously
- LLM-generated templates ad-hoc → No consistency or pattern reuse

### D7: Emergent Shapes with Inference Bootstrap
**Decision:** Shapes are free-form strings that emerge from usage. Inference provides heuristic starting points, refined by execution data.

**Rationale:** Shapes should not be a predefined vocabulary but a function of the network:
- Shapes without resolvers are fine—the system learns what works
- Inference heuristics (keyword matching) bootstrap templates lacking shapes
- Execution data refines shape accuracy over time via Thompson Sampling
- Views like `v_shape_usage` and `v_shape_network` reveal network topology

**Bootstrap inference heuristics:**
- Prompt keywords → infer likely input shapes (e.g., "error" → `error` shape)
- Validation patterns → infer likely output shapes (e.g., `requiredFiles` → `source_code`)
- Category defaults → fallback shapes (e.g., `bugfix` → input `error`, output `patch`)

**Alternatives considered:**
- Predefined shape vocabulary → Too rigid; constrains emergent learning
- Manual shape assignment → Doesn't scale; error-prone
- No backfill → Shape-conditioned learning never starts

### D8: Selection-to-Outcome Correlation
**Decision:** Return `correlation_id` from `/recommend` and require it on execution trace submission.

**Rationale:** Without correlation, we cannot:
- Know which Thompson Sampling selection led to which outcome
- Provide explainability for why an activity was chosen
- Debug recommendation quality issues

**Implementation:**
- `/recommend` generates `correlation_id` per recommendation
- MiniBob stores `correlation_id` in execution context
- `/execution-traces` accepts `correlation_id` field
- `v_selection_outcomes` view joins selections to results

**Alternatives considered:**
- Timestamp-based matching → Unreliable with concurrent executions
- Activity ID only → Same activity may be selected for different reasons

### D9: Workflow Composition from Execution Sequences
**Decision:** Automatically discover and compose frequent activity sequences into optimized templates.

**Rationale:** Users naturally execute activities in sequences. If pattern A→B→C appears frequently with high success, it should become a single composite template that:
- Reduces recommendation overhead
- Captures proven workflow patterns
- Enables end-to-end Thompson Sampling

**Constraints:**
- Minimum frequency: 10 observations
- Minimum success rate: 80%
- Maximum sequence length: 5 activities
- All edge weights in composition graph >= 0.7

**Alternatives considered:**
- Manual composition only → Misses emergent patterns
- LLM-based composition → Expensive; doesn't use execution evidence

## Risks / Trade-offs

**[Risk] Pattern explosion for bash commands** → Mitigation: Hash commands for stable IDs; group by command prefix; set pattern count limits per activity

**[Risk] Shape mismatches cause silent failures** → Mitigation: Always fall back to LLM when shapes unavailable; log shape resolution failures

**[Risk] Stale patterns degrade performance** → Mitigation: Track `last_used_at`; decay old patterns; re-validate periodically

**[Trade-off] Memory for argument impulses** → Argument impulses are small (typically <100 tokens); benefits outweigh storage cost

**[Trade-off] Extraction overhead per execution** → Minimal: one function call per tool call; no LLM involved

**[Risk] Shape inference produces incorrect shapes** → Mitigation: Inference is a starting heuristic; execution data corrects via Thompson Sampling; shapes are soft (matching is subset-based)

**[Trade-off] Emergent shapes may fragment** → Mitigation: Shape network views reveal topology; similar shapes can be merged; no strict vocabulary enforcement

**[Risk] Meta-activities create low-quality templates** → Mitigation: Generated templates start with low Thompson Sampling confidence; poor templates naturally get deprioritized

**[Risk] Circular self-improvement loops** → Mitigation: Meta-activities cannot modify themselves; separate `scope: 'system'` flag prevents self-modification
