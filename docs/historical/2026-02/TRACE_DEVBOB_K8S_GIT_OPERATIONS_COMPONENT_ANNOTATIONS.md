# DevBob K8s Git Operations - Component Annotations

## Overview

This document annotates the key components in the devbob-k8s-git-operations data flow, explaining WHY each component exists, what business logic it enforces, and what design decisions were made.

**Feature:** `devbob-k8s-git-operations`  
**Purpose:** Enable autonomous vessel repository management with git operations (branch, commit, push, PR)  
**Current State:** Infrastructure deployed, GITHUB_TOKEN placeholder blocking PR operations  
**Desired State:** Full autonomous git workflow with PR creation

---

## Critical Components (Annotated)

### Component 1: Entry Point - Container Bootstrap Script

**File:** `repos/metabob-opencode/docker/entrypoint-self-config.sh`  
**Component:** `main script (lines 1-229)`  
**Type:** Infrastructure / Bootstrap  
**Stage:** Entry point - Container initialization

#### Why This Component Exists

This component handles the critical bootstrap phase when a devbob container starts in Kubernetes. It must:
1. Validate the deployment environment (development, staging, production)
2. Configure git and GitHub CLI with credentials from K8s secrets
3. Verify backend connectivity before starting services
4. Enable autonomous git workflows by setting up authentication

**Business Context:**
In a distributed devbob deployment, each pod must be self-sufficient and ready to perform git operations autonomously. This script transforms a generic container into a functional devbob vessel with git capabilities.

#### Data Transformation

```
Input:  K8s Environment Variables
  - GITHUB_TOKEN (from secret)
  - GIT_USER_NAME (from secret)
  - GIT_USER_EMAIL (from secret)
  - ANTHROPIC_API_KEY (from secret)
  - METABOB_API_URL (from config)

Output: Configured System
  - ~/.gitconfig (user.name, user.email, defaults)
  - ~/.config/gh/hosts.yml (GitHub CLI auth)
  - Running OpenCode server
```

#### Business Logic Enforced

1. **Authentication Hierarchy:**
   - ANTHROPIC_API_KEY required (fail fast if missing) - Line 111-117
   - GITHUB_TOKEN optional (warn if missing) - Line 146-167
   - Git user config has fallback defaults - Line 131-132

2. **Environment Detection:**
   - Auto-detect environment from hostname pattern - Line 48-59
   - Affects configuration strategy and logging

3. **Graceful Degradation:**
   - Backend unreachable → continue without Metabob features - Line 98-101
   - gh not installed → warn but continue - Line 160-163
   - gh auth fails → warn but continue - Line 155-159

#### Design Decisions

**Decision 1: Silent Failure with `|| true` (Line 134-137, 152)**
```bash
git config --global user.name "${GIT_USER_NAME}" 2>/dev/null || true
echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token" || true
```

