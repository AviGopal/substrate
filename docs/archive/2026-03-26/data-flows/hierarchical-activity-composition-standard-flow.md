# Data Flow: Hierarchical Activity Composition Standard

**Feature**: `hierarchical-activity-composition-standard`  
**Purpose**: Enable compose-first, create-second workflow with activities-as-impulses pattern  
**Date Traced**: 2026-03-09  
**Traced By**: OpenCode Agent (trace-enforce-validate loop foundation)

---

## Executive Summary

The hierarchical-activity-composition-standard implements a **compose-first paradigm** where agents discover and reuse existing activity templates before creating new ones. This flow enables:

1. **Goal Decomposition**: LLM breaks complex goals into task DAGs
2. **Composition Decision**: System decides whether to reuse existing activities (compose) or generate new prompts (create)
3. **Code Generation**: Execution plans are converted to ActivityTemplates with embedded composition logic
4. **Backend Persistence**: Templates are registered to centralized backend for learning and discovery
5. **Data Flow**: Activities consume outputs from other activities via impulse references (activities-as-impulses)

**Key Innovation**: Composition is implemented via **code generation** (prompts contain literal `activity()` tool calls), not execution-time dispatch. This makes composition visible to the LLM and enables adaptation.

---

## Mermaid Flow Diagram

```mermaid
graph TD
    %% Entry Point
    A[User Input: goalDescription, templateName, category] -->|Zod Validation| B[CreateActivityGoalSeekingTool]
    
    %% Tool Layer
    B -->|Apply Defaults: preferComposition=true, maxTasks=7| C{Validate & Normalize}
    C -->|Valid Input| D[GoalSeekingPlanner.generatePlan]
    C -->|Invalid| Z1[Error: Validation Failed]
    
    %% Service Layer - Decomposition
    D -->|LLM Prompt via TaskTool| E[Decompose Goal into Sub-Goals]
    E -->|JSON Response| F{Parse JSON}
    F -->|Parse Error| Z2[Error: Invalid LLM Response]
    F -->|Success| G[Validate DAG Structure]
    
    %% Service Layer - Composition Decision
    G -->|For Each Sub-Goal| H{Search Activity Templates}
    H -->|Template Found & successRate > 60%| I[strategy = compose-activity]
    H -->|No Match or Low Quality| J[strategy = generate-prompt]
    I --> K[Store Template ID]
    J --> K
    
    %% Service Layer - Plan Generation
    K -->|All Sub-Goals Processed| L[Create Execution Plan]
    L -->|Plan with Strategy Assignments| M[GoalSeekingPlanner.planToTemplate]
    
    %% Service Layer - Codegen
    M -->|For Each Task| N{Check Strategy}
    N -->|compose-activity| O[Generate Prompt with activity Tool Call]
    N -->|generate-prompt| P[Generate Custom Prompt]
    
    O -->|Prompt: activity templateId={{activityTemplate}}| Q[Create Task with Variables]
    P -->|Prompt: Custom Instructions + Validation| Q
    
    Q -->|All Tasks Processed| R[Build ActivityTemplate.CreateOptions]
    
    %% Repository Layer - Template Creation
    R -->|CreateOptions| S[ActivityTemplate.create]
    S -->|Generate ID, Version, Validate| T{Validation}
    T -->|DAG Invalid| Z3[Error: Circular Dependencies]
    T -->|Duplicate ID| Z4[Error: Template Exists]
    T -->|Valid| U[ActivityTemplate.Schema]
    
    %% Repository Layer - Backend Persistence
    U -->|Template Object| V[TemplateLoader.save]
    V -->|backend=metabob| W{Backend Enforcement}
    W -->|backend=local| Z5[Error: Local Storage Rejected]
    W -->|backend=metabob| X[TemplateServiceClient.registerTemplate]
    
    %% Service Boundary - MCP
    X -->|MCP: metabob_register_activity_template| Y{Metabob Backend}
    Y -->|Success| AA[Update TemplateCache]
    Y -->|Failure| Z6[Error: Backend Registration Failed]
    
    AA -->|Template Registered| AB[Return Success Response]
    
    %% Exit Point
    AB -->|templateId, plan, registered=true| AC[Tool Response to User]
    
    %% Integration Point - Activities-as-Impulses
    AD[Parent Activity Execution] -->|Reference Child Activity Output| AE[ImpulseResolver.resolve]
    AE -->|type=activityOutput, activityId, taskId?| AF[Storage.read with project_id]
    AF -->|Activity State| AG{taskId Specified?}
    AG -->|Yes| AH[Extract Task Output]
    AG -->|No| AI[Full Activity Output]
    AH -->|JSON.stringify| AJ[String Content]
    AI -->|JSON.stringify| AJ
    AJ -->|Inject into Prompt| AK[Parent Task Executes with Child Output]
    
    %% Styling
    style A fill:#e1f5ff,stroke:#333,stroke-width:2px
    style AC fill:#ffe1e1,stroke:#333,stroke-width:2px
    style Y fill:#fff4e1,stroke:#333,stroke-width:2px
    style I fill:#d4edda,stroke:#333,stroke-width:2px
    style J fill:#f8d7da,stroke:#333,stroke-width:2px
    style O fill:#d4edda,stroke:#333,stroke-width:2px
    style P fill:#f8d7da,stroke:#333,stroke-width:2px
    style Z1 fill:#dc3545,color:#fff
    style Z2 fill:#dc3545,color:#fff
    style Z3 fill:#dc3545,color:#fff
    style Z4 fill:#dc3545,color:#fff
    style Z5 fill:#dc3545,color:#fff
    style Z6 fill:#dc3545,color:#fff
    style AE fill:#cfe2ff,stroke:#333,stroke-width:2px
    
    %% Subgraph for layers
    subgraph Tool Layer
        B
        C
    end
    
    subgraph Service Layer - Planning
        D
        E
        F
        G
        H
        I
        J
        K
        L
    end
    
    subgraph Service Layer - Codegen
        M
        N
        O
        P
        Q
        R
    end
    
    subgraph Repository Layer
        S
        T
        U
        V
        W
        X
    end
    
    subgraph MCP Boundary
        Y
    end
    
    subgraph Activities-as-Impulses Pattern
        AD
        AE
        AF
        AG
        AH
        AI
        AJ
        AK
    end
```

