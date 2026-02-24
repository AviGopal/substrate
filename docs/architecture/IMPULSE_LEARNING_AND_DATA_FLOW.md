# Impulse Learning and Data Flow Architecture

## Executive Summary

**Core Innovation**: Impulses are **pointers, not content** - enabling lazy-loaded, cross-task data passing with automatic learning about what context is actually needed.

**Key Benefits**:
- **Minimal Overhead**: Pass thousands of impulses with KB of memory (not GB)
- **Lazy Loading**: Content resolved only when referenced in prompts
- **Cross-Boundary**: Share data between tasks, activities, agents, and plugins
- **Learning Loop**: Track which impulses are used to improve future suggestions
- **Plugin Integration**: Arbitrary plugin data fits naturally into impulse system

---

## Ontological Context

Impulses enable data flow within the **process-of-becoming** as it manifests through vessels (like OpenCode). They represent the continuous transformation through three states:

- **Vessel (Instructional)** → **Becoming (Transient)** → **Instance (Functional)**

See [ONTOLOGY_OF_BECOMING.md](./ONTOLOGY_OF_BECOMING.md) for the foundational three-state model.

---

## 1. The Pointer Model

### 1.1 Core Concept

```typescript
// NOT THIS (content caching):
const context = {
  authModule: fs.readFileSync("src/auth.ts", "utf-8"),  // 10KB
  userModel: fs.readFileSync("src/models/user.ts", "utf-8"),  // 5KB
  tests: fs.readFileSync("tests/auth.test.ts", "utf-8")  // 8KB
}
// Total: 23KB in memory

// THIS (pointer model):
const context = {
  impulses: [
    { id: "auth-module", pointer: { type: "file", path: "src/auth.ts" }, budget: 3000 },
    { id: "user-model", pointer: { type: "file", path: "src/models/user.ts" }, budget: 2000 },
    { id: "auth-tests", pointer: { type: "file", path: "tests/auth.test.ts" }, budget: 2500 }
  ]
}
// Total: <1KB in memory, content loaded lazily
```

**When content is loaded**:
```typescript
// Agent prompt references impulse
const prompt = `
Implement authentication using {{auth-module}} and {{user-model}}.
Reference {{auth-tests}} for expected behavior.
`

// Resolver loads ONLY referenced impulses
const resolvedPrompt = await resolveImpulseReferences(prompt, context.impulses)
// Loads: auth-module (3000 tokens), user-model (2000 tokens)
// Skips: auth-tests (not referenced in this prompt)
```

---

### 1.2 14 Pointer Types

From `activity-template.ts`:

```typescript
export const Pointer = z.discriminatedUnion("type", [
  // Filesystem
  z.object({ type: z.literal("file"), path: z.string() }),
  
  // Code Components
  z.object({ type: z.literal("component"), file: z.string(), name: z.string() }),
  
  // Activity Outputs
  z.object({ type: z.literal("activityOutput"), activityId: z.string(), taskId: z.string() }),
  z.object({ type: z.literal("activityArtifact"), activityId: z.string(), artifactPath: z.string() }),
  
  // Command Execution
  z.object({ type: z.literal("bashOutput"), command: z.string() }),
  
  // Code Quality
  z.object({ type: z.literal("metabobIssue"), issueId: z.string() }),
  z.object({ type: z.literal("metabobAnnotation"), file: z.string(), component: z.string() }),
  
  // Templates
  z.object({ type: z.literal("templateDefinition"), templateId: z.string() }),
  z.object({ type: z.literal("activityRecommendation"), recommendationId: z.string() }),
  
  // Delegation
  z.object({ type: z.literal("remoteSession"), sessionId: z.string(), hostUrl: z.string() }),
  
  // Git
  z.object({ type: z.literal("gitDiff"), fromCommit: z.string(), toCommit: z.string() }),
  z.object({ type: z.literal("gitLog"), fromCommit: z.string().optional(), limit: z.number().optional() }),
  
  // Static Content
  z.object({ type: z.literal("memo"), content: z.string() }),
  
  // Plugin Extensibility
  z.object({ type: z.literal("custom"), resolver: z.string(), data: z.any() })
])
```

