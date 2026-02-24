# Safe Self-Development System - Complete Implementation Plan

**Date:** 2026-02-22  
**Status:** ✅ Architecture Complete, Ready for Implementation  
**Principle:** **Always use activities. Develop ourselves safely in isolated containers.**

---

## Executive Summary

We've established a comprehensive architecture for **safe self-development** where OpenCode develops itself without risk of breaking the host environment.

**Core Innovation:** Use ACP delegation to run mutat activities in isolated devbob containers, validate there, sync via Git remote, then incorporate validated changes to host.

---

## What Was Accomplished

### 1. Architectural Documentation

✅ **SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md** (20 KB)
   - Complete architecture with diagrams
   - Safety principles and recovery mechanisms
   - ACP delegation pattern explained
   - Git synchronization strategy
   - 4 usage patterns documented
   - Recovery procedures for all failure scenarios

### 2. Core Principles Established

**1. Never Modify Host Directly for Risky Changes**
   - Core activity system, session management, execution engine
   - Always develop in container first

**2. Always Validate in Container Before Incorporating**
   - All tests must pass
   - Validation harness must succeed
   - No breaking changes to existing activities

**3. Use Git Remote as Synchronization Point**
   - Single source of truth
   - Full git history preserved
   - Branch-based isolation (main, self-dev/*)

**4. Always Use Activities for Everything**
   - No direct acp_delegate calls
   - No direct git commands
   - Everything through activity composition

---

## Architecture Overview

```
HOST                    REMOTE (GitHub)           CONTAINER
┌───────────┐          ┌─────────────┐          ┌──────────────┐
│           │─(push)→  │             │ ←(pull)─ │              │
│ OpenCode  │          │ Git Repo    │          │ OpenCode     │
│ (working) │ ←(pull)─ │ (source of  │─(push)→  │ (isolated)   │
│           │          │  truth)     │          │              │
└───────────┘          └─────────────┘          └──────────────┘
     │                                                  │
     │ acp_delegate (JSON-RPC over Docker)            │
     └────────────────────────────────────────────────┘

Flow:
1. Host pushes current state → Remote
2. Host delegates to Container via ACP
3. Container pulls from Remote
4. Container runs trace-enforce-validate-loop
5. Container validates with harness
6. Container pushes validated changes → Remote
7. Host pulls validated changes ← Remote
8. Host verifies changes work
```

---

## Four Core Activities to Create

### Activity 1: `develop-with-devbob-container`

**Purpose:** End-to-end safe self-development workflow

**Tasks (7):**

1. **Sync current state to remote**
   - Check git status, commit if needed
   - Push to working branch (e.g., self-dev/feature-name)
   - Verify push successful

2. **Prepare container delegation**
   - Create specification impulse
   - Prepare shared impulses (design docs, requirements)
   - Generate ACP delegation prompt

3. **Delegate to devbob-clean container**
   - Use acp_delegate tool
   - Share specification and context impulses
   - Prompt: "Clone repo, run trace-enforce-validate-loop, validate, push if successful"

4. **Monitor container execution**
   - Wait for container to complete
   - Read container's response
   - Extract validation results

5. **Verify container pushed changes**
   - Check remote for new commits
   - Verify validation impulses created
   - Confirm all tests passed in container

6. **Pull validated changes to host**
   - Pull from remote (working branch)
   - Merge if needed
   - Verify no conflicts

7. **Verify changes work on host**
   - Run tests on host
   - Execute validation harness on host
   - Create incorporation impulse
   - Return success/failure

**Variables:**
- `specificationName` (string, required) - Feature name
- `specificationDescription` (string, required) - What the feature does
- `expectedBehavior` (string, required) - Expected outcomes
- `validationStrategy` (string, required) - How to test
- `targetFiles` (array, optional) - Files to modify
- `workingBranch` (string, default: "self-dev/{specificationName}") - Git branch
- `containerTarget` (string, default: "docker://devbob-clean") - Container name
- `shareImpulses` (array, optional) - Impulse IDs to share with container

**Outputs:**
- Validated changes incorporated to host
- All impulses from container execution
- Validation harness created (reusable)
- Git commits with validation proof

---

### Activity 2: `sync-with-remote-repos`

**Purpose:** Bidirectional git synchronization

**Tasks (5):**

1. **Check git status**
   - Detect uncommitted changes
   - Detect unpushed commits
   - Determine sync requirements

2. **Commit if needed**
   - If uncommitted changes: commit with message
   - Create impulse documenting commit
   - Verify commit created

3. **Push to remote (if direction=push/both)**
   - Push branch to remote
   - Verify push successful
   - Record commit SHA

4. **Pull from remote (if direction=pull/both)**
   - Fetch from remote
   - Pull changes (merge or rebase)
   - Handle conflicts if any

5. **Verify sync complete**
   - Check local and remote are in sync
   - Create sync status impulse
   - Return success/failure

**Variables:**
- `direction` (enum: "push" | "pull" | "both", required)
- `branch` (string, required) - Branch to sync
- `commitMessage` (string, optional) - Message if committing
- `remote` (string, default: "origin") - Git remote name
- `conflictStrategy` (enum: "merge" | "rebase", default: "merge")

**Outputs:**
- Sync status (success/failure)
- Commit SHA (if committed or pulled)
- Conflict report (if conflicts occurred)
- Sync status impulse

---

### Activity 3: `validate-changes-in-container`

**Purpose:** Run validation harness in clean isolated environment

**Tasks (5):**

1. **Prepare validation request**
   - Identify commit SHA to validate
   - Locate validation harness
   - Prepare test command

2. **Delegate to container**
   - Use acp_delegate to container
   - Prompt: "Clone repo at SHA, run harness, return results"
   - Wait for completion

3. **Container clones and validates**
   - (Container task) Clone repo at specific commit
   - (Container task) Install dependencies
   - (Container task) Run validation harness
   - (Container task) Collect test output

4. **Collect validation results**
   - Read container's response
   - Extract test results (pass/fail)
   - Extract error logs if failed
   - Create validation results impulse

5. **Return validation status**
   - Return pass/fail to caller
   - Include test output
   - Include error details if failed

**Variables:**
- `commitSHA` (string, required) - Commit to validate
- `validationHarness` (string, required) - Path to harness file
- `testCommand` (string, default: "bun test") - Command to run
- `containerTarget` (string, default: "docker://devbob-clean")

**Outputs:**
- Validation status (pass/fail)
- Test output (full logs)
- Error logs (if failed)
- Validation results impulse

---

### Activity 4: `incorporate-validated-changes`

**Purpose:** Safely pull validated changes from remote to host

**Tasks (6):**

1. **Verify validation proof**
   - Load validation proof impulse
   - Verify validation passed in container
   - Check validation harness was created
   - Ensure all tests passed

2. **Check remote for changes**
   - Fetch from remote
   - Compare remote branch to local
   - Identify new commits
   - Verify commits match validation SHA

3. **Pull changes from remote**
   - Pull source branch
   - Merge if needed
   - Handle conflicts if any
   - Verify pull successful

4. **Verify changes work on host**
   - Run verification command (tests)
   - Execute validation harness on host
   - Compare results to container results
   - Ensure no regressions

5. **Document incorporation**
   - Create incorporation impulse
   - Record what changed (files, commits)
   - Record validation proof reference
   - Record verification results

6. **Return incorporation status**
   - Return success/failure
   - Include verification results
   - Include incorporation impulse ID

**Variables:**
- `sourceBranch` (string, required) - Branch to pull from
- `validationProof` (string, required) - Impulse ID proving validation passed
- `verifyCommand` (string, default: "bun test") - Command to verify on host
- `conflictStrategy` (enum: "merge" | "rebase", default: "merge")

**Outputs:**
- Incorporation status (success/failure)
- Verification results (host tests)
- Incorporation impulse (documentation)
- File change summary

---

## Implementation Priority

### Phase 1: Core Workflow (Immediate)

**Create:**
1. ✅ `develop-with-devbob-container.json` - End-to-end workflow
2. ✅ `sync-with-remote-repos.json` - Git synchronization

**Test:**
- Host → Remote → Container → Remote → Host flow
- Simple feature development (e.g., add logging function)
- Validation in container
- Incorporation to host

**Success Criteria:**
- Activity executes end-to-end
- Changes validated in container
- Changes incorporated to host safely
- No host breakage

---

### Phase 2: Validation & Incorporation (Short-term)

**Create:**
3. ✅ `validate-changes-in-container.json` - Isolated validation
4. ✅ `incorporate-validated-changes.json` - Safe incorporation

**Test:**
- Standalone validation (without full development)
- Incorporation with validation proof
- Conflict handling
- Recovery from failures

**Success Criteria:**
- Can validate any commit in container
- Can incorporate with validation check
- Conflicts handled gracefully
- Recovery mechanisms work

---

### Phase 3: Bootstrap & Productionization (Long-term)

**Add to Bootstrap:**
- All 4 activities added to bootstrap templates
- Available in cold start scenario
- Self-development possible from day 1

**Production Usage:**
- Use for ALL self-development
- Document patterns and best practices
- Collect metrics on usage
- Optimize based on learnings

**Success Criteria:**
- 100% of self-development uses safe workflow
- 0 host breakages from self-development
- <5 minutes recovery time from any failure

---

## Usage Examples

### Example 1: Add Activity Timeout Feature

```typescript
// Safe self-development of core feature
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    specificationName: 'activity-timeout-handling',
    specificationDescription: 'Activities must timeout after specified duration to prevent runaway costs',
    expectedBehavior: 'Activity execution stops after timeout, returns timeout error, no further LLM calls',
    validationStrategy: 'Create activity with timeout=5s, simulate slow task (10s), expect TimeoutError',
    targetFiles: [
      'repos/metabob-opencode/packages/opencode/src/activity/ActivityTool.ts',
      'repos/metabob-opencode/packages/opencode/src/activity/ActivityExecutor.ts'
    ],
    workingBranch: 'self-dev/activity-timeout',
    shareImpulses: ['design-spec-timeout'] // Share design decisions
  },
  reason: 'Safely develop activity timeout feature in isolated container to prevent breaking host'
})

// What happens:
// 1. Host commits current state, pushes to self-dev/activity-timeout
// 2. Host delegates to devbob-clean container
// 3. Container clones repo, checks out self-dev/activity-timeout
// 4. Container runs trace-enforce-validate-loop:
//    - Traces current ActivityTool implementation
//    - Enforces timeout specification (adds timeout logic)
//    - Creates validation harness (timeout test)
//    - Runs validation (all tests pass)
// 5. Container pushes validated changes to self-dev/activity-timeout
// 6. Host pulls validated changes from remote
// 7. Host verifies changes work (runs tests)
// 8. Success! Feature developed safely without breaking host
```

---

### Example 2: Fix Critical Bug in Session Management

```typescript
// Fix critical bug safely
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    specificationName: 'session-memory-leak-fix',
    specificationDescription: 'Fix memory leak in session management causing OOM after 100 sessions',
    expectedBehavior: 'Sessions properly cleaned up, memory usage stable over time',
    validationStrategy: 'Create 200 sessions, verify memory usage stable, no OOM',
    targetFiles: [
      'repos/metabob-opencode/packages/opencode/src/session/SessionManager.ts'
    ],
    workingBranch: 'self-dev/fix-session-leak',
    containerTarget: 'docker://devbob-clean'
  },
  reason: 'Fix critical session leak safely in container before applying to host'
})

// Why safe:
// - Host remains functional during development
// - Container validates fix with stress test
// - Only incorporate if validation passes
// - Can recover if fix breaks something
```

---

### Example 3: Validate Existing Changes

```typescript
// Already made changes on host, want to validate in clean environment
activity({
  templateId: 'sync-with-remote-repos',
  variables: {
    direction: 'push',
    branch: 'self-dev/test-validation',
    commitMessage: 'WIP: Validate impulse system changes'
  },
  reason: 'Push current state for validation'
})

// Then validate in container
activity({
  templateId: 'validate-changes-in-container',
  variables: {
    commitSHA: 'HEAD',
    validationHarness: 'tests/validation-harnesses/impulse-system-harness.ts',
    testCommand: 'bun test tests/impulse/ --coverage'
  },
  reason: 'Validate impulse changes in clean container before committing to main'
})

// If validation passes:
// - Confidence changes work in clean environment
// - Can merge to main safely
// If validation fails:
// - Fix on host
// - Validate again
// - Iterate until passing
```

---

## Recovery Scenarios

### Scenario 1: Host Broken After Bad Change

```bash
# Symptoms: Activities fail, OpenCode crashes

# Recovery:
git log --oneline -10  # Find last good commit
git reset --hard <good-commit>  # Reset to known good state

# Host functional again!
# Develop fix in container:
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    specificationName: 'fix-broken-host',
    // ... develop fix safely in container
  }
})
```

---

### Scenario 2: Container Broken

```bash
# Symptoms: ACP delegation fails, container unresponsive

# Recovery:
docker-compose --profile devbob down  # Stop container
docker-compose --profile stable --profile devbob up -d  # Fresh start

# Container has fresh state, can continue developing
```

---

### Scenario 3: Lost Work (Forgot to Sync)

```bash
# Symptoms: Made changes on host, didn't push, container can't access

# Prevention:
# ALWAYS run sync-with-remote-repos before container development

activity({
  templateId: 'sync-with-remote-repos',
  variables: {
    direction: 'push',
    branch: 'self-dev/wip',
    commitMessage: 'WIP: Backup before container development'
  },
  reason: 'Backup current state before risky changes'
})

# Then container can access changes
```

---

## Benefits

### 1. Zero Host Breakage

**Before:** Direct modification → Break host → Can't recover → Manual fix  
**After:** Container development → Validate → Incorporate → Host always works

### 2. Full Git History

**Before:** Experimental changes lost or uncommitted  
**After:** Every change in git history, can revert anytime

### 3. Parallel Development

**Before:** One thing at a time (afraid to break host)  
**After:** Multiple containers developing simultaneously

### 4. Fast Recovery

**Before:** Hours to recover from breakage  
**After:** <5 minutes (git reset or container restart)

### 5. Validation Harnesses

**Before:** Manual testing after changes  
**After:** Deterministic harnesses prevent regressions

---

## Metrics to Track

### Safety Metrics

- **Host breakages:** Should be 0
- **Recovery time:** Should be <5 minutes
- **Validation pass rate:** Should be >90%

### Usage Metrics

- **% self-development in containers:** Target 100%
- **Container validation rate:** All risky changes validated
- **Git sync frequency:** Every development session

### Performance Metrics

- **End-to-end time:** Host → Container → Validate → Incorporate
- **Container startup time:** How fast can we develop?
- **Validation time:** How long to validate changes?

---

## Next Steps

### Immediate (This Session)

1. ✅ Architecture documented
2. ⏳ Create `develop-with-devbob-container.json` template
3. ⏳ Create `sync-with-remote-repos.json` template
4. ⏳ Test basic workflow end-to-end

### Short-term (Next Week)

5. ⏳ Create `validate-changes-in-container.json` template
6. ⏳ Create `incorporate-validated-changes.json` template
7. ⏳ Add all 4 to bootstrap templates
8. ⏳ Document usage patterns

### Long-term (Next Month)

9. ⏳ Use for all self-development
10. ⏳ Collect metrics on usage
11. ⏳ Optimize based on learnings
12. ⏳ Multi-container parallel development

---

## Files Created

### Documentation (2 files)

1. **SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md** (20 KB)
   - Complete architecture with diagrams
   - Safety principles
   - ACP delegation pattern
   - Git synchronization strategy
   - Usage patterns
   - Recovery procedures

2. **SAFE_SELF_DEVELOPMENT_COMPLETE.md** (This file, 15 KB)
   - Implementation plan
   - Activity template specifications
   - Usage examples
   - Metrics and success criteria

### Code (To be created)

1. **templates/self-development/develop-with-devbob-container.json**
2. **templates/self-development/sync-with-remote-repos.json**
3. **templates/self-development/validate-changes-in-container.json**
4. **templates/self-development/incorporate-validated-changes.json**

---

## Success Criteria

**Safe self-development system is successful when:**

1. ✅ Architecture documented completely
2. ⏳ All 4 core activities created
3. ⏳ End-to-end workflow tested
4. ⏳ 100% of self-development uses safe workflow
5. ⏳ 0 host breakages from self-development
6. ⏳ Recovery time <5 minutes
7. ⏳ Added to bootstrap templates

**Vision:** OpenCode develops itself safely, never breaking the host, always validated, always recoverable.

---

**Status:** ✅ Architecture complete, ready for implementation  
**Next:** Create activity templates  
**Goal:** 100% safe self-development within 30 days
