# Extracted Rules: Activity & Impulse Learning System

**Date:** February 23, 2026  
**Source:** Yesterday's documentation (Phase 2 instrumentation, impulse learning, bootstrap integration)  
**Purpose:** Extract specifications for activity optimization, impulse learning, and data transformation validation

---

## Executive Summary

Analyzed 20+ documents created yesterday to extract **13 specifications** covering:
1. **Activity Learning Loop** (5 specs) - How activities learn to optimize
2. **Impulse Context Strategies** (4 specs) - How impulses enable token efficiency
3. **Data Transformation Validation** (4 specs) - How to verify data flows (e.g., session memory TUI)

**Key Insight:** The system has **multifaceted behaviors** working together:
- Activities execute tasks
- Tasks load impulses (context)
- Impulses track usage statistics
- Statistics feed learning loop
- Learning loop optimizes future executions
- Metabob tools analyze failures
- CPG traces data transformations

**Goal:** Ensure all these behaviors work correctly through enforceable specifications.

---

## Category 1: Activity Learning Loop (5 Specifications)

### Spec 1: Thompson Sampling Template Selection

**Extracted From:** PHASE_2_INSTRUMENTATION_DESIGN.md, dual-write-activity-metrics enforcement

**Intent Discovered:**
> "Activities use Thompson Sampling for template selection. Fast Redis lookups provide real-time success/failure rates. Historical SurrealDB data enables long-term pattern analysis. Selection balances exploration (try new variants) vs exploitation (use proven templates)."

**Specification:**
```yaml
Name: thompson-sampling-template-selection
Description: Activity execution must select templates using Thompson Sampling algorithm with dual-store metrics
Expected Behavior: |
  When multiple templates can solve a task:
  1. Query Redis for recent metrics (last 7 days)
  2. Fall back to SurrealDB for historical metrics
  3. Calculate Beta distribution (alpha=successes+1, beta=failures+1)
  4. Sample from distribution for each template
  5. Select template with highest sample value
  6. Record selection reason in execution metadata
Validation Strategy: |
  Create 2 templates (hello-world-A: 90% success, hello-world-B: 50% success)
  Run 100 template selections
  Verify: hello-world-A selected ~75% (exploitation) + ~25% exploration
  Verify: selection_reason field contains Beta distribution values
```

**Why This Matters:**
- Balances trying new approaches (exploration) vs using proven methods (exploitation)
- Adapts to changing success rates over time
- Enables self-improving system

---

### Spec 2: Context Requirements Evolution

**Extracted From:** PHASE_2_INSTRUMENTATION_IMPULSE_LEARNING.md, lines 140-180

**Intent Discovered:**
> "Templates learn which impulses are actually useful. Track template.contextRequirements vs actual impulse usage. If certain impulses are consistently loaded and correlate with success, codify them in template. If impulses are loaded but unused, remove from requirements."

**Specification:**
```yaml
Name: context-requirements-evolution
Description: Activity templates must evolve contextRequirements based on actual impulse usage patterns
Expected Behavior: |
  After 20+ executions of a template:
  1. Analyze impulses_loaded across all executions
  2. Calculate correlation: impulse presence → task success
  3. Identify high-correlation impulses (>80% success when present vs <50% without)
  4. Update template.contextRequirements to include critical impulses
  5. Remove impulses with <20% correlation (loaded but not useful)
  6. Create template variant with optimized context requirements
Validation Strategy: |
  Run template 25 times:
  - 15 executions with impulse "codebase-structure" → 14 successes (93%)
  - 10 executions without impulse → 4 successes (40%)
  Verify: Template variant created with contextRequirements: ["codebase-structure"]
  Verify: Future executions auto-load this impulse
```

**Why This Matters:**
- Reduces token costs by removing useless context
- Improves success rates by ensuring critical context is present
- Templates become self-documenting (context requirements explicit)

---

### Spec 3: Task Decomposition Learning