---

## Data Flow Summary

### Entry Point

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts:24`

**Input Format**:
```typescript
{
  goalDescription: string,           // Natural language goal (e.g., "Deploy app to production")
  templateName: string,              // Human-readable name (e.g., "Deploy Production App")
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure",
  variables?: Record<string, unknown>,  // Context variables (default: {})
  impulseRefs?: string[],            // Impulse IDs to inject (default: [])
  constraints?: {
    maxTasks?: number,               // Max sub-goals (default: 7)
    preferComposition?: boolean,     // Compose-first flag (default: true)
    maxCost?: number                 // Budget in USD (default: 5.0)
  },
  registerToBackend?: boolean        // Register to backend (default: true)
}
```

**Validation**: Zod schema validation (syntactic only, no semantic checks)

**Defaults Applied**:
- `preferComposition = true` ← **Enforces compose-first paradigm**
- `maxTasks = 7` ← Prevents unbounded LLM decomposition
- `maxCost = 5.0` ← Cost protection
- `registerToBackend = true` ← Backend-only architecture

---

### Key Transformations

#### Transformation 1: Goal → Sub-Goals (LLM Decomposition)
**Component**: `GoalSeekingPlanner.generatePlan()` → `decomposeGoal()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts:190`

**Input**: 
```typescript
{
  goalDescription: "Deploy application to production",
  category: "infrastructure",
  variables: { appName: "my-service", environment: "production" }
}
```

**Process**:
1. Constructs LLM prompt with goal, category, variables (line 210-298)
2. Executes TaskTool with "general" subagent (12000 token budget)
3. Parses JSON response using regex: `/```json\n([\s\S]*?)\n```/`
4. Validates structure: must have `subGoals` array

**Output**:
```typescript
{
  subGoals: [
    {
      id: "setup-infrastructure",
      description: "Set up production infrastructure",
      dependencies: [],
      variables: { environment: "production" },
      validation: {
        requiredFiles: ["terraform/production.tf"],
        commands: [{ name: "validate", command: "terraform validate", required: true }]
      }
    },
    {
      id: "deploy-application",
      description: "Deploy application to production",
      dependencies: ["setup-infrastructure"],
      variables: { appName: "my-service" },
      validation: {
        commands: [{ name: "health-check", command: "curl /health", required: true }]
      }
    }
  ]
}
```

**Critical Issue**: `JSON.parse()` at line 322 has no try-catch (HIGH priority bug identified earlier)

---

#### Transformation 2: Sub-Goals → Plan with Strategy (Composition Decision)
**Component**: `GoalSeekingPlanner.generatePlan()` (line 127-184)  
**File**: `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts`

**Input**: Sub-goals array from Transformation 1

**Process**:
1. For each sub-goal, search for matching activity templates (line 132-133):
   ```typescript
   const matches = await TemplateRepository.search(subGoal.description)
   ```
2. **Composition decision logic** (line 138-151):
   ```typescript
   if (preferComposition && matches.length > 0) {
     const bestMatch = matches[0]
     if (bestMatch.successRate > 0.6) {  // 60% quality threshold
       task.strategy = "compose-activity"
       task.activityTemplate = bestMatch.id
     } else {
       task.strategy = "generate-prompt"
     }
   } else {
     task.strategy = "generate-prompt"
   }
   ```
3. Create Plan task by mapping sub-goal fields (line 153-162)

**Output**:
```typescript
{
  goalDescription: "Deploy application to production",
  tasks: [
    {
      id: "setup-infrastructure",
      description: "Set up production infrastructure",
      dependencies: [],
      strategy: "compose-activity",        // ← Reuse existing activity
      activityTemplate: "terraform-setup", // ← Template ID
      variables: { environment: "production" },
      validation: { ... }
    },
    {
      id: "deploy-application",
      description: "Deploy application to production",
      dependencies: ["setup-infrastructure"],
      strategy: "generate-prompt",         // ← Create new task
      variables: { appName: "my-service" },
      validation: { ... }
    }
  ],
  metadata: {
    estimatedDuration: 600000,  // 10 minutes
    estimatedCost: 0.05,        // $0.05
    complexity: "medium"
  }
}
```

**Quality Gate**: 60% success rate threshold balances reuse with reliability

---

#### Transformation 3: Plan → ActivityTemplate (Composition Codegen)
**Component**: `GoalSeekingPlanner.planToTemplate()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/goal-seeking-planner.ts:442`

**Input**: Plan from Transformation 2

**Process**: For each task, generate prompt based on strategy:

**For strategy="compose-activity"** (line 456-486):
```typescript
// Generated prompt template
const promptTemplate = `
Execute the following activity to accomplish this sub-goal: {{activityTemplate}}

**Sub-Goal**: ${planTask.description}

**Activity Variables**: {{activityVariables}}

Use the \`activity\` tool to execute the activity template with these variables.

activity({
  templateId: "{{activityTemplate}}",
  variables: {{activityVariables}},
  reason: "Executing sub-goal: ${planTask.description}"
})
`

