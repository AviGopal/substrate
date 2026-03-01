# Context Optimization Endpoint - Complete Data Flow Analysis

**Feature:** context-optimization-endpoint-complete  
**Specification:** GET /v1/learning/context-optimization  
**Date:** 2026-02-28  
**Status:** ✅ Implementation Complete (⚠️ Not Production-Ready - Missing Auth/Rate Limiting)

---

## Executive Summary

The context optimization endpoint analyzes historical impulse usage data from SurrealDB to provide data-driven recommendations for activity template configuration. It answers the question: "Which impulses should I create, and how much context budget should I allocate for this activity type?"

**Business Value:** Enables learning-driven optimization of activity execution efficiency by recommending:
- Which impulse types are most effective (ranked by success rate)
- Optimal total token budget (averaged from successful executions)
- Correlation between impulse usage and task success

**Current State:** Fully functional implementation with comprehensive analysis algorithms, graceful degradation, and defensive programming patterns.

**Production Readiness:** Requires authentication, rate limiting, and query timeout implementation before production deployment.

---

## Mermaid Flow Diagram

```mermaid
graph TD
    %% Entry Point
    Client[HTTP Client] -->|GET /api/v1/learning-loop/context-optimization| EntryPoint[get_context_optimization]
    
    %% Request Validation
    EntryPoint -->|Query Params: activity_type, limit| Validation{FastAPI Pydantic Validation}
    Validation -->|Invalid| Error422[422 Unprocessable Entity]
    Validation -->|Valid| QueryDB[query_by_activity_category]
    
    %% Database Query
    QueryDB -->|activity_category, limit| SurrealDB[(SurrealDB<br/>impulse_mapping_record)]
    SurrealDB -->|List of Records| CheckEmpty{Records Empty?}
    
    %% Empty Result Path
    CheckEmpty -->|Yes| DefaultResponse[Return Default Response<br/>impulses=[], budget=5000, correlation=0.0]
    DefaultResponse --> JSONResponse[ContextOptimizationResponse JSON]
    
    %% Analysis Path
    CheckEmpty -->|No| Orchestrator[compute_recommendations]
    
    %% Analysis Functions
    Orchestrator -->|records| SuccessRates[calculate_impulse_success_rates]
    Orchestrator -->|records| TokenBudget[compute_optimal_token_budget]
    Orchestrator -->|records| Correlation[calculate_success_correlation]
    
    %% Success Rates Analysis
    SuccessRates -->|For each record| CountImpulses[Count used impulses<br/>by type]
    CountImpulses -->|Group by type| CalcRate[successes / total_uses]
    CalcRate -->|Dict of rates| RatesResult[success_rate, successes, total per type]
    
    %% Token Budget Analysis
    TokenBudget -->|Filter succeeded=True| SumBudgets[Sum impulse budgets<br/>per task]
    SumBudgets -->|Average| RoundBudget[Round to nearest 500]
    RoundBudget -->|int| BudgetResult[optimal_token_budget]
    
    %% Correlation Analysis
    Correlation -->|Segment records| WithImpulses[Tasks WITH impulses]
    Correlation -->|Segment records| WithoutImpulses[Tasks WITHOUT impulses]
    WithImpulses -->|Calculate| SuccessRateWith[success_rate_with]
    WithoutImpulses -->|Calculate| SuccessRateWithout[success_rate_without]
    SuccessRateWith -->|Compare| CorrelationCalc[correlation = with / total]
    SuccessRateWithout -->|Compare| CorrelationCalc
    CorrelationCalc -->|float 0-1| CorrelationResult[success_correlation]
    
    %% Combine Results
    RatesResult --> CombineResults[Combine & Sort by success_rate DESC]
    BudgetResult --> CombineResults
    CorrelationResult --> CombineResults
    CombineResults -->|ContextOptimizationResult| MapToResponse[Map to Pydantic Model]
    MapToResponse --> JSONResponse
    
    %% Response
    JSONResponse -->|HTTP 200| Client
    
    %% Error Path
    QueryDB -.->|Exception| ErrorHandler[Exception Handler]
    Orchestrator -.->|Exception| ErrorHandler
    ErrorHandler -->|Log + HTTPException| Error500[500 Internal Server Error]
    Error500 -.->|HTTP 500| Client
    
    %% Styling
    style EntryPoint fill:#e1f5ff,stroke:#0077cc,stroke-width:3px
    style SurrealDB fill:#fff4e1,stroke:#ff9900,stroke-width:2px
    style Orchestrator fill:#e1ffe1,stroke:#00cc00,stroke-width:2px
    style JSONResponse fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style Error422 fill:#ffcccc,stroke:#cc0000,stroke-width:2px
    style Error500 fill:#ffcccc,stroke:#cc0000,stroke-width:2px
    style SuccessRates fill:#f0f0ff,stroke:#6666cc,stroke-width:2px
    style TokenBudget fill:#f0f0ff,stroke:#6666cc,stroke-width:2px
    style Correlation fill:#f0f0ff,stroke:#6666cc,stroke-width:2px
```

