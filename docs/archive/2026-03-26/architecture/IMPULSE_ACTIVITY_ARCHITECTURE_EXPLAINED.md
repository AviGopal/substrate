# Impulse System & Activity Template Architecture: Deep Dive

## Your Questions Answered

### 1. How are impulses defining dynamic agents with instructional information on the fly?

**Short Answer**: Impulses don't define agents—they define **dynamic context** that gets injected into the agent's prompt. The activity task prompt becomes the **user message**, not the system prompt.

### 2. How are activity template tasks used as system prompts?

**Critical Correction**: Activity template task prompts are **NOT system prompts**—they become **user messages**. The agent's system prompt comes from `agent.prompt` (defined in `agent.ts`). The task prompt is sent as a user message in the conversation.

### 3. Why does this supplant the traditional subagent configuration?

**Answer**: It doesn't supplant it—it **complements** it. Traditional subagent configuration (in `agent.ts`) defines:
- Tools available
- System prompt
- Model to use
- Permissions

Activity templates layer on top by providing:
- Structured task prompts (user messages)
- Dynamic context via impulses
- Variable interpolation
- Validation and retry logic

---

## Architecture Breakdown

### Component 1: Impulses (Dynamic Context System)

**What are impulses?**
- Lazy-loaded pointers to content with token budgets
- Can reference files, Metabob analysis, conversation history, bash output, etc.
- Managed by memory agent to optimize context window usage

**Impulse Lifecycle:**
```typescript
// 1. CREATE: Define what context is needed (unloaded state)
{
  id: "errorFile",
  type: "file",
  pointer: { type: "file", path: "src/tool/bash.ts", offset: 40, limit: 20 },
  budget: 2000,  // Max tokens
  priority: "high",
  loaded: false,  // Not yet loaded
  content: null
}

// 2. LOAD: Resolve pointer and load content
const loaded = await ImpulseResolver.load(impulse)
// Now loaded.content contains file content, loaded.tokenCount is actual size

// 3. INJECT: Format for prompt injection
const context = formatImpulsesForContext(taskImpulses)
// Returns:
// <impulse_context>
//   <impulse id="errorFile" type="file" tokens="1850/2000">
//     [actual file content here]
//   </impulse>
// </impulse_context>

// 4. UNLOAD: Free memory
const unloaded = ImpulseResolver.unload(impulse)
// Now unloaded.loaded = false, unloaded.content = null
```

**Key Insight**: Impulses are NOT instructions—they're **context data** that gets prepended to the task prompt.

---

### Component 2: Activity Template Task Execution Flow

**The Actual Execution Flow** (from `template-executor.ts`):

```typescript
// STEP 1: Load activity template
const template = await TemplateRepository.get("manage-session-memory")
// Template has: name, tasks, contextRequirements, etc.

// STEP 2: Create impulses from context requirements
const impulses = await Activity.createImpulsesFromRequirements(
  activity.id,
  template.contextRequirements
)
// Creates unloaded impulse pointers

// STEP 3: Execute tasks in dependency order
for (const task of template.tasks) {
  // STEP 3a: Load impulses needed for THIS task
  const taskImpulses = await loadTaskImpulses(activity, task.impulseReferences)
  
  // STEP 3b: Interpolate task prompt with variables
  let prompt = ActivityTemplate.interpolatePrompt(task.prompt.template, variables)
  // Variables: {{userMessage}}, {{files}}, etc.
  
  // STEP 3c: Inject impulse context
  const impulseContext = formatImpulsesForContext(taskImpulses)
  prompt = `${impulseContext}\n\n${prompt}`
  
  // STEP 3d: Execute via subagent
  await executeViaSubagent(
    task.subagent,  // "memory"
    task.description,
    prompt,  // THIS IS THE USER MESSAGE
    sessionID,
    parentSessionID
  )
  
  // STEP 3e: Optimize (unload low-priority impulses for next task)
  await optimizeImpulsesForNextTask(activity, task, nextTask)
}
```

**Critical Point**: The `prompt` variable becomes the **user message**, not the system prompt!

---

### Component 3: Agent Execution (What Actually Happens)

**Inside `executeViaSubagent`** (line 1287-1506 in template-executor.ts):

```typescript
async function executeViaSubagent(
  subagent: string,        // "memory"
  description: string,     // "Analyze user intent"
  prompt: string,          // Task prompt + impulse context (USER MESSAGE)
  sessionID: string,
  parentSessionID?: string
) {
  // 1. Get agent configuration
  const agent = await Agent.get(subagent)  // Gets memory agent from agent.ts
  // Agent has: system prompt, tools, model, permissions
  
  // 2. Optionally enrich with Metabob context
  let enrichedPrompt = prompt
  if (parentSessionID && metabobEnabled) {
    const scopedContext = await MetabobCLI.generateScopedContext(...)
    const contextHeader = formatSubagentContext(scopedContext, taskScope)
    enrichedPrompt = contextHeader + prompt  // STILL USER MESSAGE
  }
  
  // 3. Resolve prompt parts
  const parts = await SessionPrompt.resolvePromptParts(enrichedPrompt)
  
  // 4. Determine model (agent.model or complexity-based)
  let model = agent.model ?? defaultModel
  if (taskComplexity) {
    model = tierModelMap[taskComplexity.tier]
  }
  
  // 5. Execute via SessionPrompt.prompt()
  await SessionPrompt.prompt({
    messageID,
    sessionID,
    model,
    agent: agent.name,  // "memory"
    tools: agent.tools,
    parts,  // THIS BECOMES THE USER MESSAGE
  })
}
```

