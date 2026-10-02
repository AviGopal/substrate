# Vessel-binary redeploy on source drift

## Why

The substrate's Functional → Vessel (instructional) loop is closed for **activity
templates** (ribosome-vessel promotes successful executions) and for **concepts**
(concept-bridge-observer accumulates from analysis-vessel resolutions). But it is
**open for vessel binary code**. When operator commits update a vessel's source
inside the substrate container, the running binary keeps serving the previous
build until something restarts the systemd unit. There is no activity in the
substrate's registry that detects "running binary is stale vs source on disk"
and triggers a rebuild + restart.

This proposal closes that gap. Without it, the substrate cannot meet the S2 → S3
criterion ("active push-away with cited evidence") for vessel-code drift —
operator restarts remain load-bearing.

## Empirical motivation (2026-05-30 13:30 PDT)

- F26 (concept-db comma-separated `source_type`) committed to repo (concept-db
  `a262475`, super-repo `a9abc101`) and operator-edited into the container's
  source tree at `/vessels/concept-db/src/routes/concepts.ts`.
- Container's running concept-db binary is still v0.3.0 with the pre-F26 route
  handler. Probe: `GET http://localhost:18260/concepts/search?source_type=memo,impulse_signature`
  returns Zod enum validation error.
- Substrate memory (concept `concept_HKlz4FAc2cpf`, `substrate_self_fix_pattern`)
  records "Awaiting substrate-restart for activation." The instructional layer
  knows. No transient/functional layer acts.
- Dispatching `run_goal` "rebuild and restart concept-db so F26 goes live"
  selected `gap-closing:test-valid-1780148026306` via Thompson — a generic
  gap-closing template, no actual restart. 1.2s, completed.

This is the operational evidence that **the substrate cannot fix vessel-binary
drift on its own today**.

## What changes

Add to `development-vessel`:

