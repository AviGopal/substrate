# MCP Tool Surface Specification

**Version:** 1.0
**Component:** metabob-mcp
**Purpose:** Define the MCP tool interface that Claude/Cursor/etc. interact with

## Overview

The MCP server exposes 7 core analysis tools that enable AI agents to:
1. Discover and prioritize work
2. Search and understand existing problems
3. Document design decisions
4. Predict change impact and co-changes
5. Complete work with proper annotation

These tools form a **cohesive workflow** for AI-assisted development.

---

## Tool Contracts

### 1. get_priority_issues

**Intent:** Provide a shortlist of the most impactful next steps, phrased as actionable problems.

**Input Schema:**
```typescript
{
  limit?: number;          // Max issues to return (default: 5)
  severity?: string[];     // Filter: ["HIGH", "MEDIUM", "LOW"]
  category?: string[];     // Filter: ["bug", "security", "performance", "maintainability"]
  scope?: "session" | "project" | "org";  // Search scope (default: "session")
}
```

**Output Schema:**
```typescript
{
  issues: Array<{
    problem_id: string;
    file_path: string;
    category: string;
    severity: string;
    summary: string;           // One-line description
    impact_score: number;      // 0-100, computed from CPG
    affected_components: number; // Count of downstream dependencies
    priority_rank: number;     // 1-N, sorted by impact
  }>;
  total_issues: number;
}
```

**Backend Requirements:**
- Query `analysis_problems` filtered by session/project/org
- Join with CPG impact data to compute `impact_score`
- Rank by: `severity_weight * impact_score`
- Return top N results

**Side Effects:** None (read-only query)

#### Execution Context

This tool callable from:

a) **Template-driven activity:** Predefined `get-priority-issues.json` workflow that combines CPG impact scores with severity filtering

b) **Goal-seeking workflow:** Backend recommends this tool when goal includes "prioritize", "what to work on", or "next steps"

c) **Pure improvisation:** LLM chooses this tool as first step in exploratory analysis (discover what issues exist)

d) **Direct MCP call:** User/agent explicitly requests priority issues via MCP interface

#### Compiled Activity

**Template:** `activities/get-priority-issues.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Query `analysis_problems` filtered by severity/scope
- Task 2: Load CPG impact scores from cache/DB
- Task 3: Compute rank: `severity_weight * impact_score`
- Task 4: Sort and format results

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- Which tools called together? (e.g., `get_priority_issues` → `analyze_change_impact`)
- What sequence leads to successful problem resolution?

**Success Correlation:**
- Does using this tool first improve overall task success?
- Are high-impact issues actually fixed more often?

**Impulse Creation:**
- Tool output → `analysis_problem` impulse pointers for next step
- Context injection: "Here are the priority issues (impulse), now analyze impact"

**Pattern Extraction:**
- Successful sequences → templates (e.g., "Priority → Impact → Co-change → Fix")

---

### 2. search_codebase_issues

**Intent:** Find related issues via semantic search across the current project or organization.

**Input Schema:**
```typescript
{
  query: string;              // Natural language search query
  similarity_threshold?: number; // Min cosine similarity (default: 0.7)
  limit?: number;             // Max results (default: 10)
  scope?: "session" | "project" | "org";  // Search scope (default: "project")
  filters?: {
    severity?: string[];
    category?: string[];
    file_pattern?: string;    // Glob pattern (e.g., "src/**/*.ts")
  };
}
```

**Output Schema:**
```typescript
{
  issues: Array<{
    problem_id: string;
    file_path: string;
    category: string;
    severity: string;
    summary: string;
    description: string;
    similarity_score: number;  // 0-1, cosine similarity to query
    annotations?: Array<{      // Related annotations (if any)
      component_id: string;
      content: string;
      created_at: string;
    }>;
  }>;
  query_embedding: number[];   // For debugging/transparency
}
```

**Backend Requirements:**
- Generate embedding for `query` (ONNX model)
- Search `analysis_problems` table via vector similarity
- Filter by scope (session_id, project_id, org_id)
- Join with `component_annotations` if available
- Return results sorted by similarity

**Side Effects:**
- Update online learning model (track query → clicked result pairs)
- Store query embedding for future optimization

#### Execution Context

This tool callable from:

a) **Template-driven activity:** `search-codebase.json` template that combines semantic search with filters

b) **Goal-seeking workflow:** Backend recommends when goal includes "find similar", "related issues", or "has this been seen before"

c) **Pure improvisation:** LLM explores codebase by running multiple searches with different queries (iterative refinement)

d) **Direct MCP call:** User explicitly searches for issues matching criteria

#### Compiled Activity

**Template:** `activities/search-codebase.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Generate embedding for query (ONNX model)
- Task 2: FAISS search for similar issues
- Task 3: Filter by scope and criteria
- Task 4: Join with annotations (if available)
- Task 5: Record query for learning

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- What queries are most common? (guide embedding model optimization)
- Which search → fix sequences succeed?

