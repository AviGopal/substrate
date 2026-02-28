# DevBob K8s Git Operations - Data Transformations Analysis

## Overview

This document analyzes every data transformation point in the git operations flow chain, documenting what changes, why it exists, validation rules, and side effects. Each transformation is critical for enabling autonomous vessel repository management.

---

## Transformation 1: K8s Secret → Environment Variables

**Component Flow:** `devbob-secrets` (K8s Secret) → StatefulSet env injection

**Source:** k8s-devbob-statefulset.yaml:67-81

### What Changes

```yaml
# INPUT: K8s Secret (base64-encoded)
apiVersion: v1
kind: Secret
metadata:
  name: devbob-secrets
data:
  github-token: bm9uZQ==           # "none" (base64)
  git-user-name: RGV2Ym9iIEFnZW50  # "Devbob Agent"
  git-user-email: ZGV2Ym9iQG1ldGFib2IubG9jYWw=  # "devbob@metabob.local"

# TRANSFORMATION: Base64 decode + inject as env vars
# OUTPUT: Container Environment Variables
GITHUB_TOKEN="none"
GIT_USER_NAME="Devbob Agent"
GIT_USER_EMAIL="devbob@metabob.local"
```

### Why This Transformation Exists

**Business Requirement:**
- Enable secure credential management in Kubernetes
- Support multi-tenant devbob deployments with different GitHub accounts
- Allow credential rotation without rebuilding containers

**Technical Constraint:**
- Kubernetes best practice: secrets in etcd, not in container images
- Separation of code (immutable image) from config (mutable secrets)

**Security:**
- Prevents credentials from being baked into Docker images
- Allows RBAC control over who can access secrets
- Enables audit trails for secret access

### Validations

**K8s Level:**
- Secret must exist in namespace (else pod fails to start)
- Secret keys must match (github-token, git-user-name, git-user-email)
- Values must be base64-encoded

**No Application-Level Validation:**
- ❌ No validation that GITHUB_TOKEN is a valid format (e.g., starts with "ghp_")
- ❌ No validation that GIT_USER_EMAIL is valid email format
- ❌ No validation that GITHUB_TOKEN is not placeholder "none"

**Current State:**
- ✅ Secret exists and is properly formatted
- ❌ GITHUB_TOKEN value is placeholder "none"

### Side Effects

1. **Environment Variables Available to All Processes:**
   - Any process in container can read these env vars
   - Child processes inherit environment

2. **Secret Changes Require Pod Restart:**
   - Updating secret does NOT automatically update running containers
   - Must run: `kubectl rollout restart statefulset/devbob`

3. **Logged in Pod Events:**
   - Secret references logged in K8s events
   - Secret values NOT logged (only references)

### Alternatives Considered

**1. ConfigMap instead of Secret:**
- ❌ Rejected: ConfigMaps not encrypted at rest
- ❌ Rejected: ConfigMaps visible to all namespace viewers

**2. External Secrets Operator:**
- ✅ Future enhancement: Rotate tokens from AWS Secrets Manager
- Not implemented: Current deployment uses static secrets

**3. SSH Keys instead of HTTPS Token:**
- Alternative: Use SSH deploy keys
- Not implemented: gh CLI requires HTTPS token auth

---

## Transformation 2: Environment Variables → Git Config

**Component Flow:** Environment variables → entrypoint-self-config.sh → ~/.gitconfig

**Source:** repos/metabob-opencode/docker/entrypoint-self-config.sh:128-167

### What Changes

```bash
# INPUT: Environment Variables
GITHUB_TOKEN="none"
GIT_USER_NAME="Devbob Agent"
GIT_USER_EMAIL="devbob@metabob.local"

# TRANSFORMATION: Shell script reads env vars, calls git config
git config --global user.name "${GIT_USER_NAME}"
git config --global user.email "${GIT_USER_EMAIL}"
git config --global init.defaultBranch main
git config --global push.autoSetupRemote true
echo "$GITHUB_TOKEN" | gh auth login --with-token

# OUTPUT: Git Config File (~/.gitconfig)
[user]
    name = Devbob Agent
    email = devbob@metabob.local
[init]
    defaultBranch = main
[push]
    autoSetupRemote = true

# OUTPUT: gh CLI Auth (FAILS with token="none")
~/.config/gh/hosts.yml - NOT CREATED (auth failed)
```

### Why This Transformation Exists

**Business Requirement:**
- Git requires user.name and user.email for commits
- Ensure all devbob commits have consistent attribution
- Enable autonomous PR workflows via gh CLI

