# Component Annotations: devbob-k8s-git-operations

This document provides architectural annotations for the critical components in the devbob Kubernetes git operations data flow.

---

## Component 1: deploy-devbob-k8s-git.sh (Deployment Entry Point)

**Role in Flow:** Entry point - Deployment orchestration and credential injection

**Data Transformation:**
- Input: User credentials (stdin/env vars) - Raw strings
- Output: Kubernetes Secret + StatefulSet deployment - Base64-encoded secrets

**Business Logic:**
This component handles the deployment of devbob agents with git operation capabilities. It enforces the constraint that all 3 StatefulSet pods must have identical credentials for consistent behavior across the distributed system.

**Design Decision:**
Uses interactive prompts for credentials to prevent accidental exposure in shell history or CI logs. However, this creates an anti-pattern where empty input results in GITHUB_TOKEN="none" instead of failing fast.

**Why This Approach:**
- **Security:** Secrets stored in Kubernetes (encrypted at rest, RBAC-controlled)
- **Consistency:** Single secret shared by all pods (no credential skew)
- **Operational:** Allows credential rotation without rebuilding images

**Constraints:**
1. **Critical Flaw:** Empty GITHUB_TOKEN sets value to "none" instead of failing deployment
   - Impact: Deployment succeeds but git operations fail at runtime
   - Root Cause: Lines 46-49 prioritize deployment success over correctness
2. **No Validation:** Accepts any string as valid token (defers validation to runtime)
3. **Idempotency:** Uses `kubectl apply` (safe to re-run)

**Business Context:**
In distributed devbob architecture, all 3 pods must authenticate to GitHub as the same user to maintain consistent commit authorship and PR ownership. This component ensures atomic secret updates (all pods restart together).

**Failure Mode:**
If deployment script sets invalid credentials, all 3 pods will fail authentication simultaneously, requiring manual intervention to update the secret and trigger rollout.

---

## Component 2: entrypoint-self-config.sh (Authentication Handler)

**Role in Flow:** Boundary crossing - Kubernetes environment → Git/GitHub configuration

**Data Transformation:**
- Input: Environment variables (GITHUB_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL)
- Output: 
  - ~/.gitconfig (INI file with user identity)
  - ~/.config/gh/hosts.yml (GitHub CLI auth state)
  - GH_AUTHENTICATED environment variable (boolean flag)

**Business Logic:**
This component validates credentials and configures git/gh CLI for autonomous operations. It enforces GitHub token format requirements (ghp_* or github_pat_* prefix) and verifies authentication by calling GitHub API.

**Design Decision:**
Performs validation at container startup (not deployment time) to fail early in the pod lifecycle. However, authentication failure is NON-FATAL - sets GH_AUTHENTICATED="false" and continues, allowing the container to run in degraded mode.

**Why This Approach:**
- **Graceful Degradation:** Container starts even with invalid git credentials (useful for debugging)
- **Fail Early:** Validates token before any activity execution
- **Stateful Auth:** gh CLI stores token persistently (survives container restarts if volume mounted)

**Constraints:**
1. **Validation Timing:** Token validation happens AFTER pod deployment (too late to prevent deployment)
2. **Weak Regex:** Accepts tokens as short as 20 chars (GitHub tokens are 36+ chars)
3. **Side Effect:** GitHub API call during startup (network dependency)
4. **No Rollback:** If validation fails, pod continues running (manual intervention required)

**Business Context:**
In autonomous agent workflows, git operations must work without human intervention. This component ensures the agent can commit code and create PRs automatically. The GH_AUTHENTICATED flag is checked before PR creation to provide early error feedback.

**Security Consideration:**
Token validation includes API call (gh auth status) which leaks token validity to GitHub's auth endpoint. However, this is acceptable as it confirms the token works before attempting repository operations.

---

## Component 3: ActivityGit.commitPromptChanges() (Business Logic Core)

**Role in Flow:** Main transformation - Activity state → Git commits

**Data Transformation:**
- Input: CommitOptions { promptFile: string, message: string }
- Output: CommitInfo { sha: string, filesChanged: string[], timestamp: string } | null

**Business Logic:**
This component implements atomic commit creation per activity prompt. It enforces the constraint that each prompt gets its own commit (granular history), and skips commits if no changes were made (idempotency).

