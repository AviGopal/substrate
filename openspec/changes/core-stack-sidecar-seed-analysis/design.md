## Context

The three core stack repos today:

- `metabob-mcp` v0.2.9: stateless tool dispatcher. For each tool call, exchanges `METABOB_API_KEY` for a session token against `ide.metabob.com` (frozen `metabob-rpc-api`) and proxies the call. Fires `POST /v2/mcp/usage` to `user-vessel` with `{ tool_name, success, duration_ms, mcp_version }` — no timestamps, no session context, in-memory buffer that's lost on exit. Bundles a local CPG (via `cpg-inference-ts`) and a GCN co-change model that run client-side, but those engines are torn down between tool calls.
- `metabob-analysis-api` v0.1.2: stub. `POST /v2/impulses/resolve` for `problem_detection` just `SELECT * FROM analysis_problems WHERE session_id = $sessionId` — the comment in `routes/impulses.ts:113-150` explicitly states *"in a full implementation, this would trigger CPG analysis."*
- `metabob-cloud-dashboard` v0.3.10: two functional pages (`/api-keys`, `/mcp`) and several stubs (`/members`, `/settings`, `/execution-traces`, `/usage-analytics`). The MCP Usage tab returns `unknown_error` because the upstream aggregation pipeline (user-vessel snapshots) is broken. The Revoke confirmation accepts but the underlying DELETE silently fails — keys persist in the list after reload.
- The frozen `metabob-rpc-api` at `ide.metabob.com` still serves production traffic from older MCP clients; not changed by this proposal but must remain reachable until sunset.

The product team's anchoring user stories (team-lead persona):

1. Provision API keys, name them, hand them out.
2. Track which keys are being used, how often, detection trends, learned codebase information — over time.
3. Drill into detections, related code, and metabob's impact on the development process — observable as the agent runs.
4. Drill into usage; estimate risk for upcoming changes.

None of (2)–(4) are supported by the data currently captured. (1) works but has the revoke bug.

The earlier "internal LLM agent walking the codebase server-side" proposal was rejected: code must stay client-side. The sidecar can never block (the agent will kill it). The agent has its own LLM and is willing to pay its own tokens for deep reasoning — metabob's value-add is the seed detection ("this is a race condition at lock.ts:42") plus the curated context that makes the agent's reasoning efficient.

## Goals / Non-Goals

**Goals:**

- Coherent three-repo stack with a single architectural pattern: sidecar collects + caches, analysis-api classifies + locates, agent reasons + writes back, dashboard surfaces.
- Source code never leaves the developer's machine. Only embeddings + structured event metadata + short seed strings go to the server.
- Sidecar never blocks: every MCP read returns a result within a few hundred milliseconds, even on cold start.
- Per-key cost is bounded: ~$5/hr/key soft cap, with predictable backoff behaviour as the budget burns down.
- Dashboard can render a complete three-act timeline (seed → annotations → resolution) for any session, with time-axis trends over multiple sessions.
- The contract between sidecar and analysis-api is small, versioned, and stable enough that the dashboard, the sidecar, and the analysis-api can evolve independently.

**Non-Goals:**

- Migrating off the legacy `metabob-rpc-api` in this change. Sunset happens in a follow-up once analysis-api has demonstrated parity in production.
- Federation, multi-org switching, SSO, password reset, or any auth flow beyond what `identity-vessel` already provides.
- The `impulse-activity` research stack (`activity-api`, `discovery-vessel`, ribosome, Thompson sampling, etc.). Explicitly separate logical stack.
- Source code analytics that require holding code server-side (cross-tenant pattern matching beyond what embeddings allow, server-side static analysis, etc.).
- Replacing the agent's reasoning. Our LLM does not produce fix recommendations; that is the agent's job and the agent pays for it.

## Decisions

### D1. Sidecar is non-LLM; analysis-api owns all LLM cost

Alternatives considered:
- *Sidecar runs the LLM, customer brings their own key.* Rejected: makes per-team cost invisible, fragments the dashboard's spend story, complicates key management.
- *Server-side internal LLM agent that walks the codebase via reverse-MCP.* Rejected by the product direction: code must stay client-side; we cannot ship customer source to a server-side LLM.

Decision: the sidecar is a pure context engine + scheduler + cache. The analysis-api is the sole LLM caller, configured with metabob's own Anthropic key. The sidecar ships only context bundles (embeddings, file paths, line ranges, structured CPG metadata, brief code excerpts where strictly necessary for classification) — never full source files.

### D2. Seed-only LLM output; agent owns deep reasoning