**Technical Constraint:**
- Git won't allow commits without user.name and user.email
- gh CLI requires authentication before `gh pr create`
- Each container needs its own git identity

**Workflow Enablement:**
- `init.defaultBranch main`: Creates 'main' instead of 'master'
- `push.autoSetupRemote true`: Simplifies branch push (no -u needed first time)
- `safe.directory /workspace`: Trusts volume-mounted directories

### Validations

**Input Validation:**
```bash
# Provides defaults if env vars missing
GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent ($HOSTNAME)}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-devbob@metabob.local}"

# Checks if GITHUB_TOKEN is set (but not if valid)
if [ -n "$GITHUB_TOKEN" ]; then
    # Attempts auth (fails silently with invalid token)
fi
```

**Validation Rules:**
- ✅ Falls back to defaults if env vars empty
- ✅ Includes hostname in default user.name for pod identification
- ❌ Does NOT validate email format
- ❌ Does NOT validate token format (accepts "none")
- ❌ Does NOT fail container startup if gh auth fails

**Error Handling:**
```bash
git config ... 2>/dev/null || true  # Suppresses errors, continues
gh auth login --with-token 2>&1 | grep -v "token" || true  # Hides token in logs
```

### Side Effects

1. **Creates ~/.gitconfig:**
   - Persists in container filesystem (ephemeral)
   - NOT persisted in volume (recreated on pod restart)

2. **Logs Warnings but Continues:**
   ```
   ⚠ GitHub CLI authentication failed
   ⚠ GITHUB_TOKEN not set - PR operations will fail
   ```
   - Entrypoint continues even if gh auth fails
   - Container starts successfully with broken PR functionality

3. **Git Commands Work, gh Commands Don't:**
   - `git commit` works (user.name/email set)
   - `git push` works (for public repos)
   - `gh pr create` fails (not authenticated)

### Why Silent Failure is Problematic

**Current Behavior:**
- Container starts successfully
- All health checks pass
- PR operations fail at runtime with cryptic errors

**Better Behavior (Not Implemented):**
- Fail container startup if GITHUB_TOKEN invalid
- OR: Mark PR feature as disabled in config
- OR: Expose "git-ops-ready" health check endpoint

### Alternatives Considered

**1. Validate Token Before gh auth login:**
```bash
if [[ "$GITHUB_TOKEN" =~ ^ghp_[a-zA-Z0-9]{36}$ ]]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token
else
    log_error "Invalid GITHUB_TOKEN format"
    exit 1  # Fail fast
fi
```
- Not implemented: Current code accepts any non-empty string

**2. Use Git Credential Helper:**
```bash
git config --global credential.helper store
echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > ~/.git-credentials
```
- Alternative to gh CLI for HTTPS auth
- Not implemented: Prefer gh CLI for PR creation

---

## Transformation 3: Git Config → Activity Initialization

**Component Flow:** ~/.gitconfig → ActivityGit.createBranch() → Git branch

**Source:** repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:37-60

### What Changes

```typescript
// INPUT: Function call with branch name
ActivityGit.createBranch("activity-add-feature-123")

// TRANSFORMATION: Validation checks + git command
const status = await getStatus()  // Check working tree clean
if (!status.clean) throw ActivityGitError.workingTreeDirty(...)

const exists = await branchExists(name)  // Check branch doesn't exist
if (exists) throw ActivityGitError.branchExists(...)

await $`git checkout -b ${name}`  // Create and checkout branch

// OUTPUT: New git branch, HEAD points to new branch
HEAD -> refs/heads/activity-add-feature-123
```

### Why This Transformation Exists

**Business Requirement:**
- Isolate activity work in feature branch
- Enable parallel activity execution (different branches)
- Preserve main branch stability

**Technical Constraint:**
- Git requires clean working tree before creating branch
- Branch names must be unique
- Activity needs consistent naming convention

**Workflow Benefits:**
- Each activity gets its own branch
- Easy to abandon activity (delete branch)
- PR creation requires branch name

### Validations

**Pre-Creation Checks:**
```typescript
// 1. Working tree must be clean
const status = await getStatus()
if (!status.clean) {
  throw ActivityGitError.workingTreeDirty(status.uncommittedFiles)
  // Prevents: mixing uncommitted changes with new activity
}

// 2. Branch must not already exist
const exists = await branchExists(name)
if (exists) {
  throw ActivityGitError.branchExists(name)
  // Prevents: overwriting existing branch
}
```