**Design Decision:**
Sanitizes commit messages to remove control characters and enforce length limits (50KB max). This prevents git history corruption from malformed messages while allowing rich descriptions.

**Why This Approach:**
- **Atomic Units:** One commit per prompt enables fine-grained rollback
- **Idempotency:** Returns null if no changes (safe to retry)
- **Traceability:** Stores commit SHA in activity metadata (links activity to git history)

**Constraints:**
1. **Working Directory:** Assumes `Instance.directory` is a valid git repository
2. **Staging Behavior:** Uses `git add .` (stages ALL changes, no selective staging)
3. **Message Length:** Truncates at 50KB (arbitrary limit, not git constraint)
4. **No Conflict Resolution:** Assumes linear history (no merge conflicts)

**Business Context:**
In activity-driven development, each prompt represents a logical unit of work. Separating commits per prompt allows:
- Rollback of specific prompts without losing entire activity
- Blame/history analysis per prompt
- Automated changelog generation from prompt names

**Transformation Logic:**
1. Stage all changes (`git add .`)
2. Check for staged changes (`git diff --cached`)
3. Sanitize message (remove control chars, limit length)
4. Create commit (`git commit -m`)
5. Extract metadata (SHA, files changed, timestamp)

**Alternative Approaches Rejected:**
- Single commit per activity: Loses granularity
- Manual staging: Adds complexity, requires file tracking
- LLM-generated messages: Costs tokens, not deterministic

---

## Component 4: ActivityGit.createPR() (Integration Boundary)

**Role in Flow:** Service boundary - Local git repository → GitHub API

**Data Transformation:**
- Input: PROptions { title: string, body: string, base?: string }
- Output: PR URL (string) - e.g., "https://github.com/org/repo/pull/123"

**Business Logic:**
This component handles the transition from local development to collaborative review. It enforces pre-flight checks (gh installed, authenticated) before attempting PR creation to fail early with actionable errors.

**Design Decision:**
Uses GitHub CLI (`gh`) as abstraction over GitHub REST/GraphQL APIs rather than direct HTTP calls. This delegates API versioning and authentication complexity to the `gh` tool.

**Why This Approach:**
- **Abstraction:** `gh` handles API changes (decouples from GitHub API versions)
- **Authentication:** `gh` manages token storage and refresh
- **UX:** `gh pr create` output is user-friendly (prints PR URL directly)
- **Portability:** Same code works with GitHub Enterprise (different API endpoints)

**Constraints:**
1. **Hard Dependency:** Requires `gh` CLI installed (checked at runtime)
2. **Authentication Check:** Calls `gh auth status` before every PR (network overhead)
3. **No Retry:** Single push attempt, single PR creation attempt (no resilience)
4. **Output Parsing:** Assumes PR URL on stdout (fragile if `gh` changes output format)

**Business Context:**
In autonomous agent workflows, PR creation is the handoff point from agent to human. The PR captures:
- Activity scope (all commits since branch creation)
- Activity metadata (title from activity.title, body from activity description)
- Reviewer assignment (future: could auto-assign based on CODEOWNERS)

**Failure Modes:**
1. **git push fails:** Network error → PR creation aborted (no retry)
2. **gh not installed:** Hard error with installation instructions
3. **Not authenticated:** Hard error with GH_AUTHENTICATED="false" reason
4. **Invalid scopes:** API call fails with 403 (no pre-validation of token scopes)

**Integration Flow:**
```
Local Commits
  ↓ git push -u origin <branch>
Remote Repository (GitHub)
  ↓ gh pr create
GitHub API (POST /repos/:owner/:repo/pulls)
  ↓ Response parsing
PR URL (stored in activity.stats.prURL)
```

**Security:**
- Token transmitted via gh CLI (HTTPS encrypted)
- Token scope required: `repo` (full access), `workflow` (Actions)
- No token validation for scope coverage (fails at API call time)

---

## Component 5: Activity.save() (Exit Point)

**Role in Flow:** Data persistence - In-memory activity state → File system storage

**Data Transformation:**
- Input: Activity.Info (complex object with prompts, commits, metadata)
- Output: JSON file at ~/.local/share/opencode/storage/activity/<activityId>.json

