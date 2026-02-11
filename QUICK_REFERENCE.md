# V2 Activity System Quick Reference

## 📋 TL;DR

**Status**: ✅ Working end-to-end  
**Test**: `python test_v2_with_session.py` → All pass  
**Documentation**: See `V2_ACTIVITY_SYSTEM_STATUS.md`

## 🏗️ Architecture

```
OpenCode (Execution) → MCP (Tracking) → Backend (Storage)
```

- **OpenCode**: Executes activities via `ActivityTool`
- **MCP**: Provides discovery & tracking (metabob-cli)
- **Backend**: Stores templates & metrics (metabob-rpc-api)

## 🧪 Test

```bash
python test_v2_with_session.py
```

Expected: All ✓

## 📁 Key Files

### Backend
- `repos/metabob-rpc-api/server/routes/v2_activities.py` - V2 API
- Fixed: Line 262 (added `tasks` field)

### MCP
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Manager
- Fixed: Lines 178, 322, 580 (V2 endpoints)

### OpenCode
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Main tool
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - MCP wrappers
- No changes needed - already correct!

## ✅ What Works

- ✅ Template search & discovery
- ✅ Template fetching (V2 schema with `tasks`)
- ✅ Execution tracking
- ✅ Incremental step delivery
- ✅ Metrics reporting
- ✅ OpenCode integration

## ❌ What's NOT Needed

- ❌ MCP `activity` tool as executor (it's a stub, never called)
- ❌ Changes to OpenCode (already correct)

## 📚 Documentation

1. **V2_ACTIVITY_SYSTEM_STATUS.md** - Complete architecture
2. **TEST_E2E_ACTIVITY_FLOW.md** - Testing guide
3. **RESUME_SESSION_SUMMARY.md** - Session summary

## 🔍 Key Insight

OpenCode's `ActivityTool` drives execution, NOT the MCP `activity` tool.

**Correct Flow**:
```typescript
// OpenCode ActivityTool
MetabobCLI.startExecution()  // Create tracking
loop:
  MetabobCLI.getNextStep()   // Get current step
  TaskTool.execute()          // Execute with full context
  MetabobCLI.reportStepResult() // Report metrics
```

## 🚀 Usage

```typescript
// In OpenCode agent
activity({
  activityId: "bug-fix-v1",
  variables: { file_path: "src/app.ts" },
  reason: "Fix authentication bug"
})
```

## 📊 Monitoring

```bash
# Backend logs
./devbob logs metabob-rpc-api-server -f

# Database UI
open http://localhost:8001

# API docs
open http://localhost:8080/docs
```

## ✨ Success Criteria

- ✅ Backend V2 API operational
- ✅ MCP tracking working
- ✅ OpenCode execution functional
- ✅ Tests passing
- ✅ Documentation complete

**No additional work needed!**
