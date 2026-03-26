# Metabob Integration Specifications

## Overview
This document defines the complete specifications for Metabob MCP tool integration in metabob-opencode. These specifications ensure comprehensive utilization of all 35 available Metabob tools for codebase indexing, design decision recording, and change prediction.

## Specification 1: Tool Integration Coverage

**Requirement:** All 35 Metabob MCP tools must have clear integration points documented and implemented where applicable.

**Current State:** 
- Tools in use: 9/35 (26%)
- Tools unused: 26/35 (74%)

**Target State:**
- Critical tools: 100% integrated
- High-value tools: 80%+ integrated
- Specialized tools: Integration strategy documented

**Specific Integration Requirements:**

### Code Quality Tools (CRITICAL - Must be 100% integrated)
- ✅ `search_codebase_issues` - Integrated in discovery workflows
- ✅ `get_priority_issues` - Integrated in agent prompts
- ✅ `mark_problem_complete` - Integrated in edit/write tools
- ✅ `suggest_related_changes` - Integrated in post-commit hooks

### Component Analysis Tools (CRITICAL - Must be 100% integrated)
- ✅ `list_file_components` - Integrated in impulse resolution
- ✅ `analyze_change_impact` - Integrated in template executor
- ✅ `assess_deletion_safety` - Integrated in refactoring workflows
- ❌ `metabob_find_similar_components` - NOT INTEGRATED
  - **Required:** Add to discovery workflows before implementing new features
  - **Location:** packages/opencode/src/session/template-executor.ts
  - **Usage:** Before creating new component, search for similar ones

### Design Decision Tools (CRITICAL - Must be 100% integrated)
- ✅ `annotate_component` - Integrated in write/edit tools
- ❌ `check_for_existing_functionality` - NOT INTEGRATED
  - **Required:** Add to all "add feature" workflows
  - **Location:** packages/opencode/src/session/template-executor.ts
  - **Usage:** Prevent duplicate implementations

### Session Tracking Tools (HIGH PRIORITY - Must be 80% integrated)
- ❌ `metabob_record_session_start` - NOT INTEGRATED
  - **Required:** Session.create() in packages/opencode/src/session/session.ts
  - **Payload:** sessionId, agentType, timestamp, workingDirectory, gitBranch
- ❌ `metabob_record_session_complete` - NOT INTEGRATED
  - **Required:** Session.close() in packages/opencode/src/session/session.ts
  - **Payload:** sessionId, timestamp, stats (prompts, tokens, cost, tools, files), outcome
- ❌ `metabob_record_tool_invocation` - NOT INTEGRATED
  - **Required:** Tool.execute() middleware in packages/opencode/src/tool/tool.ts
  - **Payload:** sessionId, toolName, timestamp, duration, success, tokens, error

### Activity Management Tools (HIGH PRIORITY)
- ✅ `search_activities` - Integrated via search-activities tool
- ✅ `activity` - Integrated via activity tool
- ❌ `create_activity_template` - NOT INTEGRATED (use local create-activity instead)
- ❌ `evolve_activity_template` - NOT INTEGRATED
  - **Required:** Add to activity failure analysis
  - **Location:** packages/opencode/src/session/activity-failure-analysis.ts
- ❌ `get_activity` - NOT INTEGRATED
- ❌ `get_activity_template` - NOT INTEGRATED (use local version)
- ❌ `get_template_lineage` - NOT INTEGRATED
  - **Required:** Add to activity evolution workflows

### Change Prediction Tools (MEDIUM PRIORITY)
- ❌ `assess_pattern_quality` - NOT INTEGRATED
  - **Required:** Add to code review workflows
  - **Location:** packages/opencode/src/agent/review.txt
- ❌ `get_next_step` - NOT INTEGRATED
  - **Required:** Add to activity executor for step suggestions

### Monitoring Tools (MEDIUM PRIORITY)
- ❌ `get_metabob_status` - NOT INTEGRATED
  - **Required:** Add health check before critical operations
  - **Location:** packages/opencode/src/mcp/mcp.ts

