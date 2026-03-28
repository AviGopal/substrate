# DevBob K8s Git Operations - Architectural Boundaries Analysis

## Overview

This document analyzes all architectural boundaries in the git operations flow chain, documenting contracts, coupling levels, and resilience patterns. Understanding these boundaries is critical for maintaining autonomous vessel repository management.

---

## Boundary 1: Package Boundary - OpenCode Core Package

**Type:** Repository Boundary  
**Location:** `packages/opencode` | External Dependencies

### Contract

```json
// package.json
{
  "name": "opencode",
  "version": "1.0.64",
  "type": "module",
  "exports": {
    "./*": "./src/*.ts"
  },
  "dependencies": {
    "@opencode-ai/sdk": "0.5.1",        // SDK for client communication
    "@agentclientprotocol/sdk": "0.5.1", // ACP for multi-agent
    "@anthropic-ai/sdk": "0.39.0",      // Claude API
    "hono": "4.7.10",                    // HTTP framework
    "bun": "^1.1.45",                    // Runtime
    "zod": "3.24.5"                      // Schema validation
  }
}
```

### Coupling: Medium

**Internal Modules (Tight Coupling):**
- `session/activity-git.ts` → `project/instance.ts` (Context provider)
- `session/activity-git.ts` → `util/log.ts` (Logging)
- `session/activity-git.ts` → `tool/activity-errors.ts` (Error types)
- `session/prompts-runner.ts` → `session/activity-git.ts` (Git operations)

**External Dependencies (Loose Coupling):**
- Bun runtime: Shell execution via `$` template
- Git CLI: System command (not bundled)
- gh CLI: System command (not bundled)

### Resilience

**Error Handling:**
```typescript
// ActivityGitError wraps git failures
throw ActivityGitError.branchCreateFailed(name, reason)
throw ActivityGitError.workingTreeDirty(uncommittedFiles)
```

**Graceful Degradation:**
- Missing gh CLI: Error with installation instructions
- Git command failures: Structured error with reason

**Versioning:**
- ✅ Package version: Semver (1.0.64)
- ❌ No git CLI version check
- ❌ No gh CLI version check

### Concerns

1. **Tight Coupling to Bun Runtime:**
   - Uses Bun-specific `$` template for shell execution
   - Not portable to Node.js without changes

2. **No CLI Version Enforcement:**
   - Assumes git 2.x behavior
   - Assumes gh 2.x API
   - May break with major version changes

---

## Boundary 2: Layer Boundary - Session → Git Operations

**Type:** Layer Boundary  
**Location:** `session/prompts-runner.ts` | `session/activity-git.ts`

### Contract

```typescript
// Interface: ActivityGit namespace exports
export namespace ActivityGit {
  // Public API
  export function createBranch(name: string): Promise<void>
  export function getCurrentBranch(): Promise<string>
  export function getBaseCommit(): Promise<string>
  export function isWorkingTreeClean(): Promise<boolean>
  export function commitPromptChanges(opts: CommitOptions): Promise<CommitInfo | null>
  export function generateCommitMessage(opts: MessageOptions): Promise<string>
  export function createPR(opts: PROptions): Promise<string>
  export function getDiff(fromCommit: string, toCommit: string): Promise<string>
  
  // Type Contracts
  export interface CommitInfo {
    sha: string
    filesChanged: string[]
    timestamp: string
  }
  
  export interface CommitOptions {
    promptFile: string
    message: string
  }
  
  export interface PROptions {
    title: string
    body: string
    base?: string
  }
}
```

### Coupling: Medium

**Dependencies:**
- PromptsRunner → ActivityGit (one-way dependency)
- ActivityGit → Instance (context provider)
- ActivityGit → Log (logging)

**Characteristics:**
- ✅ Clear functional API (input/output well-defined)
- ✅ No circular dependencies
- ✅ Namespace encapsulation
- ⚠️ Implicit dependency on Instance context

### Resilience

**Error Handling:**
```typescript
// PromptsRunner catches ActivityGitError
try {
  await ActivityGit.createPR({ title, body })
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  UI.println(UI.Style.TEXT_DANGER + `✗ PR creation failed: ${msg}`)
  // Don't fail activity, PR is optional
}
```

**Retry Strategy:**
- No automatic retries
- Caller (PromptsRunner) decides whether to retry

**Validation:**
- ✅ Pre-conditions checked (working tree clean, branch unique)
- ✅ Post-conditions validated (commit SHA returned)

### Concerns

