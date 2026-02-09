# Memory Agent Architecture - The Proper Design

## The Insight: We're Using the Wrong Pattern

### What Currently Exists (Designed Architecture)

**From `agent.ts:386-559`**:

```typescript
memory: {
  name: "memory",
  description: "Manages activity context memory and impulse lifecycle",
  mode: "subagent",  // ← A proper agent!
  tools: {
    // Impulse management
    impulse_create: true,
    impulse_list: true,
    impulse_load: true,
    impulse_unload: true,
    impulse_delete: true,
    impulse_update: true,
    // Context management
    memory_outline: true,  // ← Visual allocation map
    memory_budget: true,   // ← Token budget summary
    memory_optimize: true,
    // Negotiation
    negotiate_context: true,
    activity_reason: true,
    // Standard tools
    bash: true,
    read: true,
    grep: true,
    ...
  }
}
```

**This is a PROPER AGENT that makes tool calls, like a kernel managing memory!**

---

### What We Built (Shortcut)

**SessionMemoryAgent namespace** (`memory-agent.ts`):

```typescript
export namespace SessionMemoryAgent {
  // Just helper functions
  export async function analyzeIntent(...) {
    // Single LLM call with large prompt
    // Returns suggestions directly
  }
  
  export async function prepare(...) {
    // Directly creates impulses
    // No tool calls, no iteration
  }
}
```

**This is a SHORTCUT** - single LLM call with all context upfront.

---

## The Proper Design: ID-Description Basis

### How It Should Work (Like a Kernel)

```typescript
// Spawn memory agent as subagent
const memorySession = await Session.create({
  agent: "memory",  // Uses the memory agent config from agent.ts
  mode: "subagent"
})

// Give it minimal prompt
await prompt({
  sessionID: memorySession,
  parts: [{
    type: "text",
    text: `User wants to: ${userMessage}
    
Current session: ${sessionID}
Activity: ${activityId || "none"}
Context requirements: ${contextRequirements.map(r => `${r.key}: ${r.hint}`).join(", ")}

Use your tools to:
1. Check current context state (memory_budget, memory_outline)
2. Create appropriate impulses (impulse_create)
3. Load high-priority impulses (impulse_load)
4. Optimize if needed (memory_optimize)
`
  }]
})
```

**The memory agent then makes tool calls**:

```
Memory Agent Turn 1:
  → memory_budget({})
  Returns: {total: 10000, used: 1200, available: 8800}
  
  → memory_outline({})
  Returns: Visual map of current impulses
  
  Thinks: "Budget healthy, can create 2-3 impulses"
  
  → impulse_create({
      id: "errorFile",
      pointer: {type: "file", path: "src/tool/bash.ts"},
      budget: 2000,
      priority: "high"
    })
  Returns: Created
  
  → impulse_load({id: "errorFile"})
  Returns: Loaded with tokenCount: 1847
  
  → memory_budget({})
  Returns: {used: 3047}  // Updated
  
  Thinks: "Still have space, create another"
  
  → impulse_create({id: "tests", ...})
  
  Done: "Created 2 impulses, loaded 1, using 3047 tokens"
```

---

## Benefits of Proper Architecture

### Current Approach (Single LLM Call)

**Prompt contains**:
- ❌ Entire project tree (1,400 tokens)
- ❌ All guidelines (500 tokens)
- ❌ Examples (500 tokens)
- ❌ Budget status (125 tokens)
- ❌ All instructions upfront

**Total**: 2,900 tokens in prompt

**Process**:
1. Build massive prompt
2. Single LLM call
3. Parse JSON response
4. Create impulses from response