### Specialized Tools (DOCUMENT ONLY)
- `claim_boredom_task`, `complete_boredom_task`, `create_boredom_task`, `list_boredom_tasks` - Boredom system (already integrated via boredom-manager.ts)
- `configure` - MCP configuration (use opencode.json)
- `enter_trailblazing` - Activity trailblazing mode
- `generate_implementation_template` - Template generation
- `get_execution_state` - Activity execution state
- `report_step_result`, `metabob_report_task_result` - Task reporting
- `start_activity_execution` - Activity execution (use local activity tool)
- `test_minimal_tool` - MCP testing

**Validation Criteria:**
- [ ] All CRITICAL tools have documented integration points
- [ ] All CRITICAL tools have working implementations
- [ ] All HIGH PRIORITY tools have integration plans with timelines
- [ ] All MEDIUM PRIORITY tools have documented use cases
- [ ] All SPECIALIZED tools have justification for non-integration

---

## Specification 2: Session Lifecycle Tracking

**Requirement:** Every session must record start and completion events to Metabob for learning and optimization.

**Integration Points:**

### Session Start (packages/opencode/src/session/session.ts)
```typescript
static async create(options: SessionOptions): Promise<Session> {
  const session = new Session(options)
  
  // Track session start with Metabob
  try {
    await MetabobTracking.recordSessionStart({
      sessionId: session.id,
      agentType: session.agent?.name || 'unknown',
      timestamp: Date.now(),
      context: {
        workingDirectory: session.cwd,
        gitBranch: await getGitBranch(),
        gitCommit: await getGitCommit(),
      }
    })
  } catch (error) {
    Log.warn('Failed to record session start', { error })
  }
  
  return session
}
```

### Session Complete (packages/opencode/src/session/session.ts)
```typescript
async close(): Promise<void> {
  // Track session completion with Metabob
  try {
    await MetabobTracking.recordSessionComplete({
      sessionId: this.id,
      timestamp: Date.now(),
      summary: {
        totalPrompts: this.stats.promptCount,
        totalTokens: this.stats.totalTokens,
        totalCost: this.stats.totalCost,
        toolsUsed: Object.keys(this.stats.toolUsage),
        filesModified: this.stats.filesModified,
      },
      outcome: this.error ? 'failed' : 'completed'
    })
  } catch (error) {
    Log.warn('Failed to record session completion', { error })
  }
  
  await this.cleanup()
}
```

**Validation Criteria:**
- [ ] MetabobTracking.recordSessionStart called in Session.create()
- [ ] MetabobTracking.recordSessionComplete called in Session.close()
- [ ] Error handling prevents session failure if tracking fails
- [ ] Session stats correctly populated before tracking
- [ ] Integration tests verify tracking calls

---

## Specification 3: Tool Invocation Tracking

**Requirement:** Every tool execution must be tracked for telemetry, learning, and optimization.

**Integration Point:** packages/opencode/src/tool/tool.ts

```typescript
async execute(params: P, ctx: Context): Promise<ToolResult> {
  const startTime = Date.now()
  const tracking = {
    sessionId: ctx.sessionId,
    toolName: this.name,
    timestamp: startTime,
  }
  
  try {
    const result = await this.implementation(params, ctx)
    
    // Track successful invocation
    await MetabobTracking.recordToolInvocation({
      ...tracking,
      duration: Date.now() - startTime,
      success: true,
      inputTokens: estimateTokens(params),
      outputTokens: estimateTokens(result),
    }).catch(err => Log.warn('Tool tracking failed', { err }))
    
    return result
  } catch (error) {
    // Track failed invocation
    await MetabobTracking.recordToolInvocation({
      ...tracking,
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
    }).catch(err => Log.warn('Tool tracking failed', { err }))
    
    throw error
  }
}
```

**Rate Limiting:**
- Maximum 100 tracking calls per second
- Use debouncing for high-frequency tools (read, grep, glob)
- Batch tracking calls every 100ms

**Validation Criteria:**
- [ ] Tracking middleware added to Tool.execute()
- [ ] Success and failure cases both tracked
- [ ] Rate limiting prevents overwhelming MCP
- [ ] Token estimation reasonably accurate
- [ ] No performance regression (< 5ms overhead)

---

## Specification 4: Codebase Indexing