1. **Instance Context Required:**
   - ActivityGit.createBranch() calls `Instance.directory`
   - Fails if Instance context not initialized
   - No explicit context parameter (implicit dependency)

2. **No Transaction Support:**
   - Branch created but commit fails → orphaned branch
   - No rollback mechanism

---

## Boundary 3: Data Store Boundary - Storage Layer

**Type:** Data Store Boundary  
**Location:** `storage/storage.ts` | Filesystem

### Contract

```typescript
export namespace Storage {
  // CRUD Operations
  export async function read<T>(key: string[]): Promise<T>
  export async function write<T>(key: string[], content: T): Promise<void>
  export async function update<T>(key: string[], fn: (draft: T) => void): Promise<T>
  export async function remove(key: string[]): Promise<void>
  export async function list(prefix: string[]): Promise<string[][]>
  
  // Error Types
  export const NotFoundError: NamedError
}

// Storage Structure
// ~/.local/share/opencode/storage/
//   ├── activity/
//   │   └── {activityId}.json
//   ├── session/
//   │   └── {projectId}/
//   │       └── {sessionId}.json
//   ├── message/
//   │   └── {sessionId}/
//   │       └── {messageId}.json
//   └── activity-template/
//       └── {templateId}.json
```

### Coupling: Loose

**Dependencies:**
- Activity → Storage (one-way dependency)
- Session → Storage (one-way dependency)
- ActivityTemplate → Storage (one-way dependency)

**Storage Backend:**
- Implementation: Filesystem (JSON files)
- Location: `~/.local/share/opencode/storage/`
- Format: JSON (pretty-printed with 2-space indent)

### Resilience

**Error Handling:**
```typescript
async function withErrorHandling<T>(body: () => Promise<T>) {
  return body().catch((e) => {
    if (!(e instanceof Error)) throw e
    const errnoException = e as NodeJS.ErrnoException
    if (errnoException.code === "ENOENT") {
      throw new NotFoundError({ message: `Resource not found: ${errnoException.path}` })
    }
    throw e
  })
}
```

**Concurrency Control:**
```typescript
// Read Lock (shared)
using _ = await Lock.read(target)

// Write Lock (exclusive)
using _ = await Lock.write("storage")
```

**Migrations:**
- Versioned migrations (MIGRATIONS array)
- Migration state tracked in `storage/migration` file
- Runs on first access (lazy initialization)

### Concerns

1. **No Persistence Guarantee:**
   - Writes not fsync'd (may lose data on crash)
   - No write-ahead log
   - No atomic multi-file updates

2. **Scalability:**
   - Linear search for list() operations
   - No indexing
   - JSON parse/stringify on every read/write

3. **No Backup/Recovery:**
   - Single copy of data
   - No automatic backups
   - Manual recovery required

---

## Boundary 4: Service Boundary - OpenCode HTTP Server

**Type:** Service Boundary  
**Location:** `server/server.ts` | HTTP Clients

### Contract

```typescript
// Server Listen API
export namespace Server {
  export function listen(opts: {
    port: number
    hostname: string
  }): ServerInstance
  
  interface ServerInstance {
    url: URL
    hostname: string
    port: number
    stop(force?: boolean): Promise<void>
  }
}

// REST API Routes (OpenAPI)
POST   /api/session              - Create session
GET    /api/session/:id          - Get session info
POST   /api/session/:id/prompt   - Send prompt
GET    /api/session/:id/events   - SSE event stream

POST   /api/activity             - Create activity from template
GET    /api/activity/:id         - Get activity info

GET    /api/template             - List templates
GET    /api/template/:id         - Get template
```

### Coupling: Loose

**Framework:**
- Built on Hono (lightweight HTTP framework)
- OpenAPI spec generation (hono-openapi)
- CORS enabled (cross-origin requests)

**Client SDK:**
- `@opencode-ai/sdk` provides typed client
- Used by PromptsRunner for activity execution

### Resilience

**Error Handling:**
```typescript
// Standard error responses
400: Bad Request  - Validation errors
404: Not Found    - Resource missing
500: Server Error - Unhandled exceptions
```

**Graceful Shutdown:**
```typescript
// Stop server with optional force flag
await server.stop(force)  // Closes connections, stops server
```

**Event Streaming:**
```typescript
// SSE for real-time updates
GET /api/session/:id/events
  → text/event-stream
  → Automatic reconnection on disconnect
```

### Concerns

1. **Single-Process Model:**
   - No horizontal scaling
   - One server instance per container
   - No load balancing

