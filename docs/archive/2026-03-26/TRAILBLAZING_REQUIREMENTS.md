# Trailblazing Activity Template Creation: Requirements

## 1. Execution Recording Layer

### What to Record During Trailblaze
```typescript
interface TrailblazeSession {
  goal: string;                    // What we're trying to achieve
  context: {
    files: string[];               // Files read/modified
    commands: string[];            // Commands executed
    apiCalls: ApiCall[];          // External API calls
    impulses: ImpulseReference[]; // Impulses created/used
  };
  execution: {
    toolCalls: ToolCall[];        // Every tool invocation
    decisions: Decision[];        // Why each tool was chosen
    outcomes: Outcome[];          // What each tool produced
    errors: Error[];              // Failures and recoveries
  };
  goalAchievement: {
    reached: boolean;
    validationSteps: string[];    // How we verified success
    finalState: any;
  };
}

interface ToolCall {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  timestamp: number;
  result: any;
  decision: {
    why: string;                  // Why this tool was chosen
    alternatives: string[];       // What else was considered
    context: string[];           // What context informed this choice
  };
}
```

### Recording Infrastructure Requirements

**A. Session Wrapper**
- Wrap every activity execution in recording mode
- Capture all tool calls with full context
- Track decision points (why X not Y)
- Record validation steps

**B. Impulse Integration**
- Automatically create impulses for:
  - Initial goal/context
  - Key decision points
  - Intermediate results
  - Final validation criteria
- Tag impulses with trailblaze session ID

**C. Decision Capture**
- Before each tool call, record:
  - Current objective
  - Why this tool
  - What data it needs
  - Expected outcome
- After each tool call, record:
  - Actual outcome
  - Whether it matched expectation
  - How it changed the state

### Data Structure

```typescript
// Stored in SurrealDB
CREATE trailblaze_session SET
  id = "trail_abc123",
  goal = "Fix SurrealDB authentication",
  started_at = time::now(),
  completed_at = time::now(),
  success = true,
  tool_calls = [
    {
      sequence: 1,
      tool: "bash",
      params: { command: "kubectl logs..." },
      decision: "Need to check SurrealDB logs for auth errors",
      result: "...",
      impulse_refs: ["impulse_trace_auth"]
    }
  ],
  impulses_created = ["impulse_trace_auth", "impulse_fix_auth"],
  validation_criteria = [
    "Templates endpoint returns HTTP 200",
    "SurrealDB health check passing"
  ];
```

---

## 2. Template Generation from Trailblaze

### Generalization Process

**Input**: Trailblaze session with concrete execution  
**Output**: Parameterized activity template

```typescript
interface TemplateGenerationConfig {
  trailblazeId: string;
  
  // What to parameterize
  parameterization: {
    // Identify patterns to extract as variables
    variablePatterns: {
      files: "Extract file paths as {{filePath}}",
      endpoints: "Extract URLs as {{apiUrl}}",
      errors: "Extract error messages as {{errorPattern}}",
      namespaces: "Extract K8s namespaces as {{namespace}}"
    };
    
    // Identify reusable sub-sequences
    taskBoundaries: {
      method: "semantic" | "manual" | "time-based";
      // Group tool calls into logical tasks
      // E.g., "all kubectl commands for checking pod status" → Task 1
    };
  };
  
  // What to compose
  composition: {
    // Which parts should be separate activities
    extractSubActivities: boolean;
    // Which parts should be impulses
    extractImpulses: boolean;
    // Which parts should be scripts
    extractScripts: boolean;
  };
}
```

### Generalization Algorithm

```typescript
function generateTemplateFromTrailblaze(
  session: TrailblazeSession,
  config: TemplateGenerationConfig
): ActivityTemplate {
  
  // Step 1: Identify variables
  const variables = extractVariables(session.toolCalls);
  
  // Step 2: Group into tasks
  const tasks = segmentIntoTasks(session.toolCalls);
  
  // Step 3: Extract impulses for data/context
  const impulses = extractImpulses(session.execution);
  
  // Step 4: Generate task prompts with variable interpolation
  const taskTemplates = tasks.map(task => ({
    id: generateTaskId(task),
    prompt: {
      template: interpolateVariables(task.description),
      variables: task.requiredVariables,
      impulseRefs: task.impulses
    },
    validation: extractValidation(task)
  }));
  
  // Step 5: Generate activity template
  return {
    name: inferTemplateName(session.goal),
    description: session.goal,
    category: inferCategory(session.execution),
    tasks: taskTemplates,
    variables: variables,
    validation: session.goalAchievement.validationSteps
  };
}
```