---

## Data Flow Summary

### Entry: HTTP Request

**Location:** `repos/metabob-rpc-api/server/routes/learning_loop.py:688`

**Input Format:**
```http
GET /api/v1/learning-loop/context-optimization?activity_type=feature&limit=100
```

**Input Schema:**
```python
{
    "activity_type": str,  # Required, enum: feature|bugfix|refactor|test|infrastructure
    "limit": int           # Optional (default: 100), range: 10-500
}
```

**Validation Rules:**
- `activity_type` must match regex: `^(feature|bugfix|refactor|test|infrastructure)$`
- `limit` must be integer in range [10, 500]
- FastAPI returns 422 Unprocessable Entity if validation fails

---

### Transformation 1: HTTP Request → Database Query

**Component:** `get_context_optimization()` → `query_by_activity_category()`  
**Location:** learning_loop.py:751-754

**Input:** Query parameters (validated)
```python
activity_type: str  # e.g., "feature"
limit: int          # e.g., 100
```

**Output:** Function call with parameter mapping
```python
query_by_activity_category(
    activity_category=activity_type,  # Parameter name change
    limit=limit
)
```

**Purpose:** Translate HTTP layer concerns to database layer concerns

---

### Transformation 2: Database Query → Raw Records

**Component:** `query_by_activity_category()`  
**Location:** impulse_learning.py:418-469

**Input:** Filter parameters
```python
activity_category: str  # Activity type to filter by
limit: int              # Max records to return
```

**SurrealDB Query:**
```sql
SELECT * FROM impulse_mapping_record 
WHERE context.activityCategory = $category
ORDER BY metadata.createdAt DESC
LIMIT $limit
```

**Output:** List of raw database records
```python
List[Dict[str, Any]]  # impulse_mapping_record entries
```

**Record Schema:**
```python
{
    "id": "impulse_mapping_record:abc123",
    "context": {
        "activityCategory": "feature",
        "sessionId": "sess_xyz",
        ...
    },
    "impulses": [
        {
            "type": "file",           # Impulse type
            "used": True,             # Whether used in task
            "budget": 2000,           # Token budget allocated
            ...
        }
    ],
    "outcome": {
        "taskSucceeded": True,        # Task success/failure
        "impulsesUsedCount": 2,       # Number of impulses used
        ...
    },
    "metadata": {
        "createdAt": "2026-02-28T10:30:00Z",
        ...
    }
}
```

**Validations:**
- Parameterized query prevents SQL injection ✅
- Returns empty list `[]` if no records found (not error)
- Most recent records first (ORDER BY createdAt DESC)

**Boundary Crossed:** Database boundary (SurrealDB connection)

---

### Transformation 3: Raw Records → Analysis Orchestration

**Component:** `compute_recommendations()`  
**Location:** context_optimization_service.py:203-277

**Input:** 
```python
activity_type: str           # Activity category
records: List[Dict[str, Any]]  # Raw database records
```

**Processing:** Coordinates three independent analysis functions

**Empty Data Handling:**
```python
if not records:
    return ContextOptimizationResult(
        activity_type=activity_type,
        recommended_impulses=[],
        optimal_token_budget=5000,  # Default fallback
        success_correlation=0.0,
        sample_size=0
    )
```

**Purpose:** Graceful degradation for new activity types with no historical data

---

### Transformation 4a: Records → Impulse Success Rates

**Component:** `calculate_impulse_success_rates()`  
**Location:** context_optimization_service.py:50-95

**Algorithm:**
```python
type_stats = defaultdict(lambda: {"successes": 0, "total": 0})

for record in records:
    task_succeeded = record["outcome"]["taskSucceeded"]
    impulses = record["impulses"]
    
    for impulse in impulses:
        if impulse["used"]:  # Only count used impulses
            type_stats[impulse["type"]]["total"] += 1
            if task_succeeded:
                type_stats[impulse["type"]]["successes"] += 1

# Calculate rates
success_rates = {
    impulse_type: (successes / total, successes, total)
    for impulse_type, stats in type_stats.items()
}
```

