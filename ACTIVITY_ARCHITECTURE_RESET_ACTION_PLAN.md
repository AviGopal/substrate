# Activity Architecture Reset - Immediate Action Plan

**Date**: March 8, 2026  
**Goal**: Remove local storage and enable progressive "cooking off" of LLM scaffolding  
**Priority**: HIGH - Blocking core development workflow  

---

## Quick Summary

**Problem**: Local storage of activity templates prevents the core use case of progressively optimizing activities from LLM-assisted → deterministic.

**Root Cause**: Commit `3f7b29b5` (Mar 2, 2026) intended to enforce backend-only storage but cleanup was never completed. Local storage directory still exists with 19 templates.

**Impact**: Cannot develop core functionality because local templates override backend optimizations.

---

## Phase 1: Remove Local Storage (START HERE - 1 Day)

### Step 1.1: Backup Current Local Templates

```bash
cd ~/.local/share/opencode/storage/

# Create backup
mkdir -p ~/activity-templates-backup-$(date +%Y%m%d)
cp -r activity-template/* ~/activity-templates-backup-$(date +%Y%m%d)/

# List what we're removing
ls -lh activity-template/
```

**Expected**: 19 templates backed up

### Step 1.2: Remove Local Storage Directory

```bash
# Remove local template storage
rm -rf ~/.local/share/opencode/storage/activity-template/

# Verify removal
ls ~/.local/share/opencode/storage/
# Expected: No activity-template/ directory
```

### Step 1.3: Verify Templates Load from Backend

```typescript
// From OpenCode session
search_activities({ verbose: true })

// Expected output:
// - Source: "metabob" (NOT "local")
// - Templates: evolve-activity-self-contained, manage-session-memory, trace-data-flow-single-feature, trace-enforce-validate-loop
// - Count: 4 (bootstrap templates only)
```

### Step 1.4: Test Template Registration

```typescript
// Create test template
register_activity_template({
  file_path: "/home/avi/documents/work/exp-repo/metabob-devbob/test-activity-validation.json",
  register_with_metabob: true
})

// Verify it's in backend only
search_activities({ verbose: true })
// Expected: activity-system-validation in list with source="metabob"

// Verify NOT in local storage
bash({ command: "ls ~/.local/share/opencode/storage/activity-template/ 2>&1" })
// Expected: "No such file or directory" or empty
```

### Step 1.5: Update TemplateLoader to Enforce Backend

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

**Change**:
```typescript
// Around line 150 (in load() function)
// BEFORE:
if (options.backend !== "metabob" && BOOTSTRAP_TEMPLATES.has(id)) {
  try {
    const template = await ActivityTemplate.load(id) // Will load from embedded source only
    // ...
  }
}

// AFTER:
// Only allow bootstrap fallback if not in production
const isProduction = process.env.NODE_ENV === "production"
const allowBootstrapFallback = !isProduction || BOOTSTRAP_TEMPLATES.has(id)

if (options.backend !== "metabob" && allowBootstrapFallback) {
  // Only load embedded bootstrap templates
  if (!BOOTSTRAP_TEMPLATES.has(id)) {
    throw new Error(
      `Template ${id} not found in backend and local storage disabled. ` +
      `Non-bootstrap templates must be loaded from backend via MCP.`
    )
  }
  
  try {
    const template = await ActivityTemplate.load(id)
    // ...
  }
}
```

### Step 1.6: Remove Local Storage Code Paths

**Files to Update**:

1. `activity-template.ts`:
   - `ActivityTemplate.save()` - Already deprecated per commit `3f7b29b5`
   - `ActivityTemplate.load()` - Only loads embedded bootstrap
   - `ActivityTemplate.list()` - Only returns bootstrap

2. `activity-template-repository.ts`:
   - `TemplateRepository.save()` - Already throws error for `backend='local'`
   - Verify `backend='all'` means `'metabob'` only

3. `register-activity-template.ts`:
   - Verify no local storage writes during validation
   - Verify backend-only saves

**Validation Command**:
```bash
cd repos/metabob-opencode

# Check for remaining local storage references
rg "Storage\.write.*activity-template|ActivityTemplate\.save\(\)" packages/opencode/src/

# Expected: Only deprecated/commented code or test files
```

---

## Phase 2: Remove Binary Classification (2 Days)

### Step 2.1: Analyze Current Template-Level executionMode Usage

```bash
cd repos/metabob-opencode

# Find templates with template-level executionMode
rg '"executionMode":\s*"(llm-assisted|deterministic)"' packages/opencode/src/session/built-in/

# Find code that checks template.executionMode
rg 'template\.executionMode|options\.executionMode' packages/opencode/src/
```

