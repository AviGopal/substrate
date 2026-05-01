## Why

Every authenticated query in `repos/metabob-activity-api/src/db/surreal.ts` opens a fresh SurrealDB session and tears it down at the end of one statement. `queryWithAuth(jwt, sql, params)` does:

1. `new Surreal()`
2. `await db.connect(config.surrealdb.url)`
3. `await db.use({ namespace, database })`
4. `await db.authenticate(jwt)` — the expensive step; SurrealDB's `apikey_token` ACCESS validates HS512 signature + `exp` + (NS, DB, AC) tuple
5. `await db.query(sql, params)`
6. `await db.close()`

Steps 1-4 take ~100-500ms per call. Under the burst that minibob produces during a single goal run — three `gather_context` impulse-resolves, dozens of lifecycle impulse INSERTs, validator-dispatch chains, metrics upserts, trace storage — activity-api fires that sequence dozens of times in seconds. Three secondary effects compound:

- **SurrealDB single-writer mutex saturates.** RocksDB serialises writes; the parallel handshakes queue behind in-flight INSERTs.
- **The `/health` endpoint gets queued behind the mutex.** Kubernetes liveness/readiness probes time out (`context deadline exceeded`) and the kubelet starts restart-looping the pod even though the underlying process is alive.
- **Cloudflare returns 504 to minibob.** Each activity-api request making N internal `queryWithAuth` calls accumulates handshake latency past the gateway's response deadline.

The 2026-04-30 validation runs reproduced this consistently: when SurrealDB is cold and minibob fires its standard goal-flow burst, ~30 HTTP 5xx errors appear in the activity-api logs and the goal fails to complete despite all the underlying code paths being correct. Run #13 succeeded only because SurrealDB happened to be warm and the burst happened to land in a slack window.

The fix is connection pooling: keep a small pool of pre-authenticated SurrealDB sessions per `(jwt-prefix, namespace, database)` tuple, reuse them across `queryWithAuth` calls, and refresh on expiry. Steps 1-4 collapse to a hashmap lookup; the per-call cost drops to step 5's actual query time.

## What Changes

- **`queryWithAuth` becomes pool-backed.** New module `repos/metabob-activity-api/src/db/auth-session-pool.ts` exposes `acquireSession(jwt, ns, db)` and `releaseSession(session)`. `queryWithAuth` wraps acquire → query → release. The pool is a per-process LRU keyed by a hash of `(jwt-prefix, ns, db)`; sessions whose underlying JWT is within 60s of `exp` are evicted on next access.
- **`createAuthenticatedClient` is deprecated** in favour of `acquireSession`. The few callers that need the raw `Surreal` instance for multi-statement transactions can call `acquireSession` directly with explicit release. Keeps the existing call sites for the transition period.
- **Pool-bounded concurrency.** The pool caps total open sessions at a configurable limit (default 32) to bound SurrealDB's connection load. Above the cap, callers wait on a queue; the wait is short because each session is reused across requests.
- **JWT-expiry handling.** When a session's underlying JWT is within 60s of `exp`, the pool refuses to hand it out and either evicts the session (if no in-flight reference) or marks it for eviction-on-release. The caller falls back to `acquireSession(freshJwt, ...)`. Activity-api's middleware mints fresh internal JWTs per request, so the fall-back is cheap.
- **Graceful close on shutdown.** Process SIGTERM closes the pool; in-flight queries get `pool.drain()` semantics — wait up to 5s for outstanding queries, then force-close.
- **Observability.** Pool exposes counters (`acquire_hits`, `acquire_misses`, `evictions`, `wait_queue_depth`) wired into the existing `/health` checks and a new `/v2/health/db-pool` endpoint for Prometheus scraping later.

## Capabilities

### New Capabilities

- `activity-api-connection-pooling`: Per-process LRU of authenticated SurrealDB sessions, keyed by `(jwt-prefix, ns, db)`, that turns `queryWithAuth`'s per-call connect/auth/close cycle into a hashmap lookup for hot paths. Includes JWT-expiry eviction, bounded concurrency with a wait queue, graceful shutdown drain, and observability counters surfaced through `/health`.

### Modified Capabilities

None at the spec layer. `queryWithAuth`'s signature stays the same — call sites in `routes/impulses.ts`, `routes/activities.ts`, `routes/execution-traces.ts`, etc. continue to work without source changes. The only observable difference is throughput.

## Impact

- `repos/metabob-activity-api/src/db/surreal.ts` — `queryWithAuth` body becomes `acquire → query → release`; `createAuthenticatedClient` keeps its current behaviour but is marked deprecated in jsdoc.
- `repos/metabob-activity-api/src/db/auth-session-pool.ts` — new file, ~200 lines including types, LRU, expiry-tracking, queue, and graceful drain.
- `repos/metabob-activity-api/src/index.ts` — register `/v2/health/db-pool` route + wire pool drain into the existing SIGTERM handler.
- `repos/metabob-activity-api/test/db/auth-session-pool.test.ts` — new test file covering hit/miss/eviction/concurrency/expiry/drain.
- No vessel-side changes (minibob, workbench, etc. consume activity-api as before).
- No schema changes.
- No new env vars required at first; pool size defaults are documented and can be tuned by future ops via `DB_POOL_MAX` env.
