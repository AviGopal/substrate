## ADDED Requirements

### Requirement: POST /v2/analysis/run accepts context bundles

`metabob-analysis-api` SHALL expose `POST /v2/analysis/run` accepting `Authorization: ApiKey <key>` and a body conforming to the context bundle schema defined in design.md (`session_id`, `request_id`, `priority`, `workspace_id`, `context`, optional `tier_hint`).

#### Scenario: Well-formed bundle returns 200 with seeds
- **GIVEN** a valid API key resolved by identity-vessel
- **WHEN** the sidecar POSTs a well-formed bundle for a code region containing a clear race condition pattern
- **THEN** the response is `200` with body `{ request_id, seeds: [Seed], model_used, tokens_in, tokens_out, cost_usd, budget }` where each Seed conforms to the schema in design.md D2

#### Scenario: Missing required fields returns 400
- **GIVEN** a bundle missing the `workspace_id` field
- **WHEN** posted to `/v2/analysis/run`
- **THEN** the response is `400 { error: "missing_field", field: "workspace_id" }`

#### Scenario: Duplicate request_id is idempotent
- **GIVEN** a previous successful response stored for `request_id = R`
- **WHEN** the sidecar retries the identical request with the same `request_id`
- **THEN** the cached response is returned without re-invoking the LLM, and `cost_usd` is `0`

### Requirement: Seed output conforms to controlled vocabulary

Every Seed returned by `/v2/analysis/run` SHALL have its `category` field set to exactly one value from the closed set: `race-condition`, `runtime-error`, `alignment`, `type-confusion`, `null-deref`, `resource-leak`, `perf`, `security`, `api-misuse`, `logic-error`, `style`, `other`. The LLM SHALL NOT invent categories outside this set.

#### Scenario: LLM proposed category mapped to known set
- **GIVEN** the LLM internally classifies an issue as "data-race"
- **WHEN** the analysis-api constructs the Seed
- **THEN** the seed's `category` field is `race-condition` (the closest controlled value)

#### Scenario: Truly novel issue uses `other`
- **GIVEN** an issue that does not map cleanly to any of the 11 specific categories
- **WHEN** the seed is emitted
- **THEN** `category = 'other'` and the `brief` field clarifies the nature in plain text

### Requirement: Seed brief is bounded and descriptive only

The `brief` field of every Seed SHALL be a single-line description of what and where, no longer than 240 characters, and SHALL NOT contain fix recommendations or step-by-step explanations.

#### Scenario: Brief stays under 240 chars
- **WHEN** any Seed is returned
- **THEN** `seed.brief.length <= 240` and `seed.brief` contains no newline characters

#### Scenario: Brief avoids fix language
- **WHEN** the LLM proposes a brief
- **THEN** the analysis-api rejects briefs that begin with imperative fix language ("Use", "Replace with", "Change to", "Refactor to") and re-prompts for a descriptive form, or rewrites to descriptive form before storage

### Requirement: Two-tier model dispatch with confidence escalation

`/v2/analysis/run` SHALL execute Haiku 4.5 first by default. If the Haiku response yields any seed with `confidence < 0.6` AND the input bundle is ≤ 10000 tokens, the same request SHALL be re-run with Sonnet 4.6 and the Sonnet result returned. The `model_used` field SHALL reflect the model whose seeds are returned to the caller.

#### Scenario: High-confidence Haiku response returned directly
- **GIVEN** Haiku produces a seed with `confidence = 0.85`
- **WHEN** the response is built
- **THEN** `model_used = 'haiku'` and no Sonnet call is made

#### Scenario: Low-confidence Haiku triggers Sonnet escalation
- **GIVEN** Haiku produces a seed with `confidence = 0.45`
- **AND** the input bundle was 7000 tokens
- **WHEN** the response is built
- **THEN** the analysis-api re-runs the same bundle on Sonnet, returns the Sonnet seeds, and sets `model_used = 'sonnet'`

#### Scenario: Oversized bundle skips Sonnet escalation
- **GIVEN** Haiku produces a low-confidence seed and the input was 14000 tokens
- **WHEN** the response is built
- **THEN** no Sonnet escalation occurs (over token threshold), the Haiku seed is returned with its low confidence intact

#### Scenario: tier_hint=sonnet forces Sonnet
- **GIVEN** a request body with `tier_hint = 'sonnet'`
- **WHEN** the analysis-api processes the request
- **THEN** Sonnet is used directly without running Haiku first, and `model_used = 'sonnet'`

### Requirement: Cost accounting includes both tiers

The `cost_usd`, `tokens_in`, and `tokens_out` fields of the response SHALL reflect the total across both model invocations when Sonnet escalation occurs. The budget tracker SHALL be debited for the sum.

#### Scenario: Escalation cost combined
- **GIVEN** Haiku used 4000 input / 300 output tokens at $0.004 and Sonnet used 4500 input / 700 output tokens at $0.024
- **WHEN** the response is returned
- **THEN** `tokens_in = 8500`, `tokens_out = 1000`, `cost_usd = 0.028`

### Requirement: Seeds persist for dashboard reads

Every seed returned by `/v2/analysis/run` SHALL be persisted in the analysis-api datastore with `api_key_id`, `session_id`, `workspace_id`, `created_at`, and `model_used`. Seeds are addressable by their assigned `id` for subsequent dashboard reads and annotation references.

#### Scenario: Seed persisted with key linkage
- **GIVEN** a successful analysis call for api_key K and session S
- **WHEN** the response is built
- **THEN** the seed row in the datastore has `api_key_id = K`, `session_id = S`, `org_id = <K's org>`, and an opaque `id` returned in the response

#### Scenario: Org isolation enforced
- **GIVEN** seeds exist for org A's keys
- **WHEN** a dashboard read query is made with a JWT for org B
- **THEN** zero seeds from org A are returned

### Requirement: Workspace identifier is sidecar-supplied

`/v2/analysis/run` SHALL accept the `workspace_id` from the sidecar without attempting to derive it server-side. Analysis-api SHALL store it alongside each seed and use it for grouping in dashboard reads.

#### Scenario: Same workspace across sessions correlates
- **GIVEN** sessions S1 (Monday) and S2 (Tuesday) both submit `workspace_id = W` for the same api_key
- **WHEN** the dashboard queries `/v2/dashboard/sessions?api_key_id=K`
- **THEN** both sessions appear and can be filtered by `workspace_id = W`
