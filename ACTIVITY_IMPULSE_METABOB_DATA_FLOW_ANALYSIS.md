# Activity System, Impulse System & Metabob-CLI Integration Analysis

**Date**: February 16, 2026  
**Purpose**: Comprehensive data flow analysis to identify what works, what's unused, and optimization opportunities

---

## Executive Summary

**Status**: 🟡 **Partially Integrated** - Core plumbing exists but many features are **unused or disconnected**

### What's Working ✅
1. Activity execution with template-based workflows
2. Basic impulse loading/formatting during task execution  
3. Metabob context injection (issues, annotations, impact analysis)
4. Activity metrics tracking (tokens, cost, duration)

### What's Unused/Missing ❌
1. **Learning loop is DISCONNECTED** - Impulse usage data not being captured
2. **Learned impulses reverse flow is NOT USED** - Backend endpoints exist but never called
3. **Activity-specific impulse discovery is UNUSED** - No pre-loading of proven context
4. **Co-change predictions are PARTIALLY USED** - Only for filtering, not learning
5. **Template evolution/improvement is MANUAL** - No automated learning from failures

---

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OpenCode Activity Tool                          │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ 1. User calls: activity(templateId, variables, reason)          │ │
│  │ 2. ActivityTool validates variables                             │ │
│  │ 3. Creates Activity.Info record in storage                      │ │
│  │ 4. Registers session->activity mapping                          │ │
│  │ 5. Creates child session for each task                          │ │
│  │ 6. Executes tasks sequentially with validation                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│                  Task Execution (Per-Task Child Session)               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ Phase 1: Context Gathering                                       │ │
│  │  - loadAndFormatImpulses(task.impulseReferences) ✅ USED       │ │
│  │  - ImpulseResolver.load() for each impulse                      │ │
│  │  - Format as markdown injection in prompt                       │ │
│  │                                                                  │ │
│  │ Phase 2: Metabob Context (if enabled)                           │ │
│  │  - metabob.getPriorityIssues() ✅ USED                          │ │
│  │  - metabob.getAnnotations() ✅ USED (if inject_annotations)    │ │
│  │  - metabob.analyzeChangeImpact() ✅ USED (if auto_impact)      │ │
│  │  - Context ranking with ContextRanker ✅ USED                   │ │
│  │                                                                  │ │
│  │ Phase 3: Agent Execution                                         │ │
│  │  - Session.send() with enriched prompt                          │ │
│  │  - Agent executes with tools                                    │ │
│  │                                                                  │ │
│  │ Phase 4: Validation                                              │ │
│  │  - runValidationCommands() ✅ USED                              │ │
│  │  - Check required files/patterns                                │ │
│  │  - If fails: Trailblazing or abort                              │ │
│  │                                                                  │ │
│  │ Phase 5: Metrics Extraction                                      │ │
│  │  - extractMetricsFromSession() ✅ USED                          │ │
│  │  - Track tokens, cost, duration                                 │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    ActivityExecution Tracking                          │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ ActivityExecution dataclass (in ActivityManager.py):            │ │
│  │                                                                  │ │
│  │ ✅ CAPTURED:                                                    │ │
│  │  - execution_id, activity_id, session_id, variant_id           │ │
│  │  - step_results[] with success/failure                          │ │
│  │  - total_cost, total_tokens, duration                           │ │
│  │  - variables (user-provided)                                    │ │
│  │                                                                  │ │
│  │ ❌ NOT CAPTURED (exists in schema but unused):                 │ │
│  │  - impulses_loaded (in StepResult)                              │ │
│  │  - impulses_created (in StepResult)                             │ │
│  │  - context_summary (in StepResult)                              │ │
│  │  - impulses_used (in ActivityExecution)                         │ │
│  │  - component_changes (in ActivityExecution)                     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│                     Post-Activity Completion                           │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ 1. Activity.complete() updates Activity.Info                    │ │
│  │ 2. Activity.unregisterSession()                                 │ │
│  │ 3. post_activity_result tool (optional)                         │ │
│  │                                                                  │ │
│  │ ❌ MISSING: Learning loop capture                              │ │
│  │  - No call to Metabob backend /v2/impulses/record-usage        │ │
│  │  - Impulse usage data stays local, never persisted             │ │
│  │  - No feedback to improve future executions                     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Analysis

### 1. Activity System Data Flow

#### Entry Points ✅
1. **activity tool** (`repos/metabob-opencode/packages/opencode/src/tool/activity.ts`)
   - User-facing tool for activity execution
   - Validates template variables with fuzzy matching
   - Creates Activity.Info record in storage
   - Orchestrates task execution

