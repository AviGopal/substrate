# Activity System Implementation Plan

## Plan Overview

**Goal**: Make agents focus on activity orchestration (WHAT/WHEN) instead of implementation (HOW), while ensuring Metabob learns effectively from execution data.

**Timeline**: 4 weeks from start to production deployment

**Key Changes**:
1. Reduce agent-visible activity tools from 10+ to 2
2. Simplify tool descriptions from 500+ lines to ~60 lines
3. Improve create-activity-template success rate from ~65% to 80-95%
4. Set up monitoring for data-driven optimization

---

## Week 1: Tool Visibility and Description Simplification

### Priority: HIGH | Effort: LOW | Impact: IMMEDIATE

### Tasks

#### Day 1-2: Audit Current State

**Task 1.1**: Inventory all activity tools
```bash
cd repos/metabob-opencode/packages/opencode
grep -l "activity" src/tool/*.ts | wc -l
# Document which tools exist and their purposes
```

**Deliverable**: `ACTIVITY_TOOLS_INVENTORY.md`
- List of all 10+ tools
- Current agent visibility
- Usage frequency (if metrics available)
- Redundancy analysis

**Task 1.2**: Measure current agent behavior
```bash
# If session logs available:
grep "tool.*activity" logs/sessions/*.log | \
  awk '{print $3}' | sort | uniq -c | sort -rn

# Document:
# - Which activity tools are used most
# - How often agents use debug tools (distraction indicator)
# - Typical tool call sequences
```

**Deliverable**: `AGENT_BEHAVIOR_BASELINE.md`

---

#### Day 3-4: Hide Implementation Tools

**Task 1.3**: Create tool visibility configuration

**File**: `repos/metabob-opencode/packages/opencode/src/agent/tool-registry.ts` (or create new file)

```typescript
/**
 * Tool visibility configuration for different agent modes
 */
export const AGENT_TOOL_CONFIG = {
  // Core orchestration tools (visible to all)
  core: [
    "activity",
    "search_activities"
  ],
  
  // Developer-only tools (hidden from agents)
  developer: [
    "debug_activity_execution",
    "activity_error_inspector",
    "activity_replay",
    "register_activity_template",
    "list_activity_templates",  // Redundant with search
    "get_activity_template",    // Redundant with search verbose
    "post_activity_result",     // Auto-reported now
    "enhanced_activity_executor" // Internal implementation
  ]
}

/**
 * Get tools available to an agent
 */
export function getAgentTools(
  agentMode: string,
  includeDevTools: boolean = false
): string[] {
  const tools = [...AGENT_TOOL_CONFIG.core]
  
  if (includeDevTools) {
    tools.push(...AGENT_TOOL_CONFIG.developer)
  }
  
  return tools
}
```

**Task 1.4**: Update agent configuration

**File**: `repos/metabob-opencode/packages/opencode/src/agent/agent.ts`

```typescript
// Find where tools are loaded for agents
// Update to use getAgentTools()

export namespace Agent {
  export async function create(config: CreateOptions): Promise<Info> {
    // ... existing code
    
    // NEW: Filter tools based on mode
    const availableTools = getAgentTools(
      config.mode,
      config.includeDevTools ?? false  // Default: false
    )
    
    return {
      // ... existing fields
      tools: availableTools
    }
  }
}
```

**Task 1.5**: Update tool registry

**File**: `repos/metabob-opencode/packages/opencode/src/tool/registry.ts`

```typescript
// Add visibility metadata to tool registration
export interface ToolRegistration {
  tool: Tool.Info
  visibility: "agent" | "developer" | "internal"
}

// Register with visibility
Tool.register(ActivityTool, { visibility: "agent" })
Tool.register(SearchActivitiesTool, { visibility: "agent" })
Tool.register(DebugActivityExecutionTool, { visibility: "developer" })
```

**Deliverable**: Pull request with tool visibility changes
- [ ] Configuration file created
- [ ] Agent.ts updated to filter tools
- [ ] Tool registry updated with visibility
- [ ] Unit tests pass
- [ ] No tools broken

---

#### Day 5: Simplify Tool Descriptions

**Task 1.6**: Rewrite activity.txt

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.txt`

**Current**: 37 lines  
**Target**: 25 lines

```txt
Execute a multi-step activity workflow.

Use when:
  ✓ Task matches an available activity
  ✓ Need validated, consistent results
  ✓ Multi-step workflow required

Parameters:
  - activityId: From search_activities results
  - variables: Required inputs (see template details)
  - reason: Brief explanation of goal

Example:
  activity({
    activityId: "add-rest-endpoint",
    variables: { method: "POST", path: "/api/users" },
    reason: "Create user registration endpoint"
  })

The framework automatically handles:
  • Context gathering
  • Task execution
  • Validation and error recovery
  • Outcome recording for learning

Don't use for:
  ✗ Simple single-step tasks (just do them directly)
  ✗ Exploration or experimentation
```

**Task 1.7**: Rewrite search-activities.txt

**File**: `repos/metabob-opencode/packages/opencode/src/tool/search-activities.txt`

**Current**: 38 lines  
**Target**: 25 lines

```txt
Discover available activity workflows.