// Variables created for runtime interpolation
const variables = [
  {
    name: "activityTemplate",
    type: "string",
    required: true,
    description: "Activity template ID to execute",
    default: planTask.activityTemplate  // e.g., "terraform-setup"
  },
  {
    name: "activityVariables",
    type: "string",
    required: true,
    description: "Variables for the activity template (JSON string)",
    default: JSON.stringify(planTask.variables)  // e.g., '{"environment":"production"}'
  }
]
```

**For strategy="generate-prompt"** (line 488-517):
```typescript
// Custom prompt with validation criteria
const promptTemplate = `
${planTask.description}

**Context**: ${JSON.stringify(planTask.variables)}

**Validation Criteria**:
- Required files: ${planTask.validation.requiredFiles.join(", ")}
- Required patterns: ${planTask.validation.requiredPatterns.join(", ")}
- Forbidden patterns: ${planTask.validation.forbiddenPatterns.join(", ")}
- Commands to run: ${planTask.validation.commands.map(c => c.name).join(", ")}
`
```

**Output**: ActivityTemplate.CreateOptions
```typescript
{
  name: "Deploy Production Application",
  description: "Hierarchical activity for deploying application to production",
  category: "infrastructure",
  tasks: [
    {
      id: "setup-infrastructure",
      subagent: "general",
      description: "Set up production infrastructure",
      dependencies: [],
      prompt: {
        template: "Execute the following activity: {{activityTemplate}}...",  // ← Composition prompt
        variables: [
          { name: "activityTemplate", default: "terraform-setup" },
          { name: "activityVariables", default: '{"environment":"production"}' }
        ],
        maxTokens: 12000,
        compressionStrategy: "filter"
      },
      validation: { ... },
      retry: { maxAttempts: 3, strategy: "simple" },
      tools: {
        required: ["write", "read"],
        optional: ["bash", "activity"]  // ← activity tool enabled for composition
      }
    },
    {
      id: "deploy-application",
      subagent: "general",
      description: "Deploy application to production",
      dependencies: ["setup-infrastructure"],
      prompt: {
        template: "Deploy application to production...",  // ← Custom prompt
        variables: [ ... ],
        maxTokens: 12000
      },
      validation: { ... },
      retry: { ... },
      tools: { required: ["write", "read", "bash"], optional: [] }
    }
  ],
  integration: {
    preChecks: [],
    postChecks: [],
    qualityGates: []
  },
  metabob: {
    enabled: true,
    learningMode: true,
    targetContextTokens: 5000,
    annotationStrategy: "key-components"
  }
}
```

**Key Innovation**: Prompts contain **literal activity() tool calls**, not just descriptions. This is the core composition mechanism.

---

#### Transformation 4: CreateOptions → Template Schema (Validation & Instantiation)
**Component**: `ActivityTemplate.create()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts` (inferred from usage)

**Input**: ActivityTemplate.CreateOptions from Transformation 3

**Process**:
1. Zod schema validation (apply defaults)
2. Generate template ID from name: `"Deploy Production Application"` → `"deploy-production-application"`
3. Check for duplicate ID in storage (throws error if exists)
4. Validate task graph (DAG validation - no cycles)
5. Validate agent assignments
6. Validate execution modes
7. Generate version (semantic versioning with variant hash)
8. Create genealogy (evolution tracking)

**Output**: ActivityTemplate.Schema
```typescript
{
  id: "deploy-production-application",
  name: "Deploy Production Application",
  description: "Hierarchical activity for deploying application to production",
  category: "infrastructure",
  version: "1.0.0",
  variantHash: "abc123...",
  tasks: [ ... ],  // From Transformation 3
  integration: { ... },
  metabob: { ... },
  genealogy: {
    reason: "MANUAL",
    author: "agent",
    parentTemplateId: undefined
  },
  createdAt: 1704835200000,
  updatedAt: 1704835200000
}
```

**Validation Rules**:
- Unique template ID (enforced by storage check)
- Valid DAG (no circular dependencies)
- All task dependencies reference existing tasks
- Valid agent assignments
- Execution mode consistency

---

#### Transformation 5: Template Schema → Backend Record (Persistence)
**Component**: `TemplateLoader.save()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:275`

**Input**: ActivityTemplate.Schema from Transformation 4

**Process**:
1. **Architectural constraint enforcement** (line 281-286):
   ```typescript
   if (backend === "local") {
     throw new Error("Backend='local' is not supported. Templates must be saved to backend via MCP.")
   }
   if (backend === "all") {
     backend = "metabob"  // Force backend-only
   }
   ```
2. Schema adaptation (OpenCode → Metabob format):
   ```typescript
   const metabobTemplate = ActivitySchemaAdapter.fromCanonical(template)
   ```
3. MCP call to backend:
   ```typescript
   const result = await TemplateServiceClient.registerTemplate({
     template: metabobTemplate,
     overwrite: true
   })
   ```
4. Update TemplateCache on success (line 302)

**Output**: 
- Backend persistence side effect (template stored in Metabob database)
- Cache update side effect (in-memory cache refreshed)
- Return void (success indicated by no exception)

**Service Boundary**: MCP call to `metabob_register_activity_template` tool

**Schema Adaptation** (field mapping examples):
- `id` → `template_id`
- `name` → `template_name`
- `tasks` → `task_list`
- (and more transformations)

---

### Integration Point: Activities-as-Impulses

**Component**: `ImpulseResolver.resolve()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts:460`

**Purpose**: Enable data flow between composed activities by resolving `activityOutput` pointers

**Input**: 
```typescript
{
  type: "activityOutput",
  activityId: "terraform-setup_abc123",  // Child activity ID
  taskId: "validate-infrastructure"      // Optional: specific task output
}
```

**Process**:
1. Load activity state from Storage with project-scoped key:
   ```typescript
   const projectId = Instance.project.id  // e.g., "metabob-devbob"
   const activity = await Storage.read(["activity", projectId, pointer.activityId])
   ```
2. If `taskId` specified, extract specific task output:
   ```typescript
   const task = activity.tasks.find((t) => t.id === pointer.taskId)
   return JSON.stringify(task, null, 2)
   ```
3. Otherwise, return full activity output:
   ```typescript
   return JSON.stringify(activity, null, 2)
   ```

**Output**: JSON-stringified activity or task result (injected into parent task prompt)

**Example Output**:
```json
{
  "id": "validate-infrastructure",
  "status": "completed",
  "result": {
    "validation": "passed",
    "resources": ["vpc-123", "subnet-456"],
    "output": "Infrastructure is ready for deployment"
  },
  "metrics": {
    "duration": 45000,
    "cost": 0.02
  }
}
```

**Critical for Composition**: This enables parent activities to consume child activity outputs, completing the hierarchical data flow.

---

### Validations Enforced

#### 1. Input Validation (Entry Point)
**Location**: `CreateActivityGoalSeekingTool` (line 93-102)
- Zod schema validation for all parameters
- Type checking (goalDescription: string, category: enum, etc.)
- **Missing**: Semantic validation (goalDescription length, variables serializability)

#### 2. LLM Response Validation (Decomposition)
**Location**: `GoalSeekingPlanner.decomposeGoal()` (line 318-330)
- JSON structure validation: must have `subGoals` array
- **Missing**: Try-catch around JSON.parse (HIGH priority bug)

#### 3. Template Structure Validation (Instantiation)
**Location**: `ActivityTemplate.create()` (inferred from trace)
- Duplicate ID check (throws error if template exists)
- DAG validation (no circular dependencies)
- Agent assignment validation
- Execution mode consistency

#### 4. Backend Enforcement (Persistence)
**Location**: `TemplateLoader.save()` (line 281-286)
- Rejects `backend="local"` with error
- Enforces backend-only architecture
- **Missing**: Retry logic for transient failures (MEDIUM priority)

#### 5. Impulse Resolution Validation
**Location**: `ImpulseResolver.resolve()` (line 460-487)
- **Missing**: Runtime schema validation of activity state
- **Missing**: Try-catch around JSON.stringify for circular refs (HIGH priority bug)

---

### Architectural Boundaries Crossed

#### Boundary 1: Tool → Service (Layer Boundary)
**Location**: `CreateActivityGoalSeekingTool` → `GoalSeekingPlanner.generatePlan()`
- **Type**: Internal layer boundary (Tool layer → Service layer)
- **Coupling**: Tight (direct function call)
- **Contract**: Function signature (typed parameters)

#### Boundary 2: Service → LLM (External System Boundary)
**Location**: `GoalSeekingPlanner.decomposeGoal()` → `TaskTool.execute()`
- **Type**: External system boundary (OpenCode → LLM API)
- **Coupling**: Loose (TaskTool abstraction)
- **Contract**: Prompt string in, JSON string out
- **Resilience**: TaskTool likely has timeout, but not documented

#### Boundary 3: Service → Repository (Layer Boundary)
**Location**: `GoalSeekingPlanner` → `TemplateLoader.save()`
- **Type**: Internal layer boundary (Service layer → Repository layer)
- **Coupling**: Tight (direct function call)
- **Contract**: ActivityTemplate.Schema object

#### Boundary 4: Repository → Backend (Service Boundary - MCP)
**Location**: `TemplateLoader.save()` → `TemplateServiceClient.registerTemplate()` → Metabob MCP
- **Type**: External service boundary (OpenCode → Metabob Backend via MCP)
- **Coupling**: Medium-loose (MCP protocol abstraction)
- **Contract**: MCP tool call with `metabob_register_activity_template`
- **Resilience**: Circuit breaker (3 failures → open), 10s timeout, connection caching
- **Schema Adaptation**: ActivitySchemaAdapter.fromCanonical() converts OpenCode → Metabob format

#### Boundary 5: Impulse Resolution → Storage (Data Store Boundary)
**Location**: `ImpulseResolver.resolve()` → `Storage.read()`
- **Type**: Data store boundary (In-memory → Persistent storage)
- **Coupling**: Tight (direct Storage API calls)
- **Contract**: Key array in, typed object out (with `any` cast - no validation)
- **Project Isolation**: Keys prefixed with `Instance.project.id` (RIPPLE architecture)

#### Boundary 6: Template Execution → Composed Activity (Recursive Boundary)
**Location**: Parent activity task → `ActivityTool` → Child activity execution
- **Type**: Recursive composition boundary (activity calls activity)
- **Coupling**: Loose (LLM invokes tool based on generated prompt)
- **Contract**: activity() tool call with templateId and variables
- **Data Flow**: Child output stored in activity state, parent reads via impulse resolution

---

### Exit Point

**Location**: `CreateActivityGoalSeekingTool` returns response to user  
**File**: `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts`

**Output Format**:
```typescript
{
  templateId: "deploy-production-application",
  plan: {
    goalDescription: "Deploy application to production",
    tasks: [ ... ],
    metadata: { estimatedDuration: 600000, estimatedCost: 0.05 }
  },
  registered: true,
  estimatedCost: 0.05,
  estimatedDuration: 600000
}
```

**Side Effects**:
1. Template persisted in Metabob backend (available for future composition)
2. TemplateCache updated (in-memory cache refreshed)
3. Template immediately discoverable for future `preferComposition=true` workflows

**Feedback Loop**: Registered template completes the compose-first cycle - it's now available for future goal decompositions to reuse.

---

## Key Insights

### Business Purpose

The hierarchical-activity-composition-standard flow implements a **self-improving system** where:

1. **Agents create reusable building blocks**: Each goal decomposition produces a template that future agents can compose
2. **Quality improves over time**: 60% success rate threshold ensures only proven templates are reused
3. **Cost reduces through reuse**: Composing existing activities is cheaper than LLM decomposition + custom prompts
4. **Knowledge centralizes**: Backend stores all templates for cross-project sharing and learning

**Business Value**:
- **Reduced development time**: Agents reuse proven solutions instead of reinventing
- **Improved reliability**: Composition prefers high-success-rate templates (quality gate)
- **Cost optimization**: Reuse reduces LLM API costs
- **Cross-team learning**: Templates shared across projects via centralized backend

---

### Critical Decision Points

#### Decision Point 1: Compose vs Create (Line 138-151)
**Component**: `GoalSeekingPlanner.generatePlan()`

**Condition**:
```typescript
if (preferComposition && matches.length > 0 && matches[0].successRate > 0.6) {
  strategy = "compose-activity"
} else {
  strategy = "generate-prompt"
}
```

**Impact**: 
- **Compose**: Reuse existing activity (faster, cheaper, proven)
- **Create**: Generate new prompt (flexible, custom, unproven)

**Risk**: If template search returns low-quality matches or backend is unavailable, all tasks fall back to generate-prompt (no composition benefits)

---

#### Decision Point 2: Backend Persistence Enforcement (Line 281-286)
**Component**: `TemplateLoader.save()`

**Condition**:
```typescript
if (backend === "local") {
  throw new Error("Backend='local' is not supported")
}
```

**Impact**:
- **Backend-only**: Enforces centralized learning, prevents divergence
- **Tradeoff**: Hard dependency on Metabob backend (no offline mode for template creation)

**Risk**: If backend is down, template creation fails completely. Mitigated by:
- Circuit breaker (fast-fail after 3 failures)
- Bootstrap templates embedded in binary (core functionality works offline)

---

#### Decision Point 3: Impulse Resolution Strategy (Line 460-487)
**Component**: `ImpulseResolver.resolve()`

**Condition**:
```typescript
if (pointer.taskId && activity.tasks) {
  // Extract specific task output
} else {
  // Return full activity output
}
```

**Impact**:
- **Task-specific**: Reduces data size, targets specific output
- **Full activity**: Provides all context, includes metadata

**Risk**: Linear scan of tasks array (O(n)) - no index. Not a problem for small task counts (<100 tasks per activity).

---

### Potential Risks and Technical Debt

#### HIGH Priority (Blocking for Production)

1. **Unprotected JSON.parse in Goal Decomposition** (Line 322)
   - **Risk**: LLM malformed response crashes entire workflow
   - **Impact**: Critical failure path (blocks all goal-seeking workflows)
   - **Mitigation**: Add try-catch with descriptive error message

2. **Type Safety Bypass in MCP Calls** (Line 381, 418)
   - **Risk**: MCP schema changes cause runtime crashes
   - **Impact**: Impulse resolution failures break activities-as-impulses
   - **Mitigation**: Add Zod validation for MCP responses

3. **JSON.stringify Circular Reference Handling** (Line 475, 481)
   - **Risk**: Activity state with circular refs crashes impulse resolution
   - **Impact**: Parent activities can't consume child outputs (breaks composition)
   - **Mitigation**: Custom JSON.stringify replacer for circular refs

---

#### MEDIUM Priority (Reliability Concerns)

4. **No Retry Logic in Backend Registration** (Line 287-307)
   - **Risk**: Transient network failures permanently fail template registration
   - **Impact**: Templates lost, can't be reused in future workflows
   - **Mitigation**: Add exponential backoff retry (3 attempts)

5. **Weak Input Validation** (Line 93-102)
   - **Risk**: DoS potential (10MB goalDescription), non-serializable variables
   - **Impact**: Wasted compute, downstream failures
   - **Mitigation**: Add semantic validation (max length, serializability checks)

6. **No Runtime Validation in Storage Layer** (Line 465)
   - **Risk**: Schema evolution breaks activity state loading
   - **Impact**: Impulse resolution failures, data corruption
   - **Mitigation**: Add Zod schemas for all storage objects

---

#### LOW Priority (Best Practices)

7. **Undocumented Timeout in TaskTool** (Line 301-316)
   - **Risk**: LLM decomposition could hang indefinitely
   - **Impact**: Low (TaskTool likely has internal timeout)
   - **Mitigation**: Document timeout parameter, add explicit config

8. **Prompt Injection Risk** (Line 210-298)
   - **Risk**: User input directly interpolated into LLM prompts
   - **Impact**: LLM could be manipulated to produce malicious decomposition
   - **Mitigation**: Sanitize user input before prompt construction

---

### Suggested Improvements

#### Improvement 1: Add Error Recovery to JSON.parse
**Priority**: HIGH  
**Impact**: Prevents workflow crashes on LLM response errors

**Current Code** (Line 322):
```typescript
const decomposition = JSON.parse(jsonMatch[1])
```

**Suggested**:
```typescript
let decomposition: any
try {
  decomposition = JSON.parse(jsonMatch[1])
} catch (error) {
  throw new Error(
    `Failed to parse LLM decomposition response: ${error instanceof Error ? error.message : String(error)}. ` +
    `Raw response: ${jsonMatch[1].slice(0, 200)}...`
  )
}
```

---

#### Improvement 2: Add MCP Response Validation
**Priority**: HIGH  
**Impact**: Prevents crashes on backend schema changes

**Current Code** (Line 381):
```typescript
const result = (await metabobClient.callTool({...})) as any
const issues = result.content[0].text  // No validation
```

**Suggested**:
```typescript
const MCPResponse = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string()
  }))
})

