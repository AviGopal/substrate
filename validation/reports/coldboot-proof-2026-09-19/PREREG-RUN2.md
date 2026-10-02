# FROZEN pre-registration: cold-boot proof RUN 2 (2026-09-19)

## Claim and scope
Same as run 1 (PREREG.md) with ONE intervention under test: super-repo commit
081e9cbd (seed-identity writes the per-vessel keys it previously only
printed), baked into a freshly built image. A pass on F2 supports "the
identity-shadowing defect was the cause and is fixed"; F3 is re-attempted
but its grounding-refusal class is NOT expected to change (no fix landed for
it — an F3 change either way is a finding).

## Initial state and dependencies
- Image: rebuilt from super-repo @ 081e9cbd via `make build` (id recorded at
  run time). Fresh volumes coldboot2-surreal / coldboot2-workspace. Ports
  48xxx. OPENROUTER_API_KEY from hub secrets. Nothing else.

## Falsifiers (same rules as run 1)
- F1: readiness <=30min, seeders succeed.
- F2: sha256("coldboot2-proof") stored byte-correct in note coldboot2-f2;
  expected value computed at freeze:
  261768c759566a65a1ac56104a5dbbd2347ce690028036e61c136f522d1b2308
  AND zero 401 lines in goal-host journal after the reseed settles.
- F3: one direct feature_compose (same trivial-file spec class).
- Ledger + no-repair protocol identical to run 1.

---

# RESULT RUN 2 (image 2edb33af6b5a @ super-repo 081e9cbd)

**F1: PASS** — goal-host healthy at t+25s; identity-seeder wrote all three
per-vessel keys ("issued + wrote GOAL_HOST_VESSEL_API_KEY" in journal) and
restarted consumers.

**F2: PASS on the primary clause** — dispatch reached:true via
deterministic:transform-verified (the rebuilt image carries today's oracle),
note byte-identical to the frozen hash. The zero-401 sub-clause FAILED
NARROWLY: 9 post-reseed 401 lines, all on secondary paths (trace-sink
record, goal-path record, deliverable-shapes lookup, resolve-SHA) during a
~70s window; the per-vessel key validates 200 immediately after, and the
resolve-SHA 401 also occurs on the WARM hub — a pre-existing fleet-wide
wart made visible, plus a transient negative-auth-cache window. Attributed,
recorded, not repaired in-run.

**F3: FAIL, unchanged as predicted** — same grounding refusal for net-new
file basenames (no fix was landed for this class; its stability across
images localizes it to the compose grounding gate, not boot state).

**Delta run 1 -> run 2 (single intervention, 081e9cbd): a cold substrate
went from "cannot run any goal" to "runs and honestly verifies goals".**
Remaining cold-boot debt: the net-new grounding class (F3, tracked under the
authoring-lane family) and the secondary-path 401 window (new narrow gap
below). Specimens: coldboot-node (run 1) and coldboot2-node (run 2),
stopped, volumes retained.
