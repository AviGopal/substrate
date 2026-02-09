# Activity Tool Simplification: Implementation Guide

## Quick Summary

**Change**: Reduce agent-visible activity tools from 10+ to 2-3 focused tools.

**Goal**: Agents focus on WHAT (discovery) and WHEN (orchestration), not HOW (implementation).

**Impact**: Agents stop trying to debug/register/inspect and instead just search + execute activities.

---

## Implementation Checklist

### Phase 1: Hide Implementation Tools (Day 1)

- [ ] Remove debug tools from agent context
- [ ] Remove registration tools from agent context
- [ ] Remove error inspection from agent context
- [ ] Keep only: `activity`, `search_activities`

### Phase 2: Consolidate Redundant Tools (Day 2-3)

- [ ] Remove `list_activity_templates` (use search instead)
- [ ] Merge `get_activity_template` into search verbose mode
- [ ] Make `post_activity_result` automatic (framework handles)

### Phase 3: Simplify Tool Descriptions (Day 4-5)

- [ ] Rewrite `activity.txt` to ~25 lines
- [ ] Rewrite `search_activities.txt` to ~25 lines
- [ ] Focus on interface, remove implementation details

### Phase 4: Update AGENTS.md (Day 6-7)

- [ ] Reduce activity section from 500+ to ~100 lines
- [ ] Remove template creation details
- [ ] Remove debugging workflows
- [ ] Add simple orchestration examples

---

## Code Changes

### 1. Tool Visibility Configuration

**File**: `repos/metabob-opencode/packages/opencode/src/agent/agent.ts` (or wherever tools are registered)

**Before**:
```typescript
const allTools = [
  "activity",
  "search_activities",
  "list_activity_templates",
  "get_activity_template",
  "register_activity_template",
  "debug_activity_execution",
  "activity_error_inspector",
  "activity_replay",
  "post_activity_result",
  // ... other tools
]
```

**After**:
```typescript
// Agent-facing tools (orchestration)
const agentTools = [
  "activity",
  "search_activities",
  // ... other non-activity tools
]

// Developer-only tools (implementation)
const developerTools = [
  "debug_activity_execution",
  "activity_error_inspector",
  "activity_replay",
  "register_activity_template",
  // Only accessible via CLI or special dev mode
]
```

**Implementation**:
```typescript
// In Agent.Info or tool registry
export interface Agent.Info {
  tools: {
    // ... existing fields
    includeDevTools?: boolean // Default: false
  }
}

// In tool loading logic
export function loadToolsForAgent(agent: Agent.Info): Tool.Info[] {
  const tools: Tool.Info[] = []
  
  // Always load core orchestration tools
  if (agent.mode !== "subagent") {
    tools.push(ActivityTool)
    tools.push(SearchActivitiesTool)
  }
  
  // Only load dev tools if explicitly enabled
  if (agent.tools.includeDevTools) {
    tools.push(DebugActivityExecutionTool)
    tools.push(ActivityErrorInspectorTool)
    tools.push(ActivityReplayTool)
  }
  
  return tools
}
```

---

### 2. Remove Redundant Tools

#### A. Remove `list_activity_templates`

**Rationale**: `search_activities` with no parameters does the same thing.

**Change**:
```typescript
// Remove from tool registry
// File: repos/metabob-opencode/packages/opencode/src/tool/registry.ts

// Before:
import { ListActivityTemplatesTool } from "./list-activity-templates"
Tool.register(ListActivityTemplatesTool)

// After:
// [Remove the import and registration]
```

**Migration**: Update any code that calls `list_activity_templates`:
```typescript
// Before:
const templates = await list_activity_templates({})

// After:
const templates = await search_activities({})
```

#### B. Remove `get_activity_template`

**Rationale**: `search_activities` with `verbose: true` shows full details.

**Change**:
```typescript
// Remove from tool registry (same as above)

// Migration:
// Before:
const template = await get_activity_template({ templateId: "add-endpoint" })

// After:
const results = await search_activities({ 
  query: "add-endpoint", 
  verbose: true 
})
const template = results.find(t => t.id === "add-endpoint")
```

#### C. Auto-report in `post_activity_result`

**Rationale**: Framework should automatically report outcomes, agents shouldn't need to.

**Change**:
```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/template-executor.ts
// or wherever activity execution completes

export class TemplateExecutor {
  static async execute(params: ExecuteParams): Promise<ExecuteResult> {
    // ... existing execution logic
    
    const result = await this.runActivity(params)
    
    // ✅ NEW: Automatically report to Metabob
    await this.reportOutcome(result)
    
    return result
  }
  
  private static async reportOutcome(result: ExecuteResult): Promise<void> {
    try {
      // Send to Metabob backend automatically
      await MetabobAPI.reportActivityOutcome({
        activityId: result.activityId,
        templateId: result.templateId,
        success: result.success,
        cost: result.totalCost,
        duration: result.totalDuration,
        metrics: result.metrics
      })
    } catch (error) {
      // Log but don't fail the activity
      log.warn("Failed to report activity outcome to Metabob", { error })
    }
  }
}
```

