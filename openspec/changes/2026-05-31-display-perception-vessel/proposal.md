# Display perception vessel (read-only sensing primitives)

## Why

The substrate has rich primitives for logs, filesystem, HTTP, traces, and
process control, but **zero primitives for visual perception**. A grep
across the super-repo and the in-container vessels returns no
`image/*`, no `screenshot`, no `vision`, no `screen_capture`, no
`pixel`/`bbox`/`detection`/`OCR` references. The substrate is blind to
"what the operator is currently looking at." Every existing resolver
operates on structured data the operator has already encoded (a file
path, an HTTP response, a trace row); none can observe the operator's
ambient display state.

This proposal opens that channel — **read-only**. Action (mouse,
keyboard, window control) is the dual proposal
`2026-05-31-display-control-extension`, gated behind a perception-only
soak window. The third proposal `2026-05-31-display-vessel-host-peer`
implements the peer vessel that hosts both.

The motivation has been validated in two prior conceptual investigations
on the substrate (`concept_WikGVLa5d6kp`
`selector_anchor_vocabulary_gate`, `concept_HKlz4FAc2cpf`
`substrate_self_fix_pattern`) and an explicit 8-cycle exploration of
how a perception channel would close the gap between "operator
attention" and "substrate-recorded trace state." The substrate's
current model of "what is happening on the operator's desk" is
inferential from `concept-bridge-observer` traces over commit history,
file mtimes, and chat. Direct display perception turns that inference
into observation.

## What changes

### Architecture: Option C — peer vessel on operator machine

Three architectures were considered:

| Option | Where it runs | Rejection rationale |
|---|---|---|
| A — in-container capture | Inside `substrate-live` | Container has no display; mounting host X11 socket breaks portability; impossible on Wayland; fundamentally incompatible with the H3 attestation direction (the substrate cannot attest a capture it cannot have witnessed). |
| B — host-display shared into container | X11 socket bind-mount | X11 has zero window isolation by design — any program on the same DISPLAY can read every window. Allowing the substrate this much reach violates the H3 scope-attestation grammar before the grammar even ships. |
| C — peer vessel on host | Separate process on operator machine | Display lives where pixels live. Peer vessel owns the display, federates back via `vessel-federation` infrastructure, advertises capture/detect shapes through discovery-vessel. **Adopted.** |

The peer vessel is implemented in
`2026-05-31-display-vessel-host-peer`. This proposal defines only the
shape contracts and substrate-side seed activities; the binary lives
elsewhere.

### Model: OmniParser V2, not YOLO

Detection model rejection / selection:

- **YOLO (any variant including YOLO26):** rejected. Object classes
  trained on COCO target cats/cars/people. Screen content is UI
  elements (buttons, icons, text fields, modals). Applying a
  COCO-trained model to screens recovers the "person" class on
  avatars and nothing useful otherwise. YOLO26's vocabulary is the
  same fundamental mismatch.
- **OmniParser V2 (Microsoft Research, 2025):** purpose-built for GUI
  screens, SOTA on ScreenSpot Pro benchmark. Outputs bounding boxes
  per UI element + functional-caption ("this is a Submit button")
  + icon-label classification. Native vocabulary matches the
  detection task. **Adopted as primary detector.**
- **VLM (Claude/GPT-4o-class via `llm-resolver-vessel`):** escalation
  path for ambiguous frames where OmniParser confidence is low.
  Dispatched via the existing LLM resolver, not bundled. Cost-gated
  per the `budget_exhausted` failure-mode.

OmniParser bundle posture: ships inside the **peer vessel binary**
(`repos/display-vessel/`), not the substrate container. Operator
laptop, not substrate-portable. ~200MB+ model weights.

### Signature design: coarse projection only

Display signatures enter the Thompson posterior keying layer via
`computeStateSpaceSignature`. Three candidate inputs were considered:

| Candidate | Rejected because |
|---|---|
| Raw OCR text tokens | PII risk (account names, document titles, message contents enter the signature hash) + cardinality explosion (every typed character changes the signature) |
| Bounding-box tuples | Sparse-posterior trap (every 1px shift produces a new signature) |
| **Sorted unique set of (icon-label-classes, functional-caption-classes)** | **Adopted.** Bounded cardinality (~hundreds of classes), no PII surface, screen-shift-invariant. |