Alternatives considered:
- *Analysis-api produces full explanations and fix recommendations.* Rejected: the agent already has an LLM with full repository context; running deep reasoning twice is wasteful and the agent's elaboration is higher quality because it has the live editing context. Also blows the budget.
- *Analysis-api produces only line ranges with no classification.* Rejected: the agent's LLM doesn't have efficient access to historical signals (cross-session patterns, embedding neighbours from prior detections). The seed's *category* is the differentiated value.

Decision: analysis-api output is locked to the seed schema:

```typescript
type Seed = {
  file: string;           // workspace-relative path
  line_start: number;     // 1-indexed inclusive
  line_end: number;       // 1-indexed inclusive
  category: SeedCategory; // controlled vocabulary
  severity: 'low' | 'medium' | 'high' | 'critical';
  brief: string;          // ≤ 240 chars, single-line, no fix text
  confidence: number;     // 0..1
  refs: {
    cpg_nodes?: string[];        // node IDs into the local CPG
    commit_hashes?: string[];    // git commits relevant to the detection
    embedding_neighbours?: string[]; // local IDs of nearby embedded chunks
    related_seeds?: string[];    // other seed IDs in same session
  };
};

type SeedCategory =
  | 'race-condition'
  | 'runtime-error'
  | 'alignment'
  | 'type-confusion'
  | 'null-deref'
  | 'resource-leak'
  | 'perf'
  | 'security'
  | 'api-misuse'
  | 'logic-error'
  | 'style'
  | 'other';
```

`brief` describes *what* and *where* in a sentence. It does not include *why* in depth, *how to fix*, or pattern-matching commentary. The agent's annotations carry that.

### D3. Two-tier model dispatch with confidence-driven escalation

Alternatives considered:
- *Sonnet for everything.* Rejected: blows the budget at typical edit rates. ~2 calls/minute sustained is too sparse for real-time freshness.
- *Haiku for everything.* Rejected: ambiguous cases (e.g., is this a real race condition or just a benign read?) need a stronger model. Haiku confidence on these is low, leading to dropped seeds or false positives.
- *User-configurable per-key tier policy.* Rejected for v1: adds knobs before we know what the steady-state mix looks like. Revisit after we have real telemetry.

Decision: Haiku 4.5 is the default. If Haiku returns `confidence < 0.6` on a candidate seed *and* the context bundle is below a token threshold (~10k input), the analysis-api re-runs with Sonnet 4.6 in the same request. The sidecar sees a single seed; the model used is logged. Budget tracking accounts for the actual model used.

Steady-state mix expected: ~80% Haiku-only, ~20% escalated. At $5/hr/key this gives ~600 Haiku triages and ~40 Sonnet escalations per hour — broad freshness with selective depth.

### D4. Priority queue: reactive > event-driven > proactive

Alternatives considered:
- *Single FIFO queue.* Rejected: cold start floods the queue with proactive scans that get answered before edits the developer actually cares about.
- *Per-file work-stealing.* Rejected: too much machinery for v1. Three discrete priorities are simple to reason about.

Decision: three priorities with strict ordering. Within a priority, FIFO.

- **Reactive (P0)**: the agent just called an MCP tool whose answer would benefit from fresh analysis on this file/component. Triggered by `init_workspace`, `get_problems`, `get_analysis_context`, or any read where the cache returned `warming` or `stale`. Always Sonnet-eligible. Sent immediately.
- **Event-driven (P1)**: filesystem save or git commit. Default Haiku, may escalate per D3. Pacing: at most one P1 per affected file per 30s; coalesces rapid saves.
- **Proactive (P2)**: idle scan of unanalysed regions or regions older than `proactive_ttl` (default 30 min). Always Haiku, no escalation. Runs only when P0 and P1 queues are empty and budget is below 50% of hourly cap.

### D5. Budget tracker lives in analysis-api; sidecar gets backoff hints

Alternatives considered:
- *Sidecar tracks its own budget.* Rejected: sidecars are unprivileged clients. We can't trust the wall-clock or the running tally — a buggy or hostile sidecar could blow the cap. Authority lives server-side.
- *Hard cap with 429 refusal.* Rejected: too brittle. The dashboard would show "key X just hit cap" with no usable degradation story.

Decision: analysis-api maintains a per-api-key rolling 60-minute spend window. Every request gets back:

```typescript
{
  // ... seed ...
  budget: {
    spent_60m_usd: number;
    cap_60m_usd: number;      // 5.00 default
    headroom_pct: number;     // (cap - spent) / cap
    backoff_hint: 'none' | 'reduce-proactive' | 'reduce-event' | 'reactive-only';
  }
}
```

