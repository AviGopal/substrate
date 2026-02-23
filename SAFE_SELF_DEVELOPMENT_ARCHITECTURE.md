# Safe Self-Development Architecture

**Date:** 2026-02-22  
**Status:** ✅ Architectural Foundation  
**Principle:** **Always use activities. Develop ourselves safely in isolated containers.**

---

## Core Problem: Self-Development Safety

**Challenge:** We're developing OpenCode using OpenCode. If we break ourselves, we can't continue.

**Solution:** Develop in isolated devbob containers, validate there, then incorporate validated changes.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOST ENVIRONMENT                          │
│                   (metabob-devbob repository)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Activity: develop-with-devbob-container                │    │
│  │                                                          │    │
│  │  1. Sync code to remote (GitHub)                        │    │
│  │  2. Delegate to devbob-clean container (ACP)            │    │
│  │  3. Container: Pull code, run activities, validate      │    │
│  │  4. Container: Push validated changes to remote         │    │
│  │  5. Host: Pull validated changes from remote            │    │
│  │  6. Host: Verify changes work                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Tools Available:                                               │
│  • acp_delegate - Delegate to devbob-clean container           │
│  • git - Sync with remote (GitHub)                              │
│  • activity - Always use activities for everything              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ ACP (JSON-RPC)
                              ↕ Git (sync via remote)
