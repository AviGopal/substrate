# DevBob K8s Git Operations - Complete Data Flow

## Feature Overview

**Feature ID:** `devbob-k8s-git-operations`  
**Purpose:** Enable autonomous vessel repository management with full git workflow capabilities (branch, commit, push, PR)  
**Status:** 95% complete - Infrastructure deployed, GITHUB_TOKEN placeholder blocking PR operations  
**Last Updated:** 2026-02-27

---

## Executive Summary

The devbob-k8s-git-operations feature enables distributed devbob vessels in Kubernetes to perform autonomous git workflows. The data flow spans 8 transformations across 3 architectural boundaries, from Kubernetes secrets to GitHub Pull Requests.

**Current State:** All infrastructure and code functional except GitHub CLI authentication  
**Blocker:** GITHUB_TOKEN="none" placeholder → Silent failure in entrypoint → Runtime 401 error in PR creation  
**Resolution:** Replace secret value with valid GitHub PAT (5-minute fix)

---

## Complete Flow Diagram

```mermaid
graph TD
    %% Entry Point - Infrastructure
    A1[K8s Secret: devbob-secrets] -->|base64 encoded| A2[StatefulSet Env Injection]
    A2 -->|GITHUB_TOKEN='none'<br/>GIT_USER_NAME<br/>GIT_USER_EMAIL| A3[Container Bootstrap]
    
    %% Bootstrap Phase
    A3 -->|Environment Variables| B1[entrypoint-self-config.sh]
    B1 -->|Validation & Config| B2{Token Valid?}
    B2 -->|Yes ✅| B3[gh auth login]
    B2 -->|No ❌ CURRENT| B4[|| true suppresses error]
    B3 --> B5[~/.config/gh/hosts.yml]
    B4 --> B6[Container starts successfully]
    B5 --> B6
    
    B1 -->|Git Config| B7[~/.gitconfig]
    B7 -->|user.name<br/>user.email<br/>defaults| B6
    
    %% Activity Initialization
    B6 -->|Container Ready| C1[PromptsRunner.run]
    C1 -->|RunOptions| C2[setupActivity]
    C2 -->|Activity.Info| C3[ActivityGit.createBranch]
    C3 -->|git checkout -b| C4[New Branch Created]
    
    %% Prompt Execution Loop
    C4 --> D1[executeActivity]
    D1 -->|For each prompt| D2[Run OpenCode Session]
    D2 -->|Code Changes| D3[generateCommitMessage]
    D3 -->|Conventional Commit| D4[ActivityGit.commitPromptChanges]
    D4 -->|git add . && git commit| D5[Commit Created]
    D5 -->|CommitInfo| D6{More Prompts?}
    D6 -->|Yes| D2
    D6 -->|No| D7[Activity with Commits]
    
    %% Completion Phase
    D7 --> E1[completeActivity]
    E1 -->|Generate PR Body| E2[ActivityGit.createPR]
    E2 -->|git push| E3{Push Success?}
    E3 -->|Yes ✅| E4[checkGhCLI]
    E3 -->|No ❌| E5[Error: Push Failed]
    
    E4 -->|gh --version| E6{gh Installed?}
    E6 -->|Yes ✅| E7[gh pr create]
    E6 -->|No ❌| E8[Error: gh not installed]
    
    E7 -->|HTTP Request| E9{gh Authenticated?}
    E9 -->|Yes ✅| E10[PR Created ✓]
    E9 -->|No ❌ CURRENT| E11[Error: HTTP 401 Unauthorized]
    
    %% Exit Points
    E10 -->|PR URL| E12[Activity Completed]
    E11 -->|Error logged| E13[Activity Completed without PR]
    E5 --> E13
    E8 --> E13
    
    E12 --> F1[GitHub Pull Request]
    E13 --> F2[Git Branch with Commits]
    
    %% Styling
    style A1 fill:#e1f5ff,stroke:#0066cc,stroke-width:2px
    style B2 fill:#fff4e1,stroke:#ff9800,stroke-width:2px
    style B4 fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style E9 fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style E11 fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style F1 fill:#e1ffe1,stroke:#00cc00,stroke-width:2px
    style F2 fill:#fff4e1,stroke:#ff9800,stroke-width:2px
    
    %% Legend
    classDef blocker fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    classDef success fill:#e1ffe1,stroke:#00cc00,stroke-width:2px
    classDef warning fill:#fff4e1,stroke:#ff9800,stroke-width:2px
```

