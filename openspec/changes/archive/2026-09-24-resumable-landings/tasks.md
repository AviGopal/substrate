## 1. Parked landings (development-vessel)

End-to-end, observed live on 2026-09-24: `16:58:34 cutover did not land — verified patch
parked for route-edit-5d6e8e96` (held lease) → `16:58:51 RESUMING parked landing for
route-edit-5d6e8e96 (parked 0m ago)` → pushed as development-vessel `c1dd4c2` at 17:00:50, no
redraft; `17:07:48` gap-to-feature picked a parked gap and the compose resumed it.

- [x] 1.1 `feature-compose.ts`: write `/workspace/parked-landings/<gap>.json` after the semantic
  gate passes and before `resolveVesselMitosisCutover`; delete it on `push_status: pushed`;
  set `parked: true` in the report otherwise. Falsifier: hold the lease by hand for 3 min
  during a byte-exact compose; the park file exists with the diff; release; the next pick
  resumes and pushes an identical diff. Control: a normal landing leaves no park.
  Landed as development-vessel `873fd81`; the landed file equals the pre-validated edit set
  (0 differing lines), typecheck passed, runtime equals the commit. The first attempt passed
  every gate and was then refused at cutover for a held lease and discarded — the loss this
  task removes; a second broke a string literal while copying. Live half of the falsifier
  (a refused cutover leaves a park file) pending the next refused cutover.
- [x] 1.2 `gap-to-feature.ts`: in the pick, if a park younger than `parked_landing_ttl` exists
  for the gap, dispatch `feature_compose` with `resume_from`. Falsifier: journal shows
  `RESUMING parked landing` and no drafter call for that compose.
  Landed as development-vessel `c1dd4c2` (parent = the base the goal was built on; landed file
  identical to the pre-validated edit set; runtime equals the commit). Note 1.3's compose also
  reads a park by gap id on entry, so a directed dispatch resumes a park without passing
  through the pick.
- [x] 1.3 `feature-compose.ts`: `resume_from` path — re-apply, typecheck only, cutover; `park_stale`
  lesson when the diff does not apply. Falsifier: move the base under a park (land an
  unrelated change to the same file); the park is dropped with the lesson.
  Landed as development-vessel `6ab8271`; the landed file equals the pre-validated edit set
  except one line: the cutover committed a whole file staged before `a0ff3d3` and reverted
  that commit's one-line fix (anchor-band reader). Restore dispatched; the class is filed as a
  gap (a cutover overwrites a newer committed landing on the same file). Restored as
  `7994841` (exactly that line; no other commit to the file in between).
  Live: resumes at 16:58 (route-edit-5d6e8e96 -> c1dd4c2) and 17:07 pushed under their own
  labels. Open (gap filed): at 20:51 a resume's cutover answered `noop: already_applied`
  (freshness saw live e236d8dd vs the resume's staged sha 1e4380ab, 17 s after the resume
  wrote live); the resume reported "did not land", kept an orphaned park, and the same content
  was committed two minutes later by another staging (0a8de60).
- [x] 1.4 `index.ts` SIGTERM handler: park post-gate composes; do not wait for pre-gate ones.
  Falsifier: restart during `bun test` → prompt drain, no park; restart after gate → park.
  Landed with 2.1b as development-vessel `b789d9c`, identical to the pre-validated edit set;
  runtime equals the commit. Live: the first process on it logged `drained (0 cutovers in
  progress; 0 request(s) and 0 authoring run(s) in draft/verify are parked or re-picked, not
  waited for)` at 16:48:22Z (the trivial case; a SIGTERM with work in flight not yet observed),
  where the process before it logged "1 long-running request(s) still in flight; they will be
  lost".