┌─────────────────────────────────────────────────────────────────┐
│                    DEVBOB-CLEAN CONTAINER                        │
│                     (docker://devbob-clean)                      │
│                                                                  │
│  Workspace: /workspace (empty by default)                       │
│  OpenCode: Installed with activity system                       │
│  Metabob: Connected to backend                                  │
│  Git: Can clone, modify, push                                   │
│                                                                  │
│  Safety Features:                                               │
│  • Isolated environment (can't break host)                      │
│  • Fresh state (can restart container if broken)                │
│  • Activities run with validation                               │
│  • Changes pushed to remote before host pulls                   │
│                                                                  │
│  Activity Flow:                                                 │
│  1. Clone metabob-devbob repo                                   │
│  2. Checkout working branch                                     │
│  3. Invoke trace-enforce-validate-loop                          │
│  4. Run validation harness                                      │
│  5. If validated: push to remote                                │
│  6. Return success to host                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Git (GitHub)
┌─────────────────────────────────────────────────────────────────┐
│                         REMOTE REPOSITORY                        │
│                  (github.com/metabob-labs/metabob-devbob)       │
│                                                                  │
│  Branches:                                                      │
│  • main - Stable production code                                │
│  • self-dev/* - Safe self-development branches                  │
│                                                                  │
│  Role: Synchronization point between host and container         │
│  • Container pushes validated changes                           │
│  • Host pulls validated changes                                 │
│  • Git history preserves all changes                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Safety Principles

### 1. Never Modify Host Directly for Risky Changes

**Risky Changes:**
- Core activity system modifications
- Session management changes
- Activity execution engine changes
- Tool registration changes
- Bootstrap template modifications

**Safe Approach:**
```typescript
// DON'T: Modify host directly
edit({ filePath: "/home/avi/.../ActivityTool.ts", ... }) // RISKY!

// DO: Develop in container
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    specification: 'activity-timeout-handling',
    targetFiles: ['src/activity/ActivityTool.ts'],
    workingBranch: 'self-dev/activity-timeout'
  },
  reason: 'Safely develop activity timeout feature in isolated container'
})
```

### 2. Always Validate in Container Before Incorporating

**Validation Requirements:**
- All tests pass
- Activity execution succeeds
- No breaking changes to existing activities
- Validation harness created

**Validation Flow:**
```
Container: Run trace-enforce-validate-loop
         ↓
Container: Execute validation harness
         ↓
Container: All tests pass? → YES → Push to remote
                          → NO → Return error, don't push
         ↓
Host: Pull from remote (only if container validated)
```

### 3. Use Git Remote as Synchronization Point

**Why Remote?**
- Single source of truth
- Git history preserved
- Can review changes before incorporating
- Can revert if needed
- Branch-based isolation

**Branching Strategy:**
```
main - Stable production code
  ↳ self-dev/feature-name - Safe self-development
      ↳ Container makes changes here
      ↳ Host pulls from here after validation
      ↳ Merge to main when fully validated
```

### 4. Always Use Activities for Everything

**NO direct tool usage for development:**
```typescript
// WRONG: Direct tool usage
acp_delegate({ ... }) // Don't call directly
git push                // Don't call directly

// RIGHT: Activity composition
activity({
  templateId: 'develop-with-devbob-container',
  variables: { ... },
  reason: 'Develop feature safely in container'
})
```

---

## Core Activities for Safe Self-Development

### Activity 1: `develop-with-devbob-container`

**Purpose:** Safely develop OpenCode features in isolated devbob container

**Flow:**
```
1. Push current host state to remote (working branch)
2. Delegate to devbob-clean via ACP
3. Container: Clone repo, checkout branch
4. Container: Invoke trace-enforce-validate-loop
5. Container: Validate changes with harness
6. Container: If validated, push to remote
7. Host: Pull validated changes from remote
8. Host: Verify changes work on host
```

**Variables:**
- `specificationName` - What feature to develop
- `specificationDescription` - What the feature does
- `targetFiles` - Files to modify
- `workingBranch` - Branch name (e.g., self-dev/feature-name)
- `validateCommand` - Command to run for validation

**Outputs:**
- Validated changes incorporated to host
- All impulses from container execution
- Validation harness created
- Git history preserved

---

### Activity 2: `sync-with-remote-repos`

**Purpose:** Bidirectional sync between host and remote

**Flow:**
```
1. Check git status (uncommitted changes?)
2. Commit current state to working branch
3. Push to remote
4. Optionally: Pull from remote
5. Verify sync successful
```

**Variables:**
- `direction` - "push" | "pull" | "both"
- `branch` - Branch to sync
- `commitMessage` - Message for commit (if pushing)

**Outputs:**
- Sync status
- Commit SHA
- Any conflicts detected

---

### Activity 3: `validate-changes-in-container`

**Purpose:** Run validation harness in devbob-clean container

**Flow:**
```
1. Delegate to devbob-clean
2. Clone repo at specific commit
3. Run validation harness
4. Collect test results
5. Return pass/fail status
```

**Variables:**
- `commitSHA` - Specific commit to validate
- `validationHarness` - Path to harness file
- `testCommand` - Command to run tests

**Outputs:**
- Validation results (pass/fail)
- Test output
- Error logs (if failed)

---

### Activity 4: `incorporate-validated-changes`

**Purpose:** Pull validated changes from remote to host

**Flow:**
```
1. Verify remote has changes
2. Check validation status (was it validated in container?)
3. Pull changes from remote
4. Verify changes work on host
5. Create impulse documenting incorporation
```

**Variables:**
- `sourceBranch` - Branch to pull from (e.g., self-dev/feature-name)
- `validationProof` - Impulse ID proving validation passed

**Outputs:**
- Changes incorporated
- Host verification status
- Impulse documenting what changed

---

## Usage Patterns

### Pattern 1: Develop Core Feature Safely

**Scenario:** Add timeout handling to activity execution

```typescript
// Step 1: Develop in container
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    specificationName: 'activity-timeout-handling',
    specificationDescription: 'Activities must timeout after specified duration',
    targetFiles: ['src/activity/ActivityTool.ts', 'src/activity/ActivityExecutor.ts'],
    workingBranch: 'self-dev/activity-timeout',
    validateCommand: 'bun test src/activity/ActivityTool.test.ts'
  },
  reason: 'Safely develop activity timeout in isolated container'
})

// Outputs:
// - Container clones repo
// - Container runs trace-enforce-validate-loop
// - Container validates changes with harness
// - Container pushes to remote (self-dev/activity-timeout)
// - Host pulls validated changes
// - Host verifies changes work

// Step 2: If host verification passes, merge to main
activity({
  templateId: 'sync-with-remote-repos',
  variables: {
    direction: 'push',
    branch: 'main',
    commitMessage: 'Add activity timeout handling (validated in container)'
  },
  reason: 'Merge validated self-development changes to main'
})
```

---

### Pattern 2: Validate Existing Changes in Container

**Scenario:** Verify recent changes work in clean environment

```typescript
// Step 1: Push current state to remote
activity({
  templateId: 'sync-with-remote-repos',
  variables: {
    direction: 'push',
    branch: 'self-dev/test-validation',
    commitMessage: 'WIP: Testing changes in container'
  },
  reason: 'Push current state for container validation'
})

// Step 2: Validate in container
activity({
  templateId: 'validate-changes-in-container',
  variables: {
    commitSHA: 'HEAD', // Validate latest commit
    validationHarness: 'tests/validation-harnesses/activity-system-harness.ts',
    testCommand: 'bun test --coverage'
  },
  reason: 'Validate current changes in clean container environment'
})

// Step 3: If validation passes, incorporate
// (Already on host, just verify container agrees)
```

---

### Pattern 3: Recover from Broken Host

**Scenario:** Host OpenCode is broken, can't run activities

```bash
# Manual recovery steps:
# 1. Restart from last known good commit
git reset --hard <last-good-commit>

# 2. Use container to develop fix
docker exec -it devbob-clean /bin/bash
cd /workspace
git clone git@github.com:metabob-labs/metabob-devbob.git
cd metabob-devbob
# Manually run opencode with activity to fix issue
opencode activity develop-with-devbob-container ...

# 3. Pull validated fix to host
git pull origin self-dev/fix-branch
```

**Better: Preventive measures**
- Always validate risky changes in container FIRST
- Keep main branch stable
- Use self-dev/* branches for development
- Regular backups of known-good states

---

### Pattern 4: Multi-Container Development (Advanced)

**Scenario:** Develop frontend and backend simultaneously

```typescript
// Parallel development in multiple containers
const [backendResult, frontendResult] = await Promise.all([
  activity({
    templateId: 'develop-with-devbob-container',
    variables: {
      specificationName: 'backend-api-v2',
      containerTarget: 'docker://devbob-rpc-api', // Specific container
      workingBranch: 'self-dev/backend-api-v2'
    },
    reason: 'Develop backend API v2 in dedicated container'
  }),
  
  activity({
    templateId: 'develop-with-devbob-container',
    variables: {
      specificationName: 'frontend-dashboard-v2',
      containerTarget: 'docker://devbob-dashboard', // Different container
      workingBranch: 'self-dev/frontend-dashboard-v2'
    },
    reason: 'Develop frontend dashboard in dedicated container'
  })
])

// Both developed independently, validated in isolation
// Incorporate both to host after validation
```

---

## ACP Delegation Details

### How ACP Enables Safe Development

**ACP (Agent Client Protocol):**
- JSON-RPC protocol for agent-to-agent communication
- Connects host OpenCode to container OpenCode
- Stateless: Each delegation is independent
- Timeout-based: Activities have time limits
- Result-oriented: Returns final output

**Connection String:**
```typescript
target: "docker://devbob-clean"
       └─────┘  └───────────┘
         │            └─ Container name (docker ps)
         └─ Connection type (docker | ssh)
```

### ACP Delegation Flow

```
Host OpenCode
     │
     │ acp_delegate({
     │   target: "docker://devbob-clean",
     │   prompt: "Run activity: develop-feature-X",
     │   shareImpulses: ["design-spec"]
     │ })
     ↓
Docker Container (devbob-clean)
     │
     │ OpenCode starts new session
     │ Loads shared impulses
     │ Executes prompt (runs activity)
     │ Collects results
     ↓
Returns to Host
     │
     │ Response contains:
     │ • Agent's response text
     │ • Tools used
     │ • Impulses created
     │ • Metrics (cost, duration)
     ↓
Host processes results
```

### Impulse Sharing Across ACP

**Why share impulses?**
- Container needs context from host
- Design decisions, specifications, requirements
- Avoid re-explaining context

**How to share:**
```typescript
// Step 1: Create impulse on host
impulse_create({
  id: 'feature-spec-auth',
  type: 'memo',
  pointer: {
    type: 'memo',
    content: 'Authentication requirements: JWT tokens, 1hr expiry, bcrypt hashing'
  },
  budget: 2000
})

// Step 2: Share impulse with container
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    specificationName: 'authentication',
    shareImpulses: ['feature-spec-auth'] // Container receives this impulse
  },
  reason: 'Develop auth with shared specification'
})

// Step 3: Container accesses impulse
// Inside container, impulse_load({ id: 'feature-spec-auth' }) works
```

---

## Git Synchronization Strategy

### Branch Structure

```
main
  ├─ Stable production code
  ├─ All tests passing
  └─ Never commit directly (use self-dev/* branches)

self-dev/feature-name
  ├─ Development branch for specific feature
  ├─ Container pushes here after validation
  ├─ Host pulls from here
  └─ Merge to main when fully tested

self-dev/experiment-name
  ├─ Experimental changes
  ├─ May not work
  └─ Don't merge to main until validated
```

### Commit Strategy

**In Container:**
```bash
# Container commits with validation proof
git commit -m "Add feature X

Validated in container:
- All tests passing
- Harness: tests/validation-harnesses/feature-x-harness.ts
- Validation results: validation-results-feature-x (impulse)
- Activity execution: act_xyz123"
```

**On Host:**
```bash
# Host incorporates with verification
git pull origin self-dev/feature-name

# Verify on host
bun test

# If verified, merge to main
git checkout main
git merge self-dev/feature-name --no-ff
git push origin main
```

### Remote as Source of Truth

**Why remote?**
1. **Persistence** - Changes survive container restarts
2. **History** - Full git log of all changes
3. **Collaboration** - Multiple containers can sync
4. **Rollback** - Easy to revert to any commit
5. **Review** - Can review changes before incorporating

**Synchronization Pattern:**
```
Host ─(push)→ Remote ←(pull)─ Container
                 │
                 └─ Single source of truth
                 └─ Git history preserved
                 └─ Branch-based isolation
```

---

## Recovery Mechanisms

### Scenario 1: Host OpenCode Broken

**Symptoms:**
- Activities fail to execute
- Tools not loading
- Session crashes

**Recovery:**
```bash
# 1. Reset to last known good commit
git log --oneline -20  # Find last good commit
git reset --hard <commit-sha>

# 2. Restart OpenCode
# Should work now if code was the issue

# 3. If still broken, use container to fix
docker exec -it devbob-clean /bin/bash
cd /workspace
git clone git@github.com:metabob-labs/metabob-devbob.git
cd metabob-devbob
# Develop fix using container's OpenCode
opencode activity develop-with-devbob-container ...

# 4. Pull fix to host
git pull origin self-dev/fix-broken-host
```

---

### Scenario 2: Container OpenCode Broken

**Symptoms:**
- ACP delegation fails
- Container activities fail
- Container won't start

**Recovery:**
```bash
# 1. Restart container (fresh state)
docker-compose --profile devbob down
docker-compose --profile stable --profile devbob up -d

# 2. Container now has clean state
# Can develop fix on host, then test in container

# 3. Or use different container
# devbob-rpc-api, devbob-cli, etc.
```

---

### Scenario 3: Both Host and Container Broken

**Symptoms:**
- Can't run activities anywhere
- Complete system failure

**Recovery:**
```bash
# 1. Fresh clone from GitHub (last known good)
cd /tmp
git clone git@github.com:metabob-labs/metabob-devbob.git metabob-devbob-recovery
cd metabob-devbob-recovery
git checkout main  # Or last known good branch

# 2. Start fresh containers
docker-compose --profile devbob down -v  # Remove volumes
docker-compose --profile stable --profile devbob up -d

# 3. Develop fix in fresh environment
# Use trace-enforce-validate-loop to add recovery features

# 4. Push fix to remote
git push origin self-dev/recovery-fix

# 5. Pull to broken host
cd /home/avi/documents/work/exp-repo/metabob-devbob
git pull origin self-dev/recovery-fix
```

---

### Scenario 4: Lost Work (No Remote Sync)

**Symptoms:**
- Made changes on host
- Forgot to push to remote
- Container can't access changes

**Prevention:**
```typescript
// ALWAYS push before container development
activity({
  templateId: 'sync-with-remote-repos',
  variables: {
    direction: 'push',
    branch: 'self-dev/current-work',
    commitMessage: 'WIP: Current state before container development'
  },
  reason: 'Backup current state to remote before risky changes'
})

// THEN develop in container
activity({
  templateId: 'develop-with-devbob-container',
  variables: { ... },
  reason: 'Safely develop in container'
})
```

---

## Activity Templates to Create

### 1. `develop-with-devbob-container.json`

**Core self-development activity**

**Tasks:**
1. Sync current state to remote (push)
2. Delegate to devbob-clean via ACP
3. Container: Clone repo, checkout branch
4. Container: Run trace-enforce-validate-loop
5. Container: Validate with harness
6. Container: Push validated changes
7. Host: Pull validated changes
8. Host: Verify changes work

**Variables:**
- specificationName, specificationDescription, expectedBehavior, validationStrategy
- targetFiles, workingBranch, containerTarget
- shareImpulses (optional)

---

### 2. `sync-with-remote-repos.json`

**Git synchronization activity**

**Tasks:**
1. Check git status
2. Commit if needed
3. Push to remote (if direction=push/both)
4. Pull from remote (if direction=pull/both)
5. Verify sync
6. Create sync impulse

**Variables:**
- direction, branch, commitMessage
- remote (default: origin)

---

### 3. `validate-changes-in-container.json`

**Validation activity**

**Tasks:**
1. Delegate to container
2. Clone repo at specific commit
3. Run validation harness
4. Collect results
5. Return pass/fail

**Variables:**
- commitSHA, validationHarness, testCommand
- containerTarget (default: docker://devbob-clean)

---

### 4. `incorporate-validated-changes.json`

**Incorporation activity**

**Tasks:**
1. Verify remote has changes
2. Check validation proof
3. Pull changes
4. Verify on host
5. Document incorporation

**Variables:**
- sourceBranch, validationProof
- verifyCommand (default: bun test)

---

## Implementation Checklist

### Immediate (Next Session)

- [ ] Create `develop-with-devbob-container` activity template
- [ ] Create `sync-with-remote-repos` activity template
- [ ] Test basic flow: host → remote → container → remote → host
- [ ] Verify ACP delegation to devbob-clean works
- [ ] Create example: develop simple feature in container

### Short-Term (Next Week)

- [ ] Create `validate-changes-in-container` activity template
- [ ] Create `incorporate-validated-changes` activity template
- [ ] Add to bootstrap templates (safe self-development is core)
- [ ] Document recovery procedures
- [ ] Test recovery from broken host

### Long-Term (Next Month)

- [ ] Multi-container parallel development
- [ ] Automated validation before merge
- [ ] Container-based CI/CD pipeline
- [ ] Genealogy tracking for self-development
- [ ] Metrics on self-development patterns

---

## Success Criteria

**Safe Self-Development Achieved When:**

1. ✅ All risky changes developed in container first
2. ✅ Validation harnesses created for all features
3. ✅ Git remote used as sync point
4. ✅ Host never broken by self-development
5. ✅ Recovery mechanisms tested and working
6. ✅ Activities exist for all self-development workflows

**Metrics:**
- 0 host breakages from self-development
- 100% of core changes validated in container first
- <5 minutes to recover from any failure
- All changes have git history

---

## Conclusion

**Safe self-development = isolated containers + validation + git sync + activities**

**Core Principles:**
1. ✅ **Always use activities** - Never direct tool usage
2. ✅ **Develop in containers** - Isolate risky changes
3. ✅ **Validate before incorporating** - Harnesses prevent breakage
4. ✅ **Sync via remote** - Git is source of truth
5. ✅ **Recovery mechanisms** - Can always recover

**What This Enables:**
- Self-development without risk of breaking host
- Validation before incorporation
- Full git history of all changes
- Fast recovery from any failure
- Parallel development in multiple containers

**Next Steps:**
1. Create core activities (develop-with-devbob-container, sync-with-remote-repos)
2. Test basic flow end-to-end
3. Document usage patterns
4. Add to bootstrap templates
5. Use for all self-development going forward

---

**Status:** ✅ Architecture complete  
**Next:** Create activity templates  
**Goal:** 100% of self-development uses safe container workflow
