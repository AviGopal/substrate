# MCP Analysis Tools Contract

**Contract ID:** `mcp-analysis-tools`
**Version:** 1.0.0
**Provider:** metabob-mcp
**Owner:** Contract Agent (MCP Tools)
**Status:** Draft

---

## Purpose

Defines the 7 MCP tools that expose analysis capabilities to AI agents (Claude, Cursor, etc.). These tools provide a unified interface for code analysis, annotation, and co-change prediction.

## Domain Context

**Domain:** Analysis & Understanding

**Vessel (Instructional State):**
- Analysis activity templates that use these tools
- Template structure defines which tools to call and when
- Example: "Analyze codebase health" template calls `get_priority_issues` → `search_codebase_issues` → `analyze_change_impact`

**Becoming (Process-of-Becoming):**
- CPG build process + LLM analyzing code
- Tree-sitter parsing → graph construction → embedding generation → pattern recognition
- The transformation happens when raw code becomes structured analysis results
- Cannot be stored, only observed through traces

**Instance (Functional State):**
- Issues detected (in `analysis_problems` table)
- Annotations created (in `component_annotations` table)
- Predictions generated (co-change suggestions, impact analysis results)
- Specific analysis outcomes at specific moments

**Tools (Execution Mechanisms):**
- `cpg_build`: Constructs code property graph from source
- `cpg_query`: Traverses graph for dependencies
- `embedding_search`: Semantic similarity via ONNX models
- `get_priority_issues`, `search_codebase_issues`, etc.: High-level analysis operations

**Impulses (Context Data):**
- CPG data (lazy-loaded graph structures)
- Annotations (design rationale from past work)
- Analysis results (cached predictions)
- File content (code being analyzed)

**Key Insight:** The vessel (template) specifies WHAT to analyze. The becoming (CPG + LLM) performs the transformation. The instance (detected issues) is the realized result. Tools enable the becoming.

## Improvisation Support

All tools are designed for use in pure improvisation mode:

**Step-by-Step Creative Emergence:**
- LLM can call any tool in any order
- No predefined workflow required
- Tools provide enough context for LLM to figure out next step
- Example workflow discovered by LLM:
  1. `get_priority_issues()` → finds "memory leak in component X"
  2. `search_codebase_issues(query: "memory management")` → finds related patterns
  3. `analyze_change_impact(changed_files: ["x.ts"])` → sees what else breaks
  4. `generate_implementation_spec(goal: "fix memory leak")` → creates fix plan
  5. `annotate_component()` → documents the solution
  6. `mark_problem_complete()` → closes the loop

**Tool Output → Impulse for Next Step:**
- Each tool returns data that LLM can use to decide what's next
- Results are self-documenting (include explanations, confidence scores)
- No coupling between tools - can be used independently
- Example: `suggest_related_changes` output includes reasons, enabling informed decisions

**Successful Sequences → Extractable Templates:**
- When LLM discovers effective tool usage patterns, they can become templates
- Ribosome pattern extracts successful improvisation into reusable workflows
- Example: Manual exploration → "Fix performance issue" template
- Template-driven execution is faster, improvisation is more creative

**No Predefined Paths:**
- Unlike template-driven mode (known sequence), improvisation adapts
- LLM chooses tools based on current context and goal
- Tools designed to work standalone or in combination
- Example: Can use just `get_priority_issues` or full workflow

**Key Insight:** These tools are BOTH template building blocks AND standalone improvisational capabilities. Same tools, different usage patterns.

## MCP Server Details

**Server Name:** `metabob-mcp`
**Protocol:** Model Context Protocol (MCP)
**Transport:** stdio

---

## Tool 1: get_priority_issues

**Intent:** Provide a shortlist of the most impactful next steps, phrased as actionable problems.

**Input Schema:**
```typescript
{
  limit?: number;          // Max issues (default: 5)
  severity?: string[];     // ["HIGH", "MEDIUM", "LOW"]
  category?: string[];     // ["bug", "security", "performance", "maintainability"]
  scope?: string;          // "session" | "project" | "org" (default: "session")
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
    impact_score: number;      // 0-100
    affected_components: number;
    priority_rank: number;     // 1-N
  }>;
  total_issues: number;
}
```

**Performance Target:** <100ms P50, <300ms P99

---

## Tool 2: search_codebase_issues

**Intent:** Find related issues via semantic search across problems and annotations.

**Input Schema:**
```typescript
{
  query: string;                    // Natural language search
  similarity_threshold?: number;    // Min similarity (default: 0.7)
  limit?: number;                   // Max results (default: 10)
  scope?: string;                   // "session" | "project" | "org"
  filters?: {
    severity?: string[];
    category?: string[];
    file_pattern?: string;          // Glob pattern
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
    similarity_score: number;        // 0-1
    annotations?: Array<{
      component_id: string;
      content: string;
      created_at: string;
    }>;
  }>;
  query_embedding: number[];         // For debugging
}
```

**Performance Target:** <200ms P50, <500ms P99

---

## Tool 3: annotate_component

**Intent:** Attach design rationale and resolved challenges to specific code components.

**Input Schema:**
```typescript
{
  component_id: string;              // Format: "file.ts::ComponentName"
  annotation: string;                // Markdown-formatted
  annotation_type: string;           // "design_decision" | "resolved_challenge" | "implementation_note" | "warning"
  related_problem_id?: string;       // Link to problem
  tags?: string[];                   // Searchable tags
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
  created_by: string;                // Session ID
  related_problem_id?: string;
  tags: string[];
}
```

**Performance Target:** <50ms P50, <150ms P99

**Side Effects:**
- Component becomes "documented" (affects future analysis)
- Annotations surface in `search_codebase_issues` results
- May influence problem severity scoring

---

## Tool 4: suggest_related_changes

**Intent:** Predict other parts of codebase that need amendment to "complete the commit" using co-change embeddings and online learning.

**Input Schema:**
```typescript
{
  changed_files: string[];           // Files modified in current work
  diff?: string;                     // Optional: git diff
  max_suggestions?: number;          // Max files (default: 10)
  confidence_threshold?: number;     // Min confidence 0-1 (default: 0.6)
}
```

**Output Schema:**
```typescript
{
  suggestions: Array<{
    file_path: string;
    confidence: number;              // 0-1
    reason: string;                  // Human-readable explanation
    cochange_frequency: number;      // Historical co-change count
    embedding_similarity: number;    // Semantic similarity
    affected_components: string[];   // Specific functions/classes
  }>;
  model_version: string;             // Online learning model version
}
```

**Performance Target:** <300ms P50, <800ms P99

**Side Effects:**
- Stores co-change event for online learning
- Updates project-specific model weights
- Increments cochange_frequency counters

---

## Tool 5: analyze_change_impact

**Intent:** Traverse the CPG and identify spots that require review but haven't been edited yet.

**Input Schema:**
```typescript
{
  changed_files: string[];           // Files being modified
  diff?: string;                     // Optional: full git diff
  max_depth?: number;                // CPG traversal depth (default: 3)
  analysis_type?: string;            // "forward" | "backward" | "both"
}
```

**Output Schema:**
```typescript
{
  impact_analysis: {
    direct_dependencies: Array<{
      file_path: string;
      component_id: string;
      relationship: string;          // "calls" | "imports" | "inherits" | "data_flow"
      risk_level: string;            // "HIGH" | "MEDIUM" | "LOW"
    }>;
    indirect_dependencies: Array<{
      file_path: string;
      component_id: string;
      path_from_change: string[];    // Chain of dependencies
      depth: number;
      risk_level: string;
    }>;
    affected_tests: Array<{
      file_path: string;
      test_name: string;
      coverage_type: string;         // "unit" | "integration" | "e2e"
    }>;
  };
  total_affected_components: number;
  review_required: string[];         // Files needing review
}
```

**Performance Target:** <400ms P50, <1s P99

**Side Effects:**
- Caches impact analysis result
- Updates component usage statistics

---

## Tool 6: mark_problem_complete

**Intent:** Remove a problem from active list and auto-create annotation documenting the fix.

**Input Schema:**
```typescript
{
  problem_id: string;
  resolution_summary: string;        // Brief explanation of fix
  fixed_in_commit?: string;          // Git commit hash
  created_annotation?: boolean;      // Auto-create annotation (default: true)
}
```

**Output Schema:**
```typescript
{
  problem_id: string;
  status: string;                    // "resolved"
  resolved_at: string;
  resolution_summary: string;
  annotation_created?: {
    annotation_id: string;
    component_id: string;
    content: string;                 // Auto-generated from problem + resolution
  };
}
```

**Performance Target:** <100ms P50, <250ms P99

**Side Effects:**
- Problem removed from active list
- Annotation created (improves future analysis)
- Online learning: marks problem as "resolved"

---

## Tool 7: generate_implementation_spec

**Intent:** Generate implementation specification based on CPG data flow and annotated components.

**Input Schema:**
```typescript
{
  goal: string;                      // What to implement (natural language)
  entry_points?: string[];           // Starting components
  max_depth?: number;                // CPG traversal depth (default: 5)
  include_patterns?: boolean;        // Include design patterns (default: true)
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
      reason: string;
      annotations: string[];
      data_flow: string[];
    }>;
    components_to_create: Array<{
      suggested_name: string;
      file_path: string;
      reason: string;
      similar_components: string[];
    }>;
    design_patterns: Array<{
      pattern_name: string;
      usage_examples: string[];
      recommendation: string;
    }>;
    data_flow_diagram: string;       // ASCII or Mermaid
    implementation_order: string[];
  };
  confidence: number;                // 0-1
}
```

**Performance Target:** <1s P50, <3s P99

**Side Effects:**
- Caches generated spec
- Tracks which specs led to successful implementations

---

## Error Handling

All tools return consistent error format:

```typescript
{
  error: {
    code: string;           // e.g., "COMPONENT_NOT_FOUND"
    message: string;        // Human-readable
    details?: object;       // Additional context
    suggestion?: string;    // Actionable next step
  }
}
```

**Common Error Codes:**
- `SESSION_EXPIRED` - Session token invalid
- `COMPONENT_NOT_FOUND` - Component ID doesn't exist in CPG
- `INSUFFICIENT_DATA` - Not enough analysis data (e.g., CPG not built)
- `SCOPE_FORBIDDEN` - Requested scope exceeds permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Tool Workflow

```
Recommended Usage Pattern:
══════════════════════════════════════════════════════════════════

1. get_priority_issues()      → Discover what needs fixing
   ↓
2. search_codebase_issues()   → Find related context
   ↓
3. generate_implementation_spec() → Plan the fix
   ↓
4. analyze_change_impact()    → Before making changes
   ↓
5. suggest_related_changes()  → During implementation
   ↓
6. annotate_component()       → Document decisions
   ↓
7. mark_problem_complete()    → Close the loop
```

---

## Consumers

This contract is consumed by:

- **AI Agents** (Claude, Cursor, etc.)
  - Via MCP protocol

- **metabob-cloud-dashboard** (potentially)
  - May invoke tools via MCP client

**Dependencies:**
- `http-api-v2-analysis` (1.0.0) - Backend API

---

## Testing

**Tool Integration Tests:**
```bash
# Run MCP tool tests
cd repos/metabob-mcp
bun test tests/integration/tools.test.ts

# Expected: All 7 tools conform to contract
```

**E2E Validation:**
```bash
# Test with actual AI agent
bun run tests/e2e/mcp-agent-flow.ts

# Expected: Agent can successfully use all tools
```

---

## Versioning

**Current Version:** 1.0.0

**Breaking Changes:**
- Tool removal
- Input schema changes (required field addition/removal)
- Output schema changes (field removal, type change)

**Non-Breaking Changes:**
- New tools
- Optional input fields
- Additional output fields

---

## Migration Guide

### To Version 1.1.0 (Future)

When new tools are added or optional fields introduced:

1. Update this contract document
2. Bump version to 1.1.0
3. Update metabob-mcp implementation
4. Notify AI agent users
5. Update documentation

---

## Contact

**Contract Owner:** MCP Tools Contract Agent
**Provider Repo:** repos/metabob-mcp
**Updates:** openspec/contracts/mcp-analysis-tools.md
