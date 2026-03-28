# DevBob K8s Git Operations - Code Quality Issues Analysis

## Overview

This document analyzes code quality issues discovered in the git operations flow chain, focusing on validation, error handling, security, and performance concerns that impact autonomous vessel repository management.

**Analysis Date:** 2026-02-27  
**Scope:** Git operations data flow (activity-git.ts, prompts-runner.ts, entrypoint-self-config.sh)  
**Method:** Manual code review (Metabob analysis service unavailable)

---

## Executive Summary

**Issues Found:** 12 total
- **HIGH Priority:** 4 issues (blocking concerns)
- **MEDIUM Priority:** 5 issues (significant technical debt)
- **LOW Priority:** 3 issues (minor improvements)

**Critical Finding:** Missing authentication validation before GitHub operations is a HIGH priority security/reliability issue that blocks PR creation.

---

## HIGH Priority Issues

### Issue 1: Missing Authentication Validation Before PR Creation (🔴 BLOCKER)

**Severity:** HIGH  
**Category:** Security / Validation  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:184-221`

**Description:**
The `createPR()` function does not validate GitHub CLI authentication before attempting PR creation. It only checks if `gh` is installed, not if it's authenticated.

**Code:**
```typescript
// Line 184-221
export async function createPR(opts: PROptions): Promise<string> {
  const branch = await getCurrentBranch()
  const base = opts.base || await getDefaultBranch()

  try {
    await $`git push -u origin ${branch}`.cwd(Instance.directory).quiet()
  } catch (error) {
    throw new Error(`Failed to push branch: ${error}`)
  }

  const hasGh = await checkGhCLI()  // ← Only checks if installed!
  if (!hasGh) {
    throw new Error("gh CLI not installed. Install with: https://cli.github.com/")
  }

  // No authentication check here!
  const result = await $`gh pr create --title ${opts.title} --body ${opts.body} --base ${base}`
    .cwd(Instance.directory)
    .quiet()
    .text()

  const prUrl = result.trim()
  log.info("created PR", { url: prUrl })
  return prUrl
}
```

**Impact on Data Flow:**
- Activity execution succeeds through all transformations
- Commits are created and branch is pushed
- PR creation fails at runtime with HTTP 401 error
- User receives confusing error message: "Failed to create PR: HTTP 401: Bad credentials"
- Activity marked as failed despite successful code changes

**Root Cause:**
```typescript
// Line 301-308
async function checkGhCLI(): Promise<boolean> {
  try {
    await $`gh --version`.quiet()  // ← Only checks version!
    return true
  } catch {
    return false
  }
}
```

This function only verifies `gh` binary exists, not authentication status.

**Fix:**
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

  // Add authentication check
  if (!await checkGhAuthenticated()) {
    throw ActivityGitError.notAuthenticated(
      "gh CLI not authenticated. Set GITHUB_TOKEN environment variable or run: gh auth login"
    )
  }

  // ... rest of function ...
}
```

**Blocking:** Yes - Prevents all PR operations in deployment  
**Technical Debt:** No - This is a missing critical validation

---

### Issue 2: Silent Error Suppression in Entrypoint (🔴 CRITICAL)

**Severity:** HIGH  
**Category:** Error Handling  
**Location:** `repos/metabob-opencode/docker/entrypoint-self-config.sh:134-167`

**Description:**
The entrypoint script uses `|| true` to suppress all git and gh CLI errors, allowing the container to start successfully even when critical operations fail.

**Code:**
```bash
# Line 134-137
git config --global user.name "${GIT_USER_NAME}" 2>/dev/null || true
git config --global user.email "${GIT_USER_EMAIL}" 2>/dev/null || true
git config --global init.defaultBranch main 2>/dev/null || true
git config --global push.autoSetupRemote true 2>/dev/null || true

# Line 152
echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token" || true
#                                                                         ^^^^^^^^
#                                                          SUPPRESSES ALL ERRORS

# Line 184
opencode auth setup --non-interactive || true
#                                     ^^^^^^^^
```

