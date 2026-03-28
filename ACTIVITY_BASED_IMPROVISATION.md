# Activity-Based Improvisation: VM as Pure Execution Environment

## The Core Insight

MiniBob is a **VM that runs activities**, not a framework with built-in features. Features should be **discovered and executed as activities**, not hardcoded into the VM.

## Comparison: Code vs Activity Approach

### Code-Based Approach (What I Just Built)

```
MiniBob VM Code: 9,145 LOC
├── Core VM: ~4,800 LOC
└── Features: ~4,345 LOC
    ├── Understanding system: 1,022 LOC
    ├── Goal processor: 457 LOC
    ├── Search-first executor: 662 LOC
    ├── Improviser: 670 LOC
    ├── Template extractor: 220 LOC
    └── Template generator: 123 LOC
```

**To use improvisation**:
```bash
bun run index.ts improvise "Create a hello world server"
```

**What happens**:
1. CLI parses command
2. Imports `src/improviser.ts`
3. Creates GoalImproviser instance
4. Runs custom improvisation loop
5. Custom template extraction code
6. Custom trace analysis

**Problems**:
- ❌ 670 LOC added to VM
- ❌ Not discoverable (hidden in code)
- ❌ Not modifiable (requires code changes)
- ❌ Single implementation (no variants)
- ❌ Not composable (can't be called from other activities)
- ❌ Violates VM vision

### Activity-Based Approach (Proposed)

```
MiniBob VM Code: ~4,800 LOC
└── Core VM only (no features)

Activity Templates: distributed
├── improvise-goal.json
├── extract-template.json
├── explore-codebase.json
├── diagnose-problem.json
└── ... (unlimited)
```

**To use improvisation**:
```bash
bun run index.ts run templates/improvise-goal.json --var goal="Create a hello world server"
```

**What happens**:
1. VM loads activity template
2. VM executes task with LLM+tools
3. LLM figures out steps dynamically
4. VM captures execution trace automatically
5. Run extract-template activity to create reusable template
6. Standard VM flow, no custom code

**Benefits**:
- ✅ 0 LOC added to VM
- ✅ Discoverable (visible JSON file)
- ✅ Modifiable (edit the JSON)
- ✅ Multiple variants possible
- ✅ Composable (activities can call it)
- ✅ Aligned with VM vision

## How It Works: Activity-Based Improvisation

### Step 1: Run Improvisation Activity

**File**: `templates/improvise-goal.json`

```json
{
  "id": "improvise-goal",
  "tasks": [
    {
      "id": "improvise",
      "description": "Iteratively work toward goal",
      "prompt": {
        "template": "Goal: {{goal}}\n\nWork step-by-step:\n1. Think what to do\n2. Use ONE tool\n3. Observe result\n4. Repeat until done\n\nTools: bash, read, write, edit, git\n\nDo it!"
      }
    }
  ]
}
```

**Execute**:
```bash
bun run index.ts run templates/improvise-goal.json \
  --var goal="Create a hello world HTTP server"
```

**What VM does**:
```
1. Load template
2. Execute task "improvise"
3. LLM reads prompt
4. LLM decides: "I need to create a file"
5. LLM calls write tool
6. Tool executes
7. LLM continues: "Now I need to add code"
8. LLM calls edit tool
9. ... continues until LLM says "done"
10. VM returns execution result
```

**VM automatically captures**:
- Every tool call
- Input/output state
- Files created/modified
- Duration and cost
- Complete trace

### Step 2: Extract Template from Trace

**File**: `templates/extract-template.json`

```json
{
  "id": "extract-template",
  "tasks": [
    {
      "id": "fetch-trace",
      "description": "Get execution trace",
      "prompt": {
        "template": "Fetch trace for {{executionId}}"
      }
    },
    {
      "id": "analyze",
      "description": "Analyze and create template",
      "prompt": {
        "template": "{{impulse:execution-trace}}\n\nAnalyze this trace and create an ActivityTemplate JSON..."
      }
    },
    {
      "id": "register",
      "description": "Register new template",
      "prompt": {
        "template": "Register this template with backend"
      }
    }
  ]
}
```

**Execute**:
```bash
bun run index.ts run templates/extract-template.json \
  --var executionId="act_123456" \
  --var templateName="Create HTTP Server"
```

**What happens**:
1. Task 1: Fetch the execution trace
2. Task 2: LLM analyzes the trace and generates template JSON
3. Task 3: Register template with backend

**Result**: New template `create-http-server.json` available

### Step 3: Reuse the Extracted Template

```bash
bun run index.ts run templates/create-http-server.json \
  --var serverName="my-api"
```

**Now it's fast and consistent** because we're using a template, not improvising.

## Key Differences

### Control Flow

**Code-Based**:
```typescript
// Custom loop in improviser.ts
while (!goalAchieved && stepNumber < maxSteps) {
  const decision = await llm.complete(...)
  const result = await executeTool(decision)
  trace.steps.push({...})
  goalAchieved = decision.goal_achieved
}
```

**Activity-Based**:
```json
{
  "prompt": {
    "template": "Work step-by-step until done. Continue using tools until goal achieved."
  }
}
```

The LLM handles the loop implicitly - it just keeps calling tools until it decides it's done. The VM doesn't need special loop logic.

### Template Extraction

**Code-Based**:
```typescript
// Custom code in template-extractor.ts
function identifyTaskBoundaries(steps) {
  // Complex logic to group steps
}
function extractPromptPattern(group) {
  // Complex logic to generalize prompts
}
function identifyVariables(group) {
  // Complex logic to find variables
}
```

**Activity-Based**:
```json
{
  "prompt": {
    "template": "Analyze this trace and create ActivityTemplate JSON:\n1. Identify task boundaries\n2. Extract prompt patterns\n3. Identify variables\n4. Generate JSON"
  }
}
```

The LLM does the analysis - it's better at pattern recognition than our code anyway!

### Extensibility

**Code-Based**:
- Want faster improvisation? Edit improviser.ts
- Want different extraction logic? Edit template-extractor.ts
- Want new variant? Fork the code

**Activity-Based**:
- Want faster improvisation? Create `improvise-goal-fast.json`
- Want different extraction? Create `extract-template-simple.json`
- Want new variant? Copy and edit the JSON

## The VM's Actual Responsibilities

### What VM DOES:

1. **Load activities** - Read JSON templates
2. **Execute tasks** - Run prompt with LLM+tools
3. **Manage impulses** - Inject context
4. **Call tools** - Execute bash, read, write, etc.
5. **Capture traces** - Record everything automatically
6. **Report results** - Send to backend

### What VM DOES NOT DO:

1. ❌ Implement specific strategies (improvisation, understanding, etc.)
2. ❌ Multi-step reasoning loops (that's in the prompts)
3. ❌ Template extraction logic (that's an activity)
4. ❌ Goal decomposition (that's an activity)
5. ❌ Code analysis (that's an activity)

## Benefits of Activity-Based Approach

### 1. Discoverability

**Code**: Hidden in `src/` directories
**Activity**: Visible in `templates/` directory

```bash
$ ls templates/
improvise-goal.json
extract-template.json
explore-codebase.json
diagnose-problem.json
```

Users can SEE what capabilities exist.

### 2. Modifiability

**Code**: Requires TypeScript knowledge, recompilation
**Activity**: Just edit JSON, no recompilation

```bash
$ vim templates/improvise-goal.json
# Change the prompt
# Save
$ bun run index.ts run templates/improvise-goal.json --var goal="..."
# Works immediately
```

### 3. Composability

**Code**: Improviser can't easily call other features
**Activity**: Any activity can call any other activity

```json
{
  "tasks": [
    {
      "prompt": {
        "template": "First explore the codebase, then improvise a solution.\n\nUse activity tool: explore-codebase\nThen use activity tool: improvise-goal"
      }
    }
  ]
}
```

### 4. Variability

**Code**: Single implementation
**Activity**: Multiple variants compete

```
templates/
├── improvise-goal.json           (original)
├── improvise-goal-fast.json      (fewer steps, cheaper model)
├── improvise-goal-careful.json   (more validation, slower)
└── improvise-goal-creative.json  (higher temperature)
```

Thompson Sampling learns which works best for different scenarios.

### 5. Minimal VM

**Code**: 9,145 LOC with features
**Activity**: 4,800 LOC, pure execution

The VM stays focused on ONE thing: executing activities. Everything else is discovered, not built-in.

## Migration Path

### Phase 1: Create Activity Templates

1. Create `improvise-goal.json` ✅ (done)
2. Create `extract-template.json` ✅ (done)
3. Test that they work
4. Compare results to code-based approach

### Phase 2: Remove Code Implementation

1. Delete `src/improviser.ts` (670 LOC)
2. Delete `src/template-extractor.ts` (220 LOC)
3. Update CLI to use activity template
4. Update documentation

### Phase 3: Apply to Other Features

1. Extract understanding system → activities
2. Extract goal processor → activity
3. Extract search-first executor → activity
4. Extract template generator → activity

### Result

```
Before: MiniBob VM = 9,145 LOC
After:  MiniBob VM = 4,800 LOC
Difference: 4,345 LOC moved to activities
```

**The VM becomes minimal** - just enough to execute activities.

## Testing the Activity Approach

### Test 1: Basic Improvisation

```bash
bun run index.ts run templates/improvise-goal.json \
  --var goal="Create a hello world HTTP server" \
  --var maxSteps=20
```

**Expected**: LLM creates server file, adds code, tests it

### Test 2: Template Extraction

```bash
# Get execution ID from previous run
EXEC_ID="act_1234567890_abc123"

bun run index.ts run templates/extract-template.json \
  --var executionId="$EXEC_ID" \
  --var templateName="Create HTTP Server" \
  --var category="feature"
```

**Expected**: New template created and registered

### Test 3: Template Reuse

```bash
bun run index.ts run templates/create-http-server.json \
  --var serverName="my-api" \
  --var port=3000
```

**Expected**: Fast, consistent execution using extracted template

### Test 4: Composition

```bash
bun run index.ts run templates/improvise-and-extract.json \
  --var goal="Add authentication"
```

Where `improvise-and-extract.json` is:
```json
{
  "tasks": [
    {
      "id": "improvise",
      "prompt": {
        "template": "Use activity tool: improvise-goal with goal={{goal}}"
      }
    },
    {
      "id": "extract",
      "prompt": {
        "template": "Use activity tool: extract-template with executionId from previous task"
      }
    }
  ]
}
```

**Expected**: Full cycle - improvise, extract, register

## Conclusion

The activity-based approach achieves the same functionality as the code-based approach, but with:

- ✅ **Zero VM code changes** (4,800 LOC stays at 4,800 LOC)
- ✅ **Discoverable** capabilities (visible JSON files)
- ✅ **Modifiable** behavior (edit JSON, not code)
- ✅ **Composable** activities (activities call activities)
- ✅ **Multiple variants** (templates compete via Thompson Sampling)
- ✅ **Aligned with VM vision** (VM executes, activities define behavior)

**MiniBob becomes a pure VM**: Load activity → Execute tasks → Return result. Nothing more.

**Everything else is activities**: Discoverable, modifiable, composable, learnable.

This is the essence of treating MiniBob as a VM that runs activities rather than a framework with built-in features.

---

**Next Steps**:
1. Test the activity templates (improvise-goal.json, extract-template.json)
2. Validate that LLM can handle the loop logic effectively
3. Compare quality/cost/speed vs code-based approach
4. If successful: Remove improviser code, keep only templates
5. Apply same pattern to other features (understanding, goal processing, etc.)