**Extracted From:** PHASE_2_INSTRUMENTATION_IMPULSE_LEARNING.md, lines 82-99

**Intent Discovered:**
> "Should a task be one big task or multiple small tasks? System learns optimal decomposition by comparing single-task vs multi-task approaches. Multi-task with impulse chains often cheaper + more successful. Learning loop identifies when to split complex tasks."

**Specification:**
```yaml
Name: task-decomposition-learning
Description: System must learn optimal task decomposition by comparing single-task vs multi-task execution patterns
Expected Behavior: |
  After 10+ executions with high token cost or low success rate:
  1. Identify complex tasks (>15K tokens, <70% success)
  2. Analyze if task could be decomposed (multiple distinct steps in transcript)
  3. Create template variant with decomposed tasks
  4. Run A/B test: original vs decomposed (10 executions each)
  5. Compare: total_cost, success_rate, execution_time
  6. If decomposed version wins: promote as primary variant
  7. Record decomposition pattern for future templates
Validation Strategy: |
  Create template with single task "implement-feature" (avg 20K tokens, 50% success)
  System auto-creates variant with 3 tasks:
    - "analyze-requirements" (3K tokens)
    - "design-solution" (2K tokens)
    - "implement-code" (5K tokens)
  Run both versions 10 times
  Verify: Decomposed version has lower cost AND higher success
  Verify: System promotes decomposed variant
```

**Why This Matters:**
- Automatically discovers optimal task granularity
- Reduces costs through better decomposition
- Creates reusable decomposition patterns

---

### Spec 4: Metabob Failure Analysis Integration

**Extracted From:** Inferred from metabob tools and HIGH_PRIORITY_SPECIFICATIONS_COMPLETE.md

**Intent Discovered:**
> "When activities fail, Metabob tools must analyze root cause. Use metabob_search_codebase_issues to find related problems, metabob_analyze_change_impact to understand blast radius, metabob_assess_deletion_safety for safe rollback. Failure analysis creates impulses for next attempt."

**Specification:**
```yaml
Name: metabob-failure-analysis-integration
Description: Failed activity executions must trigger automatic Metabob failure analysis to identify root causes
Expected Behavior: |
  When activity fails (status=failed):
  1. Call metabob_search_codebase_issues(query="failed task description")
  2. Identify HIGH severity issues in modified files
  3. Call metabob_analyze_change_impact for each modified file
  4. Generate failure analysis impulse:
     - Root cause hypothesis
     - Related code quality issues
     - Suggested fixes
     - Safe rollback strategy
  5. Store impulse for replay/evolution
  6. Increment failure pattern count in template_metrics
Validation Strategy: |
  Create activity that modifies file with HIGH severity issue
  Force activity to fail
  Verify: metabob_search_codebase_issues called with failed task description
  Verify: Failure analysis impulse created with root cause
  Verify: Impulse contains specific HIGH severity issues found
  Verify: template_metrics.failure_patterns updated
```

**Why This Matters:**
- Converts failures into learning opportunities
- Identifies systemic code quality issues causing failures
- Enables intelligent replay with fixes
- Prevents repeated failures from same root cause

---

### Spec 5: Genealogy Rollout Pattern

**Extracted From:** BOOTSTRAP_TEMPLATES_FUNCTIONAL_STATE_INTEGRATION.md, lines 48-56

**Intent Discovered:**
> "As activities mature through learning loop, they progress toward deterministic execution. Genealogy rollout: successful template variants propagate to related templates. Failed deterministic attempts trigger trailblazing recovery. Boredom system reviews failures later with more detail."