**Why:**
- Ensures container always starts (availability over correctness)
- Prevents deployment failures due to missing optional features
- Allows partial functionality (git commits work, PRs don't)

**Trade-off:**
- ✅ High availability (container never fails to start)
- ❌ Confusing errors at runtime (PR fails with 401, not startup error)
- ❌ Difficult to diagnose (no clear indication of misconfiguration)

**Better Approach (Not Implemented):**
```bash
# Validate token format, set flag if invalid
if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
    log_warn "Invalid GITHUB_TOKEN format"
    export GH_AUTH_DISABLED=true  # Runtime check
fi
```

**Decision 2: Python for HTTP Health Checks (Line 77-84)**
```bash
python3 <<EOF > /dev/null 2>&1
import urllib.request
urllib.request.urlopen('$METABOB_API_URL/', timeout=5)
EOF
```

**Why:**
- curl not available in minimal container image
- Python3 already installed (used by OpenCode)
- Simple HTTP check without external dependencies

**Trade-off:**
- ✅ No additional dependencies
- ⚠️ Subprocess overhead for each check
- ⚠️ Limited HTTP capabilities (no retries, no auth)

**Decision 3: 30 Retry Attempts with 2-Second Delay (Line 71-96)**

**Why:**
- Metabob backend may take 30-60 seconds to start
- StatefulSet pods may start before backend service ready
- Total wait time: 60 seconds (30 × 2s)

**Trade-off:**
- ✅ Handles slow backend startup
- ❌ Pod appears "not ready" for 60 seconds
- ❌ No exponential backoff (constant 2s delay)

#### Constraints and Edge Cases

**Constraint 1: GitHub Token Persistence**
- `~/.config/gh/hosts.yml` stored in container filesystem (ephemeral)
- Pod restart loses authentication
- Must re-authenticate on every restart

**Workaround Needed:**
```yaml
# k8s-devbob-statefulset.yaml
volumeMounts:
- name: devbob-storage
  mountPath: /root/.config/gh
  subPath: gh-config  # Persist gh auth
```

**Constraint 2: Git Safe Directory**
- Volume-mounted repos may trigger git ownership warnings
- Line 143: `git config --global --add safe.directory /workspace`
- Required for K8s volume mounts

**Edge Case 1: Empty GITHUB_TOKEN**
- Line 146: `if [ -n "$GITHUB_TOKEN" ]`
- Empty string → skips gh auth (safe)
- String "none" → attempts auth (fails silently)

**Edge Case 2: Backend Never Becomes Ready**
- Line 98-101: Continues without backend
- Activity execution disabled
- Git operations still work

#### Current vs Desired State

**Current State (DEPLOYED):**
- ✅ Script runs successfully on container start
- ✅ Git configured (user.name, user.email)
- ✅ Environment variables injected
- ❌ gh auth fails (GITHUB_TOKEN = "none")
- ❌ No indication of auth failure (|| true suppresses)

**Desired State (FIXED):**
- ✅ Script validates token format
- ✅ Fails with clear error if token invalid
- ✅ Sets GH_AUTH_DISABLED flag for runtime checks
- ✅ Health check reflects auth status

**Gap:**
1. No token validation (accepts "none")
2. Silent failure (|| true)
3. No runtime detection of auth failure

---

### Component 2: Main Transformation - ActivityGit.createPR()

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts`  
**Component:** `createPR function (lines 184-221)`  
**Type:** Business Logic / Integration Point  
**Stage:** Exit point - GitHub API integration

#### Why This Component Exists

This component is the culmination of the entire git operations flow. It:
1. Publishes local commits to remote repository
2. Creates GitHub Pull Request for code review
3. Closes the loop: autonomous code changes → human review → merge
4. Enables distributed devbob vessels to collaborate via GitHub

**Business Context:**
In autonomous software development, vessels must not only write code but also integrate with human workflows. PRs are the bridge between AI-generated changes and human oversight, enabling trust and accountability.

#### Data Transformation

```
Input:  PROptions
  {
    title: string        // "feat: Add user authentication"
    body: string         // Markdown PR description with activity context
    base?: string        // Target branch (defaults to "main")
  }

Transformation Steps:
  1. Get current branch name: git branch --show-current
  2. Get base branch: git symbolic-ref refs/remotes/origin/HEAD
  3. Push branch: git push -u origin ${branch}
  4. Check gh CLI: gh --version
  5. Create PR: gh pr create --title --body --base
  6. Parse URL: result.trim()

Output: PR URL
  "https://github.com/owner/repo/pull/123"
```

#### Business Logic Enforced

**Logic 1: Base Branch Resolution**
```typescript
const base = opts.base || await getDefaultBranch()
```

**Why:**
- Allows activities to target non-main branches (feature branches, release branches)
- Defaults to main for standard workflow
- Respects repository configuration (may be "main", "master", "develop")

**Logic 2: Push Before PR**
```typescript
await $`git push -u origin ${branch}`.cwd(Instance.directory).quiet()
// THEN
await $`gh pr create ...`
```

**Why:**
- GitHub requires branch to exist on remote before PR
- `-u` sets up tracking relationship for future pushes
- Fails fast if push fails (network, credentials, branch conflict)

**Logic 3: Single Responsibility**
- Only handles PR creation
- Assumes branch created (by createBranch)
- Assumes commits exist (by commitPromptChanges)
- Clear separation of concerns

#### Design Decisions

**Decision 1: Use gh CLI Instead of Octokit**

**Why:**
- gh CLI handles authentication automatically (uses ~/.config/gh)
- No need to manage API tokens in code
- Consistent with user's local workflow
- Simpler error handling

**Alternative Considered:**
```typescript
// Using Octokit REST API
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
await octokit.rest.pulls.create({
  owner, repo, head: branch, base, title, body
})
```

**Trade-off:**
- ✅ Simpler code (gh CLI one-liner)
- ✅ No token management in code
- ❌ Tight coupling to gh CLI (system dependency)
- ❌ Harder to mock for testing

**Decision 2: .quiet() Suppresses Output**
```typescript
await $`git push -u origin ${branch}`.cwd(Instance.directory).quiet()
```

**Why:**
- Cleaner log output (no git progress bars)
- stderr still captured on failure
- Consistent with other git operations

**Trade-off:**
- ✅ Clean logs
- ❌ Lost diagnostic information
- ❌ Progress bars not visible (long pushes appear frozen)

**Decision 3: No Authentication Pre-Check**
```typescript
const hasGh = await checkGhCLI()  // Only checks if installed
if (!hasGh) throw new Error("gh CLI not installed")
// No check for: gh auth status
```

**Why (Inferred):**
- Assumed gh auth will be set up by entrypoint
- Assumed if gh installed, it's authenticated
- Fail fast at runtime if auth missing

**Problem:**
- **This is the root cause of the current blocker**
- Auth fails in entrypoint (|| true suppresses)
- No check here, so error discovered too late
- Generic 401 error without context

**Fix Needed:**
```typescript
async function checkGhAuthenticated(): Promise<boolean> {
  try {
    await $`gh auth status`.quiet()
    return true
  } catch {
    return false
  }
}

export async function createPR(opts: PROptions): Promise<string> {
  // ... existing code ...
  
  if (!await checkGhAuthenticated()) {
    throw ActivityGitError.notAuthenticated(
      "gh CLI not authenticated. Run: gh auth login or set GITHUB_TOKEN"
    )
  }
  
  // ... rest of function ...
}
```

#### Constraints and Edge Cases

**Constraint 1: Branch Must Not Exist on Remote**
- If branch exists on remote, push fails
- No automatic force push (safety)
- User must manually delete remote branch or use different name

**Constraint 2: PR Title and Body Length**
- GitHub limits:
  - Title: 256 characters
  - Body: 65,536 characters
- No validation in code
- Fails at GitHub API with 422 Unprocessable Entity

**Constraint 3: Network Connectivity**
- git push requires network access
- gh pr create requires GitHub API access
- No retry logic (transient failures cause permanent failure)

**Edge Case 1: Empty PR Body**
```typescript
await $`gh pr create --title ${opts.title} --body ${opts.body}`
// If body is empty string, gh CLI handles gracefully
```

**Edge Case 2: Special Characters in Title**
```typescript
// Title with quotes: 'feat: Add "quotes" support'
// Bun's $ template escapes properly
// No manual escaping needed
```

**Edge Case 3: Branch Name with Special Characters**
```typescript
// Branch: "feature/add-quotes"
// Works: git push -u origin feature/add-quotes
// No escaping issues
```

#### Current vs Desired State

**Current State (DEPLOYED):**
- ✅ Function implemented correctly
- ✅ Branch push works
- ✅ gh CLI installed
- ❌ gh not authenticated (GITHUB_TOKEN = "none")
- ❌ No pre-flight auth check
- ❌ PR creation fails with HTTP 401

**Desired State (FIXED):**
- ✅ Pre-flight auth check added
- ✅ Descriptive error if not authenticated
- ✅ Retry logic for transient failures
- ✅ PR creation succeeds

**Gap:**
1. Missing `checkGhAuthenticated()` call
2. No retry logic for network failures
3. No validation of PR title/body length

---

### Component 3: Orchestration - PromptsRunner.executeActivity()

**File:** `repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts`  
**Component:** `executeActivity function (lines 150-300)`  
**Type:** Business Logic / Orchestration  
**Stage:** Main transformation - Prompt execution and commit creation

#### Why This Component Exists

This component is the heart of the activity execution lifecycle. It:
1. Executes prompts in sequence (dependency-aware)
2. Generates commits for each prompt's changes
3. Tracks activity state (prompts completed, tokens used, cost)
4. Enforces business rules (rollback on failure, skip if no changes)

**Business Context:**
Activities are multi-step workflows. Each prompt may produce changes that should be captured in a separate commit for:
- Granular history (easy to understand, revert, or cherry-pick)
- Atomic commits (one logical change per commit)
- Conventional commits (semantic versioning, changelog generation)

#### Data Transformation

```
Input:  Activity.Info (initialized)
  {
    id: "act_123",
    prompts: PromptFile[],  // ["01-add-schema.md", "02-add-auth.md"]
    commits: [],             // Empty (no commits yet)
    status: "active"
  }

Transformation Loop (for each prompt):
  1. Run OpenCode session with prompt content
  2. Generate commit message from prompt filename
  3. Stage and commit changes (via ActivityGit.commitPromptChanges)
  4. Update activity state:
     - activity.commits.push(commitInfo)
     - activity.prompts[i].status = "committed"
  5. Save activity to storage

Output: Activity.Info (with commits)
  {
    id: "act_123",
    prompts: [...],
    commits: [                // Populated
      { sha: "a1b2c3...", filesChanged: [...], timestamp: "..." },
      { sha: "d4e5f6...", filesChanged: [...], timestamp: "..." }
    ],
    status: "active"          // Still active (not completed yet)
  }
```

#### Business Logic Enforced

**Logic 1: Sequential Execution (Dependency Order)**
```typescript
for (const prompt of activity.prompts) {
  // Execute prompts in order
  await runPrompt(prompt)
  await commitChanges(prompt)
}
```

**Why:**
- Later prompts may depend on earlier prompts' changes
- Example: "01-add-schema.md" → "02-add-validation.md" (depends on schema)
- Ensures deterministic execution

**Logic 2: Skip Commit if No Changes**
```typescript
const commitInfo = await ActivityGit.commitPromptChanges(...)
if (commitInfo === null) {
  log.info("no changes to commit", { promptFile })
  continue  // Skip to next prompt
}
```

**Why:**
- Prompt may not produce changes (e.g., analysis-only prompt)
- Avoids empty commits in git history
- Maintains clean git log

**Logic 3: Update State After Each Prompt**
```typescript
activity.commits.push(commitInfo)
activity.prompts[i].status = "committed"
await Activity.save(activity)
```

**Why:**
- Enables resume on failure (can skip completed prompts)
- Provides progress visibility (dashboard shows status)
- Audit trail (when each prompt completed)

**Logic 4: Rollback on Failure**
```typescript
try {
  await runPrompt(prompt)
  await commitChanges(prompt)
} catch (error) {
  activity.status = "failed"
  await Activity.save(activity)
  throw error  // Propagate to caller
}
```

**Why:**
- Marks activity as failed (visible in dashboard)
- Preserves partial progress (commits already made remain)
- Allows manual intervention (user can fix and resume)

#### Design Decisions

**Decision 1: Commit Per Prompt (Not Per Change)**

**Why:**
- Prompts represent logical units of work
- Each prompt has clear scope and description
- Commit messages generated from prompt filename
- Easy to understand git history

**Alternative Considered:**
```typescript
// Commit after all prompts complete
for (const prompt of activity.prompts) {
  await runPrompt(prompt)
}
await commitAllChanges()  // Single commit
```

**Trade-off:**
- ✅ Granular history (easy to revert individual prompts)
- ✅ Clear attribution (each commit linked to prompt)
- ❌ More commits in git log
- ❌ More complex to undo (must revert multiple commits)

**Decision 2: Save Activity After Each Prompt**
```typescript
await Activity.save(activity)
```

**Why:**
- Enables resume on crash (progress persisted)
- Real-time progress updates (dashboard polling)
- Audit trail (timestamps for each step)

**Trade-off:**
- ✅ Resilient to crashes
- ✅ Real-time visibility
- ❌ Frequent I/O (slow on network filesystems)
- ❌ Concurrency issues (if multiple processes access same activity)

**Decision 3: Continue on Commit Failure**
```typescript
const commitInfo = await ActivityGit.commitPromptChanges(...)
if (commitInfo === null) {
  continue  // Not an error, just no changes
}
```

**Why:**
- Some prompts intentionally don't produce changes (e.g., planning)
- Returning null is not an error, it's a valid outcome
- Allows flexible prompt workflows

#### Constraints and Edge Cases

**Constraint 1: Prompts Must Be Ordered**
- Prompt filenames start with number: "01-", "02-", "03-"
- Sorted lexicographically: `prompts.sort()`
- User must follow naming convention

**Constraint 2: Working Tree Must Be Clean**
- ActivityGit.commitPromptChanges stages ALL changes: `git add .`
- If user has uncommitted files, they get included in commit
- Checked in setupActivity(), but not enforced between prompts

**Constraint 3: Single Activity Per Branch**
- Branch name collision prevents parallel activities
- If two activities generate same branch name, second fails
- Mitigated by timestamp in branch name: "activity-add-auth-abc123"

**Edge Case 1: Prompt Deletes All Files**
```typescript
// Prompt: "Remove all files"
// Result: git add . stages deletions
// Commit succeeds with negative diff
```

**Edge Case 2: Prompt Renames Files**
```typescript
// git add . stages both deletion and addition
// Commit correctly captures rename
```

**Edge Case 3: Very Long Prompt Execution**
```typescript
// Prompt takes 10 minutes (complex refactoring)
// No timeout enforced
// Activity appears "hung" in dashboard
```

#### Current vs Desired State

**Current State (DEPLOYED):**
- ✅ Prompt execution works correctly
- ✅ Commits created for each prompt
- ✅ Activity state tracked
- ✅ Resume on failure works
- ✅ Clean git history

**Desired State (NO CHANGES NEEDED):**
- ✅ Component functioning as designed
- ⚠️ Could add progress callbacks for long prompts
- ⚠️ Could add timeout for prompt execution

**Gap:**
- None (component working correctly)

---

### Component 4: Completion Handler - PromptsRunner.completeActivity()

**File:** `repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts`  
**Component:** `completeActivity function (lines 300-380)`  
**Type:** Exit Point / Integration  
**Stage:** Final transformation - PR creation and activity finalization

#### Why This Component Exists

This component closes the activity lifecycle by:
1. Creating a Pull Request for human review
2. Marking activity as "completed"
3. Triggering post-completion workflows (annotations, pattern learning)
4. Providing feedback to the orchestrating system

**Business Context:**
The transition from "code written" to "code reviewed" is critical in autonomous development. This component bridges AI-generated changes with human oversight, ensuring quality and accountability.

#### Data Transformation

```
Input:  Activity.Info (with commits)
  {
    id: "act_123",
    commits: [
      { sha: "a1b2c3...", filesChanged: [...], ... },
      { sha: "d4e5f6...", filesChanged: [...], ... }
    ],
    status: "active",
    stats: {
      prURL: null  // Not yet created
    }
  }

Transformation Steps:
  1. Generate PR title from activity title
  2. Generate PR body from activity stats
  3. Create PR (via ActivityGit.createPR)
  4. Update activity.stats.prURL
  5. Mark activity.status = "completed"
  6. Save activity
  7. Run ActivityComplete workflow (annotations)

Output: Activity.Info (completed)
  {
    id: "act_123",
    commits: [...],
    status: "completed",      // Changed
    stats: {
      prURL: "https://github.com/owner/repo/pull/123"  // Populated
    }
  }
```

#### Business Logic Enforced

**Logic 1: PR Creation is Optional (--no-pr flag)**
```typescript
if (!options.noPR) {
  await ActivityGit.createPR({ title, body })
}
// Activity still marked as completed even if PR skipped
```

**Why:**
- Some workflows don't need PRs (e.g., hotfixes, direct pushes)
- User may want to manually create PR with custom settings
- Allows flexibility in deployment strategies

**Logic 2: PR Failure Doesn't Fail Activity**
```typescript
try {
  const prURL = await ActivityGit.createPR(...)
} catch (error) {
  UI.println(`✗ PR creation failed: ${msg}`)
  // Don't throw - activity still completed
}
```

**Why:**
- Activity's primary goal is code changes (commits)
- PR is a secondary step (can be done manually)
- Prevents losing work due to transient GitHub issues

**Trade-off:**
- ✅ Resilient (commits preserved even if PR fails)
- ❌ User must manually create PR (extra work)
- ❌ Inconsistent state (commits on branch, no PR tracking)

**Logic 3: Activity Marked Complete Even If PR Fails**
```typescript
activity.status = "completed"
await Activity.save(activity)
// PR failure logged but doesn't change status
```

**Why:**
- Activity's definition of "complete" is: all prompts executed, all commits created
- PR is an integration step, not part of activity execution
- Enables retry of just PR creation (without re-running activity)

#### Design Decisions

**Decision 1: Generate PR Body from Activity Stats**
```typescript
const prBody = generatePRBody(activity)
// Includes: commits, files changed, tokens used, cost, Metabob issues
```

**Why:**
- Provides context for reviewers (what changed, why, how much cost)
- Links PR to activity system (activity ID for traceability)
- Includes metrics for budget tracking

**Alternative Considered:**
```typescript
// Simple PR body
const prBody = `Automated PR from activity ${activity.id}`
```

**Trade-off:**
- ✅ Rich context (reviewers see full picture)
- ✅ Traceability (activity ID links to system)
- ❌ Verbose PR body (may exceed GitHub limit for large activities)
- ❌ No customization (user can't edit before creation)

**Decision 2: Run ActivityComplete After PR Creation**
```typescript
await ActivityComplete.run(activity)
// Generates annotations, learns patterns, etc.
```

**Why:**
- Post-processing should happen after activity fully complete
- Annotations reference PR URL (need PR created first)
- Separates execution logic from learning logic

**Trade-off:**
- ✅ Clean separation of concerns
- ✅ Can disable post-processing independently
- ❌ Post-processing failures not visible to user
- ❌ No feedback if annotations fail

**Decision 3: UI Feedback for Each Step**
```typescript
UI.println(`│  ├─ Creating pull request...`)
UI.println(`│  ├─ ✓ PR created: ${prURL}`)
// OR
UI.println(`│  ├─ ✗ PR creation failed: ${msg}`)
```

**Why:**
- Real-time progress feedback (user sees what's happening)
- Clear success/failure indication
- Matches tree-style output of activity execution

#### Constraints and Edge Cases

**Constraint 1: PR Can Only Be Created Once**
- If completeActivity() called twice, second call fails (PR already exists)
- gh pr create fails with "pull request already exists"
- No idempotency check

**Constraint 2: Branch Must Be Pushed**
- ActivityGit.createPR pushes branch as first step
- If git push fails, PR creation aborted
- No automatic retry

**Constraint 3: Activity Must Have Commits**
- If no commits created (all prompts skipped), branch has no changes
- PR created would be empty (GitHub allows this, but not useful)
- No validation to prevent empty PRs

**Edge Case 1: PR Title Too Long**
```typescript
const prTitle = activity.title  // May exceed 256 chars
// No truncation
// GitHub API fails with 422
```

**Edge Case 2: PR Body Too Long**
```typescript
const prBody = generatePRBody(activity)  // May exceed 65KB
// No truncation
// GitHub API fails with 422
```

**Edge Case 3: Network Failure After Push**
```typescript
await $`git push -u origin ${branch}`  // ✓ Succeeds
await $`gh pr create ...`              // ✗ Fails (network)
// Branch orphaned on remote (no PR tracking it)
```

#### Current vs Desired State

**Current State (DEPLOYED):**
- ✅ PR body generation works
- ✅ Activity marked completed
- ✅ Error handling for PR failures
- ❌ **PR creation blocked** (gh not authenticated)
- ❌ No pre-flight auth check

**Desired State (FIXED):**
- ✅ Pre-flight auth check in ActivityGit.createPR
- ✅ Clear error message if auth missing
- ✅ PR creation succeeds
- ⚠️ Add PR body length validation (future)

**Gap:**
1. Missing auth check (fixed in ActivityGit.createPR)
2. No PR body length validation
3. No retry logic for transient failures

---

### Component 5: Configuration Bootstrap - Git Config in Entrypoint

**File:** `repos/metabob-opencode/docker/entrypoint-self-config.sh`  
**Component:** `Git Configuration (lines 128-173)`  
**Type:** Infrastructure / Configuration  
**Stage:** Early transformation - System configuration

#### Why This Component Exists

This component transforms environment variables (K8s secrets) into git configuration that persists for the container's lifetime. It:
1. Sets git user identity for commit attribution
2. Configures git defaults for smooth workflow
3. Authenticates GitHub CLI for PR operations
4. Provides fallback defaults if secrets not provided

**Business Context:**
Git requires user.name and user.email for every commit. In a multi-vessel deployment, each vessel needs a unique identity for audit trails. GitHub CLI requires authentication for PR operations. This component ensures every vessel is ready to participate in git workflows.

#### Data Transformation

```
Input:  Environment Variables
  GIT_USER_NAME="Devbob Agent"
  GIT_USER_EMAIL="devbob@metabob.local"
  GITHUB_TOKEN="none"  ← Current blocker

Transformation:
  1. Apply fallback defaults:
     GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent ($HOSTNAME)}"
  2. Set git global config:
     git config --global user.name "${GIT_USER_NAME}"
     git config --global user.email "${GIT_USER_EMAIL}"
  3. Set git workflow defaults:
     git config --global init.defaultBranch main
     git config --global push.autoSetupRemote true
  4. Configure safe directories:
     git config --global --add safe.directory /workspace
  5. Authenticate gh CLI:
     echo "$GITHUB_TOKEN" | gh auth login --with-token

