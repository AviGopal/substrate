# Why Impulses Shouldn't (Usually) Define Agents

## Your Question

> "Why shouldn't we use impulses to define what tools are needed, who the agent is and what model to use?"

## The Short Answer

**You CAN and SHOULD use impulses for dynamic agent configuration in specific scenarios**, but the current architecture has good reasons for keeping most agent config static. Let me explain both approaches and when each makes sense.

---

## Two Approaches to Agent Configuration

### Approach 1: Static Agent Configuration (Current Default)

**Where:** `repos/metabob-opencode/packages/opencode/src/agent/agent.ts`

```typescript
memory: {
  name: "memory",
  model: { providerID: "anthropic", modelID: "claude-4-5-haiku" },
  prompt: "You are the Memory Agent responsible for...",
  tools: { impulse_create: true, impulse_load: true, ... },
  mode: "subagent"
}
```

**Characteristics:**
- ✅ Defined once at startup
- ✅ Consistent across all uses
- ✅ Type-safe and validated
- ✅ Easy to audit and understand
- ✅ Performance: No runtime resolution overhead
- ❌ Not adaptable per task
- ❌ Can't vary by component

### Approach 2: Dynamic Agent Configuration via Impulses (Planned/Partial)

**Where:** `ComponentAgentSpec` in activity templates

```typescript
componentAgents: [
  {
    componentPattern: "src/auth/**/*.ts",
    impulseSpecs: [
      { type: "metabobAnnotation", budget: 2000, priority: "high" },
      { type: "metabobIssue", budget: 1500, priority: "medium" },
      { type: "file", budget: 3000, priority: "high" }
    ],
    agentInstructions: "You are a specialized auth component agent...",
    consistencyRules: ["Follow JWT best practices", "Use bcrypt for hashing"]
  }
]
```

**Characteristics:**
- ✅ Adaptable per component/context
- ✅ Can specify different tools/models per file pattern
- ✅ Learns from component-specific history
- ✅ Scales to many micro-agents
- ❌ More complex to debug
- ❌ Runtime overhead
- ❌ Harder to audit

---

## When to Use Each Approach

### Use Static Agent Config (agent.ts) When:

1. **Role is well-defined and consistent**
   - ✅ Memory agent: Always manages impulses, always uses Haiku
   - ✅ Review agent: Always reviews code, always needs metabob tools
   - ✅ Config agent: Always edits config, always needs schema validation

2. **Tool requirements don't vary**
   - ✅ Memory agent needs impulse_* tools in 100% of uses
   - ✅ Activity agent needs bash, edit, read in 100% of uses

3. **Model choice is based on role complexity, not context**
   - ✅ Memory = Haiku (fast, cheap decisions)
   - ✅ Activity = Sonnet (complex implementation)
   - ✅ Review = Sonnet (thorough analysis)

4. **Security/governance requires consistent behavior**
   - ✅ Audit trail: "memory agent always has these permissions"
   - ✅ Cost control: "review agent always uses Sonnet (budgeted)"

5. **You want simple, predictable behavior**
   - ✅ "What tools does memory agent have?" → Look at agent.ts
   - ❌ Dynamic: "Depends on which template, which component, which impulses..."

### Use Dynamic Agent Config (ComponentAgentSpec) When:

1. **Agent behavior varies by component type**
   - ✅ Auth components: Need security scanning tools
   - ✅ UI components: Need accessibility checking tools
   - ✅ DB components: Need migration validation tools

2. **Context determines tool requirements**
   - ✅ Working on TypeScript: Need tsc, eslint
   - ✅ Working on Python: Need mypy, black
   - ✅ Working on SQL: Need sqlfluff, migration tools

3. **Model choice should adapt to task complexity**
   - ✅ Simple refactor: Use Haiku (cheap, fast)
   - ✅ Complex algorithm: Use Sonnet (expensive, smart)
   - ✅ Creative design: Use Opus (most expensive, most creative)

4. **Specialized micro-agents per component**
   - ✅ Each auth component has its own historical context
   - ✅ Each API endpoint has its own design patterns
   - ✅ Each test suite has its own conventions

5. **Learning improves over time**
   - ✅ "Auth components always need these 5 impulses"
   - ✅ "DB migrations always use this model"
   - ✅ "Test files rarely need metabob context"

---

## The Vision: Metabob-Driven Micro-Agents

**What the ComponentAgentSpec enables:**