Returns templates with:
  • Success rates (reliability indicator)
  • Brief descriptions
  • Required variables (verbose mode)

Parameters:
  - category (optional): "feature", "bugfix", "refactor", "tool"
  - query (optional): Search term
  - verbose (optional): Show full details (default: false)

Modes:
  - compact (default): IDs and success rates (~300 bytes)
  - verbose: Full details including costs (~2KB)

Examples:
  search_activities({})
  search_activities({ category: "feature" })
  search_activities({ query: "endpoint", verbose: true })

Use before running activities to find template IDs.
Higher success rates indicate more reliable templates.
```

**Deliverable**: Pull request with simplified tool descriptions
- [ ] activity.txt reduced to 25 lines
- [ ] search-activities.txt reduced to 25 lines
- [ ] Focus on WHAT/WHEN not HOW
- [ ] Examples clear and concise

---

### Week 1 Success Metrics

- [ ] 10+ tools reduced to 2 agent-visible tools
- [ ] Tool descriptions: 500+ lines → 50 lines
- [ ] No functionality broken
- [ ] Agent can still search and execute activities
- [ ] Tests pass

---

## Week 2: AGENTS.md Simplification and Auto-Reporting

### Priority: HIGH | Effort: MEDIUM | Impact: SUSTAINED

### Tasks

#### Day 6-7: Reduce AGENTS.md Activity Section

**Task 2.1**: Audit current AGENTS.md

**File**: `repos/metabob-opencode/AGENTS.md` or `packages/opencode/AGENTS.md`

```bash
# Count lines in activity section
sed -n '/## Activity.*System/,/^## [^A]/p' AGENTS.md | wc -l
# Expected: 500+ lines

# Identify what to keep vs remove
grep -n "###" AGENTS.md | grep -i activity
```

**Task 2.2**: Create simplified activity section

**File**: `repos/metabob-opencode/AGENTS.md`

**Replace "Activity Template System" section** (~500 lines) with:

```markdown
## Using Activities

Activities are multi-step workflows optimized through learning.

### Discovery

Find activities that match your task:

```typescript
// Search by category
search_activities({ category: "feature" })

// Search by keyword
search_activities({ query: "endpoint" })

// Get full details
search_activities({ verbose: true })
```

Results show:
- **Template ID** (for execution)
- **Success rate** (reliability: 0.0-1.0, higher is better)
- **Description** (what it does)
- **Variables** (required inputs, verbose mode only)

### Execution

Run the selected activity:

```typescript
activity({
  activityId: "add-rest-endpoint",
  variables: {
    method: "POST",
    path: "/api/users"
  },
  reason: "User wants user registration endpoint"
})
```

The framework automatically:
• Gathers context
• Executes tasks
• Validates results
• Records outcomes for learning

### Orchestration

**Sequential** (one after another):
```typescript
// Step 1
activity({ activityId: "setup-database", ... })
// Step 2 (after step 1 completes)
activity({ activityId: "add-migrations", ... })
```

**Hierarchical** (parent coordinates children):
```typescript
// Parent activity internally delegates
activity({
  activityId: "build-full-stack-feature",
  variables: { feature: "authentication" }
})
```

### When to Use

✓ Multi-step workflow (3+ steps)  
✓ Task matches available activity  
✓ Want validated, consistent results  

✗ Simple single-step tasks  
✗ Exploration or experimentation  
✗ No suitable template exists  

### Built-In Activities

Check available:
```bash
opencode activity template list
```

Common templates:
- `add-rest-endpoint` - API endpoint with tests
- `add-tool` - OpenCode tool with docs
- `fix-bug-with-tests` - Bug fix + regression tests