**Validation Rules:**
- ✅ Enforces clean working tree (no uncommitted files)
- ✅ Enforces unique branch names
- ✅ Throws structured errors (ActivityGitError)
- ❌ Does NOT validate branch name format (allows any string)
- ❌ Does NOT check if name conflicts with tags

**Branch Naming Convention:**
```typescript
// Generated in PromptsRunner.setupActivity()
function generateBranchName(directory: string): string {
  const basename = path.basename(directory)
  const timestamp = Date.now().toString(36)
  return `activity-${basename}-${timestamp}`
}

// Example: "activity-add-auth-123abc"
```

### Side Effects

1. **Changes HEAD Reference:**
   - Before: `HEAD -> refs/heads/main`
   - After: `HEAD -> refs/heads/activity-add-feature-123`
   - All subsequent commits go to new branch

2. **Does NOT Modify Working Tree:**
   - No files changed (only git metadata)
   - Working directory unchanged

3. **Local Branch Only:**
   - Branch not pushed to remote yet
   - Remote push happens in ActivityGit.createPR()

4. **Logged for Audit:**
   ```typescript
   log.info("created branch", { name })
   ```

### Error Recovery

**If Branch Creation Fails:**
```typescript
catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  throw ActivityGitError.branchCreateFailed(name, reason)
}
```

**Cleanup on Failure:**
- No automatic cleanup (branch not created if fails)
- Calling code must handle ActivityGitError
- PromptsRunner rolls back activity state

---

## Transformation 4: Prompt File → Commit Message

**Component Flow:** Prompt filename + diff → generateCommitMessage() → Conventional Commit

**Source:** repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:151-170

### What Changes

```typescript
// INPUT: MessageOptions
{
  promptFile: "01-add-schema.md",
  promptContent: "Add user schema with validation...",
  diff: "diff --git a/src/schema.ts..."
}

// TRANSFORMATION: Parse filename, determine type/scope, format message
const basename = path.basename("01-add-schema.md", ".md")  // "01-add-schema"
const withoutNumber = basename.replace(/^\d+-/, "")         // "add-schema"
const description = withoutNumber.replace(/-/g, " ")        // "add schema"

const type = determineCommitType(withoutNumber, content, diff)  // "feat"
const scope = await determineScope(diff)                        // "schema"

const message = `${type}(${scope}): ${description}`  // "feat(schema): add schema"

// OUTPUT: Conventional Commit Message
"feat(schema): add schema"
```

### Why This Transformation Exists

**Business Requirement:**
- Generate human-readable, semantic commit messages
- Follow conventional commits specification
- Enable automated changelog generation
- Preserve activity context in git history

**Technical Constraint:**
- LLM doesn't have direct access to generate commit message
- Prompt filename is primary signal for intent
- Diff provides additional context for scope

**Benefits:**
- Consistent commit message format across all activities
- Type (feat/fix/refactor) enables semantic versioning
- Scope enables filtering commits by area
- Description explains what changed

### Validations

**Type Determination Logic:**
```typescript
function determineCommitType(
  filename: string,
  content?: string,
  diff?: string,
): "feat" | "fix" | "test" | "refactor" | "docs" | "chore" {
  const lower = filename.toLowerCase()
  const allText = [filename, content, diff].filter(Boolean).join(" ").toLowerCase()

  // Priority order matters
  if (lower.includes("test") || allText.includes("test(")) return "test"
  if (lower.includes("fix") || allText.includes("fix ")) return "fix"
  if (lower.includes("refactor") || allText.includes("refactor")) return "refactor"
  if (lower.includes("doc") || allText.includes("readme")) return "docs"
  if (lower.includes("add") || lower.includes("create") || lower.includes("implement")) return "feat"

  return "feat"  // Default to feat
}
```

**Validation Rules:**
- ✅ Type always one of 6 valid types
- ✅ Default to "feat" if ambiguous
- ❌ No validation of prompt filename format
- ❌ No check if description is empty
- ❌ No length limit on description

**Scope Determination Logic:**
```typescript
async function determineScope(diff?: string): Promise<string | undefined> {
  // Parse diff for file paths
  const pathPattern = /^[\+\-]{3} [ab]\/(.*?)$/gm
  const paths: string[] = []
  while ((match = pathPattern.exec(diff)) !== null) {
    paths.push(match[1])
  }

  // src/session/activity.ts → "session"
  // test/activity.test.ts → "test"
  // Returns first directory or undefined
}
```

**Scope Rules:**
- ✅ Extracted from diff file paths
- ✅ Returns undefined if no diff
- ✅ Handles multiple files (uses first)
- ❌ No validation of scope name format
- ❌ May return very generic scope like "src"