**Impact on Data Flow:**
1. Invalid GITHUB_TOKEN ("none") passed to `gh auth login`
2. Authentication fails but error suppressed
3. Container starts successfully (misleading health status)
4. All git operations work (commits, push)
5. PR creation fails at runtime (7 transformations later)
6. Debugging difficult (no startup error logged)

**Problem Chain:**
```
GITHUB_TOKEN="none" → gh auth login fails → || true suppresses error →
container starts → activity executes → PR creation fails → user confused
```

**Fix Options:**

**Option A: Fail Fast (Strict Mode)**
```bash
if [ -n "$GITHUB_TOKEN" ]; then
    if ! echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token"; then
        log_error "GitHub CLI authentication failed with provided token"
        exit 1  # Fail container startup
    fi
    log_info "  ✓ GitHub CLI authenticated successfully"
fi
```

**Option B: Validation + Warning (Recommended)**
```bash
if [ -n "$GITHUB_TOKEN" ]; then
    # Validate token format before attempting auth
    if [[ "$GITHUB_TOKEN" =~ ^(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})$ ]]; then
        if echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1 | grep -v "token"; then
            log_info "  ✓ GitHub CLI authenticated successfully"
        else
            log_error "  ✗ GitHub CLI authentication failed"
            log_warn "  PR operations will be disabled"
            export GH_AUTH_FAILED=true  # Flag for runtime checks
        fi
    else
        log_warn "  ⚠ Invalid GITHUB_TOKEN format (expected ghp_* or gho_*)"
        log_warn "  PR operations will be disabled"
        export GH_AUTH_FAILED=true
    fi
fi
```

**Blocking:** Yes - Causes confusing runtime failures  
**Technical Debt:** Yes - Accumulated technical debt from "just make it work" approach

---

### Issue 3: No Input Validation for Branch Names (⚠️ SECURITY)

**Severity:** HIGH  
**Category:** Security / Input Validation  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:37-60`

**Description:**
The `createBranch()` function does not validate or sanitize branch names before passing them to shell commands. While Bun's `$` template provides some escaping, this is still a potential command injection vector.

**Code:**
```typescript
// Line 37-60
export async function createBranch(name: string): Promise<void> {
  // No input validation!
  
  const status = await getStatus()
  if (!status.clean) {
    throw ActivityGitError.workingTreeDirty(status.uncommittedFiles)
  }

  const exists = await branchExists(name)
  if (exists) {
    throw ActivityGitError.branchExists(name)
  }

  try {
    await $`git checkout -b ${name}`.cwd(Instance.directory).quiet()
    //                      ^^^^^^ Unvalidated user input!
    log.info("created branch", { name })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw ActivityGitError.branchCreateFailed(name, reason)
  }
}
```

**Attack Vectors:**

**1. Command Injection (Low Risk - Bun escapes):**
```typescript
// Malicious branch name
createBranch("test; rm -rf /")  // Bun escapes this, but...
```

**2. Git Reference Injection (Medium Risk):**
```typescript
// Special git refs that could cause issues
createBranch("refs/heads/main")     // Overwrites main ref
createBranch("../../../etc/passwd") // Path traversal attempt
createBranch("branch\nmalicious")   // Newline injection
```

**3. Filesystem Issues:**
```typescript
// Invalid filesystem characters
createBranch("branch:with:colons")  // Fails on Windows
createBranch("branch with spaces")  // May break scripts
createBranch("branch\x00null")      // Null byte injection
```

**Impact on Data Flow:**
- Activity setup phase may fail with cryptic git errors
- Branch creation succeeds but later operations fail
- Security risk if branch names derived from untrusted input

**Fix:**
```typescript
export async function createBranch(name: string): Promise<void> {
  // Validate branch name
  validateBranchName(name)
  
  // ... rest of function
}