**Remove tool**:
```typescript
// File: repos/metabob-opencode/packages/opencode/src/tool/registry.ts
// Remove PostActivityResultTool registration
```

---

### 3. Simplify Tool Descriptions

#### A. Simplify `activity.txt`

**Before** (37 lines with details):
```
Run a structured activity from the suggestions.

Use this tool when the system suggests an activity that matches your task. Activities are pre-defined workflows that have been optimized through learning.

Parameters:
  - activityId: The ID from the suggested activities section
  - variables: Key-value pairs required by the activity (see suggestion for required variables)
  - reason: Brief explanation of why you're using this activity

Example:
  If the suggestions show "add-rest-endpoint" for adding API endpoints:
  {
    "activityId": "add-rest-endpoint",
    "variables": {
      "method": "POST",
      "path": "/api/users",
      "handlerDescription": "Create a new user"
    },
    "reason": "User requested a new user creation endpoint"
  }

The system handles:
  - Loading the activity steps
  - Gathering required context
  - Validation and error recovery
  - Recording outcomes for learning

When to use:
  - When a suggested activity matches your task
  - For complex multi-step operations
  - When you want consistent, validated results

When NOT to use:
  - For simple single-step tasks (just do them directly)
  - When no suitable activity is suggested
  - For exploration or experimentation
```

**After** (~25 lines, focused):
```
Execute a multi-step activity workflow.

Use when:
  ✓ Task matches an available activity
  ✓ Need validated, consistent results
  ✓ Multi-step workflow required

Parameters:
  - activityId: From search_activities results
  - variables: Required inputs (see template)
  - reason: Brief explanation of goal

Example:
  activity({
    activityId: "add-rest-endpoint",
    variables: {
      method: "POST",
      path: "/api/users"
    },
    reason: "Create user registration endpoint"
  })

The framework automatically:
  • Gathers context
  • Executes tasks
  • Validates results
  • Records outcomes for learning
```

**Implementation**:
```bash
# File: repos/metabob-opencode/packages/opencode/src/tool/activity.txt
# Simply replace the contents with the "After" version above
```

#### B. Simplify `search_activities.txt`

**Before** (38 lines with details):
```
Search available activity templates from the registry.

Activity templates are reusable, multi-task workflows with:
- Learned success rates (from previous executions)
- Average cost and duration metrics
- Required variables that must be provided
- Task sequence with dependencies

Templates are fetched from the activity registry (Metabob MCP when available, or local cache).

**Metabob Integration:** This tool automatically uses Metabob MCP when connected, with graceful
fallback to local cache. Do NOT use metabob_search_activities directly - it lacks caching and
fallback capabilities.

Usage notes:
  - Default output is COMPACT (IDs and success rates only, ~300 bytes)
  - Use verbose=true for full details (descriptions, costs, variables, ~2KB)
  - Filter by category to narrow results
  - Higher success rates indicate more reliable templates
  - New templates (0 executions) haven't been run yet

Examples:

  Search all templates (compact):
  {}

  Search feature templates (compact):
  { "category": "feature" }

  Search with full details (verbose):
  { "category": "feature", "verbose": true }

When to use:
  - Before using the 'activity' tool (to find template IDs)
  - To discover available workflows
  - Use compact mode (default) for quick ID lookup
  - Use verbose mode when you need costs and variable details
```

**After** (~25 lines, focused):
```
Discover available activity workflows.

Returns templates with:
  • Success rates (reliability indicator)
  • Brief descriptions
  • Required variables (verbose mode only)

Modes:
  - compact (default): IDs and success rates (~300 bytes)
  - verbose: Full details including costs (~2KB)

Parameters:
  - category (optional): "feature", "bugfix", "refactor", "tool"
  - query (optional): Search term
  - verbose (optional): Show full details (default: false)

Examples:
  search_activities({})
  search_activities({ category: "feature" })
  search_activities({ query: "endpoint", verbose: true })

Use before:
  • Running an activity (find template IDs)
  • Checking available workflows
  • Discovering patterns for your task
```

**Implementation**:
```bash
# File: repos/metabob-opencode/packages/opencode/src/tool/search-activities.txt
# Replace contents with "After" version
```

---

### 4. Update AGENTS.md

**File**: `repos/metabob-opencode/AGENTS.md` (or `packages/opencode/AGENTS.md`)

**Section to change**: "Activity Template System"

