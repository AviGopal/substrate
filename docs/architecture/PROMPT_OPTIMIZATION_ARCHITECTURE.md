# Prompt Optimization Architecture: Treating OpenCode Like a Child

**Date:** 2026-02-19  
**Core Principle:** Give agents exactly what they need, nothing more  
**Goal:** Learn optimal conversation patterns through experimentation

---

## **The Core Insight**

> "We need to treat metabob-opencode like a child. Having overly detailed instructions that reveal a lot about the inner workings of the activity system, the impulses or other details will overwhelm it."

**The Problem**: Our validation templates are ~10,000 lines of detailed architectural explanations. This is:
- ❌ Overwhelming for the LLM
- ❌ Wastes context window
- ❌ Includes irrelevant implementation details
- ❌ Makes tasks harder, not easier

**The Solution**: "It needs to know what it needs to do to follow the procedure, and not know what it doesn't need to know."

---

## **Built-In Learning Systems (Already Exist!)**

### **1. Compression Strategies** (Per-Task Control)

Every task has a `compressionStrategy` field:

```typescript
{
  "prompt": {
    "template": "...",
    "maxTokens": 8000,
    "compressionStrategy": "filter" | "summarize" | "adaptive" | "none"
  }
}
```

**What Each Strategy Does**:

- **`none`**: No compression, full context
  - Use for: Simple tasks, small context
  - Example: "Create file X"

- **`filter`**: Remove irrelevant details
  - Use for: Focused tasks with specific requirements
  - Example: "Fix bug in function foo()" - filter to just foo()

- **`summarize`**: Condense context to key points
  - Use for: Tasks needing overview, not details
  - Example: "Review PR" - summaries of changes, not full diffs

- **`adaptive`**: Dynamically adjust based on context size
  - Use for: Variable complexity tasks
  - Example: "Refactor module" - adapt based on module size

**This is already implemented!** The system can experiment with different strategies per task.

### **2. Token Budgets** (Context Window Management)

```typescript
{
  "prompt": {
    "maxTokens": 8000,  // How much context this task gets
  },
  "impulses": [
    {
      "id": "context",
      "budget": 2000,  // How much this specific impulse can use
      "priority": "high"
    }
  ]
}
```

**Budget Hierarchy**:
```
Model Context (200K) 
  → Task maxTokens (8K default)
    → Impulse budgets (2K each)
      → Actual content (truncated if needed)
```

**Learning Opportunity**: Experiment with different token allocations per task type.

### **3. Task Metrics** (Automatic Tracking)

Every task execution records:

```typescript
{
  "metrics": {
    "successRate": 0.85,        // How often this task succeeds
    "avgTokens": 6543,          // Average tokens used
    "avgDuration": 12.3,        // Average time in seconds
    "commonFailures": [         // What goes wrong
      "undefined variable",
      "file not found"
    ]
  }
}
```

**Stored where**: Backend (metabob-rpc-api) per task, per template variant

**Learning Signal**: If avgTokens is low but successRate is high → task is efficient

### **4. Thompson Sampling** (Variant Selection)

The backend already learns which template variants work best:

```
Variant A: alpha=10, beta=2  → 83% success rate
Variant B: alpha=15, beta=1  → 94% success rate

Thompson Sampling → Picks B 85% of time, A 15% of time
```

**This applies to prompt variants!**

If we create two versions of a task prompt:
- Verbose version (10K tokens)
- Concise version (2K tokens)

Thompson Sampling will naturally favor the one that succeeds more often.

---

## **What Kinds of Conversation Sequences to Promote?**

### **Anti-Pattern: Overwhelming Detail**

```
❌ BAD PROMPT (What we created in validation templates):

# Task: Test Template Registration

## Architecture Overview
The activity system uses a 3-component architecture...
[5000 lines of explanation]

## Template Storage Internals
Templates are stored in SQLite database with the following schema...
[2000 lines of schema documentation]

## Thompson Sampling Algorithm
The backend uses Beta distribution...
[1000 lines of statistics]

## Your Task
Register a template.
```

**Problems**:
- 99% irrelevant to task
- Wastes 8K tokens on background
- Actual instructions buried
- Agent confused about what matters

### **Pattern: Focused Instruction**

```
✅ GOOD PROMPT:

# Task: Register Template

Register the template file and verify storage.

**Steps**:
1. Register: `curl -X POST {{backendUrl}}/v2/activities/templates -d @template.json`
2. Verify: `curl {{backendUrl}}/v2/activities/templates/{{templateId}}`
3. Check response has all fields (tasks, variables, validation)

**Output**:
```json
{
  "registration": {"success": true, "templateId": "..."},
  "verification": {"allFieldsPresent": true}
}
```

**Success**: Template registered and retrievable
```

