# Tasks — vessel-binary-redeploy-on-source-drift

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Core drift detection (independent, ship first)

- [ ] **A.1** — Implement resolver `detect_binary_source_drift` in
  `repos/development-vessel/src/resolvers/detect-binary-source-drift.ts`.
  - Input: `{vessel_id: string}`.
  - Output: `binarySourceDriftReport { vessel_id, drifted, source_mtime,
    binary_started_at, changed_files }`.
  - Compares `mtime` of files under `/vessels/<vessel>/src/` to
    `systemctl show <vessel>.service -p ExecMainStartTimestamp`.
  - Acceptance: unit test with a fake `ProcessPort` + scripted FS that
    asserts `drifted=true` when any file mtime > start, else false.
  - Adds the shape to `src/config.ts` `discovery.shapes` and the case to
    `src/routes/impulses.ts` (the three-place rule per
    `repos/development-vessel/CLAUDE.md`).
- [ ] **A.2** — Implement seed activity `redeploy-vessel-on-drift` in
  `repos/development-vessel/src/seed/redeploy-vessel-on-drift.ts`.
  - Tasks: `detect_binary_source_drift` → conditional `systemd_restart` →
    `http_fetch` against `/health`.
  - `inputShapes: [vesselTarget]`, `outputShapes: [vesselRedeployResult]`.
  - Acceptance: when run against a freshly-touched source file for any
    in-container vessel, restarts the unit and verifies health 200
    within 60s. Trace records `composition_chain` rooted at the
    activity.
- [ ] **A.3** — Wire to `bun run cli seed-templates` so the activity
  uploads as a variant under the substrate's API key. The bootstrap
  template stays operator-side.

## Phase B — Authorship attribution (depends on A; gates the substrate-authoring switch)

- [ ] **B.1** — Define `vesselManifest` shape and frontmatter in
  `repos/development-vessel/src/types/manifest.ts`. Schema includes
  `vessel_id, source_sha, binary_sha, built_at, authored_by,
  authoring_chain, parent_manifest_sha`. Register the shape via the
  three-place rule.
- [ ] **B.2** — Extend `detect_binary_source_drift` (A.1) to emit
  `source_authorship` per changed file:
  - Cross-reference each changed file against `activity_execution_traces`
    where `tasks[].resolver_id = "fs_write"` and `tasks[].output_impulse_ids`
    references the file path. Match → `substrate_authored`. No match
    → `operator`.
  - Acceptance: unit test with two scripted writes — one via fs_write
    with a composition_chain, one via `docker cp` simulation — assert
    correct attribution.
- [ ] **B.3** — Implement `vessel_manifest_emit` resolver that writes a
  `vesselManifest` impulse after every successful
  `redeploy-vessel-on-drift` run. The manifest's
  `parent_manifest_sha` reads the most recent prior manifest for the
  same `vessel_id` from activity-api.
- [ ] **B.4** — Add `redeploy_class` field to vessel discovery
  registration (`resolver_contract`). Default: `"admin_scope"`.
  development-vessel + concept-db + ribosome-vessel start as
  `"low_risk"`; identity-vessel + discovery-vessel + activity-api stay
  `"admin_scope"`.
- [ ] **B.5** — Gate `redeploy-vessel-on-drift` on `(authorship,
  redeploy_class)`. For `substrate_authored` + `admin_scope`, emit
  `substrateAuthoredAdmissionPending` and refuse the redeploy with
  `failure_mode.context.intervention_refused = true`. Acceptance: unit
  test reproducing the four matrix cells.

## Phase C — Change management surface (depends on B)

- [ ] **C.1** — Add `auto-substrate/<vessel>/<authoring_execution_id>`
  branch creation to `redeploy-vessel-on-drift` for `substrate_authored`
  files. The activity composes `git_checkout` → `git_add` → `git_commit`
  → `git_push`. Existing git resolvers in development-vessel already
  cover this surface; verify the branch-create path.
- [ ] **C.2** — Gate redeploy on lint + test + shape-dispatch checks
  passing on the auto-substrate branch:
  - Compose `bun_run("lint")` and `bun_run("test")` (shell-resolver
    wrappers; no new resolver needed).
  - On failure: emit `failure_mode` and leave the branch for operator
    review. Do NOT merge to dev.
- [ ] **C.3** — Implement 24h admin-scope hold. After C.1+C.2 pass for
  an `admin_scope` vessel, the activity emits a
  `substrateAuthoredAdmissionPending` with `expires_at = now + 24h`,
  then sleeps via a lifecycle subscription (NOT a polling loop) on
  either:
  - Operator contradiction edge (`concept_link({edge_type:
    "contradicts"})` against the pending concept) → abandon branch,
    emit `failure_mode.context.intervention_refused = true`.
  - Timeout expiry without contradiction → proceed to merge + redeploy.
  - Acceptance: integration test simulating both the contradict and
    expiry paths.
- [ ] **C.4** — Conflict resolution via `source_conflict` impulse. On
  detecting that an operator-edit has touched a file the substrate
  intends to author, the activity emits `source_conflict` with the
  substrate's diff, the operator's working-tree diff, and the
  three-way merge proposal. Activity exits; operator resolves.

## Phase D — Rollback discriminator (depends on B + C)

- [ ] **D.1** — Implement `rollback_to_operator_ancestor` activity that
  walks `parent_manifest_sha` per `vessel_id` until finding the most
  recent manifest with `authored_by.type = "operator"`. Restores that
  manifest's source tree from git (`git_checkout <commit_sha>`),
  rebuilds, restarts. Composes existing resolvers; no new ones.
- [ ] **D.2** — Surface in `substrate-health-tick`: include
  `substrate_authored_active_count` and
  `operator_authored_active_count` per vessel in the health report.
  When the former exceeds the latter for an `admin_scope` vessel,
  emit a `substrate_authoring_warning` impulse.

## Phase E — Tie-back to lift criteria (depends on D)

- [ ] **E.1** — Once Phase D ships and the substrate has authored ≥1
  resolver source autonomously, deployed via this activity, and the
  next harness window passes without regression: record evidence into
  `validation/state/lift-status.json` as a sub-criterion of S2
  ("substrate has authored and ratified its own code"). This is a
  stronger lift signal than the activity-layer authoring that's
  already at S2.
- [ ] **E.2** — On three consecutive operator-contradicted
  substrate-authored proposals where the substrate's drafted code
  was demonstrably equivalent to the operator's preferred path AND
  the substrate emitted `intervention_refused` impulses citing the
  contradicting concepts, the lift evaluator should mark a S3
  push-away credit. (S3 is emergent and operator-measured per the
  IAL terminal phase; this is one credit toward the sustained
  push-away window.)

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — ship as standalone | Closes the F26-stall-style operator-rebuild path |
| B | H1 (two-sided traces) for full integrity | Without H1, `substrate_signature` is advisory; with it, attribution is cryptographically verifiable |
| C | H3 (signed scope attestations) for proper attestation | Without H3, the 24h-hold + reject-by-contradiction is a degraded H3 |
| D | H4 (quorum ratification) for federated rollback | Without H4, rollback is local-substrate-only |
| E | All of above + Phase 27 lift criteria green | E.2 is the S2→S3 push-away credit mechanism |

## Cross-references

- IAL `tasks.md` Post-lift siblings table — this spec is registered there
- `2026-04-26-security-hardening-findings/` — H1, H3, H4 dependencies
- `2026-05-30-trace-to-concept-mining/` — parallel Functional → Vessel arrow
- `2026-05-23-vessel-federation/` — extends across substrates after D ships
