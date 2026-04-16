# minibob-context-acquisition Capability Specification

> **Aligned with**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
> **Capability**: minibob-context-acquisition
> **Change**: vessel-integration-standardization

## Executive Summary

This capability adds context acquisition activities to MiniBob, enabling systematic extraction of execution context from traces, documentation, and codebase structure. These activities produce impulses that feed into goal-seeking workflows, following the "metadata first, content later" and "resolvers live where data lives" principles.

**Core Pattern**: Context acquisition activities transform raw data sources into shaped impulses that reasoners can use for decision-making without loading full content.

---

## Foundation Alignment

### Key Principles Applied

| Principle | Application in this Capability |
|-----------|-------------------------------|
| **Impulses Are Universal Data** | Error logs, requirements docs, and codebase structure all become impulses with metadata |
| **Activities Constrain Search** | Three specific activities constrain context gathering to known patterns |
| **Resolvers Live Where Data Lives** | MiniBob resolves local files/traces, backend resolves stored traces |
| **Metadata First, Content Later** | Activities create impulses with shape/summary, load content on-demand |
| **Record Everything** | All context acquisition executions traced for learning |
| **Learn From Traces** | Thompson Sampling learns which context sources help goal completion |

### Critical Boundaries

```
MiniBob (VESSEL)                      Activity-API (BACKEND)
═══════════════                       ═══════════════════════
✓ Read local files                    ✓ Store execution traces
✓ Parse git history                   ✓ Resolve trace impulses
✓ Index codebase structure            ✓ Learn context relevance
✓ Create context impulses             ❌ NOT: Parse files
✓ Resolve file impulses               ❌ NOT: Index codebases
❌ NOT: Store traces persistently     ❌ NOT: Access filesystem
```

---

## ADDED Requirements

### Requirement: context:error-log activity

The system SHALL provide a context:error-log activity that extracts error information from execution traces and creates structured error-log impulses.

#### Scenario: Extract error from failed execution trace

- **WHEN** context:error-log activity receives executionTraceId variable pointing to failed execution
- **THEN** activity loads trace from backend, extracts stderr/error messages, creates error-log impulse with shape metadata (error_type, stack_trace, context_files)

#### Scenario: Extract error from local log file

- **WHEN** context:error-log activity receives logFilePath variable pointing to local file
- **THEN** activity reads file, parses error patterns (stack traces, exceptions, error codes), creates error-log impulse with extracted metadata

#### Scenario: Error log impulse includes relevant context

- **WHEN** context:error-log creates impulse from execution trace
- **THEN** impulse metadata includes files_modified, command_executed, working_directory from trace's stateTransition field

#### Scenario: Error log impulse budget respected

- **WHEN** error log content exceeds configured budget (default 3000 tokens)
- **THEN** impulse includes summary with error type and location, full content loaded only when resolved

#### Scenario: Multiple errors in single trace

- **WHEN** execution trace contains multiple task failures
- **THEN** activity creates separate error-log impulse for each distinct error with task_id linkage

#### Scenario: No error found in trace

- **WHEN** context:error-log activity processes successful execution trace
- **THEN** activity completes with warning, creates no impulses, logs "trace_id had no errors"

#### Scenario: Error log traced for learning

- **WHEN** context:error-log activity completes successfully
- **THEN** execution trace recorded with input impulse (execution_trace pointer) and output impulses (error_log shapes)

### Requirement: context:requirements activity

The system SHALL provide a context:requirements activity that extracts structured requirements from documentation files and creates requirement impulses.

#### Scenario: Extract requirements from markdown file

- **WHEN** context:requirements activity receives filePath variable pointing to .md file with requirement sections
- **THEN** activity parses document, extracts requirements (SHALL/SHOULD statements), creates requirement impulse per requirement with metadata (priority, component, acceptance_criteria)

#### Scenario: Extract requirements from spec directory