**Benefits**:
- ✅ ~200 tokens vs 8000
- ✅ Clear steps
- ✅ Expected output format
- ✅ Success criteria explicit

### **Pattern: Progressive Disclosure**

Instead of dumping all context upfront, provide it **when needed**:

```typescript
{
  "tasks": [
    {
      "id": "analyze",
      "prompt": {
        "template": "Analyze {{codeFile}} for bugs.",
        "maxTokens": 4000,
        "compressionStrategy": "filter",  // Just the code
        "impulses": [
          {
            "id": "codeFile",
            "type": "file",
            "budget": 3000,  // Most of context
            "priority": "high"
          }
        ]
      }
    },
    {
      "id": "fix",
      "dependencies": ["analyze"],
      "prompt": {
        "template": "Fix bugs found:\n{{analyzeOutput}}\n\nUse pattern: {{fixPattern}}",
        "maxTokens": 6000,
        "impulses": [
          {
            "id": "analyzeOutput",  // Results from task 1
            "type": "activityOutput",
            "budget": 2000
          },
          {
            "id": "fixPattern",     // NEW context, only when needed
            "type": "file",
            "budget": 3000
          }
        ]
      }
    }
  ]
}
```

**Key Insight**: Task 2 doesn't need the full codeFile again, just the analysis output + fix patterns.

### **Pattern: Conversational Scaffolding**

Guide the agent through a **thought process**, not just commands:

```
✅ SCAFFOLDED PROMPT:

# Task: Implement Authentication

**What we're building**: JWT-based auth with refresh tokens

**Why this approach**: 
- Stateless (no session storage)
- Secure (signed tokens)
- Standard (OAuth2 pattern)

**Your steps**:
1. Create token generation function
2. Create token validation middleware  
3. Create refresh endpoint
4. Add tests for each

**For each step**:
- Explain your approach first
- Implement
- Verify it works

**Success**: All tests pass, no security issues
```

**This is like teaching a child**:
1. Tell them the goal (what)
2. Explain reasoning (why)
3. Break into steps (how)
4. Let them explain their thinking (metacognition)
5. Define success clearly (done)

---

## **How to Learn Optimal Patterns**

### **Method 1: A/B Testing via Template Variants**

Create two variants of same task with different prompt styles:

```json
// Base variant: Detailed explanation
{
  "id": "implement-auth-verbose",
  "prompt": {
    "template": "[10K token explanation of auth systems]\n\nImplement JWT auth...",
    "maxTokens": 12000
  }
}

// Variant 1: Concise instruction
{
  "id": "implement-auth-concise", 
  "prompt": {
    "template": "Implement JWT auth:\n1. Generate token\n2. Validate token\n3. Refresh token\n\nPattern: {{authPattern}}",
    "maxTokens": 4000,
    "impulses": [
      { "id": "authPattern", "type": "file", "budget": 2000 }
    ]
  }
}
```

**Thompson Sampling will naturally favor the variant that**:
- ✅ Succeeds more often
- ✅ Completes faster
- ✅ Costs less

**No manual intervention needed!**

### **Method 2: Compression Strategy Experiments**

Same task, different strategies:

```json
// Variant A: No compression (control)
{ "compressionStrategy": "none", "maxTokens": 8000 }

// Variant B: Filter irrelevant details
{ "compressionStrategy": "filter", "maxTokens": 8000 }

// Variant C: Summarize context
{ "compressionStrategy": "summarize", "maxTokens": 8000 }

// Variant D: Adaptive (system decides)
{ "compressionStrategy": "adaptive", "maxTokens": 8000 }
```

**Track metrics**:
- Success rate (which completes successfully)
- Token usage (which uses least context)
- Duration (which is fastest)

**Winner**: Highest success rate + lowest cost

### **Method 3: Token Budget Optimization**

Experiment with different budget allocations:

```json
// Variant A: Balanced
{
  "maxTokens": 8000,
  "impulses": [
    { "id": "code", "budget": 4000 },
    { "id": "docs", "budget": 2000 },
    { "id": "tests", "budget": 2000 }
  ]
}

// Variant B: Code-heavy
{
  "maxTokens": 8000,
  "impulses": [
    { "id": "code", "budget": 6000 },
    { "id": "docs", "budget": 1000 },
    { "id": "tests", "budget": 1000 }
  ]
}

// Variant C: Minimal
{
  "maxTokens": 4000,
  "impulses": [
    { "id": "code", "budget": 3000 },
    { "id": "docs", "budget": 500 },
    { "id": "tests", "budget": 500 }
  ]
}
```

