# Activity Execution Metrics - Dependency Chain Analysis

## 🎯 Complete Data Flow Chain

### Overview
Execution metrics flow through **two parallel paths**: local storage and backend MCP. Both paths are independent and use graceful degradation on failure.

---

## Flow Chain: Activity Completion → Metrics Storage

### **1. Activity Completion Handler**
**Component**: `Activity.complete()` in `activity.ts:616`
- **What it does**: Triggered when activity execution finishes successfully
- **Input**: Activity state object with `stats` containing execution metrics
- **Output**: Calls `TemplateMetricsClient.reportExecution()` with structured data
- **Data transformation**: Normalizes cache tokens from object to number

```typescript
// Normalize cache tokens
const cacheTokens = typeof activity.stats.tokens.cache === "object"
  ? activity.stats.tokens.cache.read + activity.stats.tokens.cache.write
  : activity.stats.tokens.cache || 0

// Call reporting
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
  }
})
```

---

### **2. Template Metrics Client (Frontend Gateway)**
**Component**: `TemplateMetricsClient.reportExecution()` in `template-metrics-client.ts:83`
- **What it does**: Gateway function that calls backend MCP tool with graceful degradation
- **Input**: `ActivityExecutionData` object
- **Output**: MCP tool call result (or gracefully fails)
- **Data transformation**: None (passes data through to MCP)

```typescript
interface ActivityExecutionData {
  activity_id: string
  template_id: string
  success: boolean
  duration: number      // milliseconds
  cost: number          // USD
  tokens: {
    input: number
    output: number
    cache: number
  }
}

const result = await callMCPTool<{ success: boolean; error?: string }>(
  "metabob_report_execution",  // ⚠️ Tool name
  { ...data }
)
```

---

### **3. MCP Client Layer**
**Component**: `callMCPTool()` in `template-metrics-client.ts:31`
- **What it does**: Calls Metabob MCP client with tool name and arguments
- **Input**: Tool name string, arguments object
- **Output**: Parsed JSON response or undefined
- **Data transformation**: Parses MCP response content from text to JSON

```typescript
const clients = await MCP.clients()
const metabobClient = clients["metabob"]

const result = await metabobClient.callTool({
  name: toolName,        // "metabob_report_execution"
  arguments: args
})

// Parse MCP response
const textContent = result.content
  .filter(item => item.type === "text")
  .map(item => item.text)
  .join("\n\n")

return JSON.parse(textContent)
```

---

### **4. ⚠️ MISSING LINK: Backend MCP Tool**
**Expected Component**: `metabob_report_execution` MCP tool handler
- **What it should do**: Receive execution data and call `activity_templates.update_metrics()`
- **Status**: ❌ **DOES NOT EXIST**
- **Actual Component**: `metabob_post_activity_result` (different name)
- **Impact**: All MCP calls fail with "tool not found" error

**The Gap**:
```
Frontend calls:      metabob_report_execution
Backend provides:    metabob_post_activity_result
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^
                     NAME MISMATCH
```

---

### **5. Backend MCP Tool Handler (Actual)**
**Component**: `metabob_post_activity_result()` in `activity_template_tools.py:255`
- **What it does**: MCP tool handler that extracts template ID and updates metrics
- **Input**: `activity_id` (string), `result` (dict)
- **Output**: Success/error status response
- **Data transformation**: Extracts template_id from activity_id using rsplit

```python
@mcp.tool(name="metabob_post_activity_result")
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,  # {success, duration, cost, tokens}
):
    # Extract template ID from activity ID
    template_id = activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
    
    activity_templates.update_metrics(template_id, result)
    
    return {"status": "success", "activity_id": activity_id}
```

---

### **6. Backend Metrics Update**
**Component**: `update_metrics()` in `activity_templates.py:239`
- **What it does**: Loads template JSON, updates metrics with incremental averaging, saves back
- **Input**: `template_id` (string), `result` (dict with success, duration, cost, tokens)
- **Output**: Updated template JSON file on disk
- **Data transformation**: Incremental average calculation for metrics