---

## Detailed Data Flow

### Phase 1: Infrastructure → Bootstrap (Transformations 1-2)

#### Transformation 1: K8s Secret → Environment Variables

**Entry Point:** `k8s-devbob-statefulset.yaml:67-81`

```yaml
Input:
  apiVersion: v1
  kind: Secret
  metadata:
    name: devbob-secrets
  data:
    github-token: bm9uZQ==  # "none" (base64)
    git-user-name: RGV2Ym9iIEFnZW50
    git-user-email: ZGV2Ym9iQG1ldGFib2IubG9jYWw=

Transformation:
  - StatefulSet injects secrets as environment variables
  - Base64 decode automatically performed by Kubernetes
  - No validation of values

Output:
  GITHUB_TOKEN="none"
  GIT_USER_NAME="Devbob Agent"
  GIT_USER_EMAIL="devbob@metabob.local"
```

**Validation Rules:**
- ❌ No format validation (accepts "none")
- ❌ No required check (can be empty)
- ✅ K8s validates secret exists

**Boundary Crossed:** Infrastructure → Container Runtime

---

#### Transformation 2: Environment Variables → Git Configuration

**Component:** `entrypoint-self-config.sh:128-173`

```bash
Input:
  GITHUB_TOKEN="none"
  GIT_USER_NAME="Devbob Agent"
  GIT_USER_EMAIL="devbob@metabob.local"

Transformation:
  1. Apply fallback defaults:
     GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent ($HOSTNAME)}"
  
  2. Configure git:
     git config --global user.name "${GIT_USER_NAME}"
     git config --global user.email "${GIT_USER_EMAIL}"
     git config --global init.defaultBranch main
     git config --global push.autoSetupRemote true
  
  3. Authenticate gh CLI:
     echo "$GITHUB_TOKEN" | gh auth login --with-token || true
     # ❌ BLOCKER: || true suppresses auth failure

Output:
  ~/.gitconfig:
    [user]
        name = Devbob Agent (devbob-0)
        email = devbob@metabob.local
    [init]
        defaultBranch = main
  
  ~/.config/gh/hosts.yml:
    ❌ NOT CREATED (auth failed)
```

**Validation Rules:**
- ✅ Fallback defaults for git user config
- ❌ No token format validation
- ❌ Silent failure (|| true)

**Boundary Crossed:** System Configuration → Application Runtime

**🔴 CRITICAL ISSUE:**
- Silent failure allows container to start with broken auth
- No indication of misconfiguration
- Blocker discovered 7 transformations later (at PR creation)

---

### Phase 2: Activity Execution (Transformations 3-5)

#### Transformation 3: RunOptions → Branch Creation

**Component:** `activity-git.ts:37-60`

```typescript
Input:
  RunOptions {
    directory: "/workspace",
    agent: "general",
    branch: "activity-add-auth-abc123"
  }

Transformation:
  1. Check working tree clean: git status --porcelain
  2. Verify branch doesn't exist: git rev-parse --verify ${name}
  3. Create and checkout: git checkout -b ${name}

Output:
  New git branch created
  HEAD -> refs/heads/activity-add-auth-abc123
```

**Validation Rules:**
- ✅ Working tree must be clean
- ✅ Branch name must be unique
- ❌ No branch name format validation

**Boundary Crossed:** Application Logic → Git Repository

---

#### Transformation 4: Prompt File → Commit Message

**Component:** `activity-git.ts:151-170`

```typescript
Input:
  MessageOptions {
    promptFile: "01-add-schema.md",
    promptContent: "Add user schema...",
    diff: "diff --git a/src/schema.ts..."
  }

Transformation:
  1. Parse filename: "01-add-schema.md" → "add-schema"
  2. Determine type: "add" → "feat"
  3. Extract scope from diff: "src/schema.ts" → "schema"
  4. Format: "feat(schema): add schema"

Output:
  Conventional commit message: "feat(schema): add schema"
```