**Design Principle**: Each pointer type represents a **resolution strategy**, not a content format.

---

### 1.3 Impulses and the Three-State Ontology

Impulses enable the **process-of-becoming** by connecting the three states:

- **Vessel → Becoming**: Activity templates define which impulses to gather (instructional state)
- **Becoming**: Impulses are resolved lazily as tasks execute (transient transformation)
- **Instance → Vessel**: Task outcomes become new impulses for subsequent executions (learning loop)

The pointer model is essential because the **becoming is continuous** - we don't cache static state, we execute fresh resolution to reflect the living, changing codebase. Each execution is a new manifestation of the becoming.

**Key Principle**: Impulses are not data transfer objects - they are **resolution instructions** that ensure each instance draws from the current state of the world.

---

## 2. Learning What Impulses Are Needed

### 2.1 Memory Agent Context Gathering

**Location**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**Flow**:
```typescript
// 1. User sends request
user: "Implement user authentication"

// 2. Memory agent analyzes intent
const analysis = await MemoryAgent.analyze({
  intent: "implement user authentication",
  recentHistory: session.messages,
  codebase: session.cwd,
  activeFiles: session.editedFiles
})

// 3. Memory agent suggests impulses
const suggestions = analysis.impulses
// [
//   {
//     id: "auth-module",
//     pointer: { type: "file", path: "src/auth.ts" },
//     priority: "high",
//     budget: 3000,
//     reason: "Core authentication logic, 15 dependents"
//   },
//   {
//     id: "user-model",
//     pointer: { type: "component", file: "src/models/user.ts", name: "User" },
//     priority: "medium",
//     budget: 2000,
//     reason: "User model referenced in auth.ts"
//   },
//   {
//     id: "past-auth-issues",
//     pointer: { type: "metabobAnnotation", file: "src/auth.ts", component: "authenticate" },
//     priority: "low",
//     budget: 1500,
//     reason: "Past design decisions to avoid repeating mistakes"
//   }
// ]

// 4. Session manager creates impulses
for (const suggestion of suggestions) {
  await session.createImpulse(suggestion)
}

// 5. Agent receives impulse POINTERS (not content)
// Content loaded lazily during prompt construction
```

**Learning Sources**:

1. **CPG Impact Scoring** (`repos/metabob-cli/metabob_cli/cpg`):
   ```python
   def get_impact_score(file_path: str) -> float:
       """Calculate impact based on dependency graph"""
       dependents = cpg.get_dependents(file_path)
       dependencies = cpg.get_dependencies(file_path)
       
       score = (
           len(dependents) * 0.6 +  # Files that depend on this
           len(dependencies) * 0.2 +  # Files this depends on
           centrality_score(file_path) * 0.2  # Graph centrality
       )
       
       return min(score / 100, 1.0)  # Normalize to 0-1
   ```

2. **Metabob Annotations** (`metabob_annotate_component`):
   ```typescript
   // Past annotations influence future suggestions
   const annotations = await Metabob.getAnnotations(file, component)
   if (annotations.length > 0) {
     impulse.metadata.pastDecisions = annotations.map(a => ({
       reason: a.reason,
       timestamp: a.timestamp,
       author: a.author
     }))
     impulse.priority = "high"  // Historical context is valuable
   }
   ```

3. **Co-Change Patterns** (`metabob_suggest_related_changes`):
   ```typescript
   // Files that change together
   const cochanges = await Metabob.getCoChangePatterns(changedFiles)
   for (const relatedFile of cochanges) {
     suggestions.push({
       id: `cochange-${relatedFile.path}`,
       pointer: { type: "file", path: relatedFile.path },
       priority: "medium",
       budget: 2000,
       reason: `Co-changes with ${changedFiles.join(", ")} in ${relatedFile.frequency}% of commits`
     })
   }
   ```