2. **No Authentication:**
   - All endpoints public
   - Relies on container network isolation
   - No API keys or tokens

3. **No Rate Limiting:**
   - Vulnerable to abuse
   - No request throttling

---

## Boundary 5: External Service - GitHub API

**Type:** Service Boundary  
**Location:** `session/activity-git.ts` | GitHub API

### Contract

```bash
# gh CLI Commands Used
gh auth login --with-token          # Authentication
gh auth status                      # Check auth status
gh pr create --title --body --base  # Create PR
gh pr view --json                   # Get PR info
gh pr checkout                      # Checkout PR branch

# GitHub REST API (via gh CLI)
POST /repos/{owner}/{repo}/pulls
  → Create pull request
  → Returns: { url, number, ... }

GET /repos/{owner}/{repo}/pulls/{number}
  → Get pull request
  → Returns: { title, body, head, base, ... }
```

### Coupling: Tight

**Dependency:**
- gh CLI must be installed (system dependency)
- gh CLI must be authenticated (GITHUB_TOKEN)
- Network connectivity required

**Authentication Flow:**
```bash
# Entrypoint (container startup)
echo "$GITHUB_TOKEN" | gh auth login --with-token

# Stores auth in ~/.config/gh/hosts.yml
# Format:
# github.com:
#   user: username
#   oauth_token: ghp_...
#   git_protocol: https
```

### Resilience

**Error Handling:**
```typescript
// createPR() error handling
try {
  const result = await $`gh pr create --title ${opts.title} --body ${opts.body} --base ${base}`
  return result.trim()
} catch (error) {
  throw new Error(`Failed to create PR: ${error}`)
}
```

**Retry Strategy:**
- ❌ No automatic retries
- ❌ No exponential backoff
- ❌ No circuit breaker

**Authentication Check:**
```typescript
// Only checks if gh is installed, NOT if authenticated
async function checkGhCLI(): Promise<boolean> {
  try {
    await $`gh --version`.quiet()
    return true
  } catch {
    return false
  }
}
```

### Concerns

1. **No Auth Validation:**
   - Doesn't check `gh auth status` before PR creation
   - Fails at runtime with cryptic 401 error

2. **Rate Limiting:**
   - No handling of GitHub rate limits
   - No backoff on 429 responses

3. **Network Failures:**
   - No retry logic
   - No timeout configuration
   - No offline mode

4. **Token Expiration:**
   - No detection of expired tokens
   - No automatic token refresh

---

## Boundary 6: External Service - Metabob API

**Type:** Service Boundary  
**Location:** `api/activity-client.ts`, `util/metabob.ts` | Metabob RPC API

### Contract

```typescript
// Activity Execution API
POST /api/v1/activity-execution/content
  Body: ActivityContent {
    activity_id: string
    template_definition: { id, name, tasks, ... }
    variable_bindings: Record<string, any>
    initial_state: InitialState
    reason: string
    timestamp: number
  }
  Returns: { success: boolean }

POST /api/v1/activity-execution/tasks
  Body: TaskStartPayload {
    activity_id: string
    task_id: string
    task_definition: { id, description, ... }
    state_before: { git_commit, modified_files, ... }
    timestamp: number
  }
  Returns: { task_execution_id: string }

PATCH /api/v1/activity-execution/tasks/:id
  Body: TaskUpdatePayload {
    status: "completed" | "failed"
    state_after: { git_commit, modified_files, ... }
    state_delta: StateDelta
    validation_results: { passed, ... }
    duration_ms: number
  }
  Returns: { success: boolean }
```

### Coupling: Loose

**Configuration:**
```typescript
// From Config
metabob: {
  apiUrl: string            // METABOB_API_URL env var
  enabled: boolean          // Default: true if apiUrl set
  learningMode: boolean     // Default: true
}
```

**Client Characteristics:**
- Non-blocking: Errors logged as warnings
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Graceful degradation: Activity continues if backend unavailable

### Resilience

**Error Handling:**
```typescript
// ActivityAPIClient.postActivityContent()
async function postActivityContent(content: ActivityContent): Promise<void> {
  let attempts = 0
  const maxAttempts = 3
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${Config.metabob.apiUrl}/api/v1/activity-execution/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }
      
      log.info("Activity content posted successfully")
      return
    } catch (error) {
      attempts++
      if (attempts >= maxAttempts) {
        log.warn("Failed to post activity content after 3 attempts", { error })
        return  // Graceful degradation
      }
      await sleep(1000 * Math.pow(2, attempts - 1))  // Exponential backoff
    }
  }
}
```

