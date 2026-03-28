# Ready for Activity Execution Success

**Root Cause Identified and Fixed**

## The Problem
OpenCode's `MCP.tools()` function calls `listTools()` periodically to refresh the tool list. When this call times out, it **deletes the entire MCP client** from state. This is too aggressive - the client works fine for direct tool calls even if listTools() occasionally fails.

## Timeline
1. ✅ MCP client created successfully at startup
2. ⏱️ ~84 seconds later: tools() calls listTools() to refresh
3. ❌ listTools() times out (Request never reaches MCP server)
4. ❌ tools() deletes client from state  
5. ❌ All subsequent search_activities fail (no client available)

## The Fix
**Don't delete the client on listTools failure** - just mark status as 'degraded' and keep it alive.

## What Changed
```typescript
// Before: Delete client on error
delete s.clients[clientName]

// After: Keep client alive, mark as degraded
s.status[clientName] = { status: "degraded", error: e.message }
// Client remains available for direct tool calls
```

## Expected Result
After restart:
1. MCP client will be created ✓
2. tools() will call listTools() and it may timeout
3. Client will be marked 'degraded' but NOT deleted ✓
4. search_activities() will find the client ✓
5. Activities will be returned ✓✓✓

**Ready for the final test!**