- [x] 1.5 Detector: `discardedLandingReport` sweep and the day-keyed gap. Falsifier: one
  refused landing → count 1 and the gap open; a clean hour → no gap.
  Landed as development-vessel `49b6b1c`, identical to the pre-validated edit set. Live: the
  first scans logged `discarded landings: total=2 {"lease_refused":2,...}`, wrote
  `discardedLandingReport` to the pool and opened `discarded-landings-2026-09-24`; both counted
  reports are judge-approved patches refused for a held lease. Follow-up: it counts a patch that
  was parked and then resumed (route-edit-5d6e8e96) as discarded — exclude gaps whose park was
  resumed and pushed.

## 2. Restart budgets

- [x] 2.1a `index.ts`: `/health` gains `in_flight_oldest_ms`. Landed by the substrate as
  development-vessel `883640f`; runtime equals the commit, the process restarted after it, and
  `/health` reads `null` idle and a growing age (16688 → 40346 ms over 30 s) with two in flight.
- [x] 2.1b `index.ts`: drain deadline = cutover stage + 60 s — dispatched together with 1.4 (same
  file, same loop; see `goals/1.4-drain-waits-for-cutovers.txt`).
- [x] 2.2 (operator tier) `scripts/substrate/substrate-pull-sync.sh`: defer by
  `in_flight_oldest_ms` vs `COMPOSE_CEILING_MS`; unit `TimeoutStopSec` ≥ drain. Falsifier:
  three busy runs with young work → no restart; oldest > ceiling → restart with age in the
  breadcrumb. Status: both pull-sync restart sites now decide through one `restart_age_defer`
  helper (installed in the container); stubbed scenarios pass; `TimeoutStopSec` is 5 min ≥ the
  240 s drain. The live falsifier waits on 2.1 — until `/health` publishes `in_flight_oldest_ms`
  the helper falls back to the old count bound.
  Live since 2.1a: at 15:24:19Z pull-sync logged `DEFERRING restart — 3 in flight, oldest
  59735ms < ceiling 900000ms`. Open: at 16:44:20Z it restarted development-vessel with "4 in
  flight ... no in_flight_oldest_ms published" although the field is published; 60 later
  samples never showed in_flight > 0 with a null age, so the cause is not yet reproduced.
  Live falsifier (young work → no restart): 17:45–20:17Z, nine consecutive deferrals of one
  owed development-vessel restart, each "oldest <N>ms < ceiling 900000ms" (5 s to 262 s),
  then "drained to 0 in 80s under quiesce — converging with NOTHING in flight". The stuck-work
  half (oldest > ceiling → restart with the age in the breadcrumb) is covered by the stubbed
  scenarios only. Trade-off observed: a lane that is never idle held development-vessel on
  pre-revert code for ~2.5 h; the old 3-deferral bound would have restarted into live work.

## 3. Named change windows

- [x] 3.1 `maintenance-lease.ts`: `name` on acquire/renew/release/resolve; per-name files;
  union semantics. Falsifier: unit — two names coexist; unnamed excludes all.
  - [x] 3.1a-i acquire + read. Landed by the substrate as development-vessel `ace49c0` (earlier
    drafts anchored on `const existing = await readLease();`, which occurs three times; the
    landing goal quoted unique multi-line anchors). Runtime equals the commit; falsifier passed
    against the landed file: two names coexist in separate files, same name refused to another
    holder, named acquire refused during an unnamed hold, named read sees the global hold.
  - [x] 3.1a-ii renew + release honour `name`. Landed as development-vessel `e17ea38`; runtime
    equals the commit; falsifier passed: named renew moves only the named file's expiry, named
    release deletes only its own file, unnamed release unchanged.
  - [x] 3.1c named lease files follow the lease file's own stem (`<stem>-<name>.json`), so a
    test's MAINTENANCE_LEASE_PATH in the shared /tmp no longer leaks a cutover hold into every
    other test (it made each compose's gate charge 16-24 lease-test failures to unrelated
    drafts). Landed as `80e168f`; identical to the pre-validated file; the real lease test with
    a decoy hold goes 2/12 on the old code to 14/0 on the landed code.
  - [x] 3.1b unnamed acquire refused while any named hold exists; union read with `holds[]`;
    unnamed release finds a named hold by token. Landed as development-vessel `4e40707`; the
    landed file equals the version whose falsifier was run before dispatch (unnamed acquire
    refused by a named hold, unnamed read lists it, unnamed release deletes it, empty-store
    behaviour unchanged). Two earlier drafts were refused by gate defects, not by the patch:
    the stub detector read `? {}` after a call as an empty function body, and the test gate
    charged three failures that also fail on the unmodified base.