**Graceful Degradation:**
- ✅ Activity execution continues even if backend unavailable
- ✅ Errors logged as warnings (not failures)
- ✅ No blocking on network I/O

**Retry Strategy:**
- ✅ 3 attempts with exponential backoff
- ✅ Backoff delays: 1s, 2s, 4s
- ⚠️ No circuit breaker (keeps retrying every activity)

### Concerns

1. **No Timeout Configuration:**
   - Fetch may hang indefinitely
   - No request timeout

2. **No Circuit Breaker:**
   - Continues retrying even if backend persistently down
   - No "open circuit" state to skip calls

3. **No Batch Operations:**
   - One HTTP request per task
   - High overhead for multi-task activities

---

## Boundary 7: Infrastructure Boundary - Kubernetes → Container

**Type:** Infrastructure Boundary  
**Location:** K8s StatefulSet | Container Runtime

### Contract

```yaml
# K8s Resource Spec
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: devbob
  namespace: metabob
spec:
  replicas: 3
  serviceName: devbob
  template:
    spec:
      containers:
      - name: devbob
        image: ghcr.io/metabob/devbob-local:latest
        env:
        - name: GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: devbob-secrets
              key: github-token
        - name: GIT_USER_NAME
          valueFrom:
            secretKeyRef:
              name: devbob-secrets
              key: git-user-name
        - name: GIT_USER_EMAIL
          valueFrom:
            secretKeyRef:
              name: devbob-secrets
              key: git-user-email
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: devbob-secrets
              key: anthropic-api-key
        - name: METABOB_API_URL
          value: http://metabob-rpc-api
        volumeMounts:
        - name: devbob-storage
          mountPath: /root/.local/share/opencode
  volumeClaimTemplates:
  - metadata:
      name: devbob-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### Coupling: Medium

**Dependencies:**
- K8s Secret: `devbob-secrets` must exist
- PVC: Persistent volume for storage
- Service: `metabob-rpc-api` for backend connectivity

**Environment Variables:**
- Required: ANTHROPIC_API_KEY (Claude API)
- Required: GITHUB_TOKEN (PR operations)
- Required: METABOB_API_URL (backend API)
- Optional: GIT_USER_NAME, GIT_USER_EMAIL (defaults provided)

### Resilience

**Pod Lifecycle:**
```bash
# Entrypoint Script (entrypoint-self-config.sh)
1. Check environment variables
2. Configure git (user.name, user.email)
3. Authenticate gh CLI (gh auth login)
4. Run health checks
5. Start OpenCode server
```

**Health Checks:**
```yaml
# Not configured in current deployment
# Should add:
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

**Persistence:**
- ✅ Storage volume persists across pod restarts
- ✅ Git config persists in volume
- ❌ gh auth does NOT persist (stored in ~/.config/gh, not in volume)

### Concerns

1. **No Health Checks:**
   - No liveness probe (pod may be running but unhealthy)
   - No readiness probe (traffic sent to unready pods)

2. **gh Auth Not Persisted:**
   - `~/.config/gh/hosts.yml` stored in container filesystem (ephemeral)
   - Pod restart requires re-authentication
   - Should mount volume for `~/.config/gh`

3. **Secret Rotation:**
   - Updating secret requires pod restart
   - No automatic rollout on secret change
   - Manual intervention needed

---

## Boundary 8: Process Boundary - Bun Runtime → System Commands

**Type:** Process Boundary  
**Location:** `session/activity-git.ts` | Shell Commands

### Contract

```typescript
// Bun $ Template
import { $ } from "bun"

// Execute shell command with options
await $`git checkout -b ${branchName}`
  .cwd(Instance.directory)    // Working directory
  .quiet()                    // Suppress stdout
  .text()                     // Return stdout as string
  .nothrow()                  // Don't throw on non-zero exit
```

### Coupling: Tight

**System Commands Used:**
```bash
# Git Operations
git checkout -b ${branch}              # Create branch
git branch --show-current              # Get branch name
git rev-parse HEAD                     # Get commit SHA
git status --porcelain                 # Check status
git add .                              # Stage changes
git commit -m ${message}               # Create commit
git diff --cached --name-only          # List staged files
git diff --name-only HEAD~1            # List changed files
git push -u origin ${branch}           # Push branch
git symbolic-ref refs/remotes/origin/HEAD  # Get default branch

# GitHub CLI Operations
gh --version                           # Check gh installed
gh auth login --with-token             # Authenticate
gh auth status                         # Check auth status
gh pr create --title --body --base     # Create PR
```