### Step 2.2: Update Schema to Deprecate Template-Level executionMode

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Change**:
```typescript
// BEFORE:
export const CreateOptions = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(["feature", "bugfix", "refactor", "tool", "infrastructure"]),
  executionMode: z.enum(["llm-assisted", "deterministic"]).optional(),  // REMOVE THIS
  tasks: z.array(TaskSchema),
  // ...
})

// AFTER:
export const CreateOptions = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(["feature", "bugfix", "refactor", "tool", "infrastructure"]),
  // executionMode removed - use task-level only
  tasks: z.array(TaskSchema),
  // ...
})

// Add deprecation warning for existing templates
.refine(
  (data) => {
    if ('executionMode' in data) {
      console.warn(`Template-level executionMode is deprecated. Use task-level executionMode instead.`)
    }
    return true
  }
)
```

### Step 2.3: Update Executor to Use Task-Level Only

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Find**:
```typescript
// Search for template.executionMode usage
const executionMode = task.executionMode || template.executionMode || "llm-assisted"
```

**Replace with**:
```typescript
// Only use task-level executionMode
const executionMode = task.executionMode || "llm-assisted"
```

### Step 2.4: Migrate Existing Templates

**Script**: Create migration script

```typescript
// migrate-templates.ts
import { TemplateServiceClient } from "../server/template-service-client"
import { ActivityTemplate } from "../session/activity-template"

async function migrateTemplates() {
  // Get all templates from backend
  const result = await TemplateServiceClient.searchTemplates({})
  
  for (const template of result.templates) {
    if (template.executionMode) {
      console.log(`Migrating template: ${template.id}`)
      
      // Apply template-level mode to all tasks that don't have one
      const updatedTasks = template.tasks.map(task => ({
        ...task,
        executionMode: task.executionMode || template.executionMode
      }))
      
      // Create new version without template-level executionMode
      const updated = {
        ...template,
        executionMode: undefined,  // Remove template-level
        tasks: updatedTasks
      }
      
      // Save updated version
      await TemplateServiceClient.registerTemplate({
        template: updated,
        overwrite: true
      })
      
      console.log(`✓ Migrated: ${template.id}`)
    }
  }
}
```

---

## Phase 3: Add Progressive Transition Support (5 Days)

### Step 3.1: Design Hybrid Execution Schema

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Add New Schemas**:
```typescript
// Optimization metadata
const OptimizationMetadataSchema = z.object({
  readiness: z.enum(["learning", "ready-for-conversion", "optimized", "stable"]),
  successRate: z.number().min(0).max(1),
  avgCost: z.number(),
  lastOptimized: z.number().optional(),
  optimizationOpportunities: z.array(z.string())
})

// Execution configuration (replaces simple executionMode)
const ExecutionConfigSchema = z.object({
  method: z.enum(["llm-assisted", "hybrid", "deterministic"]),
  deterministicSteps: z.array(z.string()).optional(),
  llmSteps: z.array(z.string()).optional(),
  optimization: OptimizationMetadataSchema.optional()
})

// Hybrid flow steps
const HybridStepSchema = z.object({
  id: z.string(),
  type: z.enum(["llm", "deterministic"]),
  config: z.union([
    PromptConfigSchema,
    z.array(ToolCallSchema)
  ])
})

const HybridFlowSchema = z.object({
  steps: z.array(HybridStepSchema)
})

// Update TaskSchema
const TaskSchema = z.object({
  id: z.string(),
  subagent: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  
  // OLD (keep for backward compatibility)
  executionMode: z.enum(["llm-assisted", "deterministic"]).optional(),
  
  // NEW (progressive transition support)
  execution: ExecutionConfigSchema.optional(),
  
  prompt: PromptConfigSchema.optional(),
  toolSequence: z.array(ToolCallSchema).optional(),
  
  // NEW (for hybrid mode)
  hybridFlow: HybridFlowSchema.optional(),
  
  validation: ValidationSchema,
  retry: RetrySchema,
  metrics: TaskMetricsSchema.optional()
})
```