**Specification:**
```yaml
Name: genealogy-rollout-pattern
Description: Successful activity variants must propagate to related templates through genealogy rollout mechanism
Expected Behavior: |
  When template variant achieves 90%+ success rate over 20 executions:
  1. Identify related templates (same category, similar tasks, shared variables)
  2. Extract successful patterns:
     - Context requirements
     - Task decomposition
     - Validation strategies
     - Error handling patterns
  3. Create genealogy variants of related templates with these patterns
  4. Test variants with A/B testing (10 executions each)
  5. If variants improve success rate: merge patterns into base templates
  6. Record genealogy relationships for traceability
Validation Strategy: |
  Template A: "add-rest-endpoint" (95% success, uses impulse "api-conventions")
  Template B: "add-graphql-endpoint" (60% success, no context requirements)
  System identifies similarity (both API endpoints)
  Creates Template B variant with "api-conventions" impulse
  Runs variant 10 times
  Verify: Variant success rate increases to 85%+
  Verify: Genealogy relationship recorded: B-v2 ← pattern from A
```

**Why This Matters:**
- Successful patterns propagate automatically across related templates
- Reduces manual template maintenance
- Accelerates learning across template families
- Creates traceability for pattern evolution

---

## Category 2: Impulse Context Strategies (4 Specifications)

### Spec 6: Impulse Token Budget Management

**Extracted From:** FINAL_IMPULSE_USAGE_TRACKING.md, TUI_SESSION_STATE_ENDPOINT.md

**Intent Discovered:**
> "Impulses have budgets. Total budget vs used tokens determines memory utilization. TUI shows 📦 Budget: 8.2k / 15k (55%). When utilization > 85% (red), system must unload low-priority impulses or trigger memory optimization."

**Specification:**
```yaml
Name: impulse-token-budget-management
Description: Session must manage impulse token budgets and trigger optimization when utilization exceeds thresholds
Expected Behavior: |
  Continuously track:
  - totalBudget: sum of all impulse budgets
  - usedTokens: sum of tokens in loaded impulses
  - utilization: (usedTokens / totalBudget) * 100
  
  Thresholds:
  - 0-60%: Green (healthy)
  - 60-85%: Yellow (caution) - warn user
  - 85-100%: Red (critical) - auto-trigger memory optimization
  
  When utilization > 85%:
  1. Identify low-priority impulses (low loadCount, old lastAccessed)
  2. Unload impulses with loadCount < 2 and lastAccessed > 1 hour ago
  3. If still > 85%: trigger manage-session-memory activity
  4. Record optimization in session events
Validation Strategy: |
  Create session with 15K total budget
  Load impulses consuming 13K tokens (87% utilization)
  Verify: System triggers memory optimization
  Verify: Low-priority impulses unloaded
  Verify: Utilization drops below 85%
  Verify: TUI shows status change: Red → Yellow/Green
```

**Why This Matters:**
- Prevents memory exhaustion
- Maintains optimal context efficiency
- Provides clear user feedback via TUI
- Enables proactive memory management

---

### Spec 7: Context Ratio Optimization

**Extracted From:** PHASE_2_INSTRUMENTATION_IMPULSE_LEARNING.md, lines 125-138

**Intent Discovered:**
> "context_ratio = context tokens / total tokens. High ratio = too much pre-loaded context (expensive). Low ratio + failures = too little context. Optimal: low ratio + high success. Learning loop optimizes toward this."

**Specification:**
```yaml
Name: context-ratio-optimization
Description: System must learn optimal context_ratio for each task type to minimize costs while maintaining success rates
Expected Behavior: |
  Track per task type (e.g., "implement-feature"):
  - context_ratio distribution across executions
  - success_rate by context_ratio bucket
  
  Analysis (after 20+ executions):
  1. Bucket context_ratios: [0-0.2], [0.2-0.4], [0.4-0.6], [0.6-0.8], [0.8-1.0]
  2. Calculate success rate per bucket
  3. Identify optimal bucket (highest success, lowest cost)
  4. Update template recommendation: "Aim for context_ratio: 0.2-0.4"
  5. Warn if execution context_ratio outside optimal range
  
  Feedback loop:
  - High context_ratio → reduce impulse budget or remove unused impulses
  - Low context_ratio + failures → add critical impulses
Validation Strategy: |
  Task type: "implement-feature"
  Run 30 executions with varying context:
  - 10 with context_ratio 0.1-0.3 → 8 successes (80%)
  - 10 with context_ratio 0.4-0.6 → 9 successes (90%)
  - 10 with context_ratio 0.7-0.9 → 9 successes (90%) but 3x cost
  Verify: System identifies 0.4-0.6 as optimal (high success, moderate cost)
  Verify: Template recommendation updated
  Verify: Future executions aim for this range
```