**Requirement:** Metabob must have complete, up-to-date index of codebase including CPG and issue cache.

**Components:**

### CPG (Code Property Graph)
- **Status Check:** `get_metabob_status` should report CPG as "ready"
- **Coverage:** All TypeScript/JavaScript files in `packages/opencode/src/`
- **Components:** Functions, classes, methods extracted via tree-sitter
- **Dependencies:** Import/export relationships tracked
- **Update Frequency:** Real-time via file watcher

### Issue Cache
- **Status Check:** `search_codebase_issues` returns results without errors
- **Coverage:** All code quality issues (syntax, semantics, security, performance)
- **Freshness:** Updated within 5 minutes of code changes
- **Size:** Typical cache should contain 100-500 issues for medium project

### File Watcher Integration
- **Location:** packages/opencode/src/session/file-watcher.ts
- **Trigger:** On file save, trigger incremental re-indexing
- **Debounce:** 500ms to batch rapid changes

**Health Monitoring:**
```typescript
class MetabobHealthMonitor {
  async checkIndexingHealth(): Promise<IndexingHealth> {
    const status = await callMetabobMCP('get_metabob_status', {})
    
    return {
      cpg: {
        status: status.cpg.status, // ready | indexing | error
        filesIndexed: status.cpg.filesIndexed,
        componentsExtracted: status.cpg.componentsExtracted,
        lastUpdate: status.cpg.lastUpdate,
      },
      issues: {
        status: status.issues.status,
        totalIssues: status.issues.totalIssues,
        bySeverity: status.issues.bySeverity,
        lastScan: status.issues.lastScan,
      },
      healthy: status.cpg.status === 'ready' && status.issues.status === 'ready'
    }
  }
}
```

**Validation Criteria:**
- [ ] CPG status is "ready" for main codebase
- [ ] `list_file_components` returns components for all src files
- [ ] `analyze_change_impact` returns meaningful dependency data
- [ ] `search_codebase_issues` returns relevant results
- [ ] File watcher triggers re-indexing on saves
- [ ] Health check runs before critical operations

---

## Specification 5: Design Decision Annotations

**Requirement:** At least 50 key components must have design decision annotations explaining WHY they exist and HOW they work.

**Key Components to Annotate:**

### Session Management (10 components)
1. Session class - Core session lifecycle
2. SessionState - State management
3. SessionManager - Multi-session coordination
4. SessionStats - Metrics tracking
5. PromptBuilder - Prompt construction
6. ContextBuilder - Context assembly
7. MessageHistory - Conversation tracking
8. TokenBudget - Token management
9. FileWatcher - Change detection
10. CleanupManager - Resource cleanup

### Activity Execution (10 components)
11. ActivityExecutor - Activity orchestration
12. TemplateExecutor - Template execution
13. TaskRunner - Individual task execution
14. ValidationRunner - Validation checks
15. RetryStrategy - Failure recovery
16. ActivityState - State tracking
17. ActivityMetrics - Performance tracking
18. ActivityGit - Git integration
19. ActivityIsolation - Branch isolation
20. ActivityReplay - Replay functionality

### Tool System (10 components)
21. Tool class - Base tool implementation
22. ToolRegistry - Tool registration
23. activity tool - Activity execution
24. edit tool - File editing
25. write tool - File writing
26. bash tool - Command execution
27. read tool - File reading
28. search_activities tool - Template discovery
29. impulse_create tool - Impulse creation
30. task tool - Task delegation

### Agent System (10 components)
31. Agent class - Base agent definition
32. activity agent - Implementation agent
33. plan agent - Planning agent
34. review agent - Review agent
35. general agent - General purpose
36. AgentPromptBuilder - Agent-specific prompts
37. AgentContext - Agent context management
38. AgentTools - Agent tool filtering
39. AgentMetabob - Agent Metabob config
40. AgentState - Agent state tracking

### Impulse System (10 components)
41. Impulse class - Base impulse
42. ImpulseResolver - Impulse resolution
43. ImpulseFormatter - Impulse formatting
44. ImpulsePointer - Pointer types
45. ImpulseBudget - Token budgeting
46. ImpulseCache - Caching layer
47. ImpulseLoader - Lazy loading
48. ImpulsePriority - Prioritization
49. ImpulseGC - Garbage collection
50. ImpulseLearning - Learning loop