2. **activity_replay tool** 
   - Resume failed activities from specific task
   - Reuses impulses and variables from original execution

3. **activity CLI command**
   - Command-line interface for activity management
   - Template registration, listing, execution

#### Core Execution Engine ✅
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Key Functions**:
- `Activity.registerSession(sessionId, activityId)` - Links session to activity
- `Activity.getActivityForSession(sessionId)` - Retrieve activity context
- `Activity.registerSessionMemory(sessionId)` - Track memory-enabled sessions

**Data Structures**:
```typescript
Activity.Info {
  id: string                    // act_{timestamp}_{random}
  templateID: string            // Template used
  status: Status                // setup|executing|completing|done|failed
  prompts: PromptInfo[]         // Task execution tracking
  commits: CommitInfo[]         // Git commits during execution
  stats: ActivityStats          // Metrics rollup
  variables: Record<string, unknown>
  createdAt: number
}

ActivityStats {
  tokens: SessionTokens         // input, output, cache breakdown
  cost: CostStats              // total + per-prompt
  metabob: MetabobStats        // issuesResolved, issuesAdded, totalParticipations
  duration: number             // milliseconds
  prURL?: string               // Pull request if created
}
```

#### Task Execution ✅
**File**: `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts`

**Key Functions**:
1. `loadAndFormatImpulses(impulseIds, activityImpulses)` ✅ **USED**
   - Loads impulses in parallel
   - Formats as markdown injection
   - Mutates activityImpulses in-place with loaded content
   - Returns formatted string for prompt injection

2. `extractMetricsFromSession(sessionID)` ✅ **USED**
   - Reads last assistant message
   - Extracts tokens (input, output, cache)
   - Extracts cost
   - Used by both normal execution and trailblazing

3. `runValidationCommands(commands, cwd)` ✅ **USED**
   - Runs shell commands for validation
   - Checks exit codes
   - Returns success/failure

#### Exit Points ✅
1. **Activity.complete()** - Marks activity as done/failed
2. **post_activity_result tool** - Manual result submission to backend
3. **Activity.unregisterSession()** - Cleanup

---

### 2. Impulse System Integration

#### Impulse Schema (ActivityTemplate.Impulse.Schema)
```typescript
{
  id: string                    // Unique impulse ID
  type: "file" | "memo" | "metabobIssue" | "bashOutput" | "activityOutput"
  pointer: {
    type: string
    path?: string               // For file pointers
    content?: string            // For memo pointers
    issueId?: string           // For metabobIssue pointers
    activityId?: string        // For activityOutput pointers
    taskId?: string            // Which task created it
  }
  budget: number                // Token budget for this impulse
  scope: "session" | "activity" | "global"
  loaded: boolean               // Has content been loaded?
  content?: string              // Loaded content (lazy)
  createdBy?: string           // What created this impulse
  createdFor?: string          // What it's used for
  tags?: string[]              // Categorization
}
```

#### Impulse Lifecycle

**Phase 1: Creation** ✅ WORKS
- Impulses defined in activity templates (task.impulseReferences)
- Created programmatically via impulse_create tool
- Stored in Activity.Info.impulses record

**Phase 2: Loading** ✅ WORKS  
**File**: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`

```typescript
ImpulseResolver.load(impulse: ActivityTemplate.Impulse.Schema)
  → Resolves pointer to actual content
  → Handles file, memo, metabobIssue, activityOutput types
  → Respects token budget (truncation)
  → Returns updated impulse with content and loaded=true
```

**Phase 3: Injection** ✅ WORKS
- `loadAndFormatImpulses()` formats loaded impulses as markdown
- Injected into task prompts
- Example format:
  ```markdown
  <shared_impulses>
  ## Impulse: api-design (2000 tokens)
  **Type**: memo
  
  API Design:
  - REST endpoints
  - JWT authentication
  ...
  </shared_impulses>
  ```

**Phase 4: Usage Tracking** ❌ **NOT CAPTURED**

The schema exists but is unused:
```typescript
StepResult {
  impulses_loaded: list[str]    // ❌ Always empty
  impulses_created: list[str]   // ❌ Always empty
  context_summary: dict          // ❌ Always empty
}

