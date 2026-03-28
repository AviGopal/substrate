# Impulse Resolution Protocol

## Overview

This specification defines how impulses are resolved across multiple vessels and the backend. The key principle from `IMPULSE_ACTIVITY_FOUNDATION.md` is: **resolvers live where the data is**.

## Resolution Hierarchy

When an impulse needs to be loaded, resolution proceeds through this hierarchy:

```
1. LOCAL (MiniBob) - Fastest, no network
   ├── memo: Embedded content in pointer
   └── file: Read from filesystem

2. CUSTOM (Registered Resolvers) - Plugin extensibility
   └── Registered via impulseStore.registerResolver(type, handler)

3. BACKEND (MCP) - For trace/metrics/pattern data
   ├── activityExecutionTrace: Full execution history
   ├── activityTemplate: Template definitions
   ├── activityMetrics: Performance statistics
   └── Any new type backend introduces

4. FALLBACK - In-memory cache
   └── activityOutput: Output from current session
```

## Resolution Flow

```typescript
async function resolvePointer(pointer: ImpulsePointer): Promise<string> {
  // 1. LOCAL: memo (embedded content)
  if (pointer.type === "memo" && "content" in pointer) {
    return pointer.content;
  }

  // 2. LOCAL: file (filesystem)
  if (pointer.type === "file" && "path" in pointer) {
    const content = await Bun.file(pointer.path).text();
    return applyOffsetLimit(content, pointer.offset, pointer.limit);
  }

  // 3. CUSTOM: registered resolver
  if (customResolvers.has(pointer.type)) {
    return await customResolvers.get(pointer.type)(pointer);
  }

  // 4. BACKEND: delegate via MCP
  if (isMCPEnabled()) {
    const mcp = getMCPClient();
    if (mcp) {
      return await mcp.resolveImpulse(pointer);
    }
  }

  // 5. FALLBACK: in-memory activityOutput
  if (pointer.type === "activityOutput") {
    return getActivityOutput(pointer.activityId, pointer.taskId);
  }

  // 6. FAIL
  throw new Error(`Cannot resolve impulse type "${pointer.type}"`);
}
```

## Vessel Capability Matching

Each vessel declares what impulse types it can resolve via `vessel.resolves[]`:

```typescript
interface Vessel {
  id: string;
  resolves: string[];  // ["file", "memo", "sql", "sensor"]
}
```

### Routing Rules

1. **Local types** (`file`, `memo`) - Always resolved by the vessel that created the impulse
2. **Backend types** (`activityExecutionTrace`, `activityMetrics`) - Always delegated to backend
3. **Custom types** - Resolved by vessel with matching capability in `resolves[]`

### Multi-Vessel Routing (Future)

When multiple vessels exist:

```typescript
async function routeToVessel(pointer: ImpulsePointer): Promise<Vessel> {
  // 1. Check if current vessel can resolve
  if (currentVessel.resolves.includes(pointer.type)) {
    return currentVessel;
  }

  // 2. Query backend for capable vessels
  const capableVessels = await backend.query(`
    SELECT * FROM vessel
    WHERE $type IN resolves
    AND is_active = true
    ORDER BY last_active_at DESC
  `, { type: pointer.type });

  // 3. Return first available
  if (capableVessels.length > 0) {
    return capableVessels[0];
  }

  // 4. Fall back to backend
  return { id: "backend", resolves: ["*"] };
}
```

## Fallback Chains

When resolution fails at one level, fall back to the next:

| Primary | Fallback 1 | Fallback 2 | Final |
|---------|------------|------------|-------|
| file | memo (if cached) | backend | error |
| activityOutput | backend | in-memory | error |
| custom | backend | - | error |
| backend | - | - | error |

> **Note:** Peer vessel resolution (formerly ACP) has been removed. Vessels communicate through shared impulse spaces, not direct calls.

### Fallback Implementation

```typescript
async function resolveWithFallback(
  pointer: ImpulsePointer,
  fallbacks: ResolverType[]
): Promise<ResolverResult> {
  const errors: Error[] = [];

  // Try primary
  try {
    return await resolvePointer(pointer);
  } catch (e) {
    errors.push(e);
  }

  // Try fallbacks
  for (const fallbackType of fallbacks) {
    try {
      const fallbackPointer = { ...pointer, type: fallbackType };
      return await resolvePointer(fallbackPointer);
    } catch (e) {
      errors.push(e);
    }
  }

  // All failed
  throw new AggregateError(errors, `Resolution failed for ${pointer.type}`);
}
```

## Backend Resolution Endpoint

```typescript
// POST /v2/impulses/resolve
interface ResolveRequest {
  pointer: {
    type: string;
    [key: string]: unknown;
  };
  budget?: number;  // Max tokens to return
}

interface ResolveResponse {
  content: string;
  tokens: number;
  truncated: boolean;
  metadata?: {
    shape: string;
    summary?: string;
  };
}
```

## Pointer Type Registry

| Type | Resolver | Data Location | Example |
|------|----------|---------------|---------|
| `memo` | MiniBob local | In pointer | `{ type: "memo", content: "text" }` |
| `file` | MiniBob local | Filesystem | `{ type: "file", path: "/src/file.ts" }` |
| `activityOutput` | MiniBob memory | Session cache | `{ type: "activityOutput", activityId: "..." }` |
| `activityExecutionTrace` | Backend | execution table | `{ type: "activityExecutionTrace", executionId: "..." }` |
| `activityTemplate` | Backend | activity table | `{ type: "activityTemplate", activityId: "..." }` |
| `activityMetrics` | Backend | v_activity_score | `{ type: "activityMetrics", activityId: "..." }` |
| `sql` | Custom resolver | Database | `{ type: "sql", query: "...", params: {...} }` |

## Error Handling

```typescript
class ImpulseResolutionError extends Error {
  constructor(
    public pointerType: string,
    public attemptedResolvers: string[],
    public originalErrors: Error[]
  ) {
    super(`Failed to resolve impulse type "${pointerType}"`);
  }
}
```

## Caching Strategy

| Level | TTL | Invalidation |
|-------|-----|--------------|
| In-memory (activityOutput) | Session | Session end |
| Local file hash | 5 minutes | File modification |
| Backend trace | 1 hour | Execution update |
| Backend metrics | 5 minutes | New execution |

## Performance Targets

| Resolution Type | Target Latency |
|-----------------|----------------|
| memo | < 1ms |
| file (cached) | < 10ms |
| file (uncached) | < 100ms |
| backend | < 500ms |