---

## 3. Impulse System Integration

### Impulse Types for Activity Composition

```typescript
enum ImpulseType {
  // Data-carrying impulses
  CONTEXT = "context",           // Initial context/state
  TRACE = "trace",              // Execution trace segment
  RESULT = "result",            // Task output
  
  // Executable impulses
  SCRIPT = "script",            // Bash/shell script
  VALIDATION = "validation",    // Test/validation harness
  SUB_ACTIVITY = "subActivity", // Nested activity reference
  
  // Decision impulses
  DECISION = "decision",        // Why X was chosen over Y
  PATTERN = "pattern",          // Recognized pattern
  TEMPLATE = "template"         // Text template with variables
}

interface ExecutableImpulse extends Impulse {
  type: ImpulseType;
  executionMode: "inline" | "reference" | "lazy";
  
  // For scripts
  script?: {
    language: "bash" | "typescript" | "python";
    content: string;
    inputVariables: string[];
  };
  
  // For sub-activities
  subActivity?: {
    templateId: string;
    variableMapping: Record<string, string>; // Map parent vars to child vars
  };
  
  // For validation
  validation?: {
    type: "command" | "api" | "file" | "condition";
    spec: any;
  };
}
```

### Context Window Management

```typescript
interface TaskContext {
  // Static context (always included)
  goalDescription: string;
  currentTaskObjective: string;
  
  // Dynamic context (impulse-driven)
  impulses: {
    // Budget-limited impulse resolution
    budget: number;              // Token budget for this task
    prioritized: ImpulseReference[]; // Ordered by relevance
    
    // Lazy loading
    loadStrategy: "eager" | "lazy" | "on-demand";
    
    // Compression
    compressionStrategy: "summarize" | "filter" | "chunk";
  };
  
  // Script results (inline)
  scriptOutputs: Record<string, any>;
  
  // Activity outputs (reference)
  subActivityResults: Record<string, ActivityResult>;
}

// Task prompt generation
function buildTaskPrompt(
  taskTemplate: TaskTemplate,
  variables: Record<string, any>,
  impulses: Impulse[]
): string {
  
  // 1. Interpolate variables
  let prompt = interpolateVariables(taskTemplate.template, variables);
  
  // 2. Resolve impulses within budget
  const resolvedImpulses = resolveImpulses(
    impulses,
    taskTemplate.impulseRefs,
    taskTemplate.budget
  );
  
  // 3. Inject impulse content
  prompt += "\n\n<context>\n";
  for (const impulse of resolvedImpulses) {
    if (impulse.type === "script") {
      // Execute script, inject output
      const output = await executeScript(impulse.script);
      prompt += `<script_output id="${impulse.id}">\n${output}\n</script_output>\n`;
    } else if (impulse.type === "subActivity") {
      // Reference activity output
      prompt += `<activity_output id="${impulse.id}">\nSee impulse:${impulse.id}\n</activity_output>\n`;
    } else {
      // Inject content directly
      prompt += `<impulse id="${impulse.id}">\n${impulse.content}\n</impulse>\n`;
    }
  }
  prompt += "</context>\n";
  
  return prompt;
}
```

---

## 4. MiniBob: Activity-Only Execution

### Requirements for MiniBob Executor

**Constraint**: MiniBob can ONLY execute activities, not direct tool calls

```typescript
interface MiniBobExecutor {
  // Only allowed operation
  executeActivity(request: ActivityExecutionRequest): Promise<ActivityResult>;
  
  // Not allowed (should throw error if attempted)
  executeTool(toolName: string, params: any): never;
  executeCommand(command: string): never;
  readFile(path: string): never;
  // ... no other direct tool access
}

// Implementation
class MiniBobActivityExecutor implements MiniBobExecutor {
  async executeActivity(request: ActivityExecutionRequest): Promise<ActivityResult> {
    // 1. Resolve template
    const template = await this.templateRegistry.get(request.templateId);
    
    // 2. Validate variables
    validateVariables(template.variables, request.variables);
    
    // 3. Create activity instance
    const activity = await this.activityEngine.create({
      templateId: request.templateId,
      variables: request.variables,
      reason: request.reason
    });
    
    // 4. Execute (this goes to activity execution engine)
    return await this.activityEngine.execute(activity.id);
  }
  
  // All other methods throw
  executeTool(): never {
    throw new Error("MiniBob can only execute activities. Create an activity template for this operation.");
  }
}
```

