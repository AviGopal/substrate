# Lifecycle-audit fix campaign — CLOSED

**Final verdict: all five material failures from the 2026-09-21 audit are
closed at the audit's own verification layer.** A rebuilt image (from the
bumped submodule pointers, commit 254bf8c9) passes the full acceptance
**out-of-box, no overlays** (`no-overlay-acceptance-PASS.log`): fresh-volume
cold boot → execution-trace POST 200 + listed; human surface `/` → 200;
relay workdir present in-image. Recreate-membership gate PASS
(`membership-acceptance-PASS.log`); receipt contract observed live.


Working the five material failures from
`container-lifecycle-audit-2026-09-21/REPORT.md` to completion: solve, validate,
observe in operation. Substrate lanes wherever the change is a vessel asset;
direct operator edits for super-repo build/packaging scripts (outside the
compose lane), each with the audit finding cited in-line.

## 1. Trace persistence on fresh datastores — substrate-landed (in progress)

Diagnosis: `01-trace-persistence-diagnosis.md`. Root cause: 023's reader-less
`v_shape_pattern_performance` view poisons all execution inserts when defined
over an empty store; 055 additionally never parsed at all (whole file dead).

- **Blocking meta-fix LANDED + PUSHED (substrate-authored `1a18944`,
  development-vessel):** byte-exact restoration of the 39 lines commit
  `54b7762` deleted from `surqlBreakingFieldRefusal` — since 09-16 that
  deletion made the gate refuse every non-DEFINE-FIELD statement, wedging ALL
  `.surql` landings. Verified: gate re-run accepts the unmodified corpus files;
  cutover restarted the vessel so the running process is repaired.
- **055 LANDED + PUSHED (substrate-authored `50946be`, activity-api):**
  `v_variant_families` → `REMOVE TABLE IF EXISTS`; file parses on 2.3.3 for the
  first time (its DEFINE FIELDs/INDEXes finally apply); `activity` inserts with
  `variant_of` verified clean on a fresh scratch db. First `.surql` landing
  through the repaired lane.
- **023: staged byte-perfect at dispatch 1 (pre-gate-fix), refuters killed 3
  re-drafts post-fix** (one on an operator over-strict goal, one on a
  philosophical lens-1 refutation — noted as refuter-calibration signal in the
  oracle labels). Now re-running vessel_mitosis_evaluate + cutover on the
  original perfect staging `mitosis-2026-09-22T08-11-13-777Z`.
- **Collateral instance repaired + gap filed:** the refused 08:14 staging for
  055 live-synced and was never rolled back, leaving the live 055 truncated
  (poisoned-baseline refusals on the next dispatch). Restored from the pristine
  push clone. Gap: `a-refused-surql-cutover-left-its-live-sync-in-the-live-tree`
  (dev-vessel picked it up autonomously within the hour — an fc-plan editing
  patch-with-tools.ts was observed at 08:32).
- **Gaps filed for the classes:**
  `a-substrate-authored-deletion-wedged-the-surql-landing-gate-and-nothing-detected-it`,
  `cold-boot-silently-skips-twenty-two-unparseable-migration-files`
  (sweep evidence: `sql-sweep-2026-09-22.txt` — ~22 files HTTP-400 wholesale,
  incl. both 021 variants ⇒ `v_activity_score` exists on no deployment).
- Acceptance: `fresh-boot-trace-acceptance.sh` (fresh volumes, audit CORE
  roster, fixed schemas overlaid, POST + list execution-traces).

## 2. Human UI packaging — operator edits (super-repo build assets)

- `Dockerfile.substrate`: bake git-tracked `ui/dist` into
  `/vessels/human-surface-vessel/ui/dist` (server resolves `<workdir>/ui/dist`;
  absent → 503 `ui_not_built` on every fresh image).
- `scripts/substrate/vessel-ctl.sh`: install now REFUSES (ok:false, exit 1)
  when the manifest workdir is absent instead of replacing a working vendor
  unit with one that dies 200/CHDIR; post_install exit status surfaced as
  `post_install: ok|failed|none` instead of being swallowed.

## 3. Human-feedback receipts — mostly already fixed at HEAD; one hole dispatched

Recon: the audited resolver was the replaced surface (stateful-ui-vessel at an
old submodule pin). Current `human-surface-vessel` already 409s stale
revisions, 409s unknown asks on held panels, is idempotent when `response_id`
is supplied, and serves `uiQuestion`. Remaining live hole: shaped-route
`uiFeedback` with `response_id` omitted mints a fresh receipt per repeat —
fix dispatched as a goal (require `response_id`; browser always sends one).
stateful-ui-vessel is deliberately not repaired: it is the replaced vessel
(see the 248-unanswered-escalations gap from 09-22).