4. **Session History** (Recent Activity):
   ```typescript
   // Files modified in last 10 messages
   const recentFiles = session.messages
     .slice(-10)
     .flatMap(m => m.toolCalls?.filter(t => t.tool === "edit").map(t => t.input.filePath))
     .filter(Boolean)
   
   for (const file of recentFiles) {
     suggestions.push({
       id: `recent-${file}`,
       pointer: { type: "file", path: file },
       priority: "high",
       budget: 3000,
       reason: "Recently modified in this session"
     })
   }
   ```

---

### 2.2 CPG Impulse Prioritization

**Location**: `docs/cpg/CPG_IMPULSE_PRIORITIZATION_ANALYSIS.md`

**Integration**:
```typescript
// Enrich impulse with CPG impact data
async function enrichImpulse(impulse: Impulse): Promise<Impulse> {
  if (impulse.pointer.type === "file") {
    const impactData = await MetabobCLI.analyzeChangeImpact(impulse.pointer.path)
    
    impulse.metadata.cpgImpact = {
      impactScore: impactData.impactScore,  // 0.0 - 1.0
      impactLevel: impactData.impactLevel,  // "low" | "medium" | "high"
      directDependents: impactData.directDependents,
      transitiveDependents: impactData.transitiveDependents,
      totalDependents: impactData.totalDependents
    }
    
    // Adjust priority based on impact
    if (impactData.impactLevel === "high") {
      impulse.priority = "high"
      impulse.budget = Math.max(impulse.budget, 4000)  // Increase budget for critical files
    }
  }
  
  return impulse
}
```

**Example Output**:
```json
{
  "id": "auth-module",
  "pointer": { "type": "file", "path": "src/auth.ts" },
  "priority": "high",
  "budget": 4000,
  "metadata": {
    "cpgImpact": {
      "impactScore": 0.85,
      "impactLevel": "high",
      "directDependents": 15,
      "transitiveDependents": 42,
      "totalDependents": 57
    }
  }
}
```

**Result**: Infrastructure components (auth, database, sessions) automatically get **higher priority and larger budgets**.

---

### 2.3 Impulse Usage Tracking

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts` lines 78-87

**Schema**:
```typescript
export const UsageStats = z.object({
  loadCount: z.number(),       // How many times this impulse was loaded
  totalCost: z.number(),        // Cumulative token cost
  totalTokens: z.number(),      // Total tokens consumed
  firstAccessedAt: z.number(),  // Timestamp of first load
  lastAccessedAt: z.number()    // Timestamp of last load
})
```

**Tracking Flow**:
```typescript
// 1. Task loads impulses
const impulses = task.impulses
for (const impulse of impulses) {
  impulse.usageStats.loadCount++
  impulse.usageStats.lastAccessedAt = Date.now()
}

// 2. Task executes, agent references some impulses in prompt
const prompt = `Implement auth using {{auth-module}}`
// References: auth-module
// Skips: user-model, auth-tests