```python
def update_metrics(template_id: str, result: dict) -> None:
    storage_path = get_activity_storage_path()
    template_file = storage_path / f"{template_id}.json"
    
    # Load template
    with open(template_file) as f:
        template_data = json.load(f)
    
    # Get current metrics
    metrics = template_data.get("estimated_metrics", {})
    execution_count = metrics.get("execution_count", 0)
    success_count = metrics.get("success_count", 0)
    
    # Update counts
    execution_count += 1
    if result.get("success"):
        success_count += 1
    
    # Update averages (incremental)
    total_duration = metrics.get("avg_duration_ms", 0) * (execution_count - 1)
    total_cost = metrics.get("avg_cost", 0.0) * (execution_count - 1)
    
    new_avg_duration = (total_duration + result.get("duration", 0)) / execution_count
    new_avg_cost = (total_cost + result.get("cost", 0.0)) / execution_count
    
    # Save updated metrics
    template_data["estimated_metrics"] = {
        "execution_count": execution_count,
        "success_count": success_count,
        "success_rate": success_count / execution_count,
        "avg_duration_ms": int(new_avg_duration),
        "avg_cost": new_avg_cost,
    }
    
    # Write to disk
    with open(template_file, "w") as f:
        json.dump(template_data, f, indent=2)
```

---

## Parallel Path: Local Template Metrics Update

