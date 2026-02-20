# Session Memory Agent Debugging

## Current Status

We're debugging the Session Memory Agent's ability to extract memos from the activity reason. The agent is **essential for cold-start learning** - it's how we create initial impulses before they're stored in SurrealDB.

## Architecture Understanding

### Context Requirements Design
- **NOT automatic extraction** - they're hints for useful impulses
- **First**: Load from SurrealDB (deterministic, learned behavior)
- **Fallback**: Session Memory Agent creates them (LLM-based cold start)
- **Goal**: Eliminate LLM over time as patterns are learned

### Why We Need This Working
The Session Memory Agent is the **learning mechanism**. Without it:
- Can't create initial impulses for new activity types
- Can't bootstrap the learning process
- Can't evolve from LLM-based → deterministic execution

## Bugs Fixed (7 total)

1. ✅ contextRequirements registration
2. ✅ Memory agent model ID (agent.ts)  
3. ✅ Memory agent model ID (opencode.json) + timeout
4. ✅ Schema compatibility (z.record → z.object().catchall)
5. ✅ Missing user message
6. ✅ Improved prompt to extract memos
7. ✅ Added debug logging and error details

## Current Issue

The LLM is being called but not returning `bugDescription` in its response.

**Error**: `Required context not found: bugDescription`

## Debug Changes Made

1. Added logging to show full LLM response
2. Enhanced error message with LLM response keys and full JSON
3. Added console.error output for debugging

## Next Step

Need to see what the LLM is actually returning. Console output should show:
```
=== MEMORY AGENT DEBUG ===
Required key missing: bugDescription
Hint: ...
LLM returned keys: [actual keys]
Full LLM response: {...}
```

This will tell us if:
- LLM is responding with empty object
- LLM is using wrong key names
- LLM is not extracting the information at all

---

**Status**: Debug instrumentation added, need to see console output or restart to ensure changes are loaded
**Date**: 2026-02-19
**Commits**: `522938d6`, `e0c36509`, `8109df58`