1. **Resolver `detect_binary_source_drift`** — given a vessel id, compares the
   mtime / git rev of `/vessels/<vessel>/src/` to a hash of the loaded binary
   (or the systemd unit's `ExecMainStartTimestamp`). Emits
   `binarySourceDriftReport { vessel_id, drifted: boolean, source_mtime,
   binary_started_at, reason }`.

2. **Activity `redeploy-vessel-on-drift`** — composes:
   - `detect_binary_source_drift` against a target vessel
   - if `drifted: true`: `systemd_restart` (already exists) against the unit
   - verifies post-restart health via `http_fetch` GET on the vessel's `/health`
   - on success: emits `vesselRedeployResult { vessel_id, restarted_at, health_ok }`
   - on failure: emits `failure_mode { type: "verifier_negative", ... }` so the
     selection layer learns

3. **Lifecycle observer** — subscribes to a yet-unmodeled
   `vesselSourceChange` event (emitted when ribosome/operator/dev-loop modifies
   a `/vessels/*/src/` tree). Triggers `redeploy-vessel-on-drift` for the
   affected vessel id. Until the source-change event ships, the activity is
   dispatchable via boredom-vessel rotation or operator goal.

## Out of scope

- The `vesselSourceChange` event itself. Stub it as a TODO; today the activity
  runs by manual / boredom dispatch.
- Build-step changes inside the container. Concept-db is a Bun project that
  loads `src/*.ts` directly via `bun run start`; restart is sufficient. For
  vessels needing a build step, a separate `build_vessel` resolver gets a
  follow-up change.
- Source-of-truth resolution between container `/vessels/*/src/` and host
  super-repo `repos/*`. Today operators copy via `docker exec` or volume
  mount; the activity's responsibility starts at "the source on disk is the
  source of truth," not "the host repo is the source of truth."

## How this validates

After the activity ships:

1. Operator commits + edits container source (the F26 pattern repeats).
2. Next boredom tick or substrate-health observation triggers
   `redeploy-vessel-on-drift` for concept-db.
3. F26 query returns 200 with non-empty concepts on the *next* drafter run,
   without operator intervention.
4. The `substrate_self_fix_pattern` concept gets a sibling concept
   `substrate_self_fix_observed { vessel_id, completed_at, evidence_trace_id }`
   linked via `derived_from`. That sibling is the substrate citing its own
   self-fix — the citation S2 → S3 requires.

## Dependencies

- `systemd_restart` resolver — exists (`scripts/substrate/units/`,
  development-vessel resolvers per memory `percolation_2026_05_23_substrate_live`).
- `failure_mode` shape — exists (migration 091).
- Lifecycle event bus — partial; observer subscription mechanism exists
  (`ribosome-vessel`, `concept-bridge-observer`).

## Risk

- Auto-restart can mask bugs that should surface as failed traces. Mitigation:
  the activity only fires when `binarySourceDriftReport.drifted: true` AND the
  binary started before the source mtime — never on a fresh container.
- Cascading restarts if multiple vessels drift simultaneously. Mitigation:
  process one vessel per tick; emit `vesselRedeployResult` and let the next
  tick pick up the next drifted vessel.
- Restart loop if the rebuilt binary is itself broken. Mitigation: the post-
  restart health check is a verifier; failure emits `failure_mode` and
  Thompson β-updates the activity, slowing dispatch.

## Authorship attribution (2026-05-30 extension)

The original proposal stops at "restart on source drift" — it assumes the
source change is operator-authored. But once the activity ships, the
substrate itself can write source files via `fs_write` (the `scaffold-new-vessel`
seed template already emits sources). Without authorship attribution, a
substrate-authored vessel binary becomes indistinguishable from an
operator-authored one at the moment it starts serving requests — no
signed provenance, no governance hook, no rollback discriminator.

This section extends the activity with attribution so substrate-authoring
becomes governable rather than implicit.

### Manifest

Every rebuild emits a `vesselManifest` impulse alongside `vesselRedeployResult`:

```typescript
vesselManifest = {
  vessel_id: string,
  source_sha: string,           // sha256-16 of canonical-JSON-sorted source tree
  binary_sha: string,           // sha256-16 of the started binary (or main module hash for Bun source-runtime)
  built_at: ISO8601,
  authored_by: {
    type: "operator" | "substrate_authored" | "hybrid",
    operator_signature?: string,     // git commit sha + signing key if operator
    substrate_signature?: string,    // execution_id of the authoring chain + chain root signature
    hybrid_breakdown?: { operator_paths: string[], substrate_paths: string[] }
  },
  authoring_chain: string[],    // composition_chain that produced the source (empty for operator-authored)
  parent_manifest_sha?: string  // sha256 of the previous vesselManifest for this vessel (linked list)
}
```

### Detection

The drift detector (resolver `detect_binary_source_drift`) emits
`source_authorship` alongside the existing drift fields:

- For each changed file in `/vessels/<vessel>/src/`, walk back through
  filesystem mtime + `composition_chain` of the most recent
  `vesselRedeployResult` to attribute. Source files written by an
  `fs_write` impulse whose `composition_chain` is non-empty are
  `substrate_authored`.
- Operator-authored is the default for files that arrived via
  `docker cp` or have no traceable `fs_write` provenance.

### Gating on attribution

The `redeploy-vessel-on-drift` activity gates differently per authorship class:

1. **`operator` authored:** redeploy after standard `detect_binary_source_drift`
   green. Operator presence is the ratification. This is today's behavior.
2. **`substrate_authored` for a vessel whose `redeploy_class = "low_risk"`**
   (advertised in `discovery-vessel` registration as part of resolver contract):
   redeploy normally. Substrate write-scope is sufficient.
3. **`substrate_authored` for a vessel whose `redeploy_class = "admin_scope"`**
   (identity-vessel, discovery-vessel, activity-api): refuse with
   `failure_mode.context.intervention_refused = true` AND emit a
   `substrateAuthoredAdmissionPending` impulse for operator review.
   `redeploy_class` defaults to `"admin_scope"` for any vessel that
   declares an admin-scope shape; explicit downgrade requires operator
   amendment of the discovery registration.
4. **`hybrid`** (some files operator, some substrate): treat as
   `substrate_authored` for the most restrictive vessel's
   `redeploy_class`.

### Rollback discriminator

`vesselManifest`'s `parent_manifest_sha` makes the deploy history a hash-
chained linked list per vessel. Rollback target = the most recent manifest
where `authored_by.type = "operator"`. The substrate can roll back its own
authored binaries by walking the chain until it finds an
operator-ratified ancestor.

## Change management (2026-05-30 extension)

If the substrate writes source files autonomously, four questions need
answers up front: where source lands, how conflicts resolve, how the
activity-layer review and code-layer review separate, and what the
operator's intervention surface looks like.

### Branching strategy

Substrate-authored source writes do NOT land directly on `dev`. The
`redeploy-vessel-on-drift` activity, on detecting `substrate_authored`
files, first writes them to a branch named
`auto-substrate/<vessel>/<authoring_execution_id>` and only deploys after:

- Lint passes (`bun run lint` per `repos/<vessel>/CLAUDE.md` discipline)
- Unit tests pass (`bun test`)
- Shape-dispatch agreement check passes (the
  `packages/shape-dispatch-check/` invariant from
  `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` §"Invariant 2")
- Health probe on the newly-deployed binary returns 200 within 60s
- Operator has not opened a `substrateAuthoredAdmissionPending`
  block within the 24h review window for vessels in
  `redeploy_class = "admin_scope"`

If all gates pass and no block is open, the activity merges the branch to
`dev` with an attribution-bearing commit message; if a gate fails, the
branch stays and the activity emits `failure_mode` carrying the gate's
verdict.

### Conflict resolution

If the substrate authors a source file while the operator is also editing
it, the activity refuses to overwrite a file whose `mtime` is younger than
the substrate's read snapshot. The conflict is reported as a
`source_conflict` impulse with:

- The substrate's intended diff
- The operator's working-tree diff (read via `git diff`)
- A proposal to apply the substrate's diff onto the operator's branch via
  three-way merge

Resolution belongs to the operator. The substrate does not auto-resolve.

### Activity-layer vs code-layer review separation

This is the load-bearing distinction. **Activity-layer authoring is already
substrate-autonomous and works.** Substrate-authored activity templates
have Thompson β as their automatic rollback — bad variants accrue β and
stop being picked. Code-layer authoring (resolvers) has no equivalent —
a substrate-authored resolver that silently no-ops accrues α (the
"phantom success" pattern the substrate just detected via
`detect-phantom-success-trace`).

The change-management surface must therefore distinguish:

- **Activity variants** authored by substrate: ship without review;
  Thompson handles rollback. This is the existing path.
- **Resolver source** authored by substrate: ship via `auto-substrate/…`
  branch after lint/test/shape-dispatch + 24h hold for admin-scope
  vessels. New path introduced by this extension.

### Operator intervention surface

The operator interacts with substrate-authored code through three
impulse classes the activity emits:

- `substrateAuthoredAdmissionPending` — admin-scope vessels awaiting
  the 24h review window. Operator can `concept_link({edge_type:
  "contradicts"})` against the proposed manifest to reject; the
  activity reads the contradiction and abandons the branch.
- `sourceConflict` — operator-edit overlap. Operator resolves the
  three-way merge; no autonomous resolution.
- `vesselManifest` — operator can audit attribution history at any
  time by walking `parent_manifest_sha` per vessel.

This forms the push-away surface. The substrate can author code AND
the operator can refuse code AND every refusal cites the manifest +
authoring chain that triggered it. That is S2→S3-shaped governance for
the code layer.

## Companion concepts

- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (motivated original proposal)
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (8-cycle finding)
- `concept_-sJSiv_RUjMM` — `substrate_self_learning_gap_traces_to_concepts`

## Related openspecs

- `2026-05-30-trace-to-concept-mining/` — the parallel learning-from-traces
  gap. Both proposals address the Functional → Vessel arrow of the
  three-states model.
- `2026-05-23-vessel-federation/` (Draft) — extends the trust boundary
  across substrates. Substrate-authored binaries that ship across
  federated boundaries need this extension's attribution + the
  federation spec's H2 + H4 to be safely ratified.
- `2026-04-26-security-hardening-findings/` — H1 (two-sided traces),
  H2 (pubkey-derived vessel-id), H3 (signed scope attestations),
  H4 (quorum ratification). The extension above relies on H1
  (`substrate_signature` is meaningful only when traces are
  counterparty-signed) and H3 (the 24h-hold + reject-by-contradiction
  is a degraded H3 until proper scope attestations ship).
