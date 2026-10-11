# Runtime unit drop-ins that are not in git (inventory, 2026-10-11)

The pre-commit env ratchet (`scripts/git-hooks/pre-commit`, block "env ratchet") stops a COMMIT from adding a behaviour
switch to a unit under `scripts/substrate/units/`. It cannot see a drop-in written straight into a container's
`/etc/systemd/system/<unit>.d/`: that file is in no tree, so no hook, glue test or trace judges it. This report pins the
ones that exist, so each one has a named lift and a review date rather than living on as an unrecorded switch.
No hold is kept indefinitely: at its review_by date each row is re-decided (lifted, or re-recorded with a new date). It is an inventory, not an
enforcement; nothing reads it at run time, and the missing reader (a census that diffs each node's `/etc/systemd/system/*.d/`
against the tracked units and files a gap per unknown drop-in) is itself the gap.

How it was taken: `ls` of `/etc/systemd/system/*.d/` in each running container, plus the NAMES on `Environment=` lines and the
paths on `EnvironmentFile=` lines inside each file, and the file mtime. No values were read and nothing was written inside a
container.

| Container | Drop-in | Sets | Written (mtime, UTC) | Lift | review_by |
|---|---|---|---|---|---|
| substrate-live (node 1) | `goal-host-vessel.service.d/50-satisfier-suppression.conf` | `Environment=SATISFIER_PROVEN_BAD_ARMED` | 2026-10-11 19:44:06 | the landing of the system need that makes this switch a shaped row read at use time; then delete the drop-in and restart goal-host-vessel | 2026-10-18, owner: user |
| compose2-live | `goal-host-vessel.service.d/50-satisfier-suppression.conf` | `Environment=SATISFIER_PROVEN_BAD_ARMED` | 2026-10-11 19:44:12 | same as node 1 | 2026-10-18, owner: user |
| substrate-live (node 1) | `activity-api.service.d/90-retention-hold.conf` | `EnvironmentFile=/etc/substrate/retention-hold.env` (a second env file; per `validation/reports/realignment-2026-09-29/goal-learn-flow/WIRING.md` it carries `TRACE_RETENTION_DRY_RUN`; values not read) | 2026-10-04 09:43:43 | per that WIRING.md, by user ruling: lifts ONLY when the retention compact-or-exempt fix's armed check reads green (fail-closed, all required: the trace-ceiling-valve gap closed landed_verified with no regressed_by; a fresh test_suite run of its only_tests passes; both refold-copy sha256s re-verify), or on an explicit user release; never on time. WIRING.md gives no date. The durable form, a shaped retention hold read by the sweep, is a gap | 2026-10-18, owner: user |
| pubspoke-live | none | — | — | — | — |

The satisfier drop-ins were written by the user (2026-10-11 19:44Z) as an operator bootstrap. The retention-hold drop-in
predates this ratchet; its env file path is not in `bootstrap-allowlist.txt`, so a commit adding that `EnvironmentFile=` line
to a tracked unit would be refused.

All three are lost on a container recreate (`/etc` is image state), so each switch silently reverts there; that is a second
reason a behaviour switch must be a shaped row in the volume, not a file in `/etc`.

## Classification of the tracked units' Environment= names (seed of the two lists)

`scripts/git-hooks/env-ratchet/bootstrap-allowlist.txt` (29 names, 8 env-file paths) and
`scripts/git-hooks/env-ratchet/grandfathered-behaviour.txt` (36 names, shrink-only) classify all 65 names that units set at the
seeding commit. The glue test `validation/scripts/env-ratchet-committed-tree.test.sh` fails when a unit sets a name neither list
carries, when a name is in both, and when a grandfathered name is no longer set by any unit (so the list shrinks as the lines go).
Borderline calls, made toward behaviour when unsure (a wrong "behaviour" costs a later migration; a wrong "bootstrap" is a
permanent hole): `VESSEL_DRAIN_MS`, `GOAL_HOST_DRAIN_MS` and `SURREAL_ROCKSDB_BLOCK_CACHE_SIZE` are behaviour, and so is
`EXTRA_WORKSPACE_ROOTS` (a path, but one that widens what tools may read: a reach grant, not a location); plain location
endpoints stay bootstrap;
`WATCHDOG_FLOW` (a label), `SURREAL_USER` (a user name; the secret comes from the env file), `OBSIDIAN_GEOMETRY` (virtual
display geometry) and the watchdog path variables are bootstrap.