// 3. After task, report usage
await Metabob.reportImpulseUsageForStep(
  activityId,
  taskId,
  impulses,  // All loaded impulses
  ["auth-module"],  // Only impulses referenced in prompt/output
  "success"
)
```

**Backend Processing** (`repos/metabob-opencode/packages/opencode/src/util/metabob.ts` lines 897-1040):
```typescript
export async function reportImpulseUsageForStep(
  activityId: string,
  taskId: string,
  impulses: Impulse[],
  used: string[],  // IDs of impulses referenced
  outcome: "success" | "failure"
): Promise<void> {
  
  // Correlate impulse usage with task outcome
  for (const impulse of impulses) {
    const wasUsed = used.includes(impulse.id)
    
    await MetabobBackend.recordImpulseUsage({
      activityId,
      taskId,
      impulseId: impulse.id,
      impulseType: impulse.pointer.type,
      loaded: true,
      used: wasUsed,
      outcome,
      tokenCount: impulse.usageStats.totalTokens,
      cost: impulse.usageStats.totalCost
    })
  }
  
  // Backend learns:
  // - For task type X, impulses Y and Z are critical (high usage, success)
  // - Impulse W is noise (loaded but never used)
  // - Impulse V is harmful (used but correlates with failure)
}
```

**Learning Outcomes**:
```json
{
  "templateId": "implement-authentication",
  "impulsePatterns": {
    "auth-module": {
      "loadRate": 0.95,
      "useRate": 0.90,
      "successCorrelation": 0.85,
      "verdict": "CRITICAL"
    },
    "user-model": {
      "loadRate": 0.80,
      "useRate": 0.60,
      "successCorrelation": 0.70,
      "verdict": "HELPFUL"
    },
    "auth-tests": {
      "loadRate": 0.70,
      "useRate": 0.10,
      "successCorrelation": 0.45,
      "verdict": "NOISE"
    }
  }
}
```

**Memory Agent Adaptation**:
```typescript
// Future suggestions prioritize learned patterns
const learnedPatterns = await Metabob.getImpulsePatterns(templateId)

for (const [impulseType, stats] of Object.entries(learnedPatterns)) {
  if (stats.verdict === "CRITICAL") {
    suggestions.push({ ...impulse, priority: "high", budget: 4000 })
  } else if (stats.verdict === "NOISE") {
    // Skip suggesting this impulse
    continue
  }
}
```

---

## 3. Arbitrary Data in Impulses

### 3.1 Custom Pointers (Plugin Extensibility)

**Pattern**: Plugins register custom resolvers for their data types.

**Example 1: Playwright Screenshot**
```typescript
// Plugin output → Impulse
const screenshotResult = await PlaywrightMCP.screenshot({ name: "login-page", savePng: true })

const impulse = {
  id: "login-screenshot",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "playwright-screenshot",  // Plugin-specific resolver
    data: {
      sessionId: screenshotResult.sessionId,
      path: screenshotResult.path,
      base64: screenshotResult.base64.substring(0, 100) + "..."  // Truncated for efficiency
    }
  },
  budget: 500,
  priority: "high"
}

// Register resolver
ImpulseResolver.registerResolver("playwright-screenshot", async (pointer) => {
  const data = pointer.data
  
  // Option 1: Inline base64 (small images)
  if (data.base64 && data.base64.length < 50000) {
    return `![Login Page](data:image/png;base64,${data.base64})`
  }
  
  // Option 2: File path reference (large images)
  return `![Login Page](${data.path})\n\nPath: ${data.path}`
})
```

**Example 2: Docker Container State**
```typescript
// Docker plugin output → Impulse
const containers = await Bun.$`docker ps --format json`.json()

const impulse = {
  id: "docker-containers",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "docker-ps",
    data: {
      timestamp: Date.now(),
      filters: { status: "running" }
    }
  },
  budget: 1000,
  priority: "medium"
}

// Register resolver
ImpulseResolver.registerResolver("docker-ps", async (pointer) => {
  const cmd = `docker ps --format json`
  const output = await Bun.$`${cmd}`.text()
  const containers = output.split("\n").filter(Boolean).map(JSON.parse)
  
  return `
## Running Docker Containers

${containers.map(c => `
### ${c.Names}
- Image: ${c.Image}
- Status: ${c.Status}
- Ports: ${c.Ports}
`).join("\n")}
`
})
```

**Example 3: GitHub API Data**
```typescript
const impulse = {
  id: "open-prs",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "github-api",
    data: {
      endpoint: "/repos/owner/repo/pulls",
      query: { state: "open" },
      auth: { token: "{env:GITHUB_TOKEN}" }
    }
  },
  budget: 2000,
  priority: "medium"
}