**Why This Matters:**
- Balances token costs vs success rates
- Learns optimal context levels per task type
- Provides guidance for context selection
- Reduces unnecessary pre-loading

---

### Spec 8: Impulse Usage Statistics Accuracy

**Extracted From:** FINAL_IMPULSE_USAGE_TRACKING.md, enforcement changes

**Intent Discovered:**
> "Impulse usageStats must be accurate: loadCount (how often loaded), totalTokens (cumulative tokens), totalCost (cumulative cost), lastAccessed (timestamp). Dual-write pattern: update local state + report to backend. Enables UI aggregation + learning."

**Specification:**
```yaml
Name: impulse-usage-statistics-accuracy
Description: Impulse usage statistics must be accurately tracked and synchronized between local state and backend
Expected Behavior: |
  When impulse loaded:
  1. Increment usageStats.loadCount
  2. Add tokens to usageStats.totalTokens
  3. Update usageStats.lastAccessed = now()
  4. Save to local impulse storage
  
  When task completes:
  5. Calculate cost attribution: (impulseTokens / totalInputTokens) * taskCost
  6. Add to usageStats.totalCost
  7. Report to backend via MCP (dual-write)
  8. Update local state after successful backend report
  
  Validation checks:
  - loadCount never decreases
  - totalTokens matches sum of all loads
  - totalCost ≤ sum of all task costs
  - lastAccessed is recent (within execution window)
Validation Strategy: |
  Create impulse with 100 tokens
  Load in 3 tasks:
    Task 1: 200 total tokens, $0.10 cost
    Task 2: 300 total tokens, $0.15 cost  
    Task 3: 400 total tokens, $0.20 cost
  Verify usageStats:
    - loadCount: 3
    - totalTokens: 300 (100 per load)
    - totalCost: ~$0.225 (cost attribution: 100/200*0.10 + 100/300*0.15 + 100/400*0.20)
    - lastAccessed: recent timestamp
  Verify backend received same values
```

**Why This Matters:**
- Accurate cost attribution to impulses
- Reliable frequency tracking for priority decisions
- Enables data-driven impulse optimization
- TUI can display accurate statistics

---

### Spec 9: Impulse Lifecycle Management

**Extracted From:** Session memory configuration docs, TUI sidebar

**Intent Discovered:**
> "Impulses have lifecycle: created → loaded → used → unloaded → archived. Track state transitions. Loaded impulses consume budget. Unloaded impulses preserve metadata but release tokens. Archived impulses move to long-term storage."

**Specification:**
```yaml
Name: impulse-lifecycle-management
Description: Impulses must transition through defined lifecycle states with proper state tracking and resource management
Expected Behavior: |
  Lifecycle states:
  1. created: Impulse exists, not loaded (budget allocated but not used)
  2. loaded: Content loaded into memory (usedTokens += impulse.budget)
  3. used: Referenced in task execution (loadCount++, lastAccessed updated)
  4. unloaded: Content released (usedTokens -= impulse.budget, metadata retained)
  5. archived: Moved to long-term storage (budget freed, content compressed)
  
  State transitions:
  - create → loaded: On first load
  - loaded → used: During task execution
  - used → unloaded: Memory optimization or low priority
  - unloaded → loaded: Re-load when needed
  - used → archived: After session complete or memory pressure
  
  Invariants:
  - usedTokens = sum of all loaded impulse budgets
  - Archived impulses don't count toward usedTokens
  - State transitions logged in session events
Validation Strategy: |
  Create impulse (100 tokens): state=created, usedTokens=0
  Load impulse: state=loaded, usedTokens=100
  Use in task: state=used, loadCount=1
  Unload impulse: state=unloaded, usedTokens=0, metadata intact
  Reload impulse: state=loaded, usedTokens=100, loadCount=2
  Archive impulse: state=archived, usedTokens=0, content compressed
  Verify: All state transitions logged
  Verify: usedTokens always accurate
```

