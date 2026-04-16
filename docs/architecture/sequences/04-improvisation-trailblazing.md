# Improvisation, Trailblazing, Checkpoints, and Rollbacks

## Overview

This document maps the complete flow of how MiniBob handles situations when no activity template matches (improvisation), learns from failures (trailblazing), and manages execution safety (checkpoints and rollbacks). These mechanisms enable continuous learning and autonomous adaptation.

## Key Concepts

1. **Improvisation** - LLM-directed tool use when no template matches the goal
2. **Trailblazing** - Creating variant templates from failed executions
3. **Checkpoints** - Git state capture before execution for rollback capability
4. **Rollbacks** - Restoring pre-execution state after failures
5. **Ribosome Pattern** - Extracting successful improvisation into reusable templates
6. **Thompson Sampling Learning** - Updating α/β scores based on execution outcomes
7. **Stuck Detection** - Identifying when improvisation is making no progress

## Main Sequence Diagram: Goal Processing with Fallback

```mermaid
sequenceDiagram
    participant User as User/CLI
    participant GP as GoalProcessor<br/>(goal-processor.ts)
    participant BE as Backend<br/>(Thompson Sampling)
    participant Impr as GoalImproviser<br/>(improviser.ts)
    participant Exec as ActivityExecutor<br/>(activity.ts)
    participant Ribosome as RibosomeExtractor<br/>(template-extractor.ts)
    participant MCP as MCP Client

    User->>GP: processGoal(message)
    activate GP

    Note over GP: 1. ENRICHMENT PHASE
    GP->>GP: enrichGoal(message)
    Note over GP: LLM semantic analysis<br/>category, intent, capabilities

    Note over GP: 2. EARLY-EXIT CHECK
    GP->>GP: isSimpleGoal()?
    alt Simple Goal (read-only, exploration)
        Note over GP: Skip templates,<br/>use direct improvisation
        GP->>Impr: improviseUntilComplete()
    else Complex Goal (file_write, etc)
        Note over GP: 3. PRE-FLIGHT ANALYSIS
        GP->>GP: analyzePreFlight()
        Note over GP: Check if relevant<br/>activities exist

        alt High Confidence Match
            Note over GP: 4. ACTIVITY RECOMMENDATION
            GP->>BE: recommendActivities(goal)
            Note over BE: Thompson Sampling<br/>selects by α, β scores
            BE-->>GP: [ActivityRecommendation]

            Note over GP: 5. ACTIVITY EXECUTION
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
        else Low Confidence
            Note over GP: No relevant templates found<br/>(score < 0.7 threshold)
            GP->>Impr: improviseUntilComplete()
        end
    end

    Note over GP: 6. RETURN RESULT
    GP-->>User: GoalResult
    deactivate GP
```

**Implementation:** `repos/minibob/src/goal-processor.ts:650-6800+`

## Decomposition: Activity Matching Failure → Improvisation

```mermaid
sequenceDiagram
    participant GP as GoalProcessor
    participant MCPc as MCP Client
    participant BE as Backend
    participant Impr as GoalImproviser
    participant LLM as LLM (Claude)

    Note over GP: Activity Recommendation Phase

    GP->>MCPc: recommendActivities(goal, category, limit=3)
    Note over MCPc: Build request to backend

    MCPc->>BE: POST /v2/activities/recommend
    activate BE

    Note over BE: Thompson Sampling Engine
    Note over BE: 1. Query similar templates<br/>2. Compute scores: score = beta(α, β)<br/>3. Sort by score<br/>4. Return top-N

    alt Templates Found (score >= 0.5)
        BE-->>MCPc: ActivityRecommendation[]
        Note over MCPc: [template_id, confidence, thompson_metadata]
    else No Templates OR All Low Score
        Note over BE: No relevant templates<br/>OR best_score < minSuccessRate
        BE-->>MCPc: empty array
    end
    deactivate BE

    MCPc-->>GP: recommendations

    alt Recommendations Empty or Low Confidence
        Note over GP: NO MATCH FOUND
        Note over GP: - Check pre-flight analysis<br/>- Verify goal relevance<br/>- No suitable templates

        GP->>GP: selectImprovisationStrategy()
        Note over GP: Decision:<br/>- Goal is complex but unmatched<br/>- Use LLM-based improvisation<br/>- Record all steps for learning

        GP->>Impr: new GoalImproviser()
        Note over Impr: Initialize with:<br/>- Available tools (bash, read, write)<br/>- LLM client<br/>- Activity executor adapter

        GP->>Impr: improviseUntilComplete(goal)
        Note over Impr: START IMPROVISATION
    else Recommendations Found
        Note over GP: EXECUTE ACTIVITY
        GP->>GP: selectBestTemplate(recommendations)
    end
```