Soft-cap policy:
- `headroom_pct > 0.2`: `backoff_hint = none`
- `0.2 ≥ headroom_pct > 0`: `reduce-proactive` — sidecar drops P2 queue
- `headroom_pct ≤ 0`: `reduce-event` — sidecar also drops P1 queue (only P0 reactive)
- `headroom_pct ≤ -0.2`: `reactive-only` *and* refuse new P0 requests for that key with HTTP 429 (`Retry-After` set to window-rollover seconds)

The sidecar adjusts its scheduler on every response; the cap is authoritative server-side. Sidecar may proactively shed P2 work when its local recent-response history indicates the hint is `reduce-proactive` or worse, to avoid sending requests that will be refused.

### D6. Never-block read contract

Every MCP read tool (`get_problems`, `get_analysis_context`, `analyze_impact`, `predict_cochanges`, `search_codebase`, `get_metrics`, `assign_git_changes`) returns within ~200ms regardless of internal state:

```typescript
type MCPReadResult<T> = {
  results: T[];
  freshness: {
    [fileOrComponentId: string]: {
      analyzed_at: number;   // unix ms; 0 if never analysed
      stale: boolean;        // true if file has changed since analyzed_at
    };
  };
  warming: boolean;          // true if sidecar is in cold-start phase
  coverage: {
    analyzed_files: number;
    total_files: number;
  };
};
```

If the local cache is empty for the requested target, the sidecar returns `results: []` with `warming: true` and `coverage` showing where it is in the cold-start. It enqueues a P0 request immediately so a follow-up call gets data. The agent can keep working; the MCP server is alive.

### D7. Local store: SQLite + sqlite-vss

Alternatives considered:
- *LanceDB.* More features, but heavier and less embedded.
- *In-memory only.* Rejected: cold start would be brutal on every sidecar restart, and the local store is what makes "never block" sustainable.
- *No vector store, recompute embeddings on read.* Rejected: GCN + embedding recompute on every cache miss defeats the purpose of the sidecar.

Decision: SQLite (already a familiar dep, single file) + `sqlite-vss` for the vector index. Schema:

```sql
CREATE TABLE files (
  workspace_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  cpg_built_at INTEGER,
  embedded_at INTEGER
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  workspace_path TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  embedding BLOB NOT NULL,        -- 384 floats, MiniLM-L6-v2
  embedded_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_path) REFERENCES files(workspace_path)
);

CREATE VIRTUAL TABLE chunks_vss USING vss0(embedding(384));

CREATE TABLE seeds (
  id TEXT PRIMARY KEY,            -- analysis-api assigned id
  workspace_path TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  brief TEXT NOT NULL,
  confidence REAL NOT NULL,
  analyzed_at INTEGER NOT NULL,
  read_at INTEGER,                -- when agent last read this seed
  refs_json TEXT
);

CREATE TABLE annotations (
  id INTEGER PRIMARY KEY,
  seed_id TEXT,                   -- nullable; freestanding notes possible
  type TEXT NOT NULL,             -- explain | recommend | note | resolution
  body TEXT NOT NULL,
  posted_at INTEGER NOT NULL,
  synced_at INTEGER               -- to analysis-api
);

CREATE TABLE schedule_queue (
  id INTEGER PRIMARY KEY,
  priority INTEGER NOT NULL,      -- 0, 1, 2
  workspace_path TEXT,
  reason TEXT NOT NULL,
  enqueued_at INTEGER NOT NULL,
  sent_at INTEGER,
  responded_at INTEGER
);
```

The store is per-workspace, located at `<workspace>/.metabob/sidecar.db` (gitignored). Survives sidecar restarts; rebuilt from CPG + git on first run.

### D8. Cache invalidation by content hash

Alternatives considered:
- *mtime-based.* Brittle across branch switches and `touch`.
- *Per-line patch tracking.* Too much machinery; the LLM is cheap enough that re-analysing a changed file is fine.

Decision: file `content_hash` is SHA-256 of contents at the time of CPG/embedding/analysis. Cached seeds for a file are marked `stale: true` when `current_hash != content_hash_at_analysis`. Stale seeds still served to the agent (better than nothing) but flagged in `freshness`; a P1 re-analysis is enqueued. A reactive (P0) request from the agent on a stale file jumps the queue.

### D9. Annotation contract is light-structured

Alternatives considered:
- *Free text.* Dashboard timeline becomes noise; nothing to group by.
- *Heavily structured (typed fields per category).* Brittle; the agent will work around it with embedded markdown.

Decision:

```typescript
type Annotation = {
  type: 'explain' | 'recommend' | 'note' | 'resolution';
  body: string;                  // free text, owned by the agent
  problem_id?: string;           // seed id if annotating a seed
  refs?: {
    files?: string[];            // additional files referenced
    commit_hashes?: string[];
  };
};
```

Resolution (`type: 'resolution'`) carries body text explaining the resolution (e.g., "rewrote with sync.Once") and is the structured closure event. `mark_complete` posts a resolution.

### D10. Read-feedback closes the efficiency loop

Every time the agent reads a cached seed (via any MCP read tool), the sidecar records `read_at` locally and includes the count in the next batch sync to analysis-api as `seed_reads`. Analysis-api aggregates `reads_per_seed` and `reads_per_dollar` per key per rolling window. The scheduler uses this:

- If `seed_reads / seeds_produced < 0.1` for a file's recent seeds, the sidecar shifts that file from P1 to P2.
- The dashboard surfaces `reads_per_dollar` as the key efficiency metric.

### D11. Dashboard data model

Three core read endpoints on analysis-api:

```
GET /v2/dashboard/sessions?api_key_id=&from=&to=
  → [{ session_id, api_key_id, started_at, ended_at, 
       files_touched, seeds_produced, annotations_posted, resolutions_count }]

GET /v2/dashboard/sessions/:session_id
  → { session_meta, events: [
        { kind: 'seed', ts, seed: {...} },
        { kind: 'annotation', ts, annotation: {...} },
        { kind: 'resolution', ts, annotation: {...} }
      ] }

GET /v2/dashboard/spend?api_key_id=&from=&to=&bucket=hour|day
  → { series: [{ bucket_start, spent_usd, calls, seeds_produced, 
                 seed_reads, reads_per_dollar }] }

GET /v2/dashboard/usage-series?api_key_id=&from=&to=&bucket=day
  → { series: [{ bucket_start, calls, seeds_produced, 
                 problems_introduced, problems_resolved, 
                 by_category: { [cat]: count } }] }
```

Sessions are identified by `session_id` generated by the sidecar at `init_workspace` time and threaded through every event. A session ends when the sidecar shuts down, or after `session_idle_timeout` (default 30 min) of no activity.

### D12. Wire protocol between sidecar and analysis-api

Single endpoint for the request path:

```
POST /v2/analysis/run
Authorization: ApiKey <key>

Request body:
{
  session_id: string,
  request_id: string,        // sidecar-generated, for dedup
  priority: 0 | 1 | 2,
  workspace_id: string,      // sha256 of workspace_root + first-commit hash
  context: {
    file: string,
    content_hash: string,
    excerpt: { line_start, line_end, text },   // bounded slice, not full file
    cpg_neighbours: [...],   // structured
    embedding_neighbours: [...],
    recent_commits: [...]
  },
  tier_hint?: 'haiku' | 'sonnet' | 'auto'      // default auto
}

Response 200:
{
  request_id: string,
  seeds: Seed[],             // 0..N seeds detected in the bundle
  model_used: 'haiku' | 'sonnet',
  tokens_in: number,
  tokens_out: number,
  cost_usd: number,
  budget: { spent_60m_usd, cap_60m_usd, headroom_pct, backoff_hint }
}

Response 429 (budget exceeded):
{
  error: 'budget_exceeded',
  budget: { ... },
  retry_after_seconds: number
}
```

Separate endpoint for event posts (annotations, reads, resolutions):

```
POST /v2/events/mcp
Authorization: ApiKey <key>

Request body:
{
  session_id: string,
  events: [
    { kind: 'tool_call', ts, tool_name, success, duration_ms, file? },
    { kind: 'seed_read', ts, seed_id, tool_name },
    { kind: 'annotation', ts, annotation: {...} },
    { kind: 'resolution', ts, annotation: {...} }
  ]
}
```

Events are batched on the sidecar side (default flush every 5s or 50 events, whichever first). Fire-and-forget but with exponential-backoff retry on transient failures; permanent failures are logged and the buffer is dropped (the local cache is the durable source).

### D13. Session model

The sidecar generates `session_id` (uuid v4) at startup. Every event and analysis request carries it. Sessions are associated with `api_key_id` (decoded from the API key prefix on the analysis-api side from identity-vessel HMAC verification, same as today). A `workspace_id` is derived from the workspace root path + first git commit hash so the same workspace across multiple sessions can be reasoned about.

Session ending: explicit shutdown signal, OR 30 min idle (no events posted). The dashboard treats sessions as the primary drill-down unit.

## Risks / Trade-offs

