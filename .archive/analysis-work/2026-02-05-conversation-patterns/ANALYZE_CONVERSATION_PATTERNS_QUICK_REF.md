# Quick Reference: Analyze Conversation Patterns Scope

**Activity**: analyze-conversation-patterns  
**Category**: infrastructure  
**Purpose**: Extract reusable patterns from successful conversations

---

## ⚡ Quick Decision Guide

```
Does this task extract/document patterns from past work?
  ├─ YES → In scope ✅
  └─ NO → Use different activity ❌
```

---

## ✅ In Scope (Do This)

1. **Analyze** successful activity logs
2. **Extract** recurring patterns
3. **Document** tool sequences
4. **Identify** context requirements
5. **Create** pattern catalog
6. **Find** anti-patterns
7. **Make** recommendations

---

## ❌ Out of Scope (Don't Do)

| What | Use Instead |
|------|-------------|
| Create impulses | manage-session-memory |
| Create templates | create-activity-template |
| Fix bugs | fix-bug-with-impulses |
| Run diagnostics | diagnose-startup-issues |
| Maintain docs | jiggle-documentation |
| Coordinate agents | multi-agent-acp-workflow |
| Run tests | validate-build-complete |

---

## 🎯 Mental Model

**This activity is an ANTHROPOLOGIST**
- Observes successful work
- Extracts patterns
- Documents for reuse

**NOT a builder, fixer, or coordinator**

---

## 📋 Valid Tasks

```
✅ gather-success-data
✅ extract-tool-sequences
✅ analyze-context-patterns
✅ document-validation-patterns
✅ create-pattern-catalog
```

---

## 🚫 Invalid Tasks

```
❌ create-memory-impulses (use manage-session-memory)
❌ implement-template (use create-activity-template)
❌ fix-found-bugs (use fix-bug-with-impulses)
❌ run-tests (use validate-build-complete)
```

---

## 🔍 Edge Case Handling

| Scenario | Action |
|----------|--------|
| No successful data | Document need for examples ✅<br>Don't create synthetic patterns ❌ |
| Patterns suggest template | Document pattern ✅<br>Don't create template ❌ |
| Patterns reveal bugs | Document anti-pattern ✅<br>Don't fix bugs ❌ |
| Overlapping docs | Cross-reference ✅<br>Don't jiggle ❌ |

---

## 📦 Context Requirements

### ✅ Valid
- `activityLogs` - Execution logs
- `sessionSummaries` - Success docs
- `existingPatterns` - Prior patterns

### ❌ Invalid
- `memoryBudget` - Memory management
- `templateToCreate` - Template creation
- `testCommand` - Running tests

---

## 🎓 Core Principle

**"Meta-level observation, not execution"**

Analyzes HOW work was done successfully.  
Doesn't DO the work itself.

---

## 🚦 Red Flags (Scope Violation)

If activity does these, it's out of scope:

1. Creates impulses
2. Writes template JSON
3. Fixes bugs
4. Runs tests
5. Delegates to agents
6. Jiggles docs
7. Measures startup time
8. Searches for code issues
9. Commits code
10. Optimizes context

---

## 📊 Success Checklist

### In Scope ✅
- [ ] Analyzes historical data
- [ ] Extracts patterns
- [ ] Documents sequences
- [ ] Creates catalog
- [ ] Provides examples
- [ ] Identifies anti-patterns

### Out of Scope ❌
- [ ] Creates impulses
- [ ] Creates templates
- [ ] Implements fixes
- [ ] Runs tests
- [ ] Delegates to agents
- [ ] Maintains docs

---

## 🔗 Related Docs

- **Detailed**: `ANALYZE_CONVERSATION_PATTERNS_SCOPE.md`
- **Visual**: `ANALYZE_CONVERSATION_PATTERNS_SCOPE_VISUAL.md`
- **This**: Quick reference card

---

**Status**: ✅ Scope Defined  
**Date**: 2026-02-05  
**Ready**: Template implementation