- **WHEN** context:requirements activity receives directoryPath variable pointing to openspec directory
- **THEN** activity recursively reads spec.md files, aggregates requirements, creates requirement impulses grouped by capability

#### Scenario: Requirements linked to source files

- **WHEN** requirement document references source files (via file paths or code blocks)
- **THEN** requirement impulse metadata includes referenced_files array for traceability

#### Scenario: Requirements impulse includes scenarios

- **WHEN** requirement has scenario sections with WHEN/THEN format
- **THEN** impulse metadata includes scenarios array with condition and expected_outcome fields

#### Scenario: Requirements budget management

- **WHEN** requirements document exceeds 5000 tokens
- **THEN** impulse contains summary of requirement count and categories, full content loadable via resolve

#### Scenario: No requirements found in document

- **WHEN** context:requirements processes file without SHALL/SHOULD statements
- **THEN** activity completes with warning, creates memo impulse with document summary instead

#### Scenario: Requirements traced for goal alignment

- **WHEN** context:requirements activity completes
- **THEN** execution trace includes extracted_count, source_files, and requirement shapes in output impulses

### Requirement: context:codebase activity

The system SHALL provide a context:codebase activity that maps repository structure and creates codebase-structure impulses.

#### Scenario: Map repository file tree

- **WHEN** context:codebase activity receives repositoryPath variable
- **THEN** activity traverses directory tree (respecting .gitignore), creates codebase-structure impulse with file count, directory structure, and primary languages

#### Scenario: Identify entry points and key files

- **WHEN** context:codebase maps TypeScript project
- **THEN** impulse metadata includes entry_points (files with export main or CLI args parsing), config_files (package.json, tsconfig.json), test_directories

#### Scenario: Module dependency graph metadata

- **WHEN** context:codebase analyzes import statements in source files
- **THEN** impulse metadata includes dependency_graph with module-to-module edges (file paths only, not full content)

#### Scenario: Codebase statistics in metadata

- **WHEN** context:codebase completes indexing
- **THEN** impulse metadata includes total_files, total_lines, file_type_distribution, largest_files (paths only)

#### Scenario: Lazy load file contents

- **WHEN** codebase-structure impulse is created
- **THEN** only metadata stored, individual file contents accessible via file impulse resolution when needed

#### Scenario: Git history context integration

- **WHEN** context:codebase runs in git repository
- **THEN** impulse metadata includes recent_commits_count, active_branches, most_changed_files (from git log --stat)

#### Scenario: Codebase impulse budget scoping

- **WHEN** repository contains more than 10,000 files
- **THEN** activity focuses on source directories (src/, lib/), excludes node_modules, build artifacts, creates summary impulse

#### Scenario: Incremental codebase updates

- **WHEN** context:codebase runs second time in same repository
- **THEN** activity detects existing codebase-structure impulse, updates only changed files since last index

#### Scenario: Codebase mapping traced

- **WHEN** context:codebase activity completes
- **THEN** execution trace includes indexed_file_count, repository_path, and codebase-structure impulse in outputs

### Requirement: Context impulses integrate with goal-seeking

The system SHALL integrate context acquisition activities with the goal-seeking workflow to enable automatic context gathering.

#### Scenario: Error context triggers error-log acquisition

- **WHEN** goal mentions "debug", "fix error", or "investigate failure" and execution trace ID provided
- **THEN** goal-processor automatically recommends context:error-log activity before solution activities

#### Scenario: Feature development triggers requirements acquisition

- **WHEN** goal mentions "implement", "add feature", or "create" and spec directory exists
- **THEN** goal-processor recommends context:requirements activity to load relevant specs

#### Scenario: Code refactoring triggers codebase acquisition

- **WHEN** goal mentions "refactor", "reorganize", or "restructure" and repository path provided
- **THEN** goal-processor recommends context:codebase activity to understand current structure

#### Scenario: Context impulses available for subsequent activities

- **WHEN** context acquisition activity completes successfully
- **THEN** created impulses added to session impulse store, available for injection into subsequent activity prompts

