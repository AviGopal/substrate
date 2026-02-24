# DevBob Deployment - Data Transformation Analysis

## Overview

This document provides detailed analysis of every data transformation in the deployment workflow, including type conversions, validation rules, business logic, side effects, and the **why** behind each transformation.

---

## Chain 1: Boredom Activity Execution (Vessel Updates)

### Transformation 1: Session Start → Manager Instance
**Component:** `BoredomManager.startMonitoring()`  
**File:** `boredom-manager.ts:46-67`

**What:**
```typescript
// Input
sessionID: string

// Transformation
const manager: ManagerInstance = {
  sessionID,
  lastActivityTime: Date.now(),
  isExecutingBoredomActivity: false,
}

// Output
ManagerInstance stored in Map<string, ManagerInstance>
```

**Why:**
- **Business Requirement:** Track idle time per session independently
- **Technical Reason:** Map structure allows O(1) lookup for activity tracking
- **Design Decision:** `Date.now()` gives timestamp in milliseconds for precise idle calculation

**Validations:**
- ✓ Check if session already being monitored (prevents duplicate timers)
- ✓ Timer automatically starts (30s interval)

**Side Effects:**
- Creates `setInterval` timer (stored in `manager.checkTimer`)
- Adds entry to `sessionManagers` Map
- Logs info message

---

### Transformation 2: Current Time → Idle State
**Component:** `BoredomManager.isIdle()`  
**File:** `boredom-manager.ts:155-158`

**What:**
```typescript
// Input
manager: ManagerInstance {
  lastActivityTime: number  // Unix timestamp in ms
}

// Transformation
const idleTime = Date.now() - manager.lastActivityTime
const isIdle = idleTime >= IDLE_THRESHOLD_MS  // 5 * 60 * 1000 = 300000ms

// Output
boolean (true if idle >= 5 minutes)
```

**Why:**
- **Business Requirement:** Only execute work during genuine idle time (5+ minutes no activity)
- **Constraint:** Prevents interrupting active user sessions
- **Alternative Considered:** Event-based approach (rejected: requires more complex state management)

**Validations:**
- ✓ Threshold hardcoded at 5 minutes (prevents accidental short-duration triggers)
- ✓ Uses millisecond precision (accurate idle detection)

**Side Effects:** None (pure function)

---

### Transformation 3: Backend Response → BoredomActivity[]
**Component:** `BoredomManager.fetchBoredomActivities()`  
**File:** `boredom-manager.ts:163-198`

**What:**
```typescript
// Input (MCP Tool Call)
{
  name: "metabob_fetch_boredom_activities",
  arguments: {
    max_activities: 5,
    priority_threshold: 0.6,
    exclude_recent_hours: 24
  }
}

// Backend Response (JSON-RPC)
{
  content: [{
    type: "text",
    text: JSON.stringify({
      status: "success",
      activities: [
        {
          activity_type: "improve-template",
          priority: 0.85,
          template_id: "update-vessel-opencode-binary",
          improvement_gradient: 0.3,
          reason: "Success rate dropped from 95% to 80%",
          estimated_effort: "15-20 minutes",
          metrics: {
            success_rate: 0.8,
            avg_cost: 0.15,
            avg_duration_ms: 45000,
            execution_count: 20,
            failure_patterns: [...]
          }
        }
      ]
    })
  }]
}

// Transformation: Extract and Parse
const data = JSON.parse(result.content[0].text)
return data.activities as BoredomActivity[]

// Output
BoredomActivity[] sorted by priority (descending)
```

