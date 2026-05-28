## ADDED Requirements

### Requirement: Scheduler enforces three priority tiers

The sidecar scheduler SHALL maintain three discrete priority queues for analysis requests, with strict ordering between tiers:

- **P0 reactive**: enqueued when an agent MCP tool call would benefit from fresh analysis (cache returned `warming: true` or `stale: true`, or the agent requested a target with no cached seeds).
- **P1 event-driven**: enqueued on filesystem save or git commit affecting one or more files.
- **P2 proactive**: enqueued for unanalysed regions and for files whose last analysis is older than `proactive_ttl` (default 30 minutes).

Within a priority tier the order SHALL be FIFO.

#### Scenario: P0 jumps the queue
- **GIVEN** the queue contains five P1 entries and one P2 entry
- **WHEN** a new P0 entry is enqueued
- **THEN** the next send fired by the scheduler is the new P0 entry, not any P1 or P2

#### Scenario: P2 runs only when P0 and P1 are empty
- **GIVEN** the budget headroom is above 50% and the P2 queue has work
- **WHEN** the P0 and P1 queues both contain entries
- **THEN** the scheduler sends from P0 first, then from P1, and only services P2 once both higher tiers are empty

#### Scenario: P1 coalesces rapid saves
- **GIVEN** the same file is saved three times within 30 seconds
- **WHEN** the scheduler processes the resulting enqueue requests
- **THEN** at most one P1 request for that file is in flight at a time, and rapid-save retriggers update the existing entry's `enqueued_at` rather than enqueueing a duplicate

### Requirement: Token estimator bounds payload size

Before sending a context bundle, the scheduler SHALL compute an estimated input token count. Bundles exceeding the configured per-tier limit (`p0_max_tokens = 16000`, `p1_max_tokens = 12000`, `p2_max_tokens = 8000`) SHALL be locally compressed (excerpt windowing, neighbour trimming) before send, or dropped if compression cannot reach the limit.

#### Scenario: Oversized P2 bundle is dropped
- **GIVEN** a P2 entry whose context bundle estimates 20000 input tokens
- **WHEN** compression to 8000 tokens is not achievable
- **THEN** the scheduler drops the entry, increments a `bundle_dropped_size` counter, and logs the drop

#### Scenario: Oversized P0 bundle is compressed
- **GIVEN** a P0 entry whose context bundle estimates 22000 input tokens
- **WHEN** compression trims neighbour references to reach 15000 tokens
- **THEN** the scheduler sends the compressed bundle and notes `compressed: true` in the local schedule_queue row

### Requirement: Scheduler honours analysis-api backoff hints

The scheduler SHALL adjust its sending behaviour based on the `backoff_hint` field of the most recent `POST /v2/analysis/run` response per api_key:

- `none`: all queues active
- `reduce-proactive`: P2 queue paused
- `reduce-event`: P1 and P2 queues paused; only P0 sends
- `reactive-only`: P0 sends continue, all others paused

After a 429 with `Retry-After`, the scheduler SHALL pause all sends for that api_key until `Retry-After` elapses, then resume in `reactive-only` mode.

#### Scenario: reduce-proactive pauses P2
- **GIVEN** the most recent analysis-api response carried `backoff_hint = reduce-proactive`
- **WHEN** the scheduler's next tick fires
- **THEN** no P2 entries are dequeued or sent until a subsequent response carries `backoff_hint = none`

#### Scenario: 429 with Retry-After freezes the key
- **GIVEN** the scheduler receives `429 { retry_after_seconds: 90 }` for api_key K
- **WHEN** the scheduler runs for the next 89 seconds
- **THEN** no analysis requests for api_key K are sent, regardless of priority

### Requirement: Read-feedback drives priority demotion

The sidecar SHALL track per-seed `read_at` timestamps locally. When sending the next batch of events to analysis-api, it SHALL include `seed_reads` records. The scheduler SHALL demote files from P1 to P2 candidacy when their recent `seeds_produced` count exceeds 5 with `seed_reads / seeds_produced < 0.1`.

#### Scenario: Unread file is demoted
- **GIVEN** `src/legacy.ts` has produced 10 seeds in the last hour, of which 0 were read by the agent
- **WHEN** a filesystem save on `src/legacy.ts` would normally enqueue a P1 entry
- **THEN** the scheduler enqueues a P2 entry instead, and the `demotion_reason` field is set to `low_read_rate`

#### Scenario: Read activity restores priority
- **GIVEN** a previously-demoted file is now reading 3 of its last 5 produced seeds
- **WHEN** a new filesystem save occurs
- **THEN** the scheduler enqueues P1 (normal priority restored)

### Requirement: Context bundle contains minimal source

The context bundle posted to analysis-api SHALL include the changed code excerpt only (default ≤ 60 lines per request), CPG neighbour metadata, embedding neighbour IDs, and recent commit metadata. It SHALL NOT include unrelated files, full file contents beyond the excerpt window, or developer-private files matching `.gitignore`.

#### Scenario: Excerpt capped at 60 lines
- **GIVEN** a file with a 500-line function flagged for analysis
- **WHEN** the scheduler constructs the context bundle
- **THEN** the `excerpt` field contains at most 60 lines centred on the candidate region, plus a `truncated: true` marker

#### Scenario: gitignored files never bundled
- **GIVEN** `secrets/.env` is matched by `.gitignore`
- **WHEN** the scheduler considers any analysis enqueue affecting `secrets/.env`
- **THEN** no bundle is constructed and the file is silently skipped

#### Scenario: Per-org zero-excerpt opt-out
- **GIVEN** the analysis-api responds with `org_config.max_excerpt_lines = 0` in any prior request
- **WHEN** subsequent bundles are constructed
- **THEN** the `excerpt.text` field is empty and only CPG + embedding metadata is sent