const result = await metabobClient.callTool({...})
const parsed = MCPResponse.safeParse(result)
if (!parsed.success) {
  log.error("Invalid MCP response schema", { error: parsed.error })
  return `// MCP response validation failed`
}
const issues = parsed.data.content[0]?.text
```

---

#### Improvement 3: Add Circular Reference Handling to JSON.stringify
**Priority**: HIGH  
**Impact**: Prevents crashes on complex activity state

**Current Code** (Line 475):
```typescript
return JSON.stringify(task, null, 2)
```

**Suggested**:
```typescript
const seen = new WeakSet()
return JSON.stringify(task, (key, value) => {
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
  }
  if (typeof value === 'bigint') return value.toString()
  return value
}, 2)
```

---

#### Improvement 4: Add Retry Logic to Backend Registration
**Priority**: MEDIUM  
**Impact**: Improves reliability on transient failures

**Current Code** (Line 287-307):
```typescript
const result = await TemplateServiceClient.registerTemplate({...})
if (!result.success) {
  throw new Error(result.error || "Unknown error")
}
```

**Suggested**:
```typescript
import { retry } from '@/util/retry'

const result = await retry(
  () => TemplateServiceClient.registerTemplate({...}),
  {
    maxAttempts: 3,
    delayMs: 1000,
    backoff: 'exponential',
    retryIf: (error) => 
      error.message.includes('ECONNREFUSED') || 
      error.message.includes('timeout') ||
      error.message.includes('ENOTFOUND')
  }
)
```

---

#### Improvement 5: Add Semantic Input Validation
**Priority**: MEDIUM  
**Impact**: Prevents DoS and downstream failures

**Current Code** (Line 93-102):
```typescript
const parsed = schema.parse(parameters)  // Only Zod schema validation
```

**Suggested**:
```typescript
const schema = z.object({
  goalDescription: z.string().min(10).max(10000),  // Add length constraints
  templateName: z.string().min(3).max(100),
  category: z.enum(["feature", "bugfix", "refactor", "tool", "infrastructure"]),
  variables: z.record(z.unknown()).refine(
    (vars) => isJSONSerializable(vars),  // Custom validator
    { message: "Variables must be JSON-serializable" }
  ),
  constraints: z.object({
    maxTasks: z.number().min(1).max(20).default(7),
    preferComposition: z.boolean().default(true),
    maxCost: z.number().min(0).max(100).default(5.0)  // Add bounds
  }).default({}),
  // ...
})
```

---

#### Improvement 6: Add Storage Schema Validation
**Priority**: MEDIUM  
**Impact**: Prevents runtime crashes on schema evolution

**Current Code** (Line 465):
```typescript
const activity = await Storage.read<any>(["activity", projectId, pointer.activityId])
```

**Suggested**:
```typescript
const ActivityStateSchema = z.object({
  id: z.string(),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    result: z.unknown(),
    // ... full task schema
  }))
})