### Side Effects

1. **Logged for Debugging:**
   ```typescript
   log.info("generated commit message", { message })
   ```

2. **No State Changes:**
   - Pure function (no side effects)
   - Does not modify git state
   - Only generates string

3. **Deterministic Output:**
   - Same inputs always produce same message
   - Enables testing and reproducibility

### Examples

**Example 1: Feature Addition**
```
Input:  "01-add-user-authentication.md"
        diff: "src/auth/auth.ts"
Output: "feat(auth): add user authentication"
```

**Example 2: Bug Fix**
```
Input:  "02-fix-login-validation.md"
        diff: "src/auth/login.ts"
Output: "fix(auth): fix login validation"
```

**Example 3: Test**
```
Input:  "03-test-auth-flow.md"
        diff: "test/auth.test.ts"
Output: "test(test): test auth flow"
```

**Example 4: Refactoring**
```
Input:  "04-refactor-database-layer.md"
        diff: "src/db/connection.ts"
Output: "refactor(db): refactor database layer"
```

### Limitations

**Problem 1: Generic Descriptions**
- Filename: "01-update.md"
- Result: "feat: update" (not descriptive)
- Solution: Enforce prompt naming convention

**Problem 2: Multiple Scopes**
- Changes: src/auth/auth.ts, src/user/user.ts
- Result: "feat(auth): ..." (only captures first)
- Solution: Use first file or omit scope

**Problem 3: Non-Semantic Filenames**
- Filename: "prompt.md"
- Result: "feat: prompt" (meaningless)
- Solution: Validate prompt filename format in PromptsRunner

---

## Transformation 5: Working Tree Changes → CommitInfo

**Component Flow:** Working tree → commitPromptChanges() → CommitInfo

**Source:** repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:111-145

### What Changes

```typescript
// INPUT: CommitOptions
{
  promptFile: "01-add-schema.md",
  message: "feat(schema): add schema"
}

// TRANSFORMATION: Stage changes, check diff, commit, extract metadata
await $`git add .`  // Stage all changes in working tree

const stagedStatus = await $`git diff --cached --name-only`  // Check what's staged
const hasChanges = stagedStatus.trim().length > 0

if (!hasChanges) return null  // Short-circuit if nothing to commit

await $`git commit -m ${opts.message}`  // Create commit

const sha = await getBaseCommit()  // Get new commit SHA
const filesOutput = await $`git diff --name-only HEAD~1`  // Get changed files
const filesChanged = filesOutput.trim().split("\n").filter(f => f.length > 0)

// OUTPUT: CommitInfo
{
  sha: "a1b2c3d4e5f6...",
  filesChanged: ["src/schema.ts", "test/schema.test.ts"],
  timestamp: "2026-02-27T12:34:56.789Z"
}
```

### Why This Transformation Exists

**Business Requirement:**
- Track what changed in each activity step
- Enable rollback to specific prompt
- Audit trail for autonomous changes
- Link commits to prompts for debugging

**Technical Constraint:**
- Git only tracks committed changes
- Need metadata for activity reconstruction
- Commit SHA is immutable identifier

**Workflow Benefits:**
- Activity.commits array preserves sequence
- Each commit linked to prompt file
- Files changed enables impact analysis
- Timestamp enables performance tracking

### Validations

**Pre-Commit Checks:**
```typescript
// 1. Stage all changes
await $`git add .`

// 2. Check if anything staged
const stagedStatus = await $`git diff --cached --name-only`
const hasChanges = stagedStatus.trim().length > 0

// 3. Return null if no changes (skip commit)
if (!hasChanges) {
  log.info("no changes to commit", { promptFile: opts.promptFile })
  return null
}
```

**Validation Rules:**
- ✅ Stages all changes (no selective staging)
- ✅ Skips commit if no changes (returns null)
- ✅ Includes untracked files (git add .)
- ❌ Does NOT validate commit message format
- ❌ Does NOT check if filesChanged is empty

**Post-Commit Metadata Extraction:**
```typescript
const sha = await getBaseCommit()  // git rev-parse HEAD
const filesOutput = await $`git diff --name-only HEAD~1`  // Changed files
```

### Side Effects

1. **Creates Git Commit:**
   - Permanent git object (SHA-1 hash)
   - Advances HEAD pointer
   - Parent is previous commit

2. **Logs Commit Info:**
   ```typescript
   log.info("created commit", info)
   ```

3. **Working Tree Becomes Clean:**
   - All staged changes now committed
   - `git status --porcelain` returns empty