ActivityExecution {
  impulses_used: list[dict]      // ❌ Always empty
  component_changes: list[dict]  // ❌ Always empty
}
```

**Missing Flow**:
```typescript
// Should happen after each task:
_capture_task_impulse_usage(task_id, step_result) {
  // 1. Record which impulses were loaded
  // 2. Track which impulses helped (task succeeded)
  // 3. Capture new impulses created by task
  // 4. Send to backend: POST /v2/impulses/record-usage
}
```

---

### 3. Metabob-CLI Activity Manager

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

#### API Endpoints Used ✅

1. **GET /v2/activities/templates** ✅ **ACTIVE**
   - Called by `search_activities()`
   - Returns activity templates with metadata
   - Used by OpenCode for template discovery

2. **POST /v2/activities/{variant_id}/execute** ❓ **UNCLEAR IF USED**
   - Endpoint exists in backend
   - Not clear if OpenCode uses this or executes locally

#### API Endpoints Defined But NEVER CALLED ❌

1. **GET /v2/impulses/learned** ❌ **UNUSED**
   ```python
   async def query_learned_impulses(
       min_usage_count: int = 5,
       min_success_rate: float = 0.7,
       impulse_type: Optional[str] = None,
       limit: int = 10,
       days: int = 30,
   ) -> list[dict]
   ```
   - **Purpose**: Retrieve high-success impulses for session pre-initialization
   - **Status**: Method exists, endpoint works, **NEVER CALLED**
   - **Missing**: Integration with SessionMemoryAgent

2. **GET /v2/impulses/for-activity/{variant_id}** ❌ **UNUSED**
   ```python
   async def query_activity_impulses(
       variant_id: str,
       min_success_rate: float = 0.6,
       limit: int = 10,
   ) -> dict
   ```
   - **Purpose**: Get proven impulses for specific activity
   - **Status**: Method exists, endpoint works, **NEVER CALLED**
   - **Missing**: Called before activity execution to pre-load context

3. **POST /v2/impulses/record-usage** ❌ **MISSING ENDPOINT**
   - **Purpose**: Record impulse usage after task execution
   - **Status**: **No endpoint defined**, method doesn't exist
   - **Needed For**: Learning loop to work

#### Internal Methods (Not MCP Tools) ❌ UNUSED

```python
# These exist in ActivityManager but are NEVER CALLED:

async def _capture_session_impulses(session_id: str) -> list[dict]
    """Capture impulses used during session execution"""
    # ❌ Never called - impulse tracking disconnected

def _generate_impulse_id(impulse: dict) -> str
    """Generate stable ID for impulse"""
    # ❌ Never called

def _estimate_impulse_tokens(impulse: dict) -> int
    """Estimate token count for impulse"""
    # ❌ Never called
```

---

### 4. Backend API (Metabob RPC)

#### Impulse Endpoints ✅ EXIST

**File**: `repos/metabob-rpc-api/server/routes/v2_impulses.py`

1. **GET /v2/impulses/learned** ✅ **ENDPOINT EXISTS, UNUSED**
   ```python
   Query parameters:
     - min_usage_count (default 5)
     - min_success_rate (default 0.7)
     - impulse_type (optional)
     - limit (default 10, max 50)
     - days (default 30)
   
   Returns: LearnedImpulsesResponse {
     impulses: List[LearnedImpulse]
     total_count: int
     filters_applied: dict
   }
   ```

2. **GET /v2/impulses/for-activity/{variant_id}** ✅ **ENDPOINT EXISTS, UNUSED**
   ```python
   Returns: ActivityImpulsesResponse {
     activity_id: str
     activity_name: str
     impulses: List[LearnedImpulse]
     total_executions: int
     success_rate: float
   }
   ```

#### Database Tables ✅ EXIST

**Tables**:
1. `impulse_registry` - Stores impulse definitions and metadata
2. `impulse_usage` - Links impulses to execution steps with success metrics

**Schema** (inferred from queries):
```sql
-- impulse_registry
{
  impulse_id: string,
  impulse_type: string,  -- file, memo, metabobIssue, bashOutput
  pointer: json,
  scope: string,         -- session, activity, global
  budget: int,
  created_by: string,
  created_for: string,
  tags: list<string>,
  created_at: datetime
}

