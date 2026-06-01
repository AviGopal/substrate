# Display control extension (action primitives over the perception channel)

## Why

`2026-05-31-display-perception-vessel` opens a read-only channel: the
substrate can observe what the operator is looking at. **Action**
(mouse, keyboard, window manipulation) is qualitatively different —
irreversible state changes in the operator's environment, much higher
blast radius. A misfiring perception emits a wrong label; a misfiring
action sends a wire transfer.

This extension adds action to the same peer-vessel that owns
perception, but only after the perception-only soak window completes
and only under a strict reversibility-class contract. The bandit
literature is unambiguous: action arms cannot be pulled before
observation arms have established priors, and irreversible arms
cannot be pulled at all without a hard external gate.

## Empirical motivation

- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern`: the
  substrate already has a working pattern of detecting its own
  failures and proposing fixes via activity-template authoring.
  Display control extends the same pattern to operator-environment
  affordances. The 2026-05-30 graph-RL session explicitly named
  reversibility-class as the partition dimension distinguishing
  "click Submit on a draft composer" from "click Submit on a wire
  transfer" — see `2026-05-31-display-signature-partitioning`
  Phase D.
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate`: 8-cycle
  probe established that signature-level partitioning is required
  before posterior credit can be attributed cleanly. The action
  channel multiplies this requirement — a single action signature
  conflating reversible and irreversible variants is unsafe.
- The 2-week soak window for perception, codified in
  `display-perception-vessel` Phase E.2, is the substrate's
  observation-only prior collection. Action ships against those
  priors, not against a flat (1,1).

## What changes

### Same vessel, both perception and action

The peer vessel implemented by `2026-05-31-display-vessel-host-peer`
owns both. Single scope, single H3 attestation issuance target,
tight perception → decision → action → re-perception loop. Splitting
into separate vessels would force a network hop per perception-action
cycle and split the consent surface.

### `reversibility_class` is the load-bearing contract field

The action shape carries a three-valued enum:

```typescript
displayAction_write = {
  ...AnthropicComputerToolInput,           // see "Action wire format" below
  reversibility_class: "reversible" | "soft_irreversible" | "hard_irreversible",
  attested_region: [x, y, w, h],
  attested_window_id?: string,
  scope_context: ScopeContext              // H3
}
```

Selector contract:

| reversibility_class | Selector dispatch policy |
|---|---|
| `reversible` | Selectable by autonomous boredom + operator-dispatched goals after the n=0 hard gate (see below). |
| `soft_irreversible` | Requires an explicit attestation enumerating the action class. Autonomous dispatch only after operator-class-graduation. |
| `hard_irreversible` | Never autonomous. Operator role structurally non-removable. Attestation must enumerate the specific irreversible action and cannot auto-renew. |

`reversibility_class` enters the **signature** as a discrete dimension
(per `2026-05-31-display-signature-partitioning` Phase D), NOT as a
β scalar. The `hard_irreversible` bucket accumulates its own posterior
distinct from `reversible`, so the selector under-explores it by
construction rather than by an artificial weight.

### Action wire format: Anthropic computer-use, vendored

The action input schema reuses the already-vendored Anthropic
`computer_20251124` tool definition at
`repos/vessels/ai/packages/anthropic/src/tool/computer_20251124.ts`.
Action vocabulary covers `key`, `hold_key`, `type`,
`cursor_position`, `mouse_move`, `left_mouse_down`/`up`,
`left_click`, `left_click_drag`, `right_click`, `middle_click`,
`double_click`, `triple_click`, `scroll`, `wait`, `screenshot`,
`zoom`. The peer vessel binds this schema as the `displayAction_write`
shape contract; the substrate emits actions in this wire format and
the peer vessel executes via platform shellouts (`xdotool`,
`ydotool`, `cliclick`, `nircmd` — see
`2026-05-31-display-vessel-host-peer` Phase B–E).

Note: `screenshot` and `zoom` in this enum overlap with the
perception channel. The peer vessel routes both through the
perception path even when dispatched via the action schema, to
keep capture-side observability identical regardless of entry point.

### Continuous-consent attestations, seconds not hours

H3 attestations for action have explicit short deadlines:

- `reversible` — default 30s lifetime, auto-renewable on substrate
  audit demonstrating the prior burst succeeded without abort.
- `soft_irreversible` — default 10s, single-use, no auto-renewal.
  Renewal requires fresh operator action.
- `hard_irreversible` — default 5s, single-use, no auto-renewal,
  must enumerate the specific action class. Multiple
  hard-irreversible actions require multiple attestations.

Renewal policy is enforced at the peer vessel; substrate-side
selector reads the live attestation state via a
`displayConsentState` resolver before dispatch.

### Operator interrupt

