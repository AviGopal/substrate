# Trailblazing Activity Template Creation: CORRECTED Architecture

## Core Concept (CORRECTED)

**"Agent attempts goal → Records its own problem-solving → Generalizes on completion → Registers as reusable template"**

**NOT**: Human solves, system records  
**YES**: Agent solves autonomously, system learns from agent's solution

---

## Key Corrections

### ❌ WRONG: Human Solves Problem
```
Human manually executes tools
System records human actions
Human reaches goal
System extracts pattern
```

### ✅ CORRECT: Agent Solves Goal
```
Human sets goal
Agent generates next task
Agent executes task
Agent reflects on progress
Goal reached or stuck?
  → Success: Register as template
  → Failure: Register as template (for learning)
  → Stuck: Human provides targeted guidance
System extracts pattern from agent's execution
```

---

## Revised Architecture

### 1. Goal Setting (Human Input)

**What Human Provides**:
```typescript
interface TrailblazeGoal {
  goal: string;                    // "Fix SurrealDB authentication"
  context?: string;                // Optional: "The templates endpoint returns 500"
  constraints?: string[];          // Optional: ["Don't modify server config"]
  successCriteria?: string[];      // Optional: ["Templates endpoint returns 200"]
}
```

**Human does NOT**:
- Execute any tools
- Provide step-by-step instructions
- Solve the problem manually

**Human MAY**:
- Provide targeted information if agent gets stuck
- Answer specific questions from agent
- Provide domain knowledge

---

### 2. Agent Autonomous Execution

**Agent's Self-Directed Loop**:

```typescript
async function trailblazeExecution(goal: TrailblazeGoal): Promise<TrailblazeSession> {
  const session = createTrailblazeSession(goal);
  
  while (!session.complete) {
    // 1. Agent generates next task for itself
    const nextTask = await agent.generateNextTask({
      goal: session.goal,
      executionHistory: session.tasks,
      currentState: captureState()
    });
    
    // 2. Record the task generation decision
    session.recordDecision({
      why: nextTask.reasoning,
      what: nextTask.description,
      alternatives: nextTask.alternativesConsidered
    });
    
    // 3. Agent executes the task
    const result = await agent.executeTask(nextTask);
    
    // 4. Record the task execution
    session.recordTask({
      task: nextTask,
      result: result,
      toolCalls: result.toolCalls,
      stateChanges: diffState(session.currentState, captureState())
    });
    
    // 5. Agent reflects on progress
    const reflection = await agent.reflect({
      goal: session.goal,
      tasksCompleted: session.tasks,
      currentState: captureState(),
      lastResult: result
    });
    
    // 6. Determine if complete, stuck, or continue
    if (reflection.goalAchieved) {
      session.complete = true;
      session.success = true;
      session.validationResults = reflection.validation;
    } else if (reflection.isStuck) {
      // Agent is stuck - needs targeted human input
      const humanGuidance = await requestHumanGuidance({
        goal: session.goal,
        attemptedSoFar: session.tasks,
        stuckReason: reflection.stuckReason,
        specificQuestion: reflection.questionForHuman
      });
      
      // Record human guidance as context
      session.recordHumanGuidance(humanGuidance);
      
      // Continue with new information
      continue;
    } else if (reflection.shouldContinue) {
      // Agent continues autonomously
      continue;
    } else {
      // Failed to achieve goal
      session.complete = true;
      session.success = false;
      session.failureReason = reflection.failureReason;
    }
  }
  
  // 7. On completion (success OR failure), register as template
  const template = await generateTemplateFromSession(session);
  await registerTemplate(template, {
    initialSuccess: session.success,
    sourceSession: session.id
  });
  
  return session;
}
```

---

### 3. Agent Self-Directed Task Generation

**Agent Generates Tasks, Not Human**:

```typescript
interface AgentGeneratedTask {
  id: string;
  description: string;           // What the agent will do
  reasoning: string;             // Why this task is needed
  alternativesConsidered: string[]; // What else was considered
  expectedOutcome: string;       // What the agent expects
  toolsPlanned: string[];        // Which tools to use
}

// Agent's internal task planning
async function generateNextTask(context: ExecutionContext): Promise<AgentGeneratedTask> {
  // Agent asks itself:
  // - What have I tried so far?
  // - What did those attempts reveal?
  // - What is the most logical next step?
  // - What information do I need to gather?
  // - What action should I take?
  
  const reasoning = await analyzeCurrentSituation(context);
  const nextAction = await decideNextAction(reasoning);
  
  return {
    id: generateId(),
    description: nextAction.description,
    reasoning: nextAction.rationale,
    alternativesConsidered: nextAction.alternatives,
    expectedOutcome: nextAction.expected,
    toolsPlanned: nextAction.tools
  };
}
```

---

### 4. Agent Reflection & Progress Assessment

**Agent Reflects After Each Task**:

```typescript
interface AgentReflection {
  goalAchieved: boolean;
  shouldContinue: boolean;
  isStuck: boolean;
  
  // If achieved
  validation?: {
    criteria: string[];
    results: boolean[];
    evidence: any[];
  };
  
  // If stuck
  stuckReason?: string;
  questionForHuman?: string;       // Targeted question, not open-ended
  
  // If failed
  failureReason?: string;
  
  // If continuing
  nextSteps?: string[];
  learnings?: string[];            // What this task revealed
}

async function reflect(context: ReflectionContext): Promise<AgentReflection> {
  // Agent asks itself:
  // - Did I achieve the goal?
  // - If not, am I making progress?
  // - Am I stuck in a loop?
  // - Do I have enough information to continue?
  // - What did I learn from the last task?
  
  const goalCheck = await evaluateGoalAchievement(context);
  if (goalCheck.achieved) {
    return {
      goalAchieved: true,
      validation: goalCheck.validation
    };
  }
  
  const progressCheck = await evaluateProgress(context);
  if (progressCheck.stuck) {
    return {
      isStuck: true,
      stuckReason: progressCheck.reason,
      questionForHuman: formulateTargetedQuestion(progressCheck)
    };
  }
  
  return {
    shouldContinue: true,
    nextSteps: progressCheck.suggestedNextSteps,
    learnings: progressCheck.insights
  };
}
```

---

### 5. Human Guidance (Only When Stuck)

**Targeted Questions, Not Open-Ended**:

```typescript
interface HumanGuidanceRequest {
  goal: string;
  tasksAttempted: AgentGeneratedTask[];
  stuckReason: string;
  
  // SPECIFIC, TARGETED QUESTION
  question: string;  // "What is the correct namespace for SurrealDB in this environment?"
                     // NOT: "How do I fix this?"
  
  // Context for the question
  contextForQuestion: {
    whatWeTried: string[];
    whatWeFound: string[];
    whyWeNeedToKnow: string;
  };
}

interface HumanGuidance {
  answer: string;                  // Specific answer to targeted question
  additionalContext?: string;      // Optional: Related information
}

// Example targeted questions:
const goodQuestions = [
  "What is the SurrealDB namespace for the activity-system environment?",
  "Should I use root-level auth or database-level auth for SurrealDB v3?",
  "Is the Redis service at redis-master or redis-headless?",
  "What is the expected HTTP status code for a successful health check?"
];

// BAD (too open-ended):
const badQuestions = [
  "How do I fix the authentication?",
  "What should I do next?",
  "Can you help me solve this?"
];
```

---

### 6. Template Generation from Agent Execution

**Extract Pattern from Agent's Autonomous Problem-Solving**:

```typescript
async function generateTemplateFromSession(
  session: TrailblazeSession
): Promise<ActivityTemplate> {
  
  // 1. Extract variables from agent's execution
  const variables = extractVariablesFromAgentExecution(session.tasks);
  
  // 2. Segment agent's tasks into template tasks
  const templateTasks = segmentAgentTasksIntoTemplateTasks(session.tasks);
  
  // 3. Analyze each task to determine required impulses
  const impulses = await analyzeTasksForImpulses(templateTasks);
  
  // 4. Generate task prompts based on agent's reasoning
  const taskPrompts = templateTasks.map(task => ({
    id: task.id,
    prompt: {
      template: interpolateVariables(task.agentReasoning),
      variables: task.requiredVariables,
      impulseRefs: identifyRequiredImpulses(task)
    },
    validation: extractValidationFromReflection(task.reflection)
  }));
  
  // 5. Create template
  return {
    name: inferTemplateName(session.goal),
    description: session.goal,
    category: inferCategory(session.tasks),
    tasks: taskPrompts,
    variables: variables,
    validation: session.validationResults,
    
    // Metadata from trailblaze
    sourceSession: session.id,
    initialSuccess: session.success,
    agentReasoningTrace: session.tasks.map(t => t.reasoning)
  };
}
```