**Issues**:
- Large prompt (timeout risk)
- No iteration (can't adjust based on results)
- No inspection (blind to current state)
- All-or-nothing (timeout = no impulses)

---

### Proper Approach (Tool-Using Agent)

**Initial prompt**:
```
User: "Fix bug in memory-agent.ts"
Current session: ses_xxx
Activity: act_xxx (bug-fix template)
Context requirements: errorContext, relatedFiles

Use your tools to prepare context.
```

**Size**: ~200 tokens

**Process**:
1. memory_budget() - See current state (~50 tokens returned)
2. memory_outline() - Visual map (~300 tokens returned)
3. impulse_create({...}) - Add errorFile
4. impulse_load({id: "errorFile"}) - Load it
5. memory_budget() - Check new state
6. impulse_create({...}) - Add tests if space
7. Done

**Benefits**:
- ✅ Minimal prompt (200 tokens vs 2,900)
- ✅ Iterative (adjust based on tool results)
- ✅ Inspects state (memory_budget, memory_outline)
- ✅ Fault-tolerant (one tool fails, others work)
- ✅ Observable (tool calls visible in logs)
- ✅ Kernel-like (manages memory incrementally)

---

## How Memory Agent Tools Work

### Tool: memory_outline()

**Returns**:
```
Context Window Outline for Session ses_xxx

HIGH Priority (5000 tokens budgeted, 4200 used):
  ✓ loaded errorFile [file] 1847/2000 tokens
  ✓ loaded stackTrace [memo] 500/500 tokens

MEDIUM Priority (3000 tokens budgeted, 0 used):
  ○ unloaded tests [file] 0/3000 tokens

Total: 4200/8000 tokens (52.5% utilization)
```

**Memory agent sees this**, makes decisions based on it.

---

### Tool: memory_budget()

**Returns**:
```json
{
  "total": 10000,
  "used": 4200,
  "available": 5800,
  "utilization": 42.0,
  "impulses": {"total": 3, "loaded": 2, "unloaded": 1},
  "byPriority": {
    "high": {"count": 2, "budget": 5000, "used": 4200},
    "medium": {"count": 1, "budget": 3000, "used": 0}
  }
}
```

**Memory agent uses this to decide**: "42% utilization, healthy, can add more"

---

### Tool: impulse_create()

**Input**:
```typescript
{
  id: "errorFile",
  pointer: {type: "file", path: "src/tool/bash.ts", offset: 30, limit: 30},
  budget: 2000,
  priority: "high",
  description: "File containing the TypeError"
}
```

**Returns**: Created impulse (unloaded)

**Memory agent then calls**: `impulse_load({id: "errorFile"})`

---

## The Architectural Mismatch

### What We Built

```
prepareSessionMemory()
  ↓
SessionMemoryAgent.analyzeIntent()
  - Single LLM call
  - Large prompt with everything
  - Returns suggestion array
  ↓
SessionMemoryAgent.prepare()
  - Directly creates impulses
  - No tool calls
  - No iteration
```

**This bypasses the tool system entirely!**

---

### What Should Exist

```
prepareSessionMemory()
  ↓
Session.create({agent: "memory", mode: "subagent"})
  ↓
Memory Agent Subagent Session
  - Tool call: memory_budget() - See state
  - Tool call: memory_outline() - Visualize
  - Tool call: impulse_create() - Add impulse
  - Tool call: impulse_load() - Load it
  - Tool call: memory_budget() - Verify
  - [Iterate as needed]
  ↓
Returns control to main session
```

**This uses the designed tool system!**

---

## Why This Matters

### The Kernel Analogy

**Like a kernel allocating memory**:
```c
// Kernel doesn't get all memory info upfront
// It makes syscalls to inspect and manage

void allocate_for_process() {
  // Check current state
  mem_info = get_memory_info();  // Syscall
  
  if (mem_info.available < needed) {
    // Free some pages
    evict_lru_pages();  // Syscall
    mem_info = get_memory_info();  // Check again
  }
  
  // Allocate
  page = allocate_page();  // Syscall
  
  // Verify
  verify_allocation();  // Syscall
}
```

**The memory agent should work the same way**:
```typescript
// Memory agent doesn't get all context upfront
// It makes tool calls to inspect and manage

Memory Agent:
  1. memory_budget() - Check state
  2. memory_outline() - See layout
  3. [Analyze] - Decide what's needed
  4. impulse_create() - Allocate
  5. impulse_load() - Load content
  6. memory_budget() - Verify
  7. [Done]
```

---

## Minimal Prompt Example

### Instead of 2,900 token prompt:

```
You are the Memory Agent...

[2,900 tokens of instructions, examples, project tree]
```

### Use ~200 token prompt:

```
Prepare context for this task:

User message: "Fix bug in memory-agent.ts"
Session: ses_3c9896844ffebsvjnDrnHGa93t
Activity: act_bugfix_123 (bug-fix template)
Context requirements:
  - errorContext (REQUIRED): "Provide error file and stack trace"
  - relatedFiles (optional): "Related test files"

Use your tools:
1. memory_budget() - Check available space
2. memory_outline() - See current allocation
3. impulse_create() - Add needed context
4. impulse_load() - Load high-priority impulses
5. memory_optimize() - Suggest improvements if needed
```

**The agent already knows how to use tools** (from its agent.ts config)!

---

## Why We Didn't Use This

### The Current SessionMemoryAgent

**Looking at the code**, we have:
- `SessionMemoryAgent.analyzeIntent()` - Single LLM call
- `SessionMemoryAgent.prepare()` - Direct impulse creation
- No agent session spawning
- No tool usage

**Why this exists**: Probably a simplified prototype or intermediate implementation.

**The proper memory agent** (from agent.ts) is defined but not wired up for session memory preparation!

---

## The Right Fix

### Instead of Our Approach

**Don't**:
- Call `SessionMemoryAgent.analyzeIntent()` with huge prompt
- Get suggestions back as JSON
- Create impulses directly

### Do This

**Spawn memory agent subagent**:
```typescript
export async function prepareSessionMemory(input: {
  sessionID: string
  promptText: string
  agent: string
}): Promise<void> {
  // Create memory agent subagent session
  const memorySessionID = await Session.create({
    agent: "memory",
    mode: "subagent",
    parentSessionID: input.sessionID
  })
  
  // Give it minimal task description
  await Session.prompt({
    sessionID: memorySessionID,
    agent: "memory",
    parts: [{
      type: "text",
      text: `Prepare context for: "${input.promptText}"
      
Session: ${input.sessionID}
${activityContextHints.length > 0 ? `
Activity requirements:
${activityContextHints.map(r => `- ${r.key}: ${r.hint}`).join("\n")}
` : ""}

Use your tools to:
1. Check current context (memory_budget, memory_outline)
2. Create appropriate impulses (impulse_create)
3. Load high-priority ones (impulse_load)
4. Report status

Be efficient - only create what's needed based on budget.`
    }]
  })
  
  // Memory agent makes tool calls iteratively
  // Tool results show exactly what it's doing
  // No large prompt needed!
}
```

---

## Comparison

| Aspect | Current (SessionMemoryAgent) | Proper (Memory Subagent) |
|--------|------------------------------|--------------------------|
| **Prompt size** | 2,900 tokens | 200 tokens |
| **Architecture** | Helper functions | Tool-using agent |
| **Iteration** | No (single call) | Yes (multiple tools) |
| **Inspection** | Blind | Uses memory_budget(), memory_outline() |
| **Observability** | Limited (just logs) | Full (tool calls visible) |
| **Fault tolerance** | All-or-nothing | Partial success possible |
| **Matches design** | No | Yes (from agent.ts) |

---

## Why Tool-Based Is Better

### Like a Kernel

**Kernel allocates memory**:
1. Check available pages
2. Find contiguous block
3. Allocate
4. Mark as used
5. Verify

**Memory agent manages impulses**:
1. memory_budget() - Check available tokens
2. memory_outline() - Find space
3. impulse_create() - Allocate impulse
4. impulse_load() - Load content
5. memory_budget() - Verify allocation

**Same pattern!**

### Observable Actions

**Tool calls are logged**:
```
TOOL impulse_create {id: "errorFile", budget: 2000}
TOOL impulse_load {id: "errorFile"} → {tokenCount: 1847}
TOOL memory_budget {} → {used: 3047, available: 6953}
```

**You can see exactly what it's doing**, like watching a kernel manage memory.

---

## The Question You Asked

> Isn't the purpose of the session memory agent to operate on an id-description basis? And then use tool calls to manage the space, kind of like a kernel allocates memory?

**Yes! Exactly!**

The designed architecture (agent.ts) has this:
- ✅ Memory agent with tools
- ✅ ID-based operations (impulse IDs)
- ✅ Kernel-like management (inspect, allocate, load, verify)

But we implemented:
- ❌ Direct function calls
- ❌ Large prompt with all context
- ❌ Single-shot approach

**We should use the proper memory agent subagent!**

---

## The Minimal Approach (What You're Suggesting)

### Prompt to Memory Agent

```
Task: Fix bug in memory-agent.ts
Session: ses_xxx
Requirements: errorContext (REQUIRED), relatedFiles (optional)