**Inside `SessionPrompt.prompt()`** (session/prompt.ts):

```typescript
async function prompt(input: PromptInput) {
  // 1. Get agent system prompt
  const agent = await Agent.get(input.agent)
  const systemPrompt = agent.prompt ?? defaultSystemPrompt
  
  // 2. Build messages array
  const messages = [
    // System messages
    ...SystemPrompt.header(providerID),  // Provider-specific headers
    { role: "system", content: systemPrompt },  // Agent's system prompt
    
    // Previous conversation messages
    ...previousMessages,
    
    // Current user message (THIS IS THE TASK PROMPT)
    { role: "user", content: input.parts.join("\n") }
  ]
  
  // 3. Call LLM
  const result = await streamText({
    model,
    messages,
    tools: filterTools(input.tools, agent),
    ...
  })
}
```

---

## The Actual Prompt Structure

**What the LLM Sees** (for "memory" agent executing "analyze-intent" task):

```
MESSAGES:
[
  {
    role: "system",
    content: "You are Claude Code, Anthropic's official CLI..."  // Base system
  },
  {
    role: "system", 
    content: "You are the Memory Agent responsible for managing context window allocation..."  // agent.prompt
  },
  {
    role: "user",
    content: "
      <impulse_context>
        <impulse id='contextSpace' type='memo' tokens='500/1000'>
          Current context space: 20000 tokens available...
        </impulse>
      </impulse_context>
      
      Analyze the user's message and determine what context to prepare.
      
      ## User Message
      
      {{userMessage}}
      
      ## Your Task
      ...
    "
  }
]
```

**Key Observations:**
1. **System Prompt** = Agent definition from `agent.ts` (static)
2. **User Message** = Task prompt from activity template + impulse context (dynamic)
3. **Impulses** = Prepended context data in XML format

---

## Why This Architecture?

### Problem with Traditional Approach
**Before (one monolithic agent):**
```
User: "Fix the bug in auth.ts"
  ↓
Agent System Prompt:
  - "You are Activity Mode agent"
  - "You can use files, metabob, activities, etc."
  - "Follow these patterns..."
  ↓
Agent figures out:
  1. What files to read
  2. What Metabob analysis to run
  3. How to structure the fix
  4. What tests to run
  5. How to commit
  ↓
Result: 5000-line agent prompt, inconsistent behavior
```

### Activity Template Approach
**After (decomposed into tasks with impulses):**
```
User: "Fix the bug in auth.ts"
  ↓
Activity Template: "fix-bug-complete"
  ↓
Task 1: "Gather Context" (memory agent)
  - Impulses: errorFile, relatedTests, metabobIssues
  - Prompt: "Read these files and summarize the bug"
  - Output: Bug summary
  ↓
Task 2: "Fix Bug" (general agent)
  - Impulses: bugSummary, errorFile
  - Prompt: "Fix the bug based on this analysis: {{bugSummary}}"
  - Output: Fixed code
  ↓
Task 3: "Test Fix" (general agent)
  - Impulses: relatedTests, fixedCode
  - Prompt: "Run tests and verify fix"
  - Output: Test results
  ↓
Task 4: "Commit Changes" (general agent)
  - Impulses: changesSummary
  - Prompt: "Create atomic commit with message"
  - Output: Commit hash
```

**Benefits:**
1. **Reusable**: "fix-bug-complete" works for ANY bug
2. **Composable**: Tasks can be shared across templates
3. **Memory-efficient**: Impulses unloaded between tasks
4. **Traceable**: Each task has clear input/output
5. **Testable**: Can validate each task independently

---

## Impulse vs System Prompt vs Task Prompt

| Aspect | System Prompt | Task Prompt | Impulse |
|--------|--------------|-------------|---------|
| **Source** | `agent.prompt` in agent.ts | `task.prompt.template` | `impulse.pointer` |
| **When Set** | Agent initialization | Template load time | Runtime (lazy) |
| **Content** | Agent identity & capabilities | Task-specific instructions | Context data |
| **Message Role** | `system` | `user` | Part of `user` message |
| **Lifespan** | Entire session | Single task execution | Can be unloaded/reloaded |
| **Variability** | Static (agent definition) | Static (template) | Dynamic (resolved at runtime) |
| **Token Budget** | Unmetered | Unmetered | Metered (has budget) |

