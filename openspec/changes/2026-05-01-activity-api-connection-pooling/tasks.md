## 1. Pool module

- [ ] 1.1 Create `repos/metabob-activity-api/src/db/auth-session-pool.ts` with the type surface: `Session`, `PoolStats`, `acquireSession(jwt, ns, db): Promise<AcquiredSession>`, `releaseSession(s: AcquiredSession): void`, `drain(timeoutMs: number): Promise<void>`, `poolStats(): PoolStats`.
- [ ] 1.2 Implement the cache as `Map<string, Session>` with a hash key derived from `(jwt.slice(0,32), ns, db)`. Track per-session metadata: `createdAt`, `jwtExp` (parsed from the JWT once at first signin, no per-acquire reparse), `inFlight: boolean`, `lastUsedAt`.
- [ ] 1.3 Implement bounded LRU with `DB_POOL_MAX` (default 32, env-overridable). On insert when full, evict the least-recently-used non-in-flight session (close it cleanly).
- [ ] 1.4 Implement JWT-expiry eviction: at acquire time, if `Date.now() >= jwtExp - 60_000`, do not return the cached session; close it (or mark for eviction-on-release if `inFlight`) and proceed to a fresh signin.
- [ ] 1.5 Implement the wait queue: when `cache.size === DB_POOL_MAX` and the requested key is not cached, push a `{ key, resolve, reject }` onto an array; on `releaseSession`, dequeue head and resolve with the freshly-released session if keys match, else close-and-open.
- [ ] 1.6 Implement drain: on `drain(timeoutMs)`, set `draining=true` so new `acquireSession` calls reject with `PoolDrainingError`; await Promise.allSettled on outstanding query promises with a `timeoutMs` budget; force-close anything still in-flight at the deadline.
- [ ] 1.7 Implement `poolStats()` returning `{ size, max_size, acquire_hits, acquire_misses, evictions: { expired, lru, drain }, wait_queue_depth, in_flight }`. Counters increment monotonically; reset on process restart only.

## 2. queryWithAuth integration

- [ ] 2.1 In `repos/metabob-activity-api/src/db/surreal.ts`, replace `queryWithAuth`'s body with `const session = await acquireSession(jwt, namespace, database); try { return await session.db.query(sql, params)[0]; } finally { releaseSession(session); }`. Keep the existing return-shape unwrap (`result[0]`) to preserve caller contracts.
- [ ] 2.2 Add a feature-flag gate: when `process.env.DB_POOL_ENABLED === 'false'`, fall back to the legacy connect-auth-query-close path. Default `true` after canary validation; `false` during initial development.
- [ ] 2.3 Mark `createAuthenticatedClient` deprecated in jsdoc, with a pointer to `acquireSession` for callers needing raw session access. Don't remove yet — `routes/middleware/jwtAuth.ts:317` still uses it for the auth-validation query and that path doesn't benefit from pooling (one query per request).
- [ ] 2.4 Run `bun run typecheck` and `bun test` in `repos/metabob-activity-api`; zero new errors.

## 3. Health endpoint integration

- [ ] 3.1 Extend the existing `GET /health` handler in `repos/metabob-activity-api/src/index.ts` to include `pool: { size, max_size, hit_rate }` in the `checks` object. `hit_rate` = `acquire_hits / (acquire_hits + acquire_misses)`, rounded to 2 decimal places, returns `null` until ≥ 100 total acquires.
- [ ] 3.2 Add `app.get('/v2/health/db-pool', ...)` that returns the full `poolStats()` JSON. No auth required (operational endpoint, mirrors `/health`).
- [ ] 3.3 Wire pool drain into the existing SIGTERM handler. If no SIGTERM handler exists yet, add one that calls `await pool.drain(5000)` then resolves.

## 4. Tests

- [ ] 4.1 Create `repos/metabob-activity-api/test/db/auth-session-pool.test.ts`. Use the SurrealDB test harness already used by `db/surreal.test.ts` (in-memory or local instance).
- [ ] 4.2 Hit/miss/eviction: acquire same `(jwt, ns, db)` twice → second is a hit; acquire a third `(jwt, ns, db')` with different db → miss; fill the cache to `DB_POOL_MAX+1` → least-recently-used eviction observed.
- [ ] 4.3 Concurrency: at `DB_POOL_MAX`, fire `DB_POOL_MAX+3` parallel acquires for distinct keys; verify three of them block on the wait queue and resolve in FIFO order as releases happen.
- [ ] 4.4 JWT expiry: acquire with a JWT whose `exp` is 30s out, advance `Date.now()` (mock) past the 60s margin, acquire again → second acquire is a miss (eviction recorded); the original session was closed.
- [ ] 4.5 In-flight expiry: acquire → simulate JWT expiring while query is in flight (stub `db.query` to throw an "exp claim" error); pool removes the session, surfaces the error to the caller, releases the slot. Subsequent acquires open a fresh session.
- [ ] 4.6 Drain: with 4 sessions in cache and 2 in-flight, call `drain(1000)`; new acquires reject; in-flight queries complete; cache is empty after drain returns; counters show `evictions.drain >= 4`.
- [ ] 4.7 Stats accuracy: a deterministic sequence of 10 hits + 5 misses produces the exact counter values in `poolStats()`.

## 5. Validation

- [ ] 5.1 Local: run `bun test` in `repos/metabob-activity-api` with `DB_POOL_ENABLED=true`; all existing tests pass against the new path.
- [ ] 5.2 Canary deploy: bump the activity-api image, set `DB_POOL_ENABLED=true` in canary env. Run a single minibob `--single` goal and capture timing.
- [ ] 5.3 Pre/post comparison from logs:
  - Average `queryWithAuth` latency: target ≥ 50% reduction at p50, ≥ 40% at p99.
  - `/health` 200 rate during a 60s minibob burst: target ≥ 99% (was ~85% pre-change in the 2026-04-30 runs).
  - Goal-completion rate on the standard rotate-logs validation: target 1/1 success vs ~0.5/1 pre-change.
  - SurrealDB pod restart count over the run: target 0 (was 1-3 in 2026-04-30 runs).
- [ ] 5.4 Promote to production once canary metrics meet target.

## 6. Follow-up trackers (out of scope here, opened as separate issues)

- [ ] 6.1 Per-org concurrency cap. Today the pool is global; a misbehaving tenant could starve others.
- [ ] 6.2 Pre-warm at startup. N sessions opened on boot to amortise first-request latency.
- [ ] 6.3 `routes/impulses.ts` `executeAsAuth` and `executeQuery` get the pooling for free; no changes needed but worth flagging in the next round of route-level perf work.
- [ ] 6.4 Read-replica pool key when SurrealDB 3.x ships replication.
