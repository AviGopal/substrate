# Component Annotations - DevBob Container Deployment Workflow

## Status

**CPG Indexing:** Components not yet indexed by Metabob CPG  
**Annotation Method:** Manual documentation based on comprehensive code analysis

---

## Critical Component Annotations

### 1. Entry Point: BoredomManager.startMonitoring()

**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`  
**Component:** `startMonitoring(sessionID: string)`  
**Role:** Entry point for automated vessel updates and template improvements

**Annotation:**

```
BoredomManager.startMonitoring() handles session initialization in devbob container 
deployment and activity updates flow. It is the entry point that enables automated 
vessel binary updates and template improvements during idle time.

Data transformation: 
  Input: sessionID (string)
  Output: ManagerInstance stored in sessionManagers Map
  Side effect: Creates 30-second interval timer for idle detection

Business logic:
  - Enforces 5-minute idle threshold before executing work
  - Prevents duplicate monitoring (checks if session already monitored)
  - Tracks lastActivityTime for idle calculation
  - Executes only one boredom activity at a time per session

Design decision:
  - Uses in-memory Map for O(1) session lookup (performance)
  - 30-second check interval balances responsiveness vs. CPU usage
  - 5-minute idle threshold prevents interrupting active users
  - Interval timer approach chosen over event-driven for simplicity
  