**Why This Matters:**
- Proper resource management (memory + token budget)
- Clear state machine for debugging
- Enables efficient memory optimization
- Supports long-term storage strategies

---

## Category 3: Data Transformation Validation (4 Specifications)

### Spec 10: Session Memory TUI Data Flow

**Extracted From:** TUI_SESSION_STATE_ENDPOINT.md, session memory docs

**Intent Discovered:**
> "Session memory TUI shows real-time state: impulses loaded, budget utilization, context window usage. Data flows: Session.impulses() → aggregate metrics → /session/:id/state endpoint → TUI sidebar. Every transformation must be validated."

**Specification:**
```yaml
Name: session-memory-tui-data-flow
Description: Session memory data must flow correctly from storage through API endpoint to TUI sidebar with all transformations validated
Expected Behavior: |
  Data flow:
  1. Session.impulses() → Array<Impulse> (source: local storage)
  2. Calculate metrics:
     - totalBudget = sum(impulse.budget)
     - usedTokens = sum(impulse.budget where loaded=true)
     - impulseCount = impulses.length
     - utilization = (usedTokens / totalBudget) * 100
     - loadedCount = count(loaded=true)
     - unloadedCount = impulseCount - loadedCount
  3. GET /session/:id/state → SessionState response
  4. TUI polls endpoint → displays:
     📦 Impulses: {impulseCount} ({loadedCount} loaded)
     💾 Budget: {usedTokens} / {totalBudget} ({utilization}%)
  
  Transformations to validate:
  - T1: Impulse.budget → totalBudget (sum aggregation)
  - T2: Impulse.loaded → loadedCount (filter + count)
  - T3: (usedTokens, totalBudget) → utilization (percentage calculation)
  - T4: SessionState → TUI display (formatting)
Validation Strategy: |
  Create session with 5 impulses:
    - 3 loaded (budgets: 100, 200, 300 = 600 tokens)
    - 2 unloaded (budgets: 150, 250 = 400 tokens)
    - totalBudget = 1000 tokens
  
  Trace data flow:
  1. Query Session.impulses() → verify 5 impulses returned
  2. Call /session/:id/state → verify response:
     - impulseCount: 5
     - loadedCount: 3
     - unloadedCount: 2
     - totalBudget: 1000
     - usedTokens: 600
     - utilization: 60
  3. Simulate TUI display → verify formatting:
     "📦 Impulses: 5 (3 loaded)"
     "💾 Budget: 600 / 1000 (60%)"
  
  Verify all transformations correct at each step
```

**Why This Matters:**
- Ensures TUI displays accurate real-time state
- Validates every transformation in the data pipeline
- Catches calculation errors early
- Enables confident memory management decisions

---

### Spec 11: Activity Progress Tracking Data Flow

**Extracted From:** TUI_SESSION_STATE_ENDPOINT.md, activity tracking

**Intent Discovered:**
> "Active activities show progress in TUI: ⏳ Add Feature: 45% (2/5), Elapsed: 3m 24s. Data flows: Activity storage → calculate progress → /session/:id/state → TUI. Must track current task, total tasks, elapsed time, status changes."