Output:  System Configuration
  ~/.gitconfig:
    [user]
        name = Devbob Agent (devbob-0)
        email = devbob@metabob.local
    [init]
        defaultBranch = main
    [push]
        autoSetupRemote = true
    [safe]
        directory = /workspace
  
  ~/.config/gh/hosts.yml:
    github.com:
        user: devbob-agent
        oauth_token: ghp_XXX  ← FAILS with token="none"
        git_protocol: https
```

#### Business Logic Enforced

**Logic 1: Fallback Defaults (Lines 131-132)**
```bash
GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent ($HOSTNAME)}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-devbob@metabob.local}"
```

**Why:**
- Ensures git always has user identity (required for commits)
- Includes hostname for multi-vessel identification
- Prevents generic "Devbob Agent" (can't distinguish vessels)

**Example:**
```
devbob-0: "Devbob Agent (devbob-0)"
devbob-1: "Devbob Agent (devbob-1)"
devbob-2: "Devbob Agent (devbob-2)"
```

**Logic 2: Workflow Defaults (Lines 136-137)**
```bash
git config --global init.defaultBranch main
git config --global push.autoSetupRemote true
```

**Why:**
- `init.defaultBranch main`: Modern default (not "master")
- `push.autoSetupRemote true`: Simplifies first push (no `-u` needed)
- Consistent with modern git best practices

**Logic 3: Safe Directory Configuration (Line 143)**
```bash
git config --global --add safe.directory /workspace
```

**Why:**
- K8s volume mounts may have different ownership
- Git refuses to operate in "unsafe" directories
- Required for volume-mounted repositories

**Logic 4: Conditional gh Authentication (Lines 146-167)**
```bash
if [ -n "$GITHUB_TOKEN" ]; then
    # Only authenticate if token provided
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token" || true
fi
```

**Why:**
- GitHub operations optional (git commits work without gh)
- Allows containers without GitHub access to still function
- Graceful degradation (warn but continue)

#### Design Decisions

**Decision 1: || true on All Git Config Commands**
```bash
git config --global user.name "${GIT_USER_NAME}" 2>/dev/null || true
```

**Why (Inferred):**
- Ensures container always starts (no config failure blocks startup)
- Git config may fail if ~/.gitconfig readonly (rare)
- Prioritizes availability over correctness

**Problem:**
- **This is a major contributor to current blocker**
- Suppresses ALL errors (including gh auth failure)
- No indication of misconfiguration
- Difficult to diagnose

**Decision 2: grep -v "token" to Hide Token in Logs**
```bash
echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token" || true
```

**Why:**
- Security: Prevents token from appearing in container logs
- gh CLI outputs token in error messages
- grep filters out lines containing "token"

**Trade-off:**
- ✅ Security (token not logged)
- ❌ Lost diagnostic information
- ❌ May filter useful error messages

**Better Approach:**
```bash
# Use temporary file instead of stdin
echo "$GITHUB_TOKEN" > /tmp/gh-token
gh auth login --with-token < /tmp/gh-token 2>&1 | grep -v -E "(token|ghp_)"
rm /tmp/gh-token
```

**Decision 3: Python for Backend Health Check (Lines 77-84)**
```bash
python3 <<EOF > /dev/null 2>&1
import urllib.request
urllib.request.urlopen('$METABOB_API_URL/', timeout=5)
EOF
```

**Why:**
- curl not available in container
- Python3 already installed (used by OpenCode)
- Simple HTTP check without dependencies

#### Constraints and Edge Cases

**Constraint 1: gh Config Not Persisted**
- `~/.config/gh/hosts.yml` in container filesystem (ephemeral)
- Pod restart loses authentication
- Must re-authenticate every restart

**Solution:**
```yaml
# Mount persistent volume for gh config
volumeMounts:
- name: devbob-storage
  mountPath: /root/.config/gh
  subPath: gh-config