#### Scenario: Missing context detected by state-space-manager

- **WHEN** goal-processor evaluates activities but context impulses missing
- **THEN** state-space-manager suggests context acquisition activities via missingImpulses array

#### Scenario: Context relevance tracked for learning

- **WHEN** goal completes successfully after context acquisition
- **THEN** impulse_relevance_metrics updated for context impulses used, improving future recommendations

### Requirement: Context activity templates in backend

The system SHALL store context acquisition activity templates in metabob-activity-api for Thompson Sampling selection.

#### Scenario: context:error-log template registered

- **WHEN** backend receives context:error-log template registration
- **THEN** template stored with category "context-acquisition", input_shapes ["execution_trace" OR "file"], output_shapes ["error_log"]

#### Scenario: context:requirements template registered

- **WHEN** backend receives context:requirements template registration
- **THEN** template stored with category "context-acquisition", input_shapes ["file" OR "directory"], output_shapes ["requirement"]

#### Scenario: context:codebase template registered

- **WHEN** backend receives context:codebase template registration
- **THEN** template stored with category "context-acquisition", input_shapes ["directory"], output_shapes ["codebase_structure"]

#### Scenario: Thompson Sampling for context activities

- **WHEN** goal-processor requests context activities with input_shapes ["execution_trace"]
- **THEN** backend returns context:error-log variants ranked by success rate via Thompson Sampling

#### Scenario: Context activity success criteria

- **WHEN** context acquisition activity completes and creates at least one output impulse
- **THEN** execution marked as success, Thompson Sampling alpha incremented

#### Scenario: Context activity failure criteria

- **WHEN** context acquisition activity throws error or creates zero output impulses
- **THEN** execution marked as failure, Thompson Sampling beta incremented

### Requirement: Context impulse shapes defined

The system SHALL define standard shapes for context impulses with validation schemas.

#### Scenario: error_log shape validation

- **WHEN** impulse created with shape "error_log"
- **THEN** metadata MUST include error_type (string), occurred_at (timestamp), and MAY include stack_trace, context_files, command

#### Scenario: requirement shape validation

- **WHEN** impulse created with shape "requirement"
- **THEN** metadata MUST include requirement_text (string), priority (SHALL|SHOULD|MAY), and MAY include component, scenarios, referenced_files

#### Scenario: codebase_structure shape validation

- **WHEN** impulse created with shape "codebase_structure"
- **THEN** metadata MUST include total_files (number), file_types (object), root_path (string), and MAY include entry_points, dependency_graph, recent_commits

#### Scenario: Shape registry stores context shapes

- **WHEN** metabob-activity-api initializes
- **THEN** error_log, requirement, and codebase_structure shapes registered in shape registry with validation schemas

### Requirement: Context acquisition error handling

The system SHALL gracefully handle errors during context acquisition and provide actionable feedback.

#### Scenario: Execution trace not found

- **WHEN** context:error-log receives executionTraceId that does not exist in backend
- **THEN** activity fails with clear error "Execution trace not found: {id}", suggests checking trace ID or using local log file

#### Scenario: File not accessible

- **WHEN** context:requirements receives filePath that cannot be read (permissions, not exists)
- **THEN** activity fails with file system error, includes absolute path and permission info

#### Scenario: Directory too large

- **WHEN** context:codebase encounters directory with >50,000 files
- **THEN** activity warns, processes first 50,000 files sorted by modification time, logs truncation

#### Scenario: Invalid requirement format

- **WHEN** context:requirements parses document without proper structure (no sections, no SHALL/SHOULD)
- **THEN** activity creates warning impulse, includes document summary as memo instead of failing

#### Scenario: Git repository not initialized

- **WHEN** context:codebase runs in directory without .git
- **THEN** activity proceeds without git context, omits recent_commits from metadata, logs info message

#### Scenario: Context acquisition timeout