### Resilience

**Error Handling:**
```typescript
// Capture exit code and stdout/stderr
const result = await $`git checkout -b ${name}`.nothrow()
if (result.exitCode !== 0) {
  throw ActivityGitError.branchCreateFailed(name, result.stderr)
}
```

**Timeout:**
- ❌ No timeout configuration
- ❌ Long-running commands may hang
- ❌ No cancellation mechanism

**Working Directory:**
```typescript
// Always specify working directory
await $`git status`.cwd(Instance.directory)
```

### Concerns

1. **No Command Validation:**
   - Doesn't check if git/gh is installed before use
   - Assumes commands available in PATH

2. **No Version Checking:**
   - Assumes git 2.x behavior
   - Assumes gh 2.x API
   - May break with major version changes

3. **No Sandboxing:**
   - Commands run with full container permissions
   - No resource limits (CPU, memory)
   - No syscall filtering

---

## Cross-Cutting Concerns

### 1. Error Handling Patterns

**Consistent Pattern:**
```typescript
// Try-catch with structured errors
try {
  await operationThatMayFail()
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  log.error("Operation failed", { error: msg })
  throw ActivityGitError.operationFailed(msg)
}
```

**Graceful Degradation:**
- Metabob API: Continues on failure
- PR Creation: Logs error, marks activity complete
- Storage: Throws NotFoundError (caller handles)

### 2. Logging Standards

**Log Levels:**
```typescript
log.debug("Detailed trace info")
log.info("Normal operation")
log.warn("Recoverable issue")
log.error("Operation failed")
```

**Structured Logging:**
```typescript
log.info("created commit", {
  sha: commitInfo.sha,
  filesChanged: commitInfo.filesChanged.length
})
```

### 3. Configuration Management

**Sources (Priority Order):**
1. Environment variables (highest)
2. opencode.json file
3. Default values (lowest)

**Example:**
```typescript
Config.git.userName = process.env.GIT_USER_NAME || "Devbob Agent"
Config.metabob.apiUrl = process.env.METABOB_API_URL || undefined
```

### 4. Concurrency Control

**Storage Layer:**
- Read locks (shared): Multiple readers
- Write locks (exclusive): Single writer
- Automatic lock release (using disposables)

**Activity Execution:**
- Sequential prompt execution (no parallelism)
- Single activity per branch (branch name collision prevents parallel)

---

## Boundary Violations and Technical Debt

### 1. Instance Context Implicit Dependency

**Problem:**
```typescript
// activity-git.ts
await $`git status`.cwd(Instance.directory)
//                       ^^^^^^^^^^^^^^^^^ Implicit dependency
```

**Why it's a problem:**
- ActivityGit functions fail if Instance context not initialized
- No explicit parameter for directory
- Hard to unit test

**Better Design:**
```typescript
// Explicit directory parameter
export function createBranch(directory: string, name: string): Promise<void> {
  await $`git checkout -b ${name}`.cwd(directory)
}
```

### 2. No Abstraction for Shell Execution

**Problem:**
```typescript
// Tight coupling to Bun $ template
await $`git status`.cwd(dir).quiet().text()
```

**Why it's a problem:**
- Not portable to Node.js
- Hard to mock for testing
- No retry logic
- No timeout handling

**Better Design:**
```typescript
// Shell abstraction
interface ShellExecutor {
  exec(cmd: string, opts: ExecOptions): Promise<ExecResult>
}

class BunShellExecutor implements ShellExecutor {
  async exec(cmd: string, opts: ExecOptions): Promise<ExecResult> {
    // Bun implementation
  }
}

class NodeShellExecutor implements ShellExecutor {
  async exec(cmd: string, opts: ExecOptions): Promise<ExecResult> {
    // Node.js implementation (child_process)
  }
}
```

### 3. No Service Discovery for Metabob API

**Problem:**
```typescript
// Hardcoded URL from env var
const apiUrl = Config.metabob.apiUrl  // "http://metabob-rpc-api"
```

**Why it's a problem:**
- Assumes K8s service name
- No failover if service unavailable
- No load balancing across replicas

**Better Design:**
```typescript
// Service discovery with failover
class MetabobClient {
  private endpoints: string[]
  
  async discover(): Promise<void> {
    // Query K8s API for service endpoints
    this.endpoints = await k8sServiceLookup("metabob-rpc-api")
  }
  
  async post(path: string, body: any): Promise<Response> {
    for (const endpoint of this.endpoints) {
      try {
        return await fetch(`${endpoint}${path}`, { method: "POST", body })
      } catch (error) {
        continue  // Try next endpoint
      }
    }
    throw new Error("All endpoints failed")
  }
}
```