```

**Constraint 2: Token Format Not Validated**
- Accepts any non-empty string as GITHUB_TOKEN
- Token "none" passes check: `[ -n "$GITHUB_TOKEN" ]`
- gh auth login fails silently with || true

**Constraint 3: Git Config Global Scope**
- All git operations use same user.name/email
- Cannot have per-repository identities
- May conflict with existing user config

**Edge Case 1: Empty GIT_USER_NAME**
```bash
GIT_USER_NAME=""
GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent ($HOSTNAME)}"
# Result: GIT_USER_NAME="Devbob Agent (devbob-0)"
# Fallback works correctly
```

**Edge Case 2: GIT_USER_NAME with Special Characters**
```bash
GIT_USER_NAME="Devbob; rm -rf /"
git config --global user.name "${GIT_USER_NAME}"
# Safe: Git escapes properly
```

**Edge Case 3: GITHUB_TOKEN with Newlines**
```bash
GITHUB_TOKEN="ghp_123\n456"
echo "$GITHUB_TOKEN" | gh auth login --with-token
# Fails: gh expects single line
```

#### Current vs Desired State

**Current State (DEPLOYED):**
- ✅ Git user.name and user.email configured
- ✅ Git workflow defaults set
- ✅ Safe directory configured
- ✅ gh CLI available
- ❌ **gh auth fails** (GITHUB_TOKEN = "none")
- ❌ Error suppressed (|| true)
- ❌ No indication of failure

**Desired State (FIXED):**
- ✅ Token format validated before auth
- ✅ Clear error message if token invalid
- ✅ Runtime flag set if auth fails (GH_AUTH_DISABLED)
- ✅ gh config persisted in volume

**Gap:**
1. No token validation (accepts "none")
2. Silent failure (|| true suppresses error)
3. No runtime detection mechanism
4. gh config not persisted

---

## Summary of Annotations

### Components Annotated: 5

1. **Entry Point: Container Bootstrap Script**
   - Transform K8s secrets → Git config + gh auth
   - Critical blocker: Silent failure allows container to start with invalid auth

2. **Exit Point: ActivityGit.createPR()**
   - Transform Activity → GitHub Pull Request
   - Missing pre-flight auth check causes runtime 401 error

3. **Main Orchestration: PromptsRunner.executeActivity()**
   - Transform Prompts → Git commits
   - Working correctly, no issues found

4. **Completion Handler: PromptsRunner.completeActivity()**
   - Transform Activity → PR + Completed state
   - PR failure doesn't fail activity (graceful degradation)

5. **Configuration: Git Config in Entrypoint**
   - Transform Environment variables → System configuration
   - Fallback defaults ensure git always works

### Key Insights from Annotations

#### Design Pattern: Graceful Degradation

**Observed in:**
- Entrypoint: Backend unreachable → continue without Metabob
- Entrypoint: gh not installed → warn but continue
- completeActivity: PR fails → mark activity completed anyway

**Why This Pattern:**
- Maximizes availability (containers always start)
- Enables partial functionality (git commits work, PRs don't)
- Reduces deployment failures

**Trade-off:**
- ✅ High availability
- ❌ Confusing runtime errors
- ❌ Difficult to diagnose issues

#### Root Cause of Blocker

**Flow of Silent Failure:**
```
1. K8s Secret: GITHUB_TOKEN="none"
   ↓
