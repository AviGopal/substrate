# Hardcoding census and approach — bringing four drift classes in line with REALIGNMENT

2026-10-01. Read-only census; nothing was edited, dispatched or restarted to produce it. This is a
**proposal to the coordinator**, who owns REALIGNMENT.md. It does not amend REALIGNMENT; §6 lists the
amendments it proposes.

Detailed inventories, one per class, with file:line rows and method:
[A — pinned addresses](A-pinned-addresses.md) ·
[B — env/constant-gated behavior](B-env-gated-behavior.md) ·
[C — truncation caps on decision paths](C-decision-caps.md) ·
[D — delivery targets and retired-surface vocabulary](D-delivery-targets.md).

Counts are regex-based with hand-corrected samples; treat them as ±10% and as lower bounds where noted.

---

## 1. What prompted it

Reviewing a day of live dispatches (news reports, Jupiter distance, gap-lane investigations, "what are
you?") kept landing on the same kinds of hardcoding behind otherwise unrelated failures:

- a **4,965-char correctly dated report was judged "incomplete"** because the reach judge sees 1,500 chars
  per shape (and its prompt labels the content "(truncated …)" on every call), and that verdict became a
  concept lesson and a β (cea3f4a4);
- **"produce a report" goals die on `obsidian:write_note`**, a retired surface's write shape that goal-host
  appends as a fallback to every sink list and that no resolver serves;
- **delivered output does not reach the person reading the workbench**: a walk's `uiPanel_write`
  (415655c1, `panel-1790782355571`) did land on this node's human-surface — but blank ("Untitled") and
  filtered out of the workbench, which shows only solicitations; meanwhile **stateful-ui, which no human
  reads, holds 805 panels and was still being written to at ~03:29 UTC 10-01**, and discovery ranks it
  first for `uiPanel_write`/`uiQuestion`;
- **behavior that should be learnable is frozen at boot** in env vars and constants, and the detector that
  should see it exempts exactly that class.

Each instance has been patched before at one call site. The census measures the classes.

## 2. The four classes, measured

| Class | Size | Live consequence observed |
|---|---|---|
| **A. Pinned addresses** (host:port literals instead of resolve-by-shape) | ~254 rows to migrate in 153 files (dev-vessel ~220); 43 discovery-anchor rows exempt; 14 pins to retired vessels (9 stateful-ui :8270, 5 obsidian bridge :8290); 52 bare + 7 retired pins in dev-vessel **seed templates and prompts** that teach drafters to write `127.0.0.1:8xxx`; 4 endpoint env vars that are **never set**, so their literal always wins (`CONCEPT_DB_ENDPOINT` ×15) | writes reach a peer that was replaced (248 escalations to :8270); behavior differs by node |
| **B. Behavior gated by env vars / constants** (law 1) | ~179 distinct behavior names (activity-api 86 rows, dev-vessel 37, goal-host 20, …); ≥57 read at module scope (frozen at boot); only ~25 actually set live — the rest are constants in effect | credit/posterior, admission, verdict and walk-depth thresholds the learning loop can neither see nor vary |
| **C. Truncation caps on decision paths** | ~35 decision caps, almost all silent; ~450 other slices are log/id/title caps (harmless); `stop_reason` never read in goal-host | judge verdicts and lessons on content it never saw in full; humans see ≤2,000 chars of an unreached run's best output |
| **D. Delivery targets / retired-surface vocabulary** | ~9 goal-host delivery sites; 29 `obsidian:write_note` lines in goal-host `index.ts`, 7 dev-vessel files, 1 boredom; stateful-ui unit still active and ranked first for `uiPanel_write`/`uiQuestion`; `answerBody`/`human_presentation` built only when `reached === true` | the primary human interface (the workbench) receives almost nothing a run produces |

## 3. The governing pattern (from the history of each class)

Every class has a long fix history, and the fixes share three shapes. They are the same three shapes
REALIGNMENT §6.2 and §2.0 name, which is why this proposal routes through REALIGNMENT's seams rather than
adding new ones.

1. **A fix lands on one path and misses its sibling.** The judge-digest cap was raised 600/4000 → 1500/8000
   on the pool path only (7506f16, 06-25); `captureReachDigest` and the template path still run at
   600/4000. Real content was bound into the pool on the single-pick path (e0741ca) and never on the
   horizontal path (e35fc9e, same day). A current date reached arg-extraction prompts (07-11) and never the
   judge.
2. **The detector exempts the class it should see.** `env_gate_scan` skips env reads with inline defaults
   ("tuning, not gating", env-gate-scan.ts:11 and :87) — exactly the law-1 set — its `GUARD_RE` (line 33) is
   corrupted with duplicated fragments, and it left 2 journal lines in 3 days.
   No gate blocks new port pins (pre-commit, lint and shape-dispatch-check all ignore them).
3. **A repair lane manufactures the class.** surgical-gap-scan's prescribed fix
   (`process.env.X ?? "http://127.0.0.1:port"`) turned bare pins into env-default pins in ~17 autonomous
   landings; the seed templates teach drafters to write pins; the authoring `topology_hint` tells drafters
   to write `obsidian:write_note`.

Corollary: **file-by-file cleanup repeats pattern 1 ~250 times.** The approach below is one seam per class,
one gate per class with a positive control, and migration through the lane.

## 4. Approach per class

Each class follows the same template: **seam** (reuse, don't mint — §2.0) → **gate** (registered as a §2.1
evaluator row, proven able to fail) → **migration order** (by damage to verdicts and learning first) →
**verification** (a positive control at the consuming layer) → **builder** ((a) operator bootstrap for
autonomy-scope-excluded paths, (b) dispatched goal otherwise).

### C first — what the judge and the human see (smallest build, largest effect on verdicts and learning)

- **Seam (reuse):** generalise goal-host `floor-observation.ts` and llm-resolver `tool-result-bound.ts` —
  the two existing helpers that already show head, mark the cut and offer a read-more pointer, with budgets
  read from a shape (`walkBudget`, `llmModelPolicy`) — into one content-budget helper.
- **Rules:** the **answer/terminal shape first and whole**; evidence next; context last. Every cut is
  marked ("shown X of N" plus a pointer) and listed in `cuts[]` on the trace and on the verdict label.
- **Judge abstains on an incomplete view — computed in code, before the model is called:** if `cuts[]`
  shows the answer was cut, or the producing call's `stop_reason` was `max_tokens` (goal-host reads
  `stop_reason` 0 times today), the verdict is *insufficient view* without consulting the judge — no
  HOLLOW, no β, no lesson. This is deliberately not a prompt instruction: prompt text to the judge has not
  held (8a85cfa, 2c26fcb). Remove the unconditional "(truncated …)"
  wording from the judge prompt (index.ts ~3992).
