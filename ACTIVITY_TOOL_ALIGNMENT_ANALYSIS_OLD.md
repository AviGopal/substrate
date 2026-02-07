# Activity Tool Alignment Analysis

## Executive Summary

**Problem**: Agents are exposed to 10+ activity-related tools with implementation details, causing distraction and preventing focus on orchestration.

**Goal**: Agents should focus on:
- **WHICH** activities to run (discovery)
- **WHEN** to run them (orchestration)
- **HOW** to sequence them (hierarchy/parallel)

**Solution**: Reduce agent-facing tools to 2-3 core tools, hide implementation details in framework.

---

## Current Tool Inventory

### Agent-Visible Activity Tools (10 tools)

| Tool | Purpose | Status | Recommendation |
|------|---------|--------|----------------|
| `activity` | Execute activity | ✅ KEEP | Core orchestration tool |
| `search_activities` | Find templates | ✅ KEEP | Discovery tool |
| `list_activity_templates` | List templates | ⚠️ REDUNDANT | Remove (duplicate of search) |
| `get_activity_template` | Get single template | ⚠️ MAYBE | Merge into search (verbose mode) |
| `register_activity_template` | Create templates | ❌ REMOVE | Internal framework operation |
| `debug_activity_execution` | Debug execution | ❌ REMOVE | Developer tool, not agent tool |
| `activity_error_inspector` | Inspect errors | ❌ REMOVE | Developer tool, not agent tool |
| `activity_replay` | Replay execution | ❌ REMOVE | Developer tool, not agent tool |
| `post_activity_result` | Report outcome | ⚠️ MAYBE | Auto-report in framework? |
| `enhanced_activity_executor` | Enhanced execution | ❌ REMOVE | Implementation detail |

### Analysis

**Good** ✅:
- `activity` tool description is clean and focused
- `search_activities` has compact/verbose modes

**Problems** ❌:
1. **Too many tools** (10) overwhelm agent context
2. **Implementation leakage** - agents see debugging tools
3. **Redundancy** - multiple ways to do same thing
4. **Distraction** - agents try to use debug tools instead of just running activities

---

## What Agents See vs Should See

### Current Agent Experience

**Agent Context** (from tool descriptions):
```
activity (37 lines)
search_activities (38 lines)
list_activity_templates (38 lines)
get_activity_template (40+ lines)
register_activity_template (161 lines!) ← WAY TOO DETAILED
debug_activity_execution (99 lines) ← DISTRACTING
activity_error_inspector (50+ lines) ← DISTRACTING
activity_replay (50+ lines) ← DISTRACTING
... more tools ...

TOTAL: ~500+ lines of activity implementation details
```

**Result**: Agent gets overwhelmed, tries to debug instead of orchestrate.

### Desired Agent Experience

**Agent Context** (simplified):
```
activity (20-30 lines) - Execute suggested activities
search_activities (20-30 lines) - Discover available activities

TOTAL: ~50-60 lines focused on WHAT and WHEN, not HOW
```

**Result**: Agent focuses on task orchestration.

---

## Recommended Tool Architecture

### Tier 1: Agent-Facing Tools (2-3 tools)

#### 1. `search_activities` - Discovery

**Purpose**: Find activities that match current goal

**Description** (simplified):
```
Search for activity templates that match your task.

Returns:
  - Template IDs (for use with activity tool)
  - Success rates (reliability indicator)
  - Brief descriptions

Modes:
  - compact (default): Just IDs and success rates
  - verbose: Include variables and costs

Examples:
  search_activities({ category: "feature" })
  search_activities({ query: "add endpoint" })
  search_activities({ verbose: true })

When to use:
  - Before starting multi-step work
  - To discover available workflows
  - When task matches a pattern
```

#### 2. `activity` - Execution

**Purpose**: Execute a discovered activity

