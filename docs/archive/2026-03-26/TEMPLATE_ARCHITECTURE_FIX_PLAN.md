# Activity Template Architecture Fix Plan

## Problem Statement

The `create-activity`, `evolve-activity-self-contained`, and `debug-activity-self-contained` templates currently rely on **file-reading anti-patterns** instead of using proper **backend MCP tools**. This violates the architectural principle that local storage is for caching only.

## Anti-Patterns Found

### ❌ **File Reading via bash/read tools**
```json
{
  "tools": {
    "required": ["read", "bash"]
  },
  "prompt": {
    "template": "Read /tmp/activity-template-{{templateId}}/REQUIREMENTS.md..."
  }
}
```

### ❌ **Direct API calls via curl**
```bash
curl http://localhost:8082/v2/activities/templates/{{templateId}}
curl "http://localhost:8082/v2/activities/executions?template_id={{templateId}}&limit=100"
```

### ❌ **Local file exploration**
```bash
find ~/.local/share/opencode/storage/activity/ -name "*.json"
cat ~/.local/share/opencode/storage/activity-template/{{templateId}}.json
ls -la /tmp/activity-template-*
```

## Correct Architecture

### ✅ **Use MCP Tools for All Backend Access**

**Available MCP Tools**:
1. **`get_activity_template`** - Fetch template definition
   - Parameters: `id`, `backend` (local/metabob/all)
   - Returns: Complete ActivityTemplate.Schema
   
2. **`list_activity_templates`** - List available templates
   - Parameters: `category` (optional), `backend`
   - Returns: Array of template summaries with metrics
   
3. **`activity_error_inspector`** - Get execution error analysis
   - Parameters: `activityId`, `includeSessionLogs`, `includeToolCalls`
   - Returns: Comprehensive failure analysis with root causes
   
4. **`register_activity_template`** - Register new template
   - Parameters: `file_path`, `register_with_metabob`
   - Validates schema and registers with backend

5. **`post_activity_result`** - Report execution metrics
   - Parameters: `activityId`, `result` (success, duration, cost, tokens)
   - Updates learning system

### ✅ **Use Impulses for Data Passing**