- **Order:** the three judge-digest builders (#1–#4 in C) merged into one → semantic-gate diff (feature-
  compose) → human-facing answer/preview caps (and build the "read the rest" path the 2,000-char preview
  promises) → lesson / arg-synthesis windows → drafter → embedding window.
- **Verification (pre-registered):** cea3f4a4's 4,965-char report and a 20k synthetic correct answer are
  judged reached with `cuts=[]`; the same report with its final section removed is judged not reached; a
  forced tiny budget abstains; the label row carries the cuts.
- **Builder:** (a) for goal-host `index.ts` and feature-compose; the shared helper and concept-db likely (b).

### D second — the right data at the right interface

- **Seam:** one delivery helper in goal-host resolving the **dispatch's origin** through discovery. The
  workbench already tags its dispatches (`operator:"human-surface"`, `surface:do-anything`); the surface
  proxy stamps `origin_vessel_id` (its own discovery id), and goal-host delivers there — falling back to the
  obsidian plugin's `obsidian_vessel_endpoint` when that is the origin, else this node's un-suffixed
  human-surface. Discovery already distinguishes local (no suffix) from `@node` peers.
- **Changes:** remove the `obsidian:write_note` tail from `orderWriteSinks` and route the WHY / unservable
  vault writes through the helper; always build `answerBody`, labelled *not reached — best attempt* when
  `reached !== true` (pairs with the §2.0b best-of item and the held prior-attempts gap); refuse delivery
  writes with an empty title or body (no more "Untitled" panels).
- **Surface (operator grant, human-surface is plain files):** show delivered informational panels in a
  reports lane instead of filtering them out with `isSolicitation`.