2. Entrypoint: Token not validated (accepts "none")
   ↓
3. Entrypoint: gh auth login fails
   ↓
4. Entrypoint: || true suppresses error
   ↓
5. Container starts successfully
   ↓
6. Activity executes (commits created)
   ↓
7. ActivityGit.createPR: No auth check
   ↓
8. gh pr create: HTTP 401 Unauthorized
   ↓
9. User confused (why did it fail now?)
```

**Fix Required at 3 Points:**

**Point 1: Entrypoint (Validation)**
```bash
if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
    log_warn "Invalid GITHUB_TOKEN format"
    export GH_AUTH_DISABLED=true
fi
```

**Point 2: Entrypoint (Remove || true)**
```bash
if echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1; then
    log_info "✓ GitHub CLI authenticated"
else
    log_warn "⚠ GitHub CLI authentication failed"
    export GH_AUTH_DISABLED=true
fi
```

**Point 3: ActivityGit.createPR (Pre-flight Check)**
```typescript
if (!await checkGhAuthenticated()) {
    throw ActivityGitError.notAuthenticated(...)
}
```

#### Business Logic Patterns

**Pattern 1: Fail Fast on Critical Dependencies**
- ANTHROPIC_API_KEY: exit 1 if missing
- Enforces: Container cannot function without LLM

**Pattern 2: Warn on Optional Dependencies**
- GITHUB_TOKEN: warn if missing
- Allows: Git commits work, PRs disabled

**Pattern 3: Atomic Commits Per Prompt**
- Each prompt → one commit
- Enables: Granular history, easy revert

**Pattern 4: Activity Completion != PR Success**
- Activity complete = all prompts executed
- PR is separate integration step
- Enables: Retry PR without re-running activity

### Related Documentation

**For deployment team:**
- See TRACE_DEVBOB_K8S_GIT_OPERATIONS_ENTRY_POINTS.md for entry point details
- See TRACE_DEVBOB_K8S_GIT_OPERATIONS_DEPENDENCY_CHAIN.md for full data flow

**For code quality team:**
- See TRACE_DEVBOB_K8S_GIT_OPERATIONS_CODE_QUALITY_ISSUES.md for security concerns
- See TRACE_DEVBOB_K8S_GIT_OPERATIONS_BOUNDARIES_SUMMARY.txt for architectural boundaries

**For product team:**
- Current state: 95% complete, only missing valid GITHUB_TOKEN
- Quick fix: Replace secret value, restart pods (15 minutes)
- Long-term fix: Add validation and pre-flight checks (1-2 hours)