**Example:**
```typescript
// System Prompt (agent.ts, line 383)
memory: {
  prompt: `You are the Memory Agent responsible for managing context window allocation...`
}

// Task Prompt (activity template)
task: {
  prompt: {
    template: `Analyze the user's message: {{userMessage}}
    
    Output JSON with intent and suggested impulses.`
  }
}

// Impulse (created at runtime)
impulse: {
  id: "userContext",
  pointer: { type: "memo", content: "User asked about fixing auth bug" },
  content: "User asked about fixing auth bug",  // Actual data
  budget: 500,
  tokenCount: 50
}
```

---

## Why This DOESN'T Supplant Traditional Subagent Config

**Traditional subagent configuration is STILL REQUIRED** because it defines:

### 1. Agent Identity (System Prompt)
```typescript
// From agent.ts
memory: {
  prompt: `You are the Memory Agent...`  // WHO the agent is
}
```

### 2. Tool Access
```typescript
memory: {
  tools: {
    impulse_create: true,
    impulse_load: true,
    memory_budget: true,
    bash: true,
    // Activity/review agents can't access these
  }
}
```

### 3. Model Configuration
```typescript
memory: {
  model: {
    providerID: "anthropic",
    modelID: "claude-4-5-haiku"  // Fast, cheap for memory tasks
  }
}
```

### 4. Permissions
```typescript
memory: {
  permission: {
    edit: "allow",
    bash: { "*": "allow" },
    // Fine-grained control
  }
}
```

**Activity templates layer ON TOP of this** by providing:
- Structured prompts (user messages)
- Dynamic context via impulses
- Variable interpolation
- Validation & retry logic
- Task dependencies

---

## Memory Agent Example: Full Flow

**Setup** (in agent.ts):
```typescript
memory: {
  name: "memory",
  model: { providerID: "anthropic", modelID: "claude-4-5-haiku" },
  prompt: `You are the Memory Agent...`,  // System prompt
  tools: { impulse_create: true, ... },
  mode: "subagent"
}
```

**Activity Template** (manage-session-memory.json):
```json
{
  "id": "manage-session-memory",
  "tasks": [
    {
      "id": "analyze-intent",
      "subagent": "memory",  // Uses memory agent config
      "prompt": {
        "template": "Analyze: {{userMessage}}",  // User message
        "variables": [
          { "name": "userMessage", "type": "string", "required": true }
        ]
      }
    }
  ]
}
```

**Execution**:
```typescript
// 1. Template executor calls
await executeViaSubagent("memory", "Analyze intent", prompt, sessionID)

// 2. Gets agent config
const agent = await Agent.get("memory")  // From agent.ts

// 3. Sends to LLM
messages = [
  { role: "system", content: agent.prompt },  // "You are Memory Agent..."
  { role: "user", content: prompt }  // "Analyze: Fix bug in auth.ts"
]

// 4. LLM responds using memory agent's tools
response = { content: "{ intentType: 'code_fix', ... }" }
```

---

## Key Architectural Insights

### 1. Separation of Concerns
- **Agent Config**: WHO the agent is (identity, capabilities, tools)
- **Activity Template**: WHAT the agent should do (structured tasks)
- **Impulses**: WHAT DATA the agent needs (dynamic context)

### 2. Composition Pattern
```
Agent Definition (agent.ts)
  +
Activity Template (JSON)
  +
Impulses (runtime)
  =
Fully Configured Task Execution
```

### 3. Memory Optimization
- Impulses loaded on-demand (per task)
- Unloaded between tasks to free memory
- Token budgets prevent context overflow
- Memory agent orchestrates this lifecycle

### 4. Prompt Hierarchy
```
Priority 1: System Prompt (agent identity)
Priority 2: Impulse Context (data)
Priority 3: Task Prompt (instructions)
Priority 4: Previous Messages (conversation)
```

---

## Common Misconceptions

### ❌ WRONG: "Task prompts replace system prompts"
**✓ CORRECT**: Task prompts become user messages. System prompt still comes from agent.prompt.

### ❌ WRONG: "Impulses are instructions"
**✓ CORRECT**: Impulses are data/context. Instructions are in task.prompt.template.

### ❌ WRONG: "Activity templates replace agent definitions"
**✓ CORRECT**: Templates compose WITH agent definitions. Both are needed.

### ❌ WRONG: "Memory agent is special/magic"
**✓ CORRECT**: Memory agent is just another subagent with impulse-management tools.

---

## Summary

**Impulses** = Dynamic context data injected into user messages
**Task Prompts** = User messages with instructions
**System Prompts** = Agent identity from agent.ts
**Agent Config** = Still required for tools, model, permissions

**Together they enable:**
- Modular, reusable workflows (activity templates)
- Memory-efficient context management (impulses)
- Specialized agent capabilities (agent configs)
- Structured, validated execution (template executor)

This architecture doesn't supplant traditional subagents—it provides a **structured execution framework** on top of them.