Current state: Run memory_outline() to see.

Your job:
1. Check budget
2. Create impulses for requirements
3. Load high-priority ones
4. Report completion
```

**~150 tokens** instead of 2,900!

### Memory Agent Workflow

```
[Turn 1]
→ memory_budget({})
← {total: 10000, used: 0, available: 10000, utilization: 0%}

Thinks: "Clean slate, healthy budget"

→ memory_outline({})
← "Context Window Outline: Empty (0 impulses)"

Thinks: "Need to create impulses for errorContext and relatedFiles"

→ impulse_create({
    id: "errorContext-file",
    pointer: {type: "file", path: "src/session/memory-agent.ts"},
    budget: 2000,
    priority: "high",
    description: "Error file for bug fix"
  })
← Created

→ impulse_load({id: "errorContext-file"})
← Loaded {tokenCount: 1847}

→ memory_budget({})
← {total: 2000, used: 1847, utilization: 92.3%}

→ impulse_create({
    id: "relatedFiles-tests",
    pointer: {type: "file", path: "test/session/memory-agent.test.ts"},
    budget: 1500,
    priority: "medium"
  })
← Created

Thinks: "Have 8153 tokens left, good utilization"

Response: "Prepared context: Created 2 impulses, loaded 1 (1847 tokens). Ready for main agent."
```

**Completely observable, iterative, kernel-like!**

---

## Why This Is Better

### 1. Minimal Prompts

- Initial: ~150 tokens (task description)
- Tool returns: ~50-300 tokens each
- Total conversation: ~500-1000 tokens
- **vs 2,900 tokens in single call**

### 2. Incremental Operation

- Check state first
- Create one impulse
- See result
- Decide next action
- **vs all-or-nothing**

### 3. Observable

- Every tool call logged
- Can see decision process
- Easy to debug
- **vs opaque single call**

### 4. Fault Tolerant

- One tool fails, others continue
- Can recover mid-process
- Partial success possible
- **vs complete failure on timeout**

### 5. Matches Design

- Uses agent.ts memory agent config
- Uses existing tools (impulse_create, memory_budget, etc.)
- Follows subagent pattern
- **vs custom implementation**

---

## Why We Used the Wrong Approach

### Likely History

1. **Original design**: Memory agent subagent with tools (agent.ts)
2. **Problem**: Spawning subagent sessions is complex
3. **Shortcut**: Created SessionMemoryAgent helpers (memory-agent.ts)
4. **Issue**: Shortcut bypasses tool system
5. **Now**: Dealing with large prompts, timeouts

**We took a shortcut that avoided the proper architecture!**

---

## The Proper Implementation

### Replace prepareSessionMemory()

**Current** (wrong):
```typescript
export async function prepareSessionMemory(...) {
  // Call SessionMemoryAgent.analyzeIntent() directly
  const intent = await SessionMemoryAgent.analyzeIntent({...})
  
  // Create impulses directly
  const result = await SessionMemoryAgent.prepare({...})
}
```

**Proper** (correct):
```typescript
export async function prepareSessionMemory(...) {
  // Spawn memory agent subagent
  const memorySessionID = Identifier.ascending("session")
  
  await Session.create({
    id: memorySessionID,
    agent: "memory",  // Uses agent.ts config with tools
    mode: "subagent",
    parentSessionID: input.sessionID
  })
  
  // Give it task with minimal prompt
  await Session.prompt({
    sessionID: memorySessionID,
    agent: "memory",
    parts: [{
      type: "text",
      text: buildMemoryAgentPrompt({
        userMessage: input.promptText,
        contextRequirements: activityContextHints,
        sessionID: input.sessionID
      })
    }]
  })
  
  // Memory agent uses tools to manage context
  // When done, impulses are created in parent session
  // We return control
}

