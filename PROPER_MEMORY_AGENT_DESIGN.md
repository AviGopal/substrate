# Proper Memory Agent Design - Tool-Based Subagent

## The Core Insight

**The memory agent should be a subagent that uses tools**, not a single LLM call with a large prompt.

Like a kernel managing memory through syscalls, the memory agent should:
- Inspect state via tool calls (`memory_budget`, `memory_outline`)
- Allocate via tool calls (`impulse_create`)
- Load via tool calls (`impulse_load`)
- Optimize via tool calls (`memory_optimize`)

---

## Current Architecture (Wrong)

### What We Built

```typescript
// SessionMemoryAgent namespace (memory-agent.ts)
export namespace SessionMemoryAgent {
  export async function analyzeIntent(input) {
    // Build large prompt with:
    // - Project tree (1,400 tokens)
    // - Examples (500 tokens)
    // - Guidelines (500 tokens)
    // - Budget status (125 tokens)
    // Total: 2,900 tokens
    
    const result = await generateObject({
      messages: [hugeSyst emPrompt, userMessage],
      schema: Intent.shape
    })
    
    return result.object  // Suggestions as JSON
  }
  
  export async function prepare(input) {
    // Directly create impulses (no tools)
    for (const suggestion of input.intent.suggestedImpulses) {
      await SessionMemory.addImpulse(sessionID, impulse)
      if (shouldLoad) {
        await ImpulseResolver.load(impulse)
      }
    }
  }
}
```

**Issues**:
- Large prompt (2,900 tokens)
- Single LLM call (all-or-nothing)
- No tool usage (bypasses design)
- Not observable (no tool call logs)
- Not iterative (can't adjust mid-process)

---

## Proper Architecture (Correct)

### What Should Exist

**From `agent.ts:386-559`**, the memory agent is ALREADY DEFINED:

```typescript
memory: {
  name: "memory",
  mode: "subagent",  // ← Proper subagent
  tools: {
    // Inspection tools
    memory_budget: true,    // Check current state
    memory_outline: true,   // Visual allocation
    memory_optimize: true,  // Get suggestions
    impulse_list: true,     // List all impulses
    
    // Management tools
    impulse_create: true,   // Allocate new impulse
    impulse_load: true,     // Load content
    impulse_unload: true,   // Free memory
    impulse_delete: true,   // Remove impulse
    impulse_update: true,   // Modify impulse
    
    // Standard tools
    bash: true,            // For resolving pointers
    read: true,            // For file access
    grep: true,            // For searching
  }
}
```

**Use THIS agent, don't create a new one!**

---

## How It Should Work

### Step 1: Spawn Memory Agent Subagent

```typescript
export async function prepareSessionMemory(input: {
  sessionID: string
  promptText: string
  agent: string
}): Promise<void> {
  const l = log.clone().tag("session", input.sessionID)
  
  // Extract activity hints (same as before)
  const activityContextHints = await extractActivityContextHints(input.sessionID)
  
  // Create memory agent subagent session
  const memorySessionID = Identifier.ascending("session")
  
  await Session.create({
    id: memorySessionID,
    projectID: input.projectID,
    agent: "memory",  // Uses memory agent from agent.ts
    mode: "subagent",
    parentSessionID: input.sessionID,
    metadata: {
      purpose: "session-memory-preparation",
      targetSession: input.sessionID
    }
  })
  
  l.info("spawned memory agent subagent", {
    memorySessionID,
    targetSession: input.sessionID
  })
  
  // Build minimal prompt
  const memoryPrompt = buildMemoryAgentPrompt({
    userMessage: input.promptText,
    contextRequirements: activityContextHints,
    targetSession: input.sessionID
  })
  
  // Memory agent uses tools to manage context
  await Session.prompt({
    sessionID: memorySessionID,
    agent: "memory",
    parts: [{type: "text", text: memoryPrompt}]
  })
  
  l.info("memory agent completed context preparation", {
    memorySessionID,
    targetSession: input.sessionID
  })
}
```

---

### Step 2: Minimal Prompt (ID-Description Basis)

```typescript
function buildMemoryAgentPrompt(input: {
  userMessage: string
  contextRequirements: ContextRequirement[]
  targetSession: string
}): string {
  return `Prepare context for session: ${input.targetSession}

**User's task**: ${input.userMessage.slice(0, 200)}

${input.contextRequirements.length > 0 ? `
**Activity requirements**:
${input.contextRequirements.map(r => 
  `- ${r.key} (${r.required ? 'REQUIRED' : 'optional'}): ${r.hint}
   Types: ${r.impulseTypes.join(", ")}
   Budget: ${r.budgetRange[0]}-${r.budgetRange[1]} tokens`
).join("\n")}
` : ""}

**Your task**:
1. Call memory_budget() to check current context state
2. Call memory_outline() to see existing impulses
3. Create impulses matching the requirements using impulse_create()
4. Load high-priority or required impulses using impulse_load()
5. Verify final state with memory_budget()

Be efficient - only create what's truly needed based on available budget.`
}
```

**Prompt size**: ~150-250 tokens (vs 2,900!)

---

### Step 3: Memory Agent Makes Tool Calls

**The memory agent executes** (automatically, using its tool access):

```
Memory Agent Session:

[Thinking] Need to check current state
  
→ TOOL CALL: memory_budget({})
← RESULT: {
    total: 10000,
    used: 0,
    available: 10000,
    utilization: 0%
  }

[Thinking] Clean slate, can create impulses freely

→ TOOL CALL: impulse_create({
    id: "errorContext-file",
    pointer: {type: "file", path: "src/session/memory-agent.ts"},
    budget: 2000,
    priority: "high",
    description: "Error file for debugging"
  })
