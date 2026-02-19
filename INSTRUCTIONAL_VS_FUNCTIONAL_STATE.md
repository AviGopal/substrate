# Instructional vs Functional State: The Core Architecture Principle

**Date:** 2026-02-19  
**Core Insight:** Systems have two types of state with fundamentally different properties  
**Goal:** Use non-deterministic transitions as glue to run deterministic transitions effectively

---

## The Fundamental Distinction

### **Functional State** (Deterministic)

```
Code + Tools + Scripts + Data
```

**Properties:**
- ✅ **Reliable**: Given input X, always produces output Y
- ❌ **Not Robust**: Single error → complete failure
- ✅ **Deterministic transitions**: State A → State B is predictable
- ✅ **Verifiable**: Can test, validate, prove correctness
- ❌ **Brittle**: Edge cases break the system

**Examples:**
```typescript
// Deterministic: Same input → Same output
function add(a: number, b: number): number {
  return a + b  // Always correct
}

// Deterministic: Clear state transition
git commit -m "message"  // Files: modified → committed

// Deterministic: Validated transformation
curl POST /api/templates -d @template.json  // JSON → Stored
```

**State Transitions:**
```
File doesn't exist → [create file] → File exists
Code has bug → [apply patch] → Bug fixed
Data in A → [move script] → Data in B
```

**Failure Mode**: **Complete failure**
- File system full → script crashes
- Invalid JSON → API rejects
- Missing dependency → build fails
- **No partial success** - it works or it doesn't

---

### **Instructional State** (Non-Deterministic)

```
LLM Context Window + Human Understanding + Prompts
```

**Properties:**
- ❌ **Not Reliable**: Given input X, might produce Y, or Z, or W
- ✅ **Robust**: Fuzzy understanding still gets "close enough"
- ❌ **Non-deterministic transitions**: State A → State B is unpredictable
- ❌ **Not Verifiable**: Can't prove correctness, only observe outcomes
- ✅ **Resilient**: Handles ambiguity, missing info, edge cases

**Examples:**
```typescript
// Non-deterministic: Same prompt → Different outputs
LLM("Fix the bug") 
  → Might fix it correctly
  → Might fix wrong bug
  → Might introduce new bug
  → Might ask for clarification

// Non-deterministic: Fuzzy state
Human reads docs → Understands (maybe)
  → Might understand correctly
  → Might misunderstand
  → Might partially understand
  → Might remember wrong

// Non-deterministic: Context-dependent
Prompt: "Implement authentication"
  → If context has JWT example → Uses JWT
  → If context has OAuth example → Uses OAuth
  → If context has both → Chooses based on ???
```

**State Transitions:**
```
Don't know how to do X → [read docs, think, ask] → Maybe know how to do X
Task unclear → [reason, infer, guess] → Task somewhat clear
Problem exists → [analyze, hypothesize, test] → Problem maybe solved
```

**Failure Mode**: **Graceful degradation**
- Partial understanding → Gets most of it right
- Missing context → Makes reasonable assumptions
- Ambiguous instruction → Picks most likely interpretation
- **Partial success** - might work, might be close, might need iteration

---

## The Core Architecture Principle

> **"Use non-deterministic transitions as glue to run deterministic transitions effectively"**

### What This Means

**Traditional Approach (Fails)**:
```
LLM does everything → Unreliable, unpredictable, can't validate
```

**Our Approach (Works)**:
```
LLM (instructional) → Identifies what to do
  ↓
Deterministic tools (functional) → Actually does it
  ↓
LLM (instructional) → Interprets results, decides next step
  ↓
Deterministic tools (functional) → Does next thing
```

**The LLM is the "glue"** that:
1. Understands fuzzy human intent
2. Translates to concrete tool calls
3. Interprets deterministic results
4. Decides what to do next
5. Handles unexpected situations

**The tools are the "workers"** that:
1. Execute reliably
2. Fail loudly and clearly
3. Produce verifiable results
4. Maintain system integrity
5. Don't "guess" - they work or error