function validateBranchName(name: string): void {
  // Git branch name rules:
  // - Cannot start with '-'
  // - Cannot contain '..' or '@{'
  // - Cannot contain '\', spaces, '~', '^', ':', '?', '*', '['
  // - Cannot end with '/'
  // - Cannot end with '.lock'
  
  const invalidPatterns = [
    /^-/,                    // Starts with dash
    /\.\.|@\{/,              // Contains .. or @{
    /[\\~^:?*[\] ]/,         // Special characters
    /\/$/,                   // Ends with slash
    /\.lock$/,               // Ends with .lock
    /\x00/,                  // Null bytes
    /[\x00-\x1f\x7f]/,       // Control characters
  ]
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      throw ActivityGitError.invalidBranchName(
        name,
        `Branch name contains invalid characters or patterns: ${pattern}`
      )
    }
  }
  
  // Length check (git has 255 char limit per component)
  if (name.length > 250) {
    throw ActivityGitError.invalidBranchName(
      name,
      "Branch name too long (max 250 characters)"
    )
  }
}
```

**Blocking:** No - Currently not exploited, but security risk  
**Technical Debt:** Yes - Input validation should be standard practice

---

### Issue 4: Commit Message Injection Risk (⚠️ SECURITY)

**Severity:** HIGH  
**Category:** Security / Input Validation  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:111-145`

**Description:**
The `commitPromptChanges()` function does not sanitize commit messages before passing to git commit. While Bun's `$` template provides escaping, newlines and special characters in commit messages could cause issues.

**Code:**
```typescript
// Line 111-145
export async function commitPromptChanges(opts: CommitOptions): Promise<CommitInfo | null> {
  // ... staging code ...

  // Create commit
  await $`git commit -m ${opts.message}`.cwd(Instance.directory).quiet()
  //                      ^^^^^^^^^^^^^^ Unvalidated message!

  // ... rest of function ...
}
```

**Attack Vectors:**

**1. Multiline Message Breaking:**
```typescript
// Message with newlines may break git command
const message = "feat: add feature\n\n--author='Attacker <evil@example.com>'"
commitPromptChanges({ promptFile: "test.md", message })
// Results in: git commit -m "feat: add feature

--author='Attacker <evil@example.com>'"
// Bun may interpret --author as a separate argument
```

**2. Commit Metadata Injection:**
```typescript
// Attempt to inject git trailers
const message = "feat: test\n\nSigned-off-by: Attacker <evil@example.com>"
// Valid git format but not intended attribution
```

**Impact on Data Flow:**
- Commits created with malformed messages
- Audit trail compromised (wrong attribution)
- Git history pollution
- Changelog generation may break

**Fix:**
```typescript
function sanitizeCommitMessage(message: string): string {
  // Remove control characters except \n and \t
  let sanitized = message.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
  
  // Limit to single line (remove newlines for -m flag)
  sanitized = sanitized.replace(/\n/g, " ")
  
  // Trim to reasonable length (git limit is ~8KB but 500 chars is good practice)
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + "..."
  }
  
  return sanitized.trim()
}

export async function commitPromptChanges(opts: CommitOptions): Promise<CommitInfo | null> {
  // ... staging code ...

  const sanitizedMessage = sanitizeCommitMessage(opts.message)
  await $`git commit -m ${sanitizedMessage}`.cwd(Instance.directory).quiet()

  // ... rest of function ...
}
```

**Alternative: Use -F flag with temp file**
```typescript
// More robust: write message to file, use -F flag
const messageFile = path.join(Instance.directory, ".git", "COMMIT_EDITMSG")
await Bun.write(messageFile, opts.message)
await $`git commit -F ${messageFile}`.cwd(Instance.directory).quiet()
```

**Blocking:** No - Currently not exploited  
**Technical Debt:** Yes - Input sanitization missing

---

## MEDIUM Priority Issues

### Issue 5: No Timeout for Shell Commands (⚠️ RELIABILITY)

**Severity:** MEDIUM  
**Category:** Performance / Reliability  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts` (all shell commands)

**Description:**
All shell commands executed via Bun's `$` template have no timeout configuration. Long-running or hanging git/gh commands will block indefinitely.

**Code:**
```typescript
// No timeout specified
await $`git status --porcelain`.cwd(Instance.directory).quiet()
await $`gh pr create --title ${opts.title} --body ${opts.body}`.quiet()
```

**Impact on Data Flow:**
- Activity hangs if git command blocks (e.g., waiting for credentials)
- PR creation may hang on network issues
- No way to cancel or recover
- Poor user experience (appears frozen)

**Scenarios:**

**1. Network Hang:**
```typescript
// gh pr create hangs if GitHub API unreachable
await $`gh pr create ...`  // No timeout
// Hangs indefinitely waiting for network
```

**2. Git Credential Prompt:**
```typescript
// git push may prompt for credentials
await $`git push -u origin ${branch}`
// Hangs waiting for user input
```

**3. Large Diff:**
```typescript
// git diff on large repos may take minutes
await $`git diff ${fromCommit}..${toCommit}`
// Blocks without feedback
```

**Fix:**
```typescript
// Add timeout wrapper
async function execWithTimeout<T>(
  cmd: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Command timeout after ${timeoutMs}ms`)), timeoutMs)
  )
  
  return Promise.race([cmd, timeoutPromise])
}

// Usage
await execWithTimeout(
  $`git push -u origin ${branch}`.cwd(Instance.directory).quiet(),
  60000  // 60 second timeout
)
```

**Better: Bun timeout support (if available)**
```typescript
// Check if Bun $ supports timeout option
await $`git push -u origin ${branch}`
  .cwd(Instance.directory)
  .quiet()
  .timeout(60000)  // 60 seconds
```

**Blocking:** No - Rare occurrence  
**Technical Debt:** Yes - Timeouts should be standard

---

### Issue 6: Error Information Loss with .quiet() (⚠️ OBSERVABILITY)

**Severity:** MEDIUM  
**Category:** Error Handling / Observability  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts` (all commands)

**Description:**
All shell commands use `.quiet()` which suppresses stdout/stderr. When commands fail, error messages are lost, making debugging difficult.

**Code:**
```typescript
// Line 54
await $`git checkout -b ${name}`.cwd(Instance.directory).quiet()
// If this fails, stderr is suppressed

// Line 127
await $`git commit -m ${opts.message}`.cwd(Instance.directory).quiet()
// Commit errors not visible

// Line 195
await $`git push -u origin ${branch}`.cwd(Instance.directory).quiet()
// Push failures have no output
```

**Impact on Data Flow:**
- Generic errors without context
- Difficult to diagnose failures
- Users see "Failed to push branch" without reason

**Example:**
```typescript
// Push fails due to missing credentials
try {
  await $`git push -u origin ${branch}`.cwd(Instance.directory).quiet()
} catch (error) {
  throw new Error(`Failed to push branch: ${error}`)
  // Error message: "Failed to push branch: [object Object]"
  // NO information about missing credentials!
}
```

**Fix:**
```typescript
// Capture stderr, don't suppress
try {
  const result = await $`git push -u origin ${branch}`
    .cwd(Instance.directory)
    .nothrow()  // Don't throw on non-zero exit
  
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString()
    throw new Error(`Failed to push branch: ${stderr}`)
  }
} catch (error) {
  // Now we have actual error details
}
```

**Alternative: Selective Quieting**
```typescript
// Only quiet stdout, keep stderr
await $`git push -u origin ${branch}`
  .cwd(Instance.directory)
  .stdout("pipe")  // Pipe stdout (quiet)
  .stderr("inherit")  // Show stderr
```

**Blocking:** No - Errors still caught, just less informative  
**Technical Debt:** Yes - Poor debugging experience

---

### Issue 7: No Retry Logic for Transient Failures (⚠️ RELIABILITY)

**Severity:** MEDIUM  
**Category:** Resilience  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:184-221`

**Description:**
PR creation and git push operations have no retry logic for transient network failures. A single network blip causes the entire activity to fail.

**Code:**
```typescript
// No retry logic
export async function createPR(opts: PROptions): Promise<string> {
  // ... code ...
  
  try {
    await $`git push -u origin ${branch}`.cwd(Instance.directory).quiet()
  } catch (error) {
    throw new Error(`Failed to push branch: ${error}`)
    // Single failure → activity fails
  }

  // ... gh pr create (also no retry) ...
}
```

**Impact on Data Flow:**
- Transient network issues cause permanent failures
- Activity must be re-run from scratch
- Wasted compute and API costs

**Scenarios:**

**1. Network Blip:**
```
Attempt 1: Network timeout → fails
(Activity marked as failed, all work discarded)

With retry:
Attempt 1: Network timeout
Attempt 2: Success (after 1 second)
```

**2. GitHub API Rate Limit:**
```
Attempt 1: 429 Rate Limit → fails
(Should wait and retry, not fail immediately)

With retry:
Attempt 1: 429 Rate Limit
Wait 60 seconds
Attempt 2: Success
```

**Fix:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number
    backoffMs?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    backoffMs = 1000,
    shouldRetry = () => true
  } = opts
  
  let attempts = 0
  let lastError: any
  
  while (attempts < maxAttempts) {
    try {
      return await fn()
    } catch (error) {
      attempts++
      lastError = error
      
      if (attempts >= maxAttempts || !shouldRetry(error)) {
        throw error
      }
      
      const delay = backoffMs * Math.pow(2, attempts - 1)
      log.warn(`Attempt ${attempts} failed, retrying in ${delay}ms`, { error })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// Usage
export async function createPR(opts: PROptions): Promise<string> {
  // ... code ...
  
  await withRetry(
    () => $`git push -u origin ${branch}`.cwd(Instance.directory).quiet(),
    {
      maxAttempts: 3,
      backoffMs: 1000,
      shouldRetry: (error) => {
        // Retry on network errors, not auth errors
        const msg = String(error)
        return !msg.includes("401") && !msg.includes("403")
      }
    }
  )
  
  // ... rest of function ...
}
```

**Blocking:** No - Most operations succeed on first try  
**Technical Debt:** Yes - Industry best practice missing

---

### Issue 8: Instance.directory Implicit Dependency (⚠️ TESTABILITY)

**Severity:** MEDIUM  
**Category:** Architecture / Testability  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts` (all functions)

**Description:**
All ActivityGit functions implicitly depend on `Instance.directory` being initialized. This creates tight coupling and makes unit testing difficult.

**Code:**
```typescript
// Line 54
await $`git checkout -b ${name}`.cwd(Instance.directory).quiet()
//                                    ^^^^^^^^^^^^^^^^^ Implicit dependency

// Every function uses Instance.directory
// No way to override or mock for testing
```

**Impact on Data Flow:**
- ActivityGit functions fail if Instance not initialized
- No explicit error message (fails deep in git command)
- Cannot unit test ActivityGit in isolation

**Example Failure:**
```typescript
// Test code
import { ActivityGit } from "./activity-git"

// This fails with confusing error
await ActivityGit.createBranch("test-branch")
// Error: Cannot read property 'directory' of undefined
// (Instance.directory not initialized in test)
```

**Problems:**

**1. Initialization Order Dependency:**
```typescript
// Must initialize Instance before using ActivityGit
await Instance.initialize()  // ← Easy to forget
await ActivityGit.createBranch("test")
```

**2. Testing Challenges:**
```typescript
// Cannot test ActivityGit without full Instance setup
// Cannot inject mock directory
// Cannot run tests in parallel (shared Instance state)
```

**3. Coupling:**
```typescript
// ActivityGit tightly coupled to Instance
// Changes to Instance.initialize() break ActivityGit
// Hard to refactor or extract
```

**Fix:**
```typescript
// Option A: Explicit parameter
export async function createBranch(
  directory: string,
  name: string
): Promise<void> {
  await $`git checkout -b ${name}`.cwd(directory).quiet()
}

// Option B: Context object
export interface GitContext {
  directory: string
  logger?: Log
}

export async function createBranch(
  ctx: GitContext,
  name: string
): Promise<void> {
  await $`git checkout -b ${name}`.cwd(ctx.directory).quiet()
}

// Option C: Class-based (encapsulation)
export class GitOperations {
  constructor(private directory: string) {}
  
  async createBranch(name: string): Promise<void> {
    await $`git checkout -b ${name}`.cwd(this.directory).quiet()
  }
}

// Usage
const git = new GitOperations(Instance.directory)
await git.createBranch("test")
```

**Blocking:** No - Works fine in production context  
**Technical Debt:** Yes - Makes testing and refactoring harder

---

### Issue 9: No Validation of PR Body Length (⚠️ DATA VALIDATION)

**Severity:** MEDIUM  
**Category:** Validation  
**Location:** `repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts:346-364`

**Description:**
The PR body generated from activity stats is not validated for length. GitHub has a 65,536 character limit for PR bodies. Large activities may exceed this limit.

**Code:**
```typescript
// Line 346-364
if (!options.noPR) {
  UI.println(UI.Style.TEXT_DIM + `│  ├─ Creating pull request...`)

  try {
    const prTitle = activity.title
    const prBody = generatePRBody(activity)  // ← No length check!

    const prURL = await ActivityGit.createPR({
      title: prTitle,
      body: prBody,  // ← May exceed GitHub limit
    })

    activity.stats.prURL = prURL
    UI.println(UI.Style.TEXT_SUCCESS + `│  ├─ ✓ PR created: ${prURL}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    UI.println(UI.Style.TEXT_DANGER + `│  ├─ ✗ PR creation failed: ${msg}`)
    // Don't fail the activity, PR is optional
  }
}
```

**Impact on Data Flow:**
- Large activities (many commits, files) generate huge PR bodies
- GitHub API rejects with 422 Unprocessable Entity
- PR creation fails but error message unclear

**Scenarios:**

**1. Many Commits:**
```typescript
// Activity with 50 commits
// Each commit listed in PR body
// Total: ~10,000 characters (OK)
```

**2. Large File Lists:**
```typescript
// Activity changes 200 files
// Each file path in PR body
// Total: ~15,000 characters (OK)
```

**3. Verbose Metabob Stats:**
```typescript
// Activity resolves 100 Metabob issues
// Each issue with details in PR body
// Total: 70,000 characters (EXCEEDS LIMIT!)
```

**Fix:**
```typescript
function generatePRBody(activity: Activity.Info): string {
  let body = `## Summary\n\n`
  body += `This PR implements the following changes:\n\n`
  body += activity.commits.map(c => `- ${c.message}`).join("\n")
  body += `\n\n## Activity Details\n\n`
  // ... rest of body generation ...
  
  return body
}

function truncatePRBody(body: string, maxLength: number = 65000): string {
  if (body.length <= maxLength) {
    return body
  }
  
  // Truncate with message
  const truncated = body.substring(0, maxLength - 200)
  return `${truncated}\n\n---\n\n**Note:** PR description truncated due to length. View full activity details in the activity system.`
}

// Usage
const prBody = truncatePRBody(generatePRBody(activity))
await ActivityGit.createPR({ title: prTitle, body: prBody })
```

**Blocking:** No - Rare for activities to be that large  
**Technical Debt:** Yes - Input validation missing

---

## LOW Priority Issues

### Issue 10: Magic Numbers Without Constants (ℹ️ MAINTAINABILITY)

**Severity:** LOW  
**Category:** Code Quality / Maintainability  
**Location:** Multiple files

**Description:**
Timeout values, retry counts, and limits are hardcoded as magic numbers instead of named constants.

**Examples:**
```typescript
// repos/metabob-opencode/packages/opencode/src/api/activity-client.ts
let attempts = 0
const maxAttempts = 3  // ← Should be constant
// ...
await sleep(1000 * Math.pow(2, attempts - 1))  // ← Magic number

// repos/metabob-opencode/docker/entrypoint-self-config.sh
MAX_RETRIES=30  # ← Should be configurable
sleep 2  # ← Magic number
```

**Impact on Data Flow:**
- Difficult to adjust timeouts/retries globally
- Inconsistent retry behavior across components

**Fix:**
```typescript
// config/constants.ts
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
}

export const TIMEOUT_CONFIG = {
  GIT_OPERATION_MS: 30000,
  GITHUB_API_MS: 60000,
  BACKEND_HEALTH_CHECK_MS: 5000,
}

// Usage
const maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS
await sleep(RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempts - 1))
```

**Blocking:** No  
**Technical Debt:** Yes - Minor maintainability issue

---

### Issue 11: Inconsistent Error Message Format (ℹ️ UX)

**Severity:** LOW  
**Category:** User Experience  
**Location:** Multiple files

**Description:**
Error messages have inconsistent formatting, making them harder to parse and less professional.

**Examples:**
```typescript
// activity-git.ts
throw new Error("gh CLI not installed. Install with: https://cli.github.com/")
throw new Error(`Failed to push branch: ${error}`)
throw ActivityGitError.branchCreateFailed(name, reason)

// prompts-runner.ts
UI.println(UI.Style.TEXT_DANGER + `│  ├─ ✗ PR creation failed: ${msg}`)
UI.println(UI.Style.TEXT_DANGER + `└─ ✗ Tests failed`)
```

**Impact on Data Flow:**
- Users see inconsistent error messages
- Difficult to parse errors programmatically
- Unprofessional appearance

**Fix:**
```typescript
// util/error-messages.ts
export const ErrorMessages = {
  GH_NOT_INSTALLED: {
    code: "GH_CLI_NOT_FOUND",
    message: "GitHub CLI (gh) is not installed",
    action: "Install from https://cli.github.com/",
  },
  GH_NOT_AUTHENTICATED: {
    code: "GH_AUTH_REQUIRED",
    message: "GitHub CLI is not authenticated",
    action: "Run: gh auth login or set GITHUB_TOKEN",
  },
  BRANCH_CREATE_FAILED: {
    code: "GIT_BRANCH_CREATE_ERROR",
    message: "Failed to create git branch",
    action: "Check git status and branch name validity",
  },
}

// Usage
throw ActivityGitError.fromTemplate(
  ErrorMessages.GH_NOT_AUTHENTICATED,
  { token: "ghp_***" }
)
```

**Blocking:** No  
**Technical Debt:** Yes - Polish issue

---

### Issue 12: No Metrics Collection (ℹ️ OBSERVABILITY)

**Severity:** LOW  
**Category:** Observability  
**Location:** All git operations

**Description:**
No metrics collected for git operations (duration, success rate, error types). This makes it difficult to monitor system health and identify performance issues.

**Impact on Data Flow:**
- Cannot track PR creation success rate
- Cannot identify slow git operations
- Cannot detect authentication failures proactively

**Fix:**
```typescript
// util/metrics.ts
export class Metrics {
  static async recordOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      this.record({
        operation,
        status: "success",
        duration,
      })
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.record({
        operation,
        status: "error",
        duration,
        error: String(error),
      })
      throw error
    }
  }
  
  private static record(event: MetricEvent) {
    // Send to monitoring system (Prometheus, Datadog, etc.)
    log.info("metric", event)
  }
}

