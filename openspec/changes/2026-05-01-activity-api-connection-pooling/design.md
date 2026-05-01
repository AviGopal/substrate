## Context

`queryWithAuth` in `repos/metabob-activity-api/src/db/surreal.ts:192-221` is the canonical path for tenant-scoped SurrealDB queries. As of the 2026-04-30 auth-chain rework, every write that needs `$auth.org_id` populated goes through it — trace storage, metrics upserts, the new `activity_search` / `trace_search` / `tool_pattern_search` resolvers, the per-resolver `executeAsAuth` wrapper in `routes/impulses.ts`. The auth chain is now correct but throughput is bottlenecked by per-call overhead.

Profile of one `queryWithAuth` invocation against canary, measured 2026-04-30:

| Step | Time (cold pod) | Time (warm pod) |
|---|---|---|
| `new Surreal()` | <1ms | <1ms |
| `db.connect(url)` (TCP + WebSocket upgrade) | 60-120ms | 5-15ms |
| `db.use({namespace, database})` | 5-10ms | 2-5ms |
| `db.authenticate(jwt)` (signature verify + ACCESS resolution + session bind) | 80-180ms | 20-40ms |
| `db.query(sql, params)` (the actual work) | varies | varies |
| `db.close()` | 10-30ms | 5-15ms |

Steady-state overhead under 50ms is acceptable; cold-pod handshake at 200-300ms × N internal calls is the slug. A single `POST /v2/activities/executions` issues 3-7 `queryWithAuth` calls in sequence (existence check, INSERT trace, UPDATE metrics, optional metadata fanout). Cloudflare's gateway timeout is 100s but Istio drops at much shorter horizons under contention, and the per-pod connection-establishment storm pushes SurrealDB's RocksDB writer mutex into a thrash regime where even read-side `/health` GETs time out behind it.

Pooling collapses steps 2-4 to a hashmap lookup for the second-and-subsequent calls. Steady-state we expect <5ms per acquire after warmup.

## Why pool by `(jwt-prefix, ns, db)`

The natural pool key is the SurrealDB session identity: which JWT was used to authenticate. Two requests authenticated with the same JWT can share a session because SurrealDB's `$auth` and `$token` are bound at signin time and stay constant.

`(ns, db)` is part of the key because `db.use({...})` switches the bound (namespace, database) on a session. We could `use` between acquires, but that defeats the cache (every reuse pays a re-bind cost) and risks cross-tenant leak if the wrong session escapes to the wrong handler. Make it part of the key instead.

`jwt-prefix` (first 32 chars of the JWT) is the discriminator. Using the full JWT as a key is wasteful (a 400-byte string per map key) and brittle (every microsecond-different `iat` would miss the cache). Using only `org_id` is unsafe (different keys with different scopes for the same org would share a session). The prefix collides only when two JWTs share their first 32 chars — astronomically unlikely under HS512.

Sessions are not user-affine. Two unrelated requests with the same JWT can pull the same session in sequence — that's fine, SurrealDB's session state is a connection-level binding, not a request-level one.

## LRU vs full pool

Full per-key pool (multiple sessions per JWT-prefix) buys parallelism: two concurrent requests for the same JWT can run in parallel against the same key. But:

- SurrealDB itself serialises writes at the RocksDB layer; parallel writes on the same DB don't actually parallelise.
- Activity-api routes are predominantly write-heavy; the cases where parallel reads on the same key would help are rare.
- Implementation complexity (idle-session reaper, busy-session sharing semantics) is significantly higher.

Single-session-per-key with an in-process queue is the simpler design. Two callers asking for the same key serialise their queries through the same session — same effective throughput as the pool-of-2 case, half the implementation. We start there and revisit if we observe head-of-line blocking on a single-key hot path.

LRU eviction (size-bounded, default 64 entries) is for memory bound, not for throughput tuning. Each idle session holds a SurrealDB connection (~50KB on the pod side, plus a TCP connection on the SurrealDB side). At 64 sessions per activity-api pod and 2 pods, SurrealDB sees ≤128 idle connections — well under its default 1024 limit.

## JWT-expiry handling

JWTs from activity-api's middleware mint with 15-min `exp`. Three cases the pool must handle:

1. **Acquire on a fresh JWT** — cache miss, open new session, populate cache.
2. **Acquire on a JWT within 60s of expiry** — refuse the cache entry, evict it (or mark for eviction-on-release if in-flight). Caller falls through to "open new session", but for a JWT that's about to expire this is wasteful — the middleware should hand the caller a fresher JWT.
3. **In-flight session whose JWT just expired** — the pool tracks a session's `jwt_exp` at acquire time; the next attempt to use that session fails at the SurrealDB level (`exp claim timestamp check failed`). We catch the SurrealDB error, evict the session, and bubble up — the caller's middleware will retry with a fresh JWT.

The 60s margin matches minibob's `BEARER_REFRESH_MARGIN_MS` (in `auth-service.ts`). Kept symmetric so the cross-process expiry semantics match.

