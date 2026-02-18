# Context Requirements - Quick Reference

**Status**: ✅ Architecture Validated (Feb 16, 2026)

## The Missing Link Found! 🎉

**File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`  
**Lines**: 2589-2628  
**What it does**: Extracts context requirements from templates and passes them to memory agent

## Flow in 9 Steps

```
Backend (SurrealDB)
  └─> CLI (metabob-cli) - converts snake_case ↔ camelCase
      └─> Activity Tool (activity.ts) - loads template
          └─> Session Prompt (prompt.ts) ⭐ EXTRACTS CONTEXT REQUIREMENTS ⭐
              └─> buildMemoryAgentPrompt() - formats requirements
                  └─> Memory Agent Subagent - receives formatted prompt
                      └─> impulse_create tool - creates matching impulses
                          └─> <session_memory> - loads impulses
                              └─> Main Agent - receives context
```

## Critical Code Location

### File: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`

#### Line 2600: Extract Requirements
```typescript
activityContextHints = template.contextRequirements
```

#### Line 2618: Pass to Memory Agent
```typescript
const memoryPrompt = buildMemoryAgentPrompt({
  userMessage: input.promptText,
  contextRequirements: activityContextHints,  // ⭐ HERE!
  targetSession: input.sessionID
})
```

#### Lines 2538-2544: Format into Prompt
```typescript
Activity requirements:
${input.contextRequirements.map(r => 
  `- ${r.key} (${r.required ? 'REQUIRED' : 'optional'}): ${r.hint}
   Allowed types: ${r.impulseTypes.join(", ")}
   Budget range: ${r.budgetRange[0]}-${r.budgetRange[1]} tokens`
).join("\n")}
```

## Templates with Context Requirements

5 core templates in backend (confirmed Feb 15, 2026):

| Template ID | Requirements | Example |
|------------|--------------|---------|
| `refactor-72eb4607` | 3 | target-code, usage-patterns, test-coverage |
| `bug-fix-93374d0f` | 3 | bug-context, affected-code, similar-fixes |
| `feature-impl-c4b2e8ee` | 3 | codebase-patterns, project-conventions, dependency-context |
| `add-rest-endpoint-97b69d8d` | 2 | api-context, endpoint-spec |
| `activity-create-29e9d6c5` | 3 | pattern-source, similar-templates, validation-context |

## What's Validated ✅

- ✅ Templates stored with context_requirements
- ✅ CLI converts data structures correctly
- ✅ Activity tool loads templates
- ✅ **Session prompt extracts and passes requirements** ⭐
- ✅ Prompt builder formats requirements
- ✅ Memory agent receives formatted instructions
- ✅ Data structures match across all layers

## What Needs Runtime Testing 🟡

- 🟡 Memory agent actually creates matching impulses
- 🟡 Impulses appear in <session_memory>
- 🟡 Budget ranges are enforced
- 🟡 "required" flag affects priority
- 🟡 Agent receives properly contextualized info

## Next Steps

1. Add trace logging to prompt.ts (lines 2600, 2656)
2. Execute activity with context requirements
3. Capture logs showing:
   - Requirements extracted
   - Memory agent receives requirements
   - Impulses created matching requirements
   - <session_memory> populated with impulses
4. Validate budgets and types are respected

## The Discovery

**We found the connection!** The session prompt handler (prompt.ts) is responsible for:
1. Detecting when a session is running an activity (line 2592)
2. Loading the activity and template (lines 2596-2598)
3. **Extracting context requirements** (line 2600)
4. **Passing them to memory agent** (line 2618)

This happens BEFORE every prompt in an activity session, ensuring the memory agent always has access to context requirements.

---

**Bottom Line**: The architecture is solid. Context requirements flow from backend → CLI → activity tool → **session prompt handler** → memory agent → impulse creation → agent context. We just need runtime traces to confirm it works as designed.
