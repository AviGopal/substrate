# Activity Scope Boundaries: Analyze Conversation Patterns

**Activity Name**: Analyze Conversation Patterns  
**Category**: infrastructure  
**Date**: 2026-02-05  
**Status**: ✅ Scope Defined

---

## Executive Summary

This activity extracts **reusable patterns from successful conversations** to improve future development workflows. It focuses on **pattern identification and documentation**, NOT on implementing fixes, managing memory, or creating templates.

**Single Goal**: Extract conversation patterns → Document for reuse

---

## ✅ SHOULD COVER (In Scope)

### 1. **Pattern Identification from Successful Outcomes**
   - ✅ Analyze completed activity executions
   - ✅ Review session logs showing successful workflows
   - ✅ Identify recurring user intents (bug fixes, feature adds, refactoring)
   - ✅ Extract common task sequences that led to success
   - ✅ Find tool usage patterns (which tools, in what order)

### 2. **Context Requirements Analysis**
   - ✅ Identify what context was most useful for specific tasks
   - ✅ Document effective impulse types (file, component, metabobPriorityIssues)
   - ✅ Extract optimal budget allocations for different context types
   - ✅ Find patterns in impulse creation and loading strategies

### 3. **Tool Sequence Extraction**
   - ✅ Document recurring tool call chains
   - ✅ Identify diagnostic-first patterns (gather data before fixing)
   - ✅ Extract activity-first workflows (template usage patterns)
   - ✅ Find Metabob tool integration patterns

### 4. **Validation Strategy Patterns**
   - ✅ Identify effective validation rules (files, patterns, commands)
   - ✅ Extract multi-layer validation approaches
   - ✅ Document forbidden patterns that prevent common mistakes
   - ✅ Find successful retry strategies

### 5. **Success Metrics Documentation**
   - ✅ Measure activity success rates
   - ✅ Document token efficiency patterns
   - ✅ Identify cost-effective model choices
   - ✅ Extract timing patterns (fast vs slow approaches)

### 6. **Pattern Documentation**
   - ✅ Create structured pattern summaries
   - ✅ Document when to use each pattern
   - ✅ Provide copy-paste ready examples
   - ✅ Add decision trees for pattern selection

### 7. **Anti-Pattern Identification**
   - ✅ Document common failure modes
   - ✅ Identify what NOT to do
   - ✅ Extract lessons from failed attempts
   - ✅ Create prevention guidelines

---

## ❌ SHOULD NOT COVER (Out of Scope)

### 1. **Session Memory Management** ⛔
   - ❌ Creating/loading impulses during execution
   - ❌ Optimizing context space utilization
   - ❌ Compressing or reordering impulses
   - ❌ Pre-turn memory preparation

   **Why**: Covered by **`manage-session-memory.json`** template
   - That template handles intent analysis, impulse creation, loading, optimization
   - Our activity only ANALYZES patterns, doesn't manage memory

### 2. **Template Creation/Improvement** ⛔
   - ❌ Creating new activity templates
   - ❌ Improving existing templates
   - ❌ Registering templates
   - ❌ Template validation

   **Why**: Covered by:
   - **`create-activity-template.json`** - Creates new templates
   - **`improve-bootstrap-template.json`** - Enhances existing templates
   - **`validate-template-registration.json`** - Validates templates
   - Our activity extracts patterns that inform template design, but doesn't create templates

### 3. **Diagnostic Workflows** ⛔
   - ❌ Diagnosing startup issues
   - ❌ Measuring performance
   - ❌ Fixing configuration problems
   - ❌ Resolving dev/build parity issues

   **Why**: Covered by **`diagnose-startup-issues.json`** template
   - That template gathers diagnostics, analyzes issues, implements fixes
   - Our activity identifies diagnostic-first PATTERNS, not diagnoses

### 4. **Documentation Maintenance** ⛔
   - ❌ Jigging/consolidating documentation
   - ❌ Removing obsolete docs
   - ❌ Creating overview documents
   - ❌ Fixing broken links

   **Why**: Covered by **`jiggle-documentation.json`** template
   - That template manages doc lifecycle
   - Our activity CREATES pattern documentation, doesn't maintain it

### 5. **Bug Fixing** ⛔
   - ❌ Implementing fixes for specific bugs
   - ❌ Running tests
   - ❌ Debugging code
   - ❌ Analyzing change impact

   **Why**: Covered by:
   - **`fix-bug-with-impulses.json`** - Bug fixing workflow
   - **`diagnose-startup-issues.json`** - Diagnostic fixes
   - Our activity extracts bug-fixing PATTERNS, doesn't fix bugs

