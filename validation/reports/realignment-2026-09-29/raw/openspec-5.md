# openspec-5 — shard entries 73..90 of openspec/changes

Listing command: `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '73,90p'`

Entries (18):
1. `2026-07-19-relay-findability-replication/` (proposal.md only)
2. `2026-07-19-vessel-duplicate-genres/` (proposal, design, tasks)
3. `2026-07-29-thompson-posterior-time-decay/` (proposal, tasks)
4. `2026-08-14-sound-close-oracle-reland/` (proposal.md)
5-9. `2026-08-16-my-http-response-resolver.{ts,js,js.map,d.ts,d.ts.map}` (stray, system-written + compiled)
10. `2026-08-16-route-edit-9077062c-author-my-resolver.json` (stray draft JSON)
11-18. `2026-08-17-add-goal-summary-dispatch-to-impulses{,-mod}.json`, `-add-goal-summary-resolver-implementation.json`, `-add-goal-summary-to-config.json`, `-add-resolver-result-type.json`, `-add-summarize-goals-activity/` (dir with proposal.json), `-add-summarize-goals-activity-fix.json`, `-add-summarize-goals-activity.json` (stray draft JSONs)

(Adjacent, outside shard but same family, read for context: `2026-08-17-delete-goal-summary-{resolver,test}.json`, `-delete-summarize-goals-activity.json`, `-fix-orphaned-goal-summary.json`, `-increase-goal-summary-timeout.json`, `-invoke-goal-summary-activity.json`, `-register-goal-summary-in-discovery.json`, `-remove-goal-summary-from-{config,impulses}.json`, `-update-goal-summary-resolver.json`.)

Live checks done: host `repos/` submodules + `/workspace/git/vessels` in substrate-live (grep), gaps store `/workspace/git/super-repo/gaps/gaps.json` (grep only), commit logs in activity-api / development-vessel / discovery-vessel.

---

## By problem class

