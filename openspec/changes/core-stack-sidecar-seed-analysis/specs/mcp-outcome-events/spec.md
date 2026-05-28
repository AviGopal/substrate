## MODIFIED Requirements

### Requirement: user-vessel MUST persist semantic mcp outcome events

Outcome events SHALL be persisted in `metabob-analysis-api` under the same `mcp_events` table as `tool_call` and `seed_read` events introduced by the modified `mcp-usage-telemetry` capability. Each annotation, resolution, or change-event row MUST carry `api_key_id`, `org_id`, `user_id`, `session_id`, and `occurred_at`, scoped by SurrealDB PERMISSIONS keyed on `$token.org_id`. The previous `user-vessel /v2/mcp/outcomes` endpoint MUST be served during the migration window but is no longer the authoritative storage location.

#### Scenario: POST /v2/events/mcp records an annotation event
- **GIVEN** an authenticated `Authorization: ApiKey <key>` request
- **WHEN** the body contains `{ session_id, events: [{ kind: 'annotation', ts, annotation: { type, body, problem_id?, refs? } }] }`
- **THEN** the server inserts a row with `api_key_id` = caller key, `org_id` = caller org, `user_id` = caller user, `occurred_at` = event `ts`, and returns 204

#### Scenario: POST /v2/events/mcp rejects JWT callers
- **GIVEN** a `Bearer <jwt>` Authorization header
- **WHEN** POST /v2/events/mcp is invoked
- **THEN** the response is 400 `{ error: "ApiKey_required" }`

### Requirement: metabob-mcp MUST emit outcome events for state-changing tools

After a successful invocation of `mark_complete`, `annotate_component`, or `assign_git_changes`, the sidecar SHALL emit a structured event conforming to the light annotation contract from design.md D9.

Annotation event payload shape:

```typescript
type AnnotationEvent = {
  kind: 'annotation' | 'resolution';
  ts: number;
  annotation: {
    type: 'explain' | 'recommend' | 'note' | 'resolution';
    body: string;             // free text owned by agent, ≤ 2000 chars
    problem_id?: string;      // seed id if annotating an existing seed
    refs?: { files?: string[]; commit_hashes?: string[] };
  };
};
```

`mark_complete` emits `kind: 'resolution'` with `annotation.type: 'resolution'`; `annotate_component` emits `kind: 'annotation'` with `annotation.type` matching the tool's `kind` argument (`explain`, `recommend`, or `note`); `assign_git_changes` emits a separate `kind: 'tool_call'` event with the changed-files payload as part of the standard tool-call event (not as an annotation).

#### Scenario: mark_complete success emits a resolution event
- **GIVEN** `mark_complete({problem_id: 'p1', verdict: 'endorsed'})` succeeds
- **WHEN** the tool returns
- **THEN** the next event batch contains `{ kind: 'resolution', ts, annotation: { type: 'resolution', body: 'endorsed', problem_id: 'p1' } }`

#### Scenario: mark_complete discarded emits a resolution with body=discarded
- **GIVEN** `mark_complete({problem_id: 'p1', verdict: 'discarded'})` succeeds
- **WHEN** the tool returns
- **THEN** the next event batch contains `{ kind: 'resolution', ts, annotation: { type: 'resolution', body: 'discarded', problem_id: 'p1' } }`

#### Scenario: annotate_component explain emits a typed annotation
- **GIVEN** `annotate_component({problem_id: 'p1', kind: 'explain', content})` succeeds
- **WHEN** the tool returns
- **THEN** the next event batch contains `{ kind: 'annotation', ts, annotation: { type: 'explain', body: <content truncated to 2000 chars>, problem_id: 'p1' } }`

#### Scenario: annotate_component note without problem_id is freestanding
- **GIVEN** `annotate_component({kind: 'note', content})` succeeds (no problem_id)
- **WHEN** the tool returns
- **THEN** the event has `annotation.problem_id` unset and `annotation.type = 'note'`

#### Scenario: assign_git_changes success emits tool_call event with capped file list
- **GIVEN** `assign_git_changes({changed_files: [...]})` with 25 entries
- **WHEN** the tool returns
- **THEN** the next event batch contains `{ kind: 'tool_call', ts, tool_name: 'assign_git_changes', success: true, duration_ms, refs: { files: <first 20 entries> } }` (no separate annotation event)

### Requirement: cloud-dashboard MUST render annotations and resolutions in the timeline

The session timeline at `/sessions/:session_id` SHALL render annotation and resolution events with type-specific iconography and labels:

- `annotation.type === 'explain'`: label "Explanation" with an info icon
- `annotation.type === 'recommend'`: label "Recommendation" with a sparkle/wand icon
- `annotation.type === 'note'`: label "Note" with a notepad icon
- `annotation.type === 'resolution'` (resolution events): label "Resolved" or "Dismissed" depending on `body`, with a check or cross icon respectively

#### Scenario: Resolution rendered distinctly from explain
- **GIVEN** a session with one explain annotation and one resolution event
- **WHEN** the timeline is rendered
- **THEN** the explain row has the "Explanation" label and info icon; the resolution row is visually distinct (check/cross icon, different colour) and labelled "Resolved" or "Dismissed"

#### Scenario: Annotation references its seed
- **GIVEN** an annotation event with `problem_id: 'p1'` where seed `p1` exists earlier in the same session
- **WHEN** the timeline is rendered
- **THEN** the annotation row visually links to the seed row (indentation, connecting line, or anchor link)

#### Scenario: Freestanding note rendered without parent
- **GIVEN** a note annotation event with no `problem_id`
- **WHEN** the timeline is rendered
- **THEN** the row renders independently in chronological position, not nested under any seed

## ADDED Requirements

### Requirement: Annotation body length is bounded

The sidecar SHALL truncate `annotation.body` to 2000 characters before posting events. Truncation SHALL be marked with a trailing `…[truncated]` indicator in the persisted body.

#### Scenario: 3000-char body is truncated
- **GIVEN** the agent calls `annotate_component` with a 3000-character body
- **WHEN** the event is emitted
- **THEN** the persisted body is `<first 1985 chars> + …[truncated]` for a total of 2000 chars

#### Scenario: 1500-char body untouched
- **GIVEN** a 1500-character body
- **WHEN** the event is emitted
- **THEN** the persisted body equals the input exactly with no truncation indicator
