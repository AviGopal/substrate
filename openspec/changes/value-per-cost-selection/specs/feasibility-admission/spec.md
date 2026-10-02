## ADDED Requirements

### Requirement: Deterministic cannot-succeed checks run at admission, cheapest first
Autonomous gap admission SHALL evaluate, in this order and before any LLM call or process
spawn: ownership; protected vessel (from the shared `PROTECTED_VESSELS`); whether the
target vessel's push scope resolves (the same `gateLanding` decision the cutover makes,
memoised per vessel per pass); whether the gap is actionable; whether an LLM producer is
advertised; the spend budget. Only then site caps, history checks and the typecheck
spawn. Each exclusion SHALL be counted by reason in the admission log.

#### Scenario: Unlandable target is excluded before drafting
- **WHEN** a gap targets a vessel whose push remote is not an owner/repo URL
- **THEN** admission excludes it with `push_scope_refused(<vessel>)`, no fc-plan is logged for it, and the cutover never sees it

#### Scenario: No LLM, no slot taken
- **WHEN** no `llm_completion` producer is advertised
- **THEN** selection returns a non-attempt before acquiring a compose slot

### Requirement: Only actionable gaps become compose work
Admission SHALL exclude from compose, as `needs_information`, any gap with no edit site
(`edit_site`, `file_path` or `change_site`) and a falsifier that is not class1 or class2, routing it to
investigation, whether or not a proposal report exists, and on every pick, not once.

#### Scenario: Untargeted model-opportunity gap
- **WHEN** a `(no-target)` architectural gap with falsifier `none` is a candidate
- **THEN** it is excluded as `needs_information` and never reaches feature_compose

### Requirement: Score is not overridden by an uninformed class posterior
Selection SHALL exclude candidates below a landability floor before any posterior rerank,
so an uninformed class posterior cannot lift a score-0 candidate over a higher-scored one.

#### Scenario: Score-0 candidate
- **WHEN** candidates include one at landability 0 in a fresh class and one at 0.9
- **THEN** the score-0 candidate is not picked
