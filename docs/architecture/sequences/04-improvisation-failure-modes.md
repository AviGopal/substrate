# Improvisation, Failure Modes, Checkpoints, and Rollbacks

> **STATUS (2026-04-28): Renamed from `04-improvisation-trailblazing.md`.** "Trailblazing" was class-(c) terminology — never implemented and pruned from the corrected foundation model. What older versions of this doc called trailblazing is now handled by the **failure-mode taxonomy** (`verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`) plus posterior variance. Read this file for the improvisation flow (which is real and current); treat any remaining trailblazing references as historical. See [`IMPULSE_ACTIVITY_FOUNDATION.md`](../IMPULSE_ACTIVITY_FOUNDATION.md#known-gaps-system-not-yet-self-stable) → "Class-(c) Terms Pruned".

> **Status (2026-05-27):** The failure-mode taxonomy and improvisation-as-activity model are accurate. File refs (`goal-processor.ts`, `improviser.ts`, `rollback.ts`, `template-extractor.ts`) point to minibob source that has moved: improvisation and ribosome extraction now live in `goal-host-vessel` / `ias-executor-ts`; `ribosome-vessel` handles template extraction via the `lifecycle:execution:succeeded` WebSocket subscription. The `GoalProcessor` / `ActivityExecutor` participant labels should be read as `GoalHost (goal-host-vessel)`.

## Overview

This document maps the complete flow of how MiniBob handles situations when no activity template matches (improvisation), learns from failures (trailblazing), and manages execution safety (checkpoints and rollbacks). These mechanisms enable continuous learning and autonomous adaptation.

**Key Insight:** Improvisation is not a fallback mode - it's an activity template like any other. The `improvise_solution` activity uses LLM-directed tool use to explore solutions, and the ribosome resolver extracts successful improvisations into reusable templates.

## Key Concepts

1. **Improvisation as an Activity** - `improvise_solution` template with plan → execute → extract tasks
2. **Trailblazing** - Creating variant templates from failed executions
3. **Checkpoints** - Git state capture before execution for rollback capability
4. **Rollbacks** - Restoring pre-execution state after failures
5. **Ribosome Resolver** - Task 3 of `improvise_solution` that extracts successful patterns into templates
6. **Thompson Sampling Learning** - Updating α/β scores based on execution outcomes
7. **Stuck Detection** - Identifying when improvisation is making no progress

## Main Sequence Diagram: Goal Processing via Activity Composition

```mermaid
sequenceDiagram
    participant User as User/CLI
    participant GP as GoalProcessor<br/>(goal-processor.ts)
    participant BE as Backend<br/>(Thompson Sampling)
    participant Exec as ActivityExecutor<br/>(activity.ts)
    participant Ribosome as RibosomeResolver<br/>(resolvers/ribosome.ts)
    participant MCP as MCP Client

    User->>GP: processGoal(message)
    activate GP

    Note over GP: 1. ENRICHMENT PHASE
    GP->>GP: enrichGoal(message)
    Note over GP: LLM semantic analysis<br/>category, intent, capabilities

    Note over GP: 2. ACTIVITY RECOMMENDATION
    GP->>BE: recommendActivities(goal)
    Note over BE: Thompson Sampling<br/>selects by α, β scores
    BE-->>GP: [ActivityRecommendation]

    alt Recommendations Found (score >= 0.7)
        Note over GP: 3a. EXECUTE RECOMMENDED ACTIVITY
        loop For each recommendation until success
            GP->>Exec: execute(template)
            Exec-->>GP: ActivityExecution

            GP->>GP: verifyGoal()
            alt Goal Achieved
                Note over GP: ✓ SUCCESS
            else Goal Not Achieved
                Note over GP: Continue to next template
            end
        end
    else No Recommendations OR All Failed
        Note over GP: 3b. EXECUTE IMPROVISE_SOLUTION ACTIVITY
        GP->>Exec: execute("improvise_solution", goal)

        Note over Exec: Task 1: plan_approach
        Exec->>Exec: LLM plans solution steps

        Note over Exec: Task 2: execute_plan
        Exec->>Exec: LLM + tools execute plan

        alt Improvisation Succeeded
            Note over Exec: Task 3: extract_template
            Exec->>Ribosome: extract(execution_trace)
            Ribosome->>Ribosome: shouldExtractTemplate()
            alt Extraction Criteria Met
                Ribosome->>Ribosome: assembleTemplate()
                Ribosome->>MCP: registerTemplate()
                Note over MCP: New template available<br/>for Thompson Sampling
            end
        end

        Exec-->>GP: ActivityExecution
    end

    Note over GP: 4. RETURN RESULT
    GP-->>User: GoalResult
    deactivate GP
```

**Implementation:** `repos/minibob/src/goal-processor.ts:650-6800+`

## Improvisation as an Activity

Improvisation is no longer a special "fallback mode" - it's a first-class activity template that gets composed like any other.

### The `improvise_solution` Activity Template

```typescript
{
  id: "improvise_solution",
  name: "Improvise Solution via LLM Tool Use",
  category: "tool",
  tasks: [
    {
      id: "plan_approach",
      description: "Analyze the goal and plan a solution approach",
      prompt: {
        template: `Given this goal: {{goalDescription}}

Analyze the requirements and create a step-by-step plan to achieve it.
Consider available tools: bash, read, write, edit, glob, grep.

Identify:
1. What information you need to gather
2. What changes you need to make
3. How to verify success`,
        variables: [
          { name: "goalDescription", type: "string", required: true }
        ]
      }
    },
    {
      id: "execute_plan",
      description: "Execute the planned solution using available tools",
      prompt: {
        template: `Execute your plan from the previous task.

Use available tools to:
- Read files (read, grep)
- Modify code (edit, write)
- Run commands (bash)
- Verify changes (bash tests)

Track your progress after each step. If stuck, try a different approach.`,
        variables: []
      },
      validation: {
        maxSteps: 50,
        maxCost: 5.00,
        stuckDetection: true
      }
    },
    {
      id: "extract_template",
      description: "Extract successful execution into reusable template",
      resolver: "ribosome",
      condition: "execution.status === 'completed' && execution.tasks.length >= 2"
    }
  ],
  inputSchema: {
    required: [
      { shape: "goal_description", budget: 500 }
    ],
    optional: [
      { shape: "context_files", budget: 2000 },
      { shape: "previous_attempts", budget: 1000 }
    ]
  },
  outputSchema: {
    produces: [
      { shape: "execution_trace" },
      { shape: "activity_template", condition: "ribosome_extraction" }
    ]
  },
  metadata: {
    author: "system",
    category: "improvisation",
    thompsonParams: { alpha: 1, beta: 1 }
  }
}
```

### How It Works

1. **Goal processor selects activity**: Thompson Sampling returns `improvise_solution` when no domain-specific template matches
2. **Task 1 - Plan**: LLM analyzes the goal and creates a solution plan
3. **Task 2 - Execute**: LLM uses tools (bash, read, write, edit) to execute the plan
   - Step limit: 50 steps max
   - Cost limit: $5.00 max
   - Stuck detection: Break if same action repeated 3x
4. **Task 3 - Extract**: Ribosome resolver checks if extraction criteria met
   - If yes: Creates new activity template from execution
   - If no: Execution completes without extraction

### Key Difference from Old "Fallback" Model

**Before (fallback improvisation):**
```
Activity failed → Exit activity system → Enter improvisation mode → Ad-hoc LLM loop
```

**Now (activity composition):**
```
Activity failed → Execute improvise_solution activity → Tasks with validation
```

All workflows go through the activity composition system. Improvisation is just another activity.

## Decomposition: Activity Matching → Improvisation Selection

```mermaid
sequenceDiagram
    participant GP as GoalProcessor
    participant MCPc as MCP Client
    participant BE as Backend
    participant Exec as ActivityExecutor
    participant LLM as LLM (Claude)

    Note over GP: Activity Recommendation Phase

    GP->>MCPc: recommendActivities(goal, category, limit=5)
    Note over MCPc: Build request to backend

    MCPc->>BE: POST /v2/activities/recommend
    activate BE

    Note over BE: Thompson Sampling Engine
    Note over BE: 1. Query similar templates<br/>2. Compute scores: score = beta(α, β)<br/>3. Sort by score<br/>4. Return top-N

    alt Domain-Specific Templates Found
        Note over BE: Filter by category, keywords<br/>Check success rate
        BE-->>MCPc: [template1, template2, ...] + improvise_solution
        Note over MCPc: Sorted by Thompson score
    else No Domain Templates
        Note over BE: Only return improvise_solution
        BE-->>MCPc: [improvise_solution]
    end
    deactivate BE

    MCPc-->>GP: recommendations

    alt Recommendations Include Domain Template (score >= 0.7)
        Note over GP: EXECUTE DOMAIN TEMPLATE
        GP->>Exec: execute(domain_template)

        Exec->>Exec: executeTaskSequence()
        Exec-->>GP: result

        alt Result Success
            Note over GP: ✓ GOAL ACHIEVED
        else Result Failed OR Verification Failed
            Note over GP: Next recommendation<br/>(may be improvise_solution)
            GP->>Exec: execute(next_template)
        end
    else Only improvise_solution Returned
        Note over GP: EXECUTE IMPROVISATION ACTIVITY
        GP->>Exec: execute(improvise_solution)
        Note over Exec: Task sequence:<br/>1. plan_approach<br/>2. execute_plan<br/>3. extract_template
    end
```

**Selection Logic:**
- Thompson Sampling ranks ALL templates (including `improvise_solution`)
- Domain-specific templates rank higher if they have good success history
- `improvise_solution` ranks higher when:
  - No domain templates exist
  - Domain templates have low success rates
  - Goal is novel/exploratory

## Decomposition: Improvise Solution Activity Execution

```mermaid
sequenceDiagram
    participant Exec as ActivityExecutor
    participant LLM as LLM (Claude)
    participant Tools as Tool Handlers<br/>(bash, read, write, etc)
    participant State as State Tracker<br/>(impulses_loaded,<br/>impulses_created)
    participant Ribosome as RibosomeResolver

    Note over Exec: EXECUTE: improvise_solution

    Note over Exec: TASK 1: plan_approach
    Exec->>Exec: captureStateSnapshot()
    Note over Exec: Pre-execution checkpoint

    Exec->>LLM: executeTask("plan_approach", {goalDescription})
    activate LLM
    Note over LLM: Analyze goal<br/>Identify requirements<br/>Create step-by-step plan
    LLM-->>Exec: Plan {steps, approach, tools_needed}
    deactivate LLM

    Note over Exec: TASK 2: execute_plan

    loop For each planned step (max 50)
        Exec->>LLM: sendMessage(goal, context, plan, tools_list)
        Note over LLM: Available tools:<br/>- bash: Run commands<br/>- read: Read files<br/>- write: Create files<br/>- edit: Modify files<br/>- glob: Find files<br/>- grep: Search content

        activate LLM
        LLM->>LLM: reason(goal, plan, progress)
        Note over LLM: Step {n}:<br/>Thought: "..."<br/>Action: tool_name<br/>Parameters: {...}
        LLM-->>Exec: ToolCall
        deactivate LLM

        Exec->>Tools: execute(action, params)
        activate Tools

        alt action === "read"
            Tools->>Tools: readFile(path)
            Tools->>State: recordImpulseLoad(path, "source_code")
            Note over State: Track shape + tokens
        else action === "write"
            Tools->>Tools: writeFile(path, content)
            Tools->>State: recordImpulseCreate(path, inferred_shape)
        else action === "bash"
            Tools->>Tools: execSync(command)
            Tools->>State: recordImpulseLoad(pattern, "bash_output")
        end

        Tools-->>Exec: ToolResult
        deactivate Tools

        Exec->>Exec: recordStep({<br/>  step: n<br/>  thought: "..."<br/>  action: "..."<br/>  result: {...}<br/>  duration_ms<br/>  cost_estimate<br/>})

        Exec->>LLM: sendToolResult(result)

        Exec->>Exec: verifyGoalAchieved()?
        alt Goal Achieved
            Note over Exec: ✓ Break loop
            break Goal Complete
        else Stuck Detection
            Exec->>Exec: isStuck()
            Note over Exec: Same action repeated 3x?
            alt Stuck
                Note over Exec: ✗ Break loop
                break Exit: Stuck
            end
        else Max Steps/Cost Reached
            alt steps >= 50 OR cost >= $5.00
                Note over Exec: ✗ Break loop
                break Exit: Limits
            end
        end
    end

    Note over Exec: TASK 3: extract_template

    Exec->>Ribosome: resolve("ribosome", execution_trace)
    activate Ribosome

    Ribosome->>Ribosome: shouldExtractTemplate(trace)
    Note over Ribosome: Check criteria:<br/>1. status === "completed"<br/>2. tasks.length >= 2<br/>3. cost < $1.00<br/>4. impulses <= 10<br/>5. depth === 0

    alt Criteria Met
        Ribosome->>Ribosome: assembleTemplate(trace)
        Note over Ribosome: Extract:<br/>- Input schema from impulses_loaded<br/>- Output schema from impulses_created<br/>- Tasks from step sequences<br/>- Variables from patterns

        Ribosome->>Ribosome: registerTemplate(template)
        Note over Ribosome: Store in backend<br/>Thompson params: α=1, β=1

        Ribosome-->>Exec: {template_id, registered: true}
    else Criteria Not Met
        Note over Ribosome: Skip extraction
        Ribosome-->>Exec: {registered: false}
    end
    deactivate Ribosome

    Exec->>Exec: computeOutcome()
    Note over Exec: Execution complete<br/>Template may be available
```

**Implementation:**
- Activity executor: `repos/minibob/src/activity.ts`
- Ribosome resolver: `repos/minibob/src/resolvers/ribosome.ts`
- State tracking: `repos/minibob/src/improviser.ts:256-299`

## Decomposition: Ribosome Resolver (Template Extraction)

The ribosome resolver is invoked as Task 3 of the `improvise_solution` activity.

```mermaid
sequenceDiagram
    participant Exec as ActivityExecutor
    participant Ribosome as RibosomeResolver
    participant Analyzer as Quality<br/>Analyzer
    participant Extractor as Template<br/>Extractor
    participant BE as Backend

    Note over Exec: Task 3: extract_template

    Exec->>Ribosome: resolve("ribosome", {execution_trace})
    activate Ribosome

    Note over Ribosome: PHASE 1: QUALITY CHECK

    Ribosome->>Analyzer: shouldExtractTemplate(trace)
    activate Analyzer

    Note over Analyzer: Check criteria:<br/>1. status === "completed"<br/>2. tasks.length >= 2<br/>3. cost < $1.00<br/>4. impulses <= 10<br/>5. depth === 0 (top-level)<br/>6. No critical errors

    alt Criteria Met
        Analyzer-->>Ribosome: true
    else Criteria Not Met
        Analyzer-->>Ribosome: false
        Note over Ribosome: ✗ Skip extraction
        Ribosome-->>Exec: {registered: false}
    end
    deactivate Analyzer

    alt Extract Template
        Note over Ribosome: PHASE 2: TASK IDENTIFICATION

        Ribosome->>Extractor: identifyTaskBoundaries(steps)
        activate Extractor

        Note over Extractor: Group steps into tasks:<br/>- Boundaries on action changes<br/>- Group size >= 5 steps<br/>- Logical phase transitions

        Extractor-->>Ribosome: taskGroups[][]
        deactivate Extractor

        Note over Ribosome: PHASE 3: SCHEMA EXTRACTION

        Ribosome->>Extractor: extractInputSchema(trace)
        activate Extractor
        Note over Extractor: From impulses_loaded:<br/>- Shape names<br/>- Format requirements<br/>- Budget estimates
        Extractor-->>Ribosome: InputSchema {<br/>  required: [{shape}]<br/>  optional: [{shape}]<br/>}
        deactivate Extractor

        Ribosome->>Extractor: extractOutputSchema(trace)
        activate Extractor
        Note over Extractor: From impulses_created:<br/>- Produced shapes<br/>- Success indicators
        Extractor-->>Ribosome: OutputSchema {<br/>  produces: [{shape}]<br/>}
        deactivate Extractor

        Note over Ribosome: PHASE 4: TEMPLATE ASSEMBLY

        loop For each task group
            Ribosome->>Extractor: summarizeTaskGroup(group)
            activate Extractor
            Note over Extractor: Create description<br/>from steps
            Extractor-->>Ribosome: taskDescription
            deactivate Extractor

            Ribosome->>Extractor: extractPromptPattern(group)
            activate Extractor
            Note over Extractor: Convert to LLM prompt<br/>with {{variables}}
            Extractor-->>Ribosome: promptTemplate
            deactivate Extractor

            Ribosome->>Extractor: identifyVariables(group)
            activate Extractor
            Note over Extractor: Find parameterizable:<br/>- File paths<br/>- Patterns<br/>- Thresholds
            Extractor-->>Ribosome: Variable[]
            deactivate Extractor
        end

        Ribosome->>Ribosome: assembleTemplate(tasks, schemas)
        Note over Ribosome: Create ActivityTemplate:<br/>- name from goal<br/>- category from outcome<br/>- tasks with prompts<br/>- inputSchema<br/>- outputSchema<br/>- metadata

        Note over Ribosome: PHASE 5: VALIDATION

        Ribosome->>Ribosome: assertValidTemplate(template)
        Note over Ribosome: Verify structure,<br/>camelCase, unique IDs

        Note over Ribosome: PHASE 6: REGISTRATION

        Ribosome->>BE: POST /v2/activities/templates
        activate BE

        Note over BE: 1. Validate template<br/>2. Generate template_id<br/>3. Store in SurrealDB<br/>4. Initialize Thompson:<br/>   alpha = 1<br/>   beta = 1

        BE-->>Ribosome: registered_template_id
        deactivate BE

        Ribosome-->>Exec: {<br/>  template_id<br/>  registered: true<br/>  name<br/>}
    end
    deactivate Ribosome

    Note over Exec: ✓ Template available<br/>for future recommendations
```

**Ribosome Extraction Criteria:**
- Status: `completed` (successful execution)
- Minimum complexity: `tasks >= 2`
- Maximum cost: `< $1.00`
- Impulse count: `<= 10`
- Depth: `0` (top-level, not nested)
- No critical errors in execution

**Extracted Template Structure:**
```typescript
{
  id: "tpl_{timestamp}_{randomId}"
  name: Capitalized goal
  category: Inferred from goal/outcome
  tasks: [{ id, description, prompt, validation }]
  inputSchema: { required, optional }
  outputSchema: { produces }
  metadata: {
    generatedFrom: "execution"
    sourceExecutionId: trace.execution_id
    author: "ribosome"
    inputSchemaInferredFrom: {
      executionId
      confidence
      impulseCount
    }
  }
}
```

**Implementation:** `repos/minibob/src/template-extractor.ts:24-400+`, `repos/minibob/src/ribosome-quality.ts:103-142+`

## Decomposition: Checkpoint Creation Before Execution

```mermaid
sequenceDiagram
    participant Exec as ActivityExecutor
    participant Git as Git
    participant FS as Filesystem
    participant State as RollbackState
    participant Exec2 as Execution<br/>Engine

    Note over Exec: PRE-EXECUTION PHASE

    Exec->>Git: captureGitState()
    activate Git
    Note over Git: Extract:<br/>- git rev-parse HEAD<br/>- git status<br/>- git diff HEAD
    Git-->>Exec: GitState {<br/>  HEAD: "abc123"<br/>  isDirty: boolean<br/>  changes: string<br/>}
    deactivate Git

    Exec->>FS: listTrackedFiles()
    Note over FS: Find all relevant files:<br/>- src/**/*.ts<br/>- tests/**/*.ts<br/>- package.json<br/>- tsconfig.json
    FS-->>Exec: trackedFiles[]

    Exec->>Exec: captureRollbackState(activityId, trackedFiles)
    activate Exec
    Note over Exec: For each tracked file:<br/>1. Read content<br/>2. Compute hash<br/>3. Store in RollbackState
    Exec-->>Exec: RollbackState {<br/>  activityId<br/>  executionId<br/>  fileBefore: Map<path → hash><br/>  gitCommit: "abc123"<br/>  capturedAt: timestamp<br/>}
    deactivate Exec

    Exec->>State: saveCheckpoint(rollbackState)
    Note over State: Persist checkpoint to:<br/>- Memory (for this session)<br/>- Backend (as impulse)<br/>- Local cache

    Note over Exec: ✓ CHECKPOINT READY
    Note over Exec: If execution fails,<br/>rollback can restore to<br/>this exact state

    Exec->>Exec2: execute(template, impulses)
    Note over Exec2: EXECUTION STARTS<br/>Checkpoint is active
```

**Checkpoint Structure:**
```typescript
{
  activityId: string
  executionId: string
  fileBefore: Map<string, string>  // path → hash
  workingDirectory: string
  gitCommit?: string
  capturedAt: number
}
```

**Implementation:** `repos/minibob/src/rollback.ts:79-250+`

## Decomposition: Trailblazing (Failure → Variant Creation)

Trailblazing works the same whether the failed activity is domain-specific or `improvise_solution`.

```mermaid
sequenceDiagram
    participant Exec as ActivityExecutor
    participant Template as Template<br/>Manager
    participant LLM as LLM
    participant BE as Backend
    participant Git as Git Rollback

    Note over Exec: EXECUTION COMPLETED (FAILED)

    Exec->>Exec: detectFailure(execution)
    Note over Exec: Check:<br/>- status === "failed"<br/>- exitCode !== 0<br/>- stdout contains "error"<br/>- stderr non-empty

    alt Failure Detected
        Exec->>Exec: analyzeFailure()
        Note over Exec: Extract:<br/>- errorType: "type_error"|"runtime"|"timeout"<br/>- errorLine: line number<br/>- context: surrounding code<br/>- attempted: what was tried

        Exec->>Template: getOriginalTemplate(templateId)
        Template-->>Exec: ActivityTemplate

        Note over Exec: VARIANT CREATION
        Note over Exec: Create variant of failed template<br/>with adjusted logic

        Exec->>LLM: createVariant(template, failure)
        activate LLM
        Note over LLM: Analyze failure<br/>Suggest modifications:<br/>- Different approach<br/>- Better error handling<br/>- Additional checks<br/>- Alternative tools
        LLM-->>Exec: VariantTemplate
        deactivate LLM

        Exec->>Template: generateVariantId(templateId)
        Note over Template: variant_id format:<br/>"{templateId}:variant-{hashOfChanges}"<br/>Example: "improvise_solution:variant-7f4a9e"
        Template-->>Exec: variantId

        Note over Exec: VARIANT REGISTRATION
        Exec->>BE: registerTemplate(variantTemplate)
        Note over BE: Store variant with:<br/>- name: original_name + " (variant)"<br/>- family: original_id<br/>- tags: ["variant", "trailblazing"]<br/>- alpha: 1<br/>- beta: 1<br/>(Fresh start for Thompson Sampling)
        BE-->>Exec: variant_template_id

        Note over Exec: NEXT ITERATION
        Note over Exec: Goal processor can now<br/>recommend variant on retry<br/>(Thompson Sampling will learn)

        Exec-->>Exec: failureResult {<br/>  originalTemplate: template_id<br/>  variantCreated: variant_id<br/>  reason: "..."<br/>  suggestion: "Retry with variant"<br/>}
    else Success (No failure)
        Note over Exec: ✓ Proceed normally
    end
```

**Trailblazing Decision Flow:**
1. Failed execution detected (any activity, including `improvise_solution`)
2. Failure analysis performed
3. LLM generates variant with modifications
4. Variant registered with fresh Thompson scores
5. Variant becomes available for recommendation
6. Thompson Sampling learns variant effectiveness over time

**Implementation:** `repos/minibob/src/activity.ts` (trailblazing logic)

## Decomposition: Execution Rollback (Git Restore)

```mermaid
sequenceDiagram
    participant Exec as ActivityExecutor
    participant RB as Rollback Engine
    participant Git as Git
    participant FS as Filesystem
    participant Verify as Verifier

    Note over Exec: ROLLBACK TRIGGERED
    Note over Exec: Previous execution failed<br/>State checkpoint exists

    Exec->>RB: executeRollback(rollbackState, strategy="git_restore")
    activate RB

    Note over RB: PHASE 1: IDENTIFY FILES
    RB->>RB: extractFilesToRestore(rollbackState)
    Note over RB: Files from rollbackState.fileBefore:<br/>- src/index.ts<br/>- src/types.ts<br/>- tests/index.test.ts<br/>etc.
    RB-->>RB: filesToRestore[]

    Note over RB: PHASE 2: GIT RESTORE
    RB->>Git: getGitCommit()
    Note over Git: Read from rollbackState.gitCommit<br/>(e.g., "abc123def")
    Git-->>RB: commitHash

    loop For each file to restore
        RB->>Git: git checkout {commit} -- {file}
        activate Git
        Note over Git: Restore file to exact<br/>pre-execution state
        Git-->>RB: success | error
        deactivate Git

        alt Success
            RB->>RB: filesRestored.push(file)
        else Failure
            RB->>RB: filesNotRestored.push(file)
            Note over RB: Track failed restores<br/>for diagnosis
        end
    end

    Note over RB: PHASE 3: VERIFICATION
    RB->>Verify: verifyRestoration(filesRestored)
    activate Verify

    loop For each restored file
        Verify->>FS: stat(file)
        FS-->>Verify: fileStats

        Verify->>RB: getOriginalHash(file)
        Note over RB: From rollbackState.fileBefore
        RB-->>Verify: expectedHash

        Verify->>FS: computeHash(file)
        FS-->>Verify: actualHash

        alt Hash Matches
            Note over Verify: ✓ File restored correctly
        else Hash Mismatch
            Note over Verify: ✗ Restoration incomplete
            Verify->>Verify: verificationPassed = false
        end
    end

    Verify-->>RB: verificationPassed
    deactivate Verify

    RB-->>Exec: RollbackResult {<br/>  success: boolean<br/>  filesRestored: string[]<br/>  filesNotRestored: string[]<br/>  verificationPassed: boolean<br/>  error?: string<br/>}
    deactivate RB

    Note over Exec: DECISION
    alt Rollback Successful
        Note over Exec: ✓ Workspace clean<br/>Ready for new attempt
    else Rollback Failed
        Note over Exec: ✗ WARNING: Manual cleanup needed<br/>Some files not restored
    end
```

**Rollback Strategies:**
- **git_restore** (primary): `git checkout {commit} -- {file}`
- **file_restore** (fallback): Direct file content restoration from captured state

**Implementation:** `repos/minibob/src/rollback.ts:79-250+`

## Complete Learning Loop Diagram

```mermaid
graph TB
    Start([User Goal]) -->|Enrich| A["1. Goal Enrichment<br/>(LLM semantic analysis)"]

    A -->|Recommend| B["2. Thompson Sampling<br/>(all templates ranked)"]

    B -->|Select| C{"Best Template?"}

    C -->|Domain Template| D["3a. Execute Domain Activity<br/>(specialized template)"]
    C -->|improvise_solution| E["3b. Execute Improvisation Activity<br/>(plan → execute → extract)"]

    D -->|Execute| F["4. Activity Loop<br/>(template tasks)"]
    E -->|Execute| G["4. Improvisation Tasks<br/>(LLM + tools)"]

    F -->|Verify| H{"Goal Achieved?"}
    G -->|Verify| H

    H -->|No| I{"Max Attempts?"}
    H -->|Yes| J["5. SUCCESS"]

    I -->|No| K["6. Retry Logic<br/>(try next template or variant)"]
    I -->|Yes| L["5. FAILURE<br/>(max retries)"]

    K -->|Loop| B

    J -->|Check| M{"Ribosome Criteria?<br/>(if improvise_solution)"}
    M -->|Yes| N["7a. Template Extraction<br/>(ribosome resolver)"]
    M -->|No| O["7a. Store Trace Only"]

    L -->|Analyze| P["7b. Failure Analysis<br/>(create variant template)"]

    N -->|Register| Q["8. Backend Learning<br/>(Thompson Sampling)"]
    O -->|Store| Q
    P -->|Register| Q

    Q -->|Store| R["9. Trace + Pattern Storage<br/>(future recommendations)"]

    R -->|Complete| S([Loop: Next Goal])

    style Start fill:#90EE90
    style J fill:#87CEEB
    style L fill:#FFB6C6
    style Q fill:#FFD700
    style S fill:#90EE90
```

## The Unified Activity Pathway

**All workflows go through activity composition. There is no separate "improvisation mode."**

| Scenario | Template Selected | Tasks Executed | Extraction |
|----------|-------------------|----------------|------------|
| **Domain-specific goal with matching template** | `fix_typescript_error` | Domain-specific tasks | No (domain template already exists) |
| **Novel goal, no matches** | `improvise_solution` | 1. plan_approach<br/>2. execute_plan<br/>3. extract_template | Yes (if criteria met) |
| **Template failed, retry** | Variant of original template | Modified tasks | No (variant already exists) |
| **Improvisation failed** | Variant of `improvise_solution` | Modified plan/execution | Yes (if variant succeeds) |

**Key Points:**
- No distinction between "activity execution" and "improvisation" in the execution engine
- `improvise_solution` is ranked alongside other templates via Thompson Sampling
- Ribosome extraction is a resolver task, not external post-processing
- All executions (domain or improvisation) produce traces for learning
- Variants can be created for any activity, including `improvise_solution`

## Key Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `RELEVANCE_THRESHOLD` | 0.7 | Minimum score to prefer domain template over improvise_solution |
| `MAX_IMPROVISATION_STEPS` | 50 | Step limit for execute_plan task |
| `MAX_IMPROVISATION_COST` | $5.00 | Cost limit for execute_plan task |
| `RIBOSOME_MIN_TASKS` | 2 | Minimum tasks for template extraction |
| `RIBOSOME_MAX_COST` | $1.00 | Maximum cost for template extraction |
| `RIBOSOME_MAX_IMPULSES` | 10 | Maximum impulses for extraction |

## File References

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Goal Processor | `repos/minibob/src/goal-processor.ts` | 650-6800+ | Complete goal processing flow |
| Activity Executor | `repos/minibob/src/activity.ts` | 100-2000+ | Task execution and composition |
| Improvisation Tasks | `repos/minibob/src/improviser.ts` | 125-1650+ | LLM tool use for execute_plan |
| Ribosome Resolver | `repos/minibob/src/template-extractor.ts` | 24-400+ | Template extraction from traces |
| Ribosome Quality | `repos/minibob/src/ribosome-quality.ts` | 103-142+ | Extraction criteria |
| Rollback | `repos/minibob/src/rollback.ts` | 79-250+ | Checkpoint and restore |
| Checkpoint | `repos/minibob/src/activity.ts` | 455-610+ | Git state capture |

## Implementation Architecture

This sequence spans **both MiniBob (execution) and activity-api (storage/learning)**.

### MiniBob (Execution Environment)

**Responsibilities:**
- Execute `improvise_solution` activity (plan → execute → extract tasks)
- LLM-driven improvisation (tool use loop with stuck detection)
- Checkpoint creation (git state capture before execution)
- Rollback execution (git restore to pre-execution state)
- Ribosome extraction criteria evaluation
- Template assembly from successful executions
- Variant creation on failures (trailblazing)

**Key Files:**
- `repos/minibob/src/goal-processor.ts` (650-6800+) - Meta-activity orchestration
- `repos/minibob/src/improviser.ts` (125-1650+) - Improvisation activity implementation
- `repos/minibob/src/template-extractor.ts` (24-400+) - Ribosome template assembly
- `repos/minibob/src/ribosome-quality.ts` (103-142+) - Extraction criteria
- `repos/minibob/src/rollback.ts` (79-250+) - Checkpoint and rollback logic

**What MiniBob Does NOT Do:**
- Does NOT store templates (backend owns template registry)
- Does NOT compute variant performance (backend tracks Thompson scores)
- Does NOT aggregate extraction patterns (backend learns)

### Activity-API (Storage & Learning Backend)

**Responsibilities:**
- Store `improvise_solution` template and variants
- Thompson Sampling for improvisation vs domain-specific selection
- Register ribosome-extracted templates
- Track variant performance (α/β scores for variants)
- Store execution traces (success and failure)
- Compute extraction success rates

**Key Endpoints:**
- `GET /v2/activities/templates?id=improvise_solution` - Get improvisation activity template
- `POST /v2/activities/templates` - Register ribosome-extracted templates
- `POST /v2/activities/templates` - Register variant templates (trailblazing)
- `POST /v2/activities/execution-traces` - Store improvisation traces
- `POST /v2/activities/recommend` - Thompson Sampling (includes improvise_solution)

**Key Files:**
- `repos/metabob-activity-api/src/routes/activities.ts` - Template registration
- `repos/metabob-activity-api/src/db/paradigm.ts` - Thompson Sampling (includes improvise_solution in pool)
- `repos/metabob-activity-api/sql/seed/meta-activities/improvise_solution.json` - Template definition

### SurrealDB Schema

**Tables:**
- `activity_template` - All templates (domain + improvise_solution + variants + extracted)
- `variant_performance_metrics` - Variant success rates
- `activity_execution_trace` - Improvisation execution traces
- `checkpoint` - Git state snapshots (optional persistence)

**Indexes:**
- `activity_template` by category, family (for variant tracking)
- `variant_performance_metrics` by template_id, variant_id

### Correct Separation

**MiniBob handles (execution-time):**
- Improvisation activity execution (plan, execute, extract tasks)
- LLM tool use loop with stuck detection
- Checkpoint creation (git state capture)
- Rollback execution (git restore)
- Ribosome extraction logic (template assembly)
- Variant creation (modified template generation)

**Activity-API handles (storage/learning):**
- Template storage (improvise_solution, extracted, variants)
- Thompson Sampling (ranks improvise_solution alongside domain templates)
- Variant performance tracking
- Execution trace persistence
- Extraction pattern learning

**Why This Separation Matters:**
- Improvisation runs locally (MiniBob can improvise offline)
- Backend learns which improvisation strategies work (Thompson Sampling)
- Extracted templates become first-class citizens (Thompson Sampling includes them)
- Variants compete with originals (Thompson Sampling selects best)

**Key Architectural Point:**
Improvisation is an **activity**, not a fallback code path. It's stored in the backend as `improvise_solution.json` and selected via Thompson Sampling like any other template.

## Related Documentation

- [Activity Selection](./01-activity-selection.md) - How templates are recommended
- [Impulse Resolution](./02-impulse-resolution.md) - Data loading during execution
- [Resolver Processing](./03-resolver-processing.md) - Tool execution mechanics
- [IMPULSE_ACTIVITY_FOUNDATION.md](../IMPULSE_ACTIVITY_FOUNDATION.md) - Foundational model

---

**Last Updated:** 2026-04-16