**Validation Rules:**
- ✅ Type always one of 6 valid types
- ✅ Default to "feat" if ambiguous
- ❌ No message length validation
- ❌ No sanitization of special characters

**Boundary Crossed:** File System → Git Metadata

---

#### Transformation 5: Working Tree Changes → CommitInfo

**Component:** `activity-git.ts:111-145`

```typescript
Input:
  CommitOptions {
    promptFile: "01-add-schema.md",
    message: "feat(schema): add schema"
  }

Transformation:
  1. Stage all changes: git add .
  2. Check staged: git diff --cached --name-only
  3. Create commit: git commit -m ${message}
  4. Get commit SHA: git rev-parse HEAD
  5. Get changed files: git diff --name-only HEAD~1

Output:
  CommitInfo {
    sha: "a1b2c3d4e5f6...",
    filesChanged: ["src/schema.ts", "test/schema.test.ts"],
    timestamp: "2026-02-27T12:34:56.789Z"
  }
```

**Validation Rules:**
- ✅ Skips commit if no changes (returns null)
- ✅ Captures all staged changes
- ❌ No validation of commit message format

**Boundary Crossed:** Working Tree → Git Repository

---

### Phase 3: PR Creation (Transformations 6-8)

#### Transformation 6: Activity.Info → PR Body

**Component:** `prompts-runner.ts:346-364`

```typescript
Input:
  Activity.Info {
    id: "act_123",
    title: "Add user authentication",
    commits: [
      { sha: "a1b2c3...", message: "feat(schema): add schema", ... },
      { sha: "d4e5f6...", message: "feat(auth): add auth", ... }
    ],
    stats: {
      tokens: { input: 10000, output: 5000, ... },
      cost: { total: 0.15 }
    }
  }

Transformation:
  Generate Markdown PR description:
  - Summary: List of commits
  - Activity Details: ID, branch, file count
  - Statistics: Tokens, cost, Metabob issues
  - Prompts Executed: Status of each prompt

Output:
  Markdown string (up to 65KB):
  "## Summary
  
  This PR implements the following changes:
  - feat(schema): add schema
  - feat(auth): add authentication
  
  ## Activity Details
  - Activity ID: act_123
  - Commits: 2
  - Files Changed: 5
  
  ## Statistics
  - Tokens: 15,234
  - Cost: $0.15"
```

**Validation Rules:**
- ❌ No length validation (may exceed GitHub 65KB limit)
- ❌ No sanitization of Markdown content

**Boundary Crossed:** Application State → API Payload

---

#### Transformation 7: PROptions → PR URL (🔴 BLOCKER)

**Component:** `activity-git.ts:184-221`

```typescript
Input:
  PROptions {
    title: "feat: Add user authentication",
    body: "## Summary\n\n...",
    base: "main"
  }

Transformation:
  1. Get current branch: git branch --show-current
  2. Push branch: git push -u origin ${branch}
  3. Check gh installed: gh --version
  4. ❌ MISSING: Check gh authenticated
  5. Create PR: gh pr create --title --body --base
  6. Parse URL: result.trim()

Output (Expected):
  PR URL: "https://github.com/owner/repo/pull/123"

Output (Current):
  ❌ Error: HTTP 401: Bad credentials
```

**Validation Rules:**
- ✅ Checks if gh installed
- ❌ Does NOT check if gh authenticated (BLOCKER)
- ❌ No retry logic for transient failures

**Boundary Crossed:** Application → External Service (GitHub API)

**🔴 CRITICAL ISSUE:**
- Missing pre-flight authentication check
- Fails at runtime with generic 401 error
- No actionable error message

---

#### Transformation 8: gh CLI Output → PR URL String

**Component:** `activity-git.ts:210-217`

```typescript
Input:
  gh CLI stdout:
  "https://github.com/owner/repo/pull/123\n"

Transformation:
  result.trim()

Output:
  Clean PR URL: "https://github.com/owner/repo/pull/123"
```

**Validation Rules:**
- ❌ No URL format validation
- ❌ No extraction of PR number

