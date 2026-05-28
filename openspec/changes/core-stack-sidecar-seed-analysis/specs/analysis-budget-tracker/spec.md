## ADDED Requirements

### Requirement: Per-key rolling-hour spend tracking

`metabob-analysis-api` SHALL track LLM cost in USD per `api_key_id` over a rolling 60-minute window. Each completed `/v2/analysis/run` invocation SHALL debit the actual `cost_usd` of the call (sum of all tiers used) against the window for the calling key.

#### Scenario: Spend accumulates within window
- **GIVEN** api_key K has no prior spend
- **WHEN** three successful calls debit $0.012, $0.045, $0.008 respectively
- **THEN** `spent_60m_usd` for K is `0.065`

#### Scenario: Old spend rolls off
- **GIVEN** api_key K had a $0.50 debit 61 minutes ago and no other activity
- **WHEN** a new call is processed
- **THEN** `spent_60m_usd` reflects only spend within the trailing 60 minutes (the $0.50 debit is excluded)

### Requirement: Default hourly cap is $5 per key, configurable

The default per-key hourly cap SHALL be `5.00` USD. The cap SHALL be configurable per-key via a server-side configuration store. The configured value SHALL be readable as `cap_60m_usd` in every analysis response.

#### Scenario: Default cap applied to new keys
- **WHEN** a newly-issued api_key calls `/v2/analysis/run` for the first time
- **THEN** the response body carries `budget.cap_60m_usd = 5.00`

#### Scenario: Custom cap honoured
- **GIVEN** api_key K has its cap configured to `10.00` USD
- **WHEN** any call for K is processed
- **THEN** the response carries `budget.cap_60m_usd = 10.00`

### Requirement: Backoff hints reflect budget headroom

Every `/v2/analysis/run` response SHALL include a `budget.backoff_hint` field derived from `headroom_pct = (cap_60m_usd - spent_60m_usd) / cap_60m_usd`:

- `headroom_pct > 0.2`: `backoff_hint = 'none'`
- `0.2 ≥ headroom_pct > 0`: `backoff_hint = 'reduce-proactive'`
- `0 ≥ headroom_pct > -0.2`: `backoff_hint = 'reduce-event'`
- `headroom_pct ≤ -0.2`: `backoff_hint = 'reactive-only'` AND the next non-reactive request returns 429

#### Scenario: Healthy headroom emits none
- **GIVEN** spent $1.00 of $5.00 cap (`headroom_pct = 0.8`)
- **WHEN** a response is returned
- **THEN** `backoff_hint = 'none'`

#### Scenario: 90% spend emits reduce-proactive
- **GIVEN** spent $4.50 of $5.00 cap (`headroom_pct = 0.1`)
- **WHEN** a response is returned
- **THEN** `backoff_hint = 'reduce-proactive'`

#### Scenario: Over-cap emits reduce-event
- **GIVEN** spent $5.10 of $5.00 cap (`headroom_pct = -0.02`)
- **WHEN** a response is returned
- **THEN** `backoff_hint = 'reduce-event'`

### Requirement: 429 refusal beyond hard threshold

When `headroom_pct ≤ -0.2` AND the incoming request `priority` is not `0` (reactive), the analysis-api SHALL refuse with HTTP 429 and a `Retry-After` header set to the seconds remaining until the budget window rolls over enough to bring headroom back above -0.2.

#### Scenario: P1 refused at 120% cap
- **GIVEN** spent $6.10 of $5.00 cap and the oldest debit will roll off in 45 seconds
- **WHEN** a P1 request arrives
- **THEN** the response is `429 { error: 'budget_exceeded', budget: {...}, retry_after_seconds: 45 }` with HTTP header `Retry-After: 45`

#### Scenario: P0 still served at 120% cap
- **GIVEN** the same over-cap state
- **WHEN** a P0 request arrives
- **THEN** the request is processed normally (P0 reactive is never refused)

### Requirement: Reads-per-dollar telemetry recorded

The analysis-api SHALL maintain per-key aggregates of `seeds_produced` and `seed_reads` (from incoming event posts) so that a `reads_per_dollar` efficiency metric can be computed for dashboard reads.

#### Scenario: seed_read event increments counter
- **GIVEN** a `seed_read` event arrives for seed S belonging to api_key K
- **WHEN** the event is processed
- **THEN** the aggregate `seed_reads[K]` is incremented and S's `read_at` is updated to the event timestamp

#### Scenario: reads_per_dollar exposed in spend endpoint
- **GIVEN** for the last hour api_key K spent $2.00 with `seed_reads = 80`
- **WHEN** `GET /v2/dashboard/spend?api_key_id=K&bucket=hour` is called
- **THEN** the series entry for that hour includes `reads_per_dollar = 40.0`

### Requirement: Sidecar may proactively shed work

The analysis-api SHALL document and the sidecar SHALL implement the convention that when `backoff_hint` is `reduce-proactive` or worse, the sidecar may discard pending P2 work entries locally without sending them, to avoid wasting roundtrips on requests that will be refused.

#### Scenario: Sidecar drops P2 after reduce-proactive
- **GIVEN** the sidecar received `backoff_hint = 'reduce-proactive'` on the last response
- **WHEN** the next scheduler tick fires with five P2 entries in the queue
- **THEN** the sidecar drops the P2 entries with `dropped_reason = 'backoff_hint'` and sends only P0/P1
