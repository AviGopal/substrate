# Activity Scope: Analyze Conversation Patterns (Visual Guide)

**Date**: 2026-02-05  
**Status**: ✅ Complete

---

## 🎯 The Core Boundary

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                   ANALYZE CONVERSATION PATTERNS                 │
│                                                                 │
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║                                                           ║  │
│  ║  INPUT:  Historical conversation data                     ║  │
│  ║           ↓                                               ║  │
│  ║  DO:     Extract recurring patterns                       ║  │
│  ║           ↓                                               ║  │
│  ║  OUTPUT: Pattern documentation                            ║  │
│  ║                                                           ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
│                                                                 │
│  ❌ DOES NOT: Implement, Fix, Create, Manage, Coordinate       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Scope Decision Tree

```
                        Is this task...?
                              │
                              ↓
        ┌─────────────────────┴─────────────────────┐
        │                                           │
    Analyzing                                   Taking Action
    patterns from                                    │
    past work?                                       │
        │                                            ↓
        ↓                                      OUT OF SCOPE
    IN SCOPE                                         │
        │                                            ├─ Fixing bugs
        ├─ Reading logs                              ├─ Creating templates
        ├─ Extracting patterns                       ├─ Managing memory
        ├─ Documenting sequences                     ├─ Running tests
        ├─ Identifying anti-patterns                 ├─ Delegating to agents
        └─ Writing pattern docs                      ├─ Jigging docs
                                                    └─ Implementing features
```

---

## 🎭 In Scope vs Out of Scope Matrix

```
┌────────────────────────────────────────────────────────────────────┐
│                        IN SCOPE ✅                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Pattern Extraction              Context Analysis                 │
│  • Analyze execution logs        • Identify useful impulse types  │
│  • Review session summaries      • Extract budget patterns        │
│  • Find recurring intents        • Document loading strategies    │
│  • Extract task sequences        • Find compression patterns      │
│                                                                    │
│  Tool Sequence Documentation     Validation Pattern Extraction    │
│  • Document tool chains          • Multi-layer validation rules   │
│  • Diagnostic-first sequences    • Forbidden pattern identification│
│  • Activity-first workflows      • Retry strategy patterns        │
│  • Metabob integration patterns  • Quality gate patterns          │
│                                                                    │
│  Success Metrics                 Pattern Catalog Creation         │
│  • Success rate measurement      • Structured documentation       │
│  • Token efficiency patterns     • Copy-paste examples            │
│  • Model selection patterns      • Decision trees                 │
│  • Timing analysis               • Anti-pattern warnings          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                       OUT OF SCOPE ❌                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Memory Management ⛔             Template Operations ⛔            │
│  • Creating impulses             • Creating templates             │
│  • Loading context               • Modifying templates            │
│  • Optimizing context space      • Registering templates          │
│  • Compressing impulses          • Validating templates           │
│  → Use: manage-session-memory    → Use: create-activity-template  │
│                                                                    │
│  Diagnostic Workflows ⛔          Bug Fixing ⛔                     │
│  • Measuring performance         • Implementing fixes             │
│  • Gathering diagnostics         • Running tests                  │
│  • Fixing config issues          • Debugging code                 │
│  • Resolving parity problems     • Analyzing change impact        │
│  → Use: diagnose-startup-issues  → Use: fix-bug-with-impulses     │
│                                                                    │
│  Documentation Maintenance ⛔     Multi-Agent Work ⛔               │
│  • Jigging docs                  • Setting up ACP                 │
│  • Consolidating files           • Delegating tasks               │
│  • Removing obsolete docs        • Coordinating agents            │
│  • Creating overviews            • Testing connectivity           │
│  → Use: jiggle-documentation     → Use: multi-agent-acp-workflow  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Relationship with Other Activities

```
                    Analyze Conversation Patterns
                              (Meta-Level)
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                Observes      Observes      Observes
                    │             │             │
                    ↓             ↓             ↓
        
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │ manage-session-  │  │ diagnose-startup │  │ fix-bug-with-    │
    │ memory           │  │ -issues          │  │ impulses         │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
           │                      │                      │
    Pattern: Context       Pattern: Diagnostic    Pattern: Bug-fixing
    management             workflow               workflow
           │                      │                      │
           └──────────────────────┴──────────────────────┘
                                  │
                    Feeds patterns to users/templates
                                  ↓
                    ┌───────────────────────────┐
                    │  Pattern Documentation    │
                    │  (Reusable by all)        │
                    └───────────────────────────┘
```

**Key**: Analyze Conversation Patterns is **OBSERVATIONAL**. It watches other activities succeed, extracts their patterns, but doesn't DO the work itself.

---

## 📋 Example Task Breakdown

### ✅ Valid Tasks (In Scope)

```
Task 1: Gather Success Data
├─ Read activity execution logs
├─ Review session summaries
├─ Identify successful outcomes
└─ Collect metrics (success rate, tokens, duration)

Task 2: Extract Tool Sequences
├─ Identify common tool call chains
├─ Document Metabob integration patterns
├─ Find diagnostic-first sequences
└─ Extract activity-first workflows