### 6. **Multi-Agent Coordination** ⛔
   - ❌ Setting up ACP connections
   - ❌ Delegating tasks to remote agents
   - ❌ Coordinating cross-agent workflows
   - ❌ Testing connectivity

   **Why**: Covered by:
   - **`multi-agent-acp-workflow.json`** - Multi-agent orchestration
   - **`test-acp-connectivity.json`** - Connection testing
   - Our activity identifies coordination PATTERNS, doesn't coordinate

### 7. **Code Quality Management** ⛔
   - ❌ Searching for code issues
   - ❌ Marking problems complete
   - ❌ Annotating components
   - ❌ Analyzing change impact

   **Why**: These are Metabob tool calls that happen during execution
   - Our activity identifies when/how to use Metabob tools
   - Doesn't execute Metabob workflows directly

### 8. **Testing/Validation** ⛔
   - ❌ Running test suites
   - ❌ Validating builds
   - ❌ Checking type correctness
   - ❌ Verifying container health

   **Why**: Covered by:
   - **`validate-build-complete.json`** - Build validation
   - **`validate-activity-execution.json`** - Activity validation
   - **`test-all-containers.json`** - Container testing
   - Our activity documents testing PATTERNS, doesn't run tests

### 9. **Implementation Work** ⛔
   - ❌ Writing code
   - ❌ Refactoring components
   - ❌ Adding features
   - ❌ Making commits

   **Why**: This is execution work, not pattern analysis
   - Our activity is META-LEVEL analysis
   - Extracts patterns FROM implementations, doesn't implement

### 10. **Learning System Operation** ⛔
   - ❌ Recording outcomes
   - ❌ Computing metrics
   - ❌ Adjusting template parameters
   - ❌ Training models

   **Why**: These are platform-level concerns
   - Our activity provides INPUT to learning systems
   - Doesn't operate the learning system itself

---

## 🎯 Core Focus: Pattern Extraction Only

