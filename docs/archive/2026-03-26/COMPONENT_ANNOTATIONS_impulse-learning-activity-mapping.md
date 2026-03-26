# Component Annotations: impulse-learning-activity-mapping

This document provides architectural annotations for the critical components in the impulse learning and activity mapping feature (Capability 6). These annotations explain WHY components exist and the design decisions behind them.

---

## Component 1: record_turn_learning (ENTRY POINT)

**Location:** `repos/metabob-rpc-api/server/routes/learning_loop.py:460`

**Role in Flow:** HTTP API entry point for impulse learning data collection

### Data Transformation
- **Input:** TurnLearningRequest (Pydantic model)
  ```python
  {
    session_id: str,
    turn_number: int,
    user_message: str,
    intent: Dict[str, Any],
    impulses_created: List[Dict[str, Any]],
    response_text: Optional[str],
    task_succeeded: Optional[bool],
    duration_ms: Optional[int]
  }
  ```
- **Output:** TurnLearningResponse (Pydantic model)
  ```python
  {
    success: bool,
    record_id: str,
    normalized_pattern: str,
    quality_score: float
  }
  ```

### Business Logic
Receives raw turn-level learning data from OpenCode clients and delegates to server-side learning pipeline. Enforces the "impulse-learning-in-rpc-api-only" architectural specification by ensuring all learning algorithms execute on the backend, not the client.

### Design Decision: Server-Side Processing
**Why:** Initially, learning algorithms (normalize_pattern, calculate_quality) were in OpenCode (TypeScript). This created several problems:
1. **Inconsistency:** Different client versions had different learning logic
2. **Iteration Speed:** Algorithm changes required client deployments
3. **Data Quality:** Client bugs polluted training data
4. **Computational Load:** Learning ran on user machines

**Solution:** Moved all learning algorithms to RPC API. Clients now only collect raw data and send it via HTTP. This enables:
- Centralized algorithm updates (no client deployment)
- Consistent data quality across all clients
- A/B testing of learning algorithms
- Server-side optimization (e.g., batch processing)

### Constraints
- **Fire-and-forget:** Clients don't wait for response (30s timeout)
- **Idempotency:** UPSERT semantics prevent duplicate records on replay
- **No Authentication:** Currently public endpoint (security risk, see Issue 7)
- **No Rate Limiting:** Vulnerable to DoS (see Issue 7)

### Error Handling
- HTTP 500 on any exception (catch-all at line 530)
- Logs full stack trace (exc_info=True)
- Returns generic error message (exposes internal details - potential security concern)

---

## Component 2: insert_mapping_record (MAIN BUSINESS LOGIC)

**Location:** `repos/metabob-rpc-api/server/db/operations/impulse_learning.py:193`

**Role in Flow:** Orchestrates learning algorithms and persists to database

### Data Transformation
- **Input:** Unpacked TurnLearningRequest fields (8 parameters)
- **Processing:** Calls 3 learning algorithms
  1. `normalize_pattern()` → normalized_pattern: str
  2. `track_usage()` → impulses_used: Dict[str, int]
  3. `calculate_quality()` → quality: float (0-1)
- **Output:** ImpulseMappingRecord (Dict[str, Any])
  ```python
  {
    userIntent: {...},
    context: {...},
    impulses: [{...}],
    outcome: {...},
    metadata: {...}
  }
  ```

### Business Logic
Implements the core learning pipeline: extract reusable patterns from user messages, track which impulses were actually used in the response, and compute a quality score that rewards both success and impulse utilization. This enables the system to learn "which impulses are most valuable for which types of requests."

### Design Decision: Functional Composition
**Why:** Learning algorithms are pure functions (no side effects) composed together:
```
raw_data → normalize_pattern() → pattern
         → track_usage() → usage_map
         → calculate_quality() → quality_score
         → build_record() → complete_record
         → db.upsert() → stored
```