**Boundary Crossed:** Shell Output → Application State

---

## Data Flow Summary

### Entry Point

**Location:** K8s Secret `devbob-secrets`  
**Format:** Base64-encoded key-value pairs  
**Content:**
```yaml
github-token: "none" (placeholder)
git-user-name: "Devbob Agent"
git-user-email: "devbob@metabob.local"
```

**Why Here:**
- Kubernetes secrets provide secure credential storage
- Separation of config from code (immutable image)
- Enables per-environment configuration

---

### Key Transformations Applied

**1. Infrastructure → System Configuration (Transformation 1-2)**
- K8s secrets → Environment variables → Git config
- Enables vessel-specific git identity
- Sets up GitHub authentication (BLOCKED)

**2. Application State → Git Repository (Transformation 3-5)**
- Activity prompts → Git branches → Git commits
- Granular commit history (one per prompt)
- Conventional commit messages

**3. Git Repository → GitHub PR (Transformation 6-8)**
- Activity stats → PR description → GitHub API
- Closes the loop: AI code → human review
- Enables collaborative workflow (BLOCKED)

---

### Validation Rules Enforced

**Infrastructure Layer:**
- ✅ K8s secret must exist (enforced by StatefulSet)
- ❌ No validation of secret values (accepts "none")

**Bootstrap Layer:**
- ✅ Git user config has fallback defaults
- ✅ Safe directory configured for volume mounts
- ❌ Token format not validated
- ❌ Auth failure suppressed (|| true)

**Application Layer:**
- ✅ Working tree must be clean before branch creation
- ✅ Branch name must be unique
- ✅ Commit skipped if no changes
- ❌ No branch name format validation
- ❌ No commit message sanitization
- ❌ No gh authentication check before PR

**External Integration:**
- ✅ gh CLI installation checked
- ❌ gh authentication NOT checked (BLOCKER)
- ❌ No retry logic for transient failures
- ❌ No PR body length validation

---

### Architectural Boundaries Crossed

**Boundary 1: Infrastructure → Container Runtime**
- **Component:** StatefulSet → Container
- **Contract:** Environment variables from secrets
- **Coupling:** Medium (tight to K8s secrets)
- **Resilience:** Good (fallback defaults)

**Boundary 2: System Configuration → Application Runtime**
- **Component:** Entrypoint → Git config
- **Contract:** ~/.gitconfig, ~/.config/gh
- **Coupling:** Medium (git/gh CLI system dependencies)
- **Resilience:** Poor (silent failures)

**Boundary 3: Application Logic → Git Repository**
- **Component:** ActivityGit → Git CLI
- **Contract:** Shell commands via Bun $
- **Coupling:** Tight (Bun-specific)
- **Resilience:** Good (error wrapping)

**Boundary 4: Application → External Service (GitHub API)**
- **Component:** ActivityGit → gh CLI → GitHub
- **Contract:** gh CLI commands
- **Coupling:** Tight (system dependency)
- **Resilience:** Poor (no retry, no auth check)

---

### Exit Points

**Primary Exit (Desired):**
- **Location:** GitHub Pull Request
- **Format:** PR URL string
- **Example:** `https://github.com/owner/repo/pull/123`
- **Status:** ❌ BLOCKED by authentication failure

**Fallback Exit (Current):**
- **Location:** Git branch on remote
- **Format:** Branch with commits
- **Example:** `refs/heads/activity-add-auth-abc123`
- **Status:** ✅ WORKING

**Activity State:**
- **Location:** Storage (JSON file)
- **Format:** Activity.Info with status="completed"
- **Contains:** Commits, stats, errors (if any)
- **Status:** ✅ WORKING

---

## Key Insights

### 1. Business Purpose

**Primary Goal:**
Enable autonomous vessels to participate in standard software development workflows:
1. **Write Code:** AI generates changes based on prompts
2. **Version Control:** Changes captured in git commits
3. **Human Review:** PRs enable oversight and approval
4. **Collaboration:** GitHub workflow integrates with existing teams

**Secondary Goals:**
- Audit trail: Git history shows what changed, when, and why
- Rollback capability: Revert individual prompts or entire activities
- Transparency: PR descriptions include cost, tokens, and metrics