function buildMemoryAgentPrompt(input: {...}): string {
  return `Prepare context for task: "${input.userMessage}"

Target session: ${input.sessionID}
${input.contextRequirements.length > 0 ? `
Requirements: ${input.contextRequirements.map(r => `${r.key} (${r.required ? 'REQUIRED' : 'optional'}): ${r.hint}`).join(", ")}
` : ""}

Use your tools to:
1. memory_budget() - Check current state
2. memory_outline() - See allocation
3. impulse_create() - Add needed context
4. impulse_load() - Load high-priority
5. Report completion
`
  // ~150-200 tokens!
}
```

---

## Summary

**You're absolutely right!**

The memory agent should:
- ✅ Operate on ID-description basis (impulse IDs)
- ✅ Use tool calls to inspect state (memory_budget, memory_outline)
- ✅ Use tool calls to manage space (impulse_create, impulse_load, impulse_unload)
- ✅ Work like a kernel (incremental, observable, fault-tolerant)

**Not**:
- ❌ Single LLM call with huge prompt
- ❌ Direct impulse creation bypassing tools
- ❌ All-or-nothing approach

**The proper architecture exists** (agent.ts memory agent with tools), we just need to USE it instead of the SessionMemoryAgent shortcut!

This would solve:
- Timeout issues (small prompts)
- Observability (tool calls visible)
- Fault tolerance (partial success)
- RAM usage (no large prompts to cache)

**Next step**: Replace SessionMemoryAgent with proper subagent spawning that uses the tool-based memory agent from agent.ts.