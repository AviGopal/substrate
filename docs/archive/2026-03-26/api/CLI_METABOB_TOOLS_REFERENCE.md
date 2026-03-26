# Metabob CLI MCP Tools Reference

**Date**: 2026-02-09  
**Purpose**: Document available MCP tools for Phase 2 integration  
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

---

## Overview

The Metabob CLI exposes **20+ MCP tools** for code quality analysis. Key tools for Phase 2:

| Tool | Purpose | Phase 2 Use |
|------|---------|-------------|
| `search_codebase_issues` | Semantic code search | Find similar implementations |
| `get_priority_issues` | Get HIGH severity issues | Pre-execution checks |
| `list_file_components` | List components in file | Extract from changed files |
| `annotate_component` | Add component annotation | Document execution context |
| `suggest_related_changes` | Cochange analysis | Find missed related work |
| `mark_problem_complete` | Mark issue resolved | Track resolution |
| `assess_deletion_safety` | Safe to delete? | Pre-deletion validation |

---

## Tool Details

### 1. get_metabob_status
**Purpose**: Check if analysis engine is ready

**Input**: None

**Output**:
```json
{
  "status": "ready" | "initializing" | "error",
  "initialized": true/false,
  "initializing": true/false,
  "error": null | "error message",
  "message": "human-readable status"
}
```

**Phase 2 Use**: Check before calling other tools

---

### 2. search_codebase_issues
**Purpose**: Semantic search for code quality issues

**Input**:
- `query` (string): Search term (e.g., "authentication bug")
- `limit` (int, optional): Max results (default: 10)
- `min_score` (float, optional): Min relevance score (default: 0.0)

**Output**:
```json
{
  "results": [
    {
      "issue_id": "string",
      "file_path": "string",
      "component_name": "string",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "description": "string",
      "relevance_score": 0.95,
      "resolution_history": [],
      "annotations": []
    }
  ],
  "total_results": 5,
  "query": "authentication bug"
}
```

**Phase 2 Use**: Discovery phase - find similar implementations before creating new code

---

### 3. get_priority_issues
**Purpose**: Get HIGH severity issues in specific area

**Input**:
- `file_path` (string, optional): Specific file
- `directory` (string, optional): Specific directory
- `severity` (string, optional): "HIGH", "MEDIUM", "LOW" (default: "HIGH")
- `limit` (int, optional): Max results (default: 20)

**Output**:
```json
{
  "issues": [
    {
      "issue_id": "string",
      "file_path": "string",
      "component_name": "string",
      "severity": "HIGH",
      "description": "string",
      "category": "security" | "performance" | "correctness",
      "priority_score": 0.95
    }
  ],
  "total_count": 3,
  "severity_filter": "HIGH"
}
```

**Phase 2 Use**: Pre-execution checks - ensure no HIGH issues in work area

---

### 4. list_file_components
**Purpose**: List all components (functions, classes) in a file

**Input**:
- `file_path` (string): Path to file

**Output**:
```json
{
  "file_path": "src/auth.ts",
  "components": [
    {
      "name": "validateToken",
      "type": "function",
      "start_line": 10,
      "end_line": 25,
      "complexity": "medium",
      "issues": [
        {
          "severity": "MEDIUM",
          "description": "Missing error handling"
        }
      ],
      "annotations": []
    }
  ],
  "total_components": 5
}
```

**Phase 2 Use**: **CRITICAL** - Extract components from changed files for ComponentChange tracking

---

### 5. annotate_component
**Purpose**: Add annotation to a component (documents design decisions)

**Input**:
- `file_path` (string): Path to file
- `component_name` (string): Component name
- `component_type` (string): "function" | "class" | "method"
- `annotation_type` (string): "why" | "how" | "context" | "decision"
- `content` (string): Annotation text
- `metadata` (dict, optional): Additional metadata

