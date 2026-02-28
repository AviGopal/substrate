# DevBob K8s Git Operations - Dependency Chain Analysis

## Overview

This document traces the complete dependency chain for git operations in the distributed devbob deployment, from container bootstrap through runtime execution to PR creation.

---

## Flow Chain: Container Bootstrap → Git Operations → PR Creation

### **Flow 1: Container Initialization (Bootstrap)**

#### 1. Kubernetes StatefulSet → Environment Variables Injection
```
Component: k8s-devbob-statefulset.yaml:67-81
What it does: Injects git credentials from K8s secrets into container environment
Input: K8s Secret (devbob-secrets)
Output: Environment variables (GITHUB_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL)
```

**Data Schema:**
```yaml
# Input: K8s Secret
apiVersion: v1
kind: Secret
metadata:
  name: devbob-secrets
data:
  github-token: <base64>      # "none" in current deployment
  git-user-name: <base64>     # "Devbob Agent"
  git-user-email: <base64>    # "devbob@metabob.local"

# Output: Environment Variables
GITHUB_TOKEN="none"
GIT_USER_NAME="Devbob Agent"  
GIT_USER_EMAIL="devbob@metabob.local"
```

**Dependencies:**
- K8s Secret `devbob-secrets` must exist in namespace
- StatefulSet must have volumeClaimTemplates for persistence

---

#### 2. Entrypoint Script → Git Configuration
```
Component: repos/metabob-opencode/docker/entrypoint-self-config.sh:128-167
Function: Git configuration and GitHub CLI authentication
Input: Environment variables (from Step 1)
Output: Configured git + authenticated gh CLI
```

**What it does:**
1. Reads environment variables (GITHUB_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL)
2. Configures git global config:
   - `git config --global user.name`
   - `git config --global user.email`
   - `git config --global init.defaultBranch main`
   - `git config --global push.autoSetupRemote true`
3. Attempts GitHub CLI authentication:
   - `echo "$GITHUB_TOKEN" | gh auth login --with-token`
   - `gh auth status` (verify)
4. Falls back to defaults if env vars missing

**Data Transformations:**
```bash
# Input: Environment Variables
GITHUB_TOKEN="none"
GIT_USER_NAME="Devbob Agent"

# Transformations:
git config --global user.name "Devbob Agent"
git config --global user.email "devbob@metabob.local"

# Output: Git Config (~/.gitconfig)
[user]
    name = Devbob Agent
    email = devbob@metabob.local
[init]
    defaultBranch = main
[push]
    autoSetupRemote = true

# Output: gh auth status (FAILS with token="none")
✗ Not logged in to github.com
```

**Current State:**
- ✅ Git configuration succeeds (user.name, user.email set)
- ❌ GitHub CLI authentication fails (invalid token)
- ❌ PR operations blocked

---

### **Flow 2: Runtime Git Operations (Activity Execution)**

#### 3. PromptsRunner → Activity Lifecycle Orchestration
```
Component: repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts:50-69
Function: run() - Orchestrates complete activity lifecycle
Input: RunOptions (directory, agent, branch, noPR)
Output: Activity.Info (completed activity with commits)
```

**What it does:**
- **Phase 1:** Setup activity (discover prompts, create branch)
- **Phase 2:** Execute activity (run prompts, commit changes)
- **Phase 3:** Complete activity (create PR, annotate components)

**Data Schema:**
```typescript
interface RunOptions {
  directory: string          // Activity prompts directory
  agent?: string            // Agent to use
  model?: string           // Model override
  format?: "default" | "json"
  branch?: string          // Branch name override
  resume?: boolean         // Resume existing activity
  noPR?: boolean          // Skip PR creation
  interactive?: boolean   // Interactive mode
}

interface Activity.Info {
  id: string
  directory: string
  branch: string
  baseCommit: string       // SHA before activity
  title: string
  prompts: PromptInfo[]
  commits: CommitInfo[]    // Commits created
  status: "active" | "completed" | "failed"
  stats: ActivityStats
}
```

**Dependencies:**
- `Activity` module (activity state management)
- `ActivityGit` module (git operations)
- `ActivityTodo` module (todo generation)
- `ActivityComplete` module (completion logic)

---