Success rates improve with each execution.
```

**Target**: ~100 lines (vs 500+)

**Remove**:
- Template creation details (use CLI instead)
- Template structure documentation (internal)
- TemplateStructure API details (developer docs)
- Variable interpolation details (framework handles)
- Debugging workflows (developer tools)
- Template lifecycle details (automatic)

**Keep**:
- Discovery (search_activities)
- Execution (activity tool)
- Simple orchestration patterns
- When to use guidance
- Built-in template list

**Deliverable**: Pull request with simplified AGENTS.md
- [ ] Activity section: 500+ → ~100 lines
- [ ] Focus on usage not implementation
- [ ] Clear examples
- [ ] No debugging workflows

---

#### Day 8-9: Implement Auto-Reporting

**Task 2.3**: Add automatic outcome reporting

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Find**: Lines around 255 (after execution completes, before metrics update)

```typescript
// Add after result is computed, before returning
async function reportOutcomeToMetabob(
  template: ActivityTemplate.Schema,
  result: ExecutionResult,
  activityId: string
): Promise<void> {
  try {
    // Import MetabobAPI
    const { MetabobAPI } = await import("../util/metabob-api")
    
    // Report outcome
    await MetabobAPI.reportActivityOutcome({
      activityId,
      templateId: template.id,
      variantId: template.variant_id || template.id,
      success: result.success,
      durationMs: result.totalDuration,
      cost: result.totalCost,
      tokens: result.totalTokens,
      taskResults: result.tasks.map(t => ({
        taskId: t.taskId,
        success: t.status === "completed",
        durationMs: t.duration,
        cost: t.cost,
        attempts: t.attempts
      }))
    })
    
    log.info("outcome reported to metabob", {
      templateId: template.id,
      activityId,
      success: result.success
    })
  } catch (error) {
    // Log but don't fail the activity
    log.warn("failed to report outcome to metabob", {
      templateId: template.id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

// In TemplateExecutor.execute(), after result computed:
export async function execute(options: ExecuteOptions): Promise<ExecutionResult> {
  // ... existing code creates result ...
  
  // NEW: Report outcome automatically (best-effort)
  if (!options.dryRun) {
    await reportOutcomeToMetabob(template, result, activity.id)
  }
  
  // Update template metrics (existing code)
  if (!options.dryRun) {
    await updateTemplateMetrics(template, result)
  }
  
  return result
}
```

**Task 2.4**: Remove post_activity_result tool

**File**: `repos/metabob-opencode/packages/opencode/src/tool/registry.ts`

```typescript
// Remove or comment out:
// import { PostActivityResultTool } from "./post-activity-result"
// Tool.register(PostActivityResultTool)

// Add comment explaining why:
// PostActivityResultTool removed - outcomes now reported automatically
// via TemplateExecutor.reportOutcomeToMetabob()
```

**Deliverable**: Pull request with auto-reporting
- [ ] reportOutcomeToMetabob() implemented
- [ ] Called after each activity execution
- [ ] Best-effort (doesn't fail activity if reporting fails)
- [ ] post_activity_result tool removed
- [ ] Tests verify reporting happens

---

### Week 2 Success Metrics

- [ ] AGENTS.md activity section: 500+ → 100 lines
- [ ] Auto-reporting implemented
- [ ] Agent instructions focused on usage
- [ ] No manual outcome reporting needed

---

## Week 3: Improve create-activity-template Success Rate

### Priority: MEDIUM | Effort: MEDIUM | Impact: LONG-TERM

### Tasks

#### Day 10-12: Implement Enhanced Validation

**Task 3.1**: Create validation script

**File**: `repos/metabob-opencode/packages/opencode/scripts/validate-activity-template.sh`

```bash
#!/bin/bash
# Comprehensive activity template validation
# Used in create-activity-template validation commands

TEMPLATE_FILE="$1"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: Template file not found: $TEMPLATE_FILE"
  exit 1
fi

echo "Validating activity template: $TEMPLATE_FILE"

# 1. JSON syntax
echo "1. Checking JSON syntax..."
if ! jq empty "$TEMPLATE_FILE" 2>/dev/null; then
  echo "   ✗ Invalid JSON syntax"
  exit 1
fi
echo "   ✓ JSON valid"

# 2. Task count (3-7 optimal)
echo "2. Checking task count..."
TASK_COUNT=$(jq '.tasks | length' "$TEMPLATE_FILE")
if [ "$TASK_COUNT" -lt 3 ] || [ "$TASK_COUNT" -gt 7 ]; then
  echo "   ✗ Task count $TASK_COUNT (should be 3-7)"
  exit 1
fi
echo "   ✓ Task count: $TASK_COUNT"

# 3. All tasks have validation
echo "3. Checking task validation..."
if ! jq -e '.tasks | all(.validation)' "$TEMPLATE_FILE" >/dev/null; then
  echo "   ✗ Some tasks missing validation"
  exit 1
fi
echo "   ✓ All tasks have validation"

# 4. All tasks have retry
echo "4. Checking retry configuration..."
if ! jq -e '.tasks | all(.retry)' "$TEMPLATE_FILE" >/dev/null; then
  echo "   ✗ Some tasks missing retry config"
  exit 1
fi
echo "   ✓ All tasks have retry config"

# 5. Dependency graph integrity
echo "5. Validating dependency graph..."
if ! jq -e '.tasks | map(.dependencies // []) | flatten | unique | all(. as $dep | any(.tasks[]; .id == $dep))' "$TEMPLATE_FILE" >/dev/null; then
  echo "   ✗ Invalid dependencies (reference non-existent tasks)"
  exit 1
fi
echo "   ✓ Dependency graph valid"

# 6. Agent assignments
echo "6. Checking agent assignments..."
if ! jq -e '.tasks | all(.subagent and .subagent != "")' "$TEMPLATE_FILE" >/dev/null; then
  echo "   ✗ Some tasks have invalid agent assignments"
  exit 1
fi
echo "   ✓ All tasks have valid agents"

echo ""
echo "✓ All validations passed!"
exit 0
```

```bash
chmod +x repos/metabob-opencode/packages/opencode/scripts/validate-activity-template.sh
```

**Task 3.2**: Update create-activity-template.json

**File**: `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`

**Change 1**: Update version
```json
{
  "version": 4,  // Increment from 3 to 4
```

**Change 2**: Split Task 1 into 3 subtasks

Replace lines 22-101 (the large `create-and-register-template` task) with:

```json
{
  "tasks": [
    {
      "id": "analyze-examples",
      "subagent": "general",
      "description": "Study example templates and extract patterns",
      "dependencies": [],
      "impulseReferences": ["templateExamples"],
      "prompt": {
        "template": "Study the provided template examples from context.\n\nFor EACH example:\n1. Identify task structure patterns\n2. Note validation strategies\n3. Observe retry configurations\n4. Count tasks (aim for 3-5)\n\nOutput (structured markdown):\n\n## Patterns Observed\n- [Pattern 1]\n- [Pattern 2]\n\n## Best Practices\n- [Practice 1]\n- [Practice 2]\n\n## Anti-Patterns to Avoid\n- [Anti-pattern 1]\n- [Anti-pattern 2]\n\nThis analysis guides your template design.",
        "maxTokens": 6000,
        "compressionStrategy": "filter"
      },
      "validation": {
        "requiredPatterns": [
          "## Patterns Observed",
          "## Best Practices",
          "## Anti-Patterns"
        ]
      },
      "retry": { "maxAttempts": 2, "strategy": "simple" }
    },
    {
      "id": "design-task-graph",
      "subagent": "general",
      "description": "Design task dependency graph",
      "dependencies": ["analyze-examples"],
      "prompt": {
        "template": "Design the task graph for {{templateName}}.\n\n**Requirements**:\n- 3-7 tasks (prefer 3-5)\n- Clear dependencies\n- Appropriate agent assignments\n- Each task atomic and testable\n\n**Output Format**:\n\n## Task Graph for {{templateName}}\n\ntask-id-1 (agent: general)\n  Purpose: [one sentence]\n  Validation: [what to check]\n  ↓\ntask-id-2 (agent: config)\n  Purpose: [one sentence]\n  Validation: [what to check]\n\n**Agent Guide**:\n- general: Multi-purpose\n- config: Schema/config\n- session: Prompts/messages\n- tool: Tool implementations\n- test: Test coverage",
        "maxTokens": 6000,
        "compressionStrategy": "filter",
        "variables": [
          { "name": "templateName", "type": "string", "required": true }
        ]
      },
      "validation": {
        "requiredPatterns": [
          "## Task Graph",
          "task-",
          "agent:",
          "Purpose:",
          "Validation:",
          "↓"
        ],
        "forbiddenPatterns": ["TBD", "TODO"]
      },
      "retry": { "maxAttempts": 2, "strategy": "simple" }
    },
    {
      "id": "write-template-json",
      "subagent": "general",
      "description": "Convert task graph to ActivityTemplate JSON",
      "dependencies": ["design-task-graph"],
      "impulseReferences": ["templateExamples"],
      "prompt": {
        "template": "Convert your task graph into ActivityTemplate JSON.\n\n**Implementation**:\n1. Create {{templateId}}.json\n2. Follow ActivityTemplate.CreateOptions schema\n3. Use patterns from examples\n4. Implement validation from graph\n5. Set maxTokens per task (8000-16000)\n6. Include retry config\n\n**Requirements**:\n- Task count: 3-7 (prefer 3-5)\n- All tasks have validation\n- All tasks have retry\n- Dependencies match graph\n\n**Self-Validation**:\n```bash\n# Run these before completing:\njq empty {{templateId}}.json\njq '.tasks | length' {{templateId}}.json  # 3-7\njq '.tasks | all(.validation)' {{templateId}}.json  # true\njq '.tasks | all(.retry)' {{templateId}}.json  # true\n```\n\nFix any issues before proceeding.",
        "maxTokens": 10000,
        "compressionStrategy": "filter",
        "variables": [
          { "name": "templateId", "type": "string", "required": true }
        ]
      },
      "validation": {
        "requiredFiles": ["*.json"],
        "requiredPatterns": [
          "\"name\":",
          "\"category\":",
          "\"tasks\":",
          "\"validation\":",
          "\"retry\":"
        ],
        "forbiddenPatterns": [
          "TODO",
          "\"subagent\": \"\"",
          "\"maxTokens\": 0"
        ],
        "commands": [
          {
            "name": "validate-with-script",
            "command": "bash scripts/validate-activity-template.sh *.json",
            "required": true
          }
        ]
      },
      "retry": { "maxAttempts": 2, "strategy": "progressive-context" }
    },
    {
      "id": "register-template",
      "subagent": "general",
      "description": "Register with Metabob backend and verify",
      "dependencies": ["write-template-json"],
      // ... keep existing registration task (lines 102-142)
    }
  ]
}
```

**Change 3**: Update contextRequirements (lines 6-20)

```json
{
  "contextRequirements": [
    {
      "key": "highQualityExamples",
      "hint": "Use search_activities({ category: \"{{category}}\", verbose: true }) to find 3 templates with highest success rates (>= 0.75 if available). If fewer than 3, search other categories. Focus on templates with 10+ executions for reliable patterns.",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [5000, 8000]
    },
    {
      "key": "failurePatterns",
      "hint": "Use metabob_search_codebase_issues to find annotations about template creation failures. Look for MESSAGE_FOR:all about common mistakes.",
      "impulseTypes": ["metabobAnnotation"],
      "required": false,
      "budgetRange": [2000, 4000]
    }
  ]
}
```

**Deliverable**: Pull request with improved create-activity-template
- [ ] Version incremented to 4
- [ ] Task 1 split into 3 subtasks
- [ ] Validation script created
- [ ] Enhanced validation commands
- [ ] Better context requirements

---

#### Day 13-14: Testing and Refinement

**Task 3.3**: Create test suite

**File**: `repos/metabob-opencode/packages/opencode/test/session/create-activity-template-v4.test.ts`

```typescript
import { describe, it, expect } from "bun:test"
import { TemplateExecutor } from "../../src/session/template-executor"
import { search_activities } from "../../src/tool/search-activities"

describe("create-activity-template v4", () => {
  it("validates task count limit", async () => {
    // Mock agent that creates 10 tasks
    const result = await TemplateExecutor.execute({
      templateId: "create-activity-template",
      variables: {
        templateName: "Too Many Tasks Test",
        templateDescription: "Test template with too many tasks",
        category: "feature",
        purpose: "Testing validation",
        templateId: "too-many-tasks"
      },
      reason: "Test validation",
      // Mock: agent creates 10 tasks in write-template-json
    })
    
    expect(result.success).toBe(false)
    expect(result.tasks.find(t => t.taskId === "write-template-json")?.error)
      .toContain("task count")
  })
  
  it("requires all tasks to have validation", async () => {
    // Test validation enforcement
  })
  
  it("validates dependency graph integrity", async () => {
    // Test circular dependency detection
  })
  
  it("succeeds with well-formed template", async () => {
    const result = await TemplateExecutor.execute({
      templateId: "create-activity-template",
      variables: {
        templateName: "Test Template Valid",
        templateDescription: "Valid test template",
        category: "feature",
        purpose: "Testing success path",
        templateId: "test-template-valid"
      },
      reason: "Test success"
    })
    
    expect(result.success).toBe(true)
    expect(result.tasks.length).toBe(4)  // 3 subtasks + register
    
    // Verify registration
    const search = await search_activities({ query: "test-template-valid" })
    expect(search.activities).toContainEqual(
      expect.objectContaining({ id: "test-template-valid" })
    )
  })
})
```

**Task 3.4**: Run baseline tests

```bash
# Execute 10 test runs with mock variables
cd repos/metabob-opencode/packages/opencode

for i in {1..10}; do
  echo "Test execution $i..."
  bun run test-activity-execution \
    --template create-activity-template \
    --variables "{\"templateName\":\"TestV4-$i\",\"category\":\"feature\",\"purpose\":\"test\"}"
done

# Analyze results
bun run analyze-success-rate \
  --template create-activity-template \
  --last-n 10
```

**Deliverable**: Test results document
- [ ] 10 test executions completed
- [ ] Success rate measured
- [ ] Failure modes identified
- [ ] Validation effectiveness verified

---

### Week 3 Success Metrics

- [ ] create-activity-template v4 implemented
- [ ] Validation script working
- [ ] 10+ test executions completed
- [ ] Success rate baseline established
- [ ] Ready for A/B testing

---

## Week 4: Monitoring, Deployment, and Validation

### Priority: HIGH | Effort: LOW | Impact: SUSTAINED

### Tasks

#### Day 15-16: Set Up Monitoring

**Task 4.1**: Create monitoring queries

**File**: `repos/metabob-opencode/packages/opencode/scripts/monitor-activity-success.ts`

```typescript
/**
 * Monitor activity template success rates
 */
import { TemplateRepository } from "../src/session/activity-template-repository"
import { MetabobAPI } from "../src/util/metabob-api"

async function monitorTemplateSuccess() {
  // Get all templates
  const templates = await TemplateRepository.list()
  
  console.log("Activity Template Success Rates\n")
  console.log("Template ID".padEnd(40), "Executions", "Success", "Avg Cost", "Avg Duration")
  console.log("-".repeat(100))
  
  for (const template of templates) {
    const successPct = (template.successRate * 100).toFixed(1) + "%"
    const cost = "$" + template.avgCost.toFixed(2)
    const duration = (template.avgDuration / 1000).toFixed(1) + "s"
    
    console.log(
      template.id.padEnd(40),
      template.executions.toString().padEnd(11),
      successPct.padEnd(8),
      cost.padEnd(9),
      duration
    )
  }
  
  // Highlight low performers
  const lowPerformers = templates.filter(t => 
    t.executions >= 10 && t.successRate < 0.75
  )
  
  if (lowPerformers.length > 0) {
    console.log("\n⚠️  Templates needing attention (>10 executions, <75% success):")
    for (const template of lowPerformers) {
      console.log(`  - ${template.id}: ${(template.successRate * 100).toFixed(1)}% (${template.executions} executions)`)
    }
  }
}

monitorTemplateSuccess()
```

**Task 4.2**: Create variant comparison tool

**File**: `repos/metabob-opencode/packages/opencode/scripts/compare-template-variants.ts`

```typescript
/**
 * Compare different versions of the same template
 */
async function compareVariants(templateId: string) {
  const variants = await MetabobAPI.getTemplateVariants(templateId)
  
  console.log(`Comparing variants for: ${templateId}\n`)
  
  for (const variant of variants) {
    console.log(`Version ${variant.version}:`)
    console.log(`  Executions: ${variant.executions}`)
    console.log(`  Success Rate: ${(variant.successRate * 100).toFixed(1)}%`)
    console.log(`  Avg Cost: $${variant.avgCost.toFixed(2)}`)
    console.log(`  Avg Duration: ${(variant.avgDuration / 1000).toFixed(1)}s`)
    console.log(`  Tasks: ${variant.tasks.length}`)
    console.log(`  Status: ${variant.status}`)
    console.log()
  }
  
  // Statistical comparison
  if (variants.length >= 2) {
    const sorted = variants.sort((a, b) => b.successRate - a.successRate)
    console.log("Winner:", sorted[0].version, `(${(sorted[0].successRate * 100).toFixed(1)}% success)`)
  }
}

// Usage: bun run scripts/compare-template-variants.ts create-activity-template
```

**Deliverable**: Monitoring scripts
- [ ] monitor-activity-success.ts created
- [ ] compare-template-variants.ts created
- [ ] Executable via bun run
- [ ] Clear output formatting

---

#### Day 17-18: Deploy and Monitor

**Task 4.3**: Deploy to staging

```bash
# 1. Merge all PRs from Weeks 1-3
git checkout main
git pull
git merge week1-tool-visibility
git merge week2-agents-md-simplification
git merge week3-create-template-improvements

# 2. Deploy to staging
cd repos/metabob-opencode
bun run build
./deploy-staging.sh  # Or equivalent

# 3. Monitor for 48 hours
watch -n 300 'bun run scripts/monitor-activity-success.ts'
```

**Task 4.4**: Collect baseline data

```bash
# Run create-activity-template 20 times
for i in {1..20}; do
  opencode activity run create-activity-template \
    --variables "{\"templateName\":\"Baseline-$i\",\"category\":\"feature\",\"purpose\":\"baseline\"}" \
    --log-metrics
  sleep 30
done

# Compare v3 vs v4
bun run scripts/compare-template-variants.ts create-activity-template

# Expected:
# v3: 65% success (historical)
# v4: 80%+ success (target)
```

**Deliverable**: Monitoring report
- [ ] 48-hour monitoring data
- [ ] 20 baseline executions
- [ ] v3 vs v4 comparison
- [ ] Success rate improvement verified

---

#### Day 19-20: Production Deployment

**Task 4.5**: Deploy to production

```bash
# If staging results good:
# - v4 success rate >= 75%
# - No regressions in other templates
# - Agent behavior improved (fewer tool calls)

# Deploy to production
cd repos/metabob-opencode
git checkout main
git tag v1.x.0-activity-improvements
bun run build
./deploy-production.sh
```

**Task 4.6**: Set up continuous monitoring

```bash
# Add to cron or scheduler
# Every 6 hours:
0 */6 * * * cd /path/to/opencode && bun run scripts/monitor-activity-success.ts >> logs/activity-monitoring.log

# Weekly summary email
0 9 * * MON cd /path/to/opencode && bun run scripts/weekly-activity-report.ts | mail -s "Activity Success Report" team@company.com
```

**Deliverable**: Production deployment
- [ ] Production deployment completed
- [ ] Monitoring scheduled
- [ ] Team notified
- [ ] Rollback plan documented

---

### Week 4 Success Metrics

- [ ] All changes deployed to production
- [ ] Monitoring active
- [ ] Baseline data collected (20+ executions)
- [ ] Success rate improvement verified
- [ ] No regressions

---

## Success Criteria (Overall)

### Week 1 Outcomes

- ✅ Agent-visible tools: 10+ → 2
- ✅ Tool descriptions: 500+ lines → 50 lines
- ✅ Tests pass, no functionality broken

### Week 2 Outcomes

- ✅ AGENTS.md: 500+ lines → 100 lines
- ✅ Auto-reporting implemented
- ✅ Agent instructions focused on usage

### Week 3 Outcomes

- ✅ create-activity-template v4 created
- ✅ Enhanced validation implemented
- ✅ Test suite created
- ✅ 10+ test executions completed

### Week 4 Outcomes

- ✅ Deployed to production
- ✅ Monitoring active
- ✅ Success rate baseline: v4 >= 75%
- ✅ Agent behavior improved (fewer distractions)

### 3-Month Outcomes (Post-Deployment)

- ✅ 50+ executions for v3 and v4
- ✅ Thompson Sampling clear winner emerged
- ✅ Overall success rate improvement measured
- ✅ No false rejections from validation

---

## Implementation Priorities

### Must Have (Week 1-2)

1. **Tool visibility reduction** - Immediate impact on agent focus
2. **Tool description simplification** - Quick win, less cognitive load
3. **AGENTS.md simplification** - Clearer instructions

**Rationale**: Quick wins with immediate impact on agent behavior. Low risk, high reward.

### Should Have (Week 3)

4. **create-activity-template v4** - Improves long-term template quality
5. **Enhanced validation** - Catches errors early

**Rationale**: Moderate effort, high long-term impact. Enables data-driven optimization.

### Could Have (Post-Launch)

6. **Automated evolution** - Weekly failure analysis, variant generation
7. **Advanced monitoring** - Dashboards, alerts, trend analysis

**Rationale**: Requires execution data first. Implement after 3 months of data collection.

---

## Risk Mitigation

### Risk 1: Tool Hiding Breaks Workflows

**Mitigation**:
- Keep developer mode flag to re-enable tools
- Gradual rollout (staging first)
- Monitor for errors about missing tools

**Rollback**:
```typescript
// Quick fix: Re-enable all tools temporarily
const agentTools = [...AGENT_TOOL_CONFIG.core, ...AGENT_TOOL_CONFIG.developer]
```

### Risk 2: Enhanced Validation Too Strict

**Mitigation**:
- Test with 10+ diverse templates
- Measure false rejection rate
- Adjust thresholds if >5% false rejections

**Rollback**:
```json
// Relax validation in v4:
"commands": [
  { "name": "basic-validation", "command": "jq empty *.json", "required": true }
  // Remove other strict checks temporarily
]
```

### Risk 3: Agent Confusion from Changes

**Mitigation**:
- Update AGENTS.md before deployment
- Include migration guide
- Monitor agent behavior for 48 hours
- Collect feedback from sessions

**Rollback**:
```bash
# Restore previous AGENTS.md version
git checkout v1.x.0 -- AGENTS.md
```

---

## Monitoring and Validation

### Daily Checks (Week 4)

```bash
# Check overall health
bun run scripts/monitor-activity-success.ts

# Check for errors
grep -i "error.*activity" logs/*.log | tail -20

# Check tool usage
grep "tool_call.*activity" logs/*.log | \
  awk '{print $5}' | sort | uniq -c | sort -rn
```

### Weekly Checks (Ongoing)

```bash
# Success rate trends
bun run scripts/weekly-activity-report.ts

# Variant comparison
bun run scripts/compare-template-variants.ts create-activity-template

# Cost trends
bun run scripts/analyze-cost-trends.ts --last-7-days
```

### Monthly Reviews (Ongoing)

```bash
# Full system health
bun run scripts/monthly-activity-review.ts

# Generates report with:
# - Success rates by template
# - Cost trends
# - Variant performance
# - Recommendations for evolution
```

---

## Post-Launch (Month 2-3)

### Automated Evolution Pipeline

**Goal**: System learns and improves automatically

**Components**:

1. **Failure Pattern Analysis** (Weekly)
   ```python
   # In metabob-rpc-api
   for template in templates_with_data:
       if template.executions >= 20 and template.successRate < 0.80:
           failures = get_failures(template.id)
           patterns = analyze_patterns(failures)
           suggestions = generate_optimizations(patterns)
           
           if suggestions.confidence > 0.70:
               create_evolved_variant(template, suggestions)
   ```

2. **Thompson Sampling Dashboard**
   - Visualize variant performance
   - Show sampling distributions
   - Track exploration/exploitation balance

3. **Automated Variant Pruning** (Monthly)
   ```python
   # Mark underperforming variants as deprecated
   for variant in variants:
       if variant.executions >= 50 and variant.successRate < 0.50:
           if better_variants_exist:
               mark_deprecated(variant.id)
   ```

---

## Resource Requirements

### Engineering Time

- **Week 1**: 2 engineers × 2 days = 4 engineer-days
- **Week 2**: 1 engineer × 3 days = 3 engineer-days
- **Week 3**: 1 engineer × 4 days = 4 engineer-days
- **Week 4**: 1 engineer × 2 days = 2 engineer-days

**Total**: ~13 engineer-days over 4 weeks

### Testing Resources

- Staging environment with metabob-cli MCP server
- metabob-rpc-api backend with SurrealDB
- 20+ test executions per template variant

### Monitoring Infrastructure

- Log aggregation (if not already present)
- Metrics collection scripts
- Weekly report generation

---

## Deliverables Checklist

### Week 1
- [ ] Tool visibility configuration implemented
- [ ] 8 tools hidden from agents (only 2 visible)
- [ ] activity.txt simplified to 25 lines
- [ ] search-activities.txt simplified to 25 lines
- [ ] PR merged, tests pass

### Week 2
- [ ] AGENTS.md activity section reduced to ~100 lines
- [ ] Auto-reporting implemented in TemplateExecutor
- [ ] post_activity_result tool removed
- [ ] PR merged, tests pass

### Week 3
- [ ] create-activity-template v4 created
- [ ] Validation script implemented
- [ ] 4-task structure implemented
- [ ] 10 test executions completed
- [ ] PR merged, tests pass

### Week 4
- [ ] Deployed to staging
- [ ] 48-hour monitoring completed
- [ ] 20 baseline executions collected
- [ ] v3 vs v4 comparison analyzed
- [ ] Deployed to production
- [ ] Continuous monitoring scheduled

---

## Communication Plan

### Week 1
**Audience**: Engineering team  
**Message**: "Simplifying activity tools - hiding debug tools from agents, focusing on orchestration"  
**Channel**: Team standup + Slack

### Week 2
**Audience**: Agent developers + users  
**Message**: "AGENTS.md updated - activity section now focused on usage, not implementation"  
**Channel**: Documentation update + email

### Week 3
**Audience**: QA + data science  
**Message**: "Testing improved create-activity-template v4 - need 20 test executions"  
**Channel**: Testing channel + data science sync

### Week 4
**Audience**: All stakeholders  
**Message**: "Activity system improvements deployed - monitoring success rates for next 3 months"  
**Channel**: All-hands + written summary

---

## Next Steps (Immediate)

1. ✅ **Review this plan** with team (30 min meeting)
2. ⏳ **Assign engineers** to Weeks 1-4 tasks
3. ⏳ **Create GitHub issues** for each deliverable
4. ⏳ **Set up project board** with 4 milestones (one per week)
5. ⏳ **Kick off Week 1** tasks (Day 1-2: Audit current state)

---

## Long-Term Vision (3-6 Months)

### Month 2-3: Data Collection

- Collect 50+ executions per template
- Collect 50+ executions per variant
- Analyze failure patterns systematically
- Identify optimization opportunities

### Month 4-5: Automated Evolution

- Weekly failure analysis pipeline
- Automated variant generation
- Thompson Sampling variant selection
- Best variants emerge naturally

### Month 6: System Maturity

- 90%+ success rates across templates
- Automated monthly variant pruning
- Self-optimizing recommendation system
- Agents focus purely on orchestration

---

## Success Indicators

### Agent Behavior (Week 1-2)

Before:
```
Agent: "Add endpoint"
Thinks: search → should I debug? → should I register custom? → check errors → execute
Tool calls: 5+
```

After:
```
Agent: "Add endpoint"  
Thinks: search → execute
Tool calls: 2
```

### Template Quality (Week 3-4)

Before:
- create-activity-template: ~65% success
- Inconsistent validation
- Schema errors common

After:
- create-activity-template v4: 80%+ success
- Comprehensive validation
- Schema errors caught early

### System Learning (Month 3-6)

Before:
- Manual evolution decisions
- Guessing what improves templates
- Slow iteration

After:
- Data-driven evolution
- Proven optimizations from failure analysis
- Rapid improvement via Thompson Sampling

---

## Files to Create/Modify

### New Files (Week 1-4)
- `src/agent/tool-registry.ts` - Tool visibility config
- `scripts/validate-activity-template.sh` - Validation script
- `scripts/monitor-activity-success.ts` - Monitoring
- `scripts/compare-template-variants.ts` - Variant comparison
- `test/session/create-activity-template-v4.test.ts` - Tests

### Modified Files (Week 1-4)
- `src/agent/agent.ts` - Use tool visibility config
- `src/tool/registry.ts` - Remove/hide tools
- `src/tool/activity.txt` - Simplify description
- `src/tool/search-activities.txt` - Simplify description
- `AGENTS.md` - Reduce activity section
- `src/session/template-executor.ts` - Auto-reporting
- `templates/built-in/create-activity-template.json` - v4 improvements

### Documentation Files (Week 1-4)
- `ACTIVITY_TOOLS_INVENTORY.md` - Current state audit
- `AGENT_BEHAVIOR_BASELINE.md` - Behavior measurements
- `ACTIVITY_IMPROVEMENTS_SUMMARY.md` - Changes summary
- `ROLLBACK_PROCEDURES.md` - If things go wrong

---

## Budget and Timeline

### Engineering Budget
- **Total**: 13 engineer-days over 4 weeks
- **Week 1**: 4 days (tool visibility + descriptions)
- **Week 2**: 3 days (AGENTS.md + auto-reporting)
- **Week 3**: 4 days (create-activity-template v4)
- **Week 4**: 2 days (deployment + monitoring)

### Calendar Timeline
- **Start**: Week of Feb 10, 2026
- **Week 1 complete**: Feb 14
- **Week 2 complete**: Feb 21
- **Week 3 complete**: Feb 28
- **Week 4 complete**: Mar 7
- **3-month review**: June 2026

### Success Validation
- **Week 4**: Initial success metrics
- **Month 2**: Thompson Sampling convergence
- **Month 3**: Variant winner determined
- **Month 6**: System-wide improvement measured

---

## Conclusion

**The plan addresses three critical issues**:

1. **Agent Distraction** → Hide 8 tools, show 2 (Week 1-2)
2. **Unclear Instructions** → Simplify to ~100 lines (Week 2)
3. **Template Quality** → Improve create-activity-template to 80%+ success (Week 3)

**The system already has the infrastructure to learn**:
- ✅ Metrics tracking (TemplateExecutor)
- ✅ Backend storage (SurrealDB)
- ✅ Thompson Sampling (recommendations)
- ✅ Evolution support (variant system)

**What's needed**: Better input data through improved templates and clearer agent focus.

**Expected outcomes**:
- Agents make faster orchestration decisions
- Templates have higher success rates
- Metabob learns more effectively
- System self-optimizes over time

**Start**: Week 1, Day 1 - Audit current state  
**Ship**: Week 4, Day 20 - Production deployment  
**Validate**: Months 2-6 - Data-driven optimization