4. **Enables Git Operations:**
   - `git diff HEAD~1` shows changes
   - `git revert ${sha}` enables rollback
   - `git show ${sha}` shows commit details

### Error Handling

**If Commit Fails:**
```typescript
// No explicit try-catch in commitPromptChanges
// Error propagates to caller (executeActivity)
// Activity status set to "failed"
```

**Idempotency:**
- Calling twice with no changes returns null (safe)
- Does NOT create empty commits

### Data Schema

```typescript
interface CommitInfo {
  sha: string            // 40-char SHA-1 hash
  filesChanged: string[] // Relative paths from repo root
  timestamp: string      // ISO 8601 format
}
```

**Guarantees:**
- `sha` always 40 hex chars (git SHA-1)
- `filesChanged` always relative paths
- `timestamp` always ISO 8601 UTC

---

## Transformation 6: Activity.Info → PR Body

**Component Flow:** Activity.Info → generatePRBody() → Markdown string

**Source:** repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts:450-500 (inferred)

### What Changes

```typescript
// INPUT: Activity.Info
{
  id: "act_123",
  title: "Add user authentication",
  commits: [
    { promptFile: "01-add-schema.md", message: "feat(schema): add schema", filesChanged: [...] },
    { promptFile: "02-add-auth.md", message: "feat(auth): add authentication", filesChanged: [...] }
  ],
  stats: {
    tokens: { input: 10000, output: 5000, ... },
    cost: { total: 0.15, ... },
    metabob: { issuesResolved: 3, ... }
  }
}

// TRANSFORMATION: Format activity data as PR description
function generatePRBody(activity: Activity.Info): string {
  return `## Summary

This PR implements the following changes:

${activity.commits.map(c => `- ${c.message}`).join("\n")}

## Activity Details

- **Activity ID:** ${activity.id}
- **Branch:** ${activity.branch}
- **Commits:** ${activity.commits.length}
- **Files Changed:** ${uniqueFiles.length}

## Statistics

- **Tokens:** ${formatTokens(activity.stats.tokens)}
- **Cost:** $${activity.stats.cost.total.toFixed(2)}
${activity.stats.metabob.enabled ? `- **Metabob Issues Resolved:** ${activity.stats.metabob.issuesResolved}` : ""}

## Prompts Executed

${activity.prompts.map((p, i) => `${i + 1}. ${p.file} (${p.status})`).join("\n")}
`
}

// OUTPUT: Markdown string
"## Summary\n\nThis PR implements...\n\n## Activity Details..."
```

### Why This Transformation Exists

**Business Requirement:**
- Provide context for code reviewers
- Link PR to activity for audit trail
- Surface metrics for cost tracking
- Enable automated PR analysis

**Technical Constraint:**
- GitHub PR body accepts Markdown
- Must be concise (10,000 char limit)
- Links must be absolute URLs

**Workflow Benefits:**
- Reviewers see activity context immediately
- Metabob issues resolved shown upfront
- Cost data enables budget tracking
- Activity ID enables linking back to system

### Validations

**Input Validation:**
```typescript
// No explicit validation in generatePRBody
// Assumes Activity.Info is valid (enforced by Zod schema)
```

**Validation Rules:**
- ✅ Activity.commits always array (may be empty)
- ✅ Activity.stats always present (default values)
- ❌ No length check on PR body (may exceed GitHub limit)
- ❌ No sanitization of commit messages (may break Markdown)
- ❌ No validation of URL format for activity links

**Markdown Formatting:**
- Uses GitHub-flavored Markdown
- Bullet lists for commits
- Code blocks for activity ID
- Bold for section headers

### Side Effects

1. **No State Changes:**
   - Pure function (no mutations)
   - Does not modify Activity.Info

2. **String Generation Only:**
   - Returns string for gh CLI
   - No I/O operations

3. **Logged for Debugging:**
   ```typescript
   log.debug("generated PR body", { length: prBody.length })
   ```

### Example Output

```markdown
## Summary

This PR implements the following changes:

- feat(schema): add user schema
- feat(auth): add authentication endpoints
- test(auth): add auth tests

## Activity Details

- **Activity ID:** act_20260227_abc123def456
- **Branch:** activity-add-user-auth-abc123
- **Commits:** 3
- **Files Changed:** 5

## Statistics

- **Tokens:** 15,234 (input: 10,000 | output: 5,234 | cache read: 2,000)
- **Cost:** $0.15
- **Metabob Issues Resolved:** 3

## Prompts Executed

1. 01-add-schema.md (committed)
2. 02-add-auth.md (committed)
3. 03-test-auth.md (committed)

---

*Generated by OpenCode Activity System*
*Activity ID: act_20260227_abc123def456*
```

