## ADDED Requirements

### Requirement: A single authoritative spend envelope gates autonomous spending
The system SHALL serve exactly one authoritative `spendEnvelope` shape `{scope, window_s, usd_cap, token_cap, compose_cap, spent_usd,
spent_tokens, spent_composes, window_start, paused, reason}`, served by one owner
(discovery `unique_authoritative`) and debited from `llmSpend`. Autonomous selection
(auto-pick, rhythm conductor, boredom) on every node SHALL resolve it through discovery at
use time and SHALL not start spending work when the envelope is exhausted or paused. If the
envelope cannot be resolved, composes SHALL not start; cheap ticks MAY continue.

#### Scenario: Envelope exhausted
- **WHEN** `spent_usd ≥ usd_cap` in the current window
- **THEN** auto-pick returns a non-attempt `stage:budget` on every node, and no fc-plan is logged

#### Scenario: Pause reaches every node
- **WHEN** the envelope is set `paused:true` on the owner
- **THEN** no node's conductor, boredom or auto-pick starts spending work, including peers that did not write the pause

### Requirement: A spend-rate breaker refuses runaway dispatch
`/run-goal` and `/resolve` SHALL count dispatches per goal hash and globally over a window,
on the raw goal before any LLM call, and SHALL refuse with a terminal record above a
threshold read from a shaped impulse.

#### Scenario: Storm shape
- **WHEN** one goal hash is dispatched more than the per-hash threshold within the window
- **THEN** further dispatches of it are refused with zero LLM calls until the window passes
