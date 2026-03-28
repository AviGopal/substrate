# MiniBob Gap Analysis: Impulse-Activity Foundation Alignment

> Analysis Date: 2026-03-26
> Foundation Document: `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

---

## Executive Summary

MiniBob is a functional activity executor with solid state tracking and MCP integration. However, it has significant gaps against the three-pillar vision from the Impulse-Activity Foundation. The core issues are:

1. **Impulses are treated as context bags, not first-class data pointers with metadata**
2. **Ribosome extracts templates but doesn't learn input/output schemas**
3. **Resolvers are centralized in MiniBob, not distributed where data lives**
4. **No clear vessel embedding pattern for traditional codebases**
5. **Boredom system is coupled to cluster mode, limiting autonomous operation**

---

## Pillar 1: Run Activities and Impulses for Colocated Vessels

### Gap 1.1: Impulse Metadata Not Properly Used

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Impulse creation** | `createImpulse()` creates impulses with basic `pointer` and `budget` | Impulses should have rich `metadata` describing shape, rowCount, columns, sample, availableOps | Metadata is optional, rarely populated |
| **Context injection** | `formatImpulsesForContext()` outputs raw content in `<impulse>` tags | Should output `<impulse_ref>` with metadata allowing LLM to reason without raw data | Pointer-mode formatting exists but only used when metadata is present (rare) |
| **Token efficiency** | Content loaded and injected directly | LLM sees metadata, requests specific data through resolver operations | `process_impulse` tool exists but unused in practice |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/impulse.ts`):
```typescript
// Line 315-344: formatImpulse function
// Pointer-mode only activates if impulse.metadata exists
if (impulse.metadata) {
  // Uses <impulse_ref> with shape, row_count, summary
} else if (impulse.loaded && impulse.content) {
  // Falls back to raw content in <impulse> tags
}
```

**CHANGE NEEDED**:
1. Make metadata population mandatory for all resolver types
2. Implement metadata extraction in all resolvers (MCP, file, custom)
3. Default to pointer-mode formatting; only load raw content on explicit request

---

### Gap 1.2: Activity Input/Output Schemas Not Enforced

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Input schema** | Activities have `contextRequirements` (optional) | Activities should declare `inputSchema: { required: ImpulseShape[], optional: ImpulseShape[] }` | No shape-based matching |
| **Output schema** | `outputImpulses` creates memos from task output | Activities should declare `outputSchema: { produces: ImpulseShape[] }` with structured metadata | Outputs are untyped memos |
| **Activity matching** | Thompson Sampling based on category and success rate | Should match based on input impulse shapes, then rank by Thompson | Shape-matching not implemented |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/types.ts`):
```typescript
// ActivityTemplate (lines 300-332)
// Has contextRequirements but no inputSchema/outputSchema
interface ActivityTemplate {
  contextRequirements?: Array<{
    id: string
    type: "file" | "glob" | "memo" | "custom"
    // No shape field!
  }>
  // No outputSchema!
}
```

**CHANGE NEEDED**:
1. Add `inputSchema` and `outputSchema` to `ActivityTemplate`
2. Implement shape-based activity matching in `recommendActivities`
3. Backend should store shape information with templates

---

### Gap 1.3: Resolver Architecture Partially Correct

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Local resolvers** | `memo`, `file` resolved by MiniBob | Correct | None |
| **Backend resolvers** | `activityExecutionTrace`, `activityTemplate`, etc. delegated to MCP | Correct | None |
| **Custom resolvers** | `registerResolver()` allows host to add | Good | None |
| **Resolution location** | MiniBob delegates to backend for non-local types | Backend resolves traces; MiniBob resolves files | **Issue: No vessel-local SQL/DB resolver pattern** |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/impulse.ts`):
```typescript
// Line 175-264: resolvePointer method
// Dispatch order is correct:
// 1. LOCAL: memo
// 2. LOCAL: file
// 3. CUSTOM: registered resolvers
// 4. BACKEND: MCP delegation
// 5. FALLBACK: in-memory activityOutput
```

The resolution architecture is solid. The gap is in **not having a standard pattern for domain resolvers** (SQL, HTTP, sensors) that should live in the vessel.

**CHANGE NEEDED**:
1. Document the resolver registration pattern for domain-specific resolvers
2. Create example resolvers (SQL, HTTP) that vessels can import
3. Backend should NOT resolve domain data; vessels should

---

## Pillar 2: Embed into Traditional Codebases