### federation-p2p / endpoint-routing — `2026-07-19-relay-findability-replication`
- **Problem (07-19):** findability is a hub-star. Registry is in-memory single-replica `Map`, 5-min TTL, no replication (`discovery-vessel/src/registry.ts:26-34`). PUSH mirror `registerAtHub()` every 120s silently early-returns on empty circuit (lost reservation blanks the whole substrate's remote presence, no gap). PULL fan-out only on spokes (`gen-env.sh:218` sets `PEER_DISCOVERY_ENDPOINTS=${HUB_DISCOVERY_URL}`; hub has none). `/bootstrap` emits loopback anchors (`127.0.0.1:8101`) when `PUBLIC_IP` unset.
- **Proposed:** (1) replicate on `POST /register` to peers (LWW upsert, TTL); (2) loud reservation + immediate refresh on re-acquisition; (3) honest `/bootstrap` (no loopback anchors); (4) hub-side peer wiring. Operator ratified: "a direct connection is equivalent to a relay punchthrough"; findability (registry) separated from reachability (direct vs relay).
- **Tasks:** no tasks.md; proposal only.
- **Live status (09-28):**
  - Registration replication: **NOT built.** `discovery-vessel/src/index.ts` still only has resolve-time `forwardToPeers` / `forwardResolveToPeers` (lines 62, 104, 228, 274) gated by `PEER_DISCOVERY_ENDPOINTS` — i.e. the query-pull path the proposal called "optimization, not the guarantee".
  - Hub-side peer wiring: gen-env.sh now has `PEER_DISCOVERY_ENDPOINTS_EXPLICIT` operator passthrough (lines 960-968, 1690, 1738) — still env-gated (law 1), still defaults to `HUB_DISCOVERY_URL` (empty on a hub).
  - Loud reservation: partially — `libp2p-federation-transport/src/sidecar.ts:148-160` redials on empty circuit + "phantom-reservation" strikes, but no gap signal is emitted (logs only).
  - Honest bootstrap: not verified.
- **Outcome:** partial/dormant. Proposal never converted to tasks; only side-patches landed. Recurring class (federation/availability "from everywhere") keeps reappearing in later changes.
- **Principle stated:** "findability must be a property of *joining*, not of static per-node peer wiring"; "a relay outage degrades reachability for NATed cross-host peers only, never same-host findability, never the registry."

### federation-p2p / endpoint-routing / env-gating — `2026-07-19-vessel-duplicate-genres`
- **Problem (07-19):** discovery returns an undifferentiated producer set; each caller picks differently: `/resolve` picks `candidates[0]` (`discovery-vessel/src/index.ts:205`), `satisfier-pick.ts:26` priority-else-first, bare `vessels[0]` in goal-host, concept graph hand-pinned via `_fedTargetVessel: 'concept-db-local'` (`obsidian-vessel/src/concept-db-client.ts:479-484`, law-1 violation), identity treated as failover-interchangeable (split-brain: `activity-api/src/middleware/jwtAuth.ts:19-20`, env-pinned `JWT_ISSUER` in `identity-vessel/src/services/jwt.ts:15`), LLM quota-aware Thompson only inside goal-host `llm-router.ts`.
- **Proposed:** one shape-visible `duplicate_policy` per registration with 6 genres (`unique_authoritative`, `unique_target`, `interchangeable`, `stateless`, `stateful_data_owner_pin`, `stateful_data_owner_merge`); stamped from `vessels.inventory.json` `genre`; honored by `findByShape`/`/resolve`; retire 3 band-aids. Operator decision: identity namespace = shared secret (same secret → replica, different → foreign federated namespace). Companion `llm-arms-data-driven` (T6-T9: data-driven LLM arm units, drop hardcoded `DEFAULT_MODEL='claude-sonnet-5'`). T10 dropped on law review (client-side quota filter = per-caller band-aid).
- **Tasks:** 0/19 checked in tasks.md (T10 struck).
- **Live status (09-28):**
  - Built under a different name: `distribution_policy` (discovery-vessel `6ab2e24`, 2026-07-31 "first-class distribution_policy — vessels advertise their own routing rules"), same 6-value `DistributionPolicy` enum (`discovery-vessel/src/types.ts:77-96`, default `stateless`), with back-compat read of `metadata.duplicate_policy` (`registry.ts:249-252`, `index.ts:233-235`). goal-host `satisfier-pick.ts:40-55` honors pinned policies (refs discovery `7e051d7`, transport `24ac13e2`).
  - **But almost nobody declares it**: grep of all `repos/*/src` for `distribution_policy|duplicate_policy` outside discovery/goal-host finds only `obsidian-vessel/sidecar/federation-sidecar.ts`. `vessels.inventory.json` has no `genre` field (T1 not done). So every other vessel defaults to `stateless` → the resolver logic is live but effectively inert (dormant-mechanism).
  - `_fedTargetVessel: 'concept-db-local'` literal **still present** at `obsidian-vessel/src/concept-db-client.ts:484` (T14 not done); `_fedTargetVessel` also used in `goal-host-vessel/src/index.ts:160`.
  - tasks.md never updated to reflect the 07-31 landing → docs-drift (the proposal reads as unstarted while half the mechanism exists).
- **Outcome:** partial — general mechanism at the correct shared seam (discovery), live code path, but unpopulated declarations = dormant in effect.
- **Principles:** "how to treat a duplicate is a property of the producer's genre, and it is a shape"; "declaring the genre is registration structure; which arm serves remains learned (Thompson)" (law 4 boundary); "the choice of one-or-many moves out of every caller and into the router."

### selection-learning / directed-overshoot — `2026-07-29-thompson-posterior-time-decay`
- **Problem (07-29):** Thompson posteriors (`variant_performance_metrics.thompson_alpha/beta`, `context_thompson_scores.alpha/beta`) accumulate unbounded; transient-outage failures permanently suppress a template (spoke `mistral-small-latest` alpha=1/beta=80 vs hub 7439/304). `checkAndRetireTemplate` can permanently retire with no path back.
- **Proposed:** exponential decay toward (1,1), half-life 3 days (copied from llm-resolver-vessel `decayedCounts()`), at write and selection time; tasks.md amended to require half-life be a shaped value, not a constant (law 1); test that stale poisoned posterior heals.
- **Tasks:** 0 checked in tasks.md (tasks file never updated), but the work landed.
- **Live history (commits, activity-api):**
  - `1b0c693` 2026-07-30 — decay at read/write landed (3-day half-life).
  - `99ae266` 2026-08-22 — "the posterior decay half-life annihilated 95% of all learned evidence": over 1,821 arms with real evidence (alpha+beta>4) **95.4% retained <5%**, median retained 0.0002%. Mechanically "learning does not compound". Sweep of 15 half-lives 0.5..1000 d: set satisfying both "heal outage poison" and "keep earned credit" was **EMPTY** (`posterior-decay-halflife.test.ts`).
  - `2ededef` 2026-08-22 — dissolved the conflict at its cause: `execution_error` carries reason; `computeDeltas` abstains (beta += 0) on transport/availability failures → outage poison is no longer *created*; half-life raised 3 → 30 d, steerable via shaped `substrate_tuning_param` row `THOMPSON_DECAY_HALFLIFE_DAYS` (`posterior-update.ts:895-958`, `resolveThompsonDecayHalfLifeDays`). Decay also expressed in SurrealQL (`posterior-update.ts:1238-1239`) — contrary to the proposal's "prefer TS, avoid SQL-vs-TS drift".
  - Residual accepted: 32/509 arms still carry poison signature (beta>10, alpha<=2); beta=81 crosses back ~220 d. Worst `auth_resolve_v1` beta=399,770 (credential storm).
- **Outcome:** worked-after-overshoot. The originally proposed fix (a constant copied across contexts with different firing rates) was itself a 3-week regression of all learning; real fix was to stop *creating* bad evidence (abstain on environmental failure). Retirement reversibility still out of scope/unaddressed.
- **Principles:** "decay is runtime behaviour and must stay steerable through the shaped tuning row"; "one constant serving two incompatible jobs — dissolve the conflict rather than trade it"; "change one thing and record that you did".

### false-verification / hollow-landing — `2026-08-14-sound-close-oracle-reland`
- **Problem (08-14):** gap close Class 3 (landed-commit evidence) returned `'absent'` when any non-reverted commit names the gap id (`git log --grep <gapId> -1`). Live: `gap-env-gated-write-allowlist` "closed" by `bafd83d` which only renamed a local var (`WRITE_ALLOWLIST` → `WRITE_ALLOWLIST_ENV`), leaving `process.env["WRITE_ALLOWLIST"]` — condition still held; it had already re-landed (`69d680b` 05:39, `bafd83d` 07:34). Class-3 block duplicated at 3 sites (sync 1167, async 1255, pick-time 1403), one not vessel-scoped nor revert-aware. 30 `landed_verified` closures: 0 carried a Class-1/2 checkable condition.
- **Proposed:** centralize into `landedCommitVerdict(gapId, editSite)`: count non-reverted commits: 0→null, 1→'absent', >=2→'present'.
- **Live history (development-vessel):** `c871a45` 2026-08-14 landed; `25a1dfb` 08-14 abstain→escalate on re-land; `4b1f862` 08-14 per-class oracle posterior (earned-trust gate). Later hardened: 1 commit now returns **`'pending'`** not `'absent'` ("PROVENANCE, NOT MEASUREMENT … only a Class 1/Class 2 measurement can return 'absent'") — i.e. the proposal's "1 → absent, benefit of the doubt" was itself found to be the same hole and reversed. Also a 2026-08-23 bug: conventional-commit `revert(scope):` subjects were counted as a 2nd landing → flipped to 'present' → closed the gap it was reverting as `already_resolved` (fixed; `gap-to-feature-reland-verdict.test.ts`). Live code: `gap-to-feature.ts:2461` in host submodule; used at 1886, 1981, 2126, 2153, 2309.
- **Open hole spotted (09-28, reading the code):** the git query now carries `--since=14.days` — a re-land more than 14 days after the first landing counts as a fresh single landing (`'pending'`), so the persistence signal expires; re-detection across long gaps is invisible.
- **Outcome:** worked, but the proposal's specific rule was partially wrong and superseded twice. Recurrence: this is the same "a producer-authored string is not proof" class as memory items (class1 arming guard never fires 09-22, hollow_write 09-15, gameable-metric 09-15).
- **Principles:** "certify against the referent's persistence signal, not a landed sha"; "a fix applied to one site is not a fix" (duplicated verdict blocks); "abstain-on-unknown rejected by measurement: it would route every closure to the human".

### codebase-bloat-fossils / drafter-quality / write-read-mismatch — `2026-08-16-my-http-response-resolver.*` + `2026-08-16-route-edit-9077062c-author-my-resolver.json`
- **What:** a system-drafted "author a simple httpResponse resolver" change (route-edit-9077062c) targeting `repos/development-vessel/src/resolvers/http-response.ts` with a `replace_file` patch. Content imports **`@quilt/resolver`** / `createResolver` — a package that exists nowhere in the repo (invented API; drafter-quality). Instead of landing in the vessel it was written as a loose file into `openspec/changes/`.
- **How it got into git:** `.ts` + `.json` committed by `4e4170a8` (2026-09-07, "Substrate Autonomous: Automated commit: vessel code drift detected and committed." — a blanket drift-commit that also swept `elements.html` 3,270 lines, `neptune_moons.txt`, `all_gaps.json`, `compose-slots/slot-0.slot`, `interactor-log/*.jsonl`, etc. into the super-repo). The `.js/.js.map/.d.ts/.d.ts.map` were then emitted by a tsc run and committed by `796fac89` (2026-09-19, "vessel-code-commit-and-push cpg-inference-ts") — same commit also added `generate_report.js` (6,234 lines), `bun-run-impulse.js`, `my_probe.txt`, `known_answer.txt`, `learning_loop_test.txt`. A root `tsconfig.json` exists in the super-repo.
- **Classification:** pure fossil / residue. Delete all 5 `my-http-response-resolver.*` + the route-edit JSON. Nothing reads them.
- **Class lesson:** (a) the drafter's output was written to a path nobody consumes (the edit never reached the vessel) — write-read-mismatch; (b) an auto "drift-commit" activity commits whatever is in the working tree → residue becomes tracked history; (c) the pre-commit `ALLOWED_TOPLEVEL_DIRS` gate does not catch residue *inside* an allowed dir (`openspec/`).

### codebase-bloat-fossils / gap-content / narrowing-duplicates — `2026-08-17-*goal-summary*.json` family (8 in shard + 9 adjacent)
- **What:** ~17 system-written draft-plan JSONs from one day (2026-08-17), all attempting to close gap `orphaned-capability-goal_summary` ("resolver goal_summary is live but invoked by 0 activities"). Formats are mutually inconsistent (`schema_version/metadata/changes[file_create]`, `changes[edit_file/insert_after]`, `change{file_path,old_string,new_string}`, `change{type:patch}`, bare activity template `invoke-goal-summary-activity.json`) — no one contract for a change artifact. Contents:
  - `add-goal-summary-dispatch-to-impulses.json` — **`file_create` of the whole `src/routes/impulses.ts`** (a clobber of a ~1000-line router with a 10-line stub).
  - `add-goal-summary-to-config.json` — `file_create` of the whole `src/config.ts` (same clobber pattern).
  - `add-resolver-result-type.json` — `file_create` of `src/resolvers/types.ts`.
  - `add-goal-summary-resolver-implementation.json` — a placeholder resolver returning zeros (hollow) — while a real `goal-summary.ts` already existed since `dc18b62` 2026-07-01 ("apply capgap-goal_summary-report.json via mitosis cutover"), reworked `e3c36ac`/`4ce1045` 07-11.
  - `add-summarize-goals-activity{,-fix}.json`, `add-summarize-goals-activity/proposal.json`, (adjacent) `fix-orphaned-goal-summary.json` — the same activity file 4 times; two use absolute paths `/workspace/git/super-repo/repos/...` (location-dependence).
  - `register-goal-summary-in-discovery.json` — insert `"goal_summary"` into `discovery-registration.ts`; it was already in `config.ts:763-764`.
  - (adjacent) `update-goal-summary-resolver.json` imports **`@function-llama/substrate-client`** (invented package).
  - (adjacent) `delete-goal-summary-resolver.json`, `delete-summarize-goals-activity.json`, `delete-goal-summary-test.json`, `remove-goal-summary-from-{config,impulses}.json` — the opposite remedy (delete the capability) drafted the same day. Add and remove plans for one gap coexisting = no disposition learned.
- **Outcome:** failed. None landed as intended: `src/activities/summarize-goals.ts` does not exist in the vessel; `goal-summary.ts` resolver and `config.ts:764` / `routes/impulses.ts:952` dispatch pre-date these drafts.
- **Recurrence (live, 09-28):** gap `orphaned-capability-goal_summary` is **still open** in `/workspace/git/super-repo/gaps/gaps.json` — re-detected 2026-09-26T09:47 (first_detected_at reset; `reopen_count: 0`, so the 08-17 history is invisible to it), `falsifier: "none"`, `repair_direction: "mint"`, "invoked by 0 of the activity corpus (173/323 live resolvers are ever invoked)". Its summary claims "No file outside tests references goal_summary" — **false**: `development-vessel/src/config.ts:764` and `src/routes/impulses.ts:952` reference it (detector inaccuracy → wrong remedy direction). A sibling gap `…-gap-goal-summary` (category `unreachable_producer`, 2026-09-26T05:51, open, `falsifier: none`) says the producer's required inputs (`activity_metrics`, `goal`) aren't producible from the pool — a different hat on the same capability. 6 weeks, ≥17 drafts, 2 live duplicate gaps, 0 closures.
- **Class lesson:** gap born with no machine check (`falsifier: none`) and a mint-direction remedy for a capability whose real problem is reachability (input shapes) produced endless draft churn; the detector's history is reset on re-detection so the system cannot see it already tried 17 times.

---

## Mechanisms

| Mechanism | Location | General/specific | Status | Evidence |
|---|---|---|---|---|
| `distribution_policy` genre routing | `discovery-vessel/src/types.ts:77-96`, `registry.ts:249`, `index.ts:233`; `goal-host-vessel/src/satisfier-pick.ts:40-55` | general (shared seam: discovery) | live-unused (only obsidian sidecar declares a policy; inventory has no `genre`) | grep 09-28 |
| Resolve-time peer forwarding | `discovery-vessel/src/index.ts:62,104,228,274` | general | live-used where `PEER_DISCOVERY_ENDPOINTS` set (spokes); env-gated | code |
| Registration replication on /register | proposed only | general | never built | no code |
| Relay phantom-reservation redial | `libp2p-federation-transport/src/sidecar.ts:148-160` | specific | live; logs only, no gap signal | code |
| Posterior time-decay + shaped half-life | `activity-api/src/lib/posterior-update.ts:895-972, 1238` (TS + SurrealQL copies) | general | live-used (30 d, `THOMPSON_DECAY_HALFLIFE_DAYS` tuning row) | `1b0c693`,`99ae266`,`2ededef` |
| Environmental-failure abstention in computeDeltas | activity-api `computeDeltas` | general | live-used | `2ededef` |
| `landedCommitVerdict` (Class-3 re-land count, pending vs present) | `development-vessel/src/resolvers/gap-to-feature.ts:2461` | general (one helper replacing 3 copies) | live-used (5 call sites) | `c871a45`, later pending-rewrite |
| Close-oracle per-class earned-trust posterior | `gap-to-feature.ts` (after 2461) | general | live | `4b1f862` |
| `goal_summary` resolver | `development-vessel/src/resolvers/goal-summary.ts`, `config.ts:764`, `routes/impulses.ts:952` | specific | live-unused (0 invocations; orphaned gap open) | gap store 09-26 |
| Drift auto-commit ("vessel code drift detected and committed", "vessel-code-commit-and-push") | autonomous activity | general | live, harmful: commits residue to super-repo | `4e4170a8`, `796fac89` |
| `_fedTargetVessel` literal pin | `obsidian-vessel/src/concept-db-client.ts:484`, `goal-host-vessel/src/index.ts:160` | specific band-aid | live (proposed retirement never happened) | grep |

---

## Principles found
- Findability is a property of joining (replication), not of per-node wiring; findability (registry) ≠ reachability (direct vs relay). (relay-findability proposal, operator ratified 07-19)
- A direct connection is equivalent to a relay punchthrough; the relay is only a NAT fallback. (same)
- Duplicate handling is a property of the producer's genre, declared as a shape; the choice among duplicates stays learned. (duplicate-genres proposal/design §1)
- Identity is the namespace boundary; shared secret = replica, different secret = foreign namespace. (duplicate-genres decision 1)
- Per-caller failover/quota filtering is a band-aid the law forbids; de-advertise is the producer's job, resolve through discovery. (tasks T10 struck)
- Decay parameters are runtime behaviour → shaped tuning rows, never frozen constants. (thompson decay tasks §1; posterior-update.ts)
- When one constant serves two incompatible jobs, dissolve the conflict at the source (stop creating bad evidence) rather than trade. (`2ededef` comment)
- A commit naming a gap is provenance, not measurement; only a measurement predicate may say "absent". (landedCommitVerdict doc)
- Certify against the referent's persistence signal (re-detection), not a landed sha. (sound-close-oracle)
- A fix applied to one site is not a fix — centralize duplicated verdict logic. (sound-close-oracle)
- Substrate expresses the full capability surface it advertises; prefer deterministic resolver over LLM re-derivation. (orphaned-capability detector `cite_principle`)
