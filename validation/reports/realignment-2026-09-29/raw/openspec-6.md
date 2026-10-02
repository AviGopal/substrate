# openspec-6 — openspec/changes entries 91–108

Shard: `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '91,108p'`
(read 2026-09-28/29). There are 18 entries. 17 of them are **stray system-written drafts**: the 2026-08-17/18 `goal_summary` and
orphaned-capability fix attempts. Only one is a real proposal: `2026-08-26-consequence-verdict-into-credit`, operator-authored
in commit fe00585e.

Every stray file entered git through one of two autonomous "drift sweep" commits:
- `4e4170a8` (2026-09-07 04:20, Substrate Autonomous) — "Automated commit: vessel code drift detected and committed."
  It changed **2134 files, +59,401 lines**, and 34 of those files were under openspec/changes.
- `796fac89` (2026-09-19, Substrate Autonomous) — "vessel-code-commit-and-push cpg-inference-ts". It changed **412 files,
  +16,104 lines**, including tsc emit (`.js/.d.ts/.map`) for the stray `.ts` drafts under openspec/changes. The subject names a
  different vessel from what the commit contains.

Scale context for the whole openspec/changes directory (not just this shard): 175 non-archive entries, 77 of them stray
top-level files. There are 60 compiled `.js/.d.ts/.map` files outside the archive. **20 entries concern `goal_summary`** and
4 concern "orphan".

## Entry table

| # | Entry | Kind | What it was | Outcome |
|---|---|---|---|---|
| 91 | 2026-08-17-delete-goal-summary-resolver.json | stray JSON edit-spec | `old_string:"*" new_string:""` on `development-vessel/src/resolvers/goal-summary.ts` (delete the resolver) | never applied; the resolver is still live |
| 92 | 2026-08-17-delete-goal-summary-test.json | stray | delete `test/resolvers/goal-summary.test.js` | never applied |
| 93 | 2026-08-17-delete-summarize-goals-activity.json | stray | delete `src/activities/summarize-goals.ts`, a file that does not exist (no `src/activities` dir holds it) | invented path |
| 94 | 2026-08-17-fix-goal-summary/ | stray dir, 10 files | `files/repos/development-vessel/src/{config.ts,routes/impulses.ts}` plus compiled .js/.d.ts/.map. config.ts is a 7-line **replacement** of a ~800+-line real config. impulses.ts imports `{ impulse, Impulse, Kernel, set and get } from "@dev-vessel/core"`, which is neither valid syntax nor a real package | confabulated API, never applied |
| 95 | 2026-08-17-fix-orphaned-goal-summary.json | stray | add `summarize-goals.ts` ActivityTemplate plus `insert_after` an anchor in `discovery-registration.ts` | not applied |
| 96 | 2026-08-17-increase-goal-summary-timeout.json | stray patch | raise AbortSignal.timeout from 20000 to 60000 in goal-summary.ts | not applied; the live file still uses 20000 ms |
| 97 | 2026-08-17-invoke-goal-summary-activity.json | stray activity template | `run_resolver goal_summary → goalSummaryReport` | never registered (0 `activity` rows invoke goal_summary) |
| 98 | 2026-08-17-invoke-interface-deploy-reach-check-activity/ | proposal + tasks + template | bridge activity for orphan `interface_deploy_reach_check` | tasks 1/4 checked. The template was written into openspec, not registered. Gap reopened |
| 99 | 2026-08-17-orphaned-capability-fix/ | stray dir, 10 files | config.ts/impulses.ts fragments that import `./repos/development-vessel/src/resolvers/orphaned-capability` (a doubled path), include `... // existing cases` literally and escaped `\"` inside TS, and wire `route-edit-9077062c-http-response-resolver` | broken code; its tsc emit (`const module_1 = require();`) was committed anyway |
| 100 | 2026-08-17-orphaned-capability-resolution/ | stray dir, 18 files | mints a new shape `orphaned-capability-resolution` whose resolver returns the constant `{resolved:true, message:"placeholder"}`. `patch-config.json` would **create** config.ts from /dev/null (i.e. overwrite it) | textbook hollow landing; not applied |
| 101 | 2026-08-17-register-goal-summary-in-discovery.json | stray | insert `"goal_summary"` after an anchor in discovery-registration.ts | not applied (and redundant: config.ts:770 already lists it) |
| 102 | 2026-08-17-remove-goal-summary-from-config.json | stray | remove `"goal_summary"` from config.ts shapes | **directly contradicts #101/#95/#105**; not applied |
| 103 | 2026-08-17-remove-goal-summary-from-impulses.json | stray | remove the import and `case "goal_summary"` from impulses.ts | contradicts the add-drafts; not applied (the case is still at impulses.ts:987) |
| 104 | 2026-08-17-update-goal-summary-resolver.json | stray | rewrite the resolver with an invented `@function-llama/substrate-client` import and **hardcoded fake metrics** (`template_count = 100`, `avg_success_rate = 0.37`, alpha 1.66) | confabulation / hollow; not applied |
| 105 | 2026-08-18-add-goal-summary-activity.json | stray | activity template in yet another format (`category: activity_template`) | not registered |
| 106 | 2026-08-18-add-invoke-goal-summary-activity.json | stray | **byte-identical duplicate** of #97 | duplicate |
| 107 | 2026-08-18-ensure-goal-summary-invocation.json | stray | "Re-applies" #95 with `auto_reject_if_exists` | a re-draft of the same fix on the next day |
| 108 | 2026-08-26-consequence-verdict-into-credit/ | real proposal (proposal.md only) | reader half: feed temporal consequence verdicts (`goal_verification_labels`) back into Thompson credit | **not implemented**; no design/tasks; still active, not archived |