**Failure Reasons Triggering Improvisation:**
- `recommendations.length === 0`
- `bestScore < RELEVANCE_THRESHOLD (0.7)`
- `bestScore < minSuccessRate (0.5)`
- Backend unavailable → fallback to local goal resolver

## Decomposition: LLM-Based Improvisation Loop

```mermaid
sequenceDiagram
    participant Impr as GoalImproviser
    participant LLM as LLM (Claude)
    participant Tools as Tool Handlers<br/>(bash, read, write, etc)
    participant FS as Filesystem
    participant State as State Tracker<br/>(impulses_loaded,<br/>impulses_created)

    Impr->>Impr: resetImpulseTracking()
    Note over Impr: Clear impulse state

    Impr->>Impr: captureStateSnapshot()
    Note over Impr: Capture pre-improvisation state:<br/>- File metadata<br/>- Git HEAD<br/>- Working directory structure

    loop For each step (max 50)
        Note over Impr: STEP N: Tool Selection & Execution

        Impr->>LLM: sendMessage(goal, context, tools_list)
        Note over LLM: Available tools:<br/>- bash: Run commands<br/>- read: Read files<br/>- write: Create files<br/>- edit: Modify files<br/>- glob: Find files<br/>- grep: Search content<br/>- activity: Call other activities

        activate LLM
        LLM->>LLM: reason(goal, context)
        Note over LLM: Step {n}:<br/>Thought: "..."<br/>Action: tool_name<br/>Parameters: {...}
        LLM-->>Impr: ToolCall
        deactivate LLM

        Impr->>Impr: recordThought(thought)
        Note over Impr: impulses_loaded,<br/>impulses_created tracking

        Impr->>Tools: execute(action, params)
        activate Tools

        alt action === "read"
            Tools->>FS: readFile(path)
            FS-->>Tools: content
            Tools->>State: recordImpulseLoad(path, "source_code")
            Note over State: Track shape + tokens
        else action === "write"
            Tools->>FS: writeFile(path, content)
            FS-->>Tools: success
            Tools->>State: recordImpulseCreate(path, inferred_shape)
            Note over State: Infer shape from filename
        else action === "bash"
            Tools->>FS: execSync(command)
            FS-->>Tools: stdout, stderr
            Tools->>State: recordImpulseLoad(pattern, "bash_output")
        else action === "activity"
            Tools->>Tools: loadActivityTemplate(id)
            Tools->>Tools: executor.execute(template)
            Note over Tools: Nested activity execution
        end

        Tools-->>Impr: ToolResult
        deactivate Tools

        Impr->>Impr: recordStep({<br/>  step: n<br/>  thought: "..."<br/>  action: "..."<br/>  result: {...}<br/>  duration_ms<br/>  cost_estimate<br/>  expected_output_shape<br/>  step_purpose<br/>})

        Impr->>LLM: sendToolResult(result)
        Note over LLM: Feedback to LLM

        Impr->>Impr: verifyGoalAchieved(goal)?
        alt Goal Achieved
            Note over Impr: ✓ Break loop
            break Goal Complete
        else Stuck Detection
            Impr->>Impr: isStuck()
            Note over Impr: Same action repeated 3x?
            alt Stuck
                Note over Impr: ✗ Break loop
                break Exit: Stuck
            end
        else Max Steps Reached
            alt steps >= maxSteps
                Note over Impr: ✗ Break loop
                break Exit: Max steps
            end
        end
    end

    Note over Impr: OUTCOME COMPUTATION
    Impr->>Impr: computeOutcome()
    Note over Impr: status: "success"|"failure"|"stuck"<br/>goal_achieved: boolean<br/>total_duration_ms<br/>total_cost<br/>total_tokens<br/>files_modified<br/>files_created<br/>files_deleted<br/>error?

    Impr->>Impr: computeStateDelta(before, after)
    Note over Impr: Files changed?<br/>Git commit changes?<br/>State transition metadata
```

**Implementation:** `repos/minibob/src/improviser.ts:125-1650+`