---

## Why "Verbosity" Isn't The Issue

### The Original Misunderstanding

**I said**: "Our templates are too verbose (10K tokens when 300 would work)"

**You corrected**: 
> "The verbosity of the templates is not something we can know. If 300k tokens are needed then they are needed."

### Why You're Right

The LLM's behavior depends on **what's in its context window at decision time**. The question isn't:

- ❌ "How short can we make the prompt?"
- ❌ "What's the minimum viable instruction?"

The question is:

- ✅ **"What needs to be in the LLM's head to reliably trigger the right deterministic transitions?"**

### Example: Authentication Implementation

**Scenario**: Task is "Implement JWT authentication"

**Attempt 1: Minimal** (300 tokens)
```
# Task: Implement JWT authentication

Use bcrypt for passwords. Create token generation function.

Success: Tests pass
```

**What happens**:
- LLM has fuzzy understanding of JWT
- Might use wrong library
- Might implement insecurely  
- Might forget refresh tokens
- **Non-deterministic**: Sometimes works, often doesn't

**Attempt 2: With Context** (10K tokens)
```
# Task: Implement JWT authentication

## Reference Implementation (impulse: 5K tokens)
[Shows working JWT code from similar project]

## Security Requirements (impulse: 2K tokens)
[Lists specific security constraints]

## Project Patterns (impulse: 2K tokens)
[Shows how this project structures auth]

## Your Task (1K tokens)
Implement JWT matching the patterns above.

Success: Tests pass, security audit passes
```

**What happens**:
- LLM sees concrete example
- Understands project-specific patterns
- Has security constraints in context
- **More deterministic**: Usually works correctly

### The Real Question

**Not**: "Is 10K too verbose?"

**Is**: "Does this 10K context window content reliably cause the LLM to invoke the right deterministic tools in the right sequence?"

**If yes** → Keep the 10K  
**If no** → Change what the 10K contains (not how much)

---

## LLM Sensitivity to Context

### The "Fuzzyness Problem"

> "The issue with LLMs is their fuzzyness and sensitivity to specifically what is in their 'brain' (the context window) at any given point."

**What this means**:

**Same prompt, different context → Different behavior**

```typescript
// Context A: Has file reading example
LLM("Process the data")
  → Uses fs.readFile() because saw it in context

// Context B: Has HTTP fetch example  
LLM("Process the data")
  → Uses fetch() because saw it in context

// Context C: Has both examples
LLM("Process the data")
  → Uses ??? (depends on which was seen last, which was more prominent, token position, moon phase)
```

**The LLM doesn't "decide" rationally** - it predicts tokens based on patterns in context.

**What's in context = What patterns it can match = What it will do**

### Implications for Template Design

**We can't make prompts "shorter"**. We can only:

1. **Optimize what's in the context**
   - Remove irrelevant patterns
   - Add relevant examples
   - Structure for clarity

2. **Experiment to find what works**
   - Try different context combinations
   - Measure success rates
   - Let Thompson Sampling pick winner

3. **Accept that we don't know a priori**
   - 300 tokens might work
   - 300K tokens might be needed
   - Only metrics tell us

---

## Learning What Needs to Be in Their Head

### The Gradient Question

> "We aim to learn what needs to be in their head in order to get them to manage the functional state"

**What we're trying to learn**:

**Question**: What context causes LLM to reliably invoke deterministic tools correctly?

**Not**:
- ❌ "How short can we make it?"
- ❌ "What's the minimum explanation?"

**But**:
- ✅ "What patterns, examples, and structure produce reliable tool invocation?"
- ✅ "What impulse combinations lead to correct state transitions?"
- ✅ "What's the relationship between context and success?"

### The Learning Process

