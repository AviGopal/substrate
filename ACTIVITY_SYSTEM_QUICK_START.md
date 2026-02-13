# Activity System - Quick Start Guide

**Status**: ✅ Fully Operational  
**Last Updated**: February 12, 2026

---

## TL;DR - It Works!

```javascript
// In OpenCode
activity({
  activityId: "infrastructure-86af0790",
  variables: {message: "Hello World"},
  reason: "Test activity execution"
})

// Result: ✅ Success!
// Activity: Echo Proof Feb12 ✅
// Tasks: ✅ Echo message (109.5s) - Cost: $0.0012
```

---

## What Was Fixed

**8 bugs in field name mapping and MCP response format**

### The Pattern
All bugs were variations of:
1. **Field names**: Proto `snake_case` → TypeScript `camelCase`
2. **Response format**: Must wrap in `{status: "success", ...}`

### The Fixes
| Bug | Location | Fix |
|-----|----------|-----|
| Missing `id` | metabob-cli | Map `variant_id` → `id` |
| Missing `name` | metabob-cli | Map `variant_name` → `name` |
| Missing `impulseReferences` | metabob-cli | Map `impulse_refs` → `impulseReferences` |
| Wrong startExecution format | metabob-cli | Return `status: "success"` + `state` |
| Missing complete field | metabob-cli | Add `complete: false` to response |
| Wrong current_step format | metabob-cli | Return full proto task object |
| No status in get_next_step | metabob-cli | Wrap response with `status: "success"` |
| No status in report_step_result | metabob-cli | Wrap response with `status: "success"` |

---

## How It Works Now

### Flow
```
1. Load template from backend (proto format)
2. metabob-cli maps field names (snake_case → camelCase)
3. OpenCode receives TypeScript-friendly format
4. Start execution via MCP
5. Loop: getNextStep → execute → reportResult
6. Complete when no more steps
7. Format and display results
```

### What Gets Tracked
- ✅ Execution time per task
- ✅ Cost per task and total
- ✅ Token usage estimates
- ✅ Success/failure status
- ✅ Tool calls made
- ✅ Output and errors

---

## Available Templates

```bash
# List all templates
search_activities({})

# Search by category
search_activities({ category: "infrastructure" })

# Get details
activity({ activityId: "infrastructure-86af0790", ... })
```

**Currently Working**:
- `infrastructure-86af0790`: Echo Proof (1 task, validated ✅)

---

## Testing Checklist

### Basic Test
```javascript
activity({
  activityId: "infrastructure-86af0790",
  variables: {message: "Test"},
  reason: "Verify system works"
})
```

**Expected**: 
- ✅ in 1-2 minutes
- Task shows as completed
- Metrics displayed

### Check Logs
```bash
tail -50 activity-debug.log | grep -E "SUCCESS|COMPLETED|✅"
```

### Backend Verification
```bash
# Check execution was recorded
SESSION_TOKEN=$(python3 -c "import json; print(json.load(open('.metabob/state'))['session_metadata']['session_token'])")
curl -s -H "Authorization: Bearer $SESSION_TOKEN" \
  http://localhost:8080/v2/activities/executions | jq
```

---

## Troubleshooting

### If Activity Fails

1. **Check logs**:
   ```bash
   tail -100 activity-debug.log | grep ERROR
   ```

2. **Verify backend**:
   ```bash
   curl http://localhost:8080/status
   # Should return: {"status":"ok"}
   ```

3. **Check MCP connection**:
   ```bash
   search_activities({})
   # Should return list of templates
   ```

4. **Verify session**:
   ```bash
   python3 scripts/create_session_state.py
   # Refreshes session token
   ```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Template not found | Backend down | Start backend |
| MCP error | Session expired | Refresh token |
| Timeout | Backend slow | Increase timeout |
| No tasks shown | Result formatting | Check for errors in logs |

---

## Architecture Overview

```
┌─────────────┐
│  OpenCode   │  (TypeScript, camelCase)
└──────┬──────┘
       │ MCP calls
       ▼
┌─────────────┐
│ metabob-cli │  (Field name mapping layer)
└──────┬──────┘
       │ HTTP API
       ▼
┌─────────────┐
│   Backend   │  (Proto format, snake_case)
└─────────────┘
```

**Key Principle**: Backend is source of truth. metabob-cli only maps field names.

---

## Next Steps

### Try These
1. ✅ Run basic test (above)
2. Create a new template
3. Test multi-step template
4. Test validation failures
5. Test trailblazing mode

### Build On This
1. Create activity-create template (self-hosting)
2. Add your own templates
3. Implement variant selection
4. Add A/B testing
5. Build analytics

---

## Files You Might Edit

### To Add New Template
- Backend: `sql/insert_activity_template.surql`
- Or use: activity-create template (coming soon)

### To Modify Execution
- OpenCode: `packages/opencode/src/tool/activity.ts`
- metabob-cli: `src/metabob_cli/mcp/activity_manager.py`

### To Change MCP Tools
- metabob-cli: `src/metabob_cli/mcp/tools.py`

---

## Success!

The activity system is fully operational and ready for use. All core functionality works:
- ✅ Discovery
- ✅ Loading  
- ✅ Execution
- ✅ Reporting
- ✅ Metrics

**Go build something!** 🚀

---

*For detailed bug history: see ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md*  
*For full execution traces: see activity-debug.log*