ImpulseResolver.registerResolver("github-api", async (pointer) => {
  const { endpoint, query, auth } = pointer.data
  const response = await fetch(`https://api.github.com${endpoint}?${new URLSearchParams(query)}`, {
    headers: { Authorization: `token ${auth.token}` }
  })
  const prs = await response.json()
  
  return `
## Open Pull Requests

${prs.map(pr => `
### #${pr.number}: ${pr.title}
- Author: ${pr.user.login}
- Created: ${new Date(pr.created_at).toLocaleDateString()}
- Status: ${pr.mergeable_state}
`).join("\n")}
`
})
```

---

### 3.2 Activity Artifacts (Structured Storage)

**Location**: `docs/activity-system/ACTIVITY_ARTIFACTS_AS_IMPULSES_DESIGN.md`

**Pattern**: Activity tasks generate artifacts, stored as impulses for downstream tasks.

**Example Flow**:
```typescript
// Task 1: Analyze code quality
{
  id: "analyze",
  prompt: "Analyze code quality in {{files}}",
  impulses: [
    { id: "files", pointer: { type: "file", path: "src/**/*.ts" }, budget: 5000 }
  ],
  outputs: [
    {
      id: "analysis-report",
      type: "activityArtifact",
      pointer: {
        type: "activityArtifact",
        activityId: "{{ACTIVITY_ID}}",  // Filled at runtime
        artifactPath: "analysis-report.json"
      },
      budget: 4000
    }
  ]
}

// After task 1 completes, store artifact
const artifact = {
  issues: [
    { file: "src/auth.ts", line: 42, severity: "HIGH", message: "SQL injection risk" }
  ],
  metrics: {
    totalFiles: 15,
    totalIssues: 8,
    highSeverity: 2
  }
}
await ArtifactStorage.store(activityId, "analysis-report.json", JSON.stringify(artifact))

// Task 2: Fix issues
{
  id: "fix-issues",
  prompt: "Fix issues found in {{analysis-report}}",
  impulses: [
    // Receives artifact from Task 1 as impulse
    {
      id: "analysis-report",
      type: "activityArtifact",
      pointer: {
        type: "activityArtifact",
        activityId: activityId,
        artifactPath: "analysis-report.json"
      },
      budget: 4000
    }
  ]
}

// Resolution
ImpulseResolver.resolve({ type: "activityArtifact", activityId, artifactPath: "analysis-report.json" })
// Returns formatted artifact content:
// ## Analysis Report
// 
// **Total Issues**: 8 (2 HIGH, 6 MEDIUM)
// 
// ### HIGH Severity
// 1. src/auth.ts:42 - SQL injection risk
// ...
```

**Storage Options**:
- **Small data** (<1MB): SurrealDB `activity_artifacts` table
- **Large data** (>1MB): Filesystem (`.opencode/activity-artifacts/{activityId}/`)
- **Persistent data**: Database with retention policy

---

### 3.3 Bash Output (Dynamic Execution)

**Pattern**: Execute command lazily when impulse is resolved.

```typescript
const impulse = {
  id: "env-vars",
  type: "bashOutput",
  pointer: {
    type: "bashOutput",
    command: "env | grep NODE"
  },
  budget: 500,
  priority: "low"
}

// Resolver
ImpulseResolver.registerResolver("bashOutput", async (pointer) => {
  const output = await Bun.$`${pointer.command}`.text()
  return `\`\`\`bash
$ ${pointer.command}
${output}
\`\`\``
})
```

**Use Cases**:
- Environment inspection (`env`, `uname -a`, `git status`)
- Dynamic tool availability (`which docker`, `docker --version`)
- Real-time system state (`free -h`, `df -h`, `docker ps`)

---

## 4. Executing Code Instead of Caching

### 4.1 Problem with Caching

**Current Approach** (Static):
```typescript
// Load file content once
const impulse = await ImpulseResolver.load({
  id: "auth-module",
  pointer: { type: "file", path: "src/auth.ts" },
  budget: 3000
})

// impulse.content = "... entire file content ..."
// impulse.loaded = true

