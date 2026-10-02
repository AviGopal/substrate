# FROZEN pre-registration: cold-boot proof (2026-09-19)

## Claim and scope
The published image, under its documented bootstrap contract, with FRESH
learning volumes, reaches readiness and completes ONE substrate-authored
development task through verification and landing. A pass supports: "a
substrate can be reconstructed from image+env+keys alone and can self-develop
from cold." It does NOT support: warm-state parity, federation, multi-day
stability, or any reach-rate claim.

## Initial state and dependencies (everything the system is given)
- Image: ghcr.io/avigopal/substrate:dev, id f70de0656d69, built ~41h before
  this run (predates today's oracle/cycle commits; whether boot-time repo
  sync brings them in is itself observed, not assumed).
- Fresh named volumes: coldboot-surreal, coldboot-workspace (created empty).
- Env: standalone role (no HUB_* vars), OPENROUTER_API_KEY copied from the
  hub's secrets (operator-supplied credential, per provider ruling: OpenRouter
  is THE provider; NO Anthropic key — the documented Makefile contract still
  names ANTHROPIC_API_KEY as its example; a keyless-Anthropic cold boot is
  therefore ALSO a test of that documented contract's honesty).
- Git push credential: whatever the image/bootstrap provides on its own. The
  operator supplies NONE. If landing requires a credential the image does not
  provision, that is a FINDING about the autonomy criterion, not a defect in
  the run.
- Host ports 38xxx -> 8xxx. No operator writes into the container after
  `podman run` besides the two dispatch calls named below.

## Falsifier and scoring rule
- F1 READINESS: within 30 min of container start, discovery answers /resolve,
  goal-host /health is healthy, and the dev seed templates are present
  (activity-api template count > 100; the known cold-boot seeder-ordering gap
  predicts 0 — if 0, F1 FAILS and the 121-template gap is CONFIRMED STILL
  OPEN; no manual seeding).
- F2 BASIC REACH: one operator dispatch of a deterministic store goal reaches
  with a byte-correct artifact (independently precomputed:
  sha256("coldboot-proof-2026-09-19") =
  c11a450b15f6f7eb67e7f2e9c01a432164a75049890003460265076b0a61ecd5).
- F3 SELF-DEVELOPMENT: one operator dispatch of a single-file code-edit goal
  through the direct feature_compose lane produces verdict FAVORABLE with a
  typecheck-verified staged/landed change AUTHORED IN THE COLD CONTAINER.
  Landing (push) succeeds with whatever credential the image provisioned;
  push refusal with a clean staged commit scores F3=PARTIAL (authoring
  proven, landing blocked — recorded against the push-capability criterion).
- Scoring is per-clause pass/fail/partial; no aggregate spin. ANY manual
  repair inside the container voids the run (a repaired run is a different
  experiment; repairs happen after scoring, in a new run).

## Independent evidence source
Artifacts read via HTTP from the host against precomputed values; template
counts via activity-api API; journal excerpts quoted verbatim; the operator
intervention ledger below is part of the record.

## Budget and stopping rule
30 min to readiness (else F1 fails and F2/F3 are attempted anyway IF the
needed vessels answer, with the degradation recorded); 45 min for F2+F3
combined; then stop, score, tear down or preserve per findings.

## Operator intervention ledger (updated live)
1. podman volume create x2; podman run (documented contract).
2. Copy OPENROUTER_API_KEY into env at run time (credential provisioning).
3. Dispatch F2 goal; dispatch F3 compose. NOTHING ELSE unless the run is
   voided, which will be recorded.

## Exclusions and uncertainty
- One task, one family, one compose: no reach-rate or generality claim.
- The image is 41h stale: results speak for THIS image; a rebuilt image is a
  new run.
- Sharing the host with the live hub: port/namespace isolation assumed;
  cross-talk via discovery federation should not occur (no HUB vars) but is
  watched for, not proven absent.
- Ground truth for F3 is typecheck+gate, not semantic review of the diff.
4. Second F2 dispatch at t+9min — first attempt raced identity reseed + floor registration (401s + no_dispatch_url at t+3min; both verified healthy read-only afterward). No state modified.

---

# RESULT (scored against the frozen clauses; run ended 22:50Z)

**F1 READINESS: PASS.** Discovery + goal-host healthy at t+31s. Bootstrap
seeder 19/19. development-vessel-seed Result=success on fresh volumes:
112/121 uploaded; the 9 "failures" are law-3 duplicate-mint REFUSALS (quoted
in journal), not upload errors. The 2026-09-16 cold-boot-loses-121-templates
gap is MEASURABLY CLOSED on this image. Count note: activity-api reported 90
templates via the paged query at t+3min — count-vs-seeder discrepancy
recorded, not adjudicated.

**F2 BASIC REACH: FAIL (two attempts).** Both dispatches ended reached:false
with no artifact. Attempt 1 (t+3min): recommend 401 against activity-api,
floor exit=no_dispatch_url, "no template id returned". Attempt 2 (t+9min,
ledger #4): identical "no template id" — and the decisive steady-state
finding: after the identity reseed's key-consumer restart, goal-host's OWN
DISCOVERY REGISTRATION fails 401 ("vessel will be unreachable via
discovery"). A fresh boot converges its services but NOT its identity/key
distribution: the goal plane cannot authenticate to the learning plane.

**F3 SELF-DEVELOPMENT: FAIL (one attempt).** Direct feature_compose for a
trivial net-new file REFUSED at grounding: "window does not contain basenames
of all target files" — the known create-intent/grounding class (jev-probe R2)
reproduced from cold. Honest refusal; no landing.

**Verdict: the image can RECONSTRUCT its fleet and its template catalogue,
but a cold substrate cannot yet RUN GOALS or SELF-DEVELOP** — blocked by (a)
post-reseed key/identity non-convergence and (b) the net-new grounding
refusal. Per protocol, NO repairs were made in the container; the specimen is
preserved stopped (container coldboot-node, volumes coldboot-*) for forensics.

## Exclusions honored
Image f70de0656d69 (41h old; predates today's oracle/cycle commits — F2's
oracle behavior on this image is the OLD chain). One goal family, one compose
path. Findings attach to THIS image; repairs land in repos and are evaluated
by a NEW cold boot of a NEW image.