- **WHEN** context activity exceeds 5 minute execution limit
- **THEN** activity terminates, creates partial impulse with what was indexed, marks execution as failure for learning

### Requirement: Context impulse resolution

The system SHALL implement impulse resolution for context shapes in both MiniBob and backend.

#### Scenario: MiniBob resolves file-based context impulses

- **WHEN** MiniBob receives impulse with pointer type "file" and shape "requirement"
- **THEN** MiniBob reads file content, parses according to requirement shape, returns structured data

#### Scenario: Backend resolves trace-based context impulses

- **WHEN** backend receives resolution request for impulse with pointer type "execution_trace" and shape "error_log"
- **THEN** backend loads trace from SurrealDB, extracts error information, returns structured error data

#### Scenario: Context impulse lazy loading

- **WHEN** activity prompt includes context impulse but budget not exceeded
- **THEN** impulse remains unloaded (content null), only metadata injected into prompt

#### Scenario: Context impulse forced loading

- **WHEN** activity explicitly calls loadImpulse on context impulse
- **THEN** appropriate resolver (MiniBob or backend) loads full content, updates impulse.content field

#### Scenario: Context impulse caching

- **WHEN** same context impulse resolved multiple times in session
- **THEN** content cached after first resolution, subsequent calls return cached data without re-reading

---

## Implementation Notes

### Activity Template Structure

Each context acquisition activity follows this pattern:

```typescript
{
  id: "context:error-log",
  name: "Extract error log context",
  category: "context-acquisition",
  input_shapes: ["execution_trace", "file"],
  output_shapes: ["error_log"],
  tasks: [
    {
      id: "load-source",
      description: "Load execution trace or log file",
      resolver: "file",  // or "trace_store" for backend
      validation: { required: ["content"] }
    },
    {
      id: "extract-errors",
      description: "Parse and extract error information",
      resolver: "llm",  // LLM understands error patterns
      params: {
        systemPrompt: "Extract error information and create structured metadata"
      }
    },
    {
      id: "create-impulse",
      description: "Create error_log impulse with metadata",
      resolver: "impulse",
      params: {
        shape: "error_log",
        budget: 3000
      }
    }
  ]
}
```

### Impulse Shape Examples

**error_log impulse**:
```typescript
{
  id: "error_abc123",
  pointer: { type: "execution_trace", trace_id: "exec_456" },
  metadata: {
    shape: "error_log",
    error_type: "TypeError",
    occurred_at: "2026-04-10T14:23:00Z",
    stack_trace: "at file.ts:42:10...",
    context_files: ["src/auth.ts", "src/lib/database.ts"],
    command: "bun test auth.test.ts",
    summary: "Null reference error in user authentication"
  },
  budget: 3000,
  priority: "high",
  loaded: false,
  content: null
}
```

**requirement impulse**:
```typescript
{
  id: "req_xyz789",
  pointer: { type: "file", path: "openspec/.../spec.md" },
  metadata: {
    shape: "requirement",
    requirement_text: "The system SHALL validate API keys via identity service",
    priority: "SHALL",
    component: "authentication",
    scenarios: [
      {
        condition: "Valid API key provided",
        expected_outcome: "Request authenticated, org_id extracted"
      }
    ],
    referenced_files: ["src/lib/auth.ts"]
  },
  budget: 2000,
  loaded: false,
  content: null
}
```

**codebase_structure impulse**:
```typescript
{
  id: "codebase_minibob",
  pointer: { type: "directory", path: "/repos/minibob" },
  metadata: {
    shape: "codebase_structure",
    total_files: 127,
    total_lines: 12450,
    file_types: { "ts": 115, "json": 10, "md": 2 },
    root_path: "/repos/minibob",
    entry_points: ["src/index.ts", "src/repl.ts"],
    dependency_graph: {
      "src/activity.ts": ["src/types.ts", "src/llm.ts", "src/tools.ts"],
      "src/goal-processor.ts": ["src/activity.ts", "src/impulse.ts"]
    },
    recent_commits: 15,
    most_changed_files: ["src/activity.ts", "src/types.ts"],
    summary: "TypeScript project with 127 files, primary modules: activity, impulse, llm"
  },
  budget: 5000,
  loaded: false,
  content: null
}
```