## Grouped by problem class

### codebase-bloat-fossils
- 17 stray drafts from 2026-08-17/18 (≈50 files, including compiled `.js/.d.ts/.map` outputs), all under `openspec/changes/`.
  The author was the system's own code drafter (feature_compose/gap-compose era), not an openspec workflow. These are not
  change proposals. They are **draft edit payloads that were written to the wrong directory** and never applied.
- They entered git through the autonomous drift sweeps 4e4170a8 (09-07, 2134 files) and 796fac89 (09-19, 412 files, tsc
  emit). A "commit whatever drifted" sweep turns scratch residue into tracked history. **Recommendation: delete all 17.**
  They carry no information beyond what this report records, and none of them was ever applied.
- tsc emitted JS for files under openspec/changes. Some tsc run's `include`/`rootDir` covered the super-repo tree, and the
  emit got committed. That is a second residue generator.

### narrowing-duplicates (drafting churn on one gap)
- **One gap, 13 drafts over 2 days, 3 mutually contradictory directions**, for `orphaned-capability-goal_summary`:
  (a) register and invoke it (#95 #97 #101 #105 #106 #107), (b) delete it entirely (#91 #92 #93 #102 #103), (c) make it
  "real" (#96 #104). #106 is a byte-for-byte copy of #97. #107 says it "re-applies" #95.
- Nothing converged, because no failed draft left a reason the next draft could read. Each attempt restarted blind. This is
  the same root cause MEMORY records as "the failure side had no store" (fixed 09-22). This shard is its 08-17 manifestation.

### drafter-quality
- Invented packages/APIs: `@dev-vessel/core` with `set and get`, `@function-llama/substrate-client`, `@substrate/core`.
- Invented and doubled paths: `./repos/development-vessel/src/resolvers/orphaned-capability` imported *from inside*
  development-vessel/src, and `src/activities/summarize-goals.ts`.
- Literal `... // existing cases` placeholders, and escaped `\"` pasted into TS source.
- Whole-file replacement of an ~800-line config.ts with 7 lines (#94) or from /dev/null (#100). Five different ad-hoc
  edit-spec schemas were used (`change.old_string`, `changes[].insert_after`, `schema_version 0.1 file_edit`, unified-diff
  `patch`, `write`/`insert` with `auto_reject_if_exists`). The drafter had no contract for its own output format.
- Fake data: #104 hardcodes `avg_success_rate = 0.37` "from previous context". That is confabulating a metric into a resolver.

### hollow-landing
- #100 `resolveOrphanedCapabilityResolution` returns constant `{success:true, resolved:true, message:"placeholder"}`. It would
  satisfy any "a producer exists / was invoked" check without doing anything.
- The goal_summary resolver itself (the live one) was minted 2026-07-01 as `dc18b62 substrate-authored: apply
  capgap-goal_summary-report.json via mitosis cutover` to "autoclose" a capability gap. It was a producer minted to close a
  missing-shape gap, and **no activity has ever invoked it**. It is the original hollow mint that the 08-17 orphan gap then
  tried to fix.

### gap-content / false-verification
- Live gap store `/workspace/git/super-repo/gaps/gaps.json` (6276 gaps) holds `orphaned-capability-goal_summary` and
  `orphaned-capability-interface_deploy_reach_check`, both **status open**. Both show `first_detected_at 2026-09-26T09:47`,
  `reopen_count 0`, `falsifier: "none"`, `repair_direction: "mint"`, and `candidate_consumers: []`.
- The same gaps were being worked on 2026-08-17 (the proposal cites the id verbatim). The store records them as first seen
  09-26 with 0 reopens, so **the recurrence history was erased**. The gap triple's "durability" metric cannot see this
  recurrence.
- Neither gap has a machine-checkable falsifier. Closing one would have to be judged by prose.
- Store totals for `orphaned-capability-*`: 51 gaps (open 38, rejected 8, closed 5), sum of reopen_count 6.

### dormant-mechanism
- `orphaned_capability_scan` (development-vessel `src/resolvers/orphaned-capability-scan.ts`, `seed/orphaned-capability-tick.ts`,
  activity `development-vessel:orphaned-capability-tick`) is **live-used**. It is a GENERAL detector at a shared seam: it
  computes live registered shapes minus invoked resolvers. It was repaired 08-28/29 (57f1ac4 dry_run, 786229b prescribe rewiring
  before minting, 5693903 count both consumption surfaces).
  - 2026-06-23 measurement in its header: 262 resolvers, 28 invoked, 250 orphaned.
  - 09-26 gap text: 323 resolvers, 173 invoked.
  - It detects well. The **repair half** (draft-gap-closing-activity → gap-compose) never produced a registered bridge
    activity for these two orphans in 40+ days.
- `goal_summary` resolver (dev-vessel `src/resolvers/goal-summary.ts`, config.ts:770, impulses.ts:987) is **live-unused**:
  0 activity rows invoke it. It carries `process.env.ACTIVITY_API_ENDPOINT ?? "http://127.0.0.1:8080"` fallbacks
  (endpoint-routing and env-gating smell). Candidate to retire, **not** to wire: it duplicates report-shape producers.
- `interface_deploy_reach_check` resolver (dev-vessel `src/resolvers/interface-deploy-reach-check.ts`) is live-unused, with 0
  invoking activities.
- **Tension, for the realignment:** the orphan detector's principle ("the substrate expresses the full capability surface it
  advertises") pushes toward *minting a bridge* for every orphan. Law 3 ("a wrong mint is negative value") and the hollow-mint
  origin of goal_summary push toward *retiring* it. The 08-17 drafter oscillated between exactly these two readings. The
  detector's `repair_direction` should allow `retire` when a resolver was itself minted hollow to close a gap. Today it offers
  only rewire or mint.

### selection-learning / false-verification (the one real proposal, #108)
- `2026-08-26-consequence-verdict-into-credit` diagnoses the root cause: credit is banked at reach time by a fallible
  surface-plausibility oracle, and nothing feeds the temporal verdict back (stayed / exercised / reverted / recurred).
  Evidence it cites:
  - `4eedb4de` confabulated blob scored CORRECT.
  - `registryFieldFor` rewritten **8×**, each rewrite re-banking credit.
- The plumbing already exists: the reach-verdict spool `ea78fd7`, execution_id keying, and graded α/β. The proposal asks for a
  reader in `posterior-update.ts` that consumes `goal_verification_label` by execution_id through `propagateCreditAlongChain`.
- It lays out an open decision between **A supersede** (reverse the banked α along the same chain) and **B distinct**, and
  recommends A. It is gated on `2026-08-26-large-file-edit-capability`.
- **Status 2026-09-28:**
  - `activity-api/src/lib/posterior-update.ts` has **no read of goal_verification_labels** (grep: only reach_verdict and
    tags).
  - `goal_verification_labels` holds **14,100 rows** (deterministic 12,479, human 1,089, automated 532).
  - `math::max(created_at)` returns null over the table, so created_at is inconsistent. It is read by goal-host's
    deterministic-oracle label feed and by feature-compose, **not by credit**.
  - The writer gap `consequence-verdict-writer-missing-for-goal-verification-labels` is absent from the live store.
  - No design.md or tasks.md was ever written, and the A/B decision is unsettled.
  - Outcome: **dormant proposal**. The "treadmill re-banks credit" problem it names is the same "same issue, different hat"
    loop the realignment targets.
- Adjacent later work that partly addresses it without settling A/B:
  - 6d0c16e (09-05) causal counterfactual stamped at pick time.
  - a245fee/fd4afe6 (09-05) detector-yield decides retirement from consequence asymmetry ("landed is 24.5x too generous").
  - 970b112 (09-16) abstain from blaming an arm for its environment.
  - MEMORY 09-22 failure-memory store and 09-26 causal-attempt-ledger.
  - None of these revises the reach-time α of a pathway whose change was later reverted.

### sync-deploy-drift
- The autonomous "vessel code drift detected and committed" sweep (4e4170a8) commits *whatever is in the tree*, including scratch
  drafts and compiled output. A drift committer with no allowlist is a residue amplifier. (The pre-commit
  `ALLOWED_TOPLEVEL_DIRS` gate checks only top-level dirs, so `openspec/changes/*.js` passes it.)

## Mechanisms

| Mechanism | Location | General/specific | Status |
|---|---|---|---|
| orphaned_capability_scan + tick | dev-vessel src/resolvers/orphaned-capability-scan.ts, seed/orphaned-capability-tick.ts | general detector | live-used; detection works, repair never lands for these orphans |
| goal_summary resolver | dev-vessel src/resolvers/goal-summary.ts (dc18b62, 07-01) | specific | live-unused (0 invoking activities); hollow mint; retire candidate |
| interface_deploy_reach_check resolver | dev-vessel src/resolvers/interface-deploy-reach-check.ts | specific | live-unused |
| goal_verification_labels corpus + label read/write shapes | activity-api src/routes/impulses.ts ~2842–3000; goal-host index.ts:3929 | general intake | live-used as an oracle corpus; **not read by credit** |
| propagateCreditAlongChain (posterior-update.ts) | activity-api src/lib/posterior-update.ts | general credit seam | live; reach-time only, no revision path |
| autonomous drift-sweep committer | "vessel code drift detected and committed" (4e4170a8), "vessel-code-commit-and-push" (796fac89) | general | live, and it commits residue — broken as a hygiene mechanism |
| drafter edit-spec formats (5 ad-hoc schemas) | the openspec/changes stray files | specific | fossil |
| orphaned-capability-resolution shape (placeholder resolver) | openspec/changes/2026-08-17-orphaned-capability-resolution | specific | fossil, never applied |

## Principles stated in this shard
- "The substrate expresses the full capability surface it advertises. An advertised-but-unexpressed resolver is a gap."
  (orphaned-capability-scan.ts header; gap cite_principle)
- "Prefer the deterministic resolver over an llm_completion_dispatch re-derivation." (orphan gap suggested_remediation)
- "Let what actually happened correct what the oracle guessed." Credit must be revisable along the temporal axis.
  (consequence-verdict proposal)
- Four constraints on a consequence correction (consequence-verdict proposal):
  - Keyed, never heuristic: attach to an execution_id or do not write (law 12).
  - Asymmetric caution: reverts and keyed recurrence are confident negatives; not-yet-exercised abstains.
  - No double-count (precedent: decision_outcome kept read-only, 03e6c55).
  - Internal and shaped: the verdict is an impulse, not an external harness.
- "No second credit system along the temporal axis — the cascade is a carrier, not the problem." (same proposal)
- "Do NOT anchor [the open decision] in code first." Settle designs in the spec before code. (same proposal)