```
1. Execution happens
   LLM with context C → Invokes tools T → Success/Failure

2. Record the context-outcome pair
   {
     context: { impulses: [...], tokens: 8543, structure: "..." },
     outcome: { success: true, tools: ["edit", "bash", "read"] }
   }

3. Analyze patterns
   - What was in context when it succeeded?
   - What was in context when it failed?
   - Which impulses were referenced in tool calls?
   - Which impulses were never used?

4. Generate hypotheses
   - "Removing impulse X doesn't hurt success rate" → Remove it
   - "Adding impulse Y increases success rate" → Add it
   - "Compression strategy 'filter' works better than 'none'" → Use filter

5. Create variants
   - Variant A: Original context (8K tokens)
   - Variant B: Remove unused impulse (6K tokens)
   - Variant C: Add example impulse (10K tokens)

6. Thompson Sampling selects
   - Try each variant
   - Measure success rates
   - Favor better performers
   - Naturally converge to optimal context

7. Learn over time
   - Context that reliably triggers correct transitions → Selected more
   - Context that causes failures → Selected less
   - System self-optimizes
```

---

## Robustness vs Reliability

### The Key Trade-off

**Functional State**:
- Reliable (predictable)
- Not robust (fails hard)

**Instructional State**:
- Robust (handles uncertainty)
- Not reliable (unpredictable)

### Why We Need Both

**Example: File Management Task**

**Pure Functional** (Reliable but Brittle):
```bash
#!/bin/bash
# Move files from A to B
mv /path/to/source/*.txt /path/to/dest/

# Fails if:
# - Path doesn't exist
# - No .txt files
# - Dest is full
# - Permissions wrong
# → Complete failure, no recovery
```

**Pure Instructional** (Robust but Unreliable):
```
LLM: "Move files from A to B"
→ Might use mv
→ Might use cp then rm
→ Might use rsync
→ Might move wrong files
→ Might partial success
→ Can recover from errors (try different approach)
```

**Combined** (Robust AND Reliable):
```
LLM (instructional):
  - Understands fuzzy intent "move files from A to B"
  - Checks if paths exist
  - Decides: use mv (deterministic tool)

mv command (functional):
  - Executes reliably
  - Fails with clear error if problem

LLM (instructional):
  - Sees error: "No such file"
  - Understands: source doesn't exist
  - Decides: create directory first (deterministic tool)

mkdir command (functional):
  - Creates directory
  - Succeeds or fails clearly

LLM (instructional):
  - Sees success
  - Retries mv
  - Succeeds

Result: System is BOTH robust (handled missing directory) AND reliable (used deterministic tools)
```

---

## Architecture Implications

### 1. **Impulses = Context Control**

Impulses aren't about "reducing tokens" - they're about **controlling what patterns are in the LLM's head**.

```typescript
{
  "impulses": [
    {
      "id": "authExample",     // Pattern to match
      "type": "file",
      "budget": 5000,
      "priority": "high"       // Ensure it's in context
    },
    {
      "id": "securityConstraints",  // Constraints to follow
      "type": "memo",
      "budget": 2000,
      "priority": "high"
    }
  ]
}
```

**Goal**: Put the right patterns in context so LLM invokes the right deterministic tools.

### 2. **Compression = Pattern Selection**

Compression strategies aren't about "saving tokens" - they're about **selecting which patterns matter**.

```typescript
compressionStrategy: "filter"  
// Not: "Make it shorter"
// Actually: "Keep only patterns relevant to this task"
```

If task is "Fix function foo()", compression filters to:
- ✅ Definition of foo()
- ✅ Tests for foo()
- ✅ Dependencies of foo()
- ❌ Unrelated functions
- ❌ Documentation about other modules

**Goal**: Maximize signal (relevant patterns) vs noise (irrelevant patterns).

### 3. **Thompson Sampling = Pattern Discovery**

Thompson Sampling doesn't "pick the shortest prompt" - it **picks the context that reliably triggers correct tool invocations**.