**Success Correlation:**
- Do searches with high similarity scores lead to successful fixes?
- Are annotated components resolved faster?

**Impulse Creation:**
- Search results → `analysis_problem` impulses for context
- Annotations → `component_annotation` impulses for design rationale

**Pattern Extraction:**
- "Search → Annotate → Fix" becomes template if repeated successfully

---

### 3. annotate_component

**Intent:** Attach design rationale and resolved challenges to specific code components. These annotations surface during analysis and improve future problem identification.

**Input Schema:**
```typescript
{
  component_id: string;       // Format: "file_path::component_name"
  annotation: string;         // Markdown-formatted explanation
  annotation_type: "design_decision" | "resolved_challenge" | "implementation_note" | "warning";
  related_problem_id?: string; // Link to problem that prompted this annotation
  tags?: string[];            // Searchable tags (e.g., ["auth", "performance"])
}
```

**Output Schema:**
```typescript
{
  annotation_id: string;
  component_id: string;
  content: string;
  annotation_type: string;
  created_at: string;
  created_by: string;         // session_id or user identifier
  related_problem_id?: string;
  tags: string[];
}
```

**Backend Requirements:**
- Insert into `component_annotations` table
- Link to `code_components` table
- If `related_problem_id` provided, create bidirectional link
- Update component metadata (last_annotated_at)
- Trigger re-embedding for semantic search

**Side Effects:**
- Component becomes "documented" (affects future analysis)
- Annotations surface in `search_codebase_issues` results
- May influence problem severity scoring (documented components = lower risk)

#### Execution Context

This tool callable from:

a) **Template-driven activity:** `annotate-component.json` workflow that validates component exists, creates annotation, updates embeddings

b) **Goal-seeking workflow:** Backend recommends after successful problem resolution ("document what you learned")

c) **Pure improvisation:** LLM decides to annotate during work (captures design rationale proactively)

d) **Direct MCP call:** User explicitly annotates component with design decision or note

#### Compiled Activity