---

### 7. Impulse Interpolation (Before Registration)

**Examine Each Task to Determine Required Impulses**:

```typescript
async function identifyRequiredImpulses(
  task: TemplateTask
): Promise<ImpulseReference[]> {
  
  const impulses: ImpulseReference[] = [];
  
  // Analyze task for different impulse needs
  
  // 1. Data impulses (context from previous tasks)
  if (task.dependsOnPreviousResults) {
    impulses.push({
      type: "data",
      id: `context_${task.id}`,
      description: "Results from previous task",
      source: "previousTaskOutput"
    });
  }
  
  // 2. Script impulses (reusable commands)
  const scripts = extractReusableScripts(task.toolCalls);
  for (const script of scripts) {
    impulses.push({
      type: "script",
      id: `script_${script.name}`,
      content: script.commands,
      inputVariables: script.variables
    });
  }
  
  // 3. Validation impulses (success criteria)
  if (task.validation) {
    impulses.push({
      type: "validation",
      id: `validation_${task.id}`,
      spec: task.validation
    });
  }
  
  // 4. Sub-activity impulses (if pattern matches existing template)
  const matchingTemplate = await findMatchingTemplate(task.pattern);
  if (matchingTemplate) {
    impulses.push({
      type: "subActivity",
      id: matchingTemplate.id,
      variableMapping: mapVariables(task.variables, matchingTemplate.variables)
    });
  }
  
  return impulses;
}
```

---

### 8. Template Registration (Success OR Failure)

**Register Regardless of Outcome**:

```typescript
async function registerTemplate(
  template: ActivityTemplate,
  metadata: {
    initialSuccess: boolean;
    sourceSession: string;
  }
): Promise<void> {
  
  // Store in template registry
  await templateRegistry.store(template);
  
  // Initialize Thompson Sampling scores
  if (metadata.initialSuccess) {
    // Start with 1 success, 0 failures
    await thompsonSampling.initialize(template.id, {
      alpha: 2,  // 1 success + 1 (prior)
      beta: 1,   // 0 failures + 1 (prior)
      executions: 1
    });
  } else {
    // Start with 0 success, 1 failure
    await thompsonSampling.initialize(template.id, {
      alpha: 1,  // 0 success + 1 (prior)
      beta: 2,   // 1 failure + 1 (prior)
      executions: 1
    });
  }
  
  // Link to source trailblaze session
  await linkTemplateToSession(template.id, metadata.sourceSession);
  
  // Template is now available for replay and refinement
}
```

---

### 9. Template Replay (Execute Activity)

**Replay = Execute the Generated Activity**:

```typescript
async function replayTemplate(
  templateId: string,
  variables: Record<string, any>
): Promise<ActivityResult> {
  
  // This is just normal activity execution
  const result = await executeActivity({
    templateId: templateId,
    variables: variables,
    reason: "Replaying trailblaze session"
  });
  
  // Update Thompson Sampling based on outcome
  await thompsonSampling.update(templateId, {
    success: result.success,
    duration: result.duration,
    cost: result.cost
  });
  
  return result;
}
```

---

## Revised Data Flow

