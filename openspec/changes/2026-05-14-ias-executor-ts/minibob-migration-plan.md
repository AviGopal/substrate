# MiniBob → ias-executor-ts Migration Plan

_Task 9.4 · Written 2026-05-16_

## Goal

Replace MiniBob's embedded execution engine (`activity.ts`, `impulse.ts`, `composition-chain.ts`, etc.) with `@avigopal/ias-executor-ts` as a dependency, keeping the MiniBob shell (CLI, REPL, boredom loop, ACP, embedded templates) intact. The migration is incremental — each phase is independently shippable with a validation gate before the next phase starts.

---

## Phase 0 — Add dependency (no behavior change)

**PR scope:** Add `@avigopal/ias-executor-ts` to `repos/minibob/package.json`.

```bash
bun add @avigopal/ias-executor-ts
```

**Validation gate:** `bun test` still passes; typecheck clean; no new imports yet.

---

## Phase 1 — Dual-write execution traces

**Goal:** Emit traces to both the existing `TraceSink` path and the new `TraceSink` port simultaneously, proving the new trace assembly matches the old one.

**Steps:**

1. In `src/activity.ts` (or `activity-tracer.ts`), instantiate an `HttpTraceSink` pointing at the same activity-api endpoint:
   ```typescript
   import { HttpTraceSink } from "@avigopal/ias-executor-ts/examples/bun-host";
   const iastraceSink = new HttpTraceSink(config.endpoint, config.apiKey);
   ```
2. After each activity completes, call `iastraceSink.record(trace)` where `trace` is the IAS `ExecutionTrace` shape (convert from the MiniBob internal shape).
3. Log mismatches between old and new trace shapes.

**Validation gate:** Canary shows duplicate traces with matching `executionId`; no new failures in activity-api.

---

## Phase 2 — Replace ImpulseStore

**Goal:** Swap `src/impulse.ts` internals for `ImpulseStore` from ias-executor-ts.

**Steps:**

1. Add `ImpulseStore` as a field on the execution context instead of using the process-global store.
2. Replace `create/load/update/unload` calls in `activity.ts` + `goal-processor.ts` with IAS equivalents.
3. Replace `formatImpulsesForContext(...)` with `store.formatForContext({ includeContent: true })`.
4. Keep `vessel-discovery.ts` as-is — it wraps the ias `CapabilityIndex` port interface anyway; no change needed until Phase 4.

**Singleton to eliminate:** The process-global `ImpulseStore` in current `impulse.ts` → per-execution instance.

**Validation gate:** `bun test` — impulse lifecycle tests pass with new store; no regression in `activity-impulse-nullguard.test.ts` or `activity-prebinding-emission.test.ts`.

---

## Phase 3 — Replace ActivityExecutor core

**Goal:** Swap `src/activity.ts` task-dispatch loop for `ActivityExecutor` from ias-executor-ts.

**Steps:**

1. Instantiate `ExecutionRuntime` with the existing `SteppingClock` / `SequentialRandom` wrappers.
2. Wire the existing resolver registry into `runtime.resolvers` using `runtime.resolvers.register(...)`.
3. Replace the MiniBob task loop with `new ActivityExecutor(runtime).execute(template, opts)`.
4. Map MiniBob's `ExecuteOptions` (variables, impulses, reason, budget) to IAS `ExecuteOptions`.
5. Keep `improviser.ts`, `boredom.ts`, `goal-processor.ts`, `acp.ts` unchanged — they call `executeActivity(template, opts)` which becomes a thin wrapper around the new `ActivityExecutor`.

**Singleton to eliminate:** `activity.ts`'s module-level resolver map → `runtime.resolvers` per execution.

**Validation gate:** `bun test` in full; 0 regressions; `bun run typecheck` clean.

---

## Phase 4 — Attach capability bundles

**Goal:** Replace MiniBob's inline `file-read`/`bash`/`llm` resolver registration with `createBunServerBundle`.

**Steps:**

1. In `src/vessel-bootstrap.ts` (or wherever resolvers are registered at startup), replace:
   ```typescript
   registry.register({ id: "bash", tier: "deterministic", resolve: ... })
   registry.register({ id: "file-read", tier: "deterministic", resolve: ... })
   ```
   with:
   ```typescript
   import { createBunServerBundle } from "@avigopal/ias-executor-ts/bundles";
   const bundle = createBunServerBundle({ llm: llmPort });
   bundle.applyTo(runtime);
   ```
2. Remove the now-duplicate inline resolver factories from MiniBob.

**Validation gate:** `bundle.vessels` list matches what was previously hardcoded; adapter tests pass.

---

## Phase 5 — Replace DiscoveryCapabilityIndex

**Goal:** Replace `src/vessel-discovery.ts`'s internal TTL cache with `DiscoveryCapabilityIndex` from ias-executor-ts/adapters.

**Steps:**

1. In vessel-discovery.ts, replace the internal cache + fetch logic with:
   ```typescript
   import { DiscoveryCapabilityIndex } from "@avigopal/ias-executor-ts/adapters";
   const capIndex = new DiscoveryCapabilityIndex(discoveryEndpoint, apiKey, { cacheTtlMs: 60_000 });
   ```
2. Expose `capIndex.listResolverIds()` where MiniBob currently calls `getRegisteredResolvers()`.
3. Call `capIndex.invalidate()` when discovery-vessel signals a registry change.

**Validation gate:** Live canary test — `minibob --single "list available resolvers"` returns the same set as before; no extra HTTP calls.

---

## Phase 6 — Convert singletons to per-runtime instances

**Goal:** Eliminate the remaining process-global state items.

| Singleton | Conversion |
|---|---|
| `config.ts` `getConfig()` | Pass `config` as `BunHostOptions` into `ExecutionRuntime` constructor |
| `trace-cache.ts` | Replace with `TraceSink` (HTTP) + in-memory `Map` in `BunHost` |
| `llm.ts` `getClient()` | Wrap Anthropic client as `LLMPort`, inject via `createBunServerBundle({ llm })` |
| `mcp.ts` `getMcpSession()` | Inject as `MCPAdapter implements FetchPort` (or keep as shell concern) |
| `process-registry.ts` | Inline per-execution PID tracking in `BunProcessAdapter` |
| `vessel-registry.ts` | Replace with `AttachedVesselRegistry` from runtime |
| `vessel-discovery.ts` | Replaced in Phase 5 |

**Validation gate:** `bun test` with isolation: each test file can create its own `BunHost` without leaking state to neighbors. Run tests in parallel — no flakiness from shared state.

---

## Phase 7 — Delete migrated code

After all phases pass with 0 regressions:

- Delete `src/activity.ts`, `src/impulse.ts`, `src/activity-tracer.ts`, `src/composition-chain.ts`, `src/composition-observer.ts`
- Delete inline resolver factories that are now in `BunServerBundle`
- Delete the old `TraceSink` path from Phase 1

**Validation gate:** `bun test` still green; `bun run typecheck` clean; bundle size reduced.

---

## Invariants throughout

- MiniBob shell files (`index.ts`, `cli/`, `repl.ts`, `boredom.ts`, `acp.ts`, `embedded-templates/`, `improviser.ts`) are **never touched** by this migration.
- Each phase is a standalone PR with its own test gate. No bundling phases.
- No breaking changes to the MiniBob HTTP API or CLI interface.
- `bun test` runs on every commit; `bun run typecheck` is a required CI step.