#### 4. PromptsRunner.setupActivity() → Branch Creation
```
Component: repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts:74-145
Function: setupActivity() - Initialize activity, create branch
Input: RunOptions
Output: Activity.Info (initialized)
```

**What it does:**
1. Discover prompt files in directory
2. Check working tree is clean (via ActivityGit.isWorkingTreeClean())
3. Generate or prompt for branch name
4. Create branch (via ActivityGit.createBranch())
5. Get base commit SHA (via ActivityGit.getBaseCommit())
6. Generate todos from prompts
7. Create and save activity

**Data Flow:**
```
RunOptions
  ↓
discoverPrompts() → PromptFile[]
  ↓
ActivityGit.isWorkingTreeClean() → boolean
  ↓ (if clean)
ActivityGit.createBranch(branchName) → void
  ↓
ActivityGit.getBaseCommit() → SHA string
  ↓
Activity.create() → Activity.Info
```

**Dependencies:**
- `ActivityGit.isWorkingTreeClean()` → checks git status
- `ActivityGit.createBranch()` → creates new branch
- `ActivityGit.getBaseCommit()` → gets HEAD SHA

---

#### 5. ActivityGit.createBranch() → Git Branch Operations
```
Component: repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:37-60
Function: createBranch(name) - Create and checkout new branch
Input: string (branch name)
Output: void (throws ActivityGitError on failure)
```

**What it does:**
1. Check working tree is clean (via getStatus())
2. Check branch doesn't exist (via branchExists())
3. Create and checkout branch: `git checkout -b ${name}`
4. Log success or throw ActivityGitError

**Data Flow:**
```
branchName: string
  ↓
getStatus() → { clean: boolean, uncommittedFiles: string[] }
  ↓ (if clean)
branchExists(name) → boolean
  ↓ (if not exists)
$`git checkout -b ${name}` → void
  ↓
Log success
```

**Error Handling:**
- Throws `ActivityGitError.workingTreeDirty()` if uncommitted changes
- Throws `ActivityGitError.branchExists()` if branch already exists
- Throws `ActivityGitError.branchCreateFailed()` if git command fails

---

#### 6. PromptsRunner.executeActivity() → Prompt Execution & Commits
```
Component: repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts:150-250
Function: executeActivity() - Execute prompts and commit changes
Input: Activity.Info, RunOptions
Output: void (mutates activity with commits)
```

**What it does:**
1. Iterate through prompts
2. For each prompt:
   - Run OpenCode session with prompt content
   - Generate commit message (via ActivityGit.generateCommitMessage())
   - Commit changes (via ActivityGit.commitPromptChanges())
   - Update activity state
   - Mark todo as complete
3. Save activity after each prompt

**Data Flow:**
```
Activity.Info + RunOptions
  ↓
For each prompt:
  ↓
  runPrompt() → PromptResult (tokens, cost, sessionID)
  ↓
  ActivityGit.generateCommitMessage() → string (commit message)
  ↓
  ActivityGit.commitPromptChanges() → CommitInfo | null
  ↓
  activity.commits.push(commitInfo)
  ↓
  Activity.save(activity)
```

**Dependencies:**
- `ActivityGit.generateCommitMessage()` → generates conventional commit message
- `ActivityGit.commitPromptChanges()` → stages and commits changes

---

#### 7. ActivityGit.commitPromptChanges() → Git Commit Operations
```
Component: repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:111-145
Function: commitPromptChanges(opts) - Stage and commit all changes
Input: CommitOptions { promptFile, message }
Output: CommitInfo | null (null if no changes)
```

**What it does:**
1. Stage all changes: `git add .`
2. Check for staged changes: `git diff --cached --name-only`
3. If no changes, return null
4. Create commit: `git commit -m ${message}`
5. Get commit SHA: `git rev-parse HEAD`
6. Get changed files: `git diff --name-only HEAD~1`
7. Return CommitInfo with SHA, files, timestamp

**Data Flow:**
```
CommitOptions { promptFile, message }
  ↓
$`git add .` → void
  ↓
$`git diff --cached --name-only` → string (staged files)
  ↓ (if has changes)
$`git commit -m ${message}` → void
  ↓
getBaseCommit() → SHA string
  ↓
$`git diff --name-only HEAD~1` → string[] (changed files)
  ↓
CommitInfo { sha, filesChanged, timestamp }
```