Instead of writing intermediate files and reading them in next task:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "outputs": {
        "requirementsDoc": "create impulse with requirements"
      }
    },
    {
      "id": "task-2",
      "dependencies": ["task-1"],
      "impulse_refs": ["requirementsDoc"],
      "prompt": {
        "template": "Use the requirements from impulse..."
      }
    }
  ]
}
```

## Required Fixes

### 1. **Fix `evolve-activity-self-contained` Template**

**Task 1: fetch-template-and-metrics**

Current (❌):
```json
{
  "prompt": {
    "template": "curl http://localhost:8082/v2/activities/templates/{{templateId}}..."
  },
  "tools": {
    "required": ["bash", "write", "read"]
  }
}
```

Fixed (✅):
```json
{
  "prompt": {
    "template": "Use get_activity_template MCP tool to fetch {{templateId}}.\n\n**Steps**:\n1. Call get_activity_template({ id: \"{{templateId}}\", backend: \"all\" })\n2. The tool returns complete template definition with metrics\n3. Create TEMPLATE_ANALYSIS.md with the data\n\n**DO NOT**:\n- ❌ Use curl or API calls\n- ❌ Read local files directly\n- ❌ Explore filesystem with bash\n\n**Data Available from MCP tool**:\n- Complete template JSON (tasks, variables, validation)\n- Execution metrics (executions, successRate, avgCost, avgDuration)\n- Version and genealogy information\n\n**For execution history** (if needed):\n- Use activity_error_inspector for failed executions\n- Backend will provide aggregate metrics\n\n**Write TEMPLATE_ANALYSIS.md now using only MCP tool data.**"
  },
  "tools": {
    "required": ["get_activity_template", "write"],
    "optional": ["activity_error_inspector"],
    "disabled": ["bash", "read"]
  }
}
```

**Task 2: identify-improvements**
- Keep as-is (reads TEMPLATE_ANALYSIS.md which is fine - it's our output)

**Task 3: create-improved-template**
- Keep as-is (reads our own outputs, writes improved JSON)

**Task 4: register-improved-template** (ADD THIS TASK)

New task (✅):
```json
{
  "id": "register-improved-template",
  "description": "Register the improved template variant with backend",
  "dependencies": ["create-improved-template"],
  "tools": {
    "required": ["register_activity_template", "write"],
    "optional": [],
    "disabled": ["bash", "curl"]
  },
  "prompt": {
    "template": "Register the improved template using MCP tool.\n\n**Steps**:\n1. Use register_activity_template tool:\n   - file_path: \"{{templateId}}-improved.json\"\n   - register_with_metabob: true\n   \n2. The tool will:\n   - Validate schema\n   - Register with backend\n   - Return success confirmation\n   \n3. Create SUCCESS.md with registration details\n\n**DO NOT**:\n- ❌ Use curl or API calls\n- ❌ Try to move files manually\n- ❌ Query backend directly\n\n**The MCP tool handles everything.**"
  }
}
```

### 2. **Fix `debug-activity-self-contained` Template**

**Task 1: inspect-execution-errors**

Current (✅) - Already correct!:
```json
{
  "tools": {
    "required": ["activity_error_inspector", "write"],
    "disabled": []
  },
  "validation": {
    "forbiddenPatterns": ["curl", "http://", "GET /", "POST /"]
  }
}
```

This template is already architecturally correct - it uses MCP tools only!

### 3. **Fix `create-activity` Template**

**Path Fix** (already identified):
```
/tmp/activity-template-{{templateId}}/ 
→ /tmp/opencode-activities/{{templateId}}-{{timestamp}}/
```

**Task 4: register-with-backend**

Current (partially ✅):
- Already uses `register_activity_template` MCP tool
- Just needs path fix

## Implementation Steps

1. **Update evolve-activity-self-contained template**
   - Modify task 1 prompt to use get_activity_template
   - Add task 4 for registration
   - Test with create-activity as target

2. **Update create-activity template**
   - Apply path fixes (/tmp/opencode-activities/)
   - Add timestamp variable
   - Relax validation patterns (regex not exact match)

3. **Verify debug-activity-self-contained**
   - Already correct, no changes needed

4. **Test Complete Flow**
   ```
   create-activity 
   → (fails with path issue) 
   → debug-activity (identifies root cause)
   → evolve-activity (fixes paths, registers variant)
   → create-activity-improved (succeeds)
   ```

## Backend Connectivity Requirements

**Current State**:
- ✅ MCP tools work with local storage cache
- ✅ `get_activity_template` returns complete data
- ✅ `list_activity_templates` works
- ✅ `activity_error_inspector` works
- ❌ RPC API has Redis connection issue (port 6379 refused)
- ⚠️  Backend metrics/execution history not available

**Minimal Requirements for Templates to Work**:
- ✅ Local storage cache (already working)
- ✅ MCP tools (already working)
- ⚠️  Backend RPC API (needed for execution history, metrics, learning data)

**Fix RPC API Connectivity** (separate issue):
```bash
# Redis not running or wrong port
# Error: "Error 111 connecting to localhost:6379. Connection refused."

# Need to either:
1. Start Redis on port 6379
2. Configure RPC API to use correct Redis instance
3. Use in-memory cache fallback
```

## Success Criteria

After fixes are applied:

1. **✅ evolve-activity can analyze templates** using only MCP tools
2. **✅ create-activity can create templates** in correct sandbox paths
3. **✅ debug-activity can inspect failures** using only MCP tools
4. **✅ Templates never read local files** directly (except their own outputs)
5. **✅ Templates never call APIs** with curl (use MCP tools)
6. **✅ Complete cycle works**: create → fail → debug → evolve → retry → succeed

## Priority

**HIGH** - This is blocking the self-improvement loop and violates core architecture.

## Estimated Effort

- Fix evolve-activity: 30 minutes (prompt updates, add registration task)
- Fix create-activity: 15 minutes (already mostly done by evolve-activity)
- Test complete flow: 30 minutes
- **Total: 75 minutes**

## Dependencies

- RPC API Redis connectivity (separate infrastructure issue)
- Template registration validation (ensure schema validation catches issues)