**Specification:**
```yaml
Name: activity-progress-tracking-data-flow
Description: Activity progress data must flow correctly from storage through API to TUI with accurate progress calculations
Expected Behavior: |
  Data flow:
  1. Activity.currentTask → current task index
  2. Activity.tasks.length → total tasks
  3. Calculate progress:
     - current: currentTask + 1 (1-indexed for display)
     - total: tasks.length
     - percentage: ((currentTask + 1) / total) * 100
  4. Calculate elapsed:
     - startedAt: activity start timestamp
     - now: current timestamp
     - elapsedMs: now - startedAt
  5. GET /session/:id/state → activeActivities array
  6. TUI displays:
     ⏳ {activity.title}: {percentage}% ({current}/{total})
        └─ Elapsed: {formatDuration(elapsedMs)}
  
  Transformations to validate:
  - T1: currentTask (0-indexed) → current (1-indexed display)
  - T2: (current, total) → percentage (round to integer)
  - T3: (startedAt, now) → elapsedMs (timestamp subtraction)
  - T4: elapsedMs → human-readable duration (3m 24s)
  - T5: status enum → display format (executing → ⏳)
Validation Strategy: |
  Create activity with 5 tasks
  Start execution at timestamp T0
  Complete 2 tasks → currentTask = 2 (3rd task executing)
  Query at timestamp T0 + 204 seconds
  
  Verify /session/:id/state response:
  - current: 3 (currentTask + 1)
  - total: 5
  - percentage: 60 (3/5 * 100)
  - startedAt: T0
  - elapsedMs: 204000
  
  Verify TUI display:
  "⏳ Add Feature: 60% (3/5)"
  "   └─ Elapsed: 3m 24s"
  
  Verify all transformations correct
```

**Why This Matters:**
- Users see accurate activity progress in real-time
- Validates complex time and percentage calculations
- Catches off-by-one errors (0-indexed vs 1-indexed)
- Ensures status updates reflect correctly in UI

---

### Spec 12: Context Window Utilization Data Flow

**Extracted From:** TUI_SESSION_STATE_ENDPOINT.md, context window tracking

**Intent Discovered:**
> "Context window shows: 📊 Tokens: 28k / 200k (14%). Data flows: Estimate tokens from impulses + messages → calculate utilization → /session/:id/state → TUI color coding (green/yellow/red). Must warn when approaching limit (>90% = red)."

**Specification:**
```yaml
Name: context-window-utilization-data-flow
Description: Context window utilization must be accurately calculated and color-coded in TUI based on validated token estimates
Expected Behavior: |
  Data flow:
  1. Estimate tokens:
     - impulseTokens = sum(impulse.budget where loaded=true)
     - systemPromptTokens = estimate from agent mode
     - recentMessageTokens = sum(last 10 message tokens)
     - estimatedTokens = impulseTokens + systemPromptTokens + recentMessageTokens
  2. Get model context window:
     - maxTokens = model.contextWindow (e.g., 200000 for Claude 3.5)
  3. Calculate utilization:
     - utilizationPercent = (estimatedTokens / maxTokens) * 100
  4. Determine color:
     - 0-70%: Green (healthy)
     - 70-90%: Yellow (caution)
     - 90-100%: Red (critical)
  5. GET /session/:id/state → contextWindow object
  6. TUI displays with color:
     📊 Tokens: {estimatedTokens} / {maxTokens} ({utilizationPercent}%)
     🎯 Utilization: {color} {status}
  
  Transformations to validate:
  - T1: Impulses → impulseTokens (sum with filter)
  - T2: Agent mode → systemPromptTokens (lookup table)
  - T3: Messages → recentMessageTokens (sum last N)
  - T4: Components → estimatedTokens (addition)
  - T5: (estimated, max) → utilization (percentage)
  - T6: utilization → color (threshold mapping)
Validation Strategy: |
  Setup:
  - Model: Claude 3.5 (maxTokens: 200000)
  - Loaded impulses: 3 × 5000 tokens = 15000
  - System prompt: 3000 tokens (activity mode)
  - Recent messages: 10 × 500 tokens = 5000
  - Total estimated: 23000 tokens
  
  Verify /session/:id/state response:
  - estimatedTokens: 23000
  - maxTokens: 200000
  - utilizationPercent: 11.5 (round to 12)
  
  Verify TUI display:
  - Color: Green (12% < 70%)
  - "📊 Tokens: 23k / 200k (12%)"
  - "🎯 Utilization: Low"
  
  Test threshold boundaries:
  - 70% → color changes Yellow
  - 90% → color changes Red + warning displayed
  
  Verify all transformations and thresholds correct
```