**Data Schema:**
```typescript
interface CommitOptions {
  promptFile: string      // Source prompt file
  message: string         // Commit message
}

interface CommitInfo {
  sha: string            // Commit SHA
  filesChanged: string[] // Files in commit
  timestamp: string      // ISO timestamp
}
```

---

### **Flow 3: PR Creation (Completion)**

#### 8. PromptsRunner.completeActivity() → PR Creation Orchestration
```
Component: repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts:300-350
Function: completeActivity() - Create PR and complete activity
Input: Activity.Info, RunOptions
Output: void (updates activity status)
```

**What it does:**
1. Check if --no-pr flag set (skip PR if true)
2. Generate PR title and body from activity
3. Create PR (via ActivityGit.createPR())
4. Update activity with PR URL
5. Mark activity as completed
6. Run ActivityComplete workflow (annotations, patterns)

**Data Flow:**
```
Activity.Info + RunOptions
  ↓
generatePRTitle() → string
generatePRBody() → string
  ↓
ActivityGit.createPR({ title, body, base }) → PR URL
  ↓
activity.prURL = prURL
activity.status = "completed"
  ↓
Activity.save(activity)
  ↓
ActivityComplete.run() → annotations and patterns
```

**Dependencies:**
- `ActivityGit.createPR()` → pushes branch and creates PR
- `ActivityComplete` → post-PR annotations

---

#### 9. ActivityGit.createPR() → GitHub PR Creation
```
Component: repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:184-221
Function: createPR(opts) - Push branch and create PR
Input: PROptions { title, body, base? }
Output: string (PR URL)
```

**What it does:**
1. Get current branch name: `git branch --show-current`
2. Get base branch (default to main): `getDefaultBranch()`
3. Push branch to origin: `git push -u origin ${branch}`
4. Check gh CLI is available: `checkGhCLI()`
5. Create PR: `gh pr create --title ${title} --body ${body} --base ${base}`
6. Return PR URL from gh output

**Data Flow:**
```
PROptions { title, body, base? }
  ↓
getCurrentBranch() → string (branch name)
  ↓
getDefaultBranch() → string (base branch)
  ↓
$`git push -u origin ${branch}` → void
  ↓
checkGhCLI() → boolean
  ↓ (if gh available)
$`gh pr create --title ${title} --body ${body} --base ${base}` → PR URL
  ↓
Return PR URL string
```

**Data Schema:**
```typescript
interface PROptions {
  title: string          // PR title
  body: string           // PR description
  base?: string          // Base branch (defaults to main)
}

// Output: PR URL string
// Example: "https://github.com/owner/repo/pull/123"
```

**Error Handling:**
- Throws error if git push fails
- Throws error if gh CLI not installed
- Throws error if gh pr create fails

**🔴 CRITICAL DEPENDENCY:**
- Requires authenticated `gh` CLI
- Authentication set up in entrypoint (Step 2)
- **BLOCKS HERE** if GITHUB_TOKEN is invalid

---

#### 10. checkGhCLI() → GitHub CLI Availability Check
```
Component: repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:301-308
Function: checkGhCLI() - Verify gh CLI is installed
Input: void
Output: boolean
```

**What it does:**
1. Try to run `gh --version`
2. Return true if succeeds
3. Return false if fails (gh not installed)

**Data Flow:**
```
void
  ↓
$`gh --version` → stdout (version string)
  ↓ (success)
Return true

OR

$`gh --version` → throws error
  ↓ (catch)
Return false
```

**Note:**
- This only checks if `gh` is installed
- Does NOT check if `gh` is authenticated
- Authentication checked implicitly when `gh pr create` runs

---

### **Flow 4: Alternative Entry Point - GitHub App Integration**

#### 11. GithubCommand → Webhook Handler
```
Component: repos/metabob-opencode/packages/opencode/src/cli/cmd/github.ts:129-200
Function: GithubCommand.run() - Handle GitHub webhook events
Input: GitHub webhook payload (IssueCommentEvent)
Output: PR creation + comment update
```