---

## Transformation 7: PROptions → PR URL

**Component Flow:** PROptions → ActivityGit.createPR() → GitHub PR URL

**Source:** repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:184-221

### What Changes

```typescript
// INPUT: PROptions
{
  title: "feat: Add user authentication",
  body: "## Summary\n\n...",  // From generatePRBody()
  base: "main"  // Optional, defaults to main
}

// TRANSFORMATION: Get branch, push to remote, call gh CLI
const branch = await getCurrentBranch()  // "activity-add-user-auth-abc123"
const base = opts.base || await getDefaultBranch()  // "main"

await $`git push -u origin ${branch}`  // Push branch to remote

const hasGh = await checkGhCLI()  // Verify gh installed
if (!hasGh) throw new Error("gh CLI not installed")

const result = await $`gh pr create --title ${opts.title} --body ${opts.body} --base ${base}`
const prUrl = result.trim()  // Parse URL from gh output

// OUTPUT: PR URL
"https://github.com/owner/repo/pull/123"
```

### Why This Transformation Exists

**Business Requirement:**
- Enable autonomous PR creation
- Close the loop: code changes → review → merge
- Integrate with GitHub workflow
- Track PR for activity completion

**Technical Constraint:**
- GitHub requires branch to exist on remote before PR
- gh CLI requires authentication (GITHUB_TOKEN)
- PR creation is atomic operation

**Workflow Benefits:**
- Activity can complete without human intervention
- PR URL stored in Activity.stats.prURL
- Enables dashboard integration
- Supports PR-based deployment triggers

### Validations

**Pre-PR Checks:**
```typescript
// 1. Get current branch
const branch = await getCurrentBranch()
// Error if not on a branch (detached HEAD)

// 2. Determine base branch
const base = opts.base || await getDefaultBranch()
// Fallback to "main" if can't determine

// 3. Push branch to remote
try {
  await $`git push -u origin ${branch}`
} catch (error) {
  throw new Error(`Failed to push branch: ${error}`)
}

// 4. Check gh CLI available
const hasGh = await checkGhCLI()
if (!hasGh) {
  throw new Error("gh CLI not installed. Install with: https://cli.github.com/")
}
```

**Validation Rules:**
- ✅ Verifies gh CLI installed
- ✅ Pushes branch before creating PR
- ✅ Falls back to "main" for base branch
- ❌ Does NOT verify gh CLI is authenticated (**KEY BLOCKER**)
- ❌ Does NOT validate PR title/body format
- ❌ Does NOT check if PR already exists for branch

**Authentication Check (MISSING):**
```typescript
// CURRENT: No authentication check
const hasGh = await checkGhCLI()  // Only checks if installed

// SHOULD BE:
async function checkGhAuthenticated(): Promise<boolean> {
  try {
    await $`gh auth status`.quiet()
    return true
  } catch {
    return false
  }
}
```

### Side Effects

1. **Pushes Branch to Remote:**
   - Creates remote branch (refs/remotes/origin/${branch})
   - Sets up tracking relationship
   - Visible to all repo collaborators

2. **Creates GitHub PR:**
   - PR number assigned by GitHub
   - PR appears in GitHub UI immediately
   - Triggers GitHub Actions workflows
   - Sends notifications to watchers

3. **Logged:**
   ```typescript
   log.info("pushed branch", { branch })
   log.info("created PR", { url: prUrl })
   ```

4. **Error on Failure:**
   - Throws Error with message
   - Does NOT rollback branch push
   - Branch remains on remote even if PR fails

### Current State: BLOCKED

**Symptom:**
```
Error: Failed to create PR: HTTP 401: Bad credentials (https://docs.github.com/rest)
```

**Root Cause:**
- gh CLI not authenticated (token = "none")
- `gh pr create` calls GitHub API with invalid token
- GitHub rejects request with 401 Unauthorized

**Validation That Would Catch This:**
```typescript
export async function createPR(opts: PROptions): Promise<string> {
  // ... existing code ...

  // Check if gh CLI is authenticated
  const isAuthenticated = await checkGhAuthenticated()
  if (!isAuthenticated) {
    log.error("gh CLI not authenticated")
    throw new Error(
      "gh CLI not authenticated. Run: gh auth login\n" +
      "Or set GITHUB_TOKEN environment variable"
    )
  }

  // ... rest of function ...
}
```

### Error Recovery