### MiniBob Decision Loop

```typescript
// MiniBob's only decision: which activity to run next

interface MiniBobState {
  currentGoal: string;
  availableActivities: ActivityTemplate[];
  executionHistory: ActivityResult[];
  
  // Decision function
  selectNextActivity(): {
    templateId: string;
    variables: Record<string, any>;
    reason: string;
  } | null;
}

// Pseudocode for MiniBob loop
while (true) {
  // 1. Check boredom system for suggestions
  const suggestion = await checkBoredomSystem();
  
  // 2. Or decide based on current state
  const decision = suggestion || await minibob.selectNextActivity();
  
  if (!decision) {
    // No work to do
    await sleep(interval);
    continue;
  }
  
  // 3. Execute activity (only operation allowed!)
  const result = await minibob.executeActivity({
    templateId: decision.templateId,
    variables: decision.variables,
    reason: decision.reason
  });
  
  // 4. Learn from result (update Thompson Sampling)
  await updateLearningLoop(result);
  
  // 5. Record execution
  await recordExecution(result);
}
```

---

## 5. Iteration System

### First Draft → Refinement Loop

```typescript
interface IterationWorkflow {
  // Phase 1: Record initial trailblaze
  record: {
    sessionId: string;
    goal: string;
    execution: TrailblazeSession;
  };
  
  // Phase 2: Generate first draft template
  generate: {
    algorithm: "automatic" | "assisted";
    generatedTemplate: ActivityTemplate;
    confidence: number; // How sure we are about parameterization
  };
  
  // Phase 3: Test first draft
  test: {
    testCases: Array<{
      variables: Record<string, any>;
      expectedOutcome: any;
    }>;
    results: TestResult[];
  };
  
  // Phase 4: Iterate based on failures
  iterate: {
    failures: TestResult[];
    refinements: Array<{
      issue: string;
      fix: "adjust-variables" | "split-task" | "add-validation" | "extract-impulse";
      change: any;
    }>;
    updatedTemplate: ActivityTemplate;
  };
  
  // Phase 5: Validate and register
  validate: {
    allTestsPassing: boolean;
    humanReview?: boolean;
    registered: boolean;
  };
}
```

### Refinement Strategies

```typescript
// Common issues and automatic fixes
const refinementStrategies = {
  // Too specific → Extract variable
  "hardcoded-value": (template, instance) => {
    const hardcodedValues = detectHardcodedValues(template);
    return extractAsVariables(hardcodedValues);
  },
  
  // Too generic → Add constraints
  "validation-failing": (template, failures) => {
    const missingValidations = inferValidations(failures);
    return addValidationSteps(template, missingValidations);
  },
  
  // Too monolithic → Split tasks
  "task-too-complex": (template, task) => {
    const subtasks = segmentTask(task);
    return splitIntoMultipleTasks(subtasks);
  },
  
  // Missing context → Extract impulse
  "context-dependent": (template, execution) => {
    const contextDeps = detectContextDependencies(execution);
    return extractContextAsImpulses(contextDeps);
  },
  
  // Reusable logic → Extract sub-activity
  "common-pattern": (template, pattern) => {
    const subActivity = extractAsSubActivity(pattern);
    return composeWithSubActivity(template, subActivity);
  }
};
```

---

## 6. System Architecture Requirements

### Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                   MiniBob Agent                     │
│  - Only executes activities                         │
│  - No direct tool access                            │
│  - Decides: which activity to run next              │
└──────────────────┬──────────────────────────────────┘
                   │ executeActivity()
                   ↓
┌─────────────────────────────────────────────────────┐
│             Activity Execution Engine               │
│  - Executes activity templates                      │
│  - Resolves impulses                                │
│  - Manages sub-activity composition                 │
│  - Records execution traces                         │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴───────────┐
        ↓                      ↓
