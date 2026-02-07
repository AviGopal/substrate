# Activity Tool Simplification: Quick Reference

## The Problem

**Current state**: Agents see 10+ activity tools with 500+ lines of implementation details.

**Result**: Agents get distracted trying to debug, register, and inspect activities instead of just using them.

**Impact**: Slow orchestration, confusion about HOW instead of WHAT/WHEN.

---

## The Solution

### Reduce to 2 Core Tools

| Tool | Purpose | Lines | Agent Sees |
|------|---------|-------|------------|
| `search_activities` | Discovery | ~25 | ✅ YES |
| `activity` | Execution | ~25 | ✅ YES |

### Hide 8 Implementation Tools

| Tool | Purpose | Agent Sees | Instead Use |
|------|---------|------------|-------------|
| `list_activity_templates` | List templates | ❌ NO | search_activities |
| `get_activity_template` | Get single template | ❌ NO | search verbose |
| `register_activity_template` | Create templates | ❌ NO | CLI command |
| `debug_activity_execution` | Debug execution | ❌ NO | Framework auto |
| `activity_error_inspector` | Inspect errors | ❌ NO | Framework auto |
| `activity_replay` | Replay execution | ❌ NO | Dev tool only |
| `post_activity_result` | Report outcome | ❌ NO | Framework auto |
| `enhanced_activity_executor` | Enhanced exec | ❌ NO | Framework auto |

---

## Agent Experience

### Before (Distracted)

```
Agent: "Add user registration endpoint"

Agent thinks:
  1. search_activities → Found "add-rest-endpoint"
  2. Should I debug it first? → debug_activity_execution
  3. Should I register custom? → register_activity_template
  4. Check for errors? → activity_error_inspector
  5. Finally run it → activity
  
Result: 5 tool calls, slow execution
```

### After (Focused)

```
Agent: "Add user registration endpoint"

Agent thinks:
  1. search_activities → Found "add-rest-endpoint" (85% success)
  2. activity → Execute it
  
Result: 2 tool calls, fast execution
```

---

## Implementation Steps

### Phase 1: Hide Tools (Day 1)
```typescript
const agentTools = [
  "activity",
  "search_activities"
  // NOT: debug_activity_execution
  // NOT: register_activity_template
  // etc.
]
```

### Phase 2: Simplify Descriptions (Day 2-3)
- `activity.txt`: 37 lines → 25 lines
- `search_activities.txt`: 38 lines → 25 lines
- Focus on WHAT/WHEN, remove HOW

### Phase 3: Update AGENTS.md (Day 4-5)
- Activity section: 500+ lines → 100 lines
- Remove template creation details
- Remove debugging workflows
- Focus on discovery + execution

### Phase 4: Auto-Report (Day 6)
```typescript
// Framework automatically reports outcomes
TemplateExecutor.execute() // ← automatically calls reportOutcome()
```

---

## Key Principles

### 1. Agents Orchestrate, Framework Executes

**Agent's job**:
- Pick WHICH activity to run
- Decide WHEN to run it
- Provide required variables

**Framework's job**:
- Execute tasks
- Handle errors
- Record metrics
- Send to Metabob

### 2. Hide Implementation, Show Interface

**Show to agents**:
- Activity IDs and names
- Success rates
- Required variables
- Simple execution syntax

**Hide from agents**:
- Template schemas
- Debugging tools
- Registration process
- Error inspection
- Internal execution logic

### 3. Automatic > Manual

**Automatic** (framework does it):
- Outcome reporting
- Metrics recording
- Error recovery
- Metabob sync

**Manual** (agent chooses):
- Activity selection
- Variable values
- Orchestration decisions

---

## Success Metrics

| Metric | Before | After | Goal |
|--------|--------|-------|------|
| Agent-visible tools | 10+ | 2 | Simple |
| Tool descriptions | 500+ lines | 50 lines | Focused |
| AGENTS.md section | 500+ lines | 100 lines | Concise |
| Avg tool calls per activity | 5+ | 2 | Fast |
| Agent confusion | High | Low | Clear |
| Metabob learning | Manual | Auto | Reliable |

---

## Quick Commands

### For Agents (Simple)
```typescript
// 1. Find activity
search_activities({ category: "feature" })

// 2. Execute activity
activity({
  activityId: "add-rest-endpoint",
  variables: { method: "POST", path: "/api/users" },
  reason: "User wants registration"
})

// Done! Framework handles the rest.
```

### For Developers (When Needed)
```bash
# Register new template
opencode activity register template.json

# Debug execution (dev mode only)
opencode activity debug --template-id add-endpoint

# View metrics
opencode activity metrics --template-id add-endpoint
```

---

## Benefits

### For Agents
- ✅ Faster decision making (2 tool calls vs 5+)
- ✅ Less confusion (clear interface)
- ✅ Focus on orchestration (WHAT/WHEN not HOW)
- ✅ Cleaner instructions (100 lines vs 500+)

### For System
- ✅ Metabob still learns (auto reporting)
- ✅ Better data quality (automatic tracking)
- ✅ Easier to maintain (fewer tools)
- ✅ Clearer separation (agent vs framework)

### For Users
- ✅ Faster responses (agents less distracted)
- ✅ More reliable (validated workflows)
- ✅ Better outcomes (learned patterns)
- ✅ Consistent quality (framework-enforced)

---

## Rollback Plan

If issues arise:
```typescript
// Quick fix: Re-enable all tools
const agentTools = [
  "activity",
  "search_activities",
  "debug_activity_execution", // ← Restore
  "register_activity_template" // ← Restore
]
```

Or partial rollback:
```typescript
// Keep simplified descriptions but show all tools
// (Helps diagnose if problem is tool visibility or descriptions)
```

---

## Files Changed

### Core Changes
- `src/agent/agent.ts` - Tool visibility
- `src/tool/activity.txt` - Simplified description
- `src/tool/search-activities.txt` - Simplified description
- `src/session/template-executor.ts` - Auto-reporting
- `AGENTS.md` - Reduced activity section

### Files Removed (from agent context)
- `src/tool/debug-activity-execution.ts` - Dev tool only
- `src/tool/register-activity-template.ts` - CLI only
- `src/tool/activity-error-inspector.ts` - Framework handles
- `src/tool/list-activity-templates.ts` - Redundant with search

---

## Timeline

- **Week 1**: Hide implementation tools + simplify descriptions
- **Week 2**: Update AGENTS.md + auto-reporting
- **Week 3**: Deploy + monitor

Total: **3 weeks** from start to production.

---

## Documentation

- **Full Analysis**: `ACTIVITY_TOOL_ALIGNMENT_ANALYSIS.md`
- **Implementation Guide**: `ACTIVITY_TOOL_SIMPLIFICATION_IMPLEMENTATION.md`
- **This Summary**: `ACTIVITY_TOOL_SIMPLIFICATION_SUMMARY.md`

---

## Next Steps

1. ✅ Review this summary with team
2. ⏳ Implement Phase 1 (hide tools)
3. ⏳ Test with sample activities
4. ⏳ Deploy to staging
5. ⏳ Monitor agent behavior
6. ⏳ Deploy to production

---

## Contact

Questions? Check:
- Implementation guide for code examples
- Analysis doc for rationale and principles
- Test with staging environment first