- [x] 3.2 `vessel-mitosis-cutover.ts`: acquire with name `cutover` (both the soft-refuse check
  and the 90 s wait). Falsifier: cutover pushes while `trace_store` is held.
  Landed as development-vessel `0b06246`: all eight lease calls in the file (acquire, bounded
  retry, git-aware acquire, proposal acquire and all four releases) carry `name: "cutover"`;
  runtime equals the commit and the process restarted after it. The live half of the
  falsifier (a push while `trace_store` is held) was observed on 09-25: 2992a23 pushed at 00:07:41
  during a trace_store hold (see 3.3).
- [x] 3.2b `vessel-mitosis-cutover.ts`: the early "change_window lease held — defer without
  rollback" check reads the lease with no name, which since 3.1b means the union of all holds,
  so a reconcile `trace_store` hold or another cutover's hold refuses every cutover again.
  Read with name `cutover` (`goals/3.2b-early-lease-check-reads-cutover-name.txt`).
  Landed as `9ee5d9d`; the landed file equals its parent plus exactly this one edit.
- [x] 3.3 Reconcile: name `trace_store`, failure-path release, fetch timeout ≥ valve. Measured
  facts that shape the path: the registered base template has no `timeoutMs` on its reconcile
  task (15 s `http_fetch` default) although the seed source carries 900 s — the seeder is
  SEED-IF-EMPTY (`cli.ts`) and never upserts a changed body; paging `/templates` is unstably
  ordered (2771 rows, 2719 unique ids) so the family sampler never draws the
  `…-swap-timeout-15min` variant; and the executor has no failure-path task semantics
  (`ias-executor-ts/src/engine.ts` throws out of the task loop), so no template ordering can
  release on a reconcile failure.
  - [x] 3.3a-i acquire and release named `trace_store` — development-vessel `a2f7542`, identical to
    the pre-validated file; inert in the catalogue until 3.3b + 3.3a-ii (seed_version bump).
  - [x] 3.3a-ii release_lease before verify + `metadata.seed_version: 2` — development-vessel
    `5475e11`, identical to the pre-validated file (its first cutover was refused by a
    now-reverted drift check; the park then went stale and it redrafted).
  - [x] 3.3a `src/seed/trace-store-reconcile.ts` (split: 3.3a-i names acquire and release
    `trace_store`; 3.3a-ii moves `verify` after `release_lease`): acquire and release with `name: "trace_store"`,
    reconcile `timeoutMs` ≥ the valve, `release_lease` marked to run on failure (3.3c).
  - [x] 3.3b The seeder upserts a seed whose `metadata.seed_version` exceeds the registered
    row's (explicit opt-in; unversioned seeds and evolved rows untouched), POSTing by id
    straight to activity-api because the reuse-before-mint probe refuses a second producer of
    the reconcile's shapes. Landed as `c6213f1`, identical to the pre-validated edit set; live
    proof waits on 3.3a-ii (the version bump) and a seed-unit run.
  - [x] 3.3b-fix sanitise seed tags before the direct upsert (activity-api's TagSchema refused
    "db.maintenance.trace-store" with HTTP 400) — development-vessel `0a8de60` (identical to the
    pre-validated edit; it landed after a lease refusal, park, resume). Live: restarting
    development-vessel-seed logged `[seed] upserted development-vessel:trace-store-reconcile:
    seed_version 0 -> 2`; the registered template now has seed_version 2, order acquire >
    extract > reconcile > release_lease > verify, both lease calls named trace_store, reconcile
    timeoutMs 900000 (before: unnamed, verify before release, no timeout); a second seed run
    reports "1 already current".
  - [x] 3.3c — moved out of this change (follow-up). The spec's release-on-failure scenarios are
    met without it: "verify fails → release still runs" by 3.3a-ii's order (release_lease
    before verify), "valve slower than the fetch" by the 900 s timeout; a failure of the
    reconcile task itself now leaks only the `trace_store` name, which no longer blocks cutovers
    (3.2 + 3.2b). An `always: true` task in the executor would be a new capability for every
    template and a shared-package landing that restarts all consumers — its own change.
  Live run on the upserted template (21:15:27Z, base template sampled): completion shapes
  maintenanceLeaseWriteResult, json_extracted_value, httpResponse, traceStoreHealthReport — the
  reconcile fetch returned (no "The operation was aborted"), release_lease ran before verify, the
  maintenance-trace_store.json hold was released (file gone at 21:15:28) and the unnamed
  maintenance.json was not taken (still the expired 20:37 hold). The run was graded HOLLOW
  because the valve deleted no rows and verify still saw over_cap — pruning behaviour is a
  stated non-goal of this change.
  Variants: the family sampler also drew three registered variants (…-swap-timeout-15min,
  …-release-before-verify, …-lease-ttl-120s) that still took the unnamed lease — 5 of 16 draws
  by 23:58Z, and one held maintenance.json at 23:57. Operator upsert by id (00:0xZ on 09-25)
  added `name: "trace_store"` to each variant's acquire and release, changing nothing else
  (order, category, variant_of and posteriors re-read unchanged); every family member now
  takes the named lease.
  Live after the variant fix (09-25): 00:06:43 the sampler drew …-lease-ttl-120s, which took
  maintenance-trace_store.json at 00:06:45 (maintenance.json untouched since 23:57); its fetch
  failed on that variant's 15 s timeout, leaking the named hold to its TTL — and at 00:07:10 a
  cutover acquired "cutover" during that hold and pushed as development-vessel 2992a23 at
  00:07:41. That is 3.2's live falsifier: a trace_store hold no longer refuses a cutover.
  Falsifier: a reconcile run without `fetch failed: The operation was aborted`; no lease file
  within a minute of completion; cutovers no longer log
  `REFUSE: maintenance change_window lease held`.
