# Tool Usage Tracking Test Plan

## Phase 1.5: Tool Usage Patterns Implementation

### Implementation Summary

**Backend (metabob-activity-api):**
1. ✅ Added `tool_usage_patterns` table schema (schemas.ts)
   - Tracks: times_used, times_succeeded, times_failed
   - Learns: usage_probability, success_correlation, is_required, is_optional
   - Bayesian-style metrics for learning which tools activities need

2. ✅ Added POST `/v2/activities/tool-usage` endpoint
   - Records tool usage during execution
   - Updates metrics incrementally (rolling averages)
   - Computes learned patterns on each update

3. ✅ Added GET `/v2/activities/tool-usage` endpoint
   - Query by tool_name, activity_variant_id, is_required
   - Filter by min_usage_probability
   - Returns patterns with success correlation scores

**Minibob:**
1. ✅ Added `recordToolUsage()` method to MCPClient (mcp.ts)
   - POSTs tool usage records to backend
   - Reports: tool name, activity, execution, success states

2. ✅ Integrated tool usage reporting in ActivityExecutor (activity.ts)
   - After execution completes, iterates through toolCallRecords
   - Reports each tool usage with success correlation
   - Includes params complexity metric

### Data Flow

```
Activity Execution
    ↓
Tool Call (wrapped handler)
    ↓
Record in toolCallRecords[]
    ↓
Execution Completes
    ↓
Report to Backend (POST /v2/activities/tool-usage)
    ↓
Backend Updates Patterns
    ↓
Learn: usage_probability, success_correlation, is_required
```

### Testing Checklist

**Manual Testing:**
1. [ ] Start metabob-activity-api backend
2. [ ] Execute an activity with minibob that uses multiple tools
3. [ ] Check logs for "Tool usage recorded" messages
4. [ ] Query GET /v2/activities/tool-usage to verify patterns stored
5. [ ] Execute same activity again to verify metrics update correctly
6. [ ] Check that usage_probability and success_correlation evolve

**Expected Results:**
- First execution: usage_probability = 1.0 (tool was used)
- Second execution without tool: usage_probability drops (e.g., 0.5)
- is_required = false if activity succeeds without tool
- success_correlation positive if tool usage correlates with success

**Integration Testing:**
1. [ ] Run activity template that always uses specific tools
2. [ ] Verify is_required = true after multiple successes
3. [ ] Run activity that sometimes uses optional tool
4. [ ] Verify is_optional = true and usage_probability < 1.0

### Use Cases (Future)

**Pre-flight Checks:**
```typescript
// Before executing activity, check if vessel has required tools
const patterns = await mcp.getToolUsagePatterns({
  activity_variant_id: 'add-feature-complete',
  is_required: true
})

for (const pattern of patterns) {
  if (!vessel.hasТool(pattern.tool_name)) {
    throw new Error(`Missing required tool: ${pattern.tool_name}`)
  }
}
```

**Optimization:**
```typescript
// Skip loading low-relevance optional tools
const patterns = await mcp.getToolUsagePatterns({
  activity_variant_id: 'refactor-with-tests',
  min_usage_probability: 0.5 // Only tools used >50% of time
})
```

### Learning Examples

**Example 1: Required Tool**
```
Activity: add-feature-complete
Tool: bash
Executions: 10/10 used bash, 10/10 succeeded
Result:
  - usage_probability = 1.0
  - is_required = true (never succeeded without it)
  - success_correlation = 1.0
```

**Example 2: Optional Tool**
```
Activity: fix-bug-complete
Tool: metabob_search_codebase_issues
Executions: 5/10 used search, 8/10 total succeeded (3 without search)
Result:
  - usage_probability = 0.5
  - is_optional = true
  - success_correlation = 0.2 (small positive correlation)
```

**Example 3: Noise Tool**
```
Activity: commit-organized-changes
Tool: playwright_browser_navigate
Executions: 1/50 used (mistake), 49/50 succeeded
Result:
  - usage_probability = 0.02
  - is_optional = true
  - success_correlation = -0.96 (negative: hurts success!)
  - Recommendation: Don't load this tool for this activity
```

### Files Modified

**Backend:**
- `repos/metabob-activity-api/src/models/schemas.ts` (+57 lines)
  - Added: ToolUsagePatternSchema, ToolUsageRecordRequestSchema, ToolUsageQuerySchema, ToolUsageResponseSchema
- `repos/metabob-activity-api/src/routes/activities.ts` (+330 lines)
  - Added: POST /tool-usage endpoint (~170 lines)
  - Added: GET /tool-usage endpoint (~160 lines)

**Minibob:**
- `repos/minibob/src/mcp.ts` (+46 lines)
  - Added: recordToolUsage() method
- `repos/minibob/src/activity.ts` (+19 lines)
  - Added: Tool usage reporting loop after execution

### Next Steps (Phase 1.6+)

1. **Execution Sequences Table**
   - Track which activities run together in same session
   - Learn optimal execution sequences for goals

2. **Goal Execution Paths Table**
   - Store multi-step paths: goal → activity1 → activity2 → outcome
   - Thompson Sampling over paths (not just individual activities)

3. **Minibob Integration with Impulse Relevance**
   - Query impulse relevance before execution
   - Report impulse usage after execution
   - Skip low-relevance impulses to save tokens

4. **Boredom Task Generation**
   - Background process creates variant activities
   - Split/merge/debug based on metrics
   - Autonomous exploration of activity space

### Notes

- Pre-existing TypeScript errors in routes/activities.ts (lines 941-942, unrelated)
- Using `// @ts-ignore` for SurrealDB type inference issues
- All endpoints follow existing patterns (validation, logging, error handling)
- Learning loops are non-blocking (won't fail execution if backend unavailable)