┌──────────────┐      ┌────────────────┐
│   Impulse    │      │   Activity     │
│   System     │      │   Templates    │
│              │      │   Registry     │
│ - Store data │      │ - Store        │
│ - Execute    │      │   templates    │
│   scripts    │      │ - Version      │
│ - Compose    │      │   control      │
│   context    │      │ - Thompson     │
└──────────────┘      │   Sampling     │
                      └────────────────┘
                               
┌─────────────────────────────────────────────────────┐
│           Trailblazing Recording System             │
│  - Wraps activity execution                         │
│  - Captures all tool calls + decisions              │
│  - Creates impulses automatically                   │
│  - Generates first-draft templates                  │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Human: "Create activity for X" (trailblazing mode ON)
   ↓
2. Activity Executor: Records all tool calls + context
   ↓
3. Goal reached? Yes
   ↓
4. Trailblazing System:
   - Analyzes trace
   - Extracts variables
   - Groups into tasks
   - Creates impulses for data/scripts
   - Generates first-draft template
   ↓
5. Test first draft with sample variables
   ↓
6. Iterate on failures:
   - Adjust parameterization
   - Split/merge tasks
   - Extract impulses
   - Add validations
   ↓
7. Register template to registry
   ↓
8. MiniBob can now use it!
   ↓
9. Thompson Sampling learns from executions
```

---

## 7. Implementation Requirements

### Phase 1: Recording Infrastructure
```typescript
// 1. Tool call interceptor
class TrailblazingInterceptor {
  wrapToolCall(toolName: string, params: any, decision: string) {
    // Before tool execution
    const pre = {
      timestamp: Date.now(),
      toolName,
      params,
      decision, // Why this tool?
      contextSnapshot: captureContext()
    };
    
    // Execute tool
    const result = executeTool(toolName, params);
    
    // After tool execution
    const post = {
      ...pre,
      result,
      outcome: describeOutcome(result),
      stateChange: diffState(pre.contextSnapshot, captureContext())
    };
    
    // Record
    await recordToolCall(post);
    
    return result;
  }
}

// 2. Impulse auto-creation
class AutoImpulseCreator {
  async analyzeAndCreateImpulses(session: TrailblazeSession) {
    // Find data worth capturing
    const dataImpulses = extractDataImpulses(session);
    
    // Find scripts worth extracting
    const scriptImpulses = extractScriptImpulses(session);
    
    // Find validation criteria
    const validationImpulses = extractValidationImpulses(session);
    
    // Create all impulses
    for (const impulse of [...dataImpulses, ...scriptImpulses, ...validationImpulses]) {
      await impulseSystem.create(impulse);
    }
  }
}
```

### Phase 2: Template Generation
```typescript
// 3. Variable extraction
function extractVariables(toolCalls: ToolCall[]): Variable[] {
  // Pattern detection
  const patterns = {
    filePaths: /([\/\w.-]+\.[\w]+)/g,
    urls: /(https?:\/\/[^\s]+)/g,
    namespaces: /([\w-]+\.[\w-]+\.svc\.cluster\.local)/g,
    errors: /(Error: .+)/g
  };
  
  const variables = [];
  for (const [name, regex] of Object.entries(patterns)) {
    const matches = findAllMatches(toolCalls, regex);
    if (matches.length > 1) {
      // Appears multiple times → extract as variable
      variables.push({
        name: inferVariableName(name, matches),
        type: inferType(matches),
        required: true,
        examples: matches
      });
    }
  }
  
  return variables;
}

// 4. Task segmentation
function segmentIntoTasks(toolCalls: ToolCall[]): Task[] {
  // Semantic grouping
  const groups = [];
  let currentGroup = [];
  
  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i];
    
    // Start new group if:
    // - Objective changed
    // - Error occurred (recovery = new task)
    // - Long time gap
    // - Different tool category
    if (shouldStartNewGroup(call, currentGroup)) {
      if (currentGroup.length > 0) {
        groups.push(createTask(currentGroup));
      }
      currentGroup = [call];
    } else {
      currentGroup.push(call);
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(createTask(currentGroup));
  }
  
  return groups;
}
```

### Phase 3: Iteration & Refinement
```typescript
// 5. Test harness
class TemplateValidator {
  async validate(template: ActivityTemplate, testCases: TestCase[]): Promise<ValidationResult> {
    const results = [];
    
    for (const testCase of testCases) {
      const result = await executeTemplate(template, testCase.variables);
      results.push({
        testCase,
        passed: compareOutcome(result, testCase.expectedOutcome),
        actual: result,
        expected: testCase.expectedOutcome
      });
    }
    
    return {
      passRate: results.filter(r => r.passed).length / results.length,
      failures: results.filter(r => !r.passed),
      suggestions: generateRefinementSuggestions(results)
    };
  }
}