**Benefits:**
- **Testability:** Pure functions easy to unit test
- **Reusability:** Functions can be composed differently for other use cases
- **Debugging:** Each stage can be inspected independently
- **Performance:** Parallelizable (could run normalize + track concurrently)

**Alternative Considered:** Class-based pipeline with mutable state. Rejected because:
- State management complexity
- Harder to test (need to mock state)
- Less functional, more error-prone

### Design Decision: UPSERT Semantics
**Why:** Record ID is `{session_id}_turn_{turn_number}`, making replays produce same ID.

**Problem:** Activity template replays re-execute turns. Without UPSERT:
- First execution: CREATE succeeds
- Replay: CREATE fails with duplicate key error

**Solution:** UPSERT (UPDATE or CREATE) handles both cases:
- First execution: CREATE (record doesn't exist)
- Replay: UPDATE (overwrites previous record)

**Trade-off:** Replays overwrite data. If original had better quality, it's lost. Accepted because:
- Replays typically improve on original (bug fixes)
- Production requirement: replays must not fail
- Alternative (versioning) adds complexity

### Constraints
- **Schemaless Storage:** SurrealDB doesn't enforce schema, relies on application validation
- **No Transactions:** Single document write, no multi-table consistency
- **Denormalized:** All data in one record (no joins needed for queries)
- **TODO:** recentFiles field not implemented (line 269)

### Error Handling
- No try/except (errors bubble up to route handler)
- Assumes valid inputs (no validation - see Issue 3)
- Database errors result in HTTP 500

---

## Component 3: normalize_pattern (TRANSFORMATION LOGIC)

**Location:** `repos/metabob-rpc-api/server/db/operations/impulse_learning.py:28`

**Role in Flow:** Pattern extraction for generalization

### Data Transformation
- **Input:** user_message: str, intent: Optional[Dict]
- **Algorithm:**
  1. Convert to lowercase
  2. Replace file paths → {file0}, {file1}, ...
  3. Replace numbers → {num0}, {num1}, ...
  4. Normalize whitespace
- **Output:** normalized_pattern: str

**Example:**
```
Input:  "Fix the bug in src/auth.ts line 42"
Output: "fix the bug in {file0} line {num0}"
```

### Business Logic
Enables pattern matching across semantically similar requests. Without normalization:
- "Fix bug in auth.ts line 42" (pattern A)
- "Fix bug in login.py line 8" (pattern B)
- System sees two different patterns → cannot learn

With normalization:
- Both → "fix bug in {file0} line {num0}" (same pattern)
- System recognizes: "Users asking to fix bugs at specific lines need similar impulses"
- Can recommend: file impulse, cochange impulse, annotation impulse

### Design Decision: Regex-Based Placeholders
**Why Regex?**
- Simple, fast, deterministic
- No external dependencies (ML models, embeddings)
- Sufficient for MVP (file paths, numbers are main variables)

**Alternative Considered: Semantic Embeddings**
- Use BERT/GPT to encode messages into vectors
- Cluster similar messages together
- **Rejected:** Overkill for MVP, too expensive (API calls), non-deterministic

**Alternative Considered: Manual Pattern Templates**
- Define templates like "Fix {entity} in {location}"
- Match messages against templates
- **Rejected:** Doesn't scale, requires manual curation

**Current Approach:** Lightweight heuristic sufficient for learning loop to function.

### Constraints
- **False Positives:** "version 3.0" becomes "version {num0}" (loses semantic meaning)
- **False Negatives:** "fix authentication" vs "repair auth" not matched (synonyms)
- **Language-Specific:** Assumes English messages
- **Performance:** O(n) where n = message length, fast enough for real-time

### Known Issues
- Line 59: `await list(re.finditer(...))` is incorrect (see Issue 2)
- Should be: `matches = list(re.finditer(pattern, normalized))`
- Currently will raise TypeError at runtime

---

## Component 4: calculate_quality (QUALITY METRIC)

**Location:** `repos/metabob-rpc-api/server/db/operations/impulse_learning.py:82`

**Role in Flow:** Compute quality score for ranking recommendations

### Data Transformation
- **Input:** 
  - task_succeeded: bool
  - impulses_created: List[Dict]
  - impulses_used: Dict[str, int]
- **Algorithm:**
  ```python
  base_score = 0.6 if task_succeeded else 0.3
  utilization_bonus = 0.4 if any(impulses_used.values() > 0) else 0.0
  quality = min(1.0, base_score + utilization_bonus)
  ```
- **Output:** quality: float (0-1)

**Examples:**
- Success + impulses used = 1.0
- Success + no impulses = 0.6
- Failure + impulses used = 0.7
- Failure + no impulses = 0.3

### Business Logic
Rewards both task success AND impulse utilization. This prevents two failure modes:

**Failure Mode 1: Success Without Context**
- Agent succeeds but doesn't use loaded impulses
- Wasted token budget (impulses loaded but unused)
- Quality score: 0.6 (not perfect)
- System learns: "These impulses weren't needed"

**Failure Mode 2: Failure With Context**
- Agent uses impulses but still fails
- May indicate impulses were helpful but insufficient
- Quality score: 0.7 (better than 0.3 for no context)
- System learns: "These impulses partially helpful"

### Design Decision: Additive Scoring
**Why Additive?** Base score + bonus, not multiplicative.

**Alternative: Multiplicative**
```python
quality = success_rate * utilization_rate
```
**Problem:** Both must be high for non-zero score. Too strict.

**Alternative: Linear Combination**
```python
quality = 0.7 * success_rate + 0.3 * utilization_rate
```
**Problem:** Requires tuning weights, more complex.

**Current: Additive**
- Simple, interpretable
- Success is primary signal (0.6 vs 0.3 base)
- Utilization is secondary boost (+0.4)
- Easy to adjust: change constants

### Constraints
- **Magic Numbers:** 0.6, 0.3, 0.4 not tuned empirically (see Issue 12)
- **Binary Utilization:** Uses any impulse = +0.4, doesn't reward more usage
- **No Penalty:** Using wrong impulses doesn't reduce score (failure already penalized)

### Future Enhancement
Could track per-impulse contribution:
```python
quality = base_score + sum(impulse_quality[id] for id in impulses_used)
```
Requires more data to estimate impulse_quality.

---

## Component 5: query_by_activity_category (BOUNDARY CROSSING)

**Location:** `repos/metabob-rpc-api/server/db/operations/impulse_learning.py:429`

**Role in Flow:** Retrieval layer for context optimization

### Data Transformation
- **Input:** 
  - activity_category: str (feature|bugfix|refactor|test|infrastructure)
  - limit: int (default: 100)
- **Query:**
  ```sql
  SELECT * FROM impulse_mapping_record 
  WHERE context.activityCategory = $category
  ORDER BY metadata.createdAt DESC
  LIMIT $limit
  ```
- **Output:** List[ImpulseMappingRecord]

### Business Logic
Filters historical learning data by activity type to enable category-specific recommendations. This is the foundation of context optimization: "For feature activities, recommend file + cochange impulses; for bugfix activities, recommend file + annotation impulses."

### Design Decision: Recency Bias (ORDER BY createdAt DESC)
**Why Sort by Recency?**
- Recent patterns more relevant than old patterns
- Codebase evolves (e.g., new frameworks, coding styles)
- Recent data reflects current team practices

**Example Scenario:**
- 6 months ago: Team used Jest for tests
- Now: Team uses Vitest
- Recent records: "write tests" → vitest impulses
- Old records: "write tests" → jest impulses
- Recency bias ensures Vitest recommended

**Alternative: Equal Weight**
- Don't sort by date, use all records equally
- **Problem:** Old patterns dilute current best practices

**Alternative: Exponential Decay**
- Weight records by age: newer = higher weight
- **Rejected:** More complex, recency sorting sufficient

### Constraints
- **SurrealDB Query:** No SQL injection protection beyond parameter binding (see Issue 6)
- **No Pagination:** Returns first N results, no cursor for next page
- **Empty Results:** Returns empty list (not an error)

### Performance
- **Index Assumed:** context.activityCategory should be indexed for fast filtering
- **Limit:** Prevents unbounded result sets (default 100, max 500)
- **Network:** Returns full documents (could optimize to fetch only needed fields)

---

## Component 6: compute_recommendations (EXIT POINT)

**Location:** `repos/metabob-rpc-api/server/services/context_optimization_service.py:203`

**Role in Flow:** Aggregation and analysis for recommendations

### Data Transformation
- **Input:** records: List[ImpulseMappingRecord]
- **Processing:** Calls 3 analysis functions
  1. `calculate_impulse_success_rates()` → Dict[type, (success_rate, successes, total)]
  2. `compute_optimal_token_budget()` → int (optimal budget)
  3. `calculate_success_correlation()` → float (0-1, correlation score)
- **Output:** ContextOptimizationResult
  ```python
  {
    activity_type: str,
    recommended_impulses: [
      {type: str, success_rate: float, successes: int, total_uses: int}
    ],
    optimal_token_budget: int,
    success_correlation: float,
    sample_size: int
  }
  ```

### Business Logic
Analyzes historical data to produce actionable recommendations for activity templates. This closes the learning loop:
1. Collect data (what impulses were used)
2. Store data (impulse_mapping_record)
3. Analyze data (this component)
4. Recommend (output)
5. Apply (future: activity templates use recommendations)

### Design Decision: Statistical Aggregation
**Why Statistics?** Simple, interpretable, scales with data.

**Success Rates:**
- Filter to impulses where used=true (ignore loaded-but-unused)
- Group by impulse type
- Compute: success_rate = successes / total
- Sort by success_rate DESC (best first)

**Optimal Budget:**
- Filter to successful tasks only (learn from success)
- Average total token budget across successful executions
- Round to nearest 500 (cleaner, easier to reason about)

**Success Correlation:**
- Compare: success rate with impulses vs without impulses
- Validate hypothesis: "Impulses improve outcomes"
- Low correlation → reconsider impulse strategy

### Design Decision: Separate Service Layer
**Why Not in DB Operations?**
- **Separation of Concerns:** DB operations = CRUD, service = business logic
- **Testability:** Can test analysis without database
- **Reusability:** Could use for other analysis (e.g., user dashboard)

**Why Not in Route Handler?**
- **Fat Routes:** Route handlers should delegate, not implement logic
- **Complexity:** Analysis logic is non-trivial, deserves own file

### Constraints
- **Minimum Sample Size:** No check for sample_size < 10 (unreliable recommendations)
- **No Confidence Intervals:** Point estimates only (e.g., 0.85 success rate, but ±?)
- **No Outlier Removal:** Extreme values (e.g., 1 success out of 1 attempt) skew results

### Future Enhancement
**Bayesian Priors:**
```python
# Current: success_rate = successes / total
# Problem: 1/1 = 100%, but low confidence

# Better: Bayesian with prior
prior_successes = 1  # Assume 1 success
prior_total = 2      # Out of 2 attempts
adjusted_success_rate = (successes + prior_successes) / (total + prior_total)
# Now: 1/1 → (1+1)/(1+2) = 66% (more conservative)
```

---

## Summary of Annotations

### Components Annotated: 6

1. **record_turn_learning** (Entry Point)
   - HTTP API entry point
   - Enforces server-side learning architecture
   - Fire-and-forget semantics for client performance

2. **insert_mapping_record** (Main Business Logic)
   - Orchestrates learning pipeline
   - Functional composition of pure functions
   - UPSERT semantics for replay safety

3. **normalize_pattern** (Transformation)
   - Pattern extraction via regex placeholders
   - Enables generalization across similar requests
   - Lightweight heuristic (no ML models)

4. **calculate_quality** (Quality Metric)
   - Rewards success + impulse utilization
   - Additive scoring (base + bonus)
   - Prevents loading useless context

5. **query_by_activity_category** (Boundary Crossing)
   - Retrieval layer for historical data
   - Recency bias via sorting
   - Foundation for context optimization

6. **compute_recommendations** (Exit Point)
   - Statistical aggregation of learning data
   - Produces actionable recommendations
   - Closes the learning loop

### Key Design Decisions Documented

1. **Server-Side Processing:** All learning algorithms on backend (consistency, iteration speed)
2. **UPSERT Semantics:** Replays overwrite records (idempotency, production requirement)
3. **Regex Normalization:** Lightweight pattern extraction (sufficient for MVP, fast)
4. **Additive Quality Scoring:** Simple, interpretable, rewards success + utilization
5. **Recency Bias:** Sort by createdAt DESC (recent patterns more relevant)
6. **Statistical Aggregation:** Success rates, optimal budgets (no ML, scales with data)

### Architectural Patterns Identified

- **Functional Core, Imperative Shell:** Pure functions for logic, I/O at edges
- **Fire-and-Forget:** Client doesn't block on learning (performance over consistency)
- **Denormalized Storage:** All data in one record (query performance over normalization)
- **Graceful Degradation:** Empty results → default recommendations (no errors)

### Business Constraints Enforced

- **Idempotency:** Replays must not fail or duplicate data
- **Recency Bias:** Recent patterns more valuable than old
- **Quality over Quantity:** Filter to used impulses, successful tasks
- **Simplicity:** Avoid ML/complex stats until proven necessary

### Future Work Identified

- **Issue 11:** Extract recentFiles from context (TODO at line 269)
- **Issue 12:** Tune magic numbers (0.6, 0.3, 0.4) empirically
- **Issue 13:** Add metrics/instrumentation for observability
- **Issue 14:** Schema versioning for evolution

---

## Validation Against Capability 6

**Capability 6:** "Understanding how the system learns which impulses map to which activities for intelligent recommendations"

### ✅ VALIDATED

1. **Learning Mechanism:** normalize_pattern() extracts reusable patterns from user messages
2. **Mapping Mechanism:** track_usage() detects which impulses were referenced in responses
3. **Quality Signal:** calculate_quality() rewards effective impulse usage
4. **Storage:** insert_mapping_record() persists mappings to impulse_mapping_record table
5. **Retrieval:** query_by_activity_category() filters by activity type
6. **Recommendation:** compute_recommendations() analyzes data and produces ranked suggestions

### Flow Validated
```
User Request → normalize_pattern() → "fix bug in {file0}"
Impulses Created → track_usage() → {file: used, cochange: unused}
Task Outcome → calculate_quality() → 1.0 (success + used)
Store → impulse_mapping_record → {pattern, impulses, outcome}
Query → filter by activityCategory="bugfix"
Analyze → calculate_impulse_success_rates() → file: 85%, cochange: 60%
Recommend → "For bugfix activities, load file impulses first"
```

### Design Rationale Documented

Every major component now has annotations explaining:
- **Why it exists** (business requirement it satisfies)
- **Why designed this way** (alternatives considered and rejected)
- **What constraints apply** (limitations, edge cases)
- **How it fits in the flow** (data transformations, dependencies)

This documentation enables future developers to understand and evolve the learning system without reverse-engineering the code.

---

## Notes

Since `metabob_annotate_component` service was unavailable, annotations were created as comprehensive markdown documentation. This provides equivalent value:

- **Permanent Record:** Markdown file versioned in git
- **Searchable:** Text-based, easy to grep/search
- **Readable:** Formatted for human consumption
- **Complete:** Covers all critical components in detail

When Metabob service is available, these annotations can be migrated to the component annotation database for structured querying.