This path runs **before** the backend reporting and always succeeds (it's not blocked by the MCP issue).

### **A. Activity Tool (Local Metrics)**
**Component**: `activity.ts:932` in activity tool handler
- **What it does**: Updates template metrics locally using incremental weighted average
- **Input**: Activity execution result
- **Output**: Calls `TemplateRepository.updateMetrics()`
- **Data transformation**: Incremental weighted average calculation

```typescript
const newExecutions = template.executions + 1
const safeAvgTokens = template.avgTokens || { input: 0, output: 0, cache: 0 }

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

---

### **B. Template Repository**
**Component**: `TemplateRepository.updateMetrics()` in `activity-template-repository.ts:238`
- **What it does**: Delegates to TemplateLoader
- **Input**: Template ID, metrics partial
- **Output**: Calls `TemplateLoader.updateMetrics()`
- **Data transformation**: None (pass-through)

```typescript
export async function updateMetrics(
  id: string,
  metrics: Partial<ActivityTemplate.Schema>,
  backends?: Backend[],
): Promise<void> {
  await TemplateLoader.updateMetrics(id, metrics)
}
```

---

### **C. Template Loader (Dual Write)**
**Component**: `TemplateLoader.updateMetrics()` in `template-loader.ts:415`
- **What it does**: Updates metrics in both Metabob TemplateService AND local storage
- **Input**: Template ID, metrics partial
- **Output**: Updates in both backends, invalidates cache
- **Data transformation**: None

```typescript
export async function updateMetrics(
  id: string,
  metrics: Partial<ActivityTemplate.Schema>
): Promise<void> {
  // Update in Metabob TemplateService
  try {
    await TemplateServiceClient.updateTemplateMetrics({
      templateId: id,
      metrics,
    })
    log.info("metrics updated in metabob")
  } catch (error) {
    log.warn("metabob metrics update failed")
  }

  // Update in local storage
  try {
    await ActivityTemplate.update(id, metrics)
    log.info("metrics updated in local")
  } catch (error) {
    log.warn("local metrics update failed")
  }

  // Invalidate cache
  TemplateCache.invalidate(id)
}
```

---

### **D. Template Service Client**
**Component**: `TemplateServiceClient.updateTemplateMetrics()` in `template-service-client.ts:343`
- **What it does**: Checks connection, calls MetabobCLI.updateActivityMetrics
- **Input**: Template ID, metrics object
- **Output**: Success/error result
- **Data transformation**: None

```typescript
export async function updateTemplateMetrics(
  options: UpdateTemplateMetricsOptions,
): Promise<UpdateTemplateMetricsResult> {
  const status = await checkConnection()
  if (!status.connected) {
    return { success: false, error: "Metabob not available" }
  }

  const success = await MetabobCLI.updateActivityMetrics(
    options.templateId,
    options.metrics
  )

  return success 
    ? { success: true } 
    : { success: false, error: "Failed to update metrics" }
}
```

---

### **E. Metabob CLI (MCP Tool Call)**
**Component**: `MetabobCLI.updateActivityMetrics()` in `metabob.ts:863`
- **What it does**: Calls `update_activity_metrics` MCP tool
- **Input**: Template ID, metrics object
- **Output**: Boolean success status
- **Data transformation**: None

```typescript
export async function updateActivityMetrics(
  templateId: string,
  metrics: Partial<ActivityTemplate.Schema>,
): Promise<boolean> {
  const result = await callMCPTool<{
    status: string
    error?: string
  }>("update_activity_metrics", {
    activity_id: templateId,
    metrics,
  })

  return result?.status === "success"
}
```

---

### **F. Local Storage Update**
**Component**: `ActivityTemplate.update()` in `activity-template.ts:1347`
- **What it does**: Loads template, merges updates, saves to disk
- **Input**: Template ID, partial updates
- **Output**: Updated template schema
- **Data transformation**: Merges updates with existing template, sets updatedAt timestamp

```typescript
export async function update(
  id: string,
  updates: Partial<Omit<Schema, "id" | "version" | "createdAt">>,
): Promise<Schema> {
  const template = await load(id)

  const updated: Schema = {
    ...template,
    ...updates,
    id: template.id,
    version: template.version,
    createdAt: template.createdAt,
    updatedAt: Date.now(),
  }

  await save(updated)  // Writes to disk

  return updated
}
```

---

## 📊 Summary: Complete Data Flow

### Path 1: Backend MCP Reporting (BROKEN)
```
Activity.complete() 
  → TemplateMetricsClient.reportExecution()
    → callMCPTool("metabob_report_execution")  // ❌ Tool not found
      → [MISSING: metabob_report_execution handler]
        → activity_templates.update_metrics()
          → Update backend JSON file
```

**Status**: ❌ Broken due to tool name mismatch

---

### Path 2: Local Metrics Update (WORKING)
```
activity.ts:932 (tool handler)
  → TemplateRepository.updateMetrics()
    → TemplateLoader.updateMetrics()
      ├─→ TemplateServiceClient.updateTemplateMetrics()
      │    → MetabobCLI.updateActivityMetrics()
      │      → callMCPTool("update_activity_metrics")  // Different MCP tool
      │        → [Backend handler updates metrics]
      │
      └─→ ActivityTemplate.update()
           → save() to local disk
```

**Status**: ✅ Working (uses different MCP tool `update_activity_metrics`)

---

## 🔴 Critical Issues

### Issue 1: Tool Name Mismatch
**Problem**: Frontend calls `metabob_report_execution`, backend provides `metabob_post_activity_result`

**Impact**: Activity completion metrics never reach backend database

**Fix**: Rename backend tool from `metabob_post_activity_result` to `metabob_report_execution`

---

### Issue 2: Duplicate MCP Tool Usage
**Problem**: Two different MCP tools for the same purpose:
- `metabob_report_execution` (expected, not found)
- `update_activity_metrics` (working, used by local path)

**Impact**: Confusion, redundant code paths

**Fix**: Consolidate to single MCP tool name

---

### Issue 3: Data Schema Mismatch
**Problem**: Backend expects `result: dict`, frontend sends structured `ActivityExecutionData`

**Current Frontend**:
```typescript
{
  activity_id: string
  template_id: string
  success: boolean
  duration: number
  cost: number
  tokens: { input, output, cache }
}
```

**Backend Expects**:
```python
{
  activity_id: str,
  result: {
    success: bool,
    duration: int,
    cost: float,
    tokens: dict
  }
}
```

**Fix**: Align schemas or adapt backend to accept flat structure

---

## 🎯 Recommended Fix

Use `propagate-change-through-flow` activity to:

1. **Rename backend MCP tool**:
   - From: `metabob_post_activity_result`
   - To: `metabob_report_execution`

2. **Update backend schema** to accept flat parameters:
   ```python
   @mcp.tool(name="metabob_report_execution")
   async def metabob_report_execution(
       activity_id: str,
       template_id: str,
       success: bool,
       duration: int,
       cost: float,
       tokens: dict,
   ):
       result = {
           "success": success,
           "duration": duration,
           "cost": cost,
           "tokens": tokens,
       }
       activity_templates.update_metrics(template_id, result)
   ```

3. **Test end-to-end** with real activity execution

4. **Validate backend database** receives execution data

---

## 📁 Files Involved

### Frontend (OpenCode)
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts:616` - Entry point
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:83` - MCP gateway
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:932` - Local metrics update
- `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts:238` - Repository
- `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:415` - Dual write
- `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:343` - Service client
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:863` - Metabob CLI
- `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts:1347` - Local storage

### Backend (Metabob CLI)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:255` - MCP tool handler
- `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:239` - Metrics update logic

---

## 🚀 Next Steps

1. Create impulse with this analysis
2. Run `propagate-change-through-flow` activity with:
   - Source: `metabob_post_activity_result` in `activity_template_tools.py:255`
   - Target: Rename to `metabob_report_execution`
   - Adapt schema to match frontend expectations
3. Test with real activity execution
4. Verify backend JSON files are updated correctly