// 6. Auto-refinement
class TemplateRefiner {
  async refine(template: ActivityTemplate, failures: TestResult[]): Promise<ActivityTemplate> {
    let refined = template;
    
    for (const failure of failures) {
      const issue = classifyIssue(failure);
      const strategy = refinementStrategies[issue.type];
      refined = await strategy(refined, failure);
    }
    
    return refined;
  }
}
```

---

## 8. MiniBob Integration Requirements

### Configuration
```typescript
// MiniBob config
const minibobConfig = {
  executionMode: "activity-only", // No direct tool access
  
  capabilities: {
    // Only capability: execute activities
    allowedOperations: ["executeActivity"],
    deniedOperations: ["executeTool", "readFile", "bash", "edit", "write", "*"],
  },
  
  activitySelection: {
    // How MiniBob chooses activities
    strategy: "boredom-driven" | "goal-driven" | "learning-driven",
    
    // Boredom system integration
    boredomThreshold: 0.6,
    checkInterval: 60000, // 1 minute
    
    // Thompson Sampling integration
    useThompsonSampling: true,
    explorationRate: 0.2,
  },
  
  autonomy: {
    requireApproval: false, // Fully autonomous
    maxActivitiesPerHour: 10,
    maxCostPerActivity: 5.0,
  }
};
```

### MiniBob Permissions
```typescript
// RBAC for MiniBob
const minibobPermissions = {
  allowed: [
    "activity.execute",
    "activity.list",
    "activity.read",
    "impulse.create", // Can create impulses during execution
    "impulse.read",
  ],
  
  denied: [
    "tool.*",          // No direct tool access
    "file.write",      // No direct file writes
    "bash.execute",    // No direct bash commands
    "kubernetes.*",    // No direct K8s operations
  ]
};

// Enforcement
class MiniBobExecutionGuard {
  async checkPermission(operation: string): Promise<boolean> {
    if (operation.startsWith("activity.")) {
      return true; // Activities always allowed
    }
    
    if (minibobPermissions.denied.some(pattern => matches(operation, pattern))) {
      throw new Error(
        `MiniBob cannot execute ${operation} directly. ` +
        `Create an activity template instead.`
      );
    }
    
    return minibobPermissions.allowed.includes(operation);
  }
}
```

---

## 9. Critical Success Factors

### Must-Haves

1. **Recording Completeness**
   - Every tool call captured
   - Every decision logged
   - Full context preserved

2. **Variable Extraction Accuracy**
   - Correct identification of patterns
   - Proper type inference
   - Meaningful variable names

3. **Task Segmentation Quality**
   - Logical grouping
   - Clear dependencies
   - Reusable granularity

4. **Impulse Integration**
   - Automatic impulse creation
   - Efficient context management
   - Budget-aware resolution

5. **MiniBob Constraint Enforcement**
   - No tool escape hatches
   - Activity-only execution
   - Clear error messages when violated

6. **Iteration Effectiveness**
   - Fast test-refine loops
   - Automatic refinement suggestions
   - Convergence to working template

### Nice-to-Haves

1. **Human-in-the-loop**
   - Review before registration
   - Manual refinement GUI
   - Approval workflows

2. **Template Versioning**
   - Track iterations
   - A/B testing
   - Rollback capability

3. **Composition Suggestions**
   - Auto-detect sub-activity opportunities
   - Recommend impulse extractions
   - Suggest script consolidation

4. **Learning from Iterations**
   - Learn better parameterization
   - Improve segmentation
   - Optimize impulse budgets

---

## 10. Example: End-to-End Flow

### Scenario: Create "Fix Database Connection" Activity

```typescript
// Step 1: Human initiates trailblaze
await startTrailblaze({
  goal: "Fix database connection issue when namespace is wrong",
  recordingMode: "full"
});