```
┌─────────────────────────────────────────────────────────────┐
│                   ANALYZE CONVERSATION PATTERNS             │
│                                                             │
│  INPUT:  Successful conversation data                       │
│          ↓                                                  │
│  PROCESS: Extract patterns                                  │
│          ↓                                                  │
│  OUTPUT: Pattern documentation                              │
│                                                             │
│  DOES NOT: Fix, implement, manage, coordinate              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Task Boundaries

### Example Task Breakdown (What's In Scope)

```json
{
  "tasks": [
    {
      "id": "gather-success-data",
      "description": "Collect successful activity execution logs and session summaries",
      "in_scope": true
    },
    {
      "id": "identify-patterns",
      "description": "Analyze data to extract recurring patterns",
      "in_scope": true
    },
    {
      "id": "document-tool-sequences",
      "description": "Extract common tool call chains",
      "in_scope": true
    },
    {
      "id": "create-pattern-catalog",
      "description": "Write structured pattern documentation",
      "in_scope": true
    },
    {
      "id": "validate-patterns",
      "description": "Verify patterns against multiple examples",
      "in_scope": true
    }
  ]
}
```

### Example Out-of-Scope Tasks (DON'T Include)

```json
{
  "tasks": [
    {
      "id": "create-memory-impulses",
      "description": "Create impulses based on pattern analysis",
      "in_scope": false,
      "reason": "Memory management - use manage-session-memory"
    },
    {
      "id": "implement-template",
      "description": "Create activity template from patterns",
      "in_scope": false,
      "reason": "Template creation - use create-activity-template"
    },
    {
      "id": "fix-found-issues",
      "description": "Fix bugs identified during pattern analysis",
      "in_scope": false,
      "reason": "Bug fixing - use fix-bug-with-impulses"
    },
    {
      "id": "run-tests",
      "description": "Validate patterns by running tests",
      "in_scope": false,
      "reason": "Testing - use validate-build-complete"
    }
  ]
}
```

---

## 🔍 Edge Cases and Failure Modes

### Edge Case 1: No Successful Conversations Found
**Scenario**: Search returns no successful activity executions  
**Handling**: 
- ✅ Document that pattern extraction requires successful examples
- ✅ Suggest running activities first to generate data
- ❌ DON'T attempt to create synthetic patterns
- ❌ DON'T fall back to implementing features

### Edge Case 2: Patterns Are Too Generic
**Scenario**: Extracted patterns are vague ("use good prompts")  
**Handling**:
- ✅ Dive deeper into specific examples
- ✅ Extract concrete tool sequences with parameters
- ✅ Provide copy-paste ready code
- ❌ DON'T stop at high-level descriptions

### Edge Case 3: Overlapping with Existing Documentation
**Scenario**: Patterns already documented elsewhere  
**Handling**:
- ✅ Cross-reference existing docs
- ✅ Add new insights or examples
- ✅ Update with recent findings
- ❌ DON'T duplicate unchanged content
- ❌ DON'T trigger jiggle-documentation activity

### Edge Case 4: Patterns Suggest Template Creation
**Scenario**: Analysis reveals need for new template  
**Handling**:
- ✅ Document the pattern clearly
- ✅ Note "This could be a template" in recommendations
- ✅ Provide template specification in appendix
- ❌ DON'T create the template (use create-activity-template)
- ❌ DON'T register the template

### Edge Case 5: Patterns Reveal Bugs or Issues
**Scenario**: Pattern analysis uncovers bugs in existing code  
**Handling**:
- ✅ Document the anti-pattern
- ✅ Add to "common mistakes" section
- ✅ Suggest fixes in recommendations
- ❌ DON'T fix the bugs (use fix-bug-with-impulses)
- ❌ DON'T run diagnostics (use diagnose-startup-issues)

### Edge Case 6: Insufficient Token Budget
**Scenario**: Too many conversations to analyze in available budget  
**Handling**:
- ✅ Sample representative conversations
- ✅ Prioritize recent, high-success-rate activities
- ✅ Focus on 5-10 strong examples
- ❌ DON'T compress context aggressively (accuracy matters)
- ❌ DON'T fall back to manage-session-memory activity

### Edge Case 7: Patterns Require Multi-Agent Analysis
**Scenario**: Cross-repo patterns need distributed analysis  
**Handling**:
- ✅ Document that multi-agent patterns exist
- ✅ Note repositories involved
- ✅ Suggest multi-agent-acp-workflow in recommendations
- ❌ DON'T delegate to remote agents (stay focused on single-agent analysis)
- ❌ DON'T set up ACP connections

### Edge Case 8: No Clear Patterns Emerge
**Scenario**: Data is too heterogeneous for pattern extraction  
**Handling**:
- ✅ Document that conversations are diverse
- ✅ Group by category (bug fix, feature, refactor)
- ✅ Extract category-specific patterns
- ❌ DON'T force patterns where none exist
- ❌ DON'T create generic "best practices" fluff

---

## 🚧 Boundary Violations (Red Flags)

### If Activity Does These, It's Out of Scope:

1. **Creates impulses** → Use `manage-session-memory`
2. **Writes template JSON** → Use `create-activity-template`
3. **Fixes bugs** → Use `fix-bug-with-impulses`
4. **Runs tests** → Use `validate-build-complete`
5. **Delegates to agents** → Use `multi-agent-acp-workflow`
6. **Jingles docs** → Use `jiggle-documentation`
7. **Measures startup time** → Use `diagnose-startup-issues`
8. **Searches codebase for issues** → Metabob tool (not activity)
9. **Commits code** → Implementation concern (not pattern analysis)
10. **Optimizes context** → Use `manage-session-memory`

---

## 📊 Overlap Matrix with Related Activities

| Activity | Overlap Area | Boundary |
|----------|-------------|----------|
| **manage-session-memory** | Both analyze context needs | MSM manages runtime memory; ACP analyzes historical patterns |
| **create-activity-template** | Both inform template design | CAT creates templates; ACP extracts patterns that inform design |
| **improve-bootstrap-template** | Both enhance templates | IBT improves specific templates; ACP finds improvement patterns |
| **diagnose-startup-issues** | Both analyze workflows | DSI fixes performance; ACP extracts diagnostic patterns |
| **jiggle-documentation** | Both work with docs | JD maintains doc lifecycle; ACP creates new pattern docs |
| **fix-bug-with-impulses** | Both use historical data | FBW fixes bugs; ACP extracts bug-fixing patterns |
| **multi-agent-acp-workflow** | Both coordinate work | MAW orchestrates agents; ACP documents coordination patterns |

**Key Principle**: `analyze-conversation-patterns` is **META-LEVEL** analysis. It studies OTHER activities to extract reusable patterns. It doesn't DO the work, it analyzes HOW the work was done successfully.

---

## ✅ Success Criteria

An activity execution is IN SCOPE if it:

1. ✅ Analyzes historical conversation data
2. ✅ Extracts recurring patterns
3. ✅ Documents tool sequences
4. ✅ Creates pattern catalog
5. ✅ Provides copy-paste examples
6. ✅ Identifies anti-patterns
7. ✅ Makes recommendations for future work

An activity execution is OUT OF SCOPE if it:

1. ❌ Implements fixes or features
2. ❌ Creates/modifies templates
3. ❌ Manages session memory
4. ❌ Runs tests or validation
5. ❌ Coordinates multi-agent workflows
6. ❌ Maintains documentation
7. ❌ Executes diagnostic workflows

---

## 🎯 Single Goal Test

**Question**: Does this task directly contribute to extracting and documenting conversation patterns?

- **YES** → In scope
- **NO** → Out of scope (use different activity)

**Example Applications**:

| Task | In Scope? | Reasoning |
|------|-----------|-----------|
| Read activity execution logs | ✅ YES | Gathers data for pattern extraction |
| Create impulse with analysis results | ❌ NO | Memory management (use manage-session-memory) |
| Document common tool sequences | ✅ YES | Pattern documentation (core goal) |
| Create template from patterns | ❌ NO | Template creation (use create-activity-template) |
| Identify diagnostic-first pattern | ✅ YES | Pattern identification (core goal) |
| Run startup diagnostics | ❌ NO | Diagnostic execution (use diagnose-startup-issues) |
| Write pattern catalog markdown | ✅ YES | Pattern documentation (core goal) |
| Jiggle pattern docs with existing | ❌ NO | Doc maintenance (use jiggle-documentation) |

---

## 📝 Template Variables (Appropriate for Scope)

### ✅ In-Scope Variables
- `activityLogPath` - Where to find execution logs
- `sessionDataPath` - Where to find session summaries
- `outputPath` - Where to write pattern documentation
- `analysisDepth` - How detailed to make pattern extraction
- `maxConversations` - How many conversations to analyze
- `patternCategories` - Which categories to focus on

### ❌ Out-of-Scope Variables
- `templateOutputPath` - Creating templates (out of scope)
- `impulseBudget` - Memory management (out of scope)
- `testCommand` - Running tests (out of scope)
- `fixBugs` - Implementing fixes (out of scope)
- `delegateToAgent` - Multi-agent coordination (out of scope)

---

## 🔗 Integration Points

### Upstream Dependencies (What Provides Input)
- Activity execution logs (from any activity)
- Session summaries (from completed sessions)
- Success documentation (COMPLETE.md, SUMMARY.md files)
- Test results (pass/fail rates)

### Downstream Consumers (What Uses Output)
- **`create-activity-template`** - Uses patterns to design new templates
- **`improve-bootstrap-template`** - Uses patterns to enhance templates
- **Developers** - Reference patterns in daily work
- **Learning System** - Ingests patterns for training (future)

### Composition Patterns
```typescript
// Pattern: Extract patterns → Create template from patterns
activity({
  activityId: "analyze-conversation-patterns",
  variables: { outputPath: "/tmp/patterns.md" }
})