Task 3: Analyze Context Patterns
├─ Find effective impulse types
├─ Document budget allocations
├─ Extract loading strategies
└─ Identify compression patterns

Task 4: Document Validation Patterns
├─ Extract multi-layer validation rules
├─ Document forbidden patterns
├─ Find effective retry strategies
└─ Identify quality gates

Task 5: Create Pattern Catalog
├─ Write structured documentation
├─ Provide copy-paste examples
├─ Create decision trees
└─ Document anti-patterns
```

### ❌ Invalid Tasks (Out of Scope)

```
Task X: Create Memory Impulses
├─ Create impulses from analysis
├─ Load context for execution
└─ Optimize context space
   → OUT OF SCOPE: Use manage-session-memory

Task X: Implement Template
├─ Create template JSON
├─ Register with system
└─ Validate registration
   → OUT OF SCOPE: Use create-activity-template

Task X: Fix Found Bugs
├─ Analyze change impact
├─ Implement fixes
└─ Run tests
   → OUT OF SCOPE: Use fix-bug-with-impulses

Task X: Run Diagnostics
├─ Measure startup time
├─ Analyze performance
└─ Fix config issues
   → OUT OF SCOPE: Use diagnose-startup-issues
```

---

## 🚦 Edge Case Handling

### Edge Case 1: No Successful Data Found
```
User Request: "Analyze conversation patterns"
      ↓
No successful activities found
      ↓
✅ Document that pattern extraction requires examples
✅ Suggest running activities first
❌ DON'T create synthetic patterns
❌ DON'T implement features instead
```

### Edge Case 2: Patterns Suggest Template Creation
```
Analysis finds: "This workflow repeats often"
      ↓
✅ Document the pattern clearly
✅ Add "Could be template" note
✅ Provide template spec in appendix
❌ DON'T create the template (out of scope)
      ↓
User can later run: create-activity-template
```

### Edge Case 3: Patterns Reveal Bugs
```
Analysis finds: "Anti-pattern: setTimeout in tests"
      ↓
✅ Document as anti-pattern
✅ Add to "common mistakes"
✅ Suggest fixes in recommendations
❌ DON'T fix the bugs (out of scope)
      ↓
User can later run: fix-bug-with-impulses
```

### Edge Case 4: Overlapping Documentation
```
Patterns already documented in PATTERN_QUICK_REFERENCE.md
      ↓
✅ Cross-reference existing docs
✅ Add new insights or examples
✅ Update with recent findings
❌ DON'T duplicate unchanged content
❌ DON'T trigger jiggle-documentation
```

---

## 🎯 The Single Goal Test

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  QUESTION:                                                  │
│  "Does this task directly contribute to extracting and     │
│   documenting conversation patterns?"                       │
│                                                             │
│  ┌─────────────┐              ┌─────────────┐              │
│  │     YES     │              │      NO     │              │
│  │  In Scope   │              │ Out of Scope│              │
│  └─────────────┘              └─────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Examples:

| Task | Answer | Scope |
|------|--------|-------|
| Read activity logs | YES ✅ | In Scope |
| Create impulse with results | NO ❌ | Out (use manage-session-memory) |
| Document tool sequences | YES ✅ | In Scope |
| Create template from patterns | NO ❌ | Out (use create-activity-template) |
| Identify diagnostic pattern | YES ✅ | In Scope |
| Run startup diagnostics | NO ❌ | Out (use diagnose-startup-issues) |
| Write pattern catalog | YES ✅ | In Scope |
| Fix bugs found in analysis | NO ❌ | Out (use fix-bug-with-impulses) |

---

## 📦 Context Requirements (Appropriate for Scope)

### ✅ Valid Context Requirements

```json
{
  "contextRequirements": [
    {
      "key": "activityLogs",
      "hint": "Load activity execution logs from successful runs",
      "impulseTypes": ["bashOutput", "file"],
      "required": true,
      "budgetRange": [4000, 8000]
    },
    {
      "key": "sessionSummaries", 
      "hint": "Load session summary documents (COMPLETE.md, SUCCESS.md)",
      "impulseTypes": ["file"],
      "required": true,
      "budgetRange": [3000, 6000]
    },
    {
      "key": "existingPatterns",
      "hint": "Load existing pattern documentation for cross-reference",
      "impulseTypes": ["file", "memo"],
      "required": false,
      "budgetRange": [2000, 4000]
    }
  ]
}
```

### ❌ Invalid Context Requirements

```json
{
  "contextRequirements": [
    {
      "key": "memoryBudget",  // ❌ Memory management
      "hint": "Current context space budget",
      "reason": "OUT OF SCOPE: Use manage-session-memory"
    },
    {
      "key": "templateToCreate",  // ❌ Template creation
      "hint": "Template JSON to register",
      "reason": "OUT OF SCOPE: Use create-activity-template"
    },
    {
      "key": "testCommand",  // ❌ Running tests
      "hint": "Command to run tests",
      "reason": "OUT OF SCOPE: Use validate-build-complete"
    }
  ]
}
```

---

## 🔗 Composition Patterns (Valid)

### ✅ Pattern: Extract → Use in Template Creation

```typescript
// Step 1: Extract patterns (this activity)
const patterns = await activity({
  activityId: "analyze-conversation-patterns",
  variables: {
    outputPath: "/tmp/patterns.md"
  }
});