**Why:**
- **Business Requirement:** Backend AI ranks work by improvement potential (learning loop)
- **Priority Threshold (0.6):** Focus on medium-low quality templates (high-quality ones don't need improvement)
- **Exclude Recent (24h):** Prevent thrashing on recently-worked templates
- **Max Activities (5):** Limit context to top candidates

**Validations:**
- ✓ Check `result.content` is array (MCP protocol validation)
- ✓ Check `firstContent.type === "text"` (content type validation)
- ✓ JSON parse with try/catch (malformed response handling)
- ✓ Check `data.status === "success"` (backend status validation)
- ✓ Check `Array.isArray(data.activities)` (data structure validation)

**Side Effects:**
- Logs debug/warn on unexpected responses
- Returns empty array on error (graceful degradation, continues monitoring)

**Error Handling Philosophy:**
- Never throw - errors return empty array
- Monitoring continues even if backend unavailable
- Defensive parsing (multiple validation layers)

---

### Transformation 4: BoredomActivity → Activity Variables
**Component:** `BoredomManager.executeBoredomActivity()`  
**File:** `boredom-manager.ts:226-234`

**What:**
```typescript
// Input
boredomActivity: BoredomActivity {
  metrics: {
    success_rate: 0.8,
    avg_cost: 0.15,
    avg_duration_ms: 45000,
    execution_count: 20,
    failure_patterns: [
      { pattern: "Checksum verification failed", count: 3 }
    ],
    performance_trends: {
      cost: { trend: "increasing", rate: 0.05 }
    },
    last_execution: {
      timestamp: "2026-02-24T10:00:00Z",
      success: false,
      error: "Download timeout"
    }
  }
}

// Transformation: Flatten + JSON.stringify
const variables: Record<string, unknown> = {
  success_rate: 0.8,                                                    // number (direct copy)
  avg_cost: 0.15,                                                       // number (direct copy)
  avg_duration_ms: 45000,                                               // number (direct copy)
  execution_count: 20,                                                  // number (direct copy)
  failure_patterns: "[{\"pattern\":\"Checksum...\",\"count\":3}]",     // string (JSON serialized)
  performance_trends: "{\"cost\":{\"trend\":\"increasing\"...}}",      // string (JSON serialized)
  last_execution: "{\"timestamp\":\"2026-02-24T10:00:00Z\"...}"        // string (JSON serialized)
}

// Output
Record<string, unknown> for template variable interpolation
```

**Why:**
- **Business Requirement:** Template prompts need access to all metrics for intelligent improvements
- **JSON Serialization:** Complex objects (arrays, nested objects) must be stringified for Handlebars interpolation
- **Primitive Pass-Through:** Numbers stay as numbers for arithmetic operations in prompts
- **Fallback to Empty:** `|| []` and `|| {}` prevent null/undefined from breaking JSON.stringify

**Validations:**
- ✓ Check `boredomActivity.metrics` exists (defensive access)
- ✓ JSON.stringify with fallbacks (prevents stringify(undefined))

**Side Effects:** None (pure transformation)

**Design Rationale:**
- Handlebars can interpolate primitives directly: `{{success_rate}}`
- Complex objects must be JSON strings: `{{failure_patterns}}` → template does `JSON.parse()`
- Alternative (rejected): Pass raw objects → doesn't work with Handlebars variable system

---

### Transformation 5: Activity Execution → Backend Report
**Component:** `BoredomManager.executeBoredomActivity()` (Step 7)  
**File:** `boredom-manager.ts:277-299`

**What:**
```typescript
// Input
result: {
  activityId: "act_abc123",
  success: true,
  cancelled: false,
  error?: string
}

activity: Activity {
  stats: {
    cost: { total: 0.18 },
    tokens: {
      input: 8500,
      output: 1200,
      cache: { read: 15000 }
    }
  }
}

duration: number  // Date.now() - startTime

// Transformation: Flatten and Extract
{
  activity_id: "act_abc123",
  template_id: "update-vessel-opencode-binary",
  success: true,
  duration: 45123,  // milliseconds
  cost: 0.18,       // dollars
  tokens: {
    input: 8500,
    output: 1200,
    cache: 15000    // Flattened from cache.read
  },
  cancelled: false
}

// Output (MCP Tool Call)
metabob_post_activity_result({ ... })
```

**Why:**
- **Business Requirement:** Backend learning loop needs execution metrics to update template rankings
- **Success Rate Calculation:** Backend uses success/failure to compute moving average
- **Cost Tracking:** Used to estimate effort and ROI for future work
- **Token Tracking:** Helps predict future execution costs
- **Cancellation Flag:** Distinguishes user-interrupted from genuine failures

**Validations:**
- ✓ Fallback to 0 if `activity.stats` is undefined (incomplete execution)
- ✓ Flatten `cache.read` to `cache` (backend expects flat structure)

**Side Effects:**
- MCP tool call to backend (async, doesn't block)
- Logs info on success, error on failure
- Failure to report does **not** throw (continues monitoring)

**Error Handling Philosophy:**
- Reporting failures don't crash the boredom loop
- Log errors but continue monitoring
- Backend eventually consistent (missed reports don't break system)

---

### Transformation 6: File Content → SHA-256 Checksum
**Component:** `VesselUpdateManager.computeChecksum()`  
**File:** `vessel/update.ts:248-261`

**What:**
```typescript
// Input
filePath: string  // e.g., "/tmp/opencode-new"

// Transformation
const content = await readFile(filePath)     // Buffer (binary data)
const hash = createHash("sha256")            // Crypto hash instance
hash.update(content)                         // Feed binary data
const checksum = hash.digest("hex")          // Hex string output

// Output
string  // "a1b2c3d4e5f6..." (64 hex characters = 256 bits / 4 bits per char)
```

**Why:**
- **Business Requirement:** Verify binary integrity after download (prevent corrupted/tampered binaries)
- **SHA-256 Choice:** Industry standard, cryptographically secure, collision-resistant
- **Hex Encoding:** Human-readable, easy to compare, standard for checksums

**Validations:**
- ✓ Try/catch with detailed error logging (file read errors)
- ✓ Re-throws error (checksum failure should abort update)

**Side Effects:**
- Reads entire file into memory (potential issue for multi-GB files)
- CPU-intensive for large files (hashing is O(n) in file size)

**Performance Considerations:**
- OpenCode binary: ~50MB → ~200ms hashing time
- metabob-cli venv: N/A (Python source, not checksummed as single file)

---

### Transformation 7: Version Tracking File → VersionTracking Object
**Component:** `VesselUpdateManager.getCurrentVersions()`  
**File:** `vessel/update.ts:181-238`

**What:**
```typescript
// Input (File: /workspace/.vessel-versions.json)
{
  "current": {
    "opencode": {
      "name": "opencode",
      "version": "1.0.64",
      "checksum": "sha256:a1b2c3...",
      "downloadUrl": "https://github.com/.../opencode-linux-x64"
    },
    "metabob-cli": {
      "name": "metabob-cli",
      "version": "0.5.2",
      "checksum": "sha256:d4e5f6...",
      "downloadUrl": "https://pypi.org/.../metabob-cli-0.5.2.tar.gz"
    }
  },
  "history": [
    {
      "vessel": "opencode",
      "version": "1.0.64",
      "timestamp": "2026-02-24T10:00:00Z",
      "source": "github",
      "reason": "Critical bug fix for MCP stdio"
    }
  ]
}

// Transformation: Parse + Validate + Normalize
const content = await readFile(filePath, "utf-8")
const data = JSON.parse(content)

// Validation
if (!data || typeof data !== "object") {
  return emptyTracking  // { current: {}, history: [] }
}

// Normalization
const tracking: VersionTracking = {
  current: data.current || {},
  history: Array.isArray(data.history) ? data.history : []
}

// Output
VersionTracking {
  current: Record<string, VesselVersion>
  history: VesselUpdateRecord[]
}
```

**Why:**
- **Business Requirement:** Track current vessel versions for update decisions
- **History Tracking:** Audit trail for debugging and rollback
- **Graceful Degradation:** Missing file returns empty structure (fresh installs)
- **Data Normalization:** Ensures `current` is object and `history` is array

**Validations:**
- ✓ Check file exists (ENOENT → empty tracking)
- ✓ JSON.parse with SyntaxError catch (corrupted file → empty tracking)
- ✓ Type check `typeof data === "object"` (malformed JSON)
- ✓ Normalize `current` to `{}` if missing
- ✓ Normalize `history` to `[]` if not array

**Side Effects:**
- Logs debug/info/error based on outcome
- Returns empty structure on any error (never throws)

**Error Handling Philosophy:**
- File not found is expected (fresh installations)
- Corruption is rare but handled gracefully
- Empty tracking allows system to continue (vessel updates will populate file)

**Alternative Approaches Considered:**
- Throw on missing file → Rejected: breaks fresh installations
- Use database storage → Rejected: adds dependency, file is simpler
- Version in container env vars → Rejected: tracking file is single source of truth

---

## Chain 2: Activity Template Registration

### Transformation 8: Template Name → Template ID
**Component:** `ActivityTemplate.create()` → `generateTemplateID()`  
**File:** `activity-template.ts:1104-1115`

**What:**
```typescript
// Input
name: string

// Examples
"Update Vessel Binary"      → "update-vessel-binary"
"Fix TypeScript Errors v2"  → "fix-typescript-errors"
"Test Template (v3)"        → "test-template"
"My-Cool_Template  "        → "my-cool-template"
"Fix Bug!!!"                → "fix-bug"

// Transformation Algorithm
function generateTemplateID(name: string): string {
  return name
    .toLowerCase()                        // "Update Vessel Binary" → "update vessel binary"
    .replace(/\s*\(v\d+\)\s*/gi, "")     // Remove "(v2)" → "update vessel binary"
    .replace(/\s*v\d+\s*/gi, "")         // Remove "v2" → "update vessel binary"
    .replace(/[^a-z0-9]+/g, "-")         // Replace non-alphanumeric with "-" → "update-vessel-binary"
    .replace(/^-|-$/g, "")               // Remove leading/trailing "-" → "update-vessel-binary"
}

// Output
string (kebab-case ID)
```

**Why:**
- **Business Requirement:** Human-readable template names → machine-readable IDs
- **Uniqueness:** Name collisions prevented by duplicate check after ID generation
- **Version Stripping:** "Fix Bug v2" and "Fix Bug v3" → same ID (versions tracked separately in genealogy)
- **URL Safety:** Kebab-case is URL-safe, filesystem-safe, and human-readable

**Validations:**
- ✓ Post-generation duplicate check with `await exists(id)`
- ✓ Throws error if duplicate found (forces user to choose different name)

**Side Effects:**
- Calls `exists(id)` which queries storage (async I/O)
- Throws error on duplicate (blocks registration)

**Design Rationale:**
- **Why strip versions:** Templates evolve (v2, v3), but base name stays same
- **Why kebab-case:** Industry standard (npm packages, URLs, filenames)
- **Why not UUIDs:** Human-readability matters for debugging and logs
- **Why not preserve case:** Case-insensitive filesystems (macOS) cause issues

**Alternative Approaches Considered:**
- UUID IDs → Rejected: not human-readable
- Preserve case → Rejected: filesystem issues
- Include version in ID → Rejected: genealogy system tracks versions separately

---

### Transformation 9: Template JSON → CreateOptions (Zod Parse)
**Component:** `ActivityTemplate.CreateOptions.parse()`  
**File:** `activity-template.ts` (Zod schema definition)

**What:**
```typescript
// Input (Raw JSON)
{
  name: "Update Vessel Binary",
  description: "Download and install new vessel binaries",
  category: "infrastructure",
  tasks: [
    {
      id: "check-version",
      subagent: "general",
      description: "Check current version",
      dependencies: [],
      prompt: {
        template: "Run: VesselUpdateManager.getCurrentVersions()",
        maxTokens: 8000,  // Optional: defaults applied
        compressionStrategy: "filter",
        variables: []
      },
      validation: {
        requiredFiles: [],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: []
      },
      retry: {
        maxAttempts: 3,
        strategy: "simple"
      }
    }
  ],
  integration: {
    preChecks: [],
    postChecks: [],
    qualityGates: []
  },
  metabob: {
    enabled: true,
    learningMode: true,
    targetContextTokens: 5000,
    annotationStrategy: "key-components"
  }
}

// Transformation: Zod Parse (validation + defaults)
const parsed = CreateOptions.parse(json)

// Output (Validated CreateOptions)
{
  name: "Update Vessel Binary",
  description: "Download and install new vessel binaries",
  category: "infrastructure",  // Validated: one of ["feature", "bugfix", "refactor", "tool", "infrastructure"]
  tasks: [
    {
      id: "check-version",
      subagent: "general",  // Validated: one of allowed subagents
      description: "Check current version",
      dependencies: [],
      prompt: {
        template: "Run: VesselUpdateManager.getCurrentVersions()",
        maxTokens: 8000,  // Default applied if missing
        compressionStrategy: "filter",  // Validated: "filter" | "summarize"
        variables: []
      },
      validation: {
        requiredFiles: [],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: []
      },
      retry: {
        maxAttempts: 3,  // Default: 3
        strategy: "simple"  // Validated: "simple" | "backoff"
      }
    }
  ],
  integration: {
    preChecks: [],
    postChecks: [],
    qualityGates: []
  },
  metabob: {
    enabled: true,
    learningMode: true,
    targetContextTokens: 5000,  // Default: 5000
    annotationStrategy: "key-components"  // Validated: "key-components" | "all"
  }
}
```

**Why:**
- **Business Requirement:** Ensure template structure is valid before registration
- **Type Safety:** Zod enforces TypeScript types at runtime (critical for JSON input)
- **Default Values:** Sensible defaults reduce boilerplate (e.g., maxTokens: 8000)
- **Enum Validation:** Category, strategy, etc. must be from allowed values

**Validations:**
- ✓ **Required Fields:** `name`, `description`, `category`, `tasks` must exist
- ✓ **Task Structure:** Each task must have `id`, `subagent`, `description`, `prompt`
- ✓ **Enum Validation:** `category` ∈ ["feature", "bugfix", "refactor", "tool", "infrastructure"]
- ✓ **Enum Validation:** `compressionStrategy` ∈ ["filter", "summarize"]
- ✓ **Enum Validation:** `retry.strategy` ∈ ["simple", "backoff"]
- ✓ **Number Ranges:** `maxTokens` > 0, `maxAttempts` > 0
- ✓ **Array Types:** `dependencies` is string[], `variables` is Variable[]

**Side Effects:**
- Throws `ZodError` on validation failure (detailed error with field paths)
- Applies default values (mutates object)

**Default Values Applied:**
- `prompt.maxTokens` → 8000
- `retry.maxAttempts` → 3
- `retry.strategy` → "simple"
- `metabob.targetContextTokens` → 5000
- `metabob.annotationStrategy` → "key-components"

**Error Messages:**
```typescript
// Example validation errors
{
  issues: [
    {
      path: ["tasks", 0, "prompt", "compressionStrategy"],
      message: "Invalid enum value. Expected 'filter' | 'summarize', received 'compress'"
    },
    {
      path: ["category"],
      message: "Invalid enum value. Expected 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure', received 'devops'"
    }
  ]
}
```

**Design Rationale:**
- **Why Zod over manual validation:** Type safety + runtime validation in one
- **Why defaults here:** Centralized default logic (DRY principle)
- **Why enums:** Prevents typos ("featur" vs "feature"), enables autocomplete

---

### Transformation 10: Impulse Pointer → Template JSON
**Component:** `RegisterActivityTemplateTool.execute()` (Impulse Path)  
**File:** `register-activity-template.ts:58-93`

**What:**
```typescript
// Input (Impulse ID)
params: {
  impulse_id: "my-template-def"
}

// Step 1: Determine Storage Scope
const sessionID = ctx.sessionID  // "sess_abc123" or undefined
const scope = sessionID ? "session" : "activity"

// Step 2: Build Storage Key
const impulseKey = scope === "session"
  ? ["impulse-session", sessionID, params.impulse_id]
  : ["impulse-activity", params.impulse_id]

// Examples:
// Session-scoped: ["impulse-session", "sess_abc123", "my-template-def"]
// Activity-scoped: ["impulse-activity", "my-template-def"]

// Step 3: Load Impulse from Storage
const impulse = await Storage.read<ActivityTemplate.Impulse.Schema>(impulseKey)

// Impulse Structure
{
  id: "my-template-def",
  type: "templateDefinition",
  pointer: {
    type: "templateDefinition",
    definition: {
      name: "Update Vessel Binary",
      description: "...",
      category: "infrastructure",
      tasks: [...]
    },
    source: "conversation"  // "memory" | "conversation" | "agent"
  },
  budget: 2000,
  priority: "high",
  loaded: false,
  scope: "session",
  sessionID: "sess_abc123"
}

// Step 4: Validate Pointer Type
if (impulse.pointer.type !== "templateDefinition") {
  throw new Error(`Expected "templateDefinition", got "${impulse.pointer.type}"`)
}

// Step 5: Extract Definition
json = impulse.pointer.definition

// Output (Raw Template JSON)
{
  name: "Update Vessel Binary",
  description: "...",
  category: "infrastructure",
  tasks: [...]
}
```

**Why:**
- **Business Requirement:** Support template registration from memory/conversation (no temp files)
- **Impulse System:** Serializable pointers enable cross-agent communication
- **Scope Separation:** Session impulses isolated from activity impulses
- **Storage Key Design:** Hierarchical keys enable efficient queries

**Validations:**
- ✓ Check `params.impulse_id` provided (validated by Zod)
- ✓ Storage.read() throws if impulse not found (explicit error)
- ✓ Type guard: `impulse.pointer.type === "templateDefinition"` (prevents wrong impulse type)

**Side Effects:**
- Storage read (async I/O)
- Throws error on missing impulse (blocks registration)
- Throws error on wrong impulse type (blocks registration)

**Design Rationale:**
- **Why scope-based storage:** Prevents session impulses leaking into activities
- **Why hierarchical keys:** Enables bulk operations (delete all session impulses)
- **Why pointer validation:** Impulse system supports many pointer types, must ensure correct one

**Error Messages:**
```typescript
// Missing impulse
"Failed to load impulse my-template-def: Impulse not found in storage"

// Wrong type
"Impulse my-template-def is type \"file\", expected \"templateDefinition\""
```

---

### Transformation 11: Template + Test Variables → Validation Result
**Component:** `RegisterActivityTemplateTool.execute()` (Validation Path)  
**File:** `register-activity-template.ts:120-182`

**What:**
```typescript
// Input
template: ActivityTemplate {
  id: "update-vessel-opencode-binary",
  name: "Update Vessel Binary",
  tasks: [...]
}

test_variables: {
  current_version: "1.0.64",
  latest_version: "1.0.65",
  download_url: "https://...",
  checksum: "sha256:..."
}

// Step 1: Temporarily Save Template (required for ActivityTool)
await TemplateRepository.save(template, ["local"])

// Step 2: Execute Template with Test Variables
const startTime = Date.now()
const result = await ActivityTool.execute({
  templateId: template.id,
  variables: test_variables,
  reason: "Template validation execution before registration"
}, ctx)

const duration = Date.now() - startTime

// Step 3: Extract Metrics from Execution Result
result: {
  metadata: {
    status: "done" | "failed",
    cost: { total: 0.05 },
    tokens: { input: 2500, output: 300, cache: 0 },
    error?: string
  }
}

// Transformation: Flatten and Extract
validationResult = {
  success: result.metadata.status === "done",  // Boolean conversion
  duration: 15234,                             // Elapsed ms
  cost: 0.05,                                  // Fallback to 0
  tokens: { input: 2500, output: 300, cache: 0 },  // Fallback to zeros
  error: result.metadata.error                 // Optional error message
}

// Step 4: If Failed, Clean Up and Throw
if (!validationResult.success) {
  await TemplateRepository.remove(template.id, ["local"])
  throw new Error(`Template validation failed: ${validationResult.error}`)
}

// Step 5: Update Template with Initial Metrics
await TemplateRepository.updateMetrics(template.id, {
  executions: 1,
  successRate: 1.0,      // 100% success (1/1)
  avgDuration: 15234,
  avgCost: 0.05,
  avgTokens: { input: 2500, output: 300, cache: 0 }
})

// Output
{
  success: true,
  duration: 15234,
  cost: 0.05,
  tokens: { input: 2500, output: 300, cache: 0 }
}
```

**Why:**
- **Business Requirement:** Prevent broken templates from being registered
- **Initial Success Metrics:** Templates start with 100% success rate (1/1 execution)
- **Backend Ranking:** Templates with executions > 0 preferred over untested templates
- **Fail-Fast:** Validation catches issues before production use

**Validations:**
- ✓ Check `test_variables` provided if `validate_before_register=true`
- ✓ Execute full activity flow (all tasks, all validations)
- ✓ Check `result.metadata.status === "done"` (success criteria)

**Side Effects:**
- Temporary template storage (local only)
- Full activity execution (may modify files, call APIs)
- Template removal on failure (cleanup)
- Metrics update on success (modifies template)

**Design Rationale:**
- **Why test execution:** Static validation can't catch runtime issues
- **Why 100% initial success:** Reflects actual test result (1 success, 0 failures)
- **Why clean up on failure:** Prevents broken templates in storage
- **Why optional:** Developers may want to register experimental templates

**Performance Impact:**
- Adds execution time to registration (15-60 seconds typical)
- Increases cost (small: $0.01-0.10 per validation)
- Benefit: Prevents production failures (worth the cost)

**Alternative Approaches Considered:**
- Dry-run mode → Rejected: doesn't catch all issues (side effects matter)
- Manual testing → Rejected: error-prone, developers skip it
- Required validation → Rejected: blocks experimental template creation

---

## Chain 3: Container Orchestration

### Transformation 12: Environment Variables → OpenCode Config JSON
**Component:** `entrypoint.sh` (Config Processing)  
**File:** `entrypoint.sh:68-158`

**What:**
```typescript
// Input (Environment Variables)
ANTHROPIC_API_KEY="sk-ant-api03-..."
OPENAI_API_KEY="sk-..."
METABOB_API_URL="http://metabob-rpc-api-server:8080"
METABOB_PROJECT_ID="proj_abc123"

// Input (Template Config with Placeholders)
OPENCODE_CONFIG="/tmp/opencode-template.json"
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "${ANTHROPIC_API_KEY}"
      }
    },
    "openai": {
      "options": {
        "apiKey": "${OPENAI_API_KEY:-}"
      }
    }
  },
  "mcp": {
    "metabob": {
      "url": "${METABOB_API_URL}",
      "projectId": "${METABOB_PROJECT_ID}"
    }
  }
}

// Transformation: envsubst (Environment Variable Substitution)
SUBSTITUTED_CONFIG="/tmp/opencode-config-$(date +%s).json"
envsubst < "$OPENCODE_CONFIG" > "$SUBSTITUTED_CONFIG"

// Output (Processed Config)
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "sk-ant-api03-..."
      }
    },
    "openai": {
      "options": {
        "apiKey": "sk-..."
      }
    }
  },
  "mcp": {
    "metabob": {
      "url": "http://metabob-rpc-api-server:8080",
      "projectId": "proj_abc123"
    }
  }
}

// Validation: JSON Syntax Check
if jq empty "$SUBSTITUTED_CONFIG" >/dev/null 2>&1; then
  export OPENCODE_CONFIG="$SUBSTITUTED_CONFIG"
  log_ok "Config processed (env vars substituted)"
else
  log_warn "Config substitution produced invalid JSON, using original"
fi
```

**Why:**
- **Business Requirement:** Runtime configuration injection (same image, multiple environments)
- **Security:** Secrets in env vars, not baked into image
- **Docker Best Practice:** 12-factor app (config via environment)
- **Flexibility:** Single image works for dev/staging/prod

**Validations:**
- ✓ Check if config has placeholders: `grep -q '\${' "$OPENCODE_CONFIG"`
- ✓ JSON syntax validation: `jq empty "$SUBSTITUTED_CONFIG"`
- ✓ Fallback to original if substitution produces invalid JSON

**Side Effects:**
- Creates temporary file: `/tmp/opencode-config-<timestamp>.json`
- Exports `OPENCODE_CONFIG` env var (OpenCode reads this)
- Logs success/warning messages

**Design Rationale:**
- **Why envsubst:** Standard Unix tool, simple, no dependencies
- **Why validate with jq:** Prevents OpenCode from reading malformed JSON
- **Why fallback:** Graceful degradation (continue with original if substitution fails)
- **Why timestamp in filename:** Prevents race conditions if multiple containers start simultaneously

**envsubst Syntax:**
- `${VAR}` → Replace with value, error if undefined
- `${VAR:-default}` → Replace with value, use default if undefined
- `${VAR:+value}` → Use value if VAR is set, empty otherwise

**Alternative Approaches Considered:**
- Config templating tool (gomplate, confd) → Rejected: extra dependency
- OpenCode reads env vars directly → Rejected: doesn't support complex config structures
- Config from backend API → Rejected: chicken-egg problem (need config to connect to backend)

---

### Transformation 13: Backend Health Endpoint → Ready State
**Component:** `entrypoint.sh` (Backend Health Check)  
**File:** `entrypoint.sh:163-176`

**What:**
```bash
# Input
METABOB_API_URL="http://metabob-rpc-api-server:8080"

# Configuration
BACKEND_URL="${METABOB_API_URL}/health"
MAX_RETRIES=30
RETRY_INTERVAL=2  # seconds

# Transformation: Poll Loop
for i in $(seq 1 $MAX_RETRIES); do
  # HTTP Request
  response=$(curl -sf "$BACKEND_URL" 2>&1)
  exit_code=$?
  
  # State Transition
  if [ $exit_code -eq 0 ]; then
    # Success: HTTP 200, valid response
    ready=true
    break
  fi
  
  # Check if exhausted retries
  if [ $i -eq $MAX_RETRIES ]; then
    ready=false
    exit 1  # Fail container startup
  fi
  
  # Wait and retry
  sleep $RETRY_INTERVAL
done

# Output
ready: boolean (true → continue startup, false → exit 1)
```

**Why:**
- **Business Requirement:** Ensure backend is ready before starting devbob containers
- **Dependency Coordination:** Backend must be healthy for MCP tools to work
- **Fail-Fast:** Exit container startup if backend never becomes ready
- **Retry Strategy:** 30 attempts × 2 seconds = 60 seconds max wait

**Validations:**
- ✓ HTTP status 200 (curl -f flag)
- ✓ Silent mode (curl -s flag)
- ✓ Timeout after 60 seconds (fail-fast)

**Side Effects:**
- HTTP requests to backend (30 max)
- Logs info/warn messages
- Exits with code 1 on failure (stops container)

**Design Rationale:**
- **Why 30 retries:** Backend typically ready in 10-20 seconds (30 gives buffer)
- **Why 2 second interval:** Balance between fast startup and not spamming backend
- **Why fail on timeout:** Better to fail loudly than start with broken backend connection
- **Why curl -sf:** Silent mode (-s) + fail on HTTP error (-f)

**HTTP Response Expected:**
```json
{
  "status": "healthy",
  "services": {
    "redis": "connected",
    "surrealdb": "connected"
  }
}
```

**Alternative Approaches Considered:**
- Exponential backoff → Rejected: fixed interval simpler for 60s window
- Continue without backend → Rejected: containers would fail anyway (MCP tools need backend)
- Docker healthcheck instead of script → Used in compose, this is redundant check

---

## Summary: Key Transformation Patterns

### Pattern 1: Defensive Parsing (Never Throw on External Data)
**Examples:**
- `fetchBoredomActivities()` → Returns `[]` on error
- `getCurrentVersions()` → Returns empty tracking on missing file
- Backend response parsing → Multiple validation layers

**Why:** External systems fail, network is unreliable, files get corrupted

---

### Pattern 2: Graceful Degradation (Continue with Reduced Functionality)
**Examples:**
- Boredom activities unavailable → Continue monitoring
- Backend unreachable → Log warning, continue startup
- Config substitution fails → Use original config

**Why:** Partial functionality better than complete failure

---

### Pattern 3: JSON Serialization for Complex Data
**Examples:**
- BoredomActivity metrics → JSON strings for Handlebars
- Activity stats → Backend report
- Template genealogy → Storage format

**Why:** Handlebars/APIs require strings, storage requires serialization

---

### Pattern 4: Validation at Boundaries (Parse, Don't Validate)
**Examples:**
- Zod parse on template JSON
- MCP response type guards
- Docker config JSON validation

**Why:** Type safety at runtime, fail-fast on bad input

---

### Pattern 5: Normalization to Expected Structure
**Examples:**
- Version tracking: `current || {}`, `history || []`
- Token flattening: `cache.read` → `cache`
- Template ID generation: Name → kebab-case

**Why:** Consistent internal representation, easier to work with

---

## Conclusion

Every transformation serves a specific business requirement:
1. **Type Safety:** Zod validation, type guards
2. **Data Integrity:** Checksum verification, JSON validation
3. **Human Readability:** Template name → ID, logs
4. **System Reliability:** Graceful degradation, retry logic
5. **Learning Loop:** Metrics reporting, success tracking
6. **Security:** Env var substitution, no secrets in images
7. **Operational Efficiency:** Idle detection, automated updates

The deployment system balances **correctness** (validation, checksums) with **robustness** (graceful degradation, retries) to create a reliable automated workflow.