**On Push Failure:**
- Exception thrown immediately
- No PR creation attempted
- Activity marked as failed

**On gh pr create Failure:**
- Exception thrown with GitHub error
- Branch remains on remote (orphaned)
- No automatic cleanup

**Ideal Recovery:**
1. Detect gh auth failure early (in entrypoint)
2. Mark PR feature as disabled in config
3. Skip PR creation in completeActivity()
4. OR: Retry with exponential backoff

---

## Transformation 8: gh CLI Output → PR URL String

**Component Flow:** gh pr create stdout → trim() → PR URL

**Source:** repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:210-217

### What Changes

```typescript
// INPUT: gh CLI stdout (with potential whitespace/newlines)
const result = await $`gh pr create --title ${opts.title} --body ${opts.body} --base ${base}`
  .cwd(Instance.directory)
  .quiet()
  .text()

// gh outputs:
// "https://github.com/owner/repo/pull/123\n"
// OR (verbose mode):
// "Creating pull request for feature-branch into main\n\nhttps://github.com/owner/repo/pull/123\n"

// TRANSFORMATION: Extract URL from output
const prUrl = result.trim()  // Remove leading/trailing whitespace

// OUTPUT: Clean PR URL
"https://github.com/owner/repo/pull/123"
```

### Why This Transformation Exists

**Business Requirement:**
- Store PR URL for activity tracking
- Enable hyperlinking in dashboards
- Support PR status checks

**Technical Constraint:**
- gh CLI outputs newlines and sometimes extra text
- Need clean URL for storage and API calls

**Parsing Logic:**
- `.text()` converts stdout to string
- `.trim()` removes whitespace
- Assumes last line is PR URL

### Validations

**Current Validation:**
```typescript
const prUrl = result.trim()  // Only whitespace trimming
log.info("created PR", { url: prUrl })
return prUrl
```

**Validation Rules:**
- ✅ Trims whitespace
- ❌ Does NOT validate URL format
- ❌ Does NOT check if URL is GitHub PR
- ❌ Does NOT extract PR number

**Improved Validation (Not Implemented):**
```typescript
function validatePRUrl(output: string): string {
  const prUrl = output.trim()
  
  // Extract PR URL from multi-line output
  const urlMatch = prUrl.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+\/pull\/\d+/)
  if (!urlMatch) {
    throw new Error(`Invalid gh pr create output: ${output}`)
  }
  
  return urlMatch[0]
}
```

### Side Effects

1. **No State Changes:**
   - Pure transformation (string → string)

2. **Logged:**
   ```typescript
   log.info("created PR", { url: prUrl })
   ```

3. **Stored in Activity:**
   ```typescript
   activity.stats.prURL = prUrl
   await Activity.save(activity)
   ```

### Limitations

**Problem 1: Fragile Parsing**
- Assumes gh outputs URL as last line
- May break if gh CLI changes output format
- No regex validation

**Problem 2: No PR Number Extraction**
- URL stored as string
- Must parse URL to get PR number
- Could store both URL and number

**Better Approach:**
```typescript
interface PRResult {
  url: string
  number: number
  branch: string
  base: string
}

async function createPR(opts: PROptions): Promise<PRResult> {
  const result = await $`gh pr create --title ${opts.title} --body ${opts.body} --base ${base} --json url,number`
    .cwd(Instance.directory)
    .quiet()
    .json()  // Parse JSON output
  
  return {
    url: result.url,
    number: result.number,
    branch: await getCurrentBranch(),
    base: opts.base || await getDefaultBranch()
  }
}
```

---

## Summary: Critical Transformation Points

### Working Transformations ✅

1. **K8s Secret → Environment Variables**
   - ✅ Base64 decode works
   - ✅ Injection succeeds
   - ❌ Invalid token value not caught

2. **Environment Variables → Git Config**
   - ✅ Git user.name/email set
   - ✅ Defaults applied if missing
   - ❌ gh auth login fails silently with invalid token

3. **Git Config → Branch Creation**
   - ✅ Working tree validation works
   - ✅ Branch uniqueness enforced
   - ✅ Error handling proper

4. **Prompt File → Commit Message**
   - ✅ Conventional commits generated
   - ✅ Type/scope determination works
   - ⚠️  Fragile parsing (no validation)

5. **Working Tree → CommitInfo**
   - ✅ Staging and commit works
   - ✅ Metadata extraction works
   - ✅ Null returned if no changes

6. **Activity.Info → PR Body**
   - ✅ Markdown generation works
   - ✅ All data included
   - ⚠️  No length validation

