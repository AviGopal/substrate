# Quick Start: Self-Improving Development System

> **⚠️ STATUS: SUPERSEDED**
> 
> This quick start guide describes the v1.0.0 annotation-driven architecture, which has been replaced by the **double-blind A/B testing approach (v3.0.0)**.
>
> **For current system:**
> - [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - Current architecture
> - [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - Implementation guide with 6-week roadmap
> - [QUICK_START_LEARNING_SYSTEM.md](QUICK_START_LEARNING_SYSTEM.md) - This document (historical)
>
> **What changed:**
> - Agent-visible annotations → Server-side hidden variants
> - Component-specific prompts → Opaque single recommendations
> - Association graphs with scores → Thompson Sampling without scores
> - 5 annotation budget → Unlimited server-side learning
>
> **What stayed the same:**
> - ✅ Validation gates (still critical!)
> - ✅ Pre-commit hooks
> - ✅ Metabob CPG decomposition
> - ✅ Learning from success/failure feedback
>
> This document is preserved for the validation gates and immediate actions, which remain relevant.

---

## Original Quick Start (v1.0.0 - Historical)

**For**: Developers who want to prevent "17,000 lines of useless code" disasters  
**Time**: 15 minutes to understand, 6 weeks to implement (v3.0.0 architecture)  
**Impact**: 85%+ fix success rate vs. <20% before

---

## The Problem We're Solving

**What happened with the memory leak fix**:
- 5 commits, 17,789 lines of code added
- None of it actually fixed the leak
- All of it needs to be maintained now
- Memory still leaking at 16GB+

**What should have happened**:
- 1 commit, 3 lines changed
- Leak fixed (16GB → 95MB)
- No maintenance burden
- System learned for next time

**How metabob prevents this**: Automated validation gates that detect orphaned code before commit.

---

## Three-Minute Overview

### The System in 3 Sentences

1. **Metabob analyzes** your proposed fix to verify it actually affects the problem area
2. **Validation gates** catch orphaned code, missing integrations, and ineffective approaches
3. **Learning system** updates annotations and prompts so mistakes aren't repeated

### The Magic: Validation Gates

```typescript
// Before commit, automatically run:

✅ Gate 1: Impact Analysis
   └─ Does change affect problem area? 
   └─ SessionMemoryManager → ❌ No path to Session.messages (FAIL)

✅ Gate 2: Integration Check  
   └─ Is new code actually called?
   └─ BoundedImpulseCache → ❌ Never imported (FAIL)

✅ Gate 3: Related Changes
   └─ All integration points updated?
   └─ SessionMemoryManager created → ❌ Session.create() not updated (FAIL)

✅ Gate 4: Performance Validation
   └─ Does metric actually improve?
   └─ Memory after LRU cache → ❌ Still 16GB (FAIL)
```

**Result**: Bad fixes are caught automatically, never committed.

---

## Immediate Actions (Before Full Implementation)

### Action 1: Add Impact Analysis to Your Workflow (5 minutes)

**Before implementing any fix**, run:

```bash
# 1. Identify the problem component
export PROBLEM_COMPONENT="src/session/index.ts::messages"

# 2. Propose your fix
export FIX_FILE="src/session/session-memory-manager.ts"
export FIX_COMPONENT="SessionMemoryManager"

# 3. Analyze impact
npm run analyze-impact -- \
  --fix-file $FIX_FILE \
  --fix-component $FIX_COMPONENT \
  --problem-component $PROBLEM_COMPONENT
```

**What it checks**:
- Does fix have execution path to problem? (call chain)
- Is fix actually integrated? (has callers)
- What related changes are needed? (integration points)

**Output**:
```
Impact Analysis: SessionMemoryManager

❌ FAIL: No execution path to problem component
   Problem: src/session/index.ts::messages
   Fix: src/session/session-memory-manager.ts::SessionMemoryManager
   Path: NONE FOUND
   
❌ FAIL: No integration points
   Callers: ['tests/session-memory-manager.test.ts']
   Live paths: NONE
   Deletion safety: HIGH (can delete safely)
   
❌ FAIL: Missing related changes
   Required updates:
   - src/session/index.ts::Session.create() (register session)
   - src/app.ts::startup() (initialize manager)
   
🚫 RECOMMENDATION: DO NOT COMMIT
   This fix is orphaned and won't affect the problem.
   
💡 SUGGESTION: 
   Fix the actual source (messages function) instead of adding infrastructure.
```

### Action 2: Add Pre-Commit Hook (10 minutes)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Pre-commit validation gate
echo "🔍 Running validation gates..."

# Get changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=AM)

# For each new/modified file
for file in $CHANGED_FILES; do
  # Skip non-code files
  if [[ ! $file =~ \.(ts|js|py)$ ]]; then
    continue
  fi
  
  echo "📄 Validating: $file"
  
  # Extract components (simple heuristic - improve with metabob)
  COMPONENTS=$(rg "^(export )?(class|function|const) \w+" "$file" -o | cut -d' ' -f3)
  
  for component in $COMPONENTS; do
    # Check if component is called
    CALLERS=$(rg "\b$component\(" --files-with-matches | grep -v "$file" | grep -v "test" | wc -l)
    
    if [ "$CALLERS" -eq 0 ]; then
      echo "⚠️  WARNING: $component in $file has no callers (excluding tests)"
      echo "   This may be orphaned code. Verify integration before committing."
      
      read -p "   Continue anyway? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Commit aborted"
        exit 1
      fi
    fi
  done
done

echo "✅ Validation passed"
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

**What it does**: Warns about orphaned code before commit.

### Action 3: Document Known Pitfalls (15 minutes)

Create `docs/COMPONENT_LEARNINGS.md`:

```markdown
# Component-Specific Learnings

## Session.messages (src/session/index.ts)

### ✅ What Works
- Add default limit: `.default(100)` in schema + runtime fallback
- Keep loop logic simple: `if (count >= limit) break`
- 3-line fix: schema default + fallback + loop condition

### ❌ What Doesn't Work  
- Adding LRU caches downstream (tried 2x, failed both)
  - Reason: Doesn't prevent initial unbounded load
- Creating manager classes (tried 3x, failed all)
  - Reason: Become orphaned without explicit integration
- Periodic cleanup (tried 1x, failed)
  - Reason: Races with memory growth

### 🎯 Root Cause Pattern
Memory leaks in streaming functions → Add limit at source, not downstream

### ⚠️ Known Pitfalls
1. Schema default alone insufficient (must have runtime fallback)
2. Downstream fixes don't work (must fix at source)
3. Infrastructure additions often become orphaned

### 📊 Validation Criteria
- Memory < 100MB after loading 1000 sessions
- All tests pass
- New test: verify limit enforced when not specified
```

**Update after each fix attempt** (success or failure).

---

## Full Implementation (5 Weeks)

### Week 1: Annotation Budget System

**Goal**: Prevent annotation bloat (max 5 per component, 2500 tokens)

**Tasks**:
1. Create `ComponentAnnotationBudget` schema (see [ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md))
2. Implement refinement algorithm:
   - Update relevance scores after validation
   - Evict lowest-scoring when over budget
   - Compress similar annotations
3. Integrate with metabob_annotate_component
4. Test on 10 components from metabob-opencode

**Deliverable**: Bounded annotation system with automatic refinement

### Week 2: Prompt Optimization

**Goal**: Components learn their optimal prompts

**Tasks**:
1. Create `ComponentPromptProfile` schema
2. Track effective vs. ineffective instructions
3. Extract pitfalls from failures
4. Generate optimized prompts from learned patterns
5. Version prompts to track evolution

**Deliverable**: Component-specific prompts that improve over time

### Week 3: Metabob Decomposition

**Goal**: Automatic task breakdown using CPG

**Tasks**:
1. Implement `decomposeTaskByComponents` using:
   - `metabob_search_codebase_issues` (find entry points)
   - `metabob_analyze_change_impact` (trace dependencies)
   - `metabob_suggest_related_changes` (find integration points)
2. Generate component-targeted activities
3. Add validation gates (4 gates from above)
4. Test on complex multi-component tasks

**Deliverable**: Automatic decomposition with validation gates

### Week 4: Association Learning

**Goal**: Remember what worked before

**Tasks**:
1. Create `AssociationGraph` schema
2. Update edges after each validation:
   - component ↔ impulse (which context helps)
   - component ↔ task (which tasks work)
   - task ↔ activity (which activities work)
3. Implement optimal context selection (knapsack algorithm)
4. Prune weak associations (< 0.2 weight + > 0.7 confidence)

**Deliverable**: Learning system that improves context selection

### Week 5: Integration & Testing

**Goal**: End-to-end workflow

**Tasks**:
1. Create `component-targeted-fix-with-learning` activity template
2. Test on memory leak (verify 3-line fix, not 17,000)
3. Test on 5 other real bugs
4. Measure learning convergence (metrics dashboard)
5. Document usage patterns

**Deliverable**: Production-ready learning system

---

## How to Use After Implementation

### Scenario: Fix a Bug

```bash
# 1. Bootstrap (first time only)
npm run bootstrap-learning-system ./repos/metabob-opencode

# 2. Run learning-enabled fix
npm run fix-with-learning -- \
  --issue "Memory leak in session messages" \
  --repository ./repos/metabob-opencode \
  --validation "npm run test:memory"
```

**What happens automatically**:

1. **Decomposition**: Metabob identifies impacted components (Session.messages)
2. **Context Loading**: Association graph selects optimal impulses
3. **Prompt Generation**: Component-specific prompt loaded (with pitfalls)
4. **Implementation**: Fix applied using optimized prompt
5. **Validation Gates**:
   - ✅ Impact analysis (does it affect problem?)
   - ✅ Integration check (is code actually used?)
   - ✅ Related changes (all integrations updated?)
   - ✅ Performance validation (does metric improve?)
6. **Learning**:
   - Annotations updated (add success/failure insight)
   - Prompt refined (move instructions to effective/ineffective)
   - Associations updated (boost helpful context, prune unhelpful)
7. **Commit**: Only if all gates pass

**Output**:

```
🚀 Fix with Learning: Memory leak in session messages

📊 Decomposition (via metabob):
   └─ 1 component: src/session/index.ts::messages
   └─ Impact: Root cause (no default limit)
   └─ Effort: Simple (3 lines)

📚 Context Loading:
   └─ Selected 2 impulses (1800 tokens):
      - impulse_streaming_patterns (score: 0.82)
      - impulse_memory_optimization (score: 0.75)

📝 Prompt Generation (v1):
   └─ No previous attempts (clean slate)
   └─ Generic approach suggested

🔧 Implementation:
   └─ Added schema default: .default(100)
   └─ Added runtime fallback: const limit = input.limit ?? 100
   └─ Updated loop: if (count >= limit) break

✅ Validation Gates:
   ✅ Impact analysis: Change affects Session.messages ✓
   ✅ Integration check: Code is live (8 callers) ✓
   ✅ Related changes: No missing integrations ✓
   ✅ Performance: Memory 16GB → 95MB (99.4% reduction) ✓

📚 Learning:
   ✓ Annotation added: "SUCCESS - Default limit fixed leak"
   ✓ Prompt updated: v1 → v2 (added effective instruction)
   ✓ Associations updated: 4 edges strengthened
   
✅ Committed: fix: memory leak in session messages (1 commit, 3 lines)

💡 Next time:
   - System knows schema default + fallback works
   - Will avoid adding managers/caches (learned they don't work)
   - Prompt v2 will guide toward correct approach
```

---

## Measuring Success

### Before (Memory Leak Disaster)
- 5 commits
- 17,789 lines added
- 0% success rate
- Days of wasted effort
- Memory still leaking
- 17,789 lines to maintain forever

### After (Learning System)
- 1 commit
- 3 lines changed
- 100% success rate (all gates passed)
- 15 minutes
- Leak fixed (99.4% reduction)
- System learned for next time

### Long-Term Metrics

**Track these in dashboard**:

```typescript
interface LearningMetrics {
  // Annotation health
  avgAnnotationsPerComponent: number     // Target: 3-5
  avgTokensPerComponent: number          // Target: 1500-2500
  
  // Prompt effectiveness  
  successRateByVersion: Map<number, number> // Should increase
  costPerFix: number                     // Should decrease
  
  // Fix quality
  firstAttemptSuccessRate: number        // Target: 85%+
  avgLinesPerFix: number                 // Target: <100
  codeChurn: number                      // Target: minimal
  
  // Learning rate
  insightsPerFix: number                 // Target: 1-2
  associationConvergence: number         // Target: stabilizing
}
```

**Success criteria** (after 10 fixes):
- ✅ First-attempt success rate > 80%
- ✅ Avg lines per fix < 100
- ✅ No orphaned code commits
- ✅ Prompt versions converging (fewer changes)
- ✅ Association weights stabilizing

---

## FAQ

### Q: Do I need metabob for this to work?
**A**: Partially. You can implement validation gates without metabob (using simple grep/rg), but decomposition and impact analysis require metabob CPG.

### Q: How much does this slow down development?
**A**: Initial overhead: ~5 minutes per fix (validation gates). Long-term speedup: 10x+ (no wasted attempts).

### Q: What if validation gates are too strict?
**A**: Gates are configurable. Start with "warn" mode, then switch to "block" once tuned.

### Q: How long until the system is "learned"?
**A**: ~10 fixes per component. System useful from day 1 (validation gates), optimal after ~50 total fixes.

### Q: Can I use this for new features (not just fixes)?
**A**: Yes! Same decomposition/validation/learning applies. Works for any code change.

---

## Next Steps

1. **Immediate** (today): Add impact analysis to workflow (5 min)
2. **This week**: Add pre-commit hook (10 min)  
3. **This month**: Document component learnings (15 min/component)
4. **Next 5 weeks**: Implement full system (see roadmap above)
5. **Ongoing**: Monitor learning metrics, tune as needed

---

## Resources

- **Architecture**: [ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md)
- **Overview**: [SELF_IMPROVING_DEVELOPMENT_SYSTEM.md](./SELF_IMPROVING_DEVELOPMENT_SYSTEM.md)
- **Template**: [component-targeted-fix-with-learning.json](../templates/validation/component-targeted-fix-with-learning.json)
- **Bootstrap**: [bootstrap-annotation-learning-system.ts](../scripts/bootstrap-annotation-learning-system.ts)
- **Integration**: [INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md](./INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md)

---

**Remember**: The goal isn't perfection on day 1. The goal is a system that learns from every fix and gets better over time. Start with validation gates (prevent disasters), add learning incrementally (improve over time).