// Usage
export async function createPR(opts: PROptions): Promise<string> {
  return Metrics.recordOperation("git.pr.create", async () => {
    // ... existing code ...
  })
}
```

**Blocking:** No  
**Technical Debt:** Yes - Missing observability

---

## Related Files to Review

Based on the issues found, these files should be reviewed for similar patterns:

### High Priority Review

1. **`repos/metabob-opencode/packages/opencode/src/cli/cmd/github.ts`**
   - Reason: Also uses gh CLI, may have same authentication validation issues
   - Check: Authentication validation before gh commands

2. **`repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts`**
   - Reason: May call ActivityGit.createPR()
   - Check: Error handling for PR creation failures

3. **`k8s-devbob-statefulset.yaml`**
   - Reason: Environment variable injection
   - Check: Add validation for GITHUB_TOKEN format

### Medium Priority Review

4. **`repos/metabob-opencode/packages/opencode/src/util/shell.ts` (if exists)**
   - Reason: Shell command execution patterns
   - Check: Timeout and retry logic

5. **`repos/metabob-opencode/packages/opencode/src/config/config.ts`**
   - Reason: Configuration management
   - Check: Add constants for timeouts and retries

6. **`repos/metabob-opencode/packages/opencode/src/tool/activity-errors.ts`**
   - Reason: Error type definitions
   - Check: Add notAuthenticated() error type

### Low Priority Review

7. **`repos/metabob-opencode/packages/opencode/src/session/prompts-runner.ts`**
   - Reason: Activity orchestration
   - Check: PR body generation and truncation

8. **`helm/charts/devbob/templates/deployment.yaml`**
   - Reason: Kubernetes deployment configuration
   - Check: Add liveness/readiness probes

---

## Impact Assessment

### Blocking Issues (Must Fix)

**Issue 1: Missing Authentication Validation**
- **Blocks:** All PR operations
- **Severity:** HIGH
- **Effort:** 5 minutes
- **Impact:** Unblocks autonomous git workflows

**Issue 2: Silent Error Suppression**
- **Blocks:** Debugging, proper error reporting
- **Severity:** HIGH
- **Effort:** 15 minutes
- **Impact:** Better error messages, easier troubleshooting

### Critical Technical Debt (Should Fix Soon)

**Issue 3: No Input Validation (Branch Names)**
- **Risk:** Security vulnerability
- **Severity:** HIGH
- **Effort:** 30 minutes
- **Impact:** Prevents command injection

**Issue 4: Commit Message Injection**
- **Risk:** Security vulnerability
- **Severity:** HIGH
- **Effort:** 20 minutes
- **Impact:** Prevents metadata pollution

### Reliability Improvements (Fix When Convenient)

**Issue 5: No Timeouts**
- **Risk:** System hangs
- **Severity:** MEDIUM
- **Effort:** 1 hour
- **Impact:** Better resilience

**Issue 6: Error Information Loss**
- **Risk:** Poor debugging experience
- **Severity:** MEDIUM
- **Effort:** 30 minutes
- **Impact:** Better error messages

**Issue 7: No Retry Logic**
- **Risk:** Transient failures cause permanent failures
- **Severity:** MEDIUM
- **Effort:** 1 hour
- **Impact:** Better reliability

---

## Recommendations (Priority Order)

### Immediate (This Sprint)

1. **Add authentication check in createPR()** (5 min)
   - Add `checkGhAuthenticated()` function
   - Call before PR creation
   - Throw descriptive error if not authenticated

2. **Fix silent error suppression in entrypoint** (15 min)
   - Remove `|| true` from critical operations
   - Add token format validation
   - Log clear warnings for auth failures

3. **Add branch name validation** (30 min)
   - Implement `validateBranchName()` function
   - Check for invalid characters and patterns
   - Throw descriptive error on invalid input

### Short Term (Next Sprint)

4. **Add commit message sanitization** (20 min)
5. **Add retry logic for GitHub operations** (1 hour)
6. **Add timeout for shell commands** (1 hour)
7. **Improve error message formatting** (30 min)

### Long Term (Next Quarter)

8. **Fix Instance.directory coupling** (2 hours)
9. **Add metrics collection** (4 hours)
10. **Add PR body length validation** (30 min)
11. **Extract magic numbers to constants** (1 hour)

---

## Summary

**Total Issues:** 12
- **HIGH:** 4 (blocking or security concerns)
- **MEDIUM:** 5 (significant technical debt)
- **LOW:** 3 (polish and observability)

**Critical Finding:** The missing authentication validation (Issue 1) is the immediate blocker preventing PR operations. This is a 5-minute fix that unblocks the entire autonomous git workflow.

**Security Concerns:** Issues 3 and 4 (input validation) should be addressed soon to prevent potential command injection and metadata pollution attacks.

**Technical Debt:** The codebase has good error handling patterns overall, but lacks some industry best practices (timeouts, retries, input validation). These should be addressed incrementally to improve reliability and maintainability.

**Quick Wins:** Issues 1, 2, and 10 can be fixed in under 30 minutes combined and would significantly improve system reliability and user experience.
