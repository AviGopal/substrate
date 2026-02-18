# Trailblazing Duplication Issue

## What Happened

While implementing Phase 4 (trailblazing recovery), we accidentally created a duplicate trailblazing system. The codebase **already has** a sophisticated trailblazing implementation.

## Existing System

**File**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`

**What it does**:
- AI-powered task continuation after failures
- Generates continuation prompts using `ContinuationGenerator`
- Retries the SAME task with better context
- Tracks recovery attempts and costs
- Integrates with impulse system

**Architecture**:
```
Task fails → TrailblazingExecutor.executeTaskWithTrailblazing()
  → ContinuationGenerator.generate() (AI generates continuation prompt)
  → Retry task with new context
  → Track recovery attempts
  → Report success/failure with metrics
```

## What We Accidentally Added

**Changes**: Added to `template-executor.ts`

**What it does**:
- Generates NEW recovery tasks after failures
- Appends tasks to template dynamically
- Creates fix-schema-errors, retry-registration tasks
- Modifies task graph during execution

**Architecture**:
```
Task fails → generateRecoveryTasks()
  → Analyze error (schema? registration?)
  → Create new Task objects
  → Append to template.tasks
  → Re-compute execution order
  → Continue with new tasks
```

## Key Differences

| Feature | Existing System | Accidentally Added |
|---------|----------------|-------------------|
| Approach | Retry same task | Create new tasks |
| AI-Powered | Yes (continuation prompts) | No (hardcoded task templates) |
| Task Graph | Static | Dynamic (appends tasks) |
| Context | Enhanced prompt | New task with variables |
| Integration | Deep (impulses, metrics) | Surface (basic task creation) |
| Sophistication | High | Low |

## Should We Keep Both?

**NO** - They serve the same purpose but with different approaches.

**Decision**: Use the **existing system** because:
1. Already implemented and tested
2. AI-powered (smarter)
3. Integrated with impulse system
4. Tracks metrics properly
5. More sophisticated error recovery

**Our addition adds value ONLY if**:
- Existing system doesn't handle schema errors well
- We need multi-step recovery workflows
- We need to generate entirely new tasks (not retries)

## What to Do

### Option 1: Remove Our Addition (Recommended)
```bash
git stash  # Already done
```
- Keep existing TrailblazingExecutor
- Test if it handles registration failures adequately
- If not, enhance it rather than duplicate

### Option 2: Merge Approaches
- Use TrailblazingExecutor for general failures
- Use generateRecoveryTasks() ONLY for schema errors
- Add flag to distinguish "retry with context" vs "fix and retry"

### Option 3: Replace Existing System
- Remove TrailblazingExecutor
- Use our simpler task-generation approach
- Lose AI-powered intelligence

## Recommendation

**Use existing TrailblazingExecutor**. It's more sophisticated.

**Phase 4 is likely ALREADY IMPLEMENTED** via the existing trailblazing system.

**Next Steps**:
1. Review TrailblazingExecutor capabilities
2. Test if it handles registration schema errors
3. If yes → Phase 4 is done, no changes needed
4. If no → Enhance TrailblazingExecutor, don't duplicate

## Conclusion

We should have checked for existing implementations before coding. The trailblazing feature already exists and is more sophisticated than what we built.

**Action**: Stash our changes, use existing system, verify it meets Phase 4 requirements.