**What it does:**
1. Receive GitHub webhook (issue_comment event)
2. Extract `/oc` command from comment
3. Generate app installation token
4. Configure git with app token (via configureGit())
5. Checkout appropriate branch
6. Run OpenCode agent with prompt
7. Commit changes with summary
8. Push to branch (via pushToNewBranch())
9. Create PR (via createPR())
10. Update GitHub comment with results

**Data Flow:**
```
IssueCommentEvent (webhook payload)
  ↓
Parse comment → user prompt
  ↓
Generate app token → GitHub App JWT
  ↓
configureGit(appToken) → git config insteadOf
  ↓
git checkout -b ${branch}
  ↓
runOpencodeAgent(prompt) → changes
  ↓
pushToNewBranch(summary, branch) → git push
  ↓
createPR(base, branch, title, body) → PR URL (via Octokit)
  ↓
Update GitHub comment with PR link
```

**Key Difference from ActivityGit.createPR():**
- Uses Octokit REST API instead of `gh` CLI
- Configures git auth via app token, not user token
- Bot identity: "opencode-agent[bot]"

---

#### 12. configureGit() → App Token Authentication
```
Component: repos/metabob-opencode/packages/opencode/src/cli/cmd/github.ts:746-760
Function: configureGit(appToken) - Configure git for GitHub App auth
Input: string (GitHub App installation token)
Output: void (configures git)
```

**What it does:**
1. Set git user.name to "opencode-agent[bot]"
2. Set git user.email to bot email
3. Configure HTTPS auth with token:
   ```
   git config --global url."https://x-access-token:${token}@github.com/".insteadOf "https://github.com/"
   ```

**Data Flow:**
```
appToken: string
  ↓
git config --global user.name "opencode-agent[bot]"
git config --global user.email "opencode-agent[bot]@users.noreply.github.com"
  ↓
git config --global url."https://x-access-token:${appToken}@github.com/".insteadOf "https://github.com/"
  ↓
Git operations now use app token for auth
```

**Authentication Difference:**
- `gh` CLI: Uses `gh auth login --with-token` + GITHUB_TOKEN env var
- App token: Uses git config insteadOf with token in URL

---

## Dependency Summary

### Complete Chain (Bootstrap → PR Creation)

```
1. K8s Secret (devbob-secrets)
   ↓
2. K8s StatefulSet env injection
   ↓ (GITHUB_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL)
3. entrypoint-self-config.sh
   ↓ (git config + gh auth login)
4. ~/.gitconfig + gh auth status
   ↓
5. PromptsRunner.run()
   ↓
6. PromptsRunner.setupActivity()
   ↓
7. ActivityGit.createBranch()
   ↓ (git checkout -b)
8. PromptsRunner.executeActivity()
   ↓
9. ActivityGit.commitPromptChanges()
   ↓ (git add . && git commit)
10. PromptsRunner.completeActivity()
    ↓
11. ActivityGit.createPR()
    ↓
12. checkGhCLI() → gh --version
    ↓
13. git push -u origin ${branch}
    ↓
14. gh pr create → **REQUIRES AUTHENTICATED gh CLI**
    ↓
15. Return PR URL
```

---

## Critical Dependencies

### Infrastructure Layer
1. **K8s Secret (devbob-secrets)**
   - Must contain valid GITHUB_TOKEN
   - Currently: token = "none" (placeholder)

2. **Docker Image (Dockerfile.devbob-local)**
   - Must have git installed (✅ v2.39.5)
   - Must have gh CLI installed (✅ installed)

3. **Entrypoint Script (entrypoint-self-config.sh)**
   - Must run on container startup (✅ works)
   - Must configure git (✅ works)
   - Must authenticate gh CLI (❌ fails with placeholder token)

### Application Layer
4. **Instance Module (project/instance.ts)**
   - Provides `Instance.directory` context
   - Used by all git operations for working directory

5. **ActivityGit Module (session/activity-git.ts)**
   - Core git operations abstraction
   - Depends on:
     - Bun's `$` template for shell commands
     - `Instance.directory` for working directory
     - `gh` CLI for PR creation

6. **PromptsRunner Module (session/prompts-runner.ts)**
   - Activity lifecycle orchestration
   - Depends on:
     - ActivityGit for all git operations
     - Activity for state management
     - ActivityTodo for task tracking

### External Dependencies
7. **Git CLI**
   - Required for all git operations
   - Version: 2.39.5 (installed in Docker image)