**Before** (500+ lines):
```markdown
## Activity Template System

OpenCode uses **reusable, learning activity templates** instead of creating unique activities each time.

### Core Concept

Templates are **blueprints** that:
- Learn from executions
- Manage prompt space
- Handle LLM inconsistency
- Compound knowledge

### Template Structure

A template defines:
1. Identity - Name, description, category
2. Tasks - Sequence of subagent delegations with dependencies
3. Prompts - Template strings with {{variables}}, token budgets, compression
4. Validation - Required files, patterns, forbidden patterns, commands
5. Retry - Max attempts, strategy (simple, progressive-context, fallback-agent)
6. Metrics - Success rate, duration, cost, token usage (learned over time)

[... 400 more lines of implementation details ...]
```

**After** (~100 lines, focused):
```markdown
## Using Activities

Activities are multi-step workflows that have been optimized through learning.

### Discovering Activities

Find activities that match your task:

```typescript
// Search all activities (compact)
search_activities({})

// Search by category
search_activities({ category: "feature" })

// Get full details (costs, variables)
search_activities({ query: "endpoint", verbose: true })
```

Results show:
- **Template ID** (for execution)
- **Success rate** (reliability indicator)
- **Description** (what it does)
- **Variables** (required inputs, verbose mode only)

**Tip**: Higher success rates = more reliable templates.

### Executing Activities

Run a discovered activity:

```typescript
activity({
  activityId: "add-rest-endpoint",
  variables: {
    method: "POST",
    path: "/api/users",
    requestSchema: "{ name: string }",
    responseSchema: "{ id: string, name: string }"
  },
  reason: "User wants user creation endpoint"
})
```

**The framework automatically**:
- Gathers required context
- Executes tasks in sequence
- Validates results
- Records outcomes for learning

**Your job**: Pick the right activity and provide variables.

### Orchestrating Multiple Activities

**Sequential** (one after another):
```typescript
// Step 1: Setup
activity({
  activityId: "setup-database",
  variables: { schema: "users" },
  reason: "Initialize database"
})

// Wait for completion, then step 2
activity({
  activityId: "add-migrations",
  variables: { entities: ["User", "Post"] },
  reason: "Add data models"
})
```

**Hierarchical** (parent delegates to children):
```typescript
// Parent activity handles orchestration
activity({
  activityId: "build-full-stack-feature",
  variables: {
    feature: "authentication",
    components: ["backend", "frontend", "tests"]
  },
  reason: "Complete auth system"
})
// Parent activity internally delegates to child activities
```

### When to Use Activities

**Use activities when**:
- ✓ Multi-step workflow (3+ steps)
- ✓ Task matches available template
- ✓ Want validated, consistent results
- ✓ Pattern has been proven successful

**Don't use activities when**:
- ✗ Simple single-step task (just do it directly)
- ✗ Exploration or experimentation
- ✗ No suitable template exists
- ✗ Unique one-off operation

### Built-In Activities

Check available activities:
```bash
opencode activity template list
```

Common templates:
- `add-rest-endpoint` - API endpoint with schema, handler, tests
- `add-tool` - OpenCode tool with docs and tests
- `fix-bug-with-tests` - Bug fix with regression tests
- `refactor-with-validation` - Safe refactoring with quality gates

**Note**: Templates learn from each execution. Success rates improve over time.

### Activity Outcomes

After execution, the framework automatically:
- Records metrics (cost, duration, success)
- Sends data to Metabob for learning
- Updates template success rates
- Improves future recommendations

**You don't need to**:
- Manually report outcomes
- Debug failed executions (framework handles retries)
- Register new templates (use CLI: `opencode activity register template.json`)
```

---

### 5. Configuration Changes

**File**: `repos/metabob-opencode/packages/opencode/opencode.json` (or equivalent config)

**Add tool visibility settings**:
```json
{
  "agent": {
    "activity": {
      "tools": {
        "excludeDevTools": true,
        "autoReportOutcomes": true
      }
    },
    "plan": {
      "tools": {
        "excludeDevTools": true
      }
    },
    "review": {
      "tools": {
        "excludeDevTools": true
      }
    }
  },
  "developer": {
    "tools": {
      "includeActivityDebugTools": false  // Set to true for debugging
    }
  }
}
```

---

## Testing the Changes

### 1. Verify Tool Visibility

```typescript
// Test: Agent should only see core tools
import { Agent } from "./agent/agent"

const activityAgent = Agent.get("activity")
const availableTools = activityAgent.tools

// Should include:
expect(availableTools).toContain("activity")
expect(availableTools).toContain("search_activities")

// Should NOT include:
expect(availableTools).not.toContain("debug_activity_execution")
expect(availableTools).not.toContain("register_activity_template")
expect(availableTools).not.toContain("activity_error_inspector")
```