### Blocked Transformation ❌

7. **PROptions → PR URL**
   - ✅ Branch push works
   - ✅ gh CLI installed
   - ❌ **gh CLI not authenticated (BLOCKER)**
   - ❌ No pre-flight auth check

8. **gh Output → PR URL**
   - ⚠️  Fragile parsing (no regex)
   - ⚠️  No PR number extraction

---

## Root Cause Analysis

### Single Point of Failure

**Transformation 2: Environment Variables → Git Config**

**Problem:**
```bash
# entrypoint-self-config.sh:146-159
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token" || true
    
    if gh auth status &> /dev/null; then
        log_info "  ✓ GitHub CLI authenticated successfully"
    else
        log_warn "  ⚠ GitHub CLI authentication failed"
    fi
fi
```

**What's Wrong:**
1. `|| true` suppresses errors → container starts even if auth fails
2. Warning logged but no action taken
3. No health check for "PR-ready" state
4. Failure discovered at PR creation time (too late)

**Impact Chain:**
```
GITHUB_TOKEN="none"
  ↓
gh auth login fails (invalid token)
  ↓
Warning logged, container continues
  ↓
All other transformations succeed
  ↓
ActivityGit.createPR() fails at runtime
  ↓
Activity marked as failed (but work already done)
```

### Fix: Fail Fast

**Option 1: Strict Mode (Fail Container Startup)**
```bash
if [ -n "$GITHUB_TOKEN" ]; then
    if ! echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1; then
        log_error "GitHub CLI authentication failed"
        exit 1  # Fail container startup
    fi
fi
```

**Option 2: Validation (Warn but Continue)**
```bash
# Validate token format before attempting auth
if [[ "$GITHUB_TOKEN" =~ ^(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})$ ]]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token
else
    log_warn "Invalid GITHUB_TOKEN format (expected ghp_* or gho_*)"
    log_warn "PR operations will be disabled"
fi
```

**Option 3: Config Flag (Disable PR Feature)**
```typescript
// In Config
export interface GitConfig {
  userRepos/metabob-opencode/packages/opencode/src/session/activity-git.ts name: string
  userEmail: string
  prEnabled: boolean  // Set based on gh auth status
}

// In ActivityGit.createPR()
if (!Config.git.prEnabled) {
  log.warn("PR creation disabled (gh CLI not authenticated)")
  return null  // Skip PR creation
}
```

---

## Recommended Improvements

### 1. Token Validation (High Priority)

**Where:** K8s Secret creation / Helm chart

**Add Schema Validation:**
```yaml
# helm/charts/devbob/templates/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: devbob-secrets
type: Opaque
data:
  github-token: {{ required "secrets.githubToken must be set" .Values.secrets.githubToken | b64enc | quote }}
```

**Add Format Validation:**
```typescript
// In entrypoint-self-config.sh
validate_github_token() {
  local token="$1"
  
  # Check format
  if [[ ! "$token" =~ ^(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})$ ]]; then
    return 1
  fi
  
  # Check validity (optional, requires network)
  if ! gh auth status --hostname github.com &>/dev/null; then
    return 1
  fi
  
  return 0
}
```

### 2. Pre-Flight Checks (Medium Priority)

**Where:** ActivityGit.createPR()

**Add Authentication Check:**
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
  // Check authentication before attempting PR
  if (!await checkGhAuthenticated()) {
    throw ActivityGitError.notAuthenticated(
      "gh CLI not authenticated. Set GITHUB_TOKEN environment variable."
    )
  }
  
  // ... rest of function
}
```

### 3. Better Error Messages (Low Priority)

**Where:** ActivityGitError class

**Add Structured Errors:**
```typescript
export class ActivityGitError extends ActivityError {
  static notAuthenticated(details: string): ActivityGitError {
    return new ActivityGitError(
      "GitHub CLI not authenticated",
      "git",
      { details },
      [
        {
          action: "Set GITHUB_TOKEN environment variable",
          command: "export GITHUB_TOKEN=ghp_..."
        },
        {
          action: "Or run gh auth login",
          command: "gh auth login"
        }
      ]
    )
  }
}
```

---

## Conclusion

The git operations data flow has **7 working transformations** and **1 blocked transformation**. All infrastructure and code are functional except for the GitHub CLI authentication step.

**Key Finding:** Silent failure in Transformation 2 (entrypoint git config) cascades to runtime failure in Transformation 7 (PR creation).

**Resolution:** Add token validation at the entry point (K8s secret / Helm values) to fail fast and provide clear error messages.
