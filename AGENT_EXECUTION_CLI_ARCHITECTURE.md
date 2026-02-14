# Agent Execution Tracking: CLI-Centric Architecture

## Problem Statement

We're building agent self-improvement, but we're missing a critical opportunity:

**metabob-cli already has the intelligence layer we need:**
- File parsing (extracts structure, functions, classes)
- Embedding generation (semantic understanding of code)
- CPG (Code Property Graph - dependencies, impact analysis)
- MCP server (tool interface for OpenCode)

**Current approach bypasses this:**
- OpenCode → Backend API directly
- Loses context about WHAT code the agent is working with
- Can't correlate tool usage with code structure
- Missing semantic understanding of changes

## Better Architecture: CLI as Intelligence Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenCode Agent                          │
│  (Session tracking, tool execution, activity management)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ MCP Protocol
                         │ (Already established connection)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Metabob CLI MCP Server                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  New Agent Execution Tools:                              │   │
│  │  - metabob_record_session_start                          │   │
│  │  - metabob_record_tool_invocation                        │   │
│  │  - metabob_record_session_complete                       │   │
│  │  - metabob_analyze_agent_performance                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Existing Capabilities:                                  │   │
│  │  - CPG Manager (dependency tracking, impact analysis)    │   │
│  │  - File Parser (code structure extraction)               │   │
│  │  - Embedding Generator (semantic understanding)          │   │
│  │  - Analysis Engine (quality assessment)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/gRPC
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Redis + SurrealDB)              │
│  - Session storage                                              │
│  - Aggregated statistics                                        │
│  - Historical trends                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Architecture is Better

### 1. **Rich Context**: Tool Calls Know About Code

**Before (Direct to Backend):**
```json
{
  "tool": "edit",
  "file": "src/auth.py",
  "success": true,
  "duration_ms": 150
}
```

**After (Through CLI):**
```json
{
  "tool": "edit",
  "file": "src/auth.py",
  "success": true,
  "duration_ms": 150,
  "context": {
    "function_modified": "authenticate_user",
    "dependencies": ["jwt_decode", "verify_password"],
    "dependents": 12,
    "impact_score": 8.5,
    "embedding": [...],
    "similar_code": ["src/session.py::validate_session"]
  }
}
```

### 2. **Code-Aware Analysis**: Understand WHY Tools Fail

**Example: Why does `read` fail 35% of the time?**

CLI can analyze:
```python
# CLI analysis shows:
# - 60% of failures: Non-existent files (agent hallucinates paths)
# - 25% of failures: Permission denied (agent tries system files)  
# - 15% of failures: Binary files (agent tries to read images)

# CLI can suggest:
# - Add path validation BEFORE read (check file exists)
# - Add file type filtering (skip .jpg, .png, .bin)
# - Add permission check (skip /etc/, /sys/)
```

### 3. **Pattern Detection**: Learn from Success

**Example: What makes `edit` succeed 95% of the time?**

CLI can detect:
```python
# Successful edit patterns (using CPG + embeddings):
# - Agent reads file BEFORE editing (98% success)
# - Agent edits small functions (<50 lines) (92% success)
# - Agent edits files with <5 dependents (94% success)
# - Agent edits recently viewed code (97% success)

# Failed edit patterns:
# - Agent edits without reading first (45% success)
# - Agent edits large classes (>200 lines) (55% success)
# - Agent edits core dependencies (>20 dependents) (60% success)
```

### 4. **Semantic Clustering**: Group Related Problems

**Example: Multiple bash failures**

CLI embeddings detect these are all permission issues:
```python
errors = [
  "bash: docker ps -> permission denied",
  "bash: systemctl status -> permission denied", 
  "bash: cat /etc/hosts -> permission denied"
]

# CLI clusters these as "permission_denied_system_commands"
# Single fix: Add sudo awareness or recommend user check permissions
```

### 5. **Impact-Aware Recommendations**: Prioritize by Risk

**Example: Two tools have 70% success rate**

CLI uses CPG to prioritize:
```python
Tool: read (70% success, but only edits small utils - impact: 2.3)
Tool: edit (70% success, but modifies core auth - impact: 9.1)

# Recommendation: Fix `edit` first (higher impact)
# Root cause (CPG shows): Agent edits without understanding dependencies
```