```
Variant A: 8K tokens, 85% success
Variant B: 2K tokens, 40% success
Variant C: 15K tokens, 90% success

Thompson Sampling → Picks C (even though longest)
```

**Goal**: Empirically discover optimal context, regardless of size.

### 4. **Metrics = Outcome Measurement**

We measure:
- ❌ Not: "How many tokens?"
- ✅ Yes: "Did it invoke the right tools?"
- ✅ Yes: "Did the deterministic transitions succeed?"
- ✅ Yes: "Did the task complete correctly?"

```typescript
{
  "metrics": {
    "successRate": 0.90,           // Did task succeed?
    "correctToolSequence": true,   // Right tools invoked?
    "deterministicFailures": 0,    // Tool execution failures?
    "instructionalFailures": 2,    // LLM wrong decisions?
    "avgTokens": 12543            // Context size (for info only)
  }
}
```

**Goal**: Measure quality of instructional → functional transitions.

---

## The Optimal System Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Instructional State (LLM in OpenCode)                       │
│                                                              │
│ Properties:                                                  │
│ • Robust (handles ambiguity, uncertainty, edge cases)       │
│ • Not reliable (output varies, might be wrong)              │
│ • Non-deterministic transitions                              │
│                                                              │
│ Responsibilities:                                            │
│ • Understand fuzzy human intent                             │
│ • Interpret results from functional state                   │
│ • Decide which deterministic tools to invoke                │
│ • Handle unexpected situations (trailblazing)               │
│ • Provide "glue" between deterministic steps                │
└─────────────────────────────────────────────────────────────┘
                            ↓
              "Invoke tool X with params Y"
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Functional State (Tools, Code, Scripts, Data)               │
│                                                              │
│ Properties:                                                  │
│ • Reliable (same input → same output)                       │
│ • Not robust (fail hard on errors)                          │
│ • Deterministic transitions                                  │
│                                                              │
│ Responsibilities:                                            │
│ • Execute operations reliably                               │
│ • Manage actual state (files, processes, data)              │
│ • Validate operations                                        │
│ • Report clear success/failure                              │
│ • Maintain system integrity                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
              "Result: success/failure + data"
                            ↓
                  (back to instructional state)
```

### The Contract

**Instructional State promises**:
- I will try to figure out what to do (robustly)
- I will invoke deterministic tools when I know what to do
- I will interpret results and decide next step
- I might be wrong, but I'll keep trying

**Functional State promises**:
- I will do exactly what you tell me (reliably)
- I will succeed or fail clearly (no ambiguity)
- I will not "guess" or "try" - I will execute or error
- If I fail, I'll tell you exactly why

**Together**:
- Instructional provides robustness (handles uncertainty)
- Functional provides reliability (correct execution)
- System is both robust AND reliable

---

## What We're Actually Learning

### Not "How to Write Short Prompts"

We're learning:

### **1. Context-to-Tool Mappings**

**Question**: What context causes LLM to invoke tool X correctly?

```
Context pattern: [JWT example + security constraints]
  → Reliably invokes: edit() to create token function
  → Success rate: 90%

Context pattern: [Just "implement JWT"]
  → Sometimes invokes: edit(), sometimes search()
  → Success rate: 40%