### Gap 2.1: No Embedding Library/SDK

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Library export** | MiniBob is a standalone binary/server | Should export as `@minibob/core` npm package | No library packaging |
| **Minimal API** | Must use HTTP or CLI | Should have `import { ActivityExecutor, registerResolver }` | No direct import |
| **Performance impact** | Full LLM client always initialized | Should lazy-load LLM, support observe-only mode | Always-on LLM |
| **Recording mode** | Execution recording to MCP | Should work standalone with local trace storage | Requires MCP backend |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/lib.ts`):
The `lib.ts` file exists but is minimal. No real SDK pattern for embedding.

**CHANGE NEEDED**:
1. Create `@minibob/core` package with clean API surface
2. Support offline mode with local trace storage (SQLite or file-based)
3. Add observe-only mode that records without executing
4. Document embedding pattern for Node.js, Bun, and edge environments

---

### Gap 2.2: Code-to-Impulse Conversion Not Implemented

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Code analysis** | `understanding/explorer.ts` exists for static analysis | Should emit impulses with code structure metadata | Returns plain objects, not impulses |
| **Function discovery** | Basic file structure analysis | Should create impulses for functions, classes, modules | No impulse creation |
| **Dependency mapping** | Package.json parsing | Should create impulses representing dependency graph | No graph impulses |

**Evidence** (from MiniBob `understanding/explorer.ts`):
The explorer returns `CodebaseSnapshot` objects, not impulses. There's no bridge to the impulse system.

**CHANGE NEEDED**:
1. Create `codebaseToImpulses(path)` function that emits structured impulses
2. Each function/class/module becomes an impulse with metadata
3. Dependency graphs become graph-type impulses
4. These impulses can then be used as activity inputs

---

### Gap 2.3: Activity Organization from Existing Code Not Supported

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Workflow detection** | None | Should identify repeated patterns in code (CI scripts, test suites, deploy scripts) | No detection |
| **Activity suggestion** | None | Should propose activities based on code patterns | No suggestion |
| **Gradual activation** | None | Should allow observing before executing | No observe mode |

**CHANGE NEEDED**:
1. Implement workflow pattern detection (look for scripts, Makefiles, CI configs)
2. Create suggestion engine: "This looks like a deploy workflow. Create activity?"
3. Add observe mode: record what happens without MiniBob controlling

---

## Pillar 3: Develop Vessels and Inhabit Them

### Gap 3.1: Vessel Development Activities Missing

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Vessel templates** | No standard vessel structure | Should have activities for "create new vessel" | No meta-activities |
| **Tool registration** | Manual tool addition | Should have activity for "add tool to vessel" | Manual only |
| **Capability discovery** | None | Should have activity for "discover vessel capabilities" | No discovery |

**CHANGE NEEDED**:
1. Create `develop-vessel` activity category
2. Activities: `create-vessel`, `add-tool`, `add-resolver`, `test-vessel`
3. Vessels become activity templates themselves

---

### Gap 3.2: Vessel Inhabitation Not Implemented

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Docker vessel** | Deployment via Helm | Should be able to spawn, configure, and operate Docker vessels | Deployment only |
| **Local vessel** | CLI mode | Should be able to create and manage local vessel processes | Single process |
| **Remote vessel** | ACP protocol exists | Should be able to discover and delegate to remote vessels | ACP partially implemented |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/acp.ts`):
ACP exists but is focused on prompt/response delegation, not full vessel lifecycle management.

**CHANGE NEEDED**:
1. Implement vessel lifecycle management: spawn, monitor, terminate
2. Create vessel registry for discovery
3. Enable MiniBob to "inhabit" vessels by deploying itself

---

### Gap 3.3: Minimal Editing Tools Incomplete

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **File operations** | `read`, `write`, `edit` tools | Sufficient | None |
| **Git operations** | `git` tool with common subcommands | Good | Missing some operations |
| **Semantic edit** | None | Should support AST-aware edits | No AST support |
| **Bulk edit** | Single file per call | Should support multi-file atomic edits | Single file only |

**CHANGE NEEDED**:
1. Add AST-aware edit tool (tree-sitter integration)
2. Add bulk edit tool for atomic multi-file changes
3. Add refactor tool for rename/move operations

---

## Cross-Cutting Gaps

### Gap X.1: Improvisation Recording Incomplete

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Improvisation trace** | `ImprovisationTrace` stored via `saveTrace()` | Correct structure | **But: Doesn't capture input impulse shapes** |
| **Step recording** | Each step recorded with thought/action/result | Good | Missing impulse references per step |
| **Template extraction** | `extractTemplateFromImprovisation()` exists | Extracts tasks but not input/output schemas | No schema extraction |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/improviser.ts`):
```typescript
// Line 475-586: saveTrace method
// Converts ImprovisationTrace to ActivityExecution format
// But impulses: [] is always empty!
const activityExecution = {
  impulses: [], // Improvisation starts with no impulses
  ...
}
```

**CHANGE NEEDED**:
1. Capture impulses available at start of improvisation
2. Track which impulses were created/used per step
3. Extract input schema from what was actually needed

---

### Gap X.2: Ribosome Doesn't Learn Schemas

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Template extraction** | `assembleTemplateFromExecution()` creates templates | Good | No input/output schema |
| **Prompt extraction** | Uses `actualPrompt` from execution | Good but static | Should parameterize with variables |
| **Validation extraction** | `extractValidation()` gets file requirements | Partial | Missing pattern extraction |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/template-generator.ts`):
```typescript
// Line 52-57: No inputSchema/outputSchema in generated template
return {
  id: `tpl_${Date.now()}_...`,
  tasks,
  variables: [],  // No template-level variables!
  // No inputSchema!
  // No outputSchema!
}
```