**Template:** `activities/annotate-component.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Validate component exists in CPG
- Task 2: Insert into `component_annotations` table
- Task 3: Link to `code_components` table
- Task 4: Update component metadata
- Task 5: Trigger embedding re-generation

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- When do developers annotate? (after fix? during exploration?)
- Which annotation types most useful? (design_decision vs warning)

**Success Correlation:**
- Do annotated components have fewer future issues?
- Are annotations referenced in subsequent problem resolution?

**Impulse Creation:**
- Annotation content → `component_annotation` impulse for future tasks
- Related problem → `analysis_problem` impulse creates bidirectional link

**Pattern Extraction:**
- "Fix → Annotate → Mark Complete" becomes standard resolution workflow

---

### 4. suggest_related_changes

**Intent:** Predict other parts of the codebase that need amendment to "complete the commit" using co-change embeddings and online learning.

**Input Schema:**
```typescript
{
  changed_files: string[];    // Files modified in current work
  diff?: string;              // Optional: git diff for finer-grained analysis
  max_suggestions?: number;   // Max files to suggest (default: 10)
  confidence_threshold?: number; // Min confidence 0-1 (default: 0.6)
}
```

**Output Schema:**
```typescript
{
  suggestions: Array<{
    file_path: string;
    confidence: number;        // 0-1, based on co-change model
    reason: string;            // Human-readable explanation
    cochange_frequency: number; // Historical co-change count
    embedding_similarity: number; // Semantic similarity to changed files
    affected_components: string[]; // Specific functions/classes
  }>;
  model_version: string;       // Online learning model version
}
```

**Backend Requirements:**
- Load co-change embedding model (ONNX)
- Generate embeddings for `changed_files`
- Query FAISS index for similar files
- Load historical co-change patterns from `cochange_patterns` table
- Hybrid score: `0.6 * embedding_similarity + 0.4 * cochange_frequency`
- Filter by confidence threshold
- **Online learning:** Store (changed_files, actual_changed_files) for model update

**Side Effects:**
- Store co-change event in `cochange_patterns` (for online learning)
- Update project-specific model weights (per-project learning)
- Increment cochange_frequency counters

#### Execution Context

This tool callable from:

a) **Template-driven activity:** `suggest-cochanges.json` workflow that combines embedding similarity with historical co-change patterns

b) **Goal-seeking workflow:** Backend recommends when goal includes "related changes", "what else", or "complete the commit"

c) **Pure improvisation:** LLM explores co-change patterns iteratively (try suggestion, check if it makes sense, refine)

d) **Direct MCP call:** User explicitly asks for co-change suggestions during implementation

#### Compiled Activity

**Template:** `activities/suggest-cochanges.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Generate embeddings for changed files
- Task 2: FAISS search for similar files
- Task 3: Load historical co-change patterns
- Task 4: Compute hybrid scores (embedding + frequency)
- Task 5: Record co-change event for learning

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- Which suggestions are actually followed?
- What hybrid score weights work best? (currently 60% embedding, 40% frequency)

**Success Correlation:**
- Do high-confidence suggestions lead to complete commits?
- Are suggested changes actually related (validated by tests passing)?

**Impulse Creation:**
- Co-change suggestions → `file` impulses for next task (review suggested files)
- Historical patterns → `cochange_pattern` impulses for context

**Pattern Extraction:**
- Successful co-change sequences → templates ("auth changes always need test updates")

---

### 5. analyze_change_impact

**Intent:** Traverse the CPG based on a diff and identify spots that require review but haven't been edited yet.

**Input Schema:**
```typescript
{
  changed_files: string[];    // Files being modified
  diff?: string;              // Optional: full git diff
  max_depth?: number;         // CPG traversal depth (default: 3)
  analysis_type?: "forward" | "backward" | "both"; // Dependency direction
}
```

**Output Schema:**
```typescript
{
  impact_analysis: {
    direct_dependencies: Array<{
      file_path: string;
      component_id: string;
      relationship: "calls" | "imports" | "inherits" | "data_flow";
      risk_level: "HIGH" | "MEDIUM" | "LOW";
    }>;
    indirect_dependencies: Array<{
      file_path: string;
      component_id: string;
      path_from_change: string[]; // Chain of dependencies
      depth: number;
      risk_level: "HIGH" | "MEDIUM" | "LOW";
    }>;
    affected_tests: Array<{
      file_path: string;
      test_name: string;
      coverage_type: "unit" | "integration" | "e2e";
    }>;
  };
  total_affected_components: number;
  review_required: string[]; // Files that need review (not in changed_files)
}
```

**Backend Requirements:**
- Parse `diff` or use `changed_files` to identify modified components
- Load CPG from `cpg-inference-ts` library
- Traverse graph forward (dependencies) and/or backward (dependents)
- Identify components at each depth level
- Compute risk level based on:
  - Depth from change
  - Component criticality (test coverage, usage frequency)
  - Annotation presence (documented = lower risk)
- Exclude files already in `changed_files`

**Side Effects:**
- Cache impact analysis result (for audit/learning)
- Update component usage statistics

#### Execution Context

This tool callable from:

a) **Template-driven activity:** `analyze-impact.json` workflow that traverses CPG forward/backward to identify affected components

b) **Goal-seeking workflow:** Backend recommends when goal includes "impact", "what breaks", or "which tests needed"

c) **Pure improvisation:** LLM explores impact interactively (start at depth 1, expand to depth 3 if interesting)

d) **Direct MCP call:** User explicitly analyzes impact before making changes

#### Compiled Activity

**Template:** `activities/analyze-impact.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Parse diff or identify changed components
- Task 2: Load CPG from cache/storage
- Task 3: Traverse forward (dependencies) and backward (dependents)
- Task 4: Compute risk levels by depth and criticality
- Task 5: Identify tests requiring updates

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- What max_depth is most useful? (default 3, but do people increase it?)
- Forward vs backward vs both analysis?

**Success Correlation:**
- Does impact analysis reduce unexpected test failures?
- Are high-risk components actually problematic?

**Impulse Creation:**
- Impact analysis results → `impact_analysis` impulses for review
- Affected components → `code_component` impulses for detailed examination

**Pattern Extraction:**
- "Impact → Review → Test → Commit" becomes standard workflow

---

### 6. mark_problem_complete

**Intent:** Remove a problem from the active list and auto-create an annotation documenting the fix.

**Input Schema:**
```typescript
{
  problem_id: string;
  resolution_summary: string; // Brief explanation of fix
  fixed_in_commit?: string;   // Git commit hash
  created_annotation?: boolean; // Auto-create annotation (default: true)
}
```

**Output Schema:**
```typescript
{
  problem_id: string;
  status: "resolved";
  resolved_at: string;
  resolution_summary: string;
  annotation_created?: {
    annotation_id: string;
    component_id: string;
    content: string;          // Auto-generated from problem + resolution
  };
}
```

**Backend Requirements:**
- Update `analysis_problems` table: set `status = 'resolved'`, `resolved_at = now()`
- Store `resolution_summary` and `fixed_in_commit`
- If `created_annotation = true`:
  - Extract component_id from problem
  - Generate annotation content:
    ```
    **Resolved Issue:** {problem.summary}
    **Fix:** {resolution_summary}
    **Severity:** {problem.severity}
    **Fixed in:** {fixed_in_commit}
    ```
  - Insert into `component_annotations` with type="resolved_challenge"
- Link problem ↔ annotation bidirectionally

**Side Effects:**
- Problem removed from active list
- Annotation created (improves future analysis)
- Online learning: mark problem as "resolved" (affects future severity scoring)

#### Execution Context

This tool callable from:

a) **Template-driven activity:** `mark-complete.json` workflow that updates problem status and auto-generates annotation

b) **Goal-seeking workflow:** Backend recommends at end of fix workflow ("close the loop")

c) **Pure improvisation:** LLM decides problem is resolved during work (proactive completion)

d) **Direct MCP call:** User explicitly marks problem as resolved

#### Compiled Activity

**Template:** `activities/mark-complete.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Update `analysis_problems` status to resolved
- Task 2: Generate annotation from problem + resolution
- Task 3: Insert annotation (if enabled)
- Task 4: Create bidirectional link
- Task 5: Update learning model

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- How long between problem detection and resolution?
- Are annotations auto-generated or manually added?

**Success Correlation:**
- Do marked-complete problems stay resolved? (check for regression)
- Are resolution summaries useful in future similar issues?

**Impulse Creation:**
- Resolution summary → `component_annotation` impulse for future reference
- Commit hash → ability to review exact fix code

**Pattern Extraction:**
- "Priority → Fix → Test → Mark Complete → Annotate" becomes standard resolution workflow

---

### 7. generate_implementation_spec

**Intent:** Generate an implementation specification based on CPG data flow and annotated components.

**Input Schema:**
```typescript
{
  goal: string;               // What to implement (natural language)
  entry_points?: string[];    // Starting components (e.g., ["api/users.ts::createUser"])
  max_depth?: number;         // CPG traversal depth (default: 5)
  include_patterns?: boolean; // Include design patterns found (default: true)
}
```

**Output Schema:**
```typescript
{
  specification: {
    goal: string;
    components_to_modify: Array<{
      component_id: string;
      file_path: string;
      reason: string;          // Why this component needs changes
      annotations: string[];   // Relevant annotations from this component
      data_flow: string[];     // Inputs/outputs
    }>;
    components_to_create: Array<{
      suggested_name: string;
      file_path: string;
      reason: string;
      similar_components: string[]; // For pattern reference
    }>;
    design_patterns: Array<{
      pattern_name: string;
      usage_examples: string[]; // Existing usage in codebase
      recommendation: string;
    }>;
    data_flow_diagram: string; // ASCII or Mermaid diagram
    implementation_order: string[]; // Suggested sequence
  };
  confidence: number;         // 0-1, based on annotation coverage
}
```

**Backend Requirements:**
- Parse `goal` to extract intent
- If `entry_points` provided, start CPG traversal there
- Otherwise, use semantic search to find relevant components
- Traverse CPG to understand data flow
- Load annotations for all involved components
- Identify design patterns (structural matching in CPG)
- Generate recommended implementation order (topological sort)
- Produce data flow diagram (nodes = components, edges = dependencies)

**Side Effects:**
- Cache generated spec (for learning)
- Track which specs led to successful implementations

#### Execution Context

This tool callable from:

a) **Template-driven activity:** `generate-spec.json` workflow that combines CPG traversal, annotation lookup, and pattern detection

b) **Goal-seeking workflow:** Backend recommends when goal is complex implementation ("how to implement feature X")

c) **Pure improvisation:** LLM explores CPG and annotations to build spec step-by-step (iterative refinement)

d) **Direct MCP call:** User explicitly requests implementation specification for goal

#### Compiled Activity

**Template:** `activities/generate-spec.json`

**Generated via:** `compile-spec-to-activity` (Phase 1 meta-activity)

**Status:** ❌ Meta-activity doesn't exist yet

**When implemented:** This MCP tool spec will compile to executable activity template with:
- Task 1: Parse goal and extract intent
- Task 2: Find entry points (semantic search or provided)
- Task 3: Traverse CPG to understand data flow
- Task 4: Load annotations for involved components
- Task 5: Identify design patterns
- Task 6: Generate implementation order (topological sort)

**Link:** [openspec/meta/meta-activities-catalog.md#compile-spec-to-activity](../../../meta/meta-activities-catalog.md#compile-spec-to-activity)

#### Learning Integration

**Tool Usage Tracking:**
- Which specs are actually followed during implementation?
- What max_depth for CPG traversal is useful?

**Success Correlation:**
- Do generated specs lead to successful implementations?
- Are specs with high annotation coverage more accurate?

**Impulse Creation:**
- Generated spec → `implementation_spec` impulse for execution phase
- Design patterns → `design_pattern` impulses for reference
- Annotations → `component_annotation` impulses for context

**Pattern Extraction:**
- "Generate Spec → Follow Order → Implement → Validate" becomes implementation workflow

---

## Tool Relationships

```
Workflow Diagram:
═══════════════════════════════════════════════════════════

1. get_priority_issues
   ↓
2. search_codebase_issues (find related context)
   ↓
3. generate_implementation_spec (plan the fix)
   ↓
4. analyze_change_impact (before making changes)
   ↓
5. suggest_related_changes (during implementation)
   ↓
6. annotate_component (document decisions)
   ↓
7. mark_problem_complete (close the loop)
```

## Common Parameters

All tools support:
- `session_id`: Automatically injected from MCP session context
- `project_id`: Resolved from session (if available)
- `org_id`: Resolved from session (if available)

## Error Handling

All tools return errors in consistent format:

```typescript
{
  error: {
    code: string;           // e.g., "COMPONENT_NOT_FOUND"
    message: string;        // Human-readable
    details?: object;       // Additional context
  }
}
```

Common error codes:
- `SESSION_EXPIRED`: Session token invalid
- `COMPONENT_NOT_FOUND`: Component ID doesn't exist in CPG
- `INSUFFICIENT_DATA`: Not enough analysis data (e.g., CPG not built)
- `SCOPE_FORBIDDEN`: Requested scope exceeds permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Performance Targets

| Tool | P50 Latency | P99 Latency | Notes |
|------|-------------|-------------|-------|
| get_priority_issues | <100ms | <300ms | Simple query + sort |
| search_codebase_issues | <200ms | <500ms | Embedding lookup + FAISS |
| annotate_component | <50ms | <150ms | Simple insert |
| suggest_related_changes | <300ms | <800ms | Embedding + model inference |
| analyze_change_impact | <400ms | <1s | CPG traversal (depth-dependent) |
| mark_problem_complete | <100ms | <250ms | Update + conditional insert |
| generate_implementation_spec | <1s | <3s | Complex CPG analysis |

## Version History

- **v1.0** (2026-03-23): Initial specification