**Why This Matters:**
- Prevents context window exhaustion
- Early warning system for approaching limits
- Validates complex token estimation logic
- Enables proactive session management

---

### Spec 13: Metabob Tool Integration Data Flow

**Extracted From:** Inferred from metabob tools usage, HIGH_PRIORITY_SPECIFICATIONS_COMPLETE.md

**Intent Discovered:**
> "Metabob tools (search_codebase_issues, analyze_change_impact, assess_deletion_safety) provide code quality context. Data flows: Tool call → MCP request → Metabob backend → response → impulse creation → task context. Must validate tool availability, response parsing, impulse generation."

**Specification:**
```yaml
Name: metabob-tool-integration-data-flow
Description: Metabob tools must integrate correctly into activity workflow with validated data flows and error handling
Expected Behavior: |
  Data flow:
  1. Activity task needs code quality context
  2. Call metabob_search_codebase_issues(query)
  3. MCP client sends request to Metabob backend
  4. Backend analyzes codebase → returns issues
  5. Parse response:
     - Filter by severity (HIGH/MEDIUM/LOW)
     - Extract file paths, line numbers, descriptions
     - Calculate impact scores
  6. Create impulse with analysis results:
     - ID: metabob-analysis-{timestamp}
     - Type: memo
     - Content: Formatted issue report
     - Budget: based on result size
  7. Load impulse into task context
  8. Task uses analysis to inform decisions
  
  Transformations to validate:
  - T1: Query string → MCP request format
  - T2: MCP response → parsed issues array
  - T3: Raw issues → filtered HIGH/MEDIUM issues
  - T4: Issues → formatted impulse content
  - T5: Impulse → task context (loaded)
  
  Error handling:
  - MCP unavailable → log warning, continue without analysis
  - Backend timeout → retry once, then continue
  - Invalid response → log error, create empty impulse
Validation Strategy: |
  Setup: Mock Metabob MCP backend with sample issues
  
  Test 1: Successful analysis
  1. Call metabob_search_codebase_issues("authentication")
  2. Verify MCP request sent with query
  3. Mock returns 5 issues (2 HIGH, 2 MEDIUM, 1 LOW)
  4. Verify response parsed correctly
  5. Verify impulse created with 4 issues (HIGH + MEDIUM only)
  6. Verify impulse loaded into task context
  
  Test 2: MCP unavailable
  1. Mock MCP to return connection error
  2. Verify warning logged
  3. Verify task continues without Metabob context
  4. Verify no exception thrown
  
  Test 3: Backend timeout
  1. Mock slow response (>30s)
  2. Verify retry attempt
  3. Verify graceful degradation after retry fails
  
  Verify all transformations and error paths
```

**Why This Matters:**
- Integrates code quality analysis into activity decisions
- Validates complex multi-system data flow
- Ensures graceful degradation when Metabob unavailable
- Enables intelligent failure analysis

---

## Summary Statistics

**Total Specifications Extracted:** 13

**By Category:**
- Activity Learning Loop: 5 specs
- Impulse Context Strategies: 4 specs
- Data Transformation Validation: 4 specs

**Enforcement Priority:**

### Tier 1: Critical Learning Infrastructure (Implement First)
1. **thompson-sampling-template-selection** - Core learning mechanism
2. **impulse-token-budget-management** - Resource management
3. **context-ratio-optimization** - Cost optimization
4. **metabob-failure-analysis-integration** - Failure learning

### Tier 2: Data Flow Validation (Ensure Correctness)
5. **session-memory-tui-data-flow** - TUI accuracy
6. **activity-progress-tracking-data-flow** - Progress display
7. **context-window-utilization-data-flow** - Resource warnings
8. **impulse-usage-statistics-accuracy** - Metrics integrity