**Output**:
```json
{
  "success": true,
  "annotation_id": "anno_abc123",
  "file_path": "src/auth.ts",
  "component_name": "validateToken",
  "created_at": "2026-02-09T12:00:00Z"
}
```

**Phase 2 Use**: **CRITICAL** - Annotate components modified during execution with WHY they were changed

---

### 6. suggest_related_changes
**Purpose**: Cochange analysis - what else should change?

**Input**:
- `file_paths` (list[string]): Files being modified
- `change_description` (string, optional): What's changing
- `limit` (int, optional): Max suggestions (default: 10)

**Output**:
```json
{
  "suggestions": [
    {
      "file_path": "src/auth-utils.ts",
      "component_name": "hashPassword",
      "reason": "Often changes together with validateToken (80% cochange rate)",
      "confidence": 0.85,
      "last_cochange": "2026-02-08T10:00:00Z"
    }
  ],
  "total_suggestions": 3,
  "analyzed_files": ["src/auth.ts"]
}
```

**Phase 2 Use**: Before commit - check if we missed related changes

---

### 7. mark_problem_complete
**Purpose**: Mark an issue as resolved

**Input**:
- `issue_id` (string): Issue ID from search_codebase_issues
- `resolution` (string): How it was fixed
- `commit_sha` (string, optional): Git commit
- `notes` (string, optional): Additional notes

**Output**:
```json
{
  "success": true,
  "issue_id": "issue_abc123",
  "marked_complete_at": "2026-02-09T12:00:00Z",
  "resolution": "Added error handling"
}
```

**Phase 2 Use**: Track issue resolution in execution outcome

---

### 8. assess_deletion_safety
**Purpose**: Check if it's safe to delete code

**Input**:
- `file_path` (string): File to delete
- `component_name` (string, optional): Specific component

**Output**:
```json
{
  "safe_to_delete": true/false,
  "risk_level": "low" | "medium" | "high",
  "reasons": [
    "No external references found",
    "Component is isolated"
  ],
  "dependencies": [],
  "references": []
}
```

**Phase 2 Use**: Pre-deletion validation in refactoring activities

---

### 9. get_component_annotations
**Purpose**: Get all annotations for a component

**Input**:
- `file_path` (string): Path to file
- `component_name` (string, optional): Specific component

**Output**:
```json
{
  "file_path": "src/auth.ts",
  "component_name": "validateToken",
  "annotations": [
    {
      "annotation_id": "anno_123",
      "type": "why",
      "content": "Uses JWT for token validation because...",
      "created_at": "2026-02-08T10:00:00Z",
      "metadata": {
        "execution_id": "exec_456",
        "activity_id": "bug-fix-v1"
      }
    }
  ],
  "total_annotations": 2
}
```

**Phase 2 Use**: Impulse synthesis - extract context from past annotations

---

### 10. analyze_change_impact
**Purpose**: Analyze impact of proposed changes

**Input**:
- `file_paths` (list[string]): Files to be modified
- `change_type` (string): "add" | "modify" | "delete"
- `description` (string, optional): Change description

**Output**:
```json
{
  "impact_score": 0.75,
  "affected_components": 5,
  "test_coverage": 0.80,
  "risk_areas": [
    {
      "file_path": "src/auth.ts",
      "reason": "High complexity component with external dependencies"
    }
  ],
  "recommendations": [
    "Add tests for validateToken function",
    "Consider updating hashPassword function (cochange detected)"
  ]
}
```

**Phase 2 Use**: Pre-execution - understand blast radius

---

## Tool Categories

### Read Operations (Concurrent Safe)
- `get_metabob_status`
- `search_codebase_issues`
- `get_priority_issues`
- `list_file_components`
- `get_component_annotations`
- `suggest_related_changes`
- `analyze_change_impact`
- `assess_deletion_safety`

**Performance**: <500ms typical

### Write Operations (Serialized)
- `annotate_component`
- `mark_problem_complete`

**Performance**: <200ms when no contention, <2s when queued

---

## Phase 2 Integration Points