**Description** (simplified):
```
Execute an activity template.

Parameters:
  - activityId: From search_activities results
  - variables: Key-value pairs (see search results)
  - reason: Why you're running this

The framework handles:
  - Context gathering
  - Task execution
  - Validation
  - Error recovery
  - Outcome recording

Example:
  activity({
    activityId: "add-rest-endpoint",
    variables: { method: "POST", path: "/api/users" },
    reason: "User wants user creation API"
  })

When to use:
  - For multi-step workflows
  - When activity matches task
  - For validated, consistent results
```

#### 3. `orchestrate_activities` (NEW - Optional)

**Purpose**: Run multiple activities in sequence or hierarchy

**Description**:
```
Execute multiple activities with dependencies.

Modes:
  - sequence: Run activities one after another
  - parallel: Run independent activities concurrently
  - hierarchy: Run parent activity that delegates to child activities

Example - Sequence:
  orchestrate_activities({
    mode: "sequence",
    activities: [
      { id: "setup-database", variables: {...} },
      { id: "add-migrations", variables: {...} },
      { id: "add-api-endpoints", variables: {...} }
    ],
    reason: "Setup complete backend"
  })

Example - Hierarchy:
  orchestrate_activities({
    mode: "hierarchy",
    parent: "build-full-stack-feature",
    variables: { feature: "authentication" },
    reason: "Complete auth system"
  })

When to use:
  - Multi-stage projects
  - Dependent activities
  - Complex orchestration
```

### Tier 2: Framework-Internal Operations (Hidden)

These happen automatically, agents don't see them:

- Template registration (happens via framework)
- Execution debugging (developer tool, not agent tool)
- Error inspection (automatic in framework)
- Activity replay (developer tool for testing)
- Metrics recording (automatic after execution)

---

## Implementation Strategy

### Phase 1: Hide Implementation Tools (Immediate)

**Change tool visibility**:
```typescript
// In tool registry or agent configuration
const agentTools = [
  "activity",
  "search_activities",
  // NOT: debug_activity_execution
  // NOT: activity_error_inspector
  // NOT: register_activity_template
  // NOT: activity_replay
]
```

**Move to developer tools**:
```typescript
const developerTools = [
  "debug_activity_execution",
  "activity_error_inspector",
  "activity_replay",
  "register_activity_template" // CLI command instead
]
```

### Phase 2: Consolidate Redundant Tools

**Remove `list_activity_templates`**:
- Functionality covered by `search_activities` with no parameters

**Merge `get_activity_template` into `search_activities`**:
- Use verbose mode: `search_activities({ templateId: "x", verbose: true })`

**Make `post_activity_result` automatic**:
- Framework posts results after activity completes
- Agents don't need to call explicitly

### Phase 3: Simplify Tool Descriptions

**Before** (register_activity_template.txt - 161 lines):
```
Register an activity template from a local JSON file or impulse.

This tool provides the proper workflow for registering activity templates:

1. **Loads** template definition from impulse or JSON file
2. **Parses** it with ActivityTemplate.CreateOptions schema (ID not required)
3. **Generates** template ID from name (e.g., "My Template" → "my-template")
4. **Saves** to local storage (~/.local/share/opencode/storage/activity-template/)
5. **Registers** with Metabob MCP backend (if available and enabled)

## Parameters
...
[150 more lines of implementation details]
```