- **[Sidecar process management is now hard.]** Today MCP runs per-tool-call via stdio and exits. A long-running sidecar with watchers + a SQLite database + background workers needs proper supervision (PID file, graceful shutdown, crash recovery). → **Mitigation**: ship MCP-mode (stateless, legacy) and sidecar-mode (long-running, default) as runtime flags. Default to sidecar-mode; fall back to stateless if process supervision fails or `METABOB_STATELESS=1`. Document the watchdog story in the README.

- **[$5/hr soft cap is a guess.]** We don't have steady-state telemetry yet to validate the budget envelope. → **Mitigation**: dashboard surfaces actual spend per key so we can tune. The cap value is configurable per-key server-side; v1 ships with a global default that can be overridden.

- **[Haiku may produce too many false positives for the team-lead view.]** Triage-tier classification on small windows can misfire (e.g., flagging a guarded read as a race condition). → **Mitigation**: confidence-driven escalation (D3) plus the team lead can dismiss seeds via the dashboard (which feeds `mark_complete` with `type: resolution, body: 'false positive'`), training future analysis through telemetry. Also, the agent will frequently disagree — and the dashboard will surface that disagreement as a quality signal.

- **[Cold start UX.]** First-time sidecar on a large repo takes minutes to build CPG and embeddings. During that window, MCP reads return `warming: true` with empty results, which some agents may interpret as "no problems exist." → **Mitigation**: emit synthetic "warming up" seeds visible to the agent (via `get_problems`) for the first N minutes so the agent's UX is "still analysing" rather than "all clear." Also, document the cold-start window in the install snippet.

- **[Two MCP wire protocols simultaneously during migration.]** Old MCP clients keep talking to `metabob-rpc-api`; new clients talk to the new analysis-api endpoints. Until rpc-api is sunset, both have to be maintained. → **Mitigation**: scope this proposal to the new path; the rpc-api is frozen and untouched. Sunset is a separate change with its own validation checklist.

- **[Read-feedback drives Goodhart's law.]** If the scheduler down-prioritises files with low `seed_reads / seeds_produced`, it will progressively starve areas the agent doesn't currently care about — even if they have real problems. → **Mitigation**: P2 proactive scans get a guaranteed minimum slice (e.g., 10% of remaining budget after P0/P1 are served) so dark corners still get analysed. Also, periodic full-repo re-scan on a long timer (e.g., every 24h).

- **[Annotations are free text; dashboard timeline may degrade to noise.]** If the agent posts unstructured blobs the team-lead view becomes hard to scan. → **Mitigation**: enforce body length ≤ 2k chars; render with markdown but truncate-with-expand. The `type` field gives the dashboard enough to bucket; the body is on the agent to keep useful.

- **[Privacy guarantee depends on what goes in `context.excerpt`.]** We say "no code on the server" but the seed-detection context bundle does include short excerpts (the changed function, neighbouring lines). → **Mitigation**: cap excerpts at 60 lines per request, document the boundary clearly in marketing copy ("we send the minimum code needed to classify each detection, never your full repo"), and provide a per-org opt-out flag (`max_excerpt_lines = 0` → analysis-api works from embeddings + CPG metadata only, degraded quality but zero code transit).

## Open Questions

1. **Sidecar runtime model.** Is the sidecar a separate process spawned by the MCP launcher (cleanly separable lifecycle, harder to share with the MCP stdio side) or is it the MCP process itself with the stdio handler as one of several threads? Recommendation: same process, the MCP stdio handler is just one client of the local cache. Decision deferred to Phase A planning.
2. **Workspace boundaries.** What constitutes "the workspace" when the agent is working across monorepo packages or symlinked dependencies? Recommendation: workspace is the git root, full stop. Symlinks resolved. Monorepo handled by indexing all packages under the root.
3. **Anonymous mode.** If the user runs MCP without an API key (curious developers, evals), does the sidecar still run? Recommendation: yes, but all analysis-api calls and event posts are skipped. Local CPG + embeddings + co-change are still useful by themselves. The MCP returns "local-only" answers.
4. **Backfill from `metabob-rpc-api`.** Should new analysis-api seed data backfill from rpc-api's historical `analysis_problems`? Recommendation: no for v1. The data models are different enough that translation is lossy, and the user-facing trend charts start fresh on cutover.
5. **`session_id` propagation to MCP clients.** Today the MCP tool result is opaque to the agent. Should we add a `session_id` field to every tool response so the agent (and any wrapping logs) can correlate? Recommendation: yes, but mark optional in the response shape so older agents that don't recognise it still work.
