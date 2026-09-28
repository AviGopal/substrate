# Why things keep breaking — 253 break cases, 2026-01 → 2026-09-28

Question (user, 09-28): "We should try and figure out why things keep breaking." Two read-only sweeps classified
every case where a mechanism was built (or fixed) and later found broken, reverted, inert or never-firing:
74 cases Jan–Jul, 179 cases Aug–Sep 28 (git history of the super-repo and all 16 vessels, validation reports,
openspec, operator memory). Categories were fixed in advance.

## Counts

| Category | Jan–Jul | Aug–Sep | Total | Median break→detect | Joint-liveness check would catch (yes / +partial) |
|---|---|---|---|---|---|
| A — the system's own autonomous landing broke another mechanism | 11 (16 landings) | 40 | 51 | hours | ~33% / ~58% |
| B — producer/consumer contract drift (field, polarity, envelope, path, key) | 21 | 29 | 50 | 1–11 d | ~65% / ~80% |
| C — half-built joint (no reader, no writer, input never produced, retired target, never fired) | 16 | 48 | 64 | 2–3 d (tail: 78, 240 d) | ~67% / ~80% |
| D — residue / isolation (test values in prod, tests touching live, env/secret drift, stale clones) | 10 | 20 | 30 | hours–2 d | ~57% / ~83% |
| E — validated once, then stale | 5 | 14 | 19 | 6.5–8 d | ~58% / ~74% |
| F — directed fix overshot or regressed | 7 | 21 | 28 | hours | ~36% / ~54% |
| G — other (runtime, DB semantics, build) | 4 | 7 | 11 | — | — |
| **All** | **74** | **179** | **253** | ~0.5 d (known-latency rows; the undated tail is long) | **~52% / ~72%** |

**Who detected:** operator/assistant sessions ~247 of 253. The system itself: 2 (Jan–Jul row 28, a push-away gate;
Aug–Sep A34, the 09-28 04:09 sweep FALSIFIED of e059a98). No named detector was the first to catch any case.

## What the numbers say

1. **The dominant failure is silence (B + C + D + E = 163, 64%).** Joints that stop carrying traffic, readers never
   fed, writers never read, contracts that drift — found days to months later, almost always by an operator audit.
   A continuous check that each registered writer→reader joint carries real records within an expected window
   catches ~70–80% of these, days to weeks earlier.
2. **A joint-liveness detector already exists and has been blind since it was built.** `scripts/substrate/joint-liveness-tick.ts`
   (`daa2632c`, 08-25) has exactly **one binding** (`decision_outcome`) and was never extended; its meta-guard only
   asserts it checked more than zero bindings. It caught none of the Aug–Sep breaks. The mechanism was built;
   its coverage was not — itself a category-C case.
3. **Autonomous self-edits are the second failure (A = 51, 20%).** Mostly caught in hours, because an operator was
   watching live. Liveness helps least here: these are clobbers, weakened guards, stale-base reverts and
   check-satisfying changes that keep joints firing with wrong content.
4. **The rest (~56 Aug–Sep rows, ~22%) are "wrong but still flowing"** — polarity inversions, stale-test and
   fabricate-to-satisfy landings, weakened guards, silent reverts by stale-base cutovers, wrong values in state,
   test residue in live stores. Liveness cannot see these; they need **semantic invariants** (value checks on what
   a joint carries, e.g. the detector-output-sanity idea generalised) and **consumer-side probes** on the
   production path a change touches.
5. **Directed fixes (F = 28) regress about as often as they are measured to** — operator changes are not safer by
   construction; they are validated locally too.

## Root cause

Every change — autonomous, directed or operator — is validated **locally and once**: against the check that
motivated it, at landing time. Nothing continuously asserts the invariants *between* mechanisms. So contract drift
and half-built joints stay silent (B, C), acceptance results go stale (E), residue accumulates (D), and a landing
that severs or corrupts another mechanism passes its own check (A, F). Humans are the detector; detection latency
is how long until a human audits that corner.

## Implication for what to build (evidence-ranked, not yet decided)

1. **Extend the existing joint-liveness detector into a joint registry** (each mechanism declares its writer→reader
   joints and expected rates; the detector files a gap when one goes quiet). Covers the largest class; reuses a
   live, healthy unit on the hub.
2. **Semantic invariants on joints** (value-range, polarity, key-shape checks on what flows) for the
   "wrong-but-flowing" class.
3. **Landing gate on registered joints** — a staged change must not silence or corrupt a registered joint;
   aimed at A and F.

## What changed since the 09-26 working state (diff sweep)

- **What "working on 09-26" measured:** the causal-attempt-ledger acceptance (3 consecutive runs, incl. a cold boot),
  run with every autonomous path deliberately held quiet. It certified that the ledger records attempts consistently —
  not that autonomous landings were good. 09-26 itself had ≥17 autonomous landings (57 substrate-authored commits),
  several of them regressions nobody judged (bf8e48c, 329fc5c, 6c33870/47171d1, ac71a86).
- **Existed before 09-26** (not introduced by the last two days): check-satisfying regressions (a); weak-predicate
  landed_verified closes (b, incl. `removed_line_of_landing_commit`, 14 such closes 09-24/25); ribosome 100% error +
  register 400 (d, since ≤09-25); tests touching live state (f); lost gap writes (g, gap filed 09-25); behavioural
  verification ran:false (h, since 07-12).
- **Introduced after 09-26:**
  - Node-2 DB-watchdog failures — node-2 pull-sync auto-enabled never-fired timers on a DB-less node at 09-26 12:56Z (behaviour from 7f97df70, 09-10).
  - Node-2 pull-sync failure — 13 vessel clones created on node 2 at 09-26 08:20Z without node_modules; cpg-inference-ts can never build there.
  - Node-1 gap-compose.timer dead since 09-26 07:51Z — residue of the recursion-storm containment restart (masked, unmasked, never restarted).
  - **Admissible supply collapse — caused by this session's containment**: combined admitted ~235–255 on 09-26 → 5+12 after 1.6 (falsifier class required, 09-27 09:14Z) → 0–3 + 2 after 8.10 / class2-only / operator_hold / suspected-location rules. Landings also fell with the lease, the 1–2 USD/h envelope, the 13:00–21:47 pause, and node-2 boredom/rhythm off since 09-27 02:10Z.
- **Trade made:** from ~17+ unjudged landings/day (several regressions) to few landings, every one verified from both sides (8 since, all reverted; one caught by the system itself).

Corrections to earlier rows: the sweep DID close ec962628-step-1 `landed_verified` at 09-27 22:06:21Z on a predicate derived from the landing commit itself (CHECKINS 22:20 said it could not judge it); node 2's learning-loop-selftest fails on 'Unable to connect', not a missing script; node 2's pull-sync still refreshes the super-repo (synced=1, failed=1).