**Key Mechanisms:**
1. **Impulse Tracking** (lines 256-299): Every read/write tracked with shape inference
2. **State Snapshot** (lines 401-489): Captures pre-improvisation state
3. **Step Limits** (line 90): maxSteps=50 prevents infinite loops
4. **Stuck Detection** (line 90): Repeated actions detected
5. **Shape Inference** (line 1647): inferShapeFromPath() for output shapes

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
        Note over Template: variant_id format:<br/>"{templateId}:variant-{hashOfChanges}"<br/>Example: "fix-bug:variant-7f4a9e"
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
1. Failed execution detected
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

## Decomposition: Ribosome Pattern (Success → Template Extraction)

```mermaid
sequenceDiagram
    participant Impr as GoalImproviser
    participant TE as TemplateExtractor
    participant Analyzer as RibosomeQuality
    participant BE as Backend
    participant MCP as MCP Client

    Note over Impr: IMPROVISATION COMPLETED (SUCCESS)

    Impr->>Analyzer: shouldExtractTemplate(execution)
    activate Analyzer
    Note over Analyzer: Check criteria:<br/>1. status === "completed"<br/>2. tasks.length >= 2<br/>3. cost < $1.00<br/>4. impulses <= 10<br/>5. depth === 0
    alt Criteria Met
        Analyzer-->>Impr: true
    else Criteria Not Met
        Note over Analyzer: ✗ Skip extraction
        Analyzer-->>Impr: false
    end
    deactivate Analyzer

    alt Extract Template
        Note over TE: PHASE 1: IDENTIFY TASKS

        TE->>TE: identifyTaskBoundaries(steps)
        Note over TE: Group steps into logical tasks:<br/>1. Read & analyze (steps 1-3)<br/>2. Modify files (steps 4-6)<br/>3. Validate (step 7)<br/><br/>Boundaries on:<br/>- Action changes (read → write)<br/>- File changes<br/>- Group size >= 5
        TE-->>TE: taskGroups[][]

        Note over TE: PHASE 2: EXTRACT SCHEMAS

        TE->>TE: extractInputSchema(trace)
        Note over TE: From impulses_loaded:<br/>- Shape names (source_code, config, etc)<br/>- Format requirements<br/>- Budget estimates
        TE-->>TE: InputSchema {<br/>  required: [{shape}]<br/>  optional: [{shape}]<br/>}

        TE->>TE: extractOutputSchema(trace)
        Note over TE: From impulses_created:<br/>- What shapes were produced<br/>- Success indicators
        TE-->>TE: OutputSchema {<br/>  produces: [{shape}]<br/>}

        Note over TE: PHASE 3: BUILD TEMPLATE

        loop For each task group
            TE->>TE: summarizeTaskGroup(group)
            Note over TE: Create description from<br/>- First step's thought<br/>- Action patterns<br/>- Purpose inference
            TE-->>TE: taskDescription

            TE->>TE: extractPromptPattern(group)
            Note over TE: Convert steps into<br/>reusable LLM prompt template<br/>with {{variables}}
            TE-->>TE: promptTemplate

            TE->>TE: identifyVariables(group)
            Note over TE: Find parameterizable values:<br/>- File paths<br/>- Patterns<br/>- Thresholds
            TE-->>TE: Variable[]
        end

        TE->>TE: assembleTemplate(tasks, schemas)
        Note over TE: Create ActivityTemplate:<br/>1. name from goal<br/>2. category from outcome<br/>3. tasks with descriptions<br/>4. inputSchema<br/>5. outputSchema<br/>6. metadata<br/>   - sourceExecutionId<br/>   - author: "ribosome"<br/>   - createdAt<br/>   - inputSchemaInferredFrom

        TE-->>TE: ActivityTemplate

        Note over TE: PHASE 4: VALIDATION

        TE->>TE: assertValidTemplate(template)
        Note over TE: Verify:<br/>- All fields present<br/>- camelCase (no snake_case)<br/>- Task IDs unique<br/>- Schema shapes valid

        Note over TE: PHASE 5: REGISTER

        TE->>MCP: registerTemplate(template)
        activate MCP
        MCP->>BE: POST /v2/activities/templates
        activate BE

        Note over BE: 1. Validate template<br/>2. Generate template_id<br/>3. Store in SurrealDB<br/>4. Initialize Thompson params:<br/>   alpha = 1<br/>   beta = 1<br/>   successRate = 0

        BE-->>MCP: registered_template_id
        deactivate BE
        deactivate MCP

        Note over TE: ✓ TEMPLATE REGISTERED
        Note over TE: Can now be recommended<br/>via Thompson Sampling
    end

    Note over Impr: LEARNING FEEDBACK
    Note over Impr: - Execution trace stored<br/>- New template available<br/>- Thompson Sampling learns<br/>- Pattern documented
```