**Question**: Which budget allocation produces best results for this task type?

**Answer**: Metrics + Thompson Sampling tell us!

### **Method 4: Conversational Pattern Learning**

Track **what the agent actually uses** from context:

```typescript
// Hypothetical future feature
{
  "metrics": {
    "contextUtilization": {
      "codeFile": {
        "provided": 3000,   // Tokens in impulse
        "referenced": 1200, // Tokens agent actually used
        "efficiency": 0.40  // 40% utilization
      },
      "documentation": {
        "provided": 2000,
        "referenced": 50,   // Agent barely used it!
        "efficiency": 0.025 // 2.5% utilization
      }
    }
  }
}
```

**Learning Signal**: If documentation impulse has 2.5% efficiency → reduce its budget or remove it

**How to implement**: 
1. Track which impulse IDs appear in agent's tool calls
2. Track which impulse IDs appear in agent's reasoning
3. Compare to what was provided
4. Adjust budgets in variants

---

## **Existing Infrastructure to Leverage**

### **1. Impulse System = Controlled Context**

Every piece of context is an impulse with:
- Type (file, activityOutput, memo, etc.)
- Budget (max tokens)
- Priority (high, medium, low)
- Usage tracking (loadCount, totalCost)

**Already supports**: Experimentation at granular level

### **2. Template Variants = Experimentation Framework**

Backend already supports:
- Creating variants
- A/B testing via Thompson Sampling
- Metrics collection per variant
- Automatic selection of best variant

**Already supports**: Prompt optimization through natural selection

### **3. Task Metrics = Learning Signals**

Every task execution records:
- Success/failure
- Token usage
- Duration
- Common failure patterns

**Already supports**: Identifying what works and what doesn't

### **4. Compression Strategies = Built-In Optimization**

System already has 4 strategies:
- none, filter, summarize, adaptive

**Already supports**: Automatic context reduction

---

## **Proposed Prompt Design Guidelines**

### **Principle 1: Instruction-First Design**

```
1. What to do (clear goal)
2. How to do it (steps)
3. What success looks like (criteria)
4. Context (only what's needed, via impulses)
```

**NOT**: Background → Theory → Architecture → Eventually instructions

### **Principle 2: Progressive Disclosure**

```
Task 1: Analyze (needs: code)
Task 2: Plan (needs: analysis + patterns)
Task 3: Implement (needs: plan + examples)
Task 4: Test (needs: implementation)
```

**Each task gets ONLY what it needs at THAT step**

### **Principle 3: Compression by Default**

```
Default: compressionStrategy: "filter"
Unless: Task explicitly needs full context
```

**Rationale**: Most tasks don't need everything

### **Principle 4: Budget Discipline**

```
Simple tasks: 2K-4K tokens
Medium tasks: 4K-8K tokens
Complex tasks: 8K-12K tokens
```

**Rationale**: Force clarity through constraint

### **Principle 5: Impulse Isolation**

```
Separate impulses for:
- Input data (what to process)
- Reference patterns (how to process)
- Previous results (context from earlier tasks)
- Error context (only if retrying)
```

**Rationale**: Fine-grained budget control

### **Principle 6: Explicit Success Criteria**

```
Every prompt ends with:

**Success Criteria**:
- ✅ File X exists
- ✅ Tests pass
- ✅ Output contains Y
```

**Rationale**: Agent knows when done

---

## **Metrics to Track**

### **Per-Task Metrics** (Already Tracked)

- Success rate
- Average tokens
- Average duration
- Common failures

### **Per-Variant Metrics** (Already Tracked)

- Success rate (alpha/beta)
- Selection frequency (Thompson Sampling)
- Cost efficiency
- Time efficiency

### **New Metrics to Add** (Future)

1. **Context Utilization**
   - What % of provided context was actually used?
   - Which impulses were referenced in tool calls?
   - Which impulses appeared in reasoning?

2. **Prompt Effectiveness**
   - Time to first correct action
   - Number of retry attempts
   - Frequency of asking for clarification

3. **Cognitive Load**
   - Tokens in instructions vs impulses
   - Ratio of signal (relevant) to noise (irrelevant)
   - Complexity score (nesting depth, sentence length)

4. **Conversation Quality**
   - Clear goal statement: yes/no
   - Step-by-step breakdown: yes/no
   - Success criteria explicit: yes/no
   - Explanation-to-action ratio

---

## **Implementation Roadmap**

### **Phase 1: Audit Existing Prompts** (Week 1)