// Later: Return cached content (even if file changed)
const content = impulse.content  // Stale!
```

**Issues**:
1. **Stale Data**: Cached content doesn't reflect file changes
2. **Memory Overhead**: All loaded impulses kept in memory
3. **No Re-execution**: Same content returned every time

---

### 4.2 Solution: Executable Impulses

**New Pointer Types**:
```typescript
export type Pointer = 
  | { type: "executable"; code: string; language: "typescript" | "python" | "bash" }
  | { type: "compiledActivity"; templateId: string; variables: Record<string, any> }
  | /* existing types */
```

**Execution Model**:
```typescript
// Resolver EXECUTES code instead of loading content
case "executable": {
  const sandbox = createSandbox(pointer.language)
  const result = await sandbox.run(pointer.code)
  return result  // Fresh execution every time
}

case "compiledActivity": {
  const compiled = CompiledActivityRegistry.get(pointer.templateId)
  const result = await compiled.execute(pointer.variables)
  return result  // Deterministic code execution
}
```

---

### 4.3 Activity Compilation

**Trigger**: After N successful executions (N=10), compile activity to pure code.

**Before (LLM-based)**:
```typescript
await activity({
  templateId: "add-rest-endpoint",
  variables: { method: "POST", path: "/users", handler: "createUser" }
})
// Cost: $0.05, Duration: 30s
// Requires LLM inference every time
```

**After (Compiled)**:
```typescript
// Generated code after 10 successful executions
function addRESTEndpointCompiled(method: string, path: string, handler: string) {
  // Step 1: Generate route file
  const routeCode = `
import { Router } from 'express'
const router = Router()

router.${method.toLowerCase()}('${path}', ${handler})

export default router
`
  fs.writeFileSync(`src/api/${path}.ts`, routeCode)
  
  // Step 2: Generate test file
  const testCode = `
import request from 'supertest'
import app from '../app'

describe('${method} ${path}', () => {
  it('should respond successfully', async () => {
    const response = await request(app).${method.toLowerCase()}('${path}')
    expect(response.status).toBe(200)
  })
})
`
  fs.writeFileSync(`tests/api/${path}.test.ts`, testCode)
  
  // Step 3: Update route index
  fs.appendFileSync(`src/api/index.ts`, `export { default as ${path.replace(/\W/g, '')} } from './${path}'\n`)
  
  // Step 4: Run tests
  await Bun.$`npm test tests/api/${path}.test.ts`
  
  // Step 5: Commit
  await Bun.$`git add .`
  await Bun.$`git commit -m "Add ${method} ${path} endpoint"`
}

// Execution
addRESTEndpointCompiled("POST", "/users", "createUser")
// Cost: $0.00, Duration: 2s
// Pure code execution, no LLM
```

**Impulse for Compiled Activity**:
```typescript
{
  id: "add-endpoint-compiled",
  type: "compiledActivity",
  pointer: {
    type: "compiledActivity",
    templateId: "add-rest-endpoint",
    variables: { method: "POST", path: "/users", handler: "createUser" }
  },
  budget: 0  // No tokens needed
}
```

**Compilation Criteria**:
- ✅ 10+ successful executions
- ✅ Success rate > 90%
- ✅ Low variance in execution path (deterministic)
- ✅ No dynamic prompt generation

---

## 5. Cross-Boundary Data Passing

### 5.1 Cross-Task (Within Activity)

**Pattern**: Task A outputs → Task B impulses

```typescript
{
  tasks: [
    {
      id: "analyze",
      outputs: [
        { id: "issues", type: "activityArtifact", artifactPath: "issues.json" }
      ]
    },
    {
      id: "fix",
      impulses: [
        // Receives Task A output as impulse
        { id: "issues", type: "activityArtifact", artifactPath: "issues.json" }
      ]
    }
  ]
}
```

**Executor wiring**:
```typescript
// After Task A completes
const taskAOutputs = await executeTask(taskA)

// Before Task B starts
taskB.impulses.push(...taskAOutputs.map(output => ({
  id: output.id,
  type: output.type,
  pointer: output.pointer,
  budget: output.budget
})))