```typescript
// Activity discovers components to modify
const components = await metabob.discoverComponents("Add JWT authentication")
// Returns:
// 1. src/auth/user.ts::authenticate
// 2. src/auth/jwt.ts::generateToken
// 3. src/session/session.ts::createSession
// 4. test/auth/auth.test.ts::jwtTests

// For EACH component, generate a specialized micro-agent
for (const component of components) {
  // Find matching ComponentAgentSpec from template
  const spec = template.componentAgents.find(s => 
    minimatch(component.file, s.componentPattern)
  )
  
  // Create impulses based on spec
  const impulses = await Promise.all(
    spec.impulseSpecs.map(impulseSpec => 
      createImpulse({
        type: impulseSpec.type,
        file: component.file,
        component: component.name,
        budget: impulseSpec.budget,
        priority: impulseSpec.priority
      })
    )
  )
  
  // Execute with micro-agent context
  await executeTask({
    prompt: interpolate(spec.agentInstructions, { component, impulses }),
    tools: deriveToolsFromImpulses(impulses),  // Dynamic tool selection!
    model: selectModelByComplexity(component.complexity),  // Dynamic model!
    impulses
  })
}
```

**What this enables:**

1. **Component-Specific Context**
   - Each micro-agent gets historical annotations for THAT component
   - Each micro-agent sees co-change patterns for THAT file
   - Each micro-agent receives impact warnings for THAT function

2. **Dynamic Tool Selection**
   - Auth components: Get security scanning tools
   - API components: Get OpenAPI validation tools
   - Test components: Get coverage analysis tools

3. **Adaptive Model Selection**
   - Simple getters/setters: Haiku ($0.001)
   - Complex algorithms: Sonnet ($0.02)
   - Architecture design: Opus ($0.10)

4. **Learning Across Executions**
   - "98% of auth component tasks succeed with these 3 impulses"
   - "JWT components always need these tools"
   - "Session components always co-change with auth"

---

## Why Not Use Dynamic Config Everywhere?

### Reason 1: Complexity vs Benefit

**Static is simpler** for common cases:
```typescript
// Simple: Look up memory agent
const agent = await Agent.get("memory")
// Tools: agent.tools
// Model: agent.model
// Done!
```

**Dynamic adds indirection:**
```typescript
// Complex: Find component pattern
const spec = findMatchingSpec(component.file, template.componentAgents)
// Resolve impulse specs
const impulses = await resolveImpulseSpecs(spec.impulseSpecs, component)
// Derive tools from impulse types
const tools = deriveToolsFromImpulses(impulses)
// Select model by complexity
const model = selectModelByComplexity(component.complexity, spec.suggestedModels)
// Execute
await execute({ tools, model, impulses })
```

**When 80% of tasks use the same agent config, static wins.**

### Reason 2: Debuggability

**Static config error:**
```
❌ Memory agent missing impulse_create tool
→ Look at agent.ts line 390
→ Add: impulse_create: true
→ Fixed in 30 seconds
```

**Dynamic config error:**
```
❌ Micro-agent for auth/user.ts missing JWT validation tool
→ Which template generated this micro-agent?
→ Which ComponentAgentSpec matched auth/user.ts?
→ Which impulseSpec should have included JWT tools?
→ Why wasn't JWT tool derived from impulse types?
→ Is this a pattern matching issue or impulse resolver bug?
→ 30 minutes of debugging
```

### Reason 3: Cost Predictability

**Static config:**
```
Memory agent: Always Haiku = $0.001/task
Review agent: Always Sonnet = $0.02/task
Budget: $100/month → 5000 memory tasks, 5000 review tasks
```

**Dynamic config:**
```
Component agents: Haiku to Opus depending on complexity
Simple components: $0.001/task (80%)
Complex components: $0.02/task (15%)
Architecture components: $0.10/task (5%)
Budget: $100/month → ??? tasks (highly variable)
→ Need ML model to predict costs
→ Need fallback when budget exceeded
→ Need monitoring and alerts
```

### Reason 4: Security & Governance

**Static config:**
```
✅ "Memory agent can edit files? Check agent.ts"
✅ "Review agent has bash access? Check agent.ts"
✅ Audit log: "memory agent (v1.2.3) executed with tools: [...]"
```

**Dynamic config:**
```
❌ "Can this component agent edit files?"
   → Depends on which template
   → Depends on which ComponentAgentSpec matched
   → Depends on which impulses were loaded
   → Depends on runtime context
→ Audit trail is complex: "Component agent (generated from template X, 
   spec Y, impulses Z) executed with tools: [...]"
```

### Reason 5: Performance

**Static config:**
```typescript
// Startup: Parse agent.ts (once)
const agents = parseAgentDefinitions()  // 10ms

// Runtime: Hash lookup
const agent = agents.get("memory")  // 0.001ms
```

**Dynamic config:**
```typescript
// Per task:
const spec = findMatchingSpec(file, componentAgents)  // 5ms (glob matching)
const impulses = await resolveImpulseSpecs(spec)  // 50ms (load annotations)
const tools = deriveToolsFromImpulses(impulses)  // 10ms (analysis)
const model = selectModel(complexity, spec)  // 1ms
// Total: 66ms overhead per task
```