// Human solves problem manually (with recording on)
// - Checks logs: kubectl logs db-pod
// - Finds error: "namespace 'old' not found"
// - Updates config: edit values.yaml (namespace: old → new)
// - Deploys: helm upgrade ...
// - Validates: curl /health → 200 OK

// Step 2: Trailblaze complete, generate template
const template = await generateTemplate({
  trailblazeId: "trail_abc123",
  generationConfig: {
    parameterization: {
      variablePatterns: {
        namespace: "Extract K8s namespace",
        service: "Extract service name",
        configFile: "Extract config file path"
      }
    },
    composition: {
      extractSubActivities: true,
      extractImpulses: true,
      extractScripts: true
    }
  }
});

// Generated template (first draft):
{
  name: "fix-database-connection-namespace",
  variables: [
    { name: "serviceName", type: "string", required: true },
    { name: "oldNamespace", type: "string", required: true },
    { name: "newNamespace", type: "string", required: true },
    { name: "configFile", type: "string", required: true }
  ],
  tasks: [
    {
      id: "check-logs",
      prompt: {
        template: "Check logs for {{serviceName}} to identify namespace issue",
        impulseRefs: ["script_check_logs"]
      }
    },
    {
      id: "update-config",
      prompt: {
        template: "Update {{configFile}} to change namespace from {{oldNamespace}} to {{newNamespace}}",
        impulseRefs: ["script_update_config"]
      }
    },
    {
      id: "deploy-changes",
      prompt: {
        template: "Deploy updated configuration for {{serviceName}}",
        impulseRefs: ["script_helm_upgrade"]
      }
    },
    {
      id: "validate-fix",
      prompt: {
        template: "Validate {{serviceName}} health endpoint returns 200",
        impulseRefs: ["validation_health_check"]
      }
    }
  ]
}

// Step 3: Test with different variables
const testResults = await testTemplate(template, [
  { 
    serviceName: "api-service",
    oldNamespace: "prod",
    newNamespace: "staging",
    configFile: "helm/api/values.yaml"
  },
  {
    serviceName: "worker-service",
    oldNamespace: "default",
    newNamespace: "workers",
    configFile: "helm/worker/values.yaml"
  }
]);

// Step 4: Iterate if failures
if (testResults.failures.length > 0) {
  template = await refineTemplate(template, testResults.failures);
}

// Step 5: Register
await registerTemplate(template);

// Step 6: MiniBob can now use it!
await minibob.executeActivity({
  templateId: "fix-database-connection-namespace",
  variables: {
    serviceName: "my-service",
    oldNamespace: "wrong-ns",
    newNamespace: "correct-ns",
    configFile: "helm/values.yaml"
  },
  reason: "Boredom system detected namespace misconfiguration"
});
```

---

## Summary: Key Requirements

### Infrastructure
1. ✅ **Trailblazing recorder** - Wrap execution, capture all tool calls + decisions
2. ✅ **Variable extractor** - Pattern detection, type inference
3. ✅ **Task segmenter** - Semantic grouping, dependency detection
4. ✅ **Impulse auto-creator** - Extract data, scripts, validations
5. ✅ **Template generator** - Convert trace → parameterized template
6. ✅ **Test harness** - Validate template with sample inputs
7. ✅ **Refinement engine** - Auto-fix common issues
8. ✅ **MiniBob executor** - Activity-only, no tool access

### Constraints
1. ✅ MiniBob can ONLY execute activities (enforced at runtime)
2. ✅ All logic must be in activity templates
3. ✅ All data must flow through impulses or variables
4. ✅ All scripts must be extractable as impulses
5. ✅ No alternative execution paths (activity or nothing)

### Workflow
1. **Record** → Trailblaze with full capture
2. **Generate** → Auto-create first draft template
3. **Test** → Run with sample variables
4. **Iterate** → Refine based on failures
5. **Register** → Add to template registry
6. **Execute** → MiniBob runs activities only

This creates a **self-improving system** where:
- Humans solve problems once (with recording)
- System generalizes solutions into templates
- MiniBob reuses templates autonomously
- Thompson Sampling optimizes selection
- No manual coding required after initial trailblaze!
