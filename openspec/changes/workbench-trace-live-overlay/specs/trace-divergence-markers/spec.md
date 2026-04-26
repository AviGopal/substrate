## ADDED Requirements

### Requirement: Task rows annotated with resolver-tier divergence when trace differs from template
When a historical trace is loaded onto the trajectory grid, each task row in `TaskEditor` SHALL display a divergence badge when the trace's recorded `resolverTier` for that task differs from the template task's declared resolver expectation. The badge SHALL show the expected and actual tier values.

#### Scenario: Resolver tier matches — no badge
- **WHEN** a trace task recorded `resolverTier: "llm"` and the template task's `resolver` field indicates LLM resolution
- **THEN** no divergence badge is shown on that task row

#### Scenario: Resolver tier mismatch — badge shown
- **WHEN** a trace task recorded `resolverTier: "deterministic"` but the template task declares `resolver: "llm"`
- **THEN** that task row shows a divergence badge with text "expected llm · got deterministic"

#### Scenario: Template task has no resolver declaration — no badge
- **WHEN** a template task has no explicit `resolver` field set
- **THEN** no resolver-tier divergence badge is shown for that task (divergence requires a declared expectation)

### Requirement: Task rows annotated with output-shape divergence when trace output differs from template
When a historical trace is loaded, each task row SHALL display a divergence badge when the trace's output impulse shapes for that task differ from the template task's declared `output_shapes`. A mismatch occurs if the sets differ in any member.

#### Scenario: Output shapes match — no badge
- **WHEN** a trace task produced shapes {"file_content"} and the template task declares `output_shapes: ["file_content"]`
- **THEN** no output-shape divergence badge is shown

#### Scenario: Trace produced extra shapes — badge shown
- **WHEN** a trace task produced shapes {"file_content", "memo"} but the template declares `output_shapes: ["file_content"]`
- **THEN** a divergence badge appears: "extra: memo"

#### Scenario: Trace produced fewer shapes — badge shown
- **WHEN** a trace task produced no shapes but the template declares `output_shapes: ["test_result"]`
- **THEN** a divergence badge appears: "missing: test_result"

#### Scenario: No divergence data available — no badge
- **WHEN** a trace is loaded but `taskResolutions` for that task is empty (no impulse.resolved events)
- **THEN** no output-shape divergence badge is shown (insufficient data)

### Requirement: Divergence annotations computed once on trace load, not live
Divergence annotations SHALL be computed synchronously in a `useMemo` when `activeTraceId` changes, comparing the loaded template tasks against the `traceCardData` and `taskResolutions` from the store. The computation SHALL not be repeated on every render.

#### Scenario: Divergence computed on trace load
- **WHEN** a trace is loaded (activeTraceId becomes non-null)
- **THEN** divergence annotations are computed and the affected task rows update to show badges

#### Scenario: Divergence cleared on trace unload
- **WHEN** the active trace is cleared (activeTraceId becomes null)
- **THEN** all divergence badges disappear from task rows

### Requirement: ActivityCard shows divergence summary count when any task has divergences
When one or more tasks in an ActivityCard have divergence annotations, the ActivityCard header SHALL show a small count badge indicating the number of divergent tasks. This allows users to spot problematic activities without expanding all cards.

#### Scenario: Divergence summary badge on collapsed card
- **WHEN** 2 of 4 tasks in an ActivityCard have divergence markers and the card is collapsed
- **THEN** the collapsed card header shows a "2 divergences" indicator

#### Scenario: No summary badge when no divergences
- **WHEN** no tasks in an ActivityCard have divergence annotations
- **THEN** no divergence count badge is shown on that card's header