-- impulse_usage
{
  impulse_id: string,
  step_id: string,
  execution_id: string,
  activity_id: string,
  session_id: string,
  success: boolean,
  tokens_used: int,
  created_at: datetime
}
```

**Status**: ✅ Tables exist, ❌ **NO DATA** - never populated

---

## Gap Analysis: What's Broken

### 1. Learning Loop is Completely Disconnected ❌

**Problem**: Impulse usage is never captured, so the system can't learn

**Missing Pieces**:
```typescript
// After each task in activity execution:
async function captureImpulseUsage(
  taskId: string,
  stepResult: StepResult,
  activity: Activity.Info
) {
  // 1. Identify which impulses were loaded
  const loadedImpulses = getLoadedImpulsesForTask(taskId)
  
  // 2. Determine task success
  const success = stepResult.success
  
  // 3. Send to backend
  await metabobCLI.recordImpulseUsage({
    execution_id: activity.id,
    activity_id: activity.templateID,
    task_id: taskId,
    impulses: loadedImpulses.map(imp => ({
      impulse_id: imp.id,
      tokens_used: estimateTokens(imp.content),
      success: success
    }))
  })
}
```

**Backend Endpoint Needed**:
```python
@router.post("/v2/impulses/record-usage")
async def record_impulse_usage(
    request: RecordUsageRequest,
    session: SessionData = Depends(validate_session),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    """
    Record impulse usage during activity execution.
    
    Creates impulse_usage records for learning loop.
    """
    for usage in request.impulse_usages:
        await db.query("""
            CREATE impulse_usage SET
                impulse_id = $impulse_id,
                step_id = $step_id,
                execution_id = $execution_id,
                activity_id = $activity_id,
                session_id = $session_id,
                success = $success,
                tokens_used = $tokens_used,
                created_at = time::now()
        """, {
            "impulse_id": usage.impulse_id,
            "step_id": usage.task_id,
            "execution_id": request.execution_id,
            "activity_id": request.activity_id,
            "session_id": session.session_id,
            "success": usage.success,
            "tokens_used": usage.tokens_used,
        })
```

### 2. Learned Impulses Reverse Flow is Unused ❌

**Problem**: Backend can serve learned impulses, but nothing asks for them

**Missing Integration**:
```typescript
// In SessionMemoryAgent or activity tool before execution:
async function preloadLearnedContext(
  activityId: string,
  userPrompt: string
) {
  // 1. Query proven impulses for this activity
  const activityImpulses = await metabobCLI.query_activity_impulses(
    activityId,
    min_success_rate=0.7
  )
  
  // 2. Query globally successful impulses
  const learnedImpulses = await metabobCLI.query_learned_impulses(
    min_usage_count=5,
    min_success_rate=0.7,
    impulse_type="file",  // or based on activity category
    limit=5
  )
  
  // 3. Rank by relevance to user prompt
  const relevantImpulses = rankByRelevance(
    [...activityImpulses, ...learnedImpulses],
    userPrompt
  )
  
  // 4. Inject into activity.impulses
  for (const impulse of relevantImpulses.slice(0, 3)) {
    activity.impulses[impulse.impulse_id] = impulse
  }
}
```

### 3. Activity Template Improvement is Manual ❌

**Problem**: Templates don't evolve based on execution data

**Missing Feature**: Template evolution system
- Should analyze failed executions
- Should suggest prompt improvements
- Should create new variant with fixes
- Should A/B test variants

**Opportunity**: Implement `activity_evolve` template (already in backend bootstrap)

### 4. Metabob Co-change Learning is One-Way ❌

**Current State**:
- Metabob backend tracks co-change patterns ✅
- Used for filtering context (suggest_related_changes) ✅
- **NOT** used for impulse pre-loading ❌

**Missing**: Use co-change data to predict useful impulses
```typescript
// When user edits auth.py:
const relatedFiles = await metabob.suggest_related_changes(["auth.py"])
// Returns: ["auth_test.py", "session.py", "middleware.py"]

// Should ALSO:
const relatedImpulses = await metabobCLI.query_learned_impulses({
  files: relatedFiles,
  min_success_rate: 0.7
})
// Pre-load impulses from files that frequently co-change
```

---

## Recommendations: Priority Fixes

### 🔴 **CRITICAL (P0): Close the Learning Loop**

**Impact**: Without this, the system can't improve from experience

**Tasks**:
1. Create `POST /v2/impulses/record-usage` endpoint in backend
2. Implement `ActivityManager.record_impulse_usage()` in metabob-cli
3. Call `record_impulse_usage()` after each task in activity execution
4. Populate StepResult.impulses_loaded/impulses_created fields

**Estimated Effort**: 2-3 hours
**Files to Modify**:
- `repos/metabob-rpc-api/server/routes/v2_impulses.py` (new endpoint)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (new method)
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (call after task)

### 🟡 **HIGH (P1): Enable Learned Impulse Pre-loading**

**Impact**: Activities start with proven context, improving success rate

**Tasks**:
1. Call `query_activity_impulses()` before activity execution
2. Call `query_learned_impulses()` for session initialization
3. Integrate with SessionMemoryAgent
4. Add relevance ranking based on user prompt

**Estimated Effort**: 3-4 hours
**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (pre-execution)
- `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts` (session init)

### 🟡 **HIGH (P1): Co-change Impulse Discovery**

**Impact**: Automatically load relevant context based on file relationships

**Tasks**:
1. When user edits file, get co-change predictions
2. Query learned impulses filtered by co-change files
3. Auto-load top 3 impulses into session context

**Estimated Effort**: 2-3 hours
**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (add file filter)

### 🟢 **MEDIUM (P2): Template Evolution System**

**Impact**: Templates improve automatically based on failures

**Tasks**:
1. Analyze failed executions to find common patterns
2. Generate improved template variants
3. Implement A/B testing between variants
4. Track variant performance metrics

**Estimated Effort**: 1-2 days
**Files to Modify**:
- Create new endpoint: `POST /v2/activities/evolve`
- Implement template diffing and improvement suggestions
- Use activity_evolve bootstrap template

### 🟢 **MEDIUM (P2): Impulse Budget Optimization**

**Impact**: Better token utilization, less truncation

**Tasks**:
1. Track actual token usage per impulse
2. Adjust budgets based on historical data
3. Implement smart truncation (keep important parts)

**Estimated Effort**: 4-6 hours

---

## Visual Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INITIATES ACTIVITY                      │
│  activity(templateId="fix-bug-complete", variables={...})           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│              ACTIVITY TOOL (activity.ts)                            │
│  1. Validate template variables                                     │
│  2. Fetch template from TemplateRepository                          │
│  3. Create Activity.Info record                                     │
│  4. ❌ MISSING: Call query_activity_impulses(templateId)           │
│  5. ❌ MISSING: Pre-load proven impulses into activity.impulses    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│              FOR EACH TASK IN TEMPLATE                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ PHASE 1: CONTEXT GATHERING                                    │ │
│  │  ✅ loadAndFormatImpulses(task.impulseReferences)            │ │
│  │  ✅ ImpulseResolver.load() - Fetch content                   │ │
│  │  ✅ Format as markdown injection                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ PHASE 2: METABOB CONTEXT                                      │ │
│  │  ✅ metabob.getPriorityIssues() - Get issues                 │ │
│  │  ✅ metabob.getAnnotations() - Get past decisions            │ │
│  │  ✅ metabob.analyzeChangeImpact() - Understand blast radius  │ │
│  │  ✅ ContextRanker.rank() - Prioritize by relevance           │ │
│  │  ❌ MISSING: Use co-change data for impulse discovery        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ PHASE 3: EXECUTION                                             │ │
│  │  ✅ Session.send(enrichedPrompt)                              │ │
│  │  ✅ Agent uses tools, produces output                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ PHASE 4: VALIDATION                                            │ │
│  │  ✅ runValidationCommands()                                    │ │
│  │  ✅ Check required files/patterns                             │ │
│  │  ✅ If fails: Trailblazing or error                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ PHASE 5: METRICS                                               │ │
│  │  ✅ extractMetricsFromSession() - Get tokens/cost             │ │
│  │  ❌ MISSING: Capture impulses_loaded                         │ │
│  │  ❌ MISSING: Capture impulses_created                        │ │
│  │  ❌ MISSING: Call record_impulse_usage()                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│              ACTIVITY COMPLETION                                     │
│  ✅ Activity.complete() - Update status                            │
│  ✅ Activity.unregisterSession()                                   │
│  ❌ MISSING: POST activity results to /v2/activities/results      │
│  ❌ MISSING: Trigger template evolution if failed                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│          BACKEND LEARNING LOOP (SHOULD HAPPEN, DOESN'T)             │
│  ❌ impulse_usage table stays EMPTY                                │
│  ❌ impulse_registry never queried for pre-loading                 │
│  ❌ Templates don't evolve based on data                           │
│  ❌ Co-change patterns not used for impulse discovery              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The architecture is **well-designed** with proper separation of concerns, but the **learning loop is completely disconnected**. Key infrastructure exists (database tables, API endpoints, data structures) but critical integration points are missing.

**Three Quick Wins**:
1. **Close the loop**: Capture impulse usage after each task (2-3 hours)
2. **Pre-load learned context**: Call existing endpoints before execution (3-4 hours)
3. **Co-change impulses**: Use co-change data for smart pre-loading (2-3 hours)

**Total Effort to Fix Core Issues**: ~1-2 days of focused development

**Expected Impact**:
- 20-30% improvement in activity success rates (learned context)
- Faster execution (pre-loaded relevant files)
- Self-improving system (templates evolve from data)
- Better developer experience (less manual context management)