---

## Recommendations

### High Priority

1. **Add Authentication Check Before PR Creation:**
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

2. **Persist gh Auth in Volume:**
   ```yaml
   # k8s-devbob-statefulset.yaml
   volumeMounts:
   - name: devbob-storage
     mountPath: /root/.local/share/opencode
   - name: devbob-storage
     mountPath: /root/.config/gh          # Add this
     subPath: gh-config                   # Separate subdir
   ```

3. **Add Health Check Endpoints:**
   ```typescript
   // server/server.ts
   app.get("/health", (c) => {
     // Check git available, gh authenticated, storage accessible
     return c.json({ status: "healthy" })
   })
   
   app.get("/ready", (c) => {
     // Check services reachable (Metabob API, Anthropic API)
     return c.json({ status: "ready" })
   })
   ```

### Medium Priority

4. **Add Retry Logic for GitHub Operations:**
   ```typescript
   async function withRetry<T>(
     fn: () => Promise<T>,
     maxAttempts = 3,
     backoff = 1000
   ): Promise<T> {
     let attempts = 0
     while (attempts < maxAttempts) {
       try {
         return await fn()
       } catch (error) {
         attempts++
         if (attempts >= maxAttempts) throw error
         await sleep(backoff * Math.pow(2, attempts - 1))
       }
     }
     throw new Error("Unreachable")
   }
   
   // Usage
   const prUrl = await withRetry(() => 
     $`gh pr create --title ${opts.title} --body ${opts.body}`
   )
   ```

5. **Add Circuit Breaker for Metabob API:**
   ```typescript
   class CircuitBreaker {
     private failures = 0
     private state: "closed" | "open" | "half-open" = "closed"
     private threshold = 5
     
     async execute<T>(fn: () => Promise<T>): Promise<T> {
       if (this.state === "open") {
         throw new Error("Circuit breaker open")
       }
       
       try {
         const result = await fn()
         this.onSuccess()
         return result
       } catch (error) {
         this.onFailure()
         throw error
       }
     }
     
     private onSuccess() {
       this.failures = 0
       this.state = "closed"
     }
     
     private onFailure() {
       this.failures++
       if (this.failures >= this.threshold) {
         this.state = "open"
         setTimeout(() => { this.state = "half-open" }, 60000)
       }
     }
   }
   ```

### Low Priority

6. **Abstract Shell Execution:**
   - Create ShellExecutor interface
   - Implement BunShellExecutor and NodeShellExecutor
   - Add retry/timeout logic at abstraction layer

7. **Add Telemetry:**
   - Track git operation durations
   - Track PR creation success rates
   - Alert on high failure rates

---

## Summary

### Boundary Health

| Boundary | Type | Coupling | Resilience | Status |
|----------|------|----------|------------|--------|
| Package | Repository | Medium | Good | ✅ Healthy |
| Session → Git | Layer | Medium | Good | ✅ Healthy |
| Storage | Data Store | Loose | Good | ✅ Healthy |
| HTTP Server | Service | Loose | Fair | ⚠️ Needs health checks |
| GitHub API | Service | Tight | Poor | ❌ **CRITICAL** |
| Metabob API | Service | Loose | Good | ✅ Healthy |
| K8s → Container | Infrastructure | Medium | Fair | ⚠️ Needs persistence |
| Bun → Shell | Process | Tight | Fair | ⚠️ Needs abstraction |

### Critical Issues

1. **GitHub API Boundary (BLOCKER):**
   - No authentication check before PR creation
   - No retry logic for transient failures
   - No token expiration detection

2. **K8s → Container Boundary:**
   - gh auth not persisted (lost on pod restart)
   - No health checks
   - Secret rotation requires manual intervention

3. **Process Boundary:**
   - No timeout for shell commands
   - No version checking for git/gh
   - Tight coupling to Bun runtime

### Quick Wins

- ✅ Add `checkGhAuthenticated()` before PR creation (5 min fix)
- ✅ Persist gh config in volume (10 min K8s change)
- ✅ Add health check endpoints (30 min dev)

### Long-Term Improvements

- Abstract shell execution for portability
- Add circuit breaker for external services
- Implement service discovery for Metabob API
- Add comprehensive telemetry and alerting