### 1. Component Extraction (Task 5)
**Tool**: `list_file_components`

**Usage**:
```python
# After execution, get components from changed files
for file_path in changed_files:
    result = await mcp.call("list_file_components", file_path=file_path)
    components = result["components"]
    
    # Create ComponentChange for each
    for comp in components:
        if component_in_diff(comp, git_diff):
            component_changes.append({
                "file_path": file_path,
                "component_name": comp["name"],
                "component_type": comp["type"],
                "change_type": "MODIFIED"
            })
```

---

### 2. Component Annotation (Task 5)
**Tool**: `annotate_component`

**Usage**:
```python
# After successful execution, annotate modified components
for change in component_changes:
    await mcp.call("annotate_component",
        file_path=change["file_path"],
        component_name=change["component_name"],
        component_type=change["component_type"],
        annotation_type="context",
        content=f"Modified by execution {execution_id}: {reason}",
        metadata={
            "execution_id": execution_id,
            "activity_id": activity_id,
            "impulses_used": [imp["impulse_id"] for imp in impulses_used]
        }
    )
```

---

### 3. Discovery Phase (existing use)
**Tool**: `search_codebase_issues`

**Usage**:
```python
# Before implementing, search for similar code
results = await mcp.call("search_codebase_issues",
    query="authentication implementation",
    limit=5,
    min_score=0.7
)

# Check if we should reuse existing implementation
if results["total_results"] > 0:
    logger.info(f"Found {results['total_results']} similar implementations")
```

---

### 4. Pre-Execution Checks (existing use)
**Tool**: `get_priority_issues`

**Usage**:
```python
# Before starting work, check for HIGH issues
issues = await mcp.call("get_priority_issues",
    directory="src/auth",
    severity="HIGH",
    limit=10
)

if issues["total_count"] > 0:
    logger.warning(f"{issues['total_count']} HIGH severity issues in work area")
```

---

### 5. Cochange Detection (Task 5)
**Tool**: `suggest_related_changes`

**Usage**:
```python
# Before committing, check for missed changes
suggestions = await mcp.call("suggest_related_changes",
    file_paths=changed_files,
    change_description="Added authentication validation"
)

if suggestions["total_suggestions"] > 0:
    logger.info(f"Consider also updating: {[s['file_path'] for s in suggestions['suggestions']]}")
```

---

## Concurrency Model

**From tools.py comments**:
- Multiple agents can **read concurrently** (no blocking)
- Write operations are **serialized** via asyncio.Semaphore(1)
- Operations timeout after 30s if stuck
- Wait times >100ms are logged as warnings

**Best Practice**:
```python
# ✅ Good - concurrent reads
results = await asyncio.gather(
    mcp.call("search_codebase_issues", query="auth"),
    mcp.call("get_priority_issues", directory="src"),
    mcp.call("list_file_components", file_path="src/auth.ts")
)

# ⚠️ Avoid - sequential writes (slow)
await mcp.call("annotate_component", ...)
await mcp.call("annotate_component", ...)  # Waits unnecessarily

# ✅ Better - batch if possible
await asyncio.gather(
    mcp.call("annotate_component", ...),
    mcp.call("annotate_component", ...)  # Queued, but concurrent intent
)
```

---

## Error Handling

**InitializingError**: Raised when engine is still initializing
```python
try:
    result = await mcp.call("search_codebase_issues", query="test")
except InitializingError:
    # Wait and retry
    await asyncio.sleep(1)
    result = await mcp.call("get_metabob_status")
```

---

## Summary

**For Phase 2, we primarily need**:
1. ✅ `list_file_components` - Extract components (exists!)
2. ✅ `annotate_component` - Document execution context (exists!)
3. ✅ `suggest_related_changes` - Cochange detection (exists!)
4. ✅ `get_component_annotations` - Impulse synthesis (exists!)

**No new MCP tools needed** - all required functionality exists!

**Estimated integration effort**: 2-3 hours (just wire up existing tools)