## 4. Durable dynamic membership — operator edits

- `vessel-ctl.sh`: install/uninstall now maintain volume-backed
  `/workspace/substrate/fleet/installed.json` (`record_installed` /
  `unrecord_installed`).
- `entrypoint.sh`: on every boot, re-installs recorded members whose unit file
  is missing (idempotent; DISABLED_VESSELS outranks; offline wants-symlink same
  as the federation auto-enable). Record/skip/restore logic unit-tested in a
  sandbox.

## 5. Relay bring-up — operator edits

- `vessels.manifest.json`: `federation-relay` workdir repointed to the baked
  image path (`/usr/local/share/substrate/super-repo/scripts/substrate/federation-relay`),
  same precedent + rationale as `federation-transport-vessel`; the audit's
  hand-repoint is now the shipped default. Baked path verified present with
  materialized deps in the current image.
- `spoke-federate.sh`: join verdict now gates on
  `transport.activeReservations >= 1` from `/health` instead of "the socket
  answered" — a 200/ok with zero reservations exits 1 with an explicit
  not-remotely-visible message (the audit's case6 false-healthy state).

## Acceptance results (2026-09-22)

- **Task 1 gate PASSED** (`trace-acceptance-PASS.log`): isolated fresh-volume
  cold boot (audit CORE roster, fixture creds, no host mounts), landed schema
  fixes overlaid over the baked copies →
  `POST /v2/activities/execution-traces` **200 stored:true** and the listing
  returns the trace. The audit's `trace-store-errors.json` /
  empty-`dispatch-durable-traces.json` gate is green. En route this run also
  surfaced and fixed a THIRD insert-poisoning view
  (045 `v_shape_execution_src`, `array::len(NONE)` on the auth-telemetry
  writes activity-api emits about itself) — landed as `41c9e89`.
- **Tasks 4 + 2(install) gate PASSED** (`membership-acceptance-PASS.log`):
  absent-workdir install refuses ok:false and writes no unit; baked-workdir
  install records into volume-backed installed.json; after `docker rm` +
  recreate on the same volumes the boot reconcile **restores the unit** (the
  audit's exact FAIL row); uninstall clears the record.
- **Task 3 observed live**: the running human surface now answers `/` → 200,
  400s a shaped uiFeedback without response_id, and returns a byte-identical
  receipt (same receivedAt) on an identical repeat.
- **Task 5**: relay workdir now the baked image path (verified present with
  materialized deps in the current image); spoke-federate join verdict gates on
  activeReservations ≥ 1. **Not exercised:** the reservation gate was validated
  against the live transport's real /health payload shape and syntax-checked,
  but has not been driven through an actual spoke join — real WAN/NAT joins
  are in the audit's own remaining-acceptance list. The audit's material
  failure here was the install path, which the post-rebuild out-of-box check
  covers.
- **Known conflation (gap-worthy, non-blocking):** the federation auto-enable
  path calls `vessel-ctl install`, which now records into installed.json — a
  spoke that later drops HUB_DISCOVERY_URL keeps getting the transport
  reinstalled by the boot reconcile until uninstalled or DISABLED. Auto-enabled
  and operator-installed membership are not yet distinguished.
- Also repaired live: the container super-repo checkout had 12 stranded
  unpushed autonomous commits (one with an unparseable store.ts — a
  crash-loop trap for the human surface) wedging pull-sync for 16h; preserved
  on branch `stranded-autonomous-2026-09-22`, reset to origin/dev, vault state
  kept, vessel restarted onto current code. Gap filed.
- Image rebuild with all fixes queued so future fresh boots need no overlays.

Gaps filed this campaign (all `human_reported`):
`a-substrate-authored-deletion-wedged-the-surql-landing-gate-and-nothing-detected-it`,
`cold-boot-silently-skips-twenty-two-unparseable-migration-files`,
`a-refused-surql-cutover-left-its-live-sync-in-the-live-tree`,
`the-pwt-semantic-refuters-confabulate-dialect-semantics-and-block-correct-surql-patches`,
`the-live-human-surface-is-unreachable-by-every-substrate-edit-lane`,
`stranded-local-autonomous-commits-wedged-super-repo-pull-convergence-invisibly`.