**Business Logic:**
This component persists activity state to enable:
- Session recovery after crashes
- Activity history browsing
- Metrics collection (success rates, durations)
- Learning loop (instructional state → functional state transformations)

**Design Decision:**
Cleans impulse content before storage (removes heavy fields from UNLOADED impulses) to prevent memory leak. This is a critical design decision driven by production issues where long-running sessions filled swap space.

**Why This Approach:**
- **Local-First:** Storage on local filesystem (no network dependency)
- **Human-Readable:** JSON format (debuggable, inspectable)
- **Atomic Writes:** Single `Bun.write()` call (OS-level atomic operation)
- **Versioned Schema:** Zod validation ensures backward compatibility

**Constraints:**
1. **Path Traversal Protection:** Validates key segments to prevent `../../etc/passwd` attacks
2. **Write Lock:** Uses `Lock.write("storage")` to prevent concurrent writes
3. **No Size Limit:** Could write 100MB JSON file (disk exhaustion risk)
4. **No Compression:** Large activities stored uncompressed (disk usage concern)

**Business Context:**
Activity storage serves multiple purposes:
1. **Crash Recovery:** Resume activities after pod restart
2. **Audit Trail:** Track what agent did and when
3. **Learning Loop:** Send activity data to Metabob backend for pattern learning
4. **Debugging:** Inspect activity state for failure analysis

**Storage Key Path:**
```
["activity", activityId]
  ↓
~/.local/share/opencode/storage/activity/<activityId>.json
```

**Persistence Strategy:**
- **Volume Mount:** In Kubernetes, `/workspace` is a PersistentVolumeClaim (5Gi per pod)
- **Durability:** Data survives pod restarts (not pod deletion)
- **Isolation:** Each pod has its own storage (no cross-pod sharing)

**Data Cleaning Logic (cleanImpulsesForStorage):**
- Removes `content` field from UNLOADED impulses
- Preserves LOADED impulses (needed for replay)
- Prevents storage leak from large impulse content (e.g., 2MB code files)

**Alternative Approaches Considered:**
- Database storage (PostgreSQL): Adds operational complexity
- Remote storage (S3): Network dependency, latency
- In-memory only: Loses history on restart

---

## Data Flow Summary

```
1. deploy-devbob-k8s-git.sh (Entry Point)
   ↓ Creates Kubernetes Secret + StatefulSet
   
2. entrypoint-self-config.sh (Authentication)
   ↓ Configures git/gh CLI, validates credentials
   
3. ActivityGit.commitPromptChanges() (Business Logic)
   ↓ Creates git commits per activity prompt
   
4. ActivityGit.createPR() (Integration)
   ↓ Pushes branch and creates GitHub PR
   
5. Activity.save() (Exit Point)
   ↓ Persists activity state to filesystem
```

---

## Critical Issues Identified

### Issue 1: Invalid Token Masking (Component 1)
**Location:** deploy-devbob-k8s-git.sh:46-49

**Problem:** Empty GITHUB_TOKEN input sets value to "none" instead of failing deployment.

**Impact:** Breaks entire git operations flow (components 2, 4 fail at runtime).

**Fix:** Fail deployment if token empty, or omit secret key entirely.

### Issue 2: No Retry Logic (Component 4)
**Location:** ActivityGit.createPR()

**Problem:** Single attempt for git push and PR creation (no resilience).

**Impact:** Transient network errors abort PR creation permanently.

**Fix:** Add `retryWithBackoff()` wrapper (like API client uses).

### Issue 3: Late Validation (Component 2)
**Location:** entrypoint-self-config.sh:150

**Problem:** Token validation happens after pod deployment (too late).

**Impact:** Invalid credentials detected at runtime, not deployment time.

**Fix:** Move validation to deployment script (component 1).

---

## Design Philosophy

The devbob-k8s-git-operations flow follows these principles:

1. **Autonomous Operation:** Agent should work without human intervention after deployment
2. **Graceful Degradation:** Container runs even with invalid git credentials (degraded mode)
3. **Fail Early:** Validate credentials before attempting git operations
4. **Idempotency:** All operations safe to retry (no duplicate commits, branches)
5. **Observability:** Log all operations with structured metadata
6. **Security:** Secrets managed by Kubernetes (encrypted at rest, RBAC-controlled)

However, the current implementation violates "Fail Early" by allowing deployment with invalid credentials.