### 2. Critical Decision Points

**Decision Point 1: Silent Failure in Bootstrap (Line 152)**
```bash
echo "$GITHUB_TOKEN" | gh auth login --with-token || true
#                                                  ^^^^^^^^
```

**Impact:**
- ✅ Container always starts (high availability)
- ❌ Auth failure hidden (confusing errors later)
- ❌ Debugging difficult (no clear indication)

**Alternative:**
```bash
if ! echo "$GITHUB_TOKEN" | gh auth login --with-token; then
    export GH_AUTH_DISABLED=true
    log_warn "GitHub auth failed - PR operations disabled"
fi
```

**Decision Point 2: No Pre-flight Auth Check (Line 195)**
```typescript
const hasGh = await checkGhCLI()  // Only checks if installed
if (!hasGh) throw new Error("gh CLI not installed")
// Missing: Check if authenticated
```

**Impact:**
- ❌ PR creation fails at runtime (too late)
- ❌ Generic 401 error (not actionable)
- ❌ User confusion (why did it fail now?)

**Alternative:**
```typescript
if (!await checkGhAuthenticated()) {
    throw ActivityGitError.notAuthenticated(
        "gh CLI not authenticated. Set GITHUB_TOKEN or run: gh auth login"
    )
}
```

**Decision Point 3: Graceful PR Failure (Line 353)**
```typescript
try {
    const prURL = await ActivityGit.createPR(...)
} catch (error) {
    UI.println(`✗ PR creation failed: ${msg}`)
    // Don't throw - activity still completed
}
```

**Impact:**
- ✅ Activity marked complete (commits preserved)
- ✅ User can manually create PR
- ❌ Incomplete workflow (no PR tracking)

**Why This Choice:**
- Activity's primary goal is code changes (commits)
- PR is secondary integration step
- Transient GitHub issues shouldn't fail entire activity

### 3. Potential Risks and Technical Debt

**Risk 1: Command Injection (Input Validation)**
- **Severity:** HIGH
- **Location:** Branch names, commit messages
- **Current State:** Bun $ template provides some escaping
- **Mitigation Needed:** Add explicit validation

**Risk 2: Silent Failures (Error Suppression)**
- **Severity:** HIGH
- **Location:** Entrypoint (|| true)
- **Current State:** Errors suppressed, container starts
- **Mitigation Needed:** Remove || true, add validation

**Risk 3: Missing Timeouts (Reliability)**
- **Severity:** MEDIUM
- **Location:** All shell commands
- **Current State:** No timeout, may hang indefinitely
- **Mitigation Needed:** Add timeout wrapper

**Risk 4: No Retry Logic (Resilience)**
- **Severity:** MEDIUM
- **Location:** git push, gh pr create
- **Current State:** Single failure → permanent failure
- **Mitigation Needed:** Add exponential backoff

**Technical Debt 1: Instance.directory Implicit Dependency**
- **Impact:** Hard to test, tight coupling
- **Refactor:** Add explicit directory parameter

**Technical Debt 2: No Abstraction for Shell Execution**
- **Impact:** Tight coupling to Bun runtime
- **Refactor:** Create ShellExecutor interface

**Technical Debt 3: No Metrics Collection**
- **Impact:** Cannot monitor system health
- **Enhancement:** Add metrics for git operations

### 4. Suggested Improvements

**Immediate (This Sprint):**