## Implementation Plan

### Phase 1: Extend CLI MCP Server with Agent Execution Tools (2-3 hours)

**File:** `repos/metabob-cli/src/metabob_cli/mcp/agent_execution_tools.py`

```python
"""Agent execution tracking tools for MCP server.

These tools enrich session/tool data with code intelligence before
forwarding to backend API.
"""

from typing import Any
from cpg_inference import CoChangePredictor
from ..core.analysis_engine import AnalysisEngine


class AgentExecutionTools:
    """MCP tools for agent execution tracking with code intelligence."""
    
    def __init__(self, cpg_manager, analysis_engine, backend_url):
        self.cpg = cpg_manager
        self.analysis = analysis_engine  
        self.backend_url = backend_url
    
    async def record_tool_invocation(
        self,
        session_id: str,
        tool_name: str,
        file_path: str | None,
        args: dict,
        success: bool,
        duration_ms: int,
        error: str | None
    ) -> dict[str, Any]:
        """Record tool invocation with rich code context."""
        
        context = {}
        
        # If tool operates on a file, add code intelligence
        if file_path and self.cpg:
            # 1. Get component info (what functions/classes touched)
            components = await self.cpg.list_file_components(file_path)
            context["components"] = components
            
            # 2. Get dependency info (impact of changes)
            impact = await self.cpg.analyze_change_impact(file_path)
            context["impact_score"] = impact.get("score")
            context["dependents"] = impact.get("dependents", [])
            
            # 3. Get similar code (semantic clustering)
            if self.analysis:
                similar = await self.analysis.find_similar_code(file_path)
                context["similar_files"] = similar[:5]
        
        # Forward enriched data to backend
        payload = {
            "session_id": session_id,
            "tool_name": tool_name,
            "file_path": file_path,
            "args": args,
            "success": success,
            "duration_ms": duration_ms,
            "error": error,
            "code_context": context  # <-- Rich context from CLI
        }
        
        # Send to backend API
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.backend_url}/api/agent-execution/tool/invocation",
                json=payload
            ) as resp:
                return await resp.json()
```

**Register in MCP server:**

```python
# repos/metabob-cli/src/metabob_cli/mcp/server.py

from .agent_execution_tools import AgentExecutionTools

# In server initialization:
agent_tools = AgentExecutionTools(
    cpg_manager=self.cpg_manager,
    analysis_engine=self.analysis_engine,
    backend_url=os.getenv("METABOB_API_URL", "http://localhost:8080")
)

# Add MCP tools:
@self.server.tool()
async def metabob_record_tool_invocation(
    session_id: str,
    tool_name: str,
    file_path: str = None,
    args: dict = None,
    success: bool = True,
    duration_ms: int = 0,
    error: str = None
) -> dict:
    """Record agent tool invocation with code intelligence."""
    return await agent_tools.record_tool_invocation(
        session_id, tool_name, file_path, args, 
        success, duration_ms, error
    )
```

### Phase 2: Update OpenCode to Use CLI MCP Tools (1-2 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts`

```typescript
// Change from direct HTTP to MCP tool call

async function recordToolInvocation(
  sessionId: string, 
  invocation: ToolInvocation
): Promise<void> {
  try {
    // Use MCP tool instead of direct HTTP
    const mcpClient = await getMCPClient() // Get existing metabob MCP connection
    
    const result = await mcpClient.callTool({
      name: "metabob_record_tool_invocation",
      arguments: {
        session_id: sessionId,
        tool_name: invocation.tool_name,
        file_path: extractFilePath(invocation.args), // Helper to extract file from args
        args: invocation.args,
        success: invocation.success,
        duration_ms: invocation.duration_ms,
        error: invocation.error,
        timestamp: invocation.timestamp.toISOString()
      }
    })
    
    log.debug("tool invocation recorded via CLI", { result })
  } catch (error) {
    log.debug("tool recording failed", { error })
  }
}
```

### Phase 3: Update Backend to Store Rich Context (1 hour)