8. **GitHub CLI (gh)**
   - Required for PR creation
   - Must be authenticated via `gh auth login`
   - **BLOCKS PR operations if not authenticated**

---

## Current State Analysis

### ✅ Working Components

1. **Git Basic Operations**
   - `git config` (user.name, user.email)
   - `git checkout -b` (branch creation)
   - `git add .` (staging)
   - `git commit -m` (commits)
   - `git status` (status checks)
   - `git diff` (diffing)

2. **Activity Lifecycle**
   - Prompt discovery
   - Branch creation
   - Prompt execution
   - Commit creation
   - State management

3. **Infrastructure**
   - K8s StatefulSet deployed
   - Secrets injected
   - Environment variables present
   - Entrypoint script runs

### ❌ Blocked Components

1. **GitHub CLI Authentication**
   - `gh auth login` fails with token="none"
   - `gh auth status` returns not authenticated

2. **PR Creation**
   - `git push` succeeds for public repos
   - `gh pr create` fails (requires auth)
   - Activity completes without PR

3. **Private Repo Operations**
   - Clone private repos (requires auth)
   - Push to private repos (requires auth)

---

## Gap Analysis

### What We Have
- ✅ Infrastructure deployed and running
- ✅ Code implementation complete and tested
- ✅ Git operations working for public repos
- ✅ Activity lifecycle end-to-end (minus PR)
- ✅ Entrypoint automation working

### What We're Missing
- ❌ Valid GITHUB_TOKEN in devbob-secrets
- ❌ Authenticated gh CLI
- ❌ PR creation capability
- ❌ Private repo access

### What Needs to Change
1. **Update K8s Secret:**
   ```bash
   kubectl patch secret devbob-secrets -n metabob --type='json' \
     -p='[{"op": "replace", "path": "/data/github-token", "value": "'$(echo -n "ghp_REAL_TOKEN" | base64)'"}]'
   ```

2. **Restart Pods:**
   ```bash
   kubectl rollout restart statefulset/devbob -n metabob
   ```

3. **Verify:**
   ```bash
   kubectl exec devbob-0 -n metabob -- gh auth status
   # Should show: ✓ Logged in to github.com
   ```

---

## Data Transformation Summary

### Environment Variables → Git Config
```
GITHUB_TOKEN="ghp_XXX"          →  gh auth login (stored in ~/.config/gh/)
GIT_USER_NAME="Devbob Agent"    →  git config user.name "Devbob Agent"
GIT_USER_EMAIL="devbob@..."     →  git config user.email "devbob@..."
```

### Activity Options → Branch Name
```
RunOptions {                    →  "activity-add-feature-123"
  directory: "activities/add-feature"
}
```

### Prompt File → Commit Message
```
"01-add-schema.md"              →  "feat(schema): add schema"
```

### Activity → PR
```
Activity.Info {                 →  PR {
  commits: [...],                    title: "feat: add feature"
  branch: "activity-...",            body: "## Summary\n..."
  title: "Add feature"               url: "https://github.com/.../pull/123"
}                                   }
```

---

## Related Files

### Core Git Operations
- `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts` - Git operations module
- `repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts` - Activity orchestration
- `repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts` - Completion logic
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Activity tool (imports ActivityGit)

### Error Handling
- `repos/metabob-opencode/packages/opencode/src/tool/activity-errors.ts` - ActivityGitError definitions

### Infrastructure
- `k8s-devbob-statefulset.yaml` - K8s deployment
- `Dockerfile.devbob-local` - Container image
- `repos/metabob-opencode/docker/entrypoint-self-config.sh` - Bootstrap script

### GitHub Integration
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/github.ts` - GitHub App integration
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/pr.ts` - PR checkout command

---

## Conclusion

The git operations dependency chain is **complete and functional** except for the final step: GitHub CLI authentication. The chain flows from:

1. **Infrastructure** (K8s secrets) →
2. **Bootstrap** (entrypoint git config) →
3. **Runtime** (ActivityGit operations) →
4. **Completion** (PR creation)

**Blocker:** Step 2 (gh auth login) fails due to placeholder GITHUB_TOKEN="none"

**Resolution:** Update the secret with a valid GitHub PAT (classic) to unblock the entire chain and enable autonomous PR workflows.
