## ADDED Requirements

### Requirement: Spend series endpoint

`metabob-analysis-api` SHALL expose `GET /v2/dashboard/spend?api_key_id=&from=&to=&bucket=hour|day` returning a time-bucketed series of LLM spend and efficiency metrics for the specified key.

#### Scenario: Hourly buckets returned
- **GIVEN** spend rows exist for api_key K spanning the last 12 hours
- **WHEN** `GET /v2/dashboard/spend?api_key_id=K&from=<12h ago>&to=<now>&bucket=hour` is invoked
- **THEN** the response is `200 { series: [...] }` containing 12 entries, each with `bucket_start`, `spent_usd`, `calls`, `seeds_produced`, `seed_reads`, `reads_per_dollar`

#### Scenario: Empty range returns zero-shape series
- **GIVEN** no spend rows in the requested window for api_key K
- **WHEN** the endpoint is invoked
- **THEN** the response is `200 { series: [] }` (not 404)

### Requirement: Usage-series endpoint with category breakdown

`metabob-analysis-api` SHALL expose `GET /v2/dashboard/usage-series?api_key_id=&from=&to=&bucket=day` returning per-bucket counts of calls, seeds_produced, problems_introduced (seeds appearing on commits with no prior seed for that location), problems_resolved (resolution events), and a `by_category` breakdown.

#### Scenario: by_category aggregates the controlled vocabulary
- **GIVEN** a session produced 5 race-condition seeds, 3 null-deref seeds, and 1 perf seed
- **WHEN** `GET /v2/dashboard/usage-series?api_key_id=K&...` is called for the period containing the session
- **THEN** the response includes `by_category: { 'race-condition': 5, 'null-deref': 3, 'perf': 1 }`

#### Scenario: problems_introduced vs problems_resolved trend
- **WHEN** the dashboard renders a trend chart
- **THEN** both series are available from the same response and shareable on one axis

### Requirement: Per-key spend visible on API Keys page

`metabob-cloud-dashboard`'s `/api-keys` page SHALL show, for each key card, the current hour's burn rate (`spent_60m_usd / cap_60m_usd` rendered as percentage), and a 7-day sparkline of daily spend.

#### Scenario: Burn rate badge renders
- **GIVEN** api_key K has spent $3.20 in the last 60 minutes against a $5.00 cap
- **WHEN** the team-lead loads `/api-keys`
- **THEN** the K key card shows a badge reading approximately "64% · $3.20 / $5.00/hr" (exact copy may vary, but both values are visible)

#### Scenario: 7-day sparkline rendered
- **WHEN** the K key card is rendered
- **THEN** a horizontal sparkline shows seven daily-bucket values from `GET /v2/dashboard/spend?api_key_id=K&bucket=day&from=<7d ago>&to=<now>`

#### Scenario: Zero-activity key shows muted state
- **GIVEN** api_key K has no spend in the last 7 days
- **WHEN** the K key card is rendered
- **THEN** the sparkline is a flat baseline and the burn-rate badge reads "0%" or equivalent muted copy

### Requirement: Soft-cap warning banner

When any visible key on the current view has `headroom_pct ≤ 0.2`, the `metabob-cloud-dashboard` SHALL render a warning banner naming the key and the current state ("`<key_name>` is at 95% of its hourly budget"). The banner SHALL link to that key's drill-down for context.

#### Scenario: Single key over 80% spend
- **GIVEN** key K has `headroom_pct = 0.15` and is visible
- **WHEN** the page renders
- **THEN** a warning banner appears with the key's name and burn percentage, and a link to that key's spend drill-down

#### Scenario: Multiple keys at limit collapse into one banner
- **GIVEN** keys K1 and K2 are both above 80% burn
- **WHEN** the page renders
- **THEN** a single banner reads "2 keys are over their hourly budget" with a link to a filtered view

### Requirement: Spend drill-down view per key

`metabob-cloud-dashboard` SHALL render `/api-keys/:id/spend` (or an equivalent route) showing a larger chart of the hourly spend over the last 24 hours, plus the breakdown of `calls`, `seeds_produced`, `seed_reads`, and `reads_per_dollar`.

#### Scenario: Drill-down chart visible
- **WHEN** the user clicks "spend detail" on a key card
- **THEN** a chart appears showing 24 hourly bars of spend, and a side panel shows totals + reads-per-dollar for the period

#### Scenario: reads_per_dollar prominently rendered
- **WHEN** the drill-down loads
- **THEN** the `reads_per_dollar` value is rendered as a large primary metric label, with a tooltip explaining "of N seeds we paid to produce, M were read by the agent — this is the efficiency of the spend"

### Requirement: Telemetry distinguishes Haiku from Sonnet

The spend series response SHALL break down spend by model (`model_breakdown: { haiku: usd, sonnet: usd }`) per bucket so the dashboard can show what share of cost is escalations.

#### Scenario: Bucket includes model breakdown
- **GIVEN** a bucket where Haiku cost $0.40 and Sonnet escalations cost $0.60
- **WHEN** the bucket is returned in the series
- **THEN** the entry includes `model_breakdown: { haiku: 0.40, sonnet: 0.60 }` and `spent_usd: 1.00`

#### Scenario: Dashboard renders model split
- **WHEN** the spend drill-down loads
- **THEN** the chart shows a stacked bar with Haiku and Sonnet portions distinguishable, and a percentage label of escalation cost share for the period