**File:** `repos/metabob-rpc-api/server/actions/agent_execution.py`

```python
# Extend ToolInvocationRequest to include code context

class ToolInvocationRequest(BaseModel):
    session_id: str
    tool_name: str
    file_path: str | None = None
    args: dict | None = None
    success: bool
    duration_ms: int
    error: str | None = None
    timestamp: str
    
    # NEW: Rich code context from CLI
    code_context: dict | None = None  # Contains: components, impact_score, dependents, similar_files


async def record_tool_invocation(
    request: ToolInvocationRequest,
    redis: Redis
) -> dict[str, Any]:
    """Record tool invocation with optional code context."""
    
    # Store in Redis with context
    key = f"agent_execution:tool:{request.session_id}:{request.tool_name}:{request.timestamp}"
    
    data = {
        "session_id": request.session_id,
        "tool_name": request.tool_name,
        "file_path": request.file_path,
        "success": request.success,
        "duration_ms": request.duration_ms,
        "error": request.error,
        "timestamp": request.timestamp,
        "code_context": json.dumps(request.code_context or {})  # Store context
    }
    
    redis.hset(key, mapping=data)
    redis.expire(key, 86400 * 7)  # 7 days TTL
    
    # Update aggregate stats (with context-aware logic)
    await update_tool_stats_with_context(
        redis, request.session_id, request.tool_name, 
        request.success, request.code_context
    )
    
    return {"status": "success", "message": "Tool invocation recorded"}
```

### Phase 4: Build Smart Agent Analyzer (3-4 hours)

**File:** `scripts/analyze_agent_performance.py`

```python
"""Analyze agent performance using code intelligence from CLI."""

import json
import redis
from collections import defaultdict
from typing import List, Dict, Any


class AgentPerformanceAnalyzer:
    """Analyzes agent execution data with code context."""
    
    def __init__(self, redis_client, cli_cpg_manager):
        self.redis = redis_client
        self.cpg = cli_cpg_manager
    
    async def detect_improvement_opportunities(
        self, agent_id: str
    ) -> List[Dict[str, Any]]:
        """Find patterns in agent behavior that need improvement."""
        
        opportunities = []
        
        # 1. Analyze tool failures with code context
        tool_failures = self.get_tool_failures(agent_id)
        
        for tool_name, failures in tool_failures.items():
            # Group by error type
            error_patterns = self.cluster_errors(failures)
            
            # For file operations, analyze with CPG
            if self.is_file_operation(tool_name):
                code_patterns = await self.analyze_code_patterns(failures)
                
                opportunity = {
                    "type": "tool_failure_pattern",
                    "tool": tool_name,
                    "error_clusters": error_patterns,
                    "code_insights": code_patterns,
                    "recommendation": self.generate_fix(tool_name, code_patterns)
                }
                opportunities.append(opportunity)
        
        # 2. Detect anti-patterns using CPG
        # e.g., "agent edits high-impact files without reading dependencies"
        risky_edits = await self.detect_risky_edits(agent_id)
        if risky_edits:
            opportunities.append({
                "type": "risky_edit_pattern",
                "details": risky_edits,
                "recommendation": "Add dependency analysis before editing core files"
            })
        
        # 3. Find successful patterns to replicate
        success_patterns = await self.find_success_patterns(agent_id)
        opportunities.append({
            "type": "success_pattern",
            "patterns": success_patterns,
            "recommendation": "Apply these patterns more broadly"
        })
        
        return opportunities
    
    async def analyze_code_patterns(
        self, failures: List[Dict]
    ) -> Dict[str, Any]:
        """Use CPG to understand code-level failure patterns."""
        
        file_impacts = []
        for failure in failures:
            file_path = failure.get("file_path")
            if not file_path:
                continue
            
            # Get impact from code context (stored by CLI)
            context = json.loads(failure.get("code_context", "{}"))
            impact_score = context.get("impact_score", 0)
            dependents = len(context.get("dependents", []))
            
            file_impacts.append({
                "file": file_path,
                "impact_score": impact_score,
                "dependents": dependents
            })
        
        # Detect pattern: high failure rate on high-impact files
        high_impact_failures = [
            f for f in file_impacts if f["impact_score"] > 7.0
        ]
        
        if len(high_impact_failures) / len(file_impacts) > 0.4:
            return {
                "pattern": "high_impact_file_failures",
                "description": "Agent frequently fails on core dependencies",
                "evidence": high_impact_failures[:5],
                "fix": "Add impact analysis check before editing (warn if impact > 7)"
            }
        
        return {}
    
    async def detect_risky_edits(self, agent_id: str) -> Dict[str, Any]:
        """Detect when agent edits high-impact code without proper analysis."""
        
        # Get all edit operations
        edits = self.get_tool_invocations(agent_id, tool="edit")
        
        risky_edits = []
        for edit in edits:
            context = json.loads(edit.get("code_context", "{}"))
            impact = context.get("impact_score", 0)
            
            # Check if agent analyzed dependencies BEFORE editing
            prior_analysis = self.check_prior_dependency_analysis(
                edit["session_id"], 
                edit["timestamp"],
                edit["file_path"]
            )
            
            if impact > 7.0 and not prior_analysis:
                risky_edits.append({
                    "file": edit["file_path"],
                    "impact": impact,
                    "session": edit["session_id"]
                })
        
        if len(risky_edits) > 5:
            return {
                "count": len(risky_edits),
                "examples": risky_edits[:3],
                "recommendation": "Require dependency analysis before high-impact edits"
            }
        
        return {}
```