1. **Add Authentication Check (5 min)**
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
  if (!await checkGhAuthenticated()) {
    throw ActivityGitError.notAuthenticated(...)
  }
  // ... rest of function
}
```

2. **Fix Silent Error Suppression (15 min)**
```bash
if [ -n "$GITHUB_TOKEN" ]; then
    if [[ "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
        if echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1; then
            log_info "✓ GitHub CLI authenticated"
        else
            log_warn "⚠ GitHub CLI authentication failed"
            export GH_AUTH_DISABLED=true
        fi
    else
        log_warn "⚠ Invalid GITHUB_TOKEN format"
        export GH_AUTH_DISABLED=true
    fi
fi
```

3. **Add Branch Name Validation (30 min)**
```typescript
function validateBranchName(name: string): void {
  const invalidPatterns = [/^-/, /\.\./, /[\\~^:?*[\] ]/, /\x00/]
  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      throw ActivityGitError.invalidBranchName(name, `Invalid pattern: ${pattern}`)
    }
  }
}
```

**Short Term (Next Sprint):**

4. **Add Retry Logic (1 hour)**
5. **Add Timeout for Shell Commands (1 hour)**
6. **Add PR Body Length Validation (30 min)**

**Long Term (Next Quarter):**

7. **Abstract Shell Execution (2 hours)**
8. **Add Metrics Collection (4 hours)**
9. **Implement Circuit Breaker for External Services (2 hours)**

---

## Reusable Patterns

### Pattern 1: Infrastructure → Configuration → Application

**Observed Flow:**
```
K8s Secrets → Environment Variables → System Config → Application Runtime
```

**Reusable Aspects:**
- Environment variable injection (universal)
- Fallback defaults (universal)
- Configuration validation (universal)

**Feature-Specific Aspects:**
- Git configuration (feature-specific)
- GitHub CLI authentication (feature-specific)

**Abstraction Potential:**
```yaml
# Activity Template: bootstrap-configuration
tasks:
  - id: validate-env-vars
    validate:
      env_vars:
        - name: GITHUB_TOKEN
          format: ^ghp_[a-zA-Z0-9]{36}$
          required: false
        - name: ANTHROPIC_API_KEY
          required: true
  
  - id: configure-system
    commands:
      - git config --global user.name "${GIT_USER_NAME}"
      - gh auth login --with-token < /dev/stdin
```

### Pattern 2: Sequential Transformations with State Persistence

**Observed Flow:**
```
For each prompt:
  1. Run prompt → Generate code
  2. Commit changes → Update state
  3. Save activity → Persist progress
```

**Reusable Aspects:**
- Sequential execution with dependencies (universal)
- State persistence after each step (universal)
- Resume on failure (universal)

**Feature-Specific Aspects:**
- Git commits (feature-specific)
- Prompt execution (activity-specific)

**Abstraction Potential:**
```yaml
# Activity Template: sequential-workflow-with-checkpoints
tasks:
  - id: execute-step
    loop: ${steps}
    checkpoint: after_each  # Save state after each iteration
    resume: on_failure      # Resume from last checkpoint
```

### Pattern 3: Graceful Degradation with Fallback

**Observed Flow:**
```
Try primary path (PR creation)
  → On failure: fallback path (activity complete, manual PR)
```

**Reusable Aspects:**
- Try-catch with fallback (universal)
- Mark work complete even if integration fails (universal)
- Log error but don't throw (universal)

**Feature-Specific Aspects:**
- PR creation as optional step (feature-specific)

**Abstraction Potential:**
```yaml
# Activity Template: optional-integration-step
tasks:
  - id: primary-work
    required: true
  
  - id: external-integration
    required: false          # Optional
    on_failure: continue     # Don't fail activity
    log_level: warn          # Warn but don't error
```

### Pattern 4: External Service Integration with Pre-flight Checks

**Observed Flow (Should Be):**
```
1. Check authentication status
2. Validate input parameters
3. Execute operation
4. Handle errors with retry
```

**Reusable Aspects:**
- Pre-flight checks (universal)
- Input validation (universal)
- Retry logic (universal)
- Error handling (universal)

**Feature-Specific Aspects:**
- GitHub API specifics (feature-specific)
- gh CLI commands (tool-specific)

**Abstraction Potential:**
```yaml
# Activity Template: external-api-integration
tasks:
  - id: pre-flight-check
    validate:
      - check: authentication
        required: true
      - check: rate_limit
        required: false
  
  - id: call-api
    retry:
      max_attempts: 3
      backoff_ms: 1000
    timeout_ms: 60000
```

---

## Abstraction into Reusable Activity

### Proposed Activity Template: `autonomous-git-workflow`

```yaml
id: autonomous-git-workflow
name: Autonomous Git Workflow
description: Execute prompts and create PR with full git workflow
category: infrastructure