**CHANGE NEEDED**:
1. Analyze execution trace to determine input shapes
2. Analyze output impulses to determine output shapes
3. Generate `inputSchema` and `outputSchema` in extracted templates
4. Parameterize prompts by detecting variable patterns

---

### Gap X.3: Boredom System Cluster-Locked

| Aspect | Current | Desired | Gap |
|--------|---------|---------|-----|
| **Activation** | Only starts if `clusterMode = true` | Should work in any deployment mode | Cluster-locked |
| **Task source** | Polls `/boredom-tasks` endpoint | Correct | None |
| **Fallback** | Disabled in single-pod mode | Should have local boredom queue | No local queue |

**Evidence** (from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/boredom.ts`):
```typescript
// Line 92-106: start() method
start(clusterMode = false): void {
  if (!clusterMode) {
    console.log("[Boredom] Not in cluster mode, boredom tasks disabled")
    return
  }
  // ...
}
```

**CHANGE NEEDED**:
1. Allow boredom in single-vessel mode with local task queue
2. Add configurable boredom behaviors: self-improvement, template testing, exploration
3. Rate-limit boredom activities to prevent runaway costs

---

## Summary: Priority Changes

### P0: Critical for Foundation Alignment

1. **Impulse metadata population** - Make metadata mandatory, implement in all resolvers
2. **Input/output schemas** - Add to ActivityTemplate, use for matching
3. **Ribosome schema extraction** - Generate schemas from execution traces

### P1: Required for Pillar 2 (Embedding)

4. **Library packaging** - Create `@minibob/core` package
5. **Offline mode** - Support local trace storage
6. **Code-to-impulse bridge** - Convert codebase analysis to impulses

### P2: Required for Pillar 3 (Vessel Development)

7. **Vessel lifecycle activities** - Create, deploy, manage vessels
8. **Unlock boredom** - Remove cluster-mode requirement
9. **AST-aware editing** - Tree-sitter integration

### P3: Quality Improvements

10. **Improvisation impulse tracking** - Track impulses in improvisation
11. **Bulk edit tool** - Multi-file atomic edits
12. **Resolver patterns** - Document and provide examples

---

## Implementation Roadmap

### Phase A: Impulse System Hardening (1-2 weeks)
- [ ] Define standard metadata shapes for common types
- [ ] Implement metadata extraction in MCP resolver
- [ ] Make pointer-mode the default in context formatting
- [ ] Add `process_impulse` tool integration

### Phase B: Schema-Based Activities (1-2 weeks)
- [ ] Add `inputSchema`/`outputSchema` to ActivityTemplate
- [ ] Update ribosome to extract schemas
- [ ] Implement shape-based activity matching
- [ ] Backend: Store and query by shape

### Phase C: Embedding SDK (2-3 weeks)
- [ ] Extract core as `@minibob/core`
- [ ] Add offline trace storage
- [ ] Create observe-only mode
- [ ] Document embedding patterns

### Phase D: Vessel Development (2-3 weeks)
- [ ] Create vessel development activities
- [ ] Implement vessel lifecycle management
- [ ] Unlock boredom for single-vessel mode
- [ ] Add vessel discovery/registry

---

## Appendix: File References

| File | Purpose | Key Functions |
|------|---------|---------------|
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/impulse.ts` | Impulse system | `createImpulse`, `loadImpulse`, `formatImpulsesForContext` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/activity.ts` | Activity executor | `ActivityExecutor.execute`, `executeTask` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/improviser.ts` | Goal improvisation | `GoalImproviser.improvise`, `saveTrace` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/template-extractor.ts` | Ribosome (from improvisation) | `extractTemplateFromImprovisation` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/template-generator.ts` | Ribosome (from execution) | `assembleTemplateFromExecution` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/mcp.ts` | Backend integration | `MCPClient`, `resolveImpulse`, `storeExecutionTrace` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/boredom.ts` | Autonomous operation | `BoredomTaskExecutor`, `start` |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/tools.ts` | Built-in tools | Tool definitions and handlers |
| `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/types.ts` | Type definitions | `Impulse`, `ActivityTemplate`, `ImpulseMetadata` |