### Step 3.2: Implement Hybrid Executor

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Add Function**:
```typescript
async function executeTaskHybrid(
  task: ActivityTemplate.Task,
  variables: Record<string, unknown>,
  sessionID: string,
  abortSignal: AbortSignal
): Promise<TaskExecutionResult> {
  if (!task.hybridFlow || !task.hybridFlow.steps.length) {
    throw new Error(`Task ${task.id} is hybrid but has no hybridFlow.steps defined`)
  }
  
  const stepResults: Array<{
    stepId: string
    type: "llm" | "deterministic"
    success: boolean
    output: string
    cost: number
    tokens: { input: number; output: number; cache: number }
    duration: number
  }> = []
  
  let totalCost = 0
  let totalTokens = { input: 0, output: 0, cache: 0 }
  const startTime = Date.now()
  
  // Execute steps in sequence
  for (const step of task.hybridFlow.steps) {
    const stepStart = Date.now()
    
    if (step.type === "llm") {
      // Execute as LLM task
      const promptConfig = step.config as ActivityTemplate.PromptConfig
      const result = await executeLLMStep(promptConfig, variables, sessionID, abortSignal)
      
      stepResults.push({
        stepId: step.id,
        type: "llm",
        success: result.success,
        output: result.output,
        cost: result.cost,
        tokens: result.tokens,
        duration: Date.now() - stepStart
      })
      
      totalCost += result.cost
      totalTokens.input += result.tokens.input
      totalTokens.output += result.tokens.output
      totalTokens.cache += result.tokens.cache
      
      // Fail fast on LLM error
      if (!result.success) {
        break
      }
      
      // Add output to variables for next step
      variables[`${step.id}_output`] = result.output
      
    } else {
      // Execute as deterministic task
      const toolCalls = step.config as ActivityTemplate.ToolCall[]
      const result = await executeDeterministicSteps(toolCalls, variables)
      
      stepResults.push({
        stepId: step.id,
        type: "deterministic",
        success: result.success,
        output: result.output,
        cost: 0,  // Deterministic = zero cost
        tokens: { input: 0, output: 0, cache: 0 },
        duration: Date.now() - stepStart
      })
      
      // Fail fast on deterministic error
      if (!result.success) {
        break
      }
      
      // Add output to variables for next step
      variables[`${step.id}_output`] = result.output
    }
  }
  
  const allSuccess = stepResults.every(r => r.success)
  
  return {
    success: allSuccess,
    cost: totalCost,
    tokens: totalTokens,
    duration: Date.now() - startTime,
    output: stepResults.map(r => `[${r.stepId}] ${r.output}`).join("\n\n"),
    metadata: {
      hybridExecution: true,
      steps: stepResults,
      deterministicStepsCount: stepResults.filter(r => r.type === "deterministic").length,
      llmStepsCount: stepResults.filter(r => r.type === "llm").length
    }
  }
}
```

### Step 3.3: Update Main Executor to Support Hybrid

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Update executeTemplate Function**:
```typescript
// Around line 1400 (in executeTemplate)
const executionMethod = task.execution?.method || task.executionMode || "llm-assisted"

if (executionMethod === "deterministic") {
  result = await executeTaskDeterministic(task, interpolatedVars, sessionID, abortSignal)
} else if (executionMethod === "hybrid") {
  result = await executeTaskHybrid(task, interpolatedVars, sessionID, abortSignal)
} else {
  // llm-assisted
  result = await executeTaskLLM(task, interpolatedVars, sessionID, abortSignal)
}
```

---

## Testing Strategy

### Test 1: Local Storage Removal

```bash
# Before migration
ls -lh ~/.local/share/opencode/storage/activity-template/
# Expected: 19 files

# After migration
ls ~/.local/share/opencode/storage/activity-template/
# Expected: No such file or directory

# Verify templates load from backend
bun run dev ../.. <<EOF
search_activities({ verbose: true })
EOF
# Expected: Source = "metabob"
```

### Test 2: Task-Level Classification

```typescript
// Create mixed-mode activity
const mixedTemplate = {
  name: "Mixed Mode Test",
  tasks: [
    {
      id: "build",
      executionMode: "deterministic",
      toolSequence: [{"tool": "bash", "params": {"command": "echo 'build'"}}]
    },
    {
      id: "analyze",
      executionMode: "llm-assisted",
      prompt: { template: "Analyze the build" }
    }
  ]
}

// Register and execute
register_activity_template({ ... })
activity({ templateId: "mixed-mode-test", ... })

// Verify:
// - Task 1 runs deterministic (zero cost)
// - Task 2 runs LLM (has cost)
// - Both tasks complete successfully
```

### Test 3: Hybrid Mode

```typescript
// Create hybrid activity
const hybridTemplate = {
  name: "Hybrid Mode Test",
  tasks: [{
    id: "build-and-analyze",
    execution: { method: "hybrid" },
    hybridFlow: {
      steps: [
        { id: "build", type: "deterministic", config: [...] },
        { id: "analyze", type: "llm", config: {...} }
      ]
    }
  }]
}

// Execute and verify:
// - Deterministic step runs first (zero cost)
// - LLM step runs second (has cost)
// - Output available for next step
```

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Local storage directory removed
- ✅ All templates load from backend via MCP
- ✅ New template registration goes to backend only
- ✅ No local storage fallback (except embedded bootstrap)

### Phase 2 Complete When:
- ✅ No template-level executionMode in schema
- ✅ All templates use task-level executionMode
- ✅ Executor uses task-level only
- ✅ Migration script tested on all templates

### Phase 3 Complete When:
- ✅ Hybrid execution mode works
- ✅ Optimization metadata tracked
- ✅ Pattern detection implemented
- ✅ Progressive transition demonstrated

---

## Next Steps

**Immediate** (Today):
1. Review this document
2. Execute Phase 1 steps (local storage removal)
3. Test template loading from backend

**This Week**:
4. Execute Phase 2 (remove binary classification)
5. Migrate existing templates
6. Update documentation

**Next Week**:
7. Prototype Phase 3 (hybrid mode)
8. Test progressive transition
9. Build optimization detection

**Future**:
10. Backend integration (Phase 4)
11. Optimization dashboard
12. Automated pattern detection

---

**Document Status**: ✅ READY TO EXECUTE
**Priority**: HIGH
**Estimated Time**: 1 day (Phase 1), 2 days (Phase 2), 5 days (Phase 3)