**Ribosome Extraction Criteria:**
- Status: `completed` (successful execution)
- Minimum complexity: `tasks >= 2`
- Maximum cost: `< $1.00`
- Impulse count: `<= 10`
- Depth: `0` (top-level, not nested)

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

**Implementation:** `repos/minibob/src/template-extractor.ts:24-400+`

## Complete Learning Loop Diagram

```mermaid
graph TB
    Start([User Goal]) -->|Enrich| A["1. Goal Enrichment<br/>(LLM semantic analysis)"]

    A -->|Analyze| B{"Simple Goal?<br/>(read-only, exploration)"}

    B -->|Yes| C["2a. Direct Improvisation<br/>(skip templates)"]
    B -->|No| D{"Templates Available?<br/>(Thompson Sampling)"}

    D -->|No Match| E["2b. Activity Fallback<br/>→ Improvisation"]
    D -->|Match| F["2b. Activity Execution<br/>(use template)"]

    C -->|Execute| G["3. Improvisation Loop<br/>(LLM + Tools)"]
    E -->|Execute| G
    F -->|Execute| H["3. Activity Loop<br/>(template tasks)"]

    G -->|Verify| I{"Goal Achieved?"}
    H -->|Verify| I

    I -->|No| J{"Max Attempts?"}
    I -->|Yes| K["4. SUCCESS"]

    J -->|No| L["5. Retry Logic<br/>(variant or next template)"]
    J -->|Yes| M["4. FAILURE<br/>(max retries)"]

    L -->|Loop| I

    K -->|Extract| N["6a. Ribosome Pattern<br/>(successful execution<br/>→ template extraction)"]
    M -->|Extract| O["6b. Failure Analysis<br/>(failed execution<br/>→ variant template)"]

    N -->|Register| P["7. Backend Learning<br/>(Thompson Sampling)"]
    O -->|Register| P

    P -->|Store| Q["8. Trace + Pattern Storage<br/>(future recommendations)"]

    Q -->|Complete| R([Loop: Next Goal])

    style Start fill:#90EE90
    style K fill:#87CEEB
    style M fill:#FFB6C6
    style P fill:#FFD700
    style R fill:#90EE90
```

## The Three Main Pathways

| Pathway | Trigger | Mechanism | Outcome |
|---------|---------|-----------|---------|
| **Activity Execution** | Template match (score >= 0.7) | Execute template tasks with LLM reasoning | Execution trace + metrics |
| **Improvisation (Goal Achieved)** | No template match OR simple goal | LLM-directed tool use (bash, read, write, edit) | Improvisation trace + extracted template (Ribosome) |
| **Improvisation (Goal Failed)** | Max attempts/cost exceeded | Analyze failure + create variant template | Failure analysis + variant registered for learning |

## Key Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `RELEVANCE_THRESHOLD` | 0.7 | Minimum score to use template |
| `MAX_IMPROVISATION_STEPS` | 50 | Step limit for improvisation loop |
| `MAX_IMPROVISATION_COST` | $5.00 | Cost limit for improvisation |
| `RIBOSOME_MIN_TASKS` | 2 | Minimum tasks for template extraction |
| `RIBOSOME_MAX_COST` | $1.00 | Maximum cost for template extraction |
| `RIBOSOME_MAX_IMPULSES` | 10 | Maximum impulses for extraction |

## File References

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Goal Processor | `repos/minibob/src/goal-processor.ts` | 650-6800+ | Complete goal processing flow |
| Improvisation | `repos/minibob/src/improviser.ts` | 125-1650+ | LLM-based improvisation loop |
| Template Extraction | `repos/minibob/src/template-extractor.ts` | 24-400+ | Ribosome pattern extraction |
| Rollback | `repos/minibob/src/rollback.ts` | 79-250+ | Checkpoint and restore |
| Checkpoint | `repos/minibob/src/activity.ts` | 455-610+ | Git state capture |
| Ribosome Quality | `repos/minibob/src/ribosome-quality.ts` | 103-142+ | Template extraction criteria |

## Related Documentation

- [Activity Selection](./01-activity-selection.md) - How templates are recommended
- [Impulse Resolution](./02-impulse-resolution.md) - Data loading during execution
- [Resolver Processing](./03-resolver-processing.md) - Tool execution mechanics
- [IMPULSE_ACTIVITY_FOUNDATION.md](../IMPULSE_ACTIVITY_FOUNDATION.md) - Foundational model

---

**Last Updated:** 2026-04-16