const activity = await Storage.read(["activity", projectId, pointer.activityId])
const validated = ActivityStateSchema.safeParse(activity)

if (!validated.success) {
  log.error("Invalid activity state schema", { 
    activityId: pointer.activityId, 
    error: validated.error 
  })
  return `// Activity state validation failed`
}

// Use validated.data (type-safe)
```

---

## Reusable Patterns

### Pattern 1: Compose-First Workflow
**Abstraction Potential**: HIGH  
**Reusable For**: Any system with reusable building blocks (UI components, infrastructure modules, API endpoints)

**Core Pattern**:
1. **Decompose**: Break complex goal into sub-goals
2. **Search**: Query repository for matching solutions
3. **Decide**: Prefer reuse if quality threshold met (e.g., 60% success rate)
4. **Compose or Create**: Reuse existing or generate new
5. **Register**: Persist new solution for future reuse

**Abstraction**:
```typescript
interface ComposableUnit {
  id: string
  successRate: number
  metadata: Record<string, unknown>
}

interface ComposeFirstWorkflow<T extends ComposableUnit> {
  decompose(goal: string): Promise<SubGoal[]>
  search(query: string): Promise<T[]>
  decide(matches: T[], threshold: number): "compose" | "create"
  compose(unit: T, variables: Record<string, unknown>): Promise<Result>
  create(goal: string, variables: Record<string, unknown>): Promise<Result>
  register(unit: T): Promise<void>
}
```

**Activity Template Candidate**: `compose-first-workflow` (generic template with strategy parameter)

---

### Pattern 2: Code Generation for Composition
**Abstraction Potential**: MEDIUM  
**Reusable For**: Template systems, DSL compilers, metaprogramming

**Core Pattern**:
1. **Plan**: Create execution plan with strategy decisions
2. **Codegen**: Generate code/prompts with embedded composition logic
3. **Execute**: Run generated code with runtime variable interpolation

**Key Innovation**: Composition as code (visible, analyzable) vs execution-time dispatch (opaque)

**Abstraction**:
```typescript
interface CodegenTemplate {
  strategy: "compose" | "generate"
  templateRef?: string  // For compose strategy
  customLogic?: string  // For generate strategy
  variables: Variable[]
}