```

**Learning**: The JWT example is critical for reliable tool invocation.

### **2. Impulse Necessity**

**Question**: Which impulses are actually referenced during tool invocations?

```
Impulse A (codeExample): Referenced in 9/10 tasks
Impulse B (documentation): Referenced in 1/10 tasks
Impulse C (testExamples): Referenced in 8/10 tasks
```

**Learning**: Impulse B can be removed (or lowered priority).

### **3. Compression Effectiveness**

**Question**: Which compression strategy maximizes relevant patterns?

```
Strategy "none": All context, 70% success
Strategy "filter": Relevant only, 85% success
Strategy "summarize": Condensed, 60% success
```

**Learning**: "filter" keeps the right patterns for this task type.

### **4. Task Boundaries**

**Question**: Should this be one task or split into multiple?

```
Single task (implement + test): 60% success
Split tasks (implement) → (test): 85% success
```

**Learning**: Split tasks allows progressive context disclosure.

### **5. Optimal Token Budget**

**Question**: What budget maximizes success rate per dollar?

```
2K tokens: 40% success, $0.01/task
8K tokens: 85% success, $0.03/task
15K tokens: 90% success, $0.06/task
```

**Learning**: 8K tokens is optimal (best success/cost ratio).

**Note**: This is empirical, not "shorter is better" or "longer is better".

---

## Practical Implications

### For Template Design

**Don't**:
- ❌ "Make prompts as short as possible"
- ❌ "Remove context to save tokens"
- ❌ "Assume LLM will figure it out"

**Do**:
- ✅ Include patterns that trigger correct tool invocations
- ✅ Use impulses to control what's in context
- ✅ Experiment with different context combinations
- ✅ Measure success rate, not token count
- ✅ Let Thompson Sampling find optimal context

### For Learning Systems

**Don't**:
- ❌ Optimize for minimum tokens
- ❌ Assume shorter = better
- ❌ Remove context without measuring impact

**Do**:
- ✅ Track: context → tool invocations → outcome
- ✅ Identify: which impulses are referenced
- ✅ Experiment: different context combinations
- ✅ Measure: success rate at different token budgets
- ✅ Optimize: success rate per dollar, not tokens per task

### For Variant Creation

**Don't**:
- ❌ Create "shorter version" as goal
- ❌ Assume verbosity is the problem

**Do**:
- ✅ Create variants with different context patterns
- ✅ Test which patterns trigger correct tools
- ✅ Keep context that correlates with success
- ✅ Remove context that doesn't affect outcomes
- ✅ Let data decide optimal context size

---

## Conclusion

**The Fundamental Insight**:

Systems have two types of state:
1. **Functional** (deterministic, reliable, brittle)
2. **Instructional** (non-deterministic, robust, unreliable)

**The Architecture**:

Use instructional state (LLM) as **glue** to orchestrate functional state (tools).

**The Learning Goal**:

Not "make prompts shorter".

But "learn what context reliably causes correct deterministic transitions".

**The Method**:

- Experiment with context combinations
- Measure outcomes (not token count)
- Let Thompson Sampling discover optimal context
- Accept that optimal might be 300 tokens or 300K tokens
- Data decides, not assumptions

**The Result**:

A system that is **both robust and reliable** by combining the strengths of both state types while mitigating their weaknesses.

---

## Key Quotes

> "The verbosity of the templates is not something we can know. If 300k tokens are needed then they are needed."

> "The issue with LLMs is their fuzzyness and sensitivity to specifically what is in their 'brain' (the context window) at any given point."

> "We aim to learn what needs to be in their head in order to get them to manage the functional state."

> "The functional state has deterministic state transitions and the instructional state has non-deterministic transitions."

> "We want to use the non-deterministic transitions as glue to run the deterministic transitions effectively."

> "Instructional state is robust but not reliable. Functional state is reliable but not robust."

---

## Next Steps

1. **Build context-to-outcome tracking**
   - Record: which impulses in context
   - Record: which tools invoked
   - Record: success/failure
   - Analyze: correlations

2. **Implement impulse reference tracking**
   - Detect: which impulses referenced in tool calls
   - Detect: which impulses referenced in reasoning
   - Learn: which impulses are critical

3. **Create pattern analysis system**
   - Identify: context patterns that predict success
   - Identify: context patterns that predict failure
   - Generate: variant hypotheses

4. **Build variant generator**
   - Create variants with different context patterns
   - Not focused on "shorter"
   - Focused on "better pattern selection"

5. **Let Thompson Sampling decide**
   - Run variants
   - Measure success rates
   - Select best performers
   - Ignore token count (it's a metric, not a goal)

The goal is **reliable orchestration of deterministic tools**, not **short prompts**.