await executeTask(taskB)
```

---

### 5.2 Cross-Activity (Between Activities)

**Pattern**: Activity A artifacts → Activity B variables

```typescript
// Activity A: Analyze codebase
const activityA = await activity({
  templateId: "analyze-codebase",
  variables: { path: "src/" }
})

// Activity A generates artifact
const artifact = activityA.artifacts.find(a => a.id === "analysis-report")

// Activity B: Fix issues
await activity({
  templateId: "fix-issues",
  variables: {
    issuesImpulseId: artifact.id  // Pass artifact as variable
  },
  reason: "Fix issues found in analysis"
})

// Activity B template receives impulse
{
  tasks: [
    {
      id: "fix",
      prompt: "Fix issues in {{issuesImpulseId}}",
      impulses: [
        // Variable resolved to impulse
        { id: "{{issuesImpulseId}}", type: "activityArtifact" }
      ]
    }
  ]
}
```

---

### 5.3 Cross-Agent (ACP Delegation)

**Pattern**: Host agent → Remote agent via impulse sharing

**Location**: `repos/metabob-opencode/packages/opencode/src/tools/acp-delegate.ts`

```typescript
// Host creates design impulse
await impulse_create({
  id: "api-design",
  pointer: { type: "memo", content: "API Design:\n- REST endpoints\n- JWT tokens..." },
  budget: 2000
})

// Host delegates to remote agent with impulse sharing
await acp_delegate({
  target: "docker://backend-agent",
  taskDescription: "Implement API",
  prompt: "Implement API per the shared design",
  shareImpulses: ["api-design"]  // Share impulse with remote
})

// Remote agent receives impulse
// - Host serializes impulse pointer (Phase 2)
// - Remote attempts local resolution (Phase 3)
// - If fails, requests content from host (Phase 3 bidirectional)
```

**Impulse Serialization** (Phase 2):
```typescript
// Host serializes impulse for remote
const serialized = {
  id: "api-design",
  pointer: { type: "memo", content: "..." },
  budget: 2000,
  metadata: {
    source: "host",
    hostSessionId: session.id
  }
}

// Remote receives serialized impulse
// Tries to resolve locally
const content = await ImpulseResolver.resolve(serialized.pointer)

// If resolution fails (e.g., file not available remotely)
// Request from host
const content = await acp_request_impulse_content({
  hostSessionId: serialized.metadata.hostSessionId,
  impulseId: serialized.id
})
```

---

## 6. Failure Handling with Impulses

### 6.1 Failure Context Impulse

**Pattern**: On task failure, create impulse with error details.

```typescript
// Task fails
const result = await executeTask(task)

if (!result.success) {
  // Create failure impulse
  const failureImpulse = {
    id: `failure-${task.id}`,
    type: "memo",
    pointer: {
      type: "memo",
      content: `
## Task Failure: ${task.id}

**Error**: ${result.error}
**Exit Code**: ${result.exitCode}
**Output**: 
\`\`\`
${result.output}
\`\`\`

**Attempted**: ${result.attemptedActions.join(", ")}
**Suggested Fixes**: ${result.suggestedFixes.join(", ")}
      `
    },
    budget: 3000,
    priority: "high"
  }
  
  // Retry with failure context
  task.impulses.push(failureImpulse)
  const retryResult = await executeTask(task)
}
```

---

### 6.2 Progressive Context (Retry Strategy)

**Strategy**: Add more impulses with each retry.

```typescript
const retryStrategies = {
  "progressive-context": async (task, attempt) => {
    if (attempt === 1) {
      // First retry: Add error context
      task.impulses.push(failureImpulse)
    } else if (attempt === 2) {
      // Second retry: Add CPG analysis
      const impactAnalysis = await Metabob.analyzeChangeImpact(task.files[0])
      task.impulses.push({
        id: "impact-analysis",
        type: "custom",
        pointer: { type: "custom", resolver: "metabob-impact", data: impactAnalysis },
        budget: 2000
      })
    } else if (attempt === 3) {
      // Third retry: Add related files
      const related = await Metabob.suggestRelatedChanges(task.files)
      for (const file of related) {
        task.impulses.push({
          id: `related-${file}`,
          type: "file",
          pointer: { type: "file", path: file },
          budget: 2000
        })
      }
    }
  }
}
```

---

## 7. Performance Optimization

### 7.1 Lazy Loading

**Principle**: Resolve impulses only when referenced.

```typescript
// Efficient: References one impulse
const prompt = `Fix bug using {{auth-module}}`
// Loads: auth-module (3000 tokens)
// Skips: user-model, tests, docs