**Annotation Template:**
```typescript
// Annotate after implementation
await metabob_annotate_component({
  file_path: "packages/opencode/src/session/session.ts",
  component_name: "Session",
  component_type: "class",
  reason: `
Core session lifecycle manager for OpenCode.

WHY: Sessions isolate user interactions with context, memory, and state.
Without sessions, we'd have global state and context leakage between users.

HOW: Uses event-driven architecture with:
- PromptBuilder for LLM prompts
- ContextBuilder for file/impulse context
- SessionStats for metrics
- FileWatcher for change detection

ALTERNATIVES CONSIDERED:
- Stateless request/response: Rejected - loses conversation context
- Global singleton: Rejected - doesn't scale to multiple users
- Database-backed sessions: Rejected - adds latency and complexity

CONSTRAINTS:
- Must support both CLI and server modes
- Must handle graceful cleanup on errors
- Must track metrics for learning loop

PATTERNS:
- Builder pattern for prompt/context construction
- Observer pattern for file watching
- Strategy pattern for agent selection
`
})
```

**Validation Criteria:**
- [ ] 50+ components have annotations
- [ ] Each annotation explains WHY (purpose, motivation)
- [ ] Each annotation explains HOW (implementation approach)
- [ ] Each annotation lists alternatives considered
- [ ] Each annotation documents constraints
- [ ] Annotations are retrievable via Metabob tools

---

## Specification 6: Change Prediction Integration

**Requirement:** Change prediction tools must be integrated into pre-commit and pre-feature workflows to prevent regressions and duplicate work.

### Pre-Commit Workflow Integration

**Location:** packages/opencode/src/session/pre-commit-hooks.ts (NEW FILE)

```typescript
export async function runPreCommitChecks(files: string[]): Promise<PreCommitResult> {
  const results = {
    relatedChanges: [],
    qualityIssues: [],
    recommendations: [],
  }
  
  // 1. Check for related changes that might be needed
  const related = await metabob_suggest_related_changes({
    changed_files: files,
    top_k: 5
  })
  
  if (related.suggestions.length > 0) {
    results.relatedChanges = related.suggestions
    results.recommendations.push(
      `Consider reviewing ${related.suggestions.length} related files that often change together`
    )
  }
  
  // 2. Assess pattern quality
  for (const file of files) {
    const quality = await metabob_assess_pattern_quality({
      file_path: file,
    })
    
    if (quality.score < 0.7) {
      results.qualityIssues.push({
        file,
        score: quality.score,
        issues: quality.issues
      })
    }
  }
  
  // 3. Check for similar components (potential duplication)
  for (const file of files) {
    const components = await metabob_list_file_components({ file_path: file })
    
    for (const component of components.components) {
      const similar = await metabob_find_similar_components({
        file_path: file,
        component_name: component.name,
        threshold: 0.8
      })
      
      if (similar.matches.length > 0) {
        results.recommendations.push(
          `Component ${component.name} in ${file} is similar to ${similar.matches.length} existing components`
        )
      }
    }
  }
  
  return results
}
```

### Pre-Feature Workflow Integration

**Location:** Activity template task (add-feature-complete, etc.)

```typescript
// Task 1: Discovery and Duplication Check
{
  "task_id": "check-existing-functionality",
  "description": "Check for existing similar functionality before implementation",
  "prompt": {
    "template": `Before implementing {{featureName}}, check for existing functionality:

1. Search for similar features:
   metabob_check_for_existing_functionality({
     description: "{{featureDescription}}",
     files: {{files}}
   })

2. If similar functionality found (>70% match):
   - Review existing implementation
   - Decide: reuse, extend, or create new
   - Document decision

3. If no similar functionality:
   - Proceed with implementation
   - Note in annotations why new implementation needed

Output: Decision on reuse vs new implementation with justification`
  }
}
```

**Validation Criteria:**
- [ ] Pre-commit hook runs change prediction checks
- [ ] Hook provides actionable recommendations
- [ ] Hook doesn't block commits (warnings only)
- [ ] Add-feature templates include duplication check
- [ ] Similar component detection integrated in discovery
- [ ] Pattern quality assessment in code review

