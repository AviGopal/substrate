# Trailblazing System: Architecture Summary

## Core Vision

**"Solve once, reuse forever"** - Record human problem-solving, generalize into templates, compose with impulses, execute autonomously.

---

## Key Architectural Decisions

### 1. MiniBob Constraint: Activity-Only Execution ✅

**Decision**: MiniBob can ONLY execute activities, no direct tool access

**Rationale**:
- Forces all logic into reusable templates
- Prevents ad-hoc, non-generalizable solutions
- Creates a library of composable building blocks
- Enables Thompson Sampling to learn optimal strategies

**Implementation**:
```typescript
class MiniBobExecutor {
  executeActivity(request): Promise<Result> { ✅ Allowed }
  executeTool(name, params): never { ❌ Throws error }
  readFile(path): never { ❌ Throws error }
  bash(command): never { ❌ Throws error }
}
```

### 2. Trailblazing Recording: Full Capture ✅

**Decision**: Record EVERY tool call + decision during problem-solving

**What We Capture**:
- Tool name & parameters
- Why this tool was chosen
- What alternatives were considered
- Actual result vs expected outcome
- How state changed after execution

**Storage**: SurrealDB with full trace history

### 3. Template Generation: Auto-Parameterization ✅

**Decision**: Automatically extract variables from execution trace

**How It Works**:
1. Pattern detection (regex for files, URLs, namespaces, etc.)
2. Type inference (string, number, array, etc.)
3. Variable naming (semantic, not generic)
4. Example extraction (from actual usage)

**Result**: First-draft template ready for testing

### 4. Impulse System: Context Composition ✅

**Decision**: Use impulses for ALL data/scripts/sub-activities

**Impulse Types**:
- **Data**: Context, traces, results
- **Executable**: Scripts, validations, sub-activities
- **Decision**: Why patterns, recognized patterns

**Benefits**:
- Budget-aware context loading
- Lazy evaluation of expensive data
- Reusable script extraction
- Composable activity nesting

### 5. Iteration Loop: Test-Refine-Register ✅

**Decision**: Automated refinement based on test failures

**Loop**:
```
Generate → Test → Fails? → Refine → Test → ...until success → Register
```

**Refinement Strategies**:
- Hardcoded values → Extract as variables
- Validation failures → Add constraints
- Complex tasks → Split into subtasks
- Context dependencies → Extract impulses
- Common patterns → Extract sub-activities

---

## Data Flow