// Step 2: Create template from patterns (separate activity)
const template = await activity({
  activityId: "create-activity-template",
  variables: {
    patternReference: "/tmp/patterns.md",
    templateName: "new-workflow"
  }
});
```

### ✅ Pattern: Extract → Improve Existing Template

```typescript
// Step 1: Extract patterns
await activity({
  activityId: "analyze-conversation-patterns",
  variables: {
    focus: "template-improvement-opportunities"
  }
});

// Step 2: Improve template (separate activity)
await activity({
  activityId: "improve-bootstrap-template",
  variables: {
    targetTemplate: "create-activity-template.json"
  }
});
```

### ❌ Invalid: Internal Delegation

```typescript
// ❌ DON'T DO THIS
{
  "tasks": [
    {
      "id": "extract-patterns",
      "description": "Extract patterns"
    },
    {
      "id": "create-template",  // ❌ OUT OF SCOPE
      "description": "Create template from patterns",
      "prompt": "Use activity tool to create template..."
    }
  ]
}
```

**Rule**: `analyze-conversation-patterns` outputs documentation. OTHER activities consume that documentation. NO internal delegation.

---

## ✅ Success Criteria Checklist

### Activity is IN SCOPE if it:

- [ ] ✅ Analyzes historical conversation data
- [ ] ✅ Extracts recurring patterns from multiple examples
- [ ] ✅ Documents tool usage sequences
- [ ] ✅ Creates structured pattern catalog
- [ ] ✅ Provides copy-paste ready code examples
- [ ] ✅ Identifies anti-patterns and failure modes
- [ ] ✅ Makes recommendations for future work
- [ ] ✅ Cross-references related activities
- [ ] ✅ Validates patterns against multiple examples

### Activity is OUT OF SCOPE if it:

- [ ] ❌ Creates or loads impulses for execution
- [ ] ❌ Creates or modifies activity templates
- [ ] ❌ Implements fixes or features
- [ ] ❌ Runs tests or validation commands
- [ ] ❌ Delegates to remote agents via ACP
- [ ] ❌ Maintains documentation lifecycle (jigging)
- [ ] ❌ Executes diagnostic workflows
- [ ] ❌ Manages session memory or context
- [ ] ❌ Coordinates multi-agent workflows

---

## 🎓 Mental Model

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Think of this activity as:                                 │
│                                                             │
│  🔍 ANTHROPOLOGIST                                          │
│     Studies how successful work was done                    │
│     Extracts cultural patterns                              │
│     Documents for future generations                        │
│                                                             │
│  NOT:                                                       │
│                                                             │
│  👷 BUILDER - Doesn't build things                          │
│  🔧 FIXER - Doesn't fix bugs                                │
│  📝 SCRIBE - Doesn't maintain docs                          │
│  🤝 COORDINATOR - Doesn't delegate work                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Guidance

### DO:
1. ✅ Focus exclusively on pattern extraction
2. ✅ Analyze multiple successful examples
3. ✅ Provide concrete, actionable patterns
4. ✅ Include copy-paste code examples
5. ✅ Document decision trees clearly
6. ✅ Cross-reference related activities
7. ✅ Validate patterns against data

### DON'T:
1. ❌ Implement any fixes or features
2. ❌ Create or modify templates directly
3. ❌ Manage session memory or impulses
4. ❌ Run tests, builds, or diagnostics
5. ❌ Delegate to remote agents
6. ❌ Maintain documentation lifecycle
7. ❌ Execute workflows beyond analysis

---

## 📊 Boundary Enforcement

```
                   Request Received
                          │
                          ↓
                Is it pattern analysis?
                     ╱        ╲
                   YES         NO
                   ↓            ↓
           Process with     Reject with
           this activity    guidance
                   │             │
                   ↓             ↓
           Pattern        Suggest correct
           documented     activity:
                          - manage-session-memory
                          - create-activity-template
                          - fix-bug-with-impulses
                          - diagnose-startup-issues
                          - etc.
```

---

## 🎯 Final Summary

**Analyze Conversation Patterns** is a **meta-level observation activity** that:

✅ **DOES**: Extract and document patterns from successful work  
❌ **DOES NOT**: Do the work itself

**Scope Boundary**: Pure analysis and documentation, zero implementation.

**Integration**: Provides patterns that inform other activities, but doesn't execute them.

**Key Principle**: If it's not about studying past success to document reusable patterns, it's out of scope.

---

**Date**: 2026-02-05  
**Status**: ✅ Visual Guide Complete  
**Related**: `ANALYZE_CONVERSATION_PATTERNS_SCOPE.md` (detailed version)