function generateCode(plan: CodegenTemplate[]): string {
  return plan.map(task => {
    if (task.strategy === "compose") {
      return `invoke(${task.templateRef}, ${task.variables})`
    } else {
      return task.customLogic
    }
  }).join('\n')
}
```

**Activity Template Candidate**: `codegen-template-compiler` (converts plans to executable code)

---

### Pattern 3: Activities-as-Impulses (Lazy Data Flow)
**Abstraction Potential**: HIGH  
**Reusable For**: Reactive systems, data pipelines, build systems

**Core Pattern**:
1. **Reference**: Store pointer to data source (not eager copy)
2. **Resolve**: Lazy load data when needed
3. **Transform**: Serialize data for consumer format (e.g., JSON for LLM)
4. **Inject**: Provide data to consumer (e.g., prompt template)

**Key Benefit**: Memory efficiency (load-on-demand), late binding (data computed just-in-time)

**Abstraction**:
```typescript
interface Pointer<T> {
  type: string
  ref: string
}

interface Resolver<T> {
  resolve(pointer: Pointer<T>): Promise<string>
}

// Usage
const activityOutputPointer: Pointer<Activity> = {
  type: "activityOutput",
  ref: "terraform-setup_abc123"
}

const resolved = await resolver.resolve(activityOutputPointer)
// resolved is JSON string ready for injection
```

**Activity Template Candidate**: `lazy-data-pipeline` (data flow with deferred resolution)

---

### Pattern 4: Backend-Only Architecture with Bootstrap Fallback
**Abstraction Potential**: MEDIUM  
**Reusable For**: Distributed systems, microservices, client-server architectures

**Core Pattern**:
1. **Enforce**: Reject local-only operations (no dual storage)
2. **Bootstrap**: Embed minimal functionality in client (cold-start exception)
3. **Fail-Fast**: Throw errors on backend unavailability (detect issues early)
4. **Circuit Breaker**: Fast-fail after threshold (prevent cascading failures)

**Key Tradeoff**: Availability vs consistency (backend-only = strong consistency, lower availability)

**Abstraction**:
```typescript
interface BackendOnlyStore<T> {
  save(entity: T, backend: "metabob" | "local"): Promise<void>  // Rejects local
  load(id: string, fallbackToBootstrap: boolean): Promise<T>
  bootstrap: Set<string>  // IDs of embedded entities
}