**Goal**: Identify verbose, overwhelming prompts

**Process**:
1. List all task prompts across all templates
2. Calculate tokens per prompt
3. Identify prompts >5K tokens
4. Categorize: Architecture explanation, Theory, Unnecessary detail

**Output**: List of prompts to refactor

### **Phase 2: Create Concise Variants** (Week 2)

**Goal**: A/B test verbose vs concise

**Process**:
1. For each verbose prompt, create concise variant
2. Keep instructions, remove explanations
3. Move context to impulses
4. Set compressionStrategy: "filter"

**Output**: Variant pairs ready for testing

### **Phase 3: Run Experiments** (Week 3-4)

**Goal**: Let Thompson Sampling pick winners

**Process**:
1. Execute both variants in parallel
2. Track metrics (success rate, tokens, duration)
3. Let Thompson Sampling shift probability
4. Monitor which variants dominate

**Output**: Data on which prompt style works

### **Phase 4: Establish Guidelines** (Week 5)

**Goal**: Codify learnings

**Process**:
1. Analyze winning patterns
2. Identify common traits (length, structure, style)
3. Create prompt templates
4. Document guidelines

**Output**: Prompt design handbook

### **Phase 5: Automate** (Week 6+)

**Goal**: System learns automatically

**Process**:
1. Build prompt analyzer (token counter, complexity scorer)
2. Build prompt generator (creates variants automatically)
3. Build prompt optimizer (adjusts based on metrics)
4. Integrate with template evolution system

**Output**: Self-optimizing prompts

---

## **Example Refactor: Validation Template**

### **Before (10K tokens)**

```
# Task: Test Template Registration

## Background: Activity System Architecture

The activity system is composed of three main components that work together
in a distributed fashion. The backend (metabob-rpc-api) serves as the source
of truth for all template definitions and stores them in a SQLite database
with the following schema...

[5000 lines of architecture documentation]

## Template Storage Implementation

Templates are stored using the Storage abstraction which wraps filesystem
access with a key-value interface. The storage path is determined by...

[2000 lines of storage internals]

## Thompson Sampling Algorithm

The backend uses Thompson Sampling for variant selection, which is a 
Bayesian approach to the multi-armed bandit problem. The algorithm
maintains alpha and beta parameters for each variant...

[2000 lines of statistics]

## Your Task

Now that you understand the system, register the template by posting to
the backend API endpoint.

**Step 1**: Register template
```bash
curl -X POST {{backendUrl}}/v2/activities/templates -d @template.json
```

[Buried instructions]
```

### **After (300 tokens)**

```
# Task: Register Template

Register test template and verify storage.

**Input**: {{templateFile}}

**Steps**:
1. Register: POST to {{backendUrl}}/v2/activities/templates
2. Capture template ID from response
3. Verify: GET {{backendUrl}}/v2/activities/templates/[id]
4. Check response has: tasks, variables, validation

**Output**:
```json
{
  "registration": {"success": true, "templateId": "..."},
  "verification": {"allFieldsPresent": true}
}
```

**Success**: Template stored and retrievable with all fields intact
```

**Reduction**: 10K → 0.3K tokens (97% reduction)  
**Clarity**: Instructions first, not buried  
**Context**: Moved to impulse (templateFile)  

---

## **Key Takeaways**

1. **System Already Supports This**
   - Compression strategies ✅
   - Token budgets ✅
   - Variant testing ✅
   - Metrics collection ✅

2. **Treat OpenCode Like a Child**
   - Clear instructions
   - Simple language
   - One step at a time
   - Immediate feedback

3. **Learn Through Experimentation**
   - Create prompt variants
   - Let Thompson Sampling pick winners
   - Track what agents actually use
   - Iterate based on data

4. **"It needs to know what it needs to do, not know what it doesn't need to know"**
   - Instructions: What, How, Success criteria
   - Context: Via impulses, budget-controlled
   - Background: Rarely needed, expensive

5. **The System Can Optimize Itself**
   - Variants compete
   - Metrics decide winners
   - Bad prompts naturally fade out
   - Good prompts naturally selected

**The infrastructure exists. We just need to use it.**

---

## **Next Actions**

1. **Audit validation templates** we just created (too verbose)
2. **Create concise variants** following guidelines above
3. **Register both** and let Thompson Sampling decide
4. **Analyze results** after 10+ executions each
5. **Document winning patterns** for future templates
6. **Build prompt analyzer tool** to flag verbose prompts
7. **Integrate with template creation activity** (auto-suggest concise version)

The goal: **Prompts that get the job done with minimal cognitive load.**
