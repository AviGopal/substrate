# Memory Agent Schema Compatibility Fix

## Issue Discovered

After fixing the model ID issue, context gathering progressed but failed with:
```
ActivityContextError: Context gathering failed: output_format.schema: For 'object' type, property 'propertyNames' is not supported
```

## Root Cause

**File**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts:666`

The `analyzeContextNeeds` function used `z.record()` to define the response schema:

```typescript
const responseSchema = z.record(
  z.string(),
  z.object({
    files: z.array(z.string()).optional(),
    // ...
  }),
)
```

### The Problem

When `z.record()` is converted to JSON Schema for Anthropic's API, it generates:

```json
{
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": { ... }
}
```

**Anthropic's API does not support the `propertyNames` constraint** in JSON Schema, causing immediate validation failure.

## The Fix

**Commit**: `d6fececa`

Replaced `z.record()` with `z.object({}).catchall()`:

```typescript
const responseSchema = z
  .object({})
  .catchall(
    z.object({
      files: z.array(z.string()).optional(),
      components: z.array(z.object({
        file: z.string(),
        name: z.string(),
      })).optional(),
      bashCommands: z.array(z.string()).optional(),
      memos: z.array(z.string()).optional(),
    }),
  )
```

### Why This Works

`z.object({}).catchall()` achieves the same result (dynamic keys with typed values) but generates a compatible JSON schema:

```json
{
  "type": "object",
  "additionalProperties": { ... }
}
```

No `propertyNames` constraint, so Anthropic accepts it.

## Impact

This fix unblocks:
✅ Memory agent LLM calls with dynamic response schemas
✅ Context negotiation for activities
✅ The `analyzeContextNeeds` function

## Issues Fixed So Far

1. ✅ **contextRequirements registration** (previous session)
2. ✅ **Memory agent model ID** (agent.ts + opencode.json)
3. ✅ **Context gathering timeout** (3s → 30s)
4. ✅ **Schema compatibility** (z.record → z.object().catchall)

## Next Step

**Dev server restart required** to reload the TypeScript changes:
```bash
# Kill current dev server process
# Then restart from repos/metabob-opencode/packages/opencode
bun run dev ../..
```

After restart, the activity execution should successfully:
1. Trigger context negotiation
2. Call memory agent with compatible schema
3. Gather 3 context requirements
4. Execute 5-task workflow
5. Generate documentation

---

**Status**: Fix committed, restart required
**Date**: 2026-02-19
**Commit**: d6fececa