// Inefficient: References all impulses
const prompt = `Fix bug using {{auth-module}}, {{user-model}}, {{tests}}, {{docs}}`
// Loads: all 4 impulses (10000 tokens)
```

**Template Design**:
```typescript
// GOOD: Selective references
{
  prompt: "Implement {{feature}} in {{target-file}}",
  impulses: [
    { id: "target-file", budget: 3000 },
    { id: "related-file-1", budget: 2000 },  // May not be referenced
    { id: "related-file-2", budget: 2000 }   // May not be referenced
  ]
}

// BAD: Reference everything
{
  prompt: "Implement {{feature}} using {{target-file}}, {{related-file-1}}, {{related-file-2}}",
  impulses: [/* ... */]
}
// Always loads all impulses, regardless of relevance
```

---

### 7.2 Budget Management

**Strategy**: Allocate token budgets based on priority.

```typescript
const impulses = [
  { id: "critical-file", priority: "high", budget: 4000 },
  { id: "helpful-file", priority: "medium", budget: 2000 },
  { id: "optional-file", priority: "low", budget: 1000 }
]

// If total budget exceeded, drop low-priority impulses
const totalBudget = 8000
const allocated = impulses.reduce((sum, i) => sum + i.budget, 0)

if (allocated > totalBudget) {
  impulses = impulses
    .filter(i => i.priority !== "low")  // Drop optional
    .map(i => i.priority === "medium" ? { ...i, budget: i.budget * 0.5 } : i)  // Reduce medium
}
```

---

### 7.3 Caching Strategies

**Strategy 1: Session-scoped cache** (current files)
```typescript
// Files edited in this session are cached
const cache = new Map<string, string>()

ImpulseResolver.registerResolver("file", async (pointer) => {
  if (cache.has(pointer.path)) {
    return cache.get(pointer.path)
  }
  
  const content = await fs.readFile(pointer.path, "utf-8")
  cache.set(pointer.path, content)
  return content
})
```

**Strategy 2: LRU cache** (frequently accessed)
```typescript
const lru = new LRUCache<string, string>({ max: 100, maxSize: 10_000_000 })  // 10MB

ImpulseResolver.registerResolver("file", async (pointer) => {
  const cached = lru.get(pointer.path)
  if (cached) return cached
  
  const content = await fs.readFile(pointer.path, "utf-8")
  lru.set(pointer.path, content)
  return content
})
```

**Strategy 3: No cache** (dynamic execution)
```typescript
// Always fresh data
ImpulseResolver.registerResolver("bashOutput", async (pointer) => {
  // Never cache, always execute
  return await Bun.$`${pointer.command}`.text()
})
```

---

## 8. Conclusion

**Impulse System Enables**:
1. **Minimal Overhead**: Pass thousands of references with KB of memory
2. **Lazy Loading**: Content resolved only when needed
3. **Learning**: Track usage to improve future suggestions
4. **Plugin Integration**: Arbitrary data fits naturally via custom resolvers
5. **Cross-Boundary**: Share data between tasks, activities, agents, plugins
6. **Failure Recovery**: Progressive context addition on retry
7. **Code Execution**: Compiled activities eliminate LLM dependency

**Next Steps**: See [Plugin Vessel Architecture](./PLUGIN_VESSEL_ARCHITECTURE.md) for integration with plugin system.