- [x] 3.4 `repos/activity-api/src/routes/db-admin-reconcile.ts`: `validateMaintenanceLease` accepts a
  token carried by ANY unexpired lease file in the lease directory (`maintenance.json` or
  `maintenance-<name>.json`), not only the unnamed file. Without it a reconcile holding
  `change_window:trace_store` is refused at the db_admin route (`maintenance lease not found`)
  because activity-api reads the unnamed file directly. Must land before 3.3 names the
  reconcile's lease. Falsifier: unit — a token held under `maintenance-trace_store.json`
  validates; a token held nowhere is refused.
  Landed by the substrate as activity-api `1055cba`; runtime file equals the commit, the unit
  restarted after it, and the falsifier passed in-container (named token valid with the primary
  missing, mismatched or expired; unknown token returns the primary's original error).

## Dispatch notes

One file per goal. Quote the exact old and new lines in the goal and state the fact a
refuter is likely to dispute (the semantic gate short-circuits its refuters on a
spec-exact patch, `7ab6155`/`1746f5a`). Dispatch so the cutover lands outside the
reconcile's hold (currently :x3:49–:x8:49 every ten minutes) until 3.2 lands. After each
landing: runtime file equals the commit, the process started after it, then the
falsifier — a seed-file landing is inert until 3.3(a) or (b), so check the consumer.
Open gaps carrying the measurements: `every-restart-budget-is-shorter-than-a-compose…`,
`a-verified-patch-is-rolled-back-when-the-change-window-lease-is-held…`,
`a-failing-trace-store-reconcile-re-takes-the-single-global-change-window…`.