### Integration with Goal-Seeking

Goal-processor enhanced to detect context needs:

```typescript
async function processGoal(goal: string, variables: Record<string, unknown>) {
  // 1. Analyze goal for context needs
  const contextNeeds = await analyzeContextNeeds(goal, variables)

  // 2. If context missing, run acquisition activities first
  if (contextNeeds.length > 0) {
    for (const need of contextNeeds) {
      await executeContextActivity(need.activity, need.variables)
    }
  }

  // 3. Proceed with normal goal-seeking with context available
  return await executeGoalSeekingWorkflow(goal)
}
```

### File Locations

**MiniBob**:
- Activity templates: `repos/minibob/src/embedded-templates/context-acquisition/`
- Context resolvers: `repos/minibob/src/resolvers/context-resolver.ts`
- Shape validators: `repos/minibob/src/validators/validators/context.ts`

**Activity-API**:
- Shape registry: `repos/metabob-activity-api/src/shapes/context-shapes.ts`
- Trace resolver: `repos/metabob-activity-api/src/routes/impulses.ts` (resolve endpoint)

---

## Success Criteria

### Context Acquisition Works

- [ ] context:error-log extracts errors from execution traces
- [ ] context:requirements parses spec files and creates requirement impulses
- [ ] context:codebase indexes repository structure efficiently
- [ ] All three activities create properly shaped impulses with metadata
- [ ] Activities recorded as execution traces for Thompson Sampling

### Integration with Goal-Seeking

- [ ] Goal "debug the auth error" automatically runs context:error-log
- [ ] Goal "implement user signup" automatically runs context:requirements
- [ ] Goal "refactor the API" automatically runs context:codebase
- [ ] Context impulses available to subsequent activities in session

### Learning Loop

- [ ] Successful context acquisition increments Thompson Sampling alpha
- [ ] Failed context acquisition increments beta
- [ ] Impulse relevance tracked when context helps goal completion
- [ ] Recommendations improve over time (better context suggestions)

### Error Handling

- [ ] Missing traces/files produce clear error messages
- [ ] Large repositories handled with truncation warnings
- [ ] Invalid formats fall back to memo impulses gracefully

---

## Dependencies

**Required for Implementation**:
- Shape registry capability (for context shape definitions)
- Impulse resolution in backend (for trace-based impulses)
- Thompson Sampling in backend (for activity selection)
- Goal-processor enhancement (for automatic context detection)

**Optional Enhancements**:
- Analysis-API integration (for deeper codebase analysis)
- Git history resolver (for richer codebase context)
- Embedding-based requirement search (for semantic requirement matching)

---

## Risks and Mitigations

### Risk: Large files overwhelm token budget

**Mitigation**: Use budget limits, create summary-only impulses, lazy load content only when explicitly needed

### Risk: Context acquisition too slow

**Mitigation**: Parallel execution of context activities, caching of codebase indexes, incremental updates

### Risk: LLM over-used for simple parsing

**Mitigation**: Use deterministic parsers for structured formats (markdown, JSON), reserve LLM for ambiguous error interpretation

### Risk: Context impulses not used by activities

**Mitigation**: Track impulse relevance via learning loop, adjust recommendations based on actual usage patterns

---

## Total Estimates

| Metric | Value |
|--------|-------|
| New activity templates | 3 |
| New impulse shapes | 3 |
| New resolvers | 2 (context-resolver, trace-resolver enhancement) |
| New validators | 3 (one per shape) |
| Estimated LOC (MiniBob) | ~800 |
| Estimated LOC (Activity-API) | ~400 |
| Implementation time | 3-5 days |