Constraints:
  - Memory leak: Sessions never cleaned up (Issue #7 identified)
  - No timeout on activity execution (Issue #4 identified)
  - Single-threaded: One activity per session at a time
  
Critical for deployment:
  - Must fix memory leak before long-running production containers
  - Must add timeout (30 min recommended) to prevent hanging
  - This is the automation entry point for vessel updates
```

---

### 2. Main Business Logic: BoredomManager.executeBoredomActivity()

**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`  
**Component:** `executeBoredomActivity(manager: ManagerInstance, boredomActivity: BoredomActivity)`  
**Role:** Core orchestration logic for executing vessel updates and template improvements

**Annotation:**

```
BoredomManager.executeBoredomActivity() handles execution orchestration in devbob 
container deployment and activity updates flow. It transforms backend AI recommendations 
into concrete activity executions (e.g., vessel binary updates).

Data transformation:
  Input: BoredomActivity (priority, template_id, metrics, reason)
  Output: Activity execution result (success, cost, tokens, duration)
  Key transformation: BoredomActivity.metrics → Activity variables (JSON stringify)

Business logic:
  - Loads activity template from TemplateRepository
  - Extracts variables from boredom activity metrics (flattens complex objects)
  - Creates Activity instance with "[BOREDOM]" prefix for tracking
  - Executes activity using ActivityTool.execute() with abort signal
  - Reports execution results to backend for learning loop
  - Updates session idle time on activity completion

Design decision:
  - JSON.stringify for complex metrics (failure_patterns, performance_trends)
    Reason: Handlebars templates require string interpolation
  - AbortController for cancellation support
    Reason: Allows user to interrupt long-running updates
  - Graceful error handling (log and continue)
    Reason: Boredom loop should never crash the session
  - Backend reporting is async fire-and-forget
    Reason: Don't block on reporting failures

Constraints:
  - No input validation on BoredomActivity structure (Issue #1)
  - No timeout on activity execution (Issue #4)
  - Single activity at a time per session
  - Metrics must be JSON-serializable
  
Critical for deployment:
  - Add Zod validation before using boredomActivity.metrics
  - Add 30-minute timeout to abort controller
  - This orchestrates vessel binary updates (update-vessel-opencode-binary template)
```

---

### 3. Integration Boundary: VesselUpdateManager.getCurrentVersions()

**File:** `repos/metabob-opencode/packages/opencode/src/vessel/update.ts`  
**Component:** `getCurrentVersions(filePath?: string): Promise<VersionTracking>`  
**Role:** Read-through cache and version tracking for vessel binary updates

**Annotation:**

```
VesselUpdateManager.getCurrentVersions() handles version tracking boundary crossing 
in devbob container deployment and activity updates flow. It provides single source 
of truth for current vessel versions (opencode, metabob-cli).

Data transformation:
  Input: filePath (default: "/workspace/.vessel-versions.json")
  Output: VersionTracking { current: Record<string, VesselVersion>, history: VesselUpdateRecord[] }
  Normalization: Missing file → empty tracking, corrupted data → empty tracking

Business logic:
  - Enforces version tracking schema (name, version, checksum, downloadUrl)
  - Maintains audit trail via history array
  - Graceful degradation on missing/corrupted file (fresh installs)
  - No validation of checksum format (assumes SHA-256 hex)

Design decision:
  - File-based storage chosen over database
    Reason: Simple, no dependencies, workspace-specific
  - Graceful return of empty tracking on errors
    Reason: Fresh installations have no tracking file (expected)
  - JSON format with pretty-print
    Reason: Human-readable for debugging
  - Separate current + history
    Reason: Fast current lookup, full audit trail

Constraints:
  - Race condition on concurrent updates (Issue #2)
  - No file locking mechanism
  - Single tracking file per workspace
  - No rollback automation (manual process)
  
Critical for deployment:
  - Add file locking with Lock.acquire() before read-modify-write
  - This is read by update-vessel-opencode-binary template to decide if update needed
  - Checksum verification critical for security (Issue #6)
```

---

### 4. Core Transform: RegisterActivityTemplateTool.execute()

**File:** `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`  
**Component:** `execute(params: RegisterParams, ctx: ToolContext)`  
**Role:** Activity template registration and distribution across local + backend storage

**Annotation:**

```
RegisterActivityTemplateTool.execute() handles template registration in devbob 
container deployment and activity updates flow. It transforms raw template JSON 
into validated, versioned templates distributed to local storage and Metabob backend.

Data transformation:
  Input: Template JSON (from file or impulse) + options
  Output: Registered template with generated ID
  Key transformations:
    1. Template name → kebab-case ID ("Update Vessel Binary" → "update-vessel-binary")
    2. Raw JSON → Zod-validated CreateOptions
    3. Optional: Template + test vars → validation execution result
    4. Single template → multi-backend storage (local + Metabob)

Business logic:
  - Enforces template ID uniqueness (throws on duplicate)
  - Validates template structure with Zod (required fields, enums, types)
  - Optional test execution before registration (validate_before_register)
  - Dual storage: Local (.metabob/activities/) + Backend (via MCP)
  - Test execution starts template with 100% success rate (1/1)

Design decision:
  - ID generation from name (not UUID)
    Reason: Human-readable IDs for debugging and logs
  - Version stripping in ID ("v2" removed)
    Reason: Genealogy system tracks versions separately
  - Impulse support in addition to file
    Reason: No temp files needed, works in any environment
  - Optional validation execution
    Reason: Prevents broken templates, but doesn't block experimental work
  - Dual storage (local + backend)
    Reason: Local for bootstrap, backend for discovery and learning

Constraints:
  - No retry on backend registration failure (Issue #8)
  - Duplicate ID check only on registration (not on name change)
  - Test variables must match template schema exactly
  - Backend registration is optional (can be local-only)
  
Critical for deployment:
  - Use validate_before_register=true for production templates
  - This registers update-vessel-opencode-binary and configure-vessel-for-environment
  - Add retry logic for backend registration (3 attempts, exponential backoff)
```

---

### 5. Exit Point: docker/entrypoint.sh (Container Startup)

**File:** `docker/entrypoint.sh`  
**Component:** Main script execution  
**Role:** Container orchestration and service startup with environment configuration

**Annotation:**

```
entrypoint.sh handles container initialization in devbob container deployment and 
activity updates flow. It orchestrates multi-service startup (dashboard, ACP, MCP) 
with runtime configuration injection.

Data transformation:
  Input: Environment variables (ANTHROPIC_API_KEY, METABOB_API_URL, etc.)
  Output: Three running services (metabob-cli dashboard, opencode ACP, metabob-cli MCP)
  Key transformation: $OPENCODE_CONFIG with ${VAR} placeholders → concrete JSON via envsubst

Business logic:
  - Enforces required environment variables (API keys, backend URL, project ID)
  - Validates backend availability before starting devbob services
  - Processes opencode config with environment variable substitution
  - Starts services in correct order (dashboard → ACP)
  - Implements fail-fast (exit on service failure)
  - Graceful shutdown via cleanup trap

Design decision:
  - envsubst for config processing
    Reason: Standard Unix tool, no dependencies, simple
  - Backend health check with 60s timeout
    Reason: Backend must be ready for MCP tools to work
  - Multi-service architecture (3 processes)
    Reason: Dashboard for monitoring, ACP for agent communication, MCP for tools
  - Fail-fast on service exit
    Reason: Better to restart container than run with broken services
  - Config validation with jq
    Reason: Catch JSON errors before OpenCode reads config

Constraints:
  - No validation of substituted values (Issue #3 - security risk)
  - Magic numbers for health check (30 retries, 2s interval)
  - Single container, multiple processes (not Kubernetes-native)
  - Services must bind to 0.0.0.0 (not localhost)
  
Critical for deployment:
  - Add jq validation after envsubst to prevent JSON injection
  - This is the runtime entry point for all devbob containers
  - Environment variable validation prevents startup failures
  - Health check ensures backend is available before vessel updates
```

---

## Summary of Critical Components

### Workflow Flow

```
1. Container Startup (entrypoint.sh)
   ↓
   Process env vars → Start services (dashboard, ACP, MCP)
   ↓
2. Session Initialization (BoredomManager.startMonitoring)
   ↓
   Create manager → Start idle detection timer
   ↓
3. Idle Detection & Execution (BoredomManager.executeBoredomActivity)
   ↓
   Fetch priorities → Load template → Execute activity
   ↓
4. Vessel Update Check (VesselUpdateManager.getCurrentVersions)
   ↓
   Read tracking → Compare versions → Decide update
   ↓
5. Template Distribution (RegisterActivityTemplateTool.execute)
   ↓
   Validate → Generate ID → Save local + backend
```

### Annotated Components

| # | Component | File | Role | Priority |
|---|-----------|------|------|----------|
| 1 | startMonitoring() | boredom-manager.ts | Entry point | HIGH |
| 2 | executeBoredomActivity() | boredom-manager.ts | Orchestration | HIGH |
| 3 | getCurrentVersions() | vessel/update.ts | Version tracking | HIGH |
| 4 | execute() | register-activity-template.ts | Template distribution | HIGH |
| 5 | entrypoint.sh | docker/entrypoint.sh | Container startup | HIGH |

### Key Design Decisions Documented

1. **Idle Detection:** 30-second interval, 5-minute threshold (balance responsiveness vs. CPU)
2. **Version Tracking:** File-based (simple, no dependencies)
3. **Template IDs:** Generated from names (human-readable)
4. **Config Processing:** envsubst (standard, no dependencies)
5. **Error Handling:** Graceful degradation (log and continue)

### Identified Constraints

1. **Memory Leak:** Sessions never cleaned up (Issue #7)
2. **Race Condition:** Concurrent version updates (Issue #2)
3. **Missing Validation:** BoredomActivity structure (Issue #1)
4. **Missing Timeout:** Activity execution (Issue #4)
5. **Security Risk:** Unvalidated envsubst (Issue #3)

### Deployment Readiness

**Components are functional but need 5 critical fixes before production:**
1. Add Zod validation to BoredomManager.fetchBoredomActivities()
2. Add file locking to VesselUpdateManager
3. Validate config after envsubst in entrypoint.sh
4. Add timeout to BoredomManager.executeBoredomActivity()
5. Implement checksum verification in vessel update template

**Estimated effort:** 1-2 days to fix all blocking issues

---

## Annotations Not Created (CPG Unavailable)

The following annotations could not be created via `metabob_annotate_component` 
because the CPG has not indexed these files. The annotations above serve as 
comprehensive manual documentation until CPG indexing is complete.

**Workaround:** This document provides equivalent annotation content that would 
have been stored in the Metabob backend. It can be referenced by:
1. Creating the boredom activity templates
2. Understanding deployment workflow
3. Debugging issues in production
4. Onboarding new developers

**When CPG is available:** Use `metabob_annotate_component` with exact component 
names to store these annotations in the database.