**Output:**
```python
Dict[str, Tuple[float, int, int]]
# {"file": (0.85, 17, 20), "cochange": (0.72, 13, 18), ...}
# {impulse_type: (success_rate, successes, total_uses)}
```

**Business Logic:**
- Only counts impulses where `used=True` (causal link to outcome)
- Success determined by task-level `taskSucceeded` field
- Groups by impulse type (not individual impulses)
- Zero-division protection: `successes / total if total > 0 else 0.0`

**Defensive Programming:**
```python
outcome = record.get("outcome", {})           # Safe dictionary access
task_succeeded = outcome.get("taskSucceeded", False)  # Default to False
impulses = record.get("impulses", [])         # Default to empty list
impulse_type = impulse.get("type", "unknown") # Handle missing type
```

---

### Transformation 4b: Records → Optimal Token Budget

**Component:** `compute_optimal_token_budget()`  
**Location:** context_optimization_service.py:98-138

**Algorithm:**
```python
successful_budgets = []

for record in records:
    if record["outcome"]["taskSucceeded"]:
        total_budget = sum(imp["budget"] for imp in record["impulses"])
        if total_budget > 0:
            successful_budgets.append(total_budget)

if not successful_budgets:
    return 5000  # Default fallback

avg_budget = sum(successful_budgets) / len(successful_budgets)
optimal_budget = int(round(avg_budget / 500) * 500)  # Round to nearest 500
```

**Output:**
```python
int  # e.g., 3500
```

**Business Logic:**
- **Success-only filtering:** Only averages budgets from tasks where `taskSucceeded=True`
- **Total budget aggregation:** Sums all impulse budgets per task
- **Rounding strategy:** Rounds to nearest 500 for cleaner recommendations
- **Default fallback:** Returns 5000 if no successful executions found

**Example Calculation:**
```
Task 1 (succeeded): impulses=[{budget: 2000}, {budget: 1500}] → total: 3500
Task 2 (succeeded): impulses=[{budget: 3000}, {budget: 500}]  → total: 3500
Task 3 (failed):    impulses=[{budget: 1000}]                → EXCLUDED

Average: (3500 + 3500) / 2 = 3500
Rounded: round(3500 / 500) * 500 = 3500 tokens
```

**Why round to 500?** Human-friendly recommendations (3500, not 3427), aligns with common budget increments

---

### Transformation 4c: Records → Success Correlation

**Component:** `calculate_success_correlation()`  
**Location:** context_optimization_service.py:141-200

**Algorithm:**
```python
with_impulses = {"successes": 0, "total": 0}
without_impulses = {"successes": 0, "total": 0}

for record in records:
    task_succeeded = record["outcome"]["taskSucceeded"]
    impulses_used_count = record["outcome"]["impulsesUsedCount"]
    
    if impulses_used_count > 0:
        with_impulses["total"] += 1
        if task_succeeded:
            with_impulses["successes"] += 1
    else:
        without_impulses["total"] += 1
        if task_succeeded:
            without_impulses["successes"] += 1

success_rate_with = with_impulses["successes"] / with_impulses["total"]
success_rate_without = without_impulses["successes"] / without_impulses["total"]

# Normalized correlation (0-1)
if success_rate_without == 0:
    correlation = success_rate_with  # Perfect correlation
else:
    correlation = max(0.0, min(1.0, 
        success_rate_with / (success_rate_with + success_rate_without)
    ))
```

**Output:**
```python
float  # Range: 0.0 to 1.0
```

**Business Logic:**
- **Segments records:** Tasks with impulses vs. tasks without impulses
- **Compares success rates:** Higher rate with impulses = stronger correlation
- **Normalized score:** 0.0 (no correlation) to 1.0 (perfect correlation)
- **Edge case handling:** If no tasks succeed without impulses, correlation = 1.0