```
┌──────────────────────────────────────────────────┐
│ 1. RECORD (Human solves problem)                 │
│    - Trailblaze mode: ON                         │
│    - Capture every tool call                     │
│    - Log every decision                          │
│    - Track goal achievement                      │
└──────────────────┬───────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────┐
│ 2. GENERATE (Auto-create template)               │
│    - Extract variables (pattern detection)       │
│    - Segment into tasks (semantic grouping)      │
│    - Create impulses (data/scripts/validations)  │
│    - Generate first draft                        │
└──────────────────┬───────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────┐
│ 3. TEST (Validate with samples)                  │
│    - Run with test variables                     │
│    - Compare outcomes                            │
│    - Identify failures                           │
└──────────────────┬───────────────────────────────┘
                   ↓
                 Pass? ────No───┐
                   ↓            │
                  Yes           ↓
                   ↓    ┌───────────────────┐
                   │    │ 4. ITERATE        │
                   │    │    - Refine vars  │
                   │    │    - Split tasks  │
                   │    │    - Add impulses │
                   │    └────────┬──────────┘
                   │             │
                   │  ←──────────┘
                   ↓
┌──────────────────────────────────────────────────┐
│ 5. REGISTER (Add to template registry)           │
│    - Store in SurrealDB                          │
│    - Enable Thompson Sampling                    │
│    - MiniBob can now use it!                     │
└──────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      MiniBob                            │
│                                                         │
│  Decision: Which activity to execute next?             │
│  Constraint: Can ONLY call executeActivity()           │
│  No escape hatches to direct tool access               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓ executeActivity()
┌─────────────────────────────────────────────────────────┐
│              Activity Execution Engine                  │
│                                                         │
│  • Resolve template from registry                      │
│  • Interpolate variables                               │
│  • Resolve impulses (budget-aware)                     │
│  • Execute tasks sequentially                          │
│  • Record results for Thompson Sampling                │
└──┬───────────────────────────────────────────────┬──────┘
   │                                               │
   ↓                                               ↓
┌────────────────────────┐         ┌──────────────────────┐
│   Impulse System       │         │  Template Registry   │
│                        │         │                      │
│ • Store data           │         │ • Activity templates │
│ • Execute scripts      │         │ • Variable schemas   │
│ • Compose context      │         │ • Task definitions   │
│ • Lazy loading         │         │ • Thompson scores    │
│ • Budget management    │         │ • Version history    │
└────────────────────────┘         └──────────────────────┘
            ↑                                   ↑
            │                                   │
            └──────────┬────────────────────────┘
                       │
         ┌─────────────▼──────────────────────────────────┐
         │      Trailblazing Recording System             │
         │                                                │
         │  • Wrap execution in recording mode            │
         │  • Capture all tool calls + decisions          │
         │  • Auto-create impulses                        │
         │  • Extract variables                           │
         │  • Segment tasks                               │
         │  • Generate first-draft template               │
         │  • Test & iterate                              │
         └────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Recording Infrastructure (Week 1-2)
- [ ] Tool call interceptor
- [ ] Decision logging
- [ ] Trailblaze session storage (SurrealDB)
- [ ] Impulse auto-creation

### Phase 2: Template Generation (Week 3-4)
- [ ] Variable extraction (pattern detection)
- [ ] Task segmentation (semantic grouping)
- [ ] Template generation algorithm
- [ ] First-draft creation

### Phase 3: Testing & Iteration (Week 5-6)
- [ ] Test harness
- [ ] Failure classification
- [ ] Refinement strategies
- [ ] Auto-iteration loop

### Phase 4: MiniBob Integration (Week 7-8)
- [ ] Activity-only executor
- [ ] Permission enforcement
- [ ] Boredom system integration
- [ ] Thompson Sampling learning

### Phase 5: Composition & Optimization (Week 9-10)
- [ ] Impulse budget optimization
- [ ] Sub-activity composition
- [ ] Script extraction
- [ ] Context compression

---

## Success Metrics

### Recording Quality
- ✅ 100% of tool calls captured
- ✅ Decision rationale for every action
- ✅ Full context preservation

### Template Quality
- ✅ >80% variable extraction accuracy
- ✅ Logical task segmentation
- ✅ Meaningful variable names
- ✅ <3 iterations to working template

### MiniBob Constraint
- ✅ 0 direct tool calls (all via activities)
- ✅ Clear error messages when violated
- ✅ All logic in templates

### System Performance
- ✅ <5 min template generation
- ✅ <1 min per test iteration
- ✅ >90% test pass rate after refinement
- ✅ Thompson Sampling converges in <10 executions

---

## Example: Complete Flow

```typescript
// 1. START TRAILBLAZE
await startTrailblaze({ goal: "Fix auth issue" });

// 2. HUMAN SOLVES (recorded automatically)
kubectl logs pod → "auth error"
edit config.ts → add validation
helm upgrade → deploy
curl /health → 200 OK ✅

// 3. GENERATE TEMPLATE (automatic)
const template = {
  name: "fix-auth-config",
  variables: [
    { name: "serviceName", type: "string" },
    { name: "configFile", type: "string" },
    { name: "validationEndpoint", type: "string" }
  ],
  tasks: [
    { id: "check-logs", prompt: "Check logs for {{serviceName}}" },
    { id: "fix-config", prompt: "Update {{configFile}}" },
    { id: "deploy", prompt: "Deploy changes" },
    { id: "validate", prompt: "Test {{validationEndpoint}}" }
  ]
};

// 4. TEST (automatic)
await testTemplate(template, [
  { serviceName: "api", configFile: "api.ts", validationEndpoint: "/health" },
  { serviceName: "worker", configFile: "worker.ts", validationEndpoint: "/status" }
]);

// 5. ITERATE if failures (automatic)
if (failures) {
  template = await refineTemplate(template, failures);
}

// 6. REGISTER (automatic)
await registerTemplate(template);

// 7. MINIBOB USES IT (autonomous)
await minibob.executeActivity({
  templateId: "fix-auth-config",
  variables: { serviceName: "dashboard", ... },
  reason: "Boredom system detected auth issue"
});
```

---

## Key Benefits

### For Humans
- ✅ Solve problems once, reuse forever
- ✅ No manual template writing
- ✅ Automatic generalization
- ✅ Self-documenting (trace preserved)

### For MiniBob
- ✅ Growing library of capabilities
- ✅ No direct tool access needed
- ✅ Thompson Sampling learns patterns
- ✅ Fully autonomous execution

### For System
- ✅ Composable building blocks
- ✅ Reusable impulses
- ✅ Version-controlled templates
- ✅ Self-improving over time

---

## Critical Path to Success

1. **Recording fidelity** - Capture EVERYTHING
2. **Variable extraction** - Get patterns right
3. **Task segmentation** - Logical grouping
4. **MiniBob enforcement** - No escape hatches
5. **Iteration speed** - Fast test-refine loops
6. **Impulse integration** - Efficient composition

**Result**: System that learns from human problem-solving and autonomously applies solutions! 🚀
