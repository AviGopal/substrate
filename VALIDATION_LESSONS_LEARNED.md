# Activity System Validation: Lessons Learned

**Date:** 2026-02-19  
**Context:** Creating validation activities for the activity/impulse system  
**Status:** Templates fixed, ready for execution

---

## **The Meta-Problem: "Trash and Cruft"**

### **What Happened**

We created 3 validation activity templates by hand, writing JSON directly:
- `validate-backend-storage.json`
- `validate-cli-orchestration.json`
- `validate-impulse-system.json`

**The templates had a fundamental design flaw**: They used `variables` to reference previous task outputs, but the activity system uses **impulses** for cross-task communication, not variables.

### **Root Cause**

> "It's probably due to the fact that we didn't use the activity template to create templates to create these templates that we ended up using a bad format that we have left over in the local directory." - User

**The problem**: We created templates manually instead of using `create-activity-template` activity.

**Result**: We cargo-culted bad patterns from old/obsolete templates lying around in the directory.

### **The Deeper Issue**

This is a **bootstrap problem**:
- ❌ Manual template creation → inconsistent patterns
- ❌ Old templates in directory → copied bad patterns
- ❌ No validation until runtime → errors discovered late
- ❌ "Trash and cruft" accumulation → pollutes developer knowledge

**Quote from user**:
> "This is a major issue of living surrounded by trash and cruft we have created. A problem we want to solve using our overall system architecture."

---

## **What We Fixed**

### **Before (Broken Pattern)**

```json
{
  "id": "task-2",
  "dependencies": ["task-1"],
  "prompt": {
    "template": "Process output: {{task1Output}}",
    "variables": [
      {
        "name": "task1Output",  // ❌ WRONG: Variables don't auto-populate
        "type": "string",
        "required": true
      }
    ]
  }
}
```

**Why this fails**: Variables are provided **upfront** when starting the activity. Task outputs are NOT automatically passed as variables to subsequent tasks.

### **After (Correct Pattern - Using Impulses)**

```json
{
  "id": "task-2",
  "dependencies": ["task-1"],
  "impulseReferences": ["task1Output"],
  "prompt": {
    "template": "Process output (Pattern 5: Cross-Task Impulse):\n\n{{task1Output}}\n\n**Metadata**:\n- Tokens: {{task1Output.tokens}}\n- Type: {{task1Output.type}}",
    "variables": [],
    "impulses": [
      {
        "id": "task1Output",
        "type": "activityOutput",
        "pointer": {
          "type": "activityOutput",
          "activityId": "{{activityId}}",  // Current activity
          "taskId": "task-1"
        },
        "budget": 1000,
        "priority": "high"
      }
    ]
  }
}
```

**Why this works**: 
1. Task 1 executes → output stored in `Storage["activity", activityId]`
2. Task 2 defines `activityOutput` impulse → points to Task 1
3. Impulse resolver loads Task 1 output from storage
4. Impulse content injected into Task 2 prompt

---

## **How Cross-Task Communication Works**

### **The Activity Output Lifecycle**

```
┌─────────────────────────────────────────────────────────────┐
│ Task 1 Execution                                            │
│ • Agent produces output (JSON, text, etc.)                  │
│ • Output stored: Storage["activity", activityId].tasks[0]   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Task 2 Preparation                                          │
│ • Task 2 defines activityOutput impulse                     │
│ • Impulse points to activityId + taskId "task-1"            │
│ • Memory agent creates impulse (lazy, unloaded)             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Impulse Resolution (ImpulseResolver.resolve)                │
│ • Load activity from storage: Storage.read(["activity", id])│
│ • Extract task output: activity.tasks.find(t => t.id)       │
│ • Return JSON: JSON.stringify(task, null, 2)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Task 2 Execution                                            │
│ • Impulse content injected into prompt                      │
│ • Agent sees Task 1 output as context                       │
│ • Agent processes and produces Task 2 output                │
└─────────────────────────────────────────────────────────────┘
```

### **Key Implementation (impulse-resolver.ts:458-483)**

```typescript
case "activityOutput": {
  // Load activity output from storage
  const activity = await Storage.read<any>(["activity", pointer.activityId])
  
  // If taskId specified, extract just that task's output
  if (pointer.taskId && activity.tasks) {
    const task = activity.tasks.find((t: any) => t.id === pointer.taskId)
    if (task) {
      return JSON.stringify(task, null, 2)
    }
  }
  
  return JSON.stringify(activity, null, 2)
}
```

---

## **What We Validated**

### **✅ Activity System Components Working**

| Component | Feature | Status |
|-----------|---------|--------|
| **Template Registration** | register_activity_template tool | ✅ Working |
| **Template Storage** | Local + Metabob MCP | ✅ Working |
| **Template Search** | search_activities tool | ✅ Working |
| **Schema Validation** | Caught format errors | ✅ Working |
| **Template Schemas** | ActivityTemplate.Schema | ✅ Working |
| **Impulse System** | activityOutput pointer type | ✅ Documented |

### **🎯 What We Learned**

1. **Cross-Task Communication**: Uses impulses, not variables
2. **Pattern 5**: "Cross-Task Impulse Sharing" is the correct pattern
3. **Storage-Based**: Task outputs persisted in Storage, loaded via impulses
4. **Metadata Available**: Impulse metadata (tokens, type, truncated) accessible in prompts
5. **Schema Strictness**: Template validation catches errors early

---

## **The Solution: Use Activities to Create Activities**

### **❌ Don't Do This** (What We Did)

```bash
# Manually write JSON templates
vim validate-backend-storage.json
# Copy patterns from random files in directory
# Hope the schema is correct
# Discover errors at runtime
```