**After** (agents don't see this tool at all):
```
[Tool not visible to agents]
[CLI command: opencode activity register template.json]
```

**Before** (activity.txt - 37 lines):
```
Run a structured activity from the suggestions.

Use this tool when the system suggests an activity that matches your task...
[Full description]
```

**After** (streamlined to ~25 lines):
```
Execute an activity template to accomplish a multi-step task.

Activities are pre-defined workflows that handle:
  - Context gathering
  - Task execution
  - Validation and error recovery
  - Outcome recording

Parameters:
  activityId: Template ID (from search_activities)
  variables: Required inputs (see template details)
  reason: Brief explanation of your goal

Example:
  activity({
    activityId: "add-rest-endpoint",
    variables: { method: "POST", path: "/api/users" },
    reason: "Create user registration endpoint"
  })

Use when:
  ✓ Multi-step workflow
  ✓ Activity matches task
  ✓ Want validated results
```

### Phase 4: Add Orchestration Tool (Optional)

If agents need to sequence multiple activities:

```typescript
// New tool: orchestrate_activities
Tool.define("orchestrate_activities", {
  description: "Execute multiple activities with dependencies",
  parameters: z.object({
    mode: z.enum(["sequence", "parallel", "hierarchy"]),
    activities: z.array(z.object({
      id: z.string(),
      variables: z.record(z.unknown()),
      dependsOn: z.array(z.string()).optional()
    })),
    reason: z.string()
  }),
  execute: async (params) => {
    // Framework handles orchestration logic
    // Agents just specify WHAT and WHEN
  }
})
```

---

## Agent Instruction Changes

### Current AGENTS.md (Problem Areas)

**Too much detail on HOW activities work**:
```markdown
## Activity Template System

OpenCode uses **reusable, learning activity templates**...

### Core Concept

Templates are **blueprints** that:
- Learn from executions
- Manage prompt space
- Handle LLM inconsistency
- Compound knowledge

[500+ lines of implementation details]
```

**Too many workflow examples**:
```markdown
### Creating Templates with TemplateStructure API

[200+ lines of API documentation]
```

### Recommended AGENTS.md (Focused)

**Focus on WHICH and WHEN**:
```markdown
## Using Activities

Activities are multi-step workflows optimized through learning.

### Discovery

Find activities that match your task:

```typescript
// Search for relevant activities
const results = search_activities({ category: "feature" })

// Check success rates and descriptions
// Pick the best match for your goal
```

### Execution

Run the selected activity:

```typescript
activity({
  activityId: "activity-id-from-search",
  variables: { /* required inputs */ },
  reason: "Why I'm running this"
})
```

### Orchestration

For multi-stage work:

```typescript
// Option 1: Run activities in sequence manually
activity({ activityId: "step1", ... })
// Wait for completion
activity({ activityId: "step2", ... })

// Option 2: Use orchestration tool (if complex)
orchestrate_activities({
  mode: "sequence",
  activities: [
    { id: "step1", ... },
    { id: "step2", ... }
  ]
})
```

### When to Use

✓ Multi-step workflows  
✓ Task matches available activity  
✓ Want validated, consistent results  

✗ Simple single-step tasks (just do them)  
✗ Exploration or experimentation  
```

---

## Metabob Integration Points

### What Metabob Observes (Automatic)

**From activity execution**:
- Template selection (which activities used)
- Execution metrics (cost, duration, tokens)
- Success/failure outcomes
- Validation results

**Agent doesn't need to**:
- Manually report metrics
- Debug failed executions
- Register templates
- Inspect errors

**Framework handles**:
- Sending data to Metabob backend
- Recording execution outcomes
- Updating template success rates
- Learning from patterns

### Metabob's Learning Loop

```
Agent runs activity
  ↓ (automatic)
Framework tracks metrics
  ↓ (automatic)
Metabob receives execution data
  ↓ (learns)
Success rates updated
  ↓ (improves)
Future searches return better recommendations
  ↓
Agent benefits from learned patterns
```

**Agent's role**: Use activities. That's it.  
**Metabob's role**: Observe and improve. Automatic.

---

## Validation Checklist

### Agent Experience Goals

- [ ] Agent sees 2-3 activity tools (not 10+)
- [ ] Tool descriptions focus on WHAT and WHEN (not HOW)
- [ ] No implementation details visible
- [ ] No debugging tools in normal agent context
- [ ] Orchestration is clear and simple

### Framework Responsibilities

- [ ] Template registration hidden (CLI command)
- [ ] Execution debugging hidden (developer tool)
- [ ] Error inspection automatic
- [ ] Metrics recording automatic
- [ ] Metabob integration automatic

### AGENTS.md Content

- [ ] Activity section < 100 lines (not 500+)
- [ ] Focus on discovery and execution
- [ ] Simple orchestration examples
- [ ] No template creation details
- [ ] No debugging workflows

---

## Migration Path

### Step 1: Tool Visibility (Week 1)

```typescript
// In agent configuration
export const activityAgentTools = [
  "activity",
  "search_activities"
  // Removed: all debug/inspect/replay tools
]
```

### Step 2: Consolidate Tools (Week 2)

- Remove `list_activity_templates` (use search instead)
- Remove `get_activity_template` (use search verbose)
- Auto-report via `post_activity_result` (no manual call)

### Step 3: Simplify Descriptions (Week 2)

- Rewrite tool descriptions to ~25 lines each
- Focus on WHAT and WHEN, remove HOW
- Remove implementation details

### Step 4: Update AGENTS.md (Week 3)

- Reduce activity section to ~100 lines
- Remove template creation details
- Remove debugging workflows
- Add simple orchestration examples

### Step 5: Add Orchestration (Week 4 - Optional)

- Implement `orchestrate_activities` tool if needed
- Support sequence, parallel, hierarchy modes
- Keep description simple (30 lines max)

---

## Success Metrics

### Before (Current)

- **Agent tools**: 10+ activity-related tools
- **Context size**: ~500 lines of activity details
- **Agent confusion**: High (tries to debug, register, inspect)
- **Focus**: Implementation details (HOW)
- **Distraction rate**: High

### After (Target)

- **Agent tools**: 2-3 activity tools
- **Context size**: ~60 lines total
- **Agent confusion**: Low (just search and execute)
- **Focus**: Orchestration (WHAT and WHEN)
- **Distraction rate**: Minimal

---

## Key Principles

### 1. **Agents Orchestrate, Framework Executes**

**Agent's job**:
- Decide WHICH activities to run
- Determine WHEN to run them
- Provide required variables

**Framework's job**:
- Load templates
- Execute tasks
- Handle errors
- Record metrics
- Send to Metabob

### 2. **Hide Implementation, Show Interface**

**Show**:
- Activity IDs and descriptions
- Success rates and costs
- Required variables
- Simple execution syntax

**Hide**:
- Template schemas
- Execution internals
- Debugging tools
- Registration process
- Error inspection

### 3. **Automatic > Manual**

**Automatic** (framework):
- Metrics recording
- Outcome reporting
- Error recovery
- Metabob sync

**Manual** (agent choice):
- Activity selection
- Variable provision
- Orchestration decisions

### 4. **Simple Tools > Many Tools**

**Before**: 10+ tools, each with specific purpose  
**After**: 2-3 tools, clear and focused

**Before**: 500+ lines of tool descriptions  
**After**: ~60 lines of tool descriptions

---

## Recommended Next Steps

1. **Audit tool visibility** - Which tools are exposed to which agents?
2. **Measure distraction** - How often do agents try to use debug tools?
3. **Simplify descriptions** - Rewrite to ~25 lines, focus on interface
4. **Update AGENTS.md** - Reduce activity section to ~100 lines
5. **Hide implementation tools** - Move to developer-only tools
6. **Test agent behavior** - Does agent focus on orchestration now?
7. **Monitor Metabob learning** - Is data still being collected correctly?

---

## Conclusion

**Current state**: Agents overwhelmed with 10+ activity tools and 500+ lines of implementation details.

**Desired state**: Agents focused on orchestration with 2-3 simple tools and ~60 lines of interface documentation.

**Core insight**: Agents should know WHICH activities exist and WHEN to use them. The framework handles HOW they execute.

**Benefits**:
- ✅ Reduced cognitive load on agents
- ✅ Faster decision making
- ✅ Less distraction from implementation details
- ✅ Better orchestration focus
- ✅ Metabob still observes and learns (automatic)
- ✅ Cleaner agent instructions
- ✅ Easier to maintain and evolve