### 2. Verify Auto-Reporting

```typescript
// Test: Outcomes should be reported automatically
import { TemplateExecutor } from "./session/template-executor"
import { MetabobAPI } from "./util/metabob-api"

const mockReportOutcome = jest.spyOn(MetabobAPI, "reportActivityOutcome")

await TemplateExecutor.execute({
  templateId: "test-template",
  variables: {},
  reason: "Test"
})

// Should have been called automatically
expect(mockReportOutcome).toHaveBeenCalledWith(
  expect.objectContaining({
    templateId: "test-template",
    success: true
  })
)
```

### 3. Verify Agent Behavior

**Before changes** (distracted):
```
Agent prompt: "Add a user registration endpoint"

Agent thinks:
  1. Let me search for activities... (search_activities)
  2. Found "add-rest-endpoint"
  3. Hmm, should I debug it first? (debug_activity_execution)
  4. Maybe I should register a custom version? (register_activity_template)
  5. Let me check for errors... (activity_error_inspector)
  6. Finally, run the activity (activity)
  
Result: 5 tool calls, 3 distractions, slow execution
```

**After changes** (focused):
```
Agent prompt: "Add a user registration endpoint"

Agent thinks:
  1. Search for activities (search_activities)
  2. Found "add-rest-endpoint" with 85% success rate
  3. Execute it (activity)
  
Result: 2 tool calls, 0 distractions, fast execution
```

---

## Rollback Plan

If changes cause issues:

### Quick Rollback (Same Day)

```bash
# Restore tool visibility
git revert <commit-hash>

# Or manually re-enable tools
# In agent config:
includeDevTools: true
```

### Partial Rollback (Keep Some Changes)

```typescript
// Keep simplified descriptions but restore tool visibility
const agentTools = [
  "activity",
  "search_activities",
  "debug_activity_execution", // ← Restore if needed
  "activity_error_inspector"   // ← Restore if needed
]
```

---

## Success Metrics

### Before Changes

- **Agent-visible tools**: 10+ activity tools
- **Tool description total**: ~500 lines
- **AGENTS.md activity section**: 500+ lines
- **Average activity execution**: 5+ tool calls (including debug attempts)
- **Agent confusion**: High (tries to debug, register, inspect)

### After Changes

- **Agent-visible tools**: 2 activity tools
- **Tool description total**: ~50 lines
- **AGENTS.md activity section**: ~100 lines
- **Average activity execution**: 2 tool calls (search → execute)
- **Agent confusion**: Low (focused on orchestration)

### Metrics to Track

1. **Tool usage frequency**
   - Before: How often agents called debug/register/inspect tools
   - After: Should be 0 (tools not visible)

2. **Activity execution speed**
   - Before: Average time from decision to execution
   - After: Should be faster (fewer distractions)

3. **Metabob data quality**
   - Before: Manual reporting, sometimes missed
   - After: Automatic reporting, always captured

4. **Agent satisfaction**
   - Survey agents: "Do you know which activities to use?"
   - Survey agents: "Are activity tools easy to use?"

---

## Timeline

### Week 1
- **Day 1-2**: Hide implementation tools
- **Day 3**: Remove redundant tools
- **Day 4-5**: Simplify tool descriptions

### Week 2
- **Day 6-7**: Update AGENTS.md
- **Day 8**: Testing and validation
- **Day 9-10**: Bug fixes and adjustments

### Week 3
- **Day 11**: Deploy to staging
- **Day 12-14**: Monitor agent behavior
- **Day 15**: Deploy to production

---

## Support

### If Agents Get Confused

**Symptom**: Agent says "I need to debug this activity"  
**Fix**: Agent shouldn't see debug tools. Check tool visibility configuration.

**Symptom**: Agent tries to register a template  
**Fix**: Agent shouldn't see register tool. Use CLI: `opencode activity register template.json`

**Symptom**: Agent asks about template structure  
**Fix**: Update AGENTS.md to remove implementation details, focus on usage.

### If Metabob Data Missing

**Symptom**: Activities execute but no outcomes recorded  
**Fix**: Check `TemplateExecutor.reportOutcome()` is being called automatically.

**Symptom**: Success rates not updating  
**Fix**: Verify Metabob backend connection, check API logs.

---

## Conclusion

**Core change**: Reduce agent-visible activity tools from 10+ to 2.

**Impact**: Agents focus on WHAT (discovery) and WHEN (execution), not HOW (implementation).

**Benefits**:
- Faster orchestration decisions
- Less distraction from implementation details
- Cleaner agent instructions
- Metabob still learns (automatic reporting)
- Easier to maintain and evolve

**Next steps**: Implement Phase 1 (hide implementation tools) this week.