- **Retirement (§4):** stop the stateful-ui unit and drop it from the manifest (human-surface-stack
  acceptance #5, unmet); mark the learned `…-to-obsidian-write-note` template retired with `superseded_by`
  so `/deliverable-shapes` stops admitting the shape; stop the authoring `topology_hint` from teaching it.
- **Verification:** positive control — a report goal dispatched from the workbench lands visibly on the
  workbench (uiPanel read + screenshot); must-fail control — an empty delivery write is refused; an
  unreached run shows its labelled best attempt.
- **Builder:** (a) goal-host helper, discovery ranking, surface; (b) dev-vessel call sites
  (`ui-write-passthrough` already routes by shape since a7161d2f/65422a78 but ranks a peer's surface equal
  to the local one and reads a `humanAskRoute` record nothing writes).
- **Measured vs risk:** escalations reaching stateful-ui is measured (805 panels, still written today).
  An in-walk delivery landing on stateful-ui because discovery lists it first is a **risk**, not observed:
  the one walk delivery checked (415655c1) landed on this node's human-surface; its failure was a blank
  body plus the workbench filter.

### A third — one address per shape

- **Seam:** `ias-executor-ts` `HttpDiscoveryAdapter.lookup()` + `buildResolveUrl` (4719cb4, 09-30) — it
  distinguishes a failed lookup from "no producer" and joins absolute, relative and libp2p endpoints. One
  per-vessel wrapper modelled on dev-vessel's `config.lookupShape`. Fold goal-host `asResolvePath` /
  `ufResolveUrl` into it; retire or re-point `packages/vessel-discovery-client` `discoverByShape`, which
  turns a failed lookup into `found:false` (the defect §2.4 forbids).
- **Gate:** one graded lint resolver on the shape-dispatch-check precedent, run pre-land in
  mitosis-evaluate, scoped to src, seeds, and template/prompt strings; allow the discovery anchor and a
  vessel's own `PORT`. Positive control: a fixture compose carrying a pin must be refused. Stop
  surgical-gap-scan prescribing env defaults.
- **Order:** the 14 retired pins → never-set env defaults (`CONCEPT_DB_ENDPOINT` first) → the 9 latent
  `endpoint + asResolvePath()` joins in goal-host (a) → the 20 hand-rolled `vesselCapability` lookups (b,
  one file per goal) → seed templates (reseed plus an audit of templates already in the activity table) →
  non-bootstrap scripts (a).
- **Verification:** each migrated site resolves a known-present shape through the wrapper on node 1 and
  node 2; any adapter change passes a fleet-wide consumer control first; the census pin count never rises.
- **Builder:** (a) ~9 excluded files, the gate, the adapter, scripts; (b) ~140 one-file goals, fewer if
  grouped by wrapper adoption.

### B fourth — behavior as shapes (law 1)

- **Seam (reuse):** activity-api `getTuningParam` (stored value → env → in-code default, 30 s cache, REST
  write path dev-vessel already uses), **promoted to an advertised `tuningParam` shape with a `_write`
  companion** (REALIGNMENT §3.3 already rules this). Structured policies keep their object shapes behind one
  shared reader. Four parallel mechanisms exist today (goal-host policy files, `getTuningParam`, per-vessel
  policy resolvers, `selection-tuning.json`) — converge on the one above rather than adding a fifth.
- **Keep env as the middle tier:** ~25 behavior names are set live; dropping env would silently revert them.
- **Classification:** CONFIGURATION_SURFACE.md's tiers; anything that changes a selection, admission,
  verdict, credit or retention outcome is behavior.
- **Gate:** widen `env_gate_scan` (fix its regex, drop the inline-default exemption, give it a caller) and
  register it as a §2.1 evaluator row — do not mint a new scanner.
- **Order:** credit/posterior (promote thresholds, signature similarity, horizontalK, the tag/history
  boosts §2.6 names) → admission (gap-class cap, compose concurrency, boredom exploration/weights, learning-
  mode thresholds) → verdict/landing gates → walk depth → retention.
- **Verification per site:** write a value, observe the consumer's log line or trace field change within
  the cache window with no restart, revert. A conversion with no observable reader is hollow (a198907 was
  one, closed as verified).
- **Builder:** (a) posterior-update, goal-host index, feature-compose, substrate-gap, boredom index,
  discovery; (b) activities.ts, signature-cluster, trace-retention, compose-slots, learning-mode, ribosome,
  llm-resolver. Broken now and worth fixing first as a control: ribosome's `extractionEligibilityPolicy`
  (534 fallbacks/24 h, nothing stores it) and goal-host's `bodyHonestyPolicy` (not advertised).

## 5. Cross-class order and why

1. **C (judge and human view)** — every false HOLLOW today becomes training signal (β, failure memory,
   concept lessons); it is a small (a) build with a crisp control.
2. **D (delivery)** — the primary interface currently receives almost nothing; fixing it also makes C's
   results visible to the person grading them.
3. **A (addresses)** — largest by count, lowest per-site risk once the seam and gate exist; mostly (b).
4. **B (behavior shapes)** — highest long-term learning value, but ~155 of 179 names are unset defaults, so
   conversion changes nothing observable until values are written; start with the credit/posterior group.

Within each class, the seam and the gate land before any migration, so the migration is gated from its
first commit.

## 6. Proposed REALIGNMENT amendments (for the coordinator)

- **§2.4** names `packages/vessel-discovery-client` as the seam; the measured seam is `ias-executor-ts`
  `HttpDiscoveryAdapter` (4719cb4). §2.4 also misses seed/template/prompt pins, the env-default disguise
  produced by surgical-gap-scan, the `env_gate_scan` exemption, and self-address pins; its cited 06-25
  "de-hardcode" precedent covers `/home/avi` paths, not ports.
- **§2.2** should list *judging on truncated input* and *a model call stopped at max_tokens* among the
  fail-open branches that become abstains, and labels should carry the cut.
- **§2.1** has no row checking a verdict's input was complete; add the content-budget check, the port-pin
  lint and the widened env-gate scan as evaluator rows.
- **§2.0b** should name delivery-by-origin and best-attempt delivery as output chaining to the human.
- **§4** — human-surface-stack acceptance #5 (stateful-ui and react-renderer out of tree, inventory,
  manifest and units) is unmet; stateful-ui is still live and ranked first.

