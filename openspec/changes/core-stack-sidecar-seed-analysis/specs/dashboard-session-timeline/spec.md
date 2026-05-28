## ADDED Requirements

### Requirement: Sessions list endpoint

`metabob-analysis-api` SHALL expose `GET /v2/dashboard/sessions` returning a paginated list of sessions for the caller's org, optionally filtered by `api_key_id`, `from`, `to`, and `workspace_id`.

#### Scenario: Caller's org returns sessions
- **GIVEN** the caller's JWT carries `org_id = O` and sessions exist for org O
- **WHEN** `GET /v2/dashboard/sessions?from=2026-05-20T00:00:00Z&to=2026-05-27T00:00:00Z` is invoked
- **THEN** the response is `200 { sessions: [...], total }` where every entry has `api_key_id`'s org equal to `O`

#### Scenario: Each entry carries summary counts
- **WHEN** the sessions list is returned
- **THEN** each entry has at minimum: `session_id`, `api_key_id`, `workspace_id`, `started_at`, `ended_at`, `files_touched`, `seeds_produced`, `annotations_posted`, `resolutions_count`

#### Scenario: Cross-org access blocked
- **GIVEN** sessions exist for org A's keys
- **WHEN** an org B JWT calls the endpoint
- **THEN** zero org A sessions appear in the response

### Requirement: Single session drill-down endpoint

`metabob-analysis-api` SHALL expose `GET /v2/dashboard/sessions/:session_id` returning the full event timeline for one session.

#### Scenario: Timeline contains all three event kinds
- **GIVEN** a session that produced 4 seeds, 6 annotations, and 2 resolutions
- **WHEN** the drill-down endpoint is called
- **THEN** the response is `200 { session_meta, events: [...] }` where `events` contains 12 entries (4 seed + 6 annotation + 2 resolution), each with a `kind` field, timestamp, and the relevant payload

#### Scenario: Events are sorted by timestamp
- **WHEN** the timeline is returned
- **THEN** the `events` array is sorted by `ts` ascending

#### Scenario: Unknown session_id returns 404
- **WHEN** the called `session_id` does not exist or belongs to another org
- **THEN** the response is `404 { error: 'session_not_found' }`

### Requirement: Cloud-dashboard renders sessions list

`metabob-cloud-dashboard` SHALL render a `/sessions` route that lists sessions in a table view sorted by `started_at` descending. Each row SHALL be clickable to navigate to the drill-down view.

#### Scenario: Sessions route lists recent sessions
- **GIVEN** an authenticated team-lead user with sessions in their org
- **WHEN** they navigate to `/sessions`
- **THEN** a table renders showing at minimum `started_at`, `api_key_id` (with key name), `workspace_id` (shortened), `files_touched`, `seeds_produced`, `resolutions_count`

#### Scenario: Filter by api_key
- **WHEN** the user selects an api_key filter in the table header
- **THEN** the table re-queries with `?api_key_id=<id>` and shows only matching sessions

### Requirement: Cloud-dashboard renders three-act timeline

`metabob-cloud-dashboard` SHALL render `/sessions/:session_id` as a chronological timeline of `seed`, `annotation`, and `resolution` events. Seed events SHALL show category, severity, file:lines, brief, and confidence. Annotation events SHALL show type (`explain`/`recommend`/`note`/`resolution`), body, and any referenced `problem_id`. Resolution events SHALL be visually distinct from other annotations.

#### Scenario: Seed → annotation → resolution chain renders
- **GIVEN** a session where seed S1 was produced, then an `explain` annotation referenced S1, then a `resolution` annotation referenced S1
- **WHEN** the user opens `/sessions/<session_id>`
- **THEN** the timeline shows three connected events: seed S1 first, the explain annotation underneath labelled as referencing S1, and the resolution at the bottom marked as closure

#### Scenario: Empty session renders placeholder
- **GIVEN** a session with zero events
- **WHEN** the user opens its drill-down view
- **THEN** the timeline renders an empty-state placeholder explaining no activity was recorded

### Requirement: Timeline updates in near real-time

When a session is currently active (no `ended_at`), the dashboard SHALL poll the drill-down endpoint every 5 seconds and append new events to the rendered timeline. When `ended_at` becomes set, polling SHALL stop.

#### Scenario: Active session polls every 5s
- **GIVEN** the session's `ended_at` is null
- **WHEN** the drill-down view is open for 30 seconds
- **THEN** the endpoint is polled at least 5 and at most 7 times within that interval

#### Scenario: Completed session does not poll
- **GIVEN** the session's `ended_at` is set
- **WHEN** the drill-down view is open
- **THEN** the dashboard performs a single fetch on mount and no further polling

### Requirement: Session events ingested from event posts

`metabob-analysis-api` SHALL accept `POST /v2/events/mcp` with batched events from the sidecar (`tool_call`, `seed_read`, `annotation`, `resolution`). Each event SHALL be associated with `session_id`, `api_key_id` (resolved from the API key auth), and stored for later dashboard queries.

#### Scenario: Annotation event creates timeline entry
- **GIVEN** an authenticated `POST /v2/events/mcp` with body `{ session_id: S, events: [{ kind: 'annotation', ts, annotation: { type: 'explain', body, problem_id } }] }`
- **WHEN** the request is processed
- **THEN** the event is stored with the resolved `api_key_id` and `org_id`, and subsequent `GET /v2/dashboard/sessions/S` returns the annotation in its `events` array

#### Scenario: Resolution event updates session summary
- **GIVEN** a resolution event posted for a session
- **WHEN** the dashboard refetches the session list
- **THEN** the session's `resolutions_count` reflects the new resolution