```
┌──────────────────────────────────────────────┐
│ 1. HUMAN: Sets goal                          │
│    "Fix SurrealDB authentication"            │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 2. AGENT: Generates next task for itself     │
│    "Check SurrealDB logs for auth errors"    │
│    Reasoning: "Need to understand failure"   │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 3. AGENT: Executes task                      │
│    kubectl logs surrealdb-0                  │
│    → Finds: "namespace 'metabob' not found"  │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 4. AGENT: Reflects on progress               │
│    Goal achieved? No                         │
│    Stuck? No                                 │
│    Continue? Yes                             │
│    Learning: "Namespace is the issue"        │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 5. AGENT: Generates next task                │
│    "Update Helm values to fix namespace"     │
└────────────────┬─────────────────────────────┘
                 ↓
         (loop continues...)
                 ↓
┌──────────────────────────────────────────────┐
│ 6. AGENT: Reflects → Goal achieved!          │
│    Validation: curl /health → 200 OK         │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 7. SYSTEM: Generates template from session   │
│    - Extract variables                       │
│    - Segment tasks                           │
│    - Identify impulses per task              │
│    - Create template                         │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 8. SYSTEM: Register template                 │
│    - Store in registry                       │
│    - Initialize Thompson Sampling            │
│    - Link to source session                  │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 9. REPLAY: Execute activity with new vars    │
│    templateId: "fix-surrealdb-namespace"     │
│    variables: { namespace: "prod" }          │
└──────────────────────────────────────────────┘
```

---

## What Gets Recorded

### From Agent's Execution:

```typescript
interface TrailblazeSession {
  goal: string;
  
  // Agent's self-generated tasks
  tasks: Array<{
    id: string;
    description: string;
    reasoning: string;              // Why agent chose this task
    alternativesConsidered: string[];
    
    // Execution
    toolCalls: ToolCall[];
    result: any;
    stateChanges: StateChange[];
    
    // Reflection
    reflection: AgentReflection;
    learnings: string[];
  }>;
  
  // Human interventions (if any)
  humanGuidance: Array<{
    whenStuck: string;
    question: string;
    answer: string;
  }>;
  
  // Outcome
  success: boolean;
  validationResults?: ValidationResult;
  failureReason?: string;
}
```

---

## Impulse Identification (Key Innovation)

**Before Registration, Analyze Each Task**:

```typescript
// For each task in the trailblaze session
for (const task of session.tasks) {
  
  // 1. Does this task use data from previous tasks?
  if (task.usedPreviousResults) {
    createImpulse({
      type: "data",
      content: task.inputFromPreviousTasks,
      description: "Context from previous step"
    });
  }
  
  // 2. Does this task execute reusable scripts?
  if (task.hasReusableScripts) {
    createImpulse({
      type: "script",
      content: extractScriptCommands(task),
      variables: extractScriptVariables(task)
    });
  }
  
  // 3. Does this task perform validation?
  if (task.hasValidation) {
    createImpulse({
      type: "validation",
      spec: task.validationSpec
    });
  }
  
  // 4. Does this task's pattern match an existing activity?
  const matchingActivity = await findMatchingActivity(task.pattern);
  if (matchingActivity) {
    createImpulse({
      type: "subActivity",
      activityId: matchingActivity.id,
      variableMapping: mapVariables(task, matchingActivity)
    });
  }
}
```

---

## Key Differences from Original

| Aspect | WRONG (Original) | CORRECT (Revised) |
|--------|------------------|-------------------|
| **Who Solves** | Human manually | Agent autonomously |
| **Recording** | Human's actions | Agent's self-directed tasks |
| **Task Generation** | Human decides steps | Agent generates next task |
| **Reflection** | System analyzes | Agent reflects on progress |
| **Human Role** | Execute tools | Set goal + targeted guidance if stuck |
| **Impulses** | Extract during recording | Identify before registration |
| **Registration** | Only on success | Success OR failure |
| **Replay** | Re-execute trace | Execute activity with new vars |

---

## MiniBob Integration (Still Correct)

MiniBob constraint remains the same:
- **Only executes activities**
- **No direct tool access**
- **Trailblazing creates templates MiniBob can use**

---

## Summary: Corrected Flow

1. **Human sets goal** → "Fix SurrealDB auth"
2. **Agent generates tasks** → Self-directed problem-solving
3. **Agent executes & reflects** → Autonomous loop
4. **Agent reaches goal or gets stuck** → Success/failure/needs help
5. **If stuck** → Human provides targeted answer
6. **On completion** → System generates template from agent's execution
7. **Identify impulses** → Analyze each task for data/script/validation/sub-activity needs
8. **Register template** → Available for replay (success OR failure tracked)
9. **Replay** → Execute activity with new variables
10. **MiniBob uses templates** → Autonomous execution of proven patterns

**Result**: Agent learns by doing, system captures patterns, MiniBob reuses autonomously! 🚀