---

## Specification 7: Integration Strategy Documentation

**Requirement:** All high-value unused tools must have documented integration strategy with rationale for non-integration or timeline for integration.

### High-Value Unused Tools Analysis

| Tool | Value | Integration Status | Strategy |
|------|-------|-------------------|----------|
| `check_for_existing_functionality` | HIGH | NOT INTEGRATED | **INTEGRATE Q2 2026** - Add to all feature workflows |
| `metabob_find_similar_components` | HIGH | NOT INTEGRATED | **INTEGRATE Q2 2026** - Add to discovery phase |
| `assess_pattern_quality` | MEDIUM | NOT INTEGRATED | **INTEGRATE Q3 2026** - Add to code review |
| `evolve_activity_template` | MEDIUM | NOT INTEGRATED | **INTEGRATE Q3 2026** - Add to failure analysis |
| `metabob_record_session_start` | HIGH | NOT INTEGRATED | **INTEGRATE Q2 2026** - Session tracking |
| `metabob_record_session_complete` | HIGH | NOT INTEGRATED | **INTEGRATE Q2 2026** - Session tracking |
| `metabob_record_tool_invocation` | MEDIUM | NOT INTEGRATED | **INTEGRATE Q3 2026** - Telemetry |
| `get_metabob_status` | MEDIUM | NOT INTEGRATED | **INTEGRATE Q2 2026** - Health monitoring |
| `get_next_step` | LOW | NOT INTEGRATED | **EVALUATE Q4 2026** - Activity suggestions |
| `get_template_lineage` | LOW | NOT INTEGRATED | **EVALUATE Q4 2026** - Template evolution tracking |

**Documentation Location:** docs/metabob-integration-roadmap.md

**Validation Criteria:**
- [ ] All HIGH-value tools have integration timeline
- [ ] All MEDIUM-value tools have evaluation plan
- [ ] All LOW-value tools have documented rationale
- [ ] Quarterly review process established
- [ ] Integration blockers documented

---

## Implementation Phases

### Phase 1: Critical Tools (Q2 2026 - 4 weeks)
- Session lifecycle tracking
- `check_for_existing_functionality` integration
- `metabob_find_similar_components` integration
- Health monitoring (`get_metabob_status`)

### Phase 2: Annotation Coverage (Q2 2026 - 4 weeks)
- Annotate 50 key components
- Document design decisions
- Create annotation guidelines

### Phase 3: Change Prediction (Q3 2026 - 4 weeks)
- Pre-commit hooks with predictions
- Pattern quality assessment
- Similar component detection

### Phase 4: Advanced Telemetry (Q3 2026 - 4 weeks)
- Tool invocation tracking
- Activity evolution
- Learning loop optimization

---

## Success Metrics

1. **Tool Coverage:**
   - CRITICAL tools: 100% integrated (currently 77%)
   - HIGH-value tools: 80% integrated (currently 10%)
   - Overall usage: 60% tools in active use (currently 26%)

2. **Session Tracking:**
   - 100% of sessions tracked start/complete
   - <5ms tracking overhead
   - 99% tracking success rate

3. **Annotation Coverage:**
   - 50+ components annotated (currently ~10)
   - 100% of new components annotated
   - Annotations referenced in 50%+ of debugging sessions

4. **Indexing Health:**
   - CPG always "ready" status
   - Issue cache < 5 minutes stale
   - 100% of src/ files indexed

5. **Change Prediction:**
   - Pre-commit checks running on 100% of commits
   - 70%+ accuracy on related changes
   - 50% reduction in duplicate implementations

---

## Validation Process

### Trace Phase
1. Identify all integration points
2. Document current state vs target state
3. Create architectural diagrams
4. Map data flows

### Enforce Phase
1. Implement integration code
2. Add validation tests
3. Create monitoring dashboards
4. Document changes

### Validate Phase
1. Run integration tests
2. Check success metrics
3. Verify no regressions
4. Performance benchmarks

**Validation Loop:** Run monthly to ensure specifications remain enforced.