// Then (separate invocation):
activity({
  activityId: "create-activity-template",
  variables: { 
    patternReference: "/tmp/patterns.md",
    templateName: "new-workflow"
  }
})
```

**Note**: These are SEPARATE activities. `analyze-conversation-patterns` doesn't call `create-activity-template` internally.

---

## 🚀 Recommendations for Implementation

### DO:
1. ✅ Focus on extraction and documentation
2. ✅ Provide concrete, copy-paste examples
3. ✅ Use structured output formats
4. ✅ Cross-reference related activities
5. ✅ Validate patterns against multiple examples
6. ✅ Include decision trees and flowcharts
7. ✅ Document anti-patterns prominently

### DON'T:
1. ❌ Implement fixes or features
2. ❌ Create or modify templates
3. ❌ Manage session memory
4. ❌ Run tests or diagnostics
5. ❌ Coordinate multi-agent workflows
6. ❌ Maintain documentation lifecycle
7. ❌ Execute any "action" beyond analysis

---

## 📖 Related Documentation

- **Activity Scope Boundaries**: `ACTIVITY_SCOPE_BOUNDARIES.md`
- **Pattern Quick Reference**: `PATTERN_QUICK_REFERENCE.md` (output of this activity)
- **Activity Workflow Guide**: `ACTIVITY_WORKFLOW_QUICK_REFERENCE.md`
- **Template Creation Guide**: `create-activity-template.json`
- **Session Memory Guide**: `manage-session-memory.json`

---

## ✅ Conclusion

**Analyze Conversation Patterns** is a **pure analysis activity** focused on:
- 🎯 **Extracting** patterns from successful conversations
- 📝 **Documenting** those patterns for reuse
- 🔍 **Identifying** anti-patterns and failure modes

It does NOT:
- ❌ Implement fixes or features
- ❌ Create or modify templates
- ❌ Manage memory or coordinate agents
- ❌ Run tests or diagnostics

**Scope Test**: If it's not about extracting and documenting patterns, it's out of scope.

---

**Date**: 2026-02-05  
**Status**: ✅ Scope Boundaries Defined  
**Next Step**: Implement activity template following these boundaries
