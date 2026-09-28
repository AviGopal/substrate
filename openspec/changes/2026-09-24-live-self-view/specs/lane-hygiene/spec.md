## MODIFIED Requirements

### Requirement: Every refusal the lane issues leaves a lesson on the gap
A `feature_compose` that returns `REFUSED` at `stage: scope` (vacuous, non-terminating,
dead-store, off-target) SHALL append a `failure_lessons` entry of class `scope_refused`
carrying the gate name and reason to the gap, so the next pick can narrow or re-specify
on it. Today only verify and judge outcomes leave lessons.

#### Scenario: Vacuous refusal
- **WHEN** the vacuous gate refuses a plan for gap G
- **THEN** G's `failure_lessons` gains `{class: "scope_refused", gate: "vacuous", reason: …}`

### Requirement: Deterministic refusals propagate to minted children
When the lane mints a narrowed or recommit child for a gap whose most recent semantic
verdict was deterministic (`hard_fail: true`, `llm_consulted: false`), the child SHALL be
minted with status `superseded` and `superseded_by` set to the parent, and SHALL NOT be
picked.

#### Scenario: Dead-code helper spec
- **WHEN** the judge refuses a helper with no call site and the lane narrows the gap
- **THEN** the narrowed child is `superseded`, and no compose slot is spent on it