// Usage
await store.save(template, "local")  // Throws error
await store.save(template, "metabob")  // OK

await store.load("custom-template", false)  // Requires backend
await store.load("bootstrap-template", true)  // Falls back to embedded
```

**Activity Template Candidate**: `backend-only-persistence-pattern` (enforces centralized storage)

---

### Feature-Specific vs Universal Aspects

#### Universal (Reusable Patterns)
- ✅ Compose-first decision logic (search → threshold → compose or create)
- ✅ Code generation for composition (prompts with embedded tool calls)
- ✅ Lazy data resolution (pointer → resolve → inject)
- ✅ Backend-only architecture with bootstrap fallback
- ✅ Layer separation (Tool → Service → Repository)
- ✅ Quality gates (success rate thresholds)

#### Feature-Specific (Hierarchical Activity Composition)
- ❌ LLM decomposition via TaskTool (specific to AI agents)
- ❌ ActivityTemplate schema (specific to OpenCode)
- ❌ Metabob MCP integration (specific to Metabob backend)
- ❌ Impulse pointer types (specific to OpenCode impulse system)
- ❌ 60% success rate threshold (tuned for activity templates, may vary for other domains)

---

## Verification Checklist: Compose-First, Create-Second Paradigm

Based on the trace, the codebase **FULLY SUPPORTS** the hierarchical-activity-composition-standard:

### ✅ Compose-First Workflow
- [x] Entry point defaults `preferComposition=true` (line 126 in create-activity-goal-seeking.ts)
- [x] Quality threshold applied (60% success rate gate in goal-seeking-planner.ts:143)
- [x] Templates searched before custom prompt generation (goal-seeking-planner.ts:132-133)
- [x] Strategy decision persisted in plan (strategy="compose-activity" or "generate-prompt")

### ✅ Activities-as-Impulses
- [x] `activityOutput` impulse pointer type defined (activity-template.ts:29)
- [x] Impulse resolution implemented (impulse-resolver.ts:460-487)
- [x] Storage uses project-scoped keys (RIPPLE architecture)
- [x] JSON serialization of activity outputs for prompt injection

### ✅ Agent IDE Constraint (No CLI)
- [x] `config_update` tool available (config-update.ts:14)
- [x] Programmatic MCP configuration (config-update.ts supports MCP section)
- [x] Tool-based API for template creation (create_activity_goal_seeking)
- [x] No CLI commands required for composition workflow

### ✅ Backend-Only Architecture
- [x] Local storage rejected (template-loader.ts:281-286)
- [x] MCP registration enforced (template-loader.ts:287-307)
- [x] Bootstrap templates embedded for cold-start (template-loader.ts:82-86)
- [x] Centralized learning enabled (backend stores all templates)

### ✅ Composition Mechanism
- [x] Code generation approach (prompts with activity() calls)
- [x] Variable interpolation ({{activityTemplate}}, {{activityVariables}})
- [x] activity tool in optional tools for compose-activity tasks
- [x] Composition visible to LLM (can adapt if activity fails)

---

## Conclusion

The hierarchical-activity-composition-standard flow is **FULLY IMPLEMENTED** with the following characteristics:

1. **Compose-first by default**: `preferComposition=true` ensures reuse is preferred
2. **Quality-gated composition**: 60% success rate threshold balances reuse with reliability
3. **Code-based composition**: Prompts contain literal activity() calls (not opaque dispatch)
4. **Activities-as-impulses**: Data flow between composed activities via impulse resolution
5. **Backend-only architecture**: Centralized learning with bootstrap fallback for cold-start
6. **Agent IDE constraint**: No CLI dependency, programmatic config via tools

**Production Readiness**: MEDIUM
- **Blockers**: 3 HIGH priority bugs (JSON.parse, type safety, circular refs)
- **Reliability**: 3 MEDIUM priority issues (retry logic, validation, schema evolution)
- **Best Practices**: 2 LOW priority improvements (timeout docs, prompt injection)

**Recommendation**: Fix HIGH priority bugs before production use. The core architecture is sound and fully supports the compose-first paradigm.

---

**Last Updated**: 2026-03-09  
**Traced By**: OpenCode Agent (Trace-Enforce-Validate Loop Foundation)
