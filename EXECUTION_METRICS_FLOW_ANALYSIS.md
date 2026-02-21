# Activity Execution Metrics Storage - Data Flow Analysis

## 🎯 Entry Points

### Entry Point 1: Activity Success Path
```
Entry Point: repos/metabob-opencode/packages/opencode/src/session/activity.ts:616
Function: TemplateMetricsClient.reportExecution
Input Type: ActivityExecutionData {
  activity_id: string
  template_id: string
  success: boolean
  duration: number (milliseconds)
  cost: number (USD)
  tokens: { input, output, cache }
}
Trigger: Called when activity completes successfully (activity.status === "done")
Context: Inside Activity.complete() function after activity finishes
```

### Entry Point 2: Activity Failure Path
```
Entry Point: repos/metabob-opencode/packages/opencode/src/session/activity.ts:789
Function: TemplateMetricsClient.reportExecution
Input Type: ActivityExecutionData (same as above, but success: false)
Trigger: Called when activity fails
Context: Inside Activity.fail() function after activity error
```

## 📊 Data Flow

### Phase 1: Activity Execution Completion
**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:924-942`

When activity completes, metrics are updated **locally** in template repository:

```typescript
// Update template metrics using incremental weighted average
const newExecutions = template.executions + 1

await TemplateRepository.updateMetrics(template.id, {
  executions: newExecutions,
  successRate: template.successRate + ((result.success ? 1 : 0) - template.successRate) / newExecutions,
  avgDuration: template.avgDuration + (result.totalDuration - template.avgDuration) / newExecutions,
  avgCost: template.avgCost + (result.totalCost - template.avgCost) / newExecutions,
  avgTokens: {
    input: safeAvgTokens.input + (result.totalTokens.input - safeAvgTokens.input) / newExecutions,
    output: safeAvgTokens.output + (result.totalTokens.output - safeAvgTokens.output) / newExecutions,
    cache: safeAvgTokens.cache + (result.totalTokens.cache - safeAvgTokens.cache) / newExecutions,
  },
})
```

This updates the **local** template metrics in OpenCode's storage.

### Phase 2: Backend Reporting Attempt
**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:609-630`

After activity cleanup, attempt to report to backend:

```typescript
// Report execution metrics to backend (non-blocking, graceful degradation)
if (activity.templateId) {
  const cacheTokens = /* normalize cache tokens */

  TemplateMetricsClient.reportExecution({
    activity_id: activity.id,
    template_id: activity.templateId,
    success: activity.status === "done",
    duration: activity.stats.duration,
    cost: activity.stats.cost.total,
    tokens: {
      input: activity.stats.tokens.input,
      output: activity.stats.tokens.output,
      cache: cacheTokens,
    },
  }).catch(() => {
    // Silent failure - metrics reporting is not critical path
  })
}
```

### Phase 3: MCP Client Call
**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:83-122`

```typescript
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  try {
    log.debug("reporting activity execution", { ... })

    const result = await callMCPTool<{ success: boolean; error?: string }>(
      "metabob_report_execution",  // ⚠️ TOOL NAME
      {
        activity_id: data.activity_id,
        template_id: data.template_id,
        success: data.success,
        duration: data.duration,
        cost: data.cost,
        tokens: data.tokens,
      },
    )
    // ...
  } catch (error) {
    // Graceful degradation - metrics reporting is not critical path
    log.warn("metrics reporting failed (graceful degradation)", { ... })
  }
}
```

**Key Detail**: Frontend calls MCP tool named **`metabob_report_execution`**

### Phase 4: MCP Gateway (Expected)
The MCP client attempts to call the Metabob MCP server with tool name `metabob_report_execution`.

## 🔴 **CRITICAL FINDING: Tool Name Mismatch**

### Backend MCP Tool Registration
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:241-292`

The backend MCP server registers a tool named:
```python
@mcp.tool(
    name="metabob_post_activity_result",  # ⚠️ DIFFERENT NAME
    description="""Post execution results for activity template.

Updates template metrics with execution results (success, duration, cost, tokens).
Used to track template performance over time.""",
)
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,
    ctx: Context = None,
):
    # Extract template ID from activity ID
    template_id = activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
    
    activity_templates.update_metrics(template_id, result)
    # ...
```

### The Problem

| Component | Tool Name |
|-----------|-----------|
| **Frontend (OpenCode)** | `metabob_report_execution` |
| **Backend (Metabob CLI)** | `metabob_post_activity_result` |

**Result**: Frontend calls fail silently because the tool doesn't exist on the backend.

### Backend Storage Implementation
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:239-259`

```python
def update_metrics(template_id: str, result: dict[str, Any]) -> None:
    """
    Update template execution metrics.

    Args:
        template_id: Template ID to update
        result: Execution result with {success, duration, cost, tokens}
    """
    storage_path = get_activity_storage_path()
    template_file = storage_path / f"{template_id}.json"

    if not template_file.exists():
        logger.warning(f"Template not found for metrics update: {template_id}")
        return

    try:
        # Load template
        with open(template_file, encoding="utf-8") as f:
            template_data = json.load(f)

        # Update metrics (incremental average logic)
        # ...
```

This function expects to update a JSON file in backend storage.

## 📋 Summary

### Entry Points
1. **Success Path**: `activity.ts:616` → `TemplateMetricsClient.reportExecution()` (success=true)
2. **Failure Path**: `activity.ts:789` → `TemplateMetricsClient.reportExecution()` (success=false)

### Data Type
```typescript
interface ActivityExecutionData {
  activity_id: string
  template_id: string
  success: boolean
  duration: number // milliseconds
  cost: number // USD
  tokens?: {
    input: number
    output: number
    cache: number
  }
}
```

### Trigger Mechanism
- **When**: After activity execution completes or fails
- **How**: Direct function call in Activity.complete() or Activity.fail()
- **Blocking**: No (non-blocking, graceful degradation)
- **Error Handling**: Silent failure with logging

### Current Status: 🔴 **BROKEN**

**Root Cause**: Tool name mismatch between frontend and backend

**Impact**:
- ✅ Local metrics storage works (OpenCode's TemplateRepository)
- ❌ Backend metrics storage fails silently
- ❌ No centralized metrics aggregation
- ❌ Backend database not receiving execution data

## 🔧 Fix Required

**Option 1: Rename Backend Tool**
Change `metabob_post_activity_result` → `metabob_report_execution` in backend

**Option 2: Rename Frontend Call**
Change `metabob_report_execution` → `metabob_post_activity_result` in frontend

**Recommended**: Option 1 (rename backend) because:
- Frontend naming is more descriptive (`reportExecution` vs `postActivityResult`)
- Frontend code is more mature and tested
- Backend tool is newer and less referenced

## 🎯 Next Steps

1. Use `propagate-change-through-flow` activity to rename backend tool
2. Verify MCP tool registration after rename
3. Test end-to-end metrics flow with real activity execution
4. Validate backend database receives execution data