The peer vessel binds a global hotkey (default: Escape pressed twice
within 250ms; configurable via the peer vessel's local config). On
trigger:

1. Kill in-flight action queue.
2. Revoke all live attestations (mark `revoked_at = now`).
3. Substrate-side emit `actionAborted` impulse with the full
   composition chain → posterior penalty via the
   `consent_revoked` failure-mode from
   `2026-05-31-display-failure-mode-extensions` Phase B
   (`{α=0, β=0}` Thompson + `consent_state_reset` veto on the
   `(template, signature)` for a cool-down window).

The interrupt is the operator's strongest push-away surface. Its
existence is what makes any degree of autonomous action acceptable:
the operator can always shut it down, and every shutdown is recorded
as cited evidence of intervention.

### Rate limit + burst cap

Peer vessel enforces hard caps at the dispatch boundary, not the
selector layer:

- ≤ 10 actions/second steady state
- ≤ 30 actions per burst
- ≥ 50ms minimum inter-action delay

Bypass requires an operator-signed attestation enumerating the higher
limit and its rationale. Default caps are not configurable from
the substrate side.

### Verifier: `verify-display-state-after-action`

Every action chain leaves with this leaf activity. Composition depth
from action → verifier is 1, so the verifier receives γ=0.5 credit
under the existing `propagateCreditAlongChain` decay
(`posterior-update.ts:386-392`).

Tiered success criteria, cheapest to richest:

| Tier | Check | Cost | Strength |
|---|---|---|---|
| 1 | Pixel-region hash changed | sub-ms | Cheapest — confirms *something* happened, not what |
| 2 | Expected element appeared / disappeared in `displayObjectDetection` | OmniParser inference cost | Medium — confirms the intended state change |
| 3 | Operator did NOT abort within N seconds (configurable, default 5s) | Passive observation | Weak positive — absence of veto |
| 4 | Operator explicitly confirmed via a dispatched confirmation impulse | Operator interrupt cost | Strongest — but rare; reserved for `soft_irreversible` and above |

The verifier emits `verifier_negative` with `confidence_tier` per
`display-failure-mode-extensions` Phase C.3 when the check fails.
Tier 1 negatives = full β=1; tier 3 / passive-non-abort negatives =
β=0.5.

### Autonomy gradient per action-class (S2→S3 framing)

Action classes graduate independently:

1. **`reversible × small_region × focused_window`** earns autonomous
   dispatch first, after demonstrating ≥ 30 successful supervised
   dispatches AND ≥ 3 `interventionRefused` impulses on operator
   pressure to perform out-of-scope actions (with cited rationale).
   This is direct S2→S3 push-away credit per IAL §27.S.6.
2. **`reversible × larger_region`** earns next, by the same gradient.
3. **`soft_irreversible`** earns only by explicit operator
   attestation per class; no implicit graduation.
4. **`hard_irreversible`** never earns autonomous dispatch.
   Operator role for those is structurally permanent. The
   substrate may *propose* hard-irreversible actions (emit the
   intent as an impulse) but never dispatch them.

Each class graduation is recorded into
`validation/state/display-action-autonomy-status.json` with the
trace evidence supporting the graduation. Operators can revoke a
graduation at any time via `concept_link({edge_type:
"contradicts"})` against the graduation record.

### Hard gate: n=0 + displayAction_write → refuse

The first encounter with a novel display signature requires operator
confirmation regardless of reversibility class. Rationale: even
reversible actions on a never-before-seen window are high-risk
because the rollback path itself is untested for that surface — the
verifier hasn't established what "success" looks like on this
signature.

Enforcement: when the selector is about to dispatch
`displayAction_write` against a `(template, signature)` with
`n_observations = 0` on the corresponding `displayObjectDetection`
posterior, refuse with `failure_mode.context.intervention_refused =
true` and emit a `displayActionFirstEncounter` impulse for operator
review.

### `detect-display-action-no-op` seed template

Display analog of the existing `detect-phantom-success-trace`
pattern (referenced by `2026-05-30-vessel-binary-redeploy-on-source-drift`
authorship attribution section). Catches cases where
`displayAction_write` returned `status=success` but the pre- and
post-action `displayObjectDetection` hashes are identical — the
substrate confidently reporting "click landed" when it hit dead
space.

When detected:

- Emit `failure_mode { type: "verifier_negative", confidence_tier: 1,
  failed_evidence: [{check_id: "post_action_state_unchanged"}] }`.
- The substrate-self-fix concept graph picks this up via
  `concept_HKlz4FAc2cpf`-class detectors.

## Soak gate

This proposal MUST NOT begin implementation until
`2026-05-31-display-perception-vessel` Phase E.2 returns
`displaySoakReport.ready = true`. The gate is enforced as Phase A.1
in this spec's tasks file. There is no implementation work in
Phase A — only the gate.

## Out of scope

- **Perception primitives** — `2026-05-31-display-perception-vessel`.
- **The peer-vessel implementation** —
  `2026-05-31-display-vessel-host-peer`.
- **Signature partitioning** —
  `2026-05-31-display-signature-partitioning`.
- **Failure-mode taxonomy extensions** —
  `2026-05-31-display-failure-mode-extensions`.
- **H3 implementation** — `2026-04-26-security-hardening-findings`.
- **Cross-substrate action federation** — explicitly deferred. A
  substrate may not dispatch actions against another substrate's
  display peer until the federation spec adds peer-trust ratification.

## Dependencies

- **Hard:** `2026-05-31-display-perception-vessel` Phase E.2
  returning `ready: true` (≥ 2-week soak).
- **Hard:** `2026-05-31-display-failure-mode-extensions` Phase B
  (`consent_revoked`, `action_reversal_failed`) + Phase C
  (`confidence_tier`, `root_cause_step`).
- **Hard:** `2026-05-31-display-signature-partitioning` Phase D
  (`reversibility_class` as a signature partition dimension).
- **Hard:** `2026-05-31-display-vessel-host-peer` Phase B (Linux
  X11 input shellouts) for a minimum-viable action path; Phases
  D–E for full platform coverage.
- **Soft (advisory until shipped):**
  `2026-04-26-security-hardening-findings/` H3 — until H3 enforces
  scope attestations cryptographically, the continuous-consent
  attestations are validated log-only at the peer vessel.

## Risk

- **Bandit under-exploration of irreversible classes is a feature,
  not a bug.** The selector will never optimize hard-irreversible
  arms efficiently; that's the intended structural property. The
  proposal explicitly accepts the cost.
- **Hotkey conflict on the operator machine.** The default Escape-
  Escape binding may conflict with other applications. Mitigation:
  peer-vessel local config exposes the binding; on conflict the
  operator changes it before enabling action.
- **Verifier tier 3 (non-abort within N seconds) is exploitable** —
  an operator who stepped away grants weak success signal to
  whatever the substrate just did. Mitigation: the
  `(template, signature)` posterior built on tier-3 evidence
  carries an explicit `evidence_confidence` annotation; substrate
  audits surface high-tier-3-reliance buckets as
  `low_evidence_quality_warning` impulses.
- **n=0 hard gate may starve legitimate first-time uses.** A
  trusted operator-dispatched goal against a brand-new window
  cannot proceed without confirmation. Mitigation: the operator
  confirmation impulse is single-click, not multi-step; the gate
  is a one-time friction per signature.
- **Auto-renewal of continuous-consent for `reversible` could
  drift.** The audit-based renewal may approve renewals that the
  operator would reject in hindsight. Mitigation: each
  auto-renewal emits an impulse; operators can revoke via
  `concept_link contradicts` to halt the renewal chain.
- **`action_reversal_failed` β=2 from
  `display-failure-mode-extensions` is the strongest negative
  signal in the system.** A misfire here strongly suppresses the
  template's selection probability for many subsequent draws.
  Acceptable — the asymmetry matches the action class's blast
  radius.

## Companion concepts

- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (the
  no-op detection sibling rides this concept).
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate`
  (8-cycle probe; reversibility-class as a partition dimension is
  this concept's action-side dual).
- `concept_MNYEq7xc_46U` — `architectural_asymmetry` (action's
  asymmetric step size matches the asymmetric blast radius).

## Related openspecs

- `2026-05-31-display-perception-vessel/` — perception sibling;
  hard prerequisite.
- `2026-05-31-display-vessel-host-peer/` — peer-vessel
  implementation; hosts the action resolver.
- `2026-05-31-display-signature-partitioning/` — supplies the
  `reversibility_class` partition dimension.
- `2026-05-31-display-failure-mode-extensions/` — supplies
  `consent_revoked`, `action_reversal_failed`, `confidence_tier`,
  `root_cause_step`.
- `2026-04-26-security-hardening-findings/` — H3 attestation
  consumer (advisory until H3 ships).
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` — Phase E
  push-away credit framework; action's class-graduation feeds the
  same `validation/state/lift-status.json` rubric.

## Graph-RL framing

- **`reversibility_class` as a partition dimension = action-class
  factorization of the Q-table.** Each bucket key is
  `(state, action-class)`; updates do not leak between classes.
  Standard actor-critic factorization for safety-constrained
  bandit problems.
- **Continuous-consent attestations with second-scale deadlines =
  budgeted exploration window.** The attestation is the
  per-window exploration budget; refusing to renew is the natural
  termination condition.
- **Operator-interrupt push-away = active rejection signal.** The
  S2→S3 framing from IAL §27.S.6 explicitly requires active
  refusal with cited evidence. The action channel is where the
  push-away surface is most legible — every hotkey trigger is a
  cited refusal with the full composition chain attached.
- **Hard n=0 gate = epistemic safety floor.** No matter how
  attractive the prior, the bandit may not pull an arm whose
  observation count is zero on a novel signature. Standard
  PAC-Bayes-style floor for high-blast-radius actions.
- **Tiered verifier success = outcome-conditional credit
  attribution.** Tier 1 (pixel hash) and tier 4 (operator
  confirmation) get full credit; tier 3 (passive non-abort) gets
  half credit. This is the failure-side
  `confidence_tier` from `display-failure-mode-extensions` Phase
  C.3 generalized to the success side — restoring the
  symmetric outcome-conditional learning rate the graph-RL
  framing requires.