**Interpretation:**
- `0.0-0.3`: Weak correlation (impulses don't help much)
- `0.3-0.6`: Moderate correlation (impulses sometimes help)
- `0.6-0.8`: Strong correlation (impulses usually help)
- `0.8-1.0`: Very strong correlation (impulses critical for success)

**Example:**
```
With impulses:    17 successes / 20 tasks = 85% success rate
Without impulses:  3 successes / 10 tasks = 30% success rate
Correlation: 0.85 / (0.85 + 0.30) = 0.74 (strong positive correlation)
```

---

### Transformation 5: Analysis Results → Structured Recommendations

**Component:** `compute_recommendations()` (continued)  
**Location:** context_optimization_service.py:244-270

**Input:** Three analysis results
```python
success_rates: Dict[str, Tuple[float, int, int]]
optimal_budget: int
correlation: float
```

**Processing:** Combine and format results
```python
# Sort impulse types by success rate (highest first)
recommended_impulses = []
for impulse_type, (success_rate, successes, total) in sorted(
    success_rates.items(), 
    key=lambda x: x[1][0],  # Sort by success_rate
    reverse=True            # Highest first
):
    recommended_impulses.append({
        "type": impulse_type,
        "success_rate": round(success_rate, 3),  # 3 decimal places
        "successes": successes,
        "total_uses": total,
    })
```

**Output:** Structured result object
```python
ContextOptimizationResult(
    activity_type="feature",
    recommended_impulses=[...],  # Sorted by success_rate DESC
    optimal_token_budget=3500,
    success_correlation=0.74,
    sample_size=42
)
```

**Why sort by success rate?** Users need prioritized recommendations (most effective impulses first)

**Why round to 3 decimals?** Balance precision and readability (0.847 vs 0.8473625438)

**Why include sample_size?** Transparency - users assess statistical confidence (50 vs 5000 samples)

---

### Transformation 6: Result Object → HTTP Response

**Component:** `get_context_optimization()` (response mapping)  
**Location:** learning_loop.py:778-784

**Input:** ContextOptimizationResult
```python
result = ContextOptimizationResult(
    activity_type="feature",
    recommended_impulses=[...],
    optimal_token_budget=3500,
    success_correlation=0.74,
    sample_size=42
)
```

**Output:** Pydantic response model
```python
ContextOptimizationResponse(
    activity_type=result.activity_type,
    recommended_impulses=result.recommended_impulses,
    optimal_token_budget=result.optimal_token_budget,
    success_correlation=result.success_correlation,
    sample_size=result.sample_size,
)
```

**Purpose:** 
- Validate response matches API contract (Pydantic validation)
- Enable OpenAPI documentation generation
- Type safety for HTTP serialization

---

### Exit: HTTP JSON Response

**Location:** learning_loop.py:700 (return type annotation)

**Output Format:**
```json
{
  "activity_type": "feature",
  "recommended_impulses": [
    {
      "type": "file",
      "success_rate": 0.85,
      "successes": 17,
      "total_uses": 20
    },
    {
      "type": "cochange",
      "success_rate": 0.72,
      "successes": 13,
      "total_uses": 18
    },
    {
      "type": "annotation",
      "success_rate": 0.60,
      "successes": 6,
      "total_uses": 10
    }
  ],
  "optimal_token_budget": 3500,
  "success_correlation": 0.78,
  "sample_size": 42
}
```

**HTTP Headers:**
```
Content-Type: application/json
Status: 200 OK
```

**Client Usage:**
```typescript
// Activity template can use these recommendations
const response = await fetch('/api/v1/learning-loop/context-optimization?activity_type=feature&limit=100');
const recommendations = await response.json();

// Update activity template configuration
activityTemplate.impulses = recommendations.recommended_impulses.slice(0, 3); // Top 3
activityTemplate.tokenBudget = recommendations.optimal_token_budget;
```

---

## Architectural Boundaries

### 1. HTTP Framework Boundary

**Location:** FastAPI → Application Code  
**Contract:** FastAPI decorators, Pydantic models  
**Coupling:** Tight (framework dependency)

**Components:**
- Request validation (automatic via Pydantic)
- Response serialization (automatic JSON conversion)
- Error handling (HTTPException → HTTP status codes)
- OpenAPI documentation (automatic from type hints)

**Resilience:**
- Automatic 422 errors for validation failures
- Automatic 500 errors for unhandled exceptions
- Request/response logging via middleware

---

### 2. Layer Boundary: Route → Service

**Location:** learning_loop.py → context_optimization_service.py  
**Contract:** Function signature with typed parameters  
**Coupling:** Loose (service has no HTTP dependencies)

**Interface:**
```python
def compute_recommendations(
    activity_type: str,
    records: List[Dict[str, Any]]
) -> ContextOptimizationResult
```

**Benefits:**
- Service can be tested without HTTP server
- Service can be reused in other contexts (CLI, background jobs)
- Clear separation of concerns (HTTP vs. business logic)

---

### 3. Layer Boundary: Route → Database

**Location:** learning_loop.py → impulse_learning.py  
**Contract:** Function signature with typed parameters  
**Coupling:** Loose (route doesn't construct SQL)

**Interface:**
```python
def query_by_activity_category(
    activity_category: str,
    limit: int
) -> List[Dict[str, Any]]
```

**Benefits:**
- Route doesn't know database schema details
- Database layer encapsulates query construction
- Easy to swap database implementations

---

### 4. Data Store Boundary: Application → SurrealDB

**Location:** impulse_learning.py → SurrealDB  
**Contract:** SurrealDB query language, connection protocol  
**Coupling:** Medium (SurrealDB-specific query syntax)

**Connection:**
```python
db = get_surreal_client()  # Singleton with lazy initialization
result = db.query(sql_string, params_dict)
```

**Configuration:**
```python
SURREALDB_URL: str = "http://localhost:8000"
SURREALDB_NAMESPACE: str = "metabob"
SURREALDB_DATABASE: str = "learning_loop"
```

**Resilience:**
- Parameterized queries prevent SQL injection ✅
- No query timeout (RISK) ⚠️
- No connection pooling visible ⚠️
- No retry logic ⚠️
- No circuit breaker ⚠️

---

## Key Insights

### Business Purpose

The context optimization endpoint enables **data-driven configuration** of activity templates by answering:

1. **Which impulses should I create?** → Recommended impulses ranked by success rate
2. **How much context should I allocate?** → Optimal token budget from successful executions
3. **Do impulses actually help?** → Success correlation measures impulse effectiveness

**Value Proposition:** Instead of manually configuring activity templates through trial-and-error, users can leverage historical data to optimize configuration for better success rates and lower costs.

**Use Cases:**
- Template authors: "Which impulses work best for feature implementation tasks?"
- System administrators: "Should I allocate 3000 or 5000 tokens for bugfix activities?"
- Data analysts: "Are impulses worth the computational cost?"

---

### Critical Decision Points

#### 1. Success-Only Budget Calculation

**Decision:** Only average token budgets from tasks where `taskSucceeded=True`

**Rationale:** Failed tasks may have under-provisioned budgets (too little context) or over-provisioned budgets (wasted resources but still failed). Only successful tasks represent "optimal" usage patterns.

**Trade-off:** Ignores potentially valuable data from failures (e.g., "5000 tokens still failed, need more")

**Alternative Considered:** Include all tasks and use median instead of mean (more robust to outliers)

---

#### 2. Sorting by Success Rate

**Decision:** Sort recommended impulses by success rate (highest first)

**Rationale:** Users need actionable, prioritized recommendations. Most effective impulses should be at the top of the list.

**Trade-off:** High success rate with low sample size (1/1 = 100%) ranks above moderate success rate with high sample size (85/100 = 85%)

**Alternative Considered:** Sort by `success_rate * total_uses` (balances rate and confidence) or Bayesian estimation with priors

---

#### 3. Graceful Degradation for Empty Data

**Decision:** Return valid response with defaults when no historical data exists

**Rationale:** New activity types start with zero data. Returning 404 or 500 error would break client workflows.

**Defaults:**
- `recommended_impulses`: `[]` (empty - no recommendations)
- `optimal_token_budget`: `5000` (conservative fallback based on system knowledge)
- `success_correlation`: `0.0` (no data = no correlation)
- `sample_size`: `0` (transparent about data availability)

**Trade-off:** 5000 token default may be too high or too low for specific activity types

**Alternative Considered:** Return 404 Not Found (but breaks client experience)

---

#### 4. Rounding Token Budget to 500

**Decision:** Round optimal token budget to nearest 500 (e.g., 3427 → 3500)

**Rationale:** 
- Human-friendly recommendations (easier to remember and configure)
- Aligns with common budget increments (1000, 1500, 2000, 2500, etc.)
- Reduces false precision (3427 implies more accuracy than data supports)

**Trade-off:** Loses granularity (3200 and 3700 both round to 3500)

**Alternative Considered:** Round to nearest 1000 (less granular) or return exact average (false precision)

---

### Potential Risks & Technical Debt

#### Security Risks (HIGH PRIORITY)

1. **No Authentication/Authorization** ⚠️ CRITICAL
   - **Risk:** Anyone can query historical learning data
   - **Impact:** Information disclosure about system behavior
   - **Mitigation:** Add JWT token or API key validation
   - **Effort:** Medium (requires auth infrastructure)

2. **No Rate Limiting** ⚠️ CRITICAL
   - **Risk:** Denial of Service via repeated expensive queries
   - **Impact:** Database exhaustion, API downtime
   - **Mitigation:** Add rate limiter (e.g., slowapi, Redis-based)
   - **Effort:** Medium

3. **Error Message Information Disclosure** ⚠️ LOW
   - **Risk:** Generic exception handler returns raw error messages
   - **Impact:** Leaks internal details (database IPs, stack traces)
   - **Mitigation:** Sanitize error messages for 500 responses
   - **Effort:** Low

---

#### Reliability Risks (MEDIUM PRIORITY)

4. **No Query Timeout** ⚠️ MEDIUM
   - **Risk:** Long-running queries block API threads indefinitely
   - **Impact:** Thread pool exhaustion, cascading failures
   - **Mitigation:** Add timeout wrapper (e.g., asyncio.wait_for)
   - **Effort:** Low

5. **No Connection Pooling** ⚠️ MEDIUM
   - **Risk:** Each query acquires new database connection
   - **Impact:** Connection overhead, resource exhaustion
   - **Mitigation:** Implement connection pooling in surrealdb_client
   - **Effort:** Medium

6. **No Retry Logic** ⚠️ MEDIUM
   - **Risk:** Transient database failures cause immediate 500 errors
   - **Impact:** Poor user experience, unnecessary failures
   - **Mitigation:** Add exponential backoff retry for transient errors
   - **Effort:** Medium

---

#### Data Quality Risks (LOW PRIORITY)

7. **No Statistical Significance Testing** ⚠️ LOW
   - **Risk:** 1-sample success rate (100%) ranks above 100-sample rate (85%)
   - **Impact:** Misleading recommendations, poor decisions
   - **Mitigation:** Add confidence intervals or Bayesian estimation
   - **Effort:** High (requires statistics library)

8. **No Input Validation at Service Boundary** ⚠️ LOW
   - **Risk:** Service assumes well-formed records, crashes on malformed data
   - **Impact:** Runtime crashes if database schema changes
   - **Mitigation:** Add schema validation layer
   - **Effort:** Medium

9. **No Outlier Detection** ⚠️ LOW
   - **Risk:** One task with 50,000 token budget skews average
   - **Impact:** Unrealistic budget recommendations
   - **Mitigation:** Use median instead of mean, or remove outliers
   - **Effort:** Low

---

#### Performance Risks (LOW PRIORITY)

10. **No Caching** ⚠️ LOW
    - **Risk:** Repeated queries hit database every time
    - **Impact:** Unnecessary load, slow response times
    - **Mitigation:** Add TTL-based cache (e.g., Redis, in-memory)
    - **Effort:** Medium

11. **No Pagination** ⚠️ LOW
    - **Risk:** Large result sets (limit=500) loaded into memory at once
    - **Impact:** Memory pressure, slow queries
    - **Mitigation:** Add cursor-based pagination
    - **Effort:** High (requires API design changes)

---

### Suggested Improvements

#### Phase 1: Security Hardening (Before Production)

**Priority: CRITICAL**

1. **Add Authentication** (2-3 days)
   ```python
   from server.auth import get_current_user
   
   @router.get("/context-optimization", dependencies=[Depends(get_current_user)])
   async def get_context_optimization(...):
   ```

2. **Add Rate Limiting** (1-2 days)
   ```python
   from slowapi import Limiter
   
   limiter = Limiter(key_func=get_remote_address)
   
   @router.get("/context-optimization")
   @limiter.limit("10/minute")
   async def get_context_optimization(...):
   ```

3. **Add Query Timeout** (1 day)
   ```python
   try:
       result = await asyncio.wait_for(db.query(...), timeout=5.0)
   except asyncio.TimeoutError:
       raise HTTPException(status_code=504, detail="Query timeout")
   ```

**Total Effort:** 4-6 days  
**Impact:** Production-ready security and reliability

---

#### Phase 2: Statistical Improvements (Post-Launch)

**Priority: MEDIUM**

4. **Add Confidence Intervals** (3-5 days)
   ```python
   from scipy import stats
   
   # Calculate Wilson score confidence interval
   confidence_interval = stats.proportion_confint(
       successes, total, alpha=0.05, method='wilson'
   )
   ```

5. **Add Bayesian Estimation** (5-7 days)
   ```python
   # Use beta distribution priors to handle low sample sizes
   # 1 success / 1 use → posterior mean closer to prior (e.g., 0.50)
   # 85 successes / 100 uses → posterior mean closer to observed (0.85)
   ```

**Total Effort:** 8-12 days  
**Impact:** More reliable recommendations for low-sample-size data

---

#### Phase 3: Performance Optimization (As Needed)

**Priority: LOW**

6. **Add Redis Caching** (2-3 days)
   ```python
   from cachetools import TTLCache
   
   cache = TTLCache(maxsize=100, ttl=300)  # 5 minute TTL
   
   def get_cached_recommendations(activity_type, limit):
       cache_key = f"{activity_type}:{limit}"
       if cache_key in cache:
           return cache[cache_key]
       # ... fetch from database
       cache[cache_key] = result
       return result
   ```

7. **Add Connection Pooling** (2-3 days)
   ```python
   # Implement proper connection pooling in surrealdb_client
   from queue import Queue
   
   connection_pool = Queue(maxsize=10)
   ```

**Total Effort:** 4-6 days  
**Impact:** Faster response times, reduced database load

---

## Reusable Patterns

### Pattern 1: Learning-Driven Recommendation System

**Pattern:** Historical Data → Statistical Analysis → Actionable Recommendations

**Components:**
1. **Data Collection:** Store execution outcomes with metadata (impulse usage, success/failure, resource consumption)
2. **Aggregation:** Group data by category (activity type) and dimension (impulse type)
3. **Statistical Analysis:** Calculate success rates, averages, correlations
4. **Ranking:** Sort by effectiveness metric (success rate)
5. **Recommendation:** Return top N items with confidence metrics

**Applicable To:**
- Model selection ("Which LLM performs best for code generation tasks?")
- Tool recommendation ("Which tools work best for debugging activities?")
- Resource allocation ("How much memory should I allocate for analysis tasks?")
- Agent selection ("Which agent is most effective for refactoring?")

**Abstraction Potential:** HIGH - This pattern could be extracted into a reusable activity template:
```
Template: learning-driven-recommendations
Variables:
  - data_table: str              # Table to query
  - category_field: str          # Grouping dimension
  - effectiveness_metric: str    # Success measure
  - recommendation_type: str     # What to recommend
```

---

### Pattern 2: Graceful Degradation with Defaults

**Pattern:** Empty Data → Valid Response with Reasonable Defaults

**Components:**
1. **Empty Check:** Detect when query returns no results
2. **Default Values:** Provide reasonable fallbacks based on system knowledge
3. **Transparency:** Include metadata showing data availability (sample_size=0)
4. **Valid Response:** Return success (200) not error (404)

**Example from Code:**
```python
if not records:
    return ContextOptimizationResponse(
        activity_type=activity_type,
        recommended_impulses=[],      # Empty recommendations
        optimal_token_budget=5000,    # Conservative fallback
        success_correlation=0.0,      # No data = no correlation
        sample_size=0,                # Transparent about data availability
    )
```

**Applicable To:**
- User preferences (new users → default settings)
- Metrics dashboards (new features → zero metrics)
- Personalization (cold start → popular items)

**Abstraction Potential:** MEDIUM - Common pattern but defaults are domain-specific

---

### Pattern 3: Multi-Metric Analysis

**Pattern:** Single Data Set → Multiple Independent Metrics → Combined Result

**Components:**
1. **Data Source:** Single query fetches all needed data
2. **Independent Analysis:** Multiple functions calculate different metrics
3. **Combination:** Orchestrator combines results into single output
4. **Sorting/Ranking:** Apply business rules to prioritize results

**Example from Code:**
```python
def compute_recommendations(activity_type, records):
    # Three independent analyses
    success_rates = calculate_impulse_success_rates(records)
    optimal_budget = compute_optimal_token_budget(records)
    correlation = calculate_success_correlation(records)
    
    # Combine and rank
    return ContextOptimizationResult(
        recommended_impulses=sorted(success_rates, key=rate, reverse=True),
        optimal_token_budget=optimal_budget,
        success_correlation=correlation,
    )
```

**Applicable To:**
- Code quality analysis (multiple metrics: complexity, duplication, test coverage)
- Performance profiling (CPU, memory, I/O metrics)
- User analytics (engagement, retention, satisfaction metrics)

**Abstraction Potential:** MEDIUM - Pattern is common but metric calculations are domain-specific

---

### Pattern 4: Defensive Data Access

**Pattern:** Safe Dictionary Access with Defaults

**Components:**
1. **`.get()` with defaults:** `record.get("key", default_value)`
2. **Type checking:** Assume data may be None or wrong type
3. **Zero-division protection:** Check denominator before division
4. **Empty collection handling:** Check list length before iteration

**Example from Code:**
```python
outcome = record.get("outcome", {})           # Not record["outcome"]
task_succeeded = outcome.get("taskSucceeded", False)
impulses = record.get("impulses", [])         # Not record["impulses"]

for impulse in impulses:  # Safe even if impulses is []
    impulse_type = impulse.get("type", "unknown")

success_rate = successes / total if total > 0 else 0.0  # No ZeroDivisionError
```

**Applicable To:**
- Any code processing external data (APIs, databases, user input)
- Data pipelines with potentially missing fields
- Error-tolerant systems

**Abstraction Potential:** HIGH - This is a universal best practice

---

### Pattern 5: Layered Architecture with Clear Boundaries

**Pattern:** Route Layer → Service Layer → Data Layer

**Components:**
1. **Route Layer:** HTTP concerns (validation, serialization, error codes)
2. **Service Layer:** Business logic (pure functions, no HTTP/DB knowledge)
3. **Data Layer:** Database concerns (queries, connection management)

**Benefits:**
- **Testability:** Each layer can be tested independently
- **Reusability:** Service layer can be used from multiple entry points (HTTP, CLI, background jobs)
- **Maintainability:** Clear separation of concerns

**Example from Code:**
```
learning_loop.py (Route Layer)
  ↓
context_optimization_service.py (Service Layer)
  ↓
impulse_learning.py (Data Layer)
  ↓
SurrealDB (Data Store)
```

**Applicable To:**
- All API endpoints
- CLI commands
- Background workers
- Event handlers

**Abstraction Potential:** HIGH - This is a well-established architectural pattern

---

## Feature-Specific vs. Universal Aspects

### Universal (Reusable)

✅ **Layered architecture** - Route → Service → Data separation  
✅ **Graceful degradation** - Empty data returns valid defaults  
✅ **Defensive programming** - Safe dictionary access, zero-division protection  
✅ **Parameterized queries** - SQL injection prevention  
✅ **Statistical aggregation** - Group by dimension, calculate metrics  
✅ **Ranking by effectiveness** - Sort by success metric  

---

### Feature-Specific (Not Reusable)

❌ **Impulse success rate calculation** - Domain-specific logic  
❌ **Token budget averaging** - Activity template specific  
❌ **Success correlation formula** - Impulse-specific metric  
❌ **Activity category filtering** - Learning loop taxonomy  
❌ **5000 token default** - System-specific knowledge  

---

## Activity Template Opportunities

### Potential Template: `analyze-historical-effectiveness`

**Purpose:** Generic pattern for analyzing historical data to recommend optimal configurations

**Variables:**
```yaml
data_table: str              # Database table to query
category_field: str          # Grouping dimension
effectiveness_metric: str    # What to measure (success_rate, latency, cost)
resource_metric: str         # What to optimize (token_budget, memory, time)
recommendation_type: str     # What to recommend (tools, models, configurations)
```

**Tasks:**
1. Query historical data filtered by category
2. Calculate effectiveness metrics per item
3. Calculate optimal resource allocation
4. Calculate correlation between item usage and success
5. Rank items by effectiveness
6. Return recommendations with confidence metrics

**Applicability:**
- Model selection optimization
- Tool effectiveness analysis
- Agent performance comparison
- Resource allocation tuning

**Effort to Extract:** 3-5 days (requires abstracting domain-specific logic)

---

## Conclusion

The context optimization endpoint demonstrates **solid software engineering practices** with clear architectural boundaries, defensive programming, and graceful degradation. The implementation is **functionally complete** and **well-structured**, but requires **security hardening** (authentication, rate limiting) before production deployment.

**Key Strengths:**
- Clear layer separation (route → service → database)
- Comprehensive statistical analysis (success rates, budgets, correlation)
- Graceful handling of edge cases (empty data, missing fields)
- Actionable, prioritized recommendations

**Production Readiness Checklist:**
- ❌ Authentication/Authorization
- ❌ Rate Limiting
- ❌ Query Timeout
- ✅ Input Validation
- ✅ Error Handling
- ✅ Logging
- ⚠️ Caching (optional but recommended)
- ⚠️ Connection Pooling (optional but recommended)

**Recommended Next Steps:**
1. Implement authentication and rate limiting (CRITICAL)
2. Add query timeout (HIGH)
3. Deploy to staging with monitoring (MEDIUM)
4. Add statistical confidence intervals (LOW)
5. Implement caching (LOW)

**Overall Assessment:** 🟡 **Production-Ready with Security Fixes**

The implementation is **architecturally sound** and **functionally complete**. With authentication and rate limiting added (4-6 days effort), this endpoint is ready for production deployment.