### Tier 3: Advanced Learning (Enable Evolution)
9. **context-requirements-evolution** - Template self-improvement
10. **task-decomposition-learning** - Automatic optimization
11. **genealogy-rollout-pattern** - Pattern propagation
12. **impulse-lifecycle-management** - Lifecycle management
13. **metabob-tool-integration-data-flow** - Tool integration

---

## Key Insights

### Insight 1: Multifaceted Behaviors Form Learning Loop

The system has **6 interconnected behaviors**:
1. **Activities execute** → tasks run in sequence
2. **Tasks load impulses** → context provided
3. **Impulses track usage** → loadCount, tokens, cost
4. **Statistics feed learning** → Thompson Sampling, context optimization
5. **Learning optimizes activities** → better templates over time
6. **Metabob analyzes failures** → root cause identification

**All must work correctly for the learning loop to function.**

---

### Insight 2: Data Transformations Are Everywhere

Every piece of data undergoes multiple transformations:
- Raw impulses → aggregated metrics → TUI display
- Task completion → progress calculation → percentage display
- Token estimates → utilization percentage → color coding
- Tool responses → parsed data → impulse content → task context

**Each transformation is a potential failure point that needs validation.**

---

### Insight 3: TUI Is Window Into System State

The TUI sidebar reveals system behavior:
- Memory utilization → impulse loading working?
- Activity progress → task execution correct?
- Context window → token estimation accurate?
- Connection status → MCP integration functioning?

**By validating TUI data flows, we validate the entire underlying system.**

---

### Insight 4: Learning Requires Complete Instrumentation

For learning to work, we need:
- ✅ State transformation tracking (Spec #2 enforced)
- ✅ Impulse usage tracking (Spec #3 enforced)
- ✅ Dual-write metrics (Spec #4 enforced)
- ⏳ Thompson Sampling selection (Spec #1 new)
- ⏳ Context requirements evolution (Spec #2 new)
- ⏳ Metabob failure analysis (Spec #4 new)

**First 3 enforced, next 3 needed to complete the learning loop.**

---

## Recommended Enforcement Order

### Phase 1: Complete Learning Loop Foundation (Specs 1, 2, 4)
**Time:** ~2 hours | **Cost:** ~$8

These specifications complete the activity learning loop started yesterday:

```bash
# Spec 1: Thompson Sampling
activity trace-enforce-validate-loop \
  specificationName="thompson-sampling-template-selection" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."

# Spec 2: Impulse budget management  
activity trace-enforce-validate-loop \
  specificationName="impulse-token-budget-management" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."

# Spec 4: Metabob failure analysis
activity trace-enforce-validate-loop \
  specificationName="metabob-failure-analysis-integration" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."
```

---

### Phase 2: Validate TUI Data Flows (Specs 10, 11, 12)
**Time:** ~2 hours | **Cost:** ~$8

These specifications ensure TUI displays accurate system state:

```bash
# Spec 10: Session memory TUI
activity trace-enforce-validate-loop \
  specificationName="session-memory-tui-data-flow" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."

# Spec 11: Activity progress
activity trace-enforce-validate-loop \
  specificationName="activity-progress-tracking-data-flow" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."

# Spec 12: Context window
activity trace-enforce-validate-loop \
  specificationName="context-window-utilization-data-flow" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."
```

---

### Phase 3: Enable Advanced Learning (Remaining specs)
**Time:** ~3 hours | **Cost:** ~$12

These specifications enable template evolution and optimization.

---

## Next Steps

1. **Immediate:** Enforce Phase 1 specs (complete learning loop)
2. **Short-term:** Enforce Phase 2 specs (validate TUI data flows)
3. **Medium-term:** Enforce Phase 3 specs (enable advanced learning)
4. **Long-term:** Continuous extraction from new changes

**The learning loop is 60% complete (4/7 foundational specs enforced). Phase 1 brings it to 100%.** 🚀