**Problems**:
- No guidance on correct patterns
- Copy obsolete patterns from old files
- No validation until registration
- Accumulates "trash and cruft"

### **✅ Do This Instead**

```bash
# Use the create-activity-template activity
activity({
  templateId: "create-activity-self-contained",
  variables: {
    templateName: "Validate Backend Storage",
    templateDescription: "Validate backend correctly stores templates",
    category: "infrastructure"
  },
  reason: "Create validation activity using the activity system itself"
})
```

**Benefits**:
- ✅ Agent knows correct patterns (from system prompt)
- ✅ Agent uses impulses correctly (Pattern 5)
- ✅ Schema validated immediately
- ✅ Best practices enforced
- ✅ Self-documenting (agent explains design decisions)

---

## **The "Trash and Cruft" Problem**

### **Symptoms**

```
repos/
  ├── old-template-v1.json          # Obsolete
  ├── old-template-v2.json          # Superseded
  ├── test-template-123.json        # Leftover from debugging
  ├── broken-template.json          # Never finished
  └── current-template.json         # Which one is right?
```

**Developer experience**:
1. Need to create new template
2. Look at existing files for patterns
3. Copy from `old-template-v1.json`
4. Unknowingly copy obsolete pattern
5. Create more trash

### **Vicious Cycle**

```
Manual Creation → Bad Patterns → More Trash → Copied Bad Patterns → More Manual Creation
```

### **The Architecture Solution**

**Core Principle**: **Use the system to extend the system**

Instead of:
- Manual JSON files → Use `create-activity-template` activity
- Manual schema definitions → Use `create-subagent` activity
- Manual tool wrappers → Use `create-tool-wrapper` activity (if exists)

**Benefits**:
1. **Self-Documenting**: System encodes its own best practices
2. **Self-Validating**: System validates its own extensions
3. **Self-Cleaning**: Old patterns die when unused
4. **Self-Learning**: System learns from executions (Thompson Sampling)

---

## **Fixed Validation Templates**

All 3 templates now use correct impulse-based pattern:

### **1. validate-backend-storage.json**

**Fixed**:
- ✅ Task 2 uses `activityOutput` impulse for Task 1 output
- ✅ Task 3 uses `activityOutput` impulse for Task 2 output  
- ✅ Task 4 uses `activityOutput` impulses for Task 2 AND Task 1 outputs
- ✅ No `variables` references to previous tasks
- ✅ All cross-task communication via impulses

**Pattern Demonstrated**: Cross-task impulse sharing within single activity

### **2. validate-cli-orchestration.json**

**Fixed**:
- ✅ Task 3 uses `activityOutput` impulse for Task 2 output
- ✅ No variables for cross-task data
- ✅ Impulse metadata accessible (tokens, type, truncated)

**Pattern Demonstrated**: Sequential task dependency with impulse passing

### **3. validate-impulse-system.json**

**Status**: Already correct! 
- ✅ Uses `contextRequirements` (provided upfront)
- ✅ No cross-task variable dependencies
- ✅ Tasks mostly standalone

**Pattern Demonstrated**: Context-based execution (not cross-task)

---

## **Recommendations**

### **1. Clean Up Trash**

```bash
# Archive old/obsolete templates
mkdir -p .archive/templates-$(date +%Y%m%d)
mv *-old.json *-test.json *-broken.json .archive/templates-$(date +%Y%m%d)/

# Keep only:
# - Active templates (in use)
# - Bootstrap templates (self-improvement)
# - Validation templates (system health)
```

### **2. Enforce "Use System to Extend System"**

**Policy**: Never manually create templates. Always use:
- `create-activity-template` for new activities
- `evolve-activity-template` for improvements
- `fix-activity-template` for bugs

**Exception**: Bootstrap templates (must be manual to start the system)

### **3. Template Lifecycle Management**

```
New Need → Search Existing → Found?
                                ↓ No
                    Create via Activity Template
                                ↓
                        Test & Validate
                                ↓
                        Register & Use
                                ↓
                        Learn & Improve
                                ↓
                        Archive When Obsolete
```

### **4. Documentation Standard**

Every template should document:
- **Why it exists** (the problem it solves)
- **When to use it** (the use case)
- **When NOT to use it** (alternatives)
- **Key patterns** (design decisions)
- **Evolution history** (how it improved)

---

## **Next Actions**

### **Immediate (Complete)**

- [x] Fix validation templates to use impulses
- [x] Validate JSON syntax
- [x] Re-register templates
- [x] Document lessons learned

### **Short Term (This Session)**

- [ ] Run `validate-cli-orchestration` activity
- [ ] Run `validate-impulse-system` activity  
- [ ] Run `validate-backend-storage` activity (requires backend)
- [ ] Document validation results

### **Medium Term (This Week)**

- [ ] Create cleanup activity: `archive-obsolete-templates`
- [ ] Create validation activity: `validate-template-quality`
- [ ] Implement template deprecation workflow
- [ ] Add template usage analytics

### **Long Term (This Month)**

- [ ] Implement automatic trash detection
- [ ] Create template recommendation system
- [ ] Build template evolution tracker
- [ ] Establish template governance process

---

## **Key Takeaway**

> **"The system should extend itself using its own abstractions, not manual file manipulation."**

This is **dogfooding** at the architecture level:
- If creating templates manually is painful → improve `create-activity-template`
- If trash accumulates → create `archive-obsolete-templates` activity
- If patterns are unclear → improve template documentation via activities
- If validation is missing → create `validate-template-quality` activity

**The solution to "trash and cruft" is NOT manual cleanup.**  
**The solution is using the activity system to manage itself.**

This is the path to a **self-maintaining, self-improving system**.
