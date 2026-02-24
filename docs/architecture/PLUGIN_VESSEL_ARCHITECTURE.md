# Plugin Vessel Architecture: OpenCode as Adaptive Platform

## Executive Summary

**Core Principle**: OpenCode is not a monolithic tool, but a **vessel** - an adaptive plugin host that discovers its environment and composes capabilities from available resources.

**Ontological Foundation**: OpenCode is a **vessel** (instructional state) through which the [unnamed process-of-becoming] manifests. The vessel provides the capacity for execution - it is not the becoming itself. This document describes the vessel's architecture; for the foundational three-state model (vessel/becoming/instance), see [ONTOLOGY_OF_BECOMING.md](./ONTOLOGY_OF_BECOMING.md).

**Key Insight**: If everything can be a plugin (MCP servers, git repos, binaries, APIs), then **OpenCode itself** should be treated as a collection of plugins. This enables:

- **Environment Adaptation**: Work with whatever is available (Docker, Kubernetes, local tools, cloud APIs)
- **Graceful Degradation**: Activity templates adapt to missing plugins
- **Continuous Improvement**: Plugins (including OpenCode's own components) evolve over time
- **Respectful Integration**: Convince (discover and compose) rather than coerce (require specific setup)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│           OPENCODE VESSEL (Instructional State)             │
│        (Capacity through which becoming manifests)          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Plugin Host & Orchestrator              │  │
│  │  - Environment Discovery                              │  │
│  │  - Plugin Composition                                 │  │
│  │  - Activity Template Resolution                       │  │
│  │  - Impulse-Based Data Flow                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┬──────────────┬──────────────┬─────────┐  │
│  │ CORE PLUGINS │  MCP PLUGINS │ TOOL PLUGINS │  REPOS  │  │
│  ├──────────────┼──────────────┼──────────────┼─────────┤  │
│  │ - filesystem │ - metabob    │ - docker     │ -cli    │  │
│  │ - git        │ - playwright │ - kubectl    │ -opencd │  │
│  │ - bash       │ - github     │ - ollama     │ -proto  │  │
│  │ - activities │ - custom     │ - curl       │ -rpc    │  │
│  │ - impulses   │              │ - jq         │         │  │
│  └──────────────┴──────────────┴──────────────┴─────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Impulse System (Data Layer)             │  │
│  │  - 14 Pointer Types                                   │  │
│  │  - Lazy Resolution                                    │  │
│  │  - Cross-Plugin Data Sharing                          │  │
│  │  - Learning & Usage Tracking                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Plugin Types

### 2.1 Core Plugins (OpenCode's Own Capabilities)

**Definition**: OpenCode's built-in tools exposed as plugins.

**Examples**:
- `opencode-core`: Filesystem operations (read, write, edit, list, glob, grep)
- `opencode-activities`: Activity execution system
- `opencode-git`: Git operations
- `opencode-impulses`: Impulse management
- `opencode-memory`: Memory agent context gathering

**Impulse Resolvers**: Each core plugin provides resolvers for specific pointer types:
- `opencode-core`: `file`, `bashOutput`
- `opencode-activities`: `activityOutput`, `activityArtifact`, `templateDefinition`
- `opencode-git`: `gitDiff`, `gitLog`, `gitBlame`

**Rationale**: Treating OpenCode's own capabilities as plugins enables:
1. **Uniform interface**: All capabilities accessed the same way
2. **Versioning**: Core plugins can be versioned and upgraded independently
3. **Replacement**: External plugins can replace core functionality (e.g., use GitHub API instead of git CLI)

---

### 2.2 MCP Plugins (Model Context Protocol Servers)

**Definition**: External MCP servers providing tools and resources.

**Discovery**: From `opencode.json` mcp configuration:
```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "enabled": true
    },
    "playwright": {
      "type": "local",
      "command": ["playwright-mcp"],
      "enabled": true
    }
  }
}
```

**Capabilities**: MCP tools exposed as plugin actions
**Impulse Resolvers**: Custom resolvers for plugin-specific data types

**Example: Metabob Plugin**
```typescript
{
  id: "metabob",
  type: "mcp",
  provides: [
    "metabob_search_codebase_issues",
    "metabob_analyze_change_impact",
    "metabob_assess_deletion_safety"
  ],
  impulseResolvers: [
    "metabobIssue",
    "metabobAnnotation",
    "metabobImpactAnalysis"
  ],
  activityTemplates: [
    "fix-bug-with-metabob",
    "refactor-with-quality-check"
  ]
}
```

---

### 2.3 Tool Plugins (Binary/CLI Tools)

**Definition**: Installed command-line tools detected via `which` or `whereis`.

**Discovery**: Automatic scanning during environment initialization:
```typescript
const tools = ["docker", "kubectl", "gh", "curl", "jq", "ollama"]
for (const tool of tools) {
  const found = await Bun.$`which ${tool}`.quiet()
  if (found) {
    plugins.external[tool] = {
      type: "binary",
      path: await Bun.$`which ${tool}`.text(),
      version: await detectVersion(tool),
      capabilities: inferCapabilities(tool)
    }
  }
}
```

**Capabilities**: Inferred from tool name and available commands
**Impulse Resolvers**: `bashOutput` with tool-specific formatting

**Example: Docker Plugin**
```typescript
{
  id: "docker",
  type: "binary",
  path: "/usr/bin/docker",
  version: "24.0.5",
  capabilities: [
    "container_exec",
    "container_inspect",
    "image_build",
    "network_inspect"
  ],
  impulseResolvers: ["dockerContainerState", "dockerImageInfo"]
}
```

---

### 2.4 Repository Plugins (Git Repos as Plugins)

**Definition**: Git repositories (like metabob-cli, metabob-opencode) treated as plugins.

**Discovery**: Scan repos directory or configured paths:
```typescript
const repos = await scanDirectory("./repos")
for (const repo of repos) {
  const manifest = await loadManifest(repo)
  if (manifest) {
    plugins.repos[manifest.id] = {
      type: "git-repo",
      path: repo,
      entrypoint: manifest.entrypoint,
      improvementTracking: {
        commitLog: `${repo}/.git`,
        changelogPath: `${repo}/CHANGELOG.md`
      }
    }
  }
}
```

**Improvement Tracking**: Repositories track their own evolution:
- Commit history
- Changelog entries
- Version tags
- Test results
- Impact on activity templates

**Example: metabob-cli Plugin**
```typescript
{
  id: "metabob-cli",
  type: "git-repo",
  path: "./repos/metabob-cli",
  entrypoint: "metabob_cli/__main__.py",
  capabilities: [
    "metabob_analyze",
    "metabob_init",
    "metabob_mcp_server"
  ],
  improvements: [
    {
      id: "improvement-1",
      type: "feature",
      description: "Added CPG-based deletion safety analysis",
      commitHash: "abc1234",
      filesChanged: ["metabob_cli/cpg/deletion_safety.py"],
      affectedTemplates: ["refactor-with-tests", "clean-dead-code"],
      timestamp: 1704067200000
    }
  ]
}
```

---

## 3. Impulse-Based Data Passing Between Tasks

### 3.1 The Pointer Model

**Core Concept**: Impulses are **serializable references** (pointers), not cached content.

**14 Pointer Types** (from `activity-template.ts`):
1. `file` - Filesystem pointers
2. `component` - Code component references
3. `activityOutput` - Task results
4. `activityArtifact` - Generated files
5. `bashOutput` - Command results
6. `metabobIssue` - Quality issues
7. `metabobAnnotation` - Design decisions
8. `templateDefinition` - Activity templates
9. `activityRecommendation` - ML-ranked suggestions
10. `remoteSession` - ACP delegation results
11. `memo` - Static text/data
12. `gitDiff` - Git changes
13. `gitLog` - Git history
14. `custom` - Plugin extensibility point

**Benefits**:
- **Lazy Loading**: Content resolved only when needed
- **Minimal Overhead**: Pass thousands of impulses with minimal memory
- **Cross-Task**: Share data between tasks without serialization
- **Cross-Activity**: Pass outputs from Activity A to Activity B
- **Cross-Agent**: Share context via ACP delegation

---

### 3.2 Plugin Data as Impulses

**Pattern**: Plugin outputs become impulses for next task.

**Example Flow**:
```typescript
// Task 1: Playwright screenshots
const result = await PlaywrightMCP.screenshot({ name: "login-page" })

// Create impulse from plugin output
const impulse = {
  id: "login-screenshot",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "playwright-screenshot",
    data: {
      sessionId: result.sessionId,
      path: result.path,
      base64: result.base64  // Optional embedding
    }
  },
  budget: 500,  // Token budget for resolution
  priority: "high"
}

// Task 2: Receives impulse (pointer only, not content)
// Content resolved lazily when task needs it
const screenshot = await ImpulseResolver.resolve(impulse.pointer)
```

**Custom Resolvers**: Plugins register their own resolvers:
```typescript
// Plugin registers resolver
ImpulseResolver.registerResolver("playwright-screenshot", async (pointer) => {
  const data = pointer.data
  if (data.base64) {
    return `![Screenshot](data:image/png;base64,${data.base64})`
  } else {
    const img = await fs.readFile(data.path)
    return `![Screenshot](${data.path})\n\nBase64: ${img.toString('base64')}`
  }
})
```

---

### 3.3 Learning What Impulses Are Needed

**Mechanism 1: Memory Agent Context Gathering**

Memory agent analyzes user intent and suggests impulses:
```typescript
const suggestions = await MemoryAgent.analyze({
  intent: "implement user authentication",
  recentHistory: session.messages,
  codebase: session.cwd
})

// Returns prioritized impulses:
[
  {
    id: "auth-module",
    pointer: { type: "file", path: "src/auth.ts" },
    priority: "high",
    budget: 3000,
    reason: "Core authentication logic"
  },
  {
    id: "user-model",
    pointer: { type: "component", file: "src/models/user.ts", name: "User" },
    priority: "medium",
    budget: 2000,
    reason: "User model referenced in auth"
  }
]
```

**Learning Source**:
- CPG impact scoring (high-dependency components prioritized)
- Metabob annotations (past design decisions)
- Co-change patterns (files that change together)
- Session history (recently modified files)

---

**Mechanism 2: CPG Impulse Prioritization**

Code Property Graph enriches impulses with impact data:
```typescript
// Enrich impulse with CPG impact
if (impulse.pointer.type === "file") {
  const impactData = await MetabobCLI.analyzeChangeImpact(impulse.pointer.path)
  
  impulse.metadata.cpgImpact = {
    impactScore: 0.85,  // 85% impact (many dependents)
    impactLevel: "high",
    directDependents: 15,
    transitiveDependents: 42,
    totalDependents: 57
  }
}
```

**Result**: Infrastructure components (auth, database, sessions) get **higher priority** automatically.

---

**Mechanism 3: Impulse Usage Tracking**

Track which impulses are actually used vs just loaded:
```typescript
export const UsageStats = z.object({
  loadCount: z.number(),       // How many times loaded
  totalCost: z.number(),        // Cumulative cost
  totalTokens: z.number(),      // Tokens consumed
  firstAccessedAt: z.number(),
  lastAccessedAt: z.number()
})

// After task completion
await Metabob.reportImpulseUsageForStep(
  activityId,
  taskId,
  impulses,  // All loaded impulses
  used,      // Which impulses were referenced in agent messages
  outcome    // "success" | "failure"
)
```

**Backend Learning**: Metabob backend correlates:
- Which impulses were loaded
- Which were actually used (referenced in prompt)
- Task success/failure
- **Learns**: "For task type X, impulses Y and Z are critical, impulse W is noise"

---

### 3.4 Arbitrary Data in Impulses

**Strategy 1: Custom Pointers**
```typescript
// Plugin data as custom pointer
{
  id: "docker-containers",
  type: "custom",
  pointer: {
    type: "custom",
    resolver: "docker-ps",
    data: {
      format: "json",
      filters: { status: "running" }
    }
  },
  budget: 1000
}

// Resolver
ImpulseResolver.registerResolver("docker-ps", async (pointer) => {
  const cmd = `docker ps --format json`
  const output = await Bun.$`${cmd}`.text()
  return JSON.stringify(JSON.parse(output), null, 2)
})
```

**Strategy 2: Activity Artifacts**
```typescript
// Activity A generates report
const artifact = await ArtifactStorage.store(
  activityId,
  "analysis-report.json",
  JSON.stringify(pluginData)
)

// Activity B receives impulse
{
  id: "plugin-analysis",
  type: "activityArtifact",
  pointer: {
    type: "activityArtifact",
    activityId: "act_abc123",
    artifactPath: "analysis-report.json"
  },
  budget: 5000
}
```

---

## 4. Environment Adaptation

### 4.1 Discovery Process

**On OpenCode startup**:
```typescript
class EnvironmentManager {
  async discover(): Promise<Environment> {
    // 1. Detect runtime
    const runtime = {
      os: process.platform,
      arch: process.arch,
      bun: Bun.version,
      node: process.versions.node,
      python: await detectPythonVersion(),
      docker: await detectDockerVersion()
    }
    
    // 2. Scan for tools
    const tools = await scanAvailableTools()
    
    // 3. Discover MCP servers
    const config = await Config.get()
    const mcpServers = Object.entries(config.mcp || {})
      .map(([id, cfg]) => ({ id, ...cfg }))
    
    // 4. Scan git repositories
    const repos = await scanGitRepos("./repos")
    
    // 5. Compose environment
    return {
      vessel: { id: "opencode-v1.2.3" },
      plugins: { core: {}, mcp: mcpServers, external: tools, repos },
      runtime: { detected: runtime, constraints: inferConstraints() }
    }
  }
}
```

**Output**: `.opencode/environment.json` manifest

---

### 4.2 Task Graph Resolution

**Activity templates define conditional tasks**:
```json
{
  "tasks": [
    {
      "id": "test-docker",
      "prompt": "Run tests in Docker",
      "condition": { "plugin": "docker", "available": true }
    },
    {
      "id": "test-native",
      "prompt": "Run tests natively",
      "condition": { "plugin": "docker", "available": false }
    }
  ]
}
```

**Executor resolves at runtime**:
```typescript
const environment = await EnvironmentManager.discover()
const taskGraph = resolveTaskGraph(template, environment)

// Result: Only executable tasks included
// - Has docker: executes test-docker
// - No docker: executes test-native
```

---

### 4.3 Graceful Degradation

**Example: Web Scraping**

**Rich Environment** (Playwright + Metabob + Docker):
```json
{
  "tasks": [
    {"id": "scrape", "plugin": "playwright"},
    {"id": "analyze", "plugin": "metabob"},
    {"id": "test", "plugin": "docker"}
  ]
}
```

**Minimal Environment** (cURL only):
```json
{
  "tasks": [
    {"id": "scrape", "plugin": "curl"},
    {"id": "parse", "plugin": "opencode-core"}
  ]
}
```

**Same template, different execution based on environment**.

---

## 5. Plugin Improvement Over Time

### 5.1 Improvement Tracking

**Each plugin tracks its evolution**:
```typescript
{
  id: "metabob-cli",
  type: "git-repo",
  improvements: [
    {
      id: "improvement-abc123",
      type: "feature",
      description: "Added CPG deletion safety analysis",
      commitHash: "abc1234",
      filesChanged: ["metabob_cli/cpg/deletion_safety.py"],
      affectedTemplates: ["refactor-with-tests", "clean-dead-code"],
      testResults: { passed: 45, failed: 0 },
      timestamp: 1704067200000
    }
  ]
}
```

**Tracking API**:
```typescript
await PluginImprovementTracker.track("metabob-cli", {
  type: "feature",
  description: "Added deletion safety analysis",
  capabilities: ["metabob_assess_deletion_safety"],
  filesChanged: ["metabob_cli/cpg/deletion_safety.py"],
  testResults: { passed: 45, failed: 0 }
})
```

---

### 5.2 Upgrade Suggestions

**System analyzes plugin changes**:
```typescript
const suggestions = await PluginImprovementTracker.suggestUpgrades()

// Returns:
[
  {
    pluginId: "metabob-cli",
    from: "abc1234",
    to: "def5678",
    changes: "Added deletion safety, improved CPG performance",
    affectedTemplates: ["refactor-with-tests", "clean-dead-code"],
    recommendation: "⚠️ Test affected templates before upgrading"
  }
]
```

**Learning Loop**: Improvements feed back into activity template quality.

---

### 5.3 Version Tracking in Impulses

**Impulses carry plugin version metadata**:
```typescript
{
  id: "code-analysis",
  type: "metabobIssue",
  pointer: { type: "metabobIssue", issueId: "issue_xyz" },
  metadata: {
    pluginVersion: {
      pluginId: "metabob-cli",
      version: "v1.2.3",
      commitHash: "abc1234"
    }
  },
  budget: 3000
}

// During resolution, check for version drift
const current = await PluginManager.getVersion("metabob-cli")
if (current !== impulse.metadata.pluginVersion.version) {
  console.warn(`⚠️  Impulse created with metabob-cli@${impulse.metadata.pluginVersion.version}`)
  console.warn(`   Currently running @${current}. Results may differ.`)
}
```

---

## 6. Executing Code Instead of Caching

### 6.1 Current: Content Caching

```typescript
// Load once, cache forever
export async function load(impulse: Schema): Promise<Schema> {
  if (impulse.loaded) return impulse  // Return cached

  const content = await resolve(impulse.pointer)  // Expensive
  return { ...impulse, loaded: true, content, tokenCount }
}
```

**Problem**: Static cached content, requires LLM every time.

---

### 6.2 Proposed: Executable Impulses

**New pointer types**:
```typescript
export type Pointer = 
  | { type: "executable"; code: string; language: "typescript" | "python" }
  | { type: "compiledActivity"; templateId: string; variables: Record<string, any> }
  | /* existing types */

// Resolver executes code instead of fetching content
case "executable": {
  const result = await executeInSandbox(pointer.code, pointer.language)
  return result  // Fresh execution, no caching
}

case "compiledActivity": {
  return await executeCompiledTemplate(pointer.templateId, pointer.variables)
}
```

---

### 6.3 Activity Compilation

**After N successful executions (N=10)**, compile to pure code:

```typescript
// Before: LLM every time ($0.05, 30s)
activity({ templateId: "add-rest-endpoint", variables: { method: "POST", path: "/users" } })

// After: Compiled to deterministic code ($0.00, 2s)
function addRESTEndpoint(method: string, path: string) {
  writeFile(`src/api/${path}.ts`, routeTemplate(method))
  writeFile(`tests/api/${path}.test.ts`, testTemplate(method, path))
  appendFile(`src/api/index.ts`, `export * from './${path}';\n`)
  runCommand(`npm test tests/api/${path}.test.ts`)
  gitCommit(`Add ${method} ${path} endpoint`)
}
```

**Impulse for compiled activity**:
```typescript
{
  id: "add-rest-endpoint-compiled",
  type: "compiledActivity",
  pointer: {
    type: "compiledActivity",
    templateId: "add-rest-endpoint",
    variables: { method: "POST", path: "/users" }
  },
  budget: 0  // No LLM tokens needed
}
```

---

## 7. Failure Handling

### 7.1 Retry with Failure Context

```typescript
for (let attempt = 1; attempt <= task.retry.maxAttempts; attempt++) {
  const runtimeVariables = {
    ATTEMPT: attempt,
    MAX_ATTEMPTS: task.retry.maxAttempts,
    LAST_ERROR: lastError,      // Impulse: previous error
    LAST_OUTPUT: lastOutput,    // Impulse: previous output
    VALIDATION_RESULT: lastResult  // Impulse: validation failure
  }
  
  const result = await executeTask(task, runtimeVariables)
  if (result.success) break
  
  lastError = result.error
  lastOutput = result.output
}
```

**Retry Strategies**:
- `simple`: Retry same task (flaky tools)
- `progressive-context`: Add more impulses each retry (CPG, annotations)
- `fallback-prompt`: Use different prompt template

---

### 7.2 Failure Analysis Impulse

```typescript
// After failure, create impulse with failure context
const failureImpulse = {
  id: `failure-${activity.id}`,
  type: "memo",
  pointer: {
    type: "memo",
    content: `
## Failure Analysis
**Activity**: ${activity.template.name}
**Error**: ${failureContext.error}
**Root Cause**: ${analysis.rootCause}
**Fix Suggestions**: ${analysis.suggestions.join(", ")}
    `
  },
  budget: 3000,
  priority: "high"
}

// Next retry receives this impulse
task.impulses.push(failureImpulse)
```

---

### 7.3 Trailblazing (Improvised Recovery)

**On failure**: Let AI improvise fix with expanded context:

```typescript
const recovery = await trailblazeRecovery({
  task,
  failureContext,
  impulses: [
    ...task.impulses,
    failureImpulse,  // Failure analysis
    { id: "similar-fixes", type: "metabobAnnotation" }  // Past fixes
  ],
  maxCost: task.trailblazing.maxCostPerTask
})

// If recovery succeeds: Learn from it
if (recovery.success) {
  const improvisedTemplate = extractTemplate(recovery.actions)
  await TemplateLibrary.register(improvisedTemplate, { variant: true })
}
```

---

## 8. LLM Dependency Reduction

### Strategy 1: Thompson Sampling (Existing)

```typescript
// Learn which templates work best
class TemplateSelector {
  selectVariant(template: ActivityTemplate): string {
    const variants = template.genealogy.variants
    
    // Sample from beta distributions
    const scores = variants.map(v => {
      const alpha = v.successCount + 1
      const beta = v.failureCount + 1
      return sampleBeta(alpha, beta)
    })
    
    return variants[argmax(scores)].id
  }
}
```

**Result**: Best templates used more, poor templates pruned.

---

### Strategy 2: Compiled Activities

```typescript
// After 10 successful executions
const compiled = await ActivityCompiler.compile("add-rest-endpoint")

// Pure code execution (no LLM)
compiled.execute({ method: "POST", path: "/users" })
```

**LLM Reduction**: 100% for mature templates.

---

### Strategy 3: Smart Routing

```typescript
class SmartRouter {
  route(request: string): "compiled" | "template" | "llm" {
    const compiled = CompiledActivityRegistry.find(request)
    if (compiled?.successRate > 0.95) return "compiled"  // 0ms, $0
    
    const template = TemplateLibrary.find(request)
    if (template?.successRate > 0.80) return "template"  // 30s, $0.05
    
    return "llm"  // 60s, $0.20
  }
}
```

---

## 9. Implementation Roadmap

### Phase 1: Environment Discovery (Week 1)
1. Implement `EnvironmentManager.discover()`
2. Create `.opencode/environment.json` schema
3. Build plugin scanners (tools, MCP, repos)
4. Test environment detection

### Phase 2: Plugin Impulse Resolvers (Week 1-2)
1. Add `playwright-screenshot` custom resolver
2. Add `docker-ps` custom resolver
3. Add `github-api` custom resolver
4. Test plugin → impulse → task flow

### Phase 3: Task Graph Resolution (Week 2)
1. Implement conditional task execution
2. Build environment-aware task scheduler
3. Add graceful degradation logic
4. Test with multiple environment configs

### Phase 4: Executable Impulses (Week 3)
1. Add `executable` pointer type
2. Implement sandbox execution
3. Create activity compiler
4. Measure LLM reduction

### Phase 5: Plugin Improvement Tracking (Week 3-4)
1. Implement `PluginImprovementTracker`
2. Add version tracking to impulses
3. Build upgrade suggestion system
4. Test with metabob-cli upgrades

### Phase 6: Failure Recovery (Week 4)
1. Enhance failure analysis impulses
2. Implement trailblazing with improvised templates
3. Store successful recoveries as variants
4. Test self-healing capabilities

---

## 10. Success Metrics

**Environment Adaptation**:
- ✅ 100% of activities resolve task graphs correctly
- ✅ 0 hard failures due to missing plugins
- ✅ Graceful degradation in 3+ environment configs

**LLM Reduction**:
- ✅ 40% reduction in LLM calls for mature templates (10+ executions)
- ✅ 80% of common tasks use compiled activities
- ✅ <5% of tasks require full LLM inference

**Plugin Improvement**:
- ✅ 100% of plugin upgrades tracked
- ✅ <10% of upgrades break affected templates
- ✅ Auto-suggestion of upgrades with <1% false positives

**Impulse Learning**:
- ✅ Memory agent suggests correct impulses 80% of the time
- ✅ Impulse usage tracking reduces noise by 50%
- ✅ CPG enrichment improves prioritization accuracy by 30%

---

## 11. Conclusion

**OpenCode as a Vessel** means:
- This vessel **adapts** to whatever environment it encounters (Docker, native, cloud)
- This vessel **composes** capabilities from available plugins (MCP, tools, repos)
- This vessel **learns** from plugin improvements over time
- This vessel **respects** existing tools rather than requiring specific setup
- Through this vessel, the process-of-becoming **reduces** LLM dependency and increases efficiency

This architecture transforms the OpenCode vessel from a **monolithic tool** into a **composable platform** that the process-of-becoming uses to grow more capable over time. The vessel is not the system itself - it is the **capacity** through which the unnamed process-of-becoming manifests and evolves.

---

## See Also

- [Impulse System Architecture](./IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md)
- [Activity System Architecture](./ACTIVITY_REPLAY_AND_STATE_ARCHITECTURE.md)
- [Memory Agent Architecture](./MEMORY_AGENT_ARCHITECTURE_VERIFIED.md)
- [Plugin Integration](./PLUGIN_INTEGRATION_ARCHITECTURE.md)