variables:
  - name: prompts_directory
    type: string
    required: true
    description: Directory containing prompt files
  
  - name: branch_name
    type: string
    required: false
    description: Branch name (auto-generated if not provided)
  
  - name: create_pr
    type: boolean
    required: false
    default: true
    description: Whether to create PR after commits
  
  - name: pr_draft
    type: boolean
    required: false
    default: false
    description: Create PR as draft

tasks:
  - id: validate-environment
    description: Validate git and GitHub CLI setup
    validation:
      commands:
        - git --version
        - gh --version
      env_vars:
        - GITHUB_TOKEN: ^ghp_[a-zA-Z0-9]{36}$
    
  - id: create-branch
    description: Create feature branch for activity
    dependencies: [validate-environment]
    prompt:
      template: |
        Check git status and create branch: ${branch_name || auto-generate}
        Ensure working tree is clean
  
  - id: execute-prompts
    description: Execute prompts and commit changes
    dependencies: [create-branch]
    prompt:
      template: |
        For each prompt in ${prompts_directory}:
        1. Execute prompt
        2. Generate conventional commit message
        3. Commit changes (skip if none)
  
  - id: create-pull-request
    description: Create GitHub Pull Request
    dependencies: [execute-prompts]
    skip_if: ${!create_pr}
    pre_flight_checks:
      - gh auth status
    prompt:
      template: |
        1. Push branch to remote
        2. Generate PR body with activity stats
        3. Create PR with gh CLI
        4. Return PR URL

integration:
  post_checks:
    - verify_pr_created
    - verify_branch_pushed
```

**Universal Aspects (90%):**
- Branch creation
- Commit creation
- PR creation
- Error handling
- State persistence

**Feature-Specific Aspects (10%):**
- Prompt discovery logic
- Commit message generation strategy
- PR body format

---

## Related Documentation

**For Deployment:**
- [Entry Points](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_ENTRY_POINTS.md) - Where to start tracing
- [Dependency Chain](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_DEPENDENCY_CHAIN.md) - Complete flow sequence
- [Deployment Status](../DEPLOYMENT_STATUS_2026-02-27.md) - Current state

**For Architecture:**
- [Architectural Boundaries](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_ARCHITECTURAL_BOUNDARIES.md) - Boundary analysis
- [Boundaries Summary](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_BOUNDARIES_SUMMARY.txt) - Quick reference

**For Code Quality:**
- [Code Quality Issues](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_CODE_QUALITY_ISSUES.md) - Issues found
- [Component Annotations](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_COMPONENT_ANNOTATIONS.md) - Design decisions

**For Data Transformations:**
- [Data Transformations](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_DATA_TRANSFORMATIONS.md) - Detailed transformations
- [Transformations Summary](../TRACE_DEVBOB_K8S_GIT_OPERATIONS_TRANSFORMATIONS_SUMMARY.txt) - Quick reference

---

## Appendix: Quick Reference

### Status Overview

| Component | Status | Blocker |
|-----------|--------|---------|
| Infrastructure (K8s) | ✅ Deployed | None |
| Bootstrap (Entrypoint) | ⚠️ Partial | Silent failure |
| Git Operations | ✅ Working | None |
| Activity Execution | ✅ Working | None |
| PR Creation | ❌ Blocked | No auth check |

### Fix Checklist

- [ ] Replace GITHUB_TOKEN in K8s secret
- [ ] Add token format validation in entrypoint
- [ ] Remove || true from gh auth login
- [ ] Add checkGhAuthenticated() in createPR()
- [ ] Restart devbob pods
- [ ] Verify gh auth status
- [ ] Test end-to-end PR creation

### Key Metrics

- **Transformations:** 8 total
- **Architectural Boundaries:** 4 crossed
- **Components:** 5 critical
- **Completion:** 95% (blocked by 1 issue)
- **Fix Time:** 5-15 minutes

### Contact

**For Questions:**
- Infrastructure: Check K8s secrets and StatefulSet config
- Code: Review activity-git.ts and prompts-runner.ts
- Debugging: Check container logs for gh auth status

**Last Updated:** 2026-02-27