## Bounded concurrency

`DB_POOL_MAX = 32` (default) caps total open sessions. The number is sized for a single activity-api pod (1-2 replicas, current production) hitting SurrealDB's default 1024 connection limit with safe headroom for other clients (workbench, dashboards, in-cluster operators).

When the cap is reached and a new acquire arrives:

1. If any cached session matches the requested key, return it (cache hit, no concurrency cost).
2. Otherwise, enqueue a `Promise<Session>` and wait for the next release.
3. On release, the released session's key is checked against the wait queue head — if the key matches, reuse; if not, close the session and open a new one for the waiting caller.

The queue is FIFO; no priority. Average wait under healthy load should be sub-ms because most acquires are cache hits. We log `wait_queue_depth > 4` as a warn so operators can see when the cap is biting.

## Graceful drain

On `SIGTERM`, the pool enters drain mode:

- New `acquireSession` calls reject with `PoolDrainingError` immediately.
- In-flight sessions complete naturally; on release, they're closed instead of being returned to the cache.
- A 5s timeout closes any session still acquired, surfacing a `SessionForceClosedError` to the caller's outstanding query.

The 5s budget gives most queries time to finish without blocking the kubelet's 30s pod termination grace period.

## Observability

Counters surfaced as a JSON object on `GET /v2/health/db-pool`:

```json
{
  "size": 8,
  "max_size": 32,
  "acquire_hits": 12345,
  "acquire_misses": 678,
  "evictions": { "expired": 23, "lru": 5, "drain": 0 },
  "wait_queue_depth": 0,
  "in_flight": 3
}
```

The existing `/health` endpoint adds `pool: { size, max_size, hit_rate }` to its response so cluster-level monitoring picks up degradation without a new scrape target.

## What we're explicitly not doing

- **Not making `surrealDB.query` (root-signed) pool-backed.** That's a separate singleton; root signin is once-at-startup and reused. The pool is for `queryWithAuth` only.
- **Not adding a separate read replica pool.** SurrealDB 3.x doesn't yet support read replicas; the moment it does this design extends naturally (key on `(jwt-prefix, ns, db, replica)`) but until then there's no fan-out to plan for.
- **Not migrating `routes/impulses.ts`'s `executeAsAuth` and `executeQuery` helpers in the same change.** They already wrap `queryWithAuth`; once the pool lands they get the speed-up for free. The wrappers stay around because they encode per-route fallback policy that doesn't belong in the pool.
- **Not changing the auth middleware's mint behaviour.** Each request still mints a fresh JWT; pooling sits below the mint and reuses sessions whose mint is still valid. Skipping the mint per-request is a separate optimisation.

## Failure modes

| Failure | Pool behaviour |
|---|---|
| SurrealDB unreachable on first acquire | `PoolAcquireError`, caller bubbles 5xx as today |
| SurrealDB drops a cached session (TCP RST) | Detected on next query; session removed from pool, retry with fresh signin once before bubbling |
| JWT_SECRET drift mid-flight | Sessions still valid until their JWT expires; new acquires with the new secret get fresh sessions; old sessions evict on JWT expiry as normal |
| Activity-api process restarts | Pool is in-process; sessions die with the process; SurrealDB cleans up on the connection close |
| Two pods → one cluster | Each pod has its own pool; SurrealDB sees up to `2 × DB_POOL_MAX` sessions (still well under the 1024 default) |

## Migration

This is a behaviour-preserving optimisation. No call-site changes, no schema changes. The pool ships dark behind a feature flag (`DB_POOL_ENABLED`, default `true` in production after canary validation, `false` in dev/test until tests opt in).

Validation plan:
1. Land the change with `DB_POOL_ENABLED=false` default. CI runs the existing tests against the unchanged `queryWithAuth` path. Pool-specific tests run against `DB_POOL_ENABLED=true`.
2. Flip the env var on canary, observe `/v2/health/db-pool` for one full cycle of minibob validation runs.
3. Pre/post compare: average `queryWithAuth` latency, p99 trace-storage latency, `/health` probe success rate during minibob bursts.
4. If hit-rate >90% and p99 drops >40%, flip default to `true` for production.

## Open questions

- **Per-org concurrency cap?** Currently the pool is global. A misbehaving tenant could in theory hog all 32 slots and starve others. In practice we have one tenant (`metabob`) but the multi-tenant story requires per-org caps. Tracked as out-of-scope for this change.
- **Where does `db.use(...)` get re-applied if a session was reused but the requested ns/db differs?** Today we make `(ns, db)` part of the cache key, so the answer is "never — different ns/db is a cache miss." If we later want to allow ns/db switches on the same session, we'd add a `use_count` watermark and re-`use` on swap. Out of scope.
- **Session warmup at startup?** A pre-warm of N sessions on boot would amortise the first-request handshake cost. Trivial to add but adds noise during testing. Defer until we see cold-start latency in ops metrics.