The actual partitioning machinery lives in
`2026-05-31-display-signature-partitioning` — that spec adds the
`display` and `display+source_app` tiers to `SignatureTier`. This
proposal ratifies the contract that display shapes will use those
tiers and never bypass into the `default` tier (enforced via
`shape-dispatch-check` from sibling spec Phase B.3).

### Privacy + safety (load-bearing)

The H3 signed scope attestation grammar from
`2026-04-26-security-hardening-findings/` is the consent vehicle.
Every `displayCapture` impulse carries:

```typescript
scopeContext: {
  issuer: string,          // operator pubkey-derived id
  audience: string,        // display-vessel id (H2-derived)
  scope_hash: string,      // sha256 of the scope grammar binding
  nonce: string,           // single-use
  deadline: ISO8601        // continuous-consent — short-lived
}
```

**CC1 sub-goal scope narrowing does NOT save us here.** CC1 constrains
output shapes, not frame content. The right layer for content scoping
is **region/window scoping at the capture vessel BEFORE pixels cross
the resolver boundary**. The peer vessel restricts capture to the
attested region; raw frames never leave the vessel without first
being reduced to the structured detection output.

**Never store raw frames in the trace store.** A 1080p JPEG is ~200KB
and exceeds the existing 50KB body-truncation guard at
`activity-api` impulse-resolved WebSocket events. Raw frames stay in
a tmpfs-bounded LRU at the peer vessel during the resolver call;
only the structured `displayObjectDetection` impulse reaches traces.
`capture_ref` is a pointer that becomes dangling after eviction —
acceptable because trace replay needs the structured labels, not the
raw pixels.

**Concept-bridge two-tier denylist** (extends
`concept-bridge-observer.extractConceptRefs`):

| Shape | Bridge-eligibility |
|---|---|
| `displayCapture` | **Deny** — raw-frame pointer, high cardinality |
| `displayObjectDetection` | **Deny** — per-element granularity, accidental PII via captions |
| `displayTextTokens` | **Deny** — raw OCR content |
| `displayContextAggregate` | **Allow** — session-level summary like "code-editor + browser + terminal", bounded cardinality, no per-element granularity |
| `displayContextSummary` | **Allow** — LLM-summarized natural-language description, post-redaction |

### Shape contracts

Four new shapes registered via the three-place rule
(`discovery.shapes` advertisement + `routes/impulses.ts` case + seed
template):

```typescript
// 1. displayCapture — pointer to a tmpfs-bounded frame
displayCapture = {
  capture_ref: string,           // peer-vessel-local URI; dangling after LRU eviction
  capture_method: "screenshot" | "window" | "region",
  region_attested: [x, y, w, h],
  window_id?: string,            // X11 window id / macOS CGWindowID / Win32 HWND
  source_app_id?: string,        // signed by peer vessel (unforgeable client-side)
  timestamp: ISO8601,
  scope_context: ScopeContext    // H3
}

// 2. displayObjectDetection — structured detection output
displayObjectDetection = {
  capture_ref: string,           // back-reference (dangling-tolerant)
  detected_elements: Array<{
    bbox: [x, y, w, h],
    icon_label_class: string,    // bounded vocabulary
    functional_caption_class: string,  // "submit_action" | "cancel_action" | ...
    confidence: number
  }>,
  model_id: string,              // "omniparser-v2-{version}"
  source_window_id?: string,
  source_app_id?: string,
  capture_metadata: { width, height, dpi, ... }
}

// 3. displayContextAggregate — session-level summary (bridge-eligible)
displayContextAggregate = {
  observed_app_classes: string[],     // sorted unique
  observed_functional_classes: string[],
  window_count: number,
  observed_within: { from: ISO8601, to: ISO8601 }
}

// 4. displayContextSummary — natural-language summary via LLM
displayContextSummary = {
  summary: string,               // post-redaction
  source_detections: string[],   // impulse ids (not raw)
  model_id: string,
  generated_at: ISO8601
}
```

## Out of scope

- **Action (mouse/keyboard/window control)** — `2026-05-31-display-control-extension`.
- **In-container capture** — rejected (architecture option A above).
- **Host-display shared into container via X11 socket** — rejected (architecture option B).
- **OmniParser model fine-tuning or replacement** — ships V2 weights as-is; replacement is a separate change.
- **The peer-vessel binary implementation** — `2026-05-31-display-vessel-host-peer`.
- **Signature partitioning machinery** — `2026-05-31-display-signature-partitioning`.
- **Failure-mode extensions for display** — `2026-05-31-display-failure-mode-extensions`.