For 1000 tasks: 66 seconds of overhead vs 1ms

---

## The Hybrid Approach (Best of Both Worlds)

**What OpenCode currently does:**

### Static Base Agents (agent.ts)
Define 8 core agents with consistent roles:
- activity, plan, review (primary agents)
- memory, general, config, session, tool (subagents)

Each has:
- Well-defined system prompt
- Core tool set
- Default model
- Clear permissions

### Dynamic Micro-Agents (ComponentAgentSpec) - Planned
For component-level work, generate specialized agents:
- Match component by file pattern
- Load component-specific impulses
- Inject historical context
- Add specialized tools dynamically
- Adapt model to complexity

### Example: Auth Component Modification

```typescript
// PHASE 1: Use static "activity" agent for discovery
const discoveryTask = {
  subagent: "activity",  // Static agent from agent.ts
  prompt: "Use metabob to discover auth components needing changes"
}

// PHASE 2: Generate micro-agents per component
const microAgents = components.map(comp => ({
  // Base: Copy static agent config
  ...Agent.get("general"),
  
  // Override: Add component-specific context
  systemPrompt: `${Agent.get("general").prompt}
  
  You are now working on: ${comp.file}::${comp.component}
  ${spec.agentInstructions}`,
  
  // Override: Add component-specific impulses
  impulses: await loadComponentImpulses(comp, spec.impulseSpecs),
  
  // Override: Add component-specific tools (if needed)
  tools: {
    ...Agent.get("general").tools,
    ...deriveToolsFromImpulses(spec.impulseSpecs)
  },
  
  // Override: Adapt model to component complexity
  model: selectModelByComplexity(comp.complexity, spec.suggestedModels)
}))
```

**Result:**
- ✅ Static agents for high-level work (discovery, planning, review)
- ✅ Dynamic micro-agents for component-level work (modifications, tests)
- ✅ Best of both: Simple when possible, adaptive when beneficial

---

## Current Implementation Status

### ✅ Fully Implemented
1. Static agent configuration (agent.ts)
2. Impulse system with lazy loading
3. Activity template task execution
4. Impulse context injection
5. ComponentAgentSpec schema definition

### 🚧 Partially Implemented
1. ComponentAgentSpec is defined in schema but NOT used in execution
2. Micro-agent generation logic NOT implemented
3. Dynamic tool derivation NOT implemented
4. Model selection by complexity NOT implemented

### 📋 Planned (from metabob-driven-activities.md)
1. Discovery task templates
2. Component task generator
3. Per-component impulse creation
4. Micro-agent execution flow
5. Post-activity learning

---

## Practical Recommendation

### For Most Activities: Use Static Agents
```typescript
// Template: fix-bug-complete
{
  "tasks": [
    { "subagent": "general", ... },  // Static agent
    { "subagent": "general", ... },  // Static agent
    { "subagent": "general", ... }   // Static agent
  ]
}
```

**Why:**
- Simple
- Debuggable
- Predictable cost
- Consistent behavior

### For Component-Heavy Activities: Use Dynamic Micro-Agents
```typescript
// Template: refactor-architecture
{
  "tasks": [
    {
      "subagent": "activity",  // Static agent for discovery
      "prompt": "Discover components to refactor"
    },
    // Then generate micro-agents dynamically
  ],
  "componentAgents": [
    {
      "componentPattern": "src/auth/**/*.ts",
      "impulseSpecs": [...],
      "agentInstructions": "Specialized auth agent..."
    },
    {
      "componentPattern": "src/api/**/*.ts",
      "impulseSpecs": [...],
      "agentInstructions": "Specialized API agent..."
    }
  ]
}
```

**Why:**
- Each component gets specialized context
- Historical annotations loaded per component
- Co-change patterns applied correctly
- Learning compounds over time

---

## Summary

**Should you use impulses to define agents?**

- ❌ **For core roles (memory, review, config)**: NO - Use static agent.ts
- ✅ **For component-specific work**: YES - Use ComponentAgentSpec
- ⚠️ **For most activity tasks**: MAYBE - Evaluate complexity vs benefit

**The architecture supports both:**
- Static agents (agent.ts) for consistency and simplicity
- Dynamic micro-agents (ComponentAgentSpec) for adaptability and learning

**The future vision:**
- Activity discovers components dynamically (via Metabob)
- Each component gets a specialized micro-agent
- Micro-agents have component-specific context, tools, and models
- System learns optimal configurations over time

**Current reality:**
- Static agents work great for 95% of tasks
- Dynamic micro-agents are designed but not fully implemented
- Hybrid approach provides best of both worlds

Use static agents until you hit a clear limitation, then consider dynamic configuration for that specific use case.