← RESULT: "Created impulse errorContext-file"

[Thinking] Need to load this (required context)

→ TOOL CALL: impulse_load({id: "errorContext-file"})
← RESULT: {
    id: "errorContext-file",
    tokenCount: 1847,
    content: "..." // Loaded
  }

[Thinking] Check budget after loading

→ TOOL CALL: memory_budget({})
← RESULT: {
    total: 2000,
    used: 1847,
    available: 8153,
    utilization: 18.5%
  }

[Thinking] Still have space, create test file

→ TOOL CALL: impulse_create({
    id: "relatedFiles-tests",
    pointer: {type: "file", path: "test/session/memory-agent.test.ts"},
    budget: 1500,
    priority: "medium"
  })
← RESULT: "Created impulse relatedFiles-tests"

[Response to user]
"Context prepared: Created 2 impulses (errorContext-file, relatedFiles-tests).
Loaded 1 high-priority impulse (1847 tokens). 
Current utilization: 18.5% (healthy)."
```

---

## Tool Call Observability

### What You'll See in Logs

```
INFO turn-lifecycle executing hook {session-memory-preparation}
INFO session.prompt spawned memory agent subagent {memorySessionID: ses_memory_xxx}
INFO session.prompt [ses_memory_xxx] prompt with agent=memory
INFO tool.execute tool=memory_budget {sessionID: ses_xxx}
INFO tool.result tool=memory_budget {total: 10000, used: 0}
INFO tool.execute tool=impulse_create {id: "errorContext-file", budget: 2000}
INFO tool.result tool=impulse_create {created: "errorContext-file"}
INFO tool.execute tool=impulse_load {id: "errorContext-file"}
INFO tool.result tool=impulse_load {tokenCount: 1847}
INFO tool.execute tool=memory_budget {sessionID: ses_xxx}
INFO tool.result tool=memory_budget {total: 2000, used: 1847}
INFO tool.execute tool=impulse_create {id: "relatedFiles-tests", budget: 1500}
INFO session.prompt memory agent completed context preparation
```

**Complete visibility** into what the memory agent is doing!

---

## The Kernel Analogy (Exactly What You Said)

### Memory Allocation in Kernel

```c
void* kmalloc(size_t size) {
  // 1. Check available memory
  mem_info_t info = get_mem_info();  // Syscall
  
  // 2. Find free pages
  page_t* pages = find_free_pages(size);  // Syscall
  
  // 3. Mark as allocated
  mark_allocated(pages);  // Syscall
  
  // 4. Verify
  verify_allocation(pages);  // Syscall
  
  return pages;
}
```

### Impulse Allocation in Memory Agent

```
Memory Agent:
  1. Check available tokens
  → memory_budget()  // Tool call
  
  2. See current layout
  → memory_outline()  // Tool call
  
  3. Create impulse
  → impulse_create({id, pointer, budget})  // Tool call
  
  4. Load content
  → impulse_load({id})  // Tool call
  
  5. Verify allocation
  → memory_budget()  // Tool call
  
  Done
```

**Same pattern!** Incremental, observable, fault-tolerant.

---

## Benefits Over Our Approach

| Aspect | Our Approach (Wrong) | Proper Approach (Right) |
|--------|---------------------|------------------------|
| **Prompt size** | 2,900 tokens | 150-250 tokens |
| **Timeout risk** | High (large prompt) | Low (small prompt) |
| **Observability** | Opaque (single call) | Transparent (tool calls) |
| **Iteration** | No (all-or-nothing) | Yes (incremental) |
| **Fault tolerance** | None (timeout = fail) | High (tools independent) |
| **Matches design** | No (custom code) | Yes (agent.ts config) |
| **Like kernel** | No | Yes |
| **Tool visibility** | No | Yes (in logs) |

---

## The Right Implementation

### Replace SessionMemoryAgent with Subagent Spawn

**Instead of**:
```typescript
const intent = await SessionMemoryAgent.analyzeIntent({
  sessionID, promptText, recentMessages, activityContextHints
})
const result = await SessionMemoryAgent.prepare({
  sessionID, intent, turnNumber, activityContextHints
})
```

**Do**:
```typescript
const memorySessionID = await spawnMemoryAgentSubagent({
  targetSession: sessionID,
  userMessage: promptText,
  contextRequirements: activityContextHints
})

// Memory agent uses tools autonomously
// When it completes, impulses are created in targetSession
```

**Memory agent's minimal prompt**:
```
Task: ${userMessage}
Target session: ${sessionID}
Requirements: ${requirements.map(r => `${r.key}: ${r.hint}`).join(", ")}

Use your tools (memory_budget, impulse_create, impulse_load) to prepare context.
```

**~200 tokens**, no project tree needed (it can use `read`/`grep` tools if it needs to discover files)!

---

## Summary

**You're absolutely correct** - the memory agent should:

1. **Operate on IDs** - impulse IDs, not full content
2. **Use tool calls** - memory_budget(), impulse_create(), impulse_load()
3. **Work like a kernel** - inspect, allocate, verify, iterate

**Not**:
- ❌ Single LLM call with everything upfront
- ❌ Large prompt (2,900 tokens)
- ❌ Direct function calls bypassing tools

**The proper architecture exists** in agent.ts, we just need to spawn that agent as a subagent instead of using the SessionMemoryAgent shortcut.

This would:
- ✅ Eliminate timeout issues (200-token prompts)
- ✅ Provide full observability (tool calls logged)
- ✅ Enable iteration (adjust based on results)
- ✅ Match the designed architecture
- ✅ Work like a kernel (exactly as you described)

Should I create a plan to refactor `prepareSessionMemory()` to spawn the proper memory agent subagent instead of using SessionMemoryAgent?