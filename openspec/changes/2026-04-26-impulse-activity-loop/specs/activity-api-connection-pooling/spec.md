## Capability: activity-api-connection-pooling

Per-process LRU of authenticated SurrealDB sessions inside metabob-activity-api, keyed by `(jwt-prefix, namespace, database)`. Reuses sessions across `queryWithAuth` calls so the connect/use/authenticate handshake amortises across the lifetime of a JWT instead of recurring per query.

### Surface

- Module `repos/metabob-activity-api/src/db/auth-session-pool.ts` exports:
  - `acquireSession(jwt: string, namespace: string, database: string): Promise<AcquiredSession>`
  - `releaseSession(session: AcquiredSession): void`
  - `drain(timeoutMs: number): Promise<void>`
  - `poolStats(): PoolStats`
- `queryWithAuth` in `db/surreal.ts` is rewritten as a thin wrapper around acquire/release. Its public signature is unchanged.
- `GET /health` includes `checks.pool: { size, max_size, hit_rate }`.
- `GET /v2/health/db-pool` returns the full `PoolStats` JSON.
- A SIGTERM handler invokes `drain(5000)` before the process exits.

### Invariants

- A session in the pool is bound to exactly one (namespace, database) tuple. Re-binding mid-lifecycle is forbidden — different (ns, db) requires a different session.
- A session in the pool has a known `jwtExp` (epoch ms parsed from the JWT's `exp` claim at first signin). Sessions whose JWT is within `60_000` ms of `exp` are not handed out by `acquireSession`; they are evicted (or marked for eviction-on-release if currently `inFlight`).
- At most `DB_POOL_MAX` (default 32, env-overridable) sessions are open at any time. Above that cap, `acquireSession` enqueues the request on a FIFO queue.
- During `drain(timeoutMs)`, new `acquireSession` calls reject with `PoolDrainingError`. In-flight queries complete naturally up to the timeout; sessions still in-flight at the deadline are force-closed and the surrounding `db.query` rejects with `SessionForceClosedError`.
- Counters in `PoolStats` are monotonic across the process lifetime. They reset only on process restart.
- `acquireSession` throwing `PoolAcquireError` (e.g. SurrealDB unreachable on first signin) leaves the pool in a clean state — no half-open session leaks.

### Acceptance criteria

- A burst of N>1 `queryWithAuth` calls against the same `(jwt, ns, db)` produces 1 cache miss and N-1 cache hits.
- Acquiring at the `DB_POOL_MAX+1` concurrent boundary blocks the (M+1)th request until a release happens.
- A `queryWithAuth` whose JWT has just expired surfaces the SurrealDB "exp claim timestamp check failed" error to the caller and removes the session from the pool; the next acquire on the same `(jwt-prefix, ns, db)` is a miss (the pool does not retry the dead session).
- Calling `drain(5000)` with sessions present and in-flight queries running terminates the in-flight queries within 5s if they don't return naturally; subsequent `acquireSession` calls reject with `PoolDrainingError`.
- `GET /v2/health/db-pool` returns valid JSON with all eight fields populated, even when the pool is empty (`size=0, in_flight=0, evictions: { expired:0, lru:0, drain:0 }, ...`).

### Non-goals

- Pool does not cover the root-signed `surrealDB` singleton (`db/surreal.ts`'s top-level export). That client is a connect-once-on-startup pattern and reuses its session naturally.
- Pool does not extend to other databases (Redis, etc.). Naming and module location are SurrealDB-specific.
- Pool does not implement per-tenant concurrency limits. The cap is process-global.
- Pool does not implement read-replica fan-out. SurrealDB 3.x doesn't yet support replication; when it does, the cache key extends to `(jwt-prefix, ns, db, replica)` and the surface stays the same.
- Pool does not warm sessions at startup. First-call cost on a cold pod is unchanged from today.

### Failure handling contract

- `PoolAcquireError(cause: Error)` — thrown synchronously by `acquireSession` when the underlying SurrealDB connect or signin fails on a fresh session. Pool state is unchanged; counters increment `acquire_misses`.
- `PoolDrainingError` — thrown by `acquireSession` after `drain()` has been invoked.
- `SessionForceClosedError(elapsedMs: number)` — thrown by an in-flight `session.db.query(...)` when drain force-closes its session past the deadline. The query itself is reported as failed; pool releases the slot.
- A SurrealDB-side error during `db.query()` propagates unchanged. The pool decides whether to evict the session based on the error class: connection-level errors (TCP reset, ECONNRESET, "session closed") evict; semantic errors (PERMISSIONS, schema, ZodError) leave the session in the pool.

### Operability

- `DB_POOL_MAX` env var (default 32) bounds total open sessions per process.
- `DB_POOL_ENABLED` env var (default true post-canary, false in dev/test until tests opt in) toggles the pool entirely. When false, `queryWithAuth` falls back to the legacy connect/use/authenticate/query/close path.
- Logs:
  - `info` on first cache miss (`opening new session`).
  - `info` on JWT-expiry eviction (`evicting session: jwt within margin`).
  - `warn` when `wait_queue_depth > 4` (`pool saturation: ${depth} waiting`).
  - `warn` on `drain()` force-close (`drain timeout: ${n} sessions force-closed`).
  - `error` on `PoolAcquireError`.
- The `/v2/health/db-pool` endpoint is unauthenticated (parallel to `/health`); operators can scrape without minting credentials.