## 7. Decisions needed

- **Operator clearance for the builder-(a) items**, in the order of §5 (judge content-budget and abstain;
  goal-host delivery helper; the address gate and adapter fold; the posterior-update/admission policy
  reads).
- **Retiring stateful-ui** from the live unit set (it is still serving and still ranked first).

## 8. Verification status

Verified by direct check this session (beyond the census agents' own controls): ias-executor-ts 4719cb4
exists and its `lookup()` returns typed `ok:false` (timeout/network) distinct from no-producer;
`packages/vessel-discovery-client` `discoverByShape` returns `found:false` on a query error when no stale
cache exists; `env_gate_scan` exemption and corrupted `GUARD_RE`; surgical-gap-scan (super-repo 459bf0ca,
06-29) prescribes `process.env.<VAR> ?? "http://127.0.0.1:<port>"` verbatim; `stop_reason` read 0 times in
goal-host `index.ts`; `CONCEPT_DB_ENDPOINT`, `GOAL_HOST_ENDPOINT`, `DEVELOPMENT_VESSEL_ENDPOINT`,
`HUMAN_SURFACE_ENDPOINT` absent from gen-env.sh, the unit files and the live env; the judge prompt's
unconditional "(truncated …)" label and the 600/4000 sibling digest at index.ts ~14603; `orderWriteSinks`
appends `obsidian:write_note`; stateful-ui's 805 panels; the 415655c1 panel on :8310.

Not verified (stated, not assumed):

- Per-class counts (§2) are the census agents' regex counts (±10%), not re-counted.
- The "~17 autonomous landings" attributed to surgical-gap-scan's prescription.

- The builder (a)/(b) split uses the 27 excluded paths as written in REALIGNMENT's prose, not the live
  `autonomyScope` record (unreadable this session: discovery found no producer for the pool record).
- Whether the 9 goal-host `endpoint + asResolvePath()` joins fail in practice depends on producers
  registering an absolute `resolve_endpoint`; not checked.
- That templates already stored in the activity table carry pins (inferred from the seeds).
- `bodyHonestyPolicy`'s "not advertised" cause, and whether the deployed goal-host lags its source.