## Benefits Summary

| Capability | Without CLI | With CLI |
|------------|-------------|----------|
| **Tool failure analysis** | "read failed 35% of time" | "read fails because: 60% non-existent paths, 25% permission denied, 15% binary files" |
| **Success patterns** | "edit succeeds 95% of time" | "edit succeeds when: agent reads first (98%), file <50 lines (92%), <5 dependents (94%)" |
| **Impact awareness** | "Fix read (70% success)" | "Fix edit first (70% success, but 9.1 impact vs read's 2.3 impact)" |
| **Root cause** | "Unknown why bash fails" | "bash fails on: permission-restricted system commands (CPG shows 15 similar failures)" |
| **Recommendations** | "Add retry logic to read" | "Add path validation, file type check, permission check - specific to failure modes" |

## Migration Path

1. **Phase 1** (Week 1): Add MCP tools to CLI - **no breaking changes**
2. **Phase 2** (Week 1): Update OpenCode to call CLI tools - **backwards compatible** (fallback to direct HTTP)
3. **Phase 3** (Week 2): Update backend to store context - **backwards compatible** (context is optional)
4. **Phase 4** (Week 2): Build smart analyzer using context
5. **Phase 5** (Week 3): Deprecate direct HTTP path once CLI path is proven

## Environment Variables

```bash
# OpenCode container
OPENCODE_ENABLE_INSTRUMENTATION=true
METABOB_MCP_CLIENT_ENABLED=true  # Use MCP for tracking (new)

# CLI container  
METABOB_API_URL=http://api-server-dev:8080  # Backend for storage
METABOB_CPG_ENABLED=true  # Enable CPG for code intelligence
```

## Files to Modify

### New Files:
1. `repos/metabob-cli/src/metabob_cli/mcp/agent_execution_tools.py` - MCP tools for tracking
2. `scripts/analyze_agent_performance_smart.py` - Smart analyzer using CLI intelligence

### Modified Files:
1. `repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts` - Use MCP instead of HTTP
2. `repos/metabob-cli/src/metabob_cli/mcp/server.py` - Register new MCP tools
3. `repos/metabob-rpc-api/server/actions/agent_execution.py` - Accept code_context field

## Next Steps

Should I proceed with implementing this CLI-centric architecture? It gives us:

✅ **Code-aware analysis** - Understand WHAT agent is working on  
✅ **Semantic clustering** - Group related failures using embeddings  
✅ **Impact prioritization** - Fix high-impact problems first using CPG  
✅ **Root cause detection** - Understand WHY tools fail using code structure  
✅ **Smarter recommendations** - Generate fixes based on code patterns  

This is the path to true agent self-improvement! 🚀