## Dependencies

- **`2026-05-31-display-signature-partitioning`** Phase B (`display`,
  `display+source_app` tiers) — required for the signature contract
  this spec ratifies.
- **`2026-05-31-display-failure-mode-extensions`** Phase B
  (`consent_revoked`) + Phase C (`verifier_negative.confidence_tier`,
  `budget_exhausted.budget_type = "display"`) — required because the
  perception layer is the first writer of those failure modes.
- **`2026-05-23-vessel-federation`** — discovery-vessel peering
  infrastructure that lets the host-peer vessel federate back.
- **`2026-04-26-security-hardening-findings/` H3** — signed scope
  attestation grammar that the `scopeContext` field embeds. Until H3
  ships, attestations are advisory (log-only verification at the
  peer vessel; not enforced by the substrate).
- **`2026-05-31-display-vessel-host-peer`** is the sibling that
  implements the peer vessel; this spec is dispatch-able only after
  the host-peer ships.

## Risk

- **OmniParser license + redistribution posture.** Model weights ship
  inside the peer-vessel binary. Bundling discipline must check
  upstream license at every binary release. Mitigation: tracked in
  `repos/display-vessel/CLAUDE.md` once the repo is created.
- **Capture-method-dependent reliability.** Wayland portals throttle
  capture rate; X11 has none; macOS requires Screen Recording
  permission grant on first capture. Mitigation: capture method
  reported in `displayCapture.capture_method`; selector partitions
  by method when posterior asymmetries emerge.
- **VLM escalation cost.** Falling back to `llm-resolver-vessel` on
  every low-confidence OmniParser frame is unbounded. Mitigation:
  `budget_exhausted.budget_type = "display"` (per
  `display-failure-mode-extensions` Phase C.2) is the half-penalty
  signal the selector reads to throttle dispatch.
- **Detection accuracy on under-represented UI styles** (terminal
  emulators, code editors with custom themes). Mitigation: the
  `display+source_app` partition lets the selector learn
  per-app-class confidence empirically; the
  `verifier_negative.confidence_tier` field carries the low-
  confidence signal explicitly.

## Companion concepts

- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (8-cycle
  probe motivating coarse, bounded-vocabulary signatures over raw
  text).
- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (the
  substrate's existing model of operator attention is inferential;
  this proposal makes it observational).
- `concept_MNYEq7xc_46U` — `architectural_asymmetry` (the substrate's
  current blindness to display state is one of the asymmetries the
  graph-RL framing surfaces).

## Related openspecs

- `2026-05-31-display-control-extension/` — action sibling; gated on
  ≥2 weeks of perception-only soak.
- `2026-05-31-display-vessel-host-peer/` — peer-vessel implementation.
- `2026-05-31-display-signature-partitioning/` — signature-tier
  infrastructure this spec consumes.
- `2026-05-31-display-failure-mode-extensions/` — failure-mode
  vocabulary this spec consumes.
- `2026-05-23-vessel-federation/` — peer-aware discovery infrastructure.
- `2026-04-26-security-hardening-findings/` — H2 (vessel-id from
  pubkey, peer-vessel identity), H3 (scope attestations, consent
  vehicle).

## Graph-RL framing

- **Perception adds a new observation channel to the MDP state.**
  Today's state aggregates from file-system + trace store + concept
  graph; adding display brings the actual user-facing surface into
  the state, closing the perceptual loop that the substrate has been
  approximating from indirect signals.
- **The coarsening tier IS the state-aggregation function for the
  visual channel.** Raw pixels are the underlying observation; the
  `(icon_label_classes, functional_caption_classes)` projection is
  the abstraction layer the selector reasons over. This is the
  standard MDP-design move of choosing a state representation
  coarse enough to learn over and rich enough to discriminate.
- **The denylist on bridge-eligibility is policy-side privacy
  enforcement, not learning-side.** Posteriors still accumulate over
  raw shapes inside the vessel; only the cross-vessel concept graph
  is filtered. Standard separation between local state and shared
  state in distributed RL.
- **Perception precedes action by design.** The two-week soak
  enforces an observational-only window before the action sibling
  ships — the bandit cannot pull arms it has never observed. The
  perception spec is the prior collection phase for what the
  control spec will turn into a control policy.
