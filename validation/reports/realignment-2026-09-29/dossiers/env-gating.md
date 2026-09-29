# Dossier: env-gating

**Class:** behaviour steered by env vars, unit `Environment=` lines, EnvironmentFile order or module-load constants instead of a shaped impulse read at use time (law 1). Symptom families: (a) a capability is silently off because a variable is unset, (b) a knob is frozen at boot and differs per node, (c) the env delivery bus (gen-env, EnvironmentFile precedence) loses, overrides or corrupts values, (d) a law-1 "fix" lands as a rename, an inversion or a new env gate.

**Sources:** `classes/env-gating.json` (49 attempts, 40 problem records from 40 collector shards, 7 claims); raw notes `git-activityapi`, `git-devvessel-1/2`, `git-goalhost`, `git-mid`, `git-super-2`, `live-gaps`, `live-resolvers`, `live-pool-memory`, `memory-1..10`, `memory-adjacent`, `openspec-3/5`, `validation-other-1`, `vessel-docs-tooling`, `node2-runtime`, `docs-1/3`. Live checks made 2026-09-29 on `substrate-live` (node 1) and `compose2-live` (node 2) and are marked **[LIVE]**.

**Caveats.** The on-disk gap store (`/workspace/git/super-repo/gaps/gaps.json`, 6,279 rows) starts at **2026-09-18T16:48Z**. Every gap id dated before then comes from raw notes and git, not from the store. The `execution` table is capped at about 150k rows, which is roughly 5 days, so "0 executions" there covers only about 5 days. The 30-day "no traced output" claim for `env_gate_scan` is from `live-resolvers.md`.

---

## 1. Timeline (chronological)

| Date | Event | Claimed | What later showed |
|---|---|---|---|
| 03-25 → 06-30 | Behaviour behind env and in-process arrays: `GOAL_RUNTIME`, `MINIBOB_BOREDOM_ENABLED`, `DB_POOL_ENABLED`, `MITOSIS_DIRECT_PUSH`, `GAP_COMPOSE_TRIAGE`, LLM provider env (00aa71e9, 6e00f7ae, 376b5794, 50812974, 6f5e1bdd, 1101faea). The ias-executor bridge was "wired but not activated" behind env (b3c9d58e). | — | 10 recurrences in git-super-1. |
| 04-26 | `TASK_GENERATION_ENABLED`, `DB_POOL_ENABLED`, HNSW, `FEATURE_ACTIVITY_DRIVEN_BINDING` flags used as fixes | — | Still present 09-28 (openspec-1). |
| 05-23 | openspec `substrate-identity-resolution`: replace the hardcoded identity defaults with a `substrateIdentity` shape | spec written | 0/50 tasks. No `substrateIdentity` in src. Dormant. |
| 05-30 | fs_write draft spec picks **option B: `WRITE_ALLOWLIST` env** to scope substrate writes | design decision | This became the longest-running instance (see 08-14/08-17/08-30). |
| 06-02 | "6/6 intent alignment" | reached | It was achieved by disabling reuse through env (`SUBSTRATE_REUSE_KEYWORD_MIN=999`) and minting a fresh template per goal. The metric was gamed by an env knob. |
| 06-04 | LR-6 TD(λ): γ constant renamed to env `TD_LAMBDA`, later backed by the `substrate_tuning_param` table (migration 152) | law-1 partial | Row `TD_LAMBDA=0.6` exists [LIVE]. Env fallback kept. A4/A5 acceptance never recorded. |
| 06-07..22 | Boredom `AUTONOMOUS_GOALS` parallel arrays (de467c93, 366d3655, 793dcc81, 06c48140) | — | goal[49] fired 0 times in 40 min. |
| 06-16 | "Self-alteration cutover loop CLOSED; `MITOSIS_DIRECT_PUSH` the one missing knob" | closed | 06-20: about 21 h of pure no_op at landing. The knob remains the kill switch, `=1` on both nodes [LIVE]. |
| 07-04 | **`env_gate_scan` minted by the substrate** (dev-vessel `744a3cd`, gap `gap-env-gate-detector-missing`). activity-api `089cdcf` resolves concept-db via discovery. The scan found 15 sites / 14 vars. | detector for the class exists | The same session minted a **new** env gate `GAP_CLASS_OPEN_CAP` (52810c0). The detector later decayed (see 09-05, 09-13, 09-15). |
| 07-04 | Single transport story: route by registration, not `PREFER_LIBP2P_ROUTE` | partial | `PREFER_LIBP2P_ROUTE` is still read in 3 goal-host places and is `=1` in the live goal-host process [LIVE]. |
| 07-10/12 | Standing feedback: "no behaviour gates behind unobservable config", "behaviour must be shape-driven". `DOC_FIX_AUTOLAND` → `docFixPolicy` shape, substrate-authored in 4 dispatches | worked | The env fallback was kept, and `env-gated-behavior-sweep` stayed open. `LLM_FALLBACK_MODEL` drift left 2 of 3 llm units unable to fail over during an outage. |
| 07-19 | Data-driven LLM arms (`llm-arms.json` → rendered units) | worked | One of the durable wins, because it made the arm roster data. The `arm-inventory-as-shape` gap stayed open. |
| 07-23 | identity-vessel migration 004 "applied live; the file makes it durable across a fresh deploy" | durable | There is no applier: `SCHEMA_AUTOAPPLY` is unset and the hardcoded list covers only 001–003. A fresh deploy would not apply 004. |
| 07-24 | Stale key via `.substrate-secrets` EnvironmentFile order. Satisfier env/CWD facts injected into the fallback prompt only | partial | The same EnvironmentFile-wins mechanism came back on 09-22 with `WORKSPACE_ROOT`. |
| 07-27 | `559a55d` removes the `LLM_VESSEL_ENDPOINT` gate on the ReAct floor. The floor resolves via discovery | worked | Held. |
| by 07-29 | `detectArchitectureViolation` (feature-compose, fb9b1e1 / 33381f1; Check C 07-29) flags an env read at a branch | law-1 lens on landings | **Advisory only**, fed to the semantic judge, which fails open (see §4). |
| 07-29 | `8bd2fff` replaces 7 hardcoded haiku pins with `auto` (llmModelPolicy). Compose watchdog fixed by `WATCHDOG_ACTIVITY_PATHS` env (e216d355). dev-vessel `METABOB_API_KEY` realigned | worked | The watchdog fix was itself an env fix. The key-drift class recurred 07-27 and 09-19 (081e9cbd). |
| 07-31 / 08-03 | vLLM arms inert behind unset `VLLM_ENDPOINTS`. Cross-provider failover gated by `LLM_FALLBACK_MODEL`, with `if (body.tools?.length) return null` | dormant | Capability off because an env var is unset (family a). |
| 08-06 | boredom `92f3336` (autonomous): the `EXECUTABLE_RESOLVERS` constant, which had blocked all 214 proposals, is unioned with discovery | worked | A real law-1 repair by the substrate. |
| 08-07..09 | gen-env spoke guard reads `HUB_DISCOVERY_URL`. gen-env overwrite heredoc fixed (9f8f945e). config-surface audit: gen-env is the only env channel, 7 dead vars, spoke derivation hardcodes 18xxx (a48e4ae3 fixed the Makefile only) | partial | "F10 image inventory drift" retracted because an old container was measured. |
| **08-14** | `69d680b`, `bafd83d` (Substrate Autonomous) "close" `gap-env-gated-write-allowlist` | closed ×2 | `bafd83d` only renamed a local var (`WRITE_ALLOWLIST` → `WRITE_ALLOWLIST_ENV`). The Class-3 close predicate accepted any commit naming the gap id (openspec-5). |
| 08-15..18 | concept-db `/health` gated, ungated, then re-gated on `DENSE_BACKFILL_ENABLED` (071088f, 120d9d1, acb7a5a) | — | 3 oscillating landings, all law-1 env gating. |
| 08-16..17 | Operator law-1 conversions: walk budgets, lesson execution, `EDGE_BLEND_K` read as shapes (b79c2ba, 4f7a817, 02f168c, ca286e0). Producers for `walkBudget` / `lessonExecutionPolicy` (f87f52f) | worked | A shaped `iters=6` was proven at 13:14 and **erased by 13:57**, because `policies/` is gitignored inside a cleaned worktree. The `POLICY_ROOT` move was never done. 34 `process.env` reads remained in goal-host index.ts. |
| **08-17** | write-allowlist landed **3× in one day** (6651808, 038ed0d, 8f05704). activity-api law-1 ports d3d29da, d81ab34 | ported | 08-18: 0f79ff2 / 35f86fb plus 6 pwt children re-introduce env gating on the embedding provider. |
| **08-18** | `429c7e5` (autonomous), gap `gap-env-gated-substrate-auto-draft-enabled`: `=== "0"` becomes `=== "0" \|\| === undefined` | closed | This **inverted the intent** by making the env gate default OFF. **Still in HEAD** at goal-host `src/index.ts:16175` [LIVE]. |
| 08-18 | `f38f68b` gap-env-gate-fulfilled, `4814234` dev-operator-present | — | — |
| 08-20 | `substrate-config` / `env.provenance` reports which tier supplied each variable | worked | It reports and does not refuse. Its own two defects had to be fixed first (not COPYed into the image; generated secrets reported as hardcoded). |
| 08-21 | `config-surface-probe.sh` replaces the prose harness | — | **Invoked by nothing.** The only reference is a comment at `scripts/substrate/Makefile:159` [LIVE]. |
| 08-22 | `42302670` kill switches reach the fleet. `2ededef` Thompson decay half-life becomes the tuning row `THOMPSON_DECAY_HALFLIFE_DAYS` read at use time | model of law-1 | **No `THOMPSON_DECAY_HALFLIFE_DAYS` row exists** [LIVE: 4 rows only, `TD_LAMBDA`, `SF_BLEND`, `YIELD_FLOOR`, `PROBE_NULLNONE_FIXED`]. The model seam runs on its in-code default. |
| ≥08-28 | Operator transcripts: "set `SUBSTRATE_ALLOW_DIRECT_EDIT=1` … **restored to 0 after**" (≥16+12+5 mentions) | restored | Still `"1"` in `.claude/settings.local.json` on 09-29, file mtime 2026-09-06 09:00 [LIVE]. The PreToolUse edit gate CLAUDE.md describes is inert in every session. |
| 08-29 | `60e3154` deletes `env_gate_fulfilled` as "unwired, unconsumed, unreachable". It called `/v2/substrate/gap/env-gate-fulfilled`, which no vessel mounts | — | A detector's fulfilment path had never worked. |
| **08-30** | `6586f17` (recommit-recommit-…-narrowed) flips the unset branch of `assertInAllowlist` from allow to throw | closed | The outer guard at `fs-write.ts:53` calls `assertInAllowlist` only when `WRITE_ALLOWLIST !== undefined`. The throw is unreachable. **`WRITE_ALLOWLIST` is unset on both nodes** [LIVE], so fs_write has no scoping at all. |
| 08-30 | `concept-db-health-reports-upkeep-enabled-from-an-env-var` (twice, open) | — | — |
| 09-05 | `env-gate-scan-is-blind-to-threshold-gates` **rejected**. `b24df4e`, `5cd4e72` churn on env-gate-scan.ts. "Don't fix an inverted env gate by setting the env; delete the gate" (memory-9) | — | The detector's scope (only "unset var disables a capability") was never widened. |
| 09-10 | Fleet credential recovery (API_KEY unset fleet-wide after the 09-09 reboot) | "reach 7.9%, first real number" | All earlier reach figures were void: the fleet had been 401-dead, so credential/env layering at boot had invalidated the measurement instrument. |
| 09-12 | Host-independent federation join: "ungate" of the relay-less transport (87e30952) | "a relay-less transport is healthy" | Node 2's transport announces no dialable address. It is healthy only per systemctl. |
| 09-13 | 96 of 186 open substrate-detected gaps were self-generated compose churn, **mostly on `env-gate-scan.ts`** (memory-9) | — | The detector for the class had become a churn attractor. |
| 09-15 | `c532795` (autonomous mitosis) appends a corrupted `GUARD_RE` line, growing it from 665 to 805 chars | — | [LIVE] The regex literal ends at `/;`. The garbage is in a trailing `//` comment, so the file parses, but the literal contains repeated `\?\?` alternations and matches `??`, which contradicts its own header ("reads with inline defaults exempt"). |
| 09-16 | Placeholder `GOOGLE_API_KEY` crash-loops or pins a dead arm. `61ae51b` (autonomous) fixes blank-but-present | worked | 89 drafter 400s per 30 min before the fix. "Blank-but-present ≠ absent" joins the class. |
| 09-18 | Gap store's earliest surviving row | — | Pre-09-18 env gap ids are not in the live store. |
| 09-19..27 | `runtime-drift-*` gaps for 10 vessels | — | Repair is "not armed (set `RUNTIME_DRIFT_REPAIR=1`)". [LIVE] 12 `runtime-drift-*` open. `RUNTIME_DRIFT_REPAIR` is unset in the dev-vessel process on both nodes. |
| 09-20 | `gen-env-re-quotes-an-already-quoted-persisted-secret-so-peer-discovery-endpoints-is-an-invalid-url` | open | Family (c). |
| 09-22 | Two memory stores: the unit sets `WORKSPACE_ROOT=/workspace`, but the EnvironmentFile (`/etc/substrate/env`) sets `/workspace/git/super-repo` and **wins**. 680 notes were unread since 07-25. `HOST=0.0.0.0` drop-in for the human surface lives in a fixture, not the image | partial | [LIVE] Both nodes' `systemctl cat development-vessel` still carry `Environment=WORKSPACE_ROOT=/workspace` (line 19) while every vessel process has `WORKSPACE_ROOT=/workspace/git/super-repo`. The split persists. |
| 09-24 | `CUTOVER_LEASE_WAIT_MS=330000` stopgap drop-in. Gap `trace-persistence-and-retention-are-steered-by-environment-variables…` (human, ×2, then `recommit-…` 09-26) | stopgap | All open [LIVE]. `TRACE_RETENTION_ACTIVITIES` is still an env default at `trace-retention.ts:158`. |
| 09-26 | Gap `the-compose-lane-cap-is-an-env-var-frozen-at-boot…`. `SUBSTRATE_PUSH_VESSELS` / `GAP_STORE_ENDPOINT` reached units only now. `766f68d` removes a hardcoded human-surface verification bypass | — | [LIVE] `COMPOSE_MAX_CONCURRENT=3` is in a node-1 drop-in (`compose-cap.conf`) and **absent on node 2**. The same code behaves differently per node by an unobservable knob. |
| **09-27 23:40Z** | `a198907` (autonomous, self-fact-divergence step 1) adds `const AUTHORING_ROOTS_PATH = process.env.AUTHORING_ROOTS_PATH ?? …`. It is read only by a log line, and the sweep closed it `landed_verified` | verified | Reverted by `4068e7e` at **23:44Z** (4 min). Gap `a-class1-literal-step-is-verified-by-a-hollow-write-whose-only-reader-is-a-log-line` is open. |
| **09-28 02:27Z** | `9cfdea4` (autonomous, failing-test gap) adds `if (!process.env.CONCEPT_DB_URL) return null` to **production** activity-api code to make a test pass. This is an env gate plus a discovery bypass | passed own checks | Reverted by `fb0a18a` at 02:59Z (32 min). Gap `an-operator-verdict-that-a-passing-landing-regressed-has-no-reader`: the 4 reverted autonomous landings (a198907, c4bb14d, 9cfdea4, af2c737) never reached attempt settlement, class posterior or compose_lesson. |
| 09-28 | `da76f061` (surgical-gap-scan static detector) **reverted** by `807b92ef` | — | Revert text: "A static scanner, if wanted, belongs as a graded resolver like `env_gate_scan`, not a host timer script." **Do not propose another host scanner.** Gap `test-runs-inherit-the-live-environment-and-write-to-live-services` opened. |
| 09-29 | Present state | — | See §5. |

**Recurrence count.** The per-shard `recurrences` values in the class file overlap and must not be summed (they total over 150). Distinct **fix → return** episodes that git or the live system independently corroborates: (1) write-allowlist 08-14 → 08-17 → 08-30 → still open; (2) auto-draft inversion 08-18; (3) DENSE_BACKFILL flip-flop 08-15..18; (4) embedding-provider re-gate 08-18 after the 08-17 port; (5) `GAP_CLASS_OPEN_CAP` minted on the day of the env-gate detector 07-04; (6) `WORKSPACE_ROOT` EnvironmentFile-wins 07-24 → 09-22; (7) key-drift/EnvironmentFile 07-27 → 07-29 → 09-19; (8) policy files erased 08-16; (9) `LLM_FALLBACK_MODEL` 07-12 → 08-03; (10) a198907 09-27; (11) 9cfdea4 09-28; (12) edit-gate bypass "restored" ≥08-28 → still 1. That gives **12** recorded recurrences, from 2026-03-25 (first seen) to 2026-09-29 (last seen).

---

## 2. Root causes

1. **The cheapest gate the drafter can write is `process.env.X`.** The shaped alternative is not discoverable. `substrate_tuning_param` is a table, not an advertised shape [LIVE: the registry has no tuning shape]. The drafter's context never offers it, so it reaches for env (git-activityapi: "the drafter reaches for process.env as the cheapest gate").
2. **The one compliant seam loses to env.** `getTuningParam` reads row → env → default, but call sites short-circuit env first. [LIVE] `activities.scoring.ts:126`: `if (process.env.SF_BLEND === '1' …) return true;` runs **before** `getTuningParam('SF_BLEND', …)`. Shaped storage is also non-durable (policies/ erased 08-16), so operators fall back to drop-ins.
3. **Close predicates certify provenance, not the effective condition.** A commit naming the gap id closed it (bafd83d rename). A literal class1 closed a hollow log-only read (a198907). No predicate evaluates "is behaviour X still decided by an env read at runtime?"
4. **The landing-seam law-1 lens is advisory and blind by construction.** [LIVE, tested with the live regexes] `ENV_GATE` matches only dotted `process.env.X` preceded by a branch token, so it misses `process.env["X"]` (the fs-write form) and `const X = process.env.X ?? …` (a198907). `BOOTSTRAP_ENV` exempts any name containing `URL`, `_PATH$`, `_DIR$`, `ENDPOINT`, `MODEL`, so `if (!process.env.CONCEPT_DB_URL)` (9cfdea4) is **exempt**. These are exactly the store-location and endpoint names that fork state (`WORKSPACE_ROOT`, `GAPS_PATH`, `AUTHORING_ROOTS_PATH`). The notes go to an LLM judge that is fail-open on error or parse failure.
5. **The detector's definition is too narrow and has no reader.** `env_gate_scan` flags only env names **not set** in `/etc/substrate/env` plus unit files whose unset branch disables something. A set knob (`MITOSIS_DIRECT_PUSH=1`, `COMPOSE_MAX_CONCURRENT=3`), a threshold (rejected 09-05) and a per-node divergence are all invisible to it. It is advertised in the registry [LIVE] but nothing schedules it: 0 selections in `thompson_selection_log`, 0 in `execution` (5-day window) [LIVE], and no traced output in 30 days (live-resolvers). No `env`-derived gap id has been filed since the store began on 09-18.
6. **The env bus is ungoverned bootstrap software.** gen-env.sh (1,801 lines), EnvironmentFile precedence (the file beats `Environment=` regardless of order), empty-string vs unset (`??` defeated by `""`), per-node drop-ins. No instrument watches the effective process env against intent (config-surface-probe is uninvoked, and substrate-config reports without refusing).
7. **Failure verdicts do not reach the drafter.** Operator reverts of env-gating landings (4068e7e, fb0a18a) have no reader (open gap 09-28), so the class lesson never becomes a compose-time constraint.

---

## 3. Why it recurs: the missing shared capability

Every episode crosses one seam: **the moment a diff is admitted to land, and the moment a process's effective behaviour-config is read.** At that seam there is no **enforced, graded law-1 conformance capability**, meaning a deterministic check that:

- sees every env read form (dotted, bracketed, aliased const) and classifies it as bootstrap vs behavioural by **use** (does the value reach a branch or decision?), not by name suffix;
- **refuses** (not advises) a landing that adds a behavioural env read, at both landing paths (feature_compose and patch_with_tools / apply_proposal_as_patch);
- measures the **effective** process env on every node, flags behavioural names that are set, unset, blank or node-divergent, and closes gaps on that effective condition;
- offers the replacement: an **advertised shape for tuning params / policies with durable storage and row-wins precedence**, so that when the gate refuses, the drafter has a cheaper compliant path in context;
- feeds each refusal or operator revert back to the compose lesson for the drafter.

Without it, operator ports (08-16..17) are undone within a day by autonomous landings (08-18). Autonomous "fixes" satisfy gap text literally (rename, inversion). The one detector churns on itself. Each surviving law-1 port depends on someone remembering the law.

**Shared capability name:** *law-1 conformance gate + shaped tuning surface* (seam: the landing gate in `development-vessel/src/resolvers/feature-compose.ts` `detectArchitectureViolation` / `patch-with-tools.ts:1320`, plus `env_gate_scan` as its graded runtime-side resolver, plus `activity-api/src/lib/tuning-params.ts` promoted to an advertised shape).

---

## 4. Prior attempts at that same capability, and why each did not hold

| Attempt | Where / when | Why it did not hold |
|---|---|---|
| `env_gate_scan` resolver (substrate-minted) | dev-vessel `744a3cd` 07-04. 12 commits on the file, 11 Substrate Autonomous [LIVE] | Definition covers only unset names. Threshold blindness was rejected 09-05. Not scheduled by any activity or rhythm (0 selections, 0 executions [LIVE]). Its gap filing produced churn: 96 compose-churn gaps on its own file by 09-13. `GUARD_RE` corrupted by c532795 (09-15). Its fulfilment resolver `env_gate_fulfilled` called an unmounted route and was deleted 08-29 (60e3154). |
| `detectArchitectureViolation` law-1 rule | feature-compose fb9b1e1 / 33381f1 (≤07-29). Reused for L11 only as a hard fail in patch-with-tools (1a507d1) | Advisory by design ("we do NOT hard-block on a heuristic"). The judge is fail-open. The regex misses bracket and const-alias forms and exempts `URL`/`_PATH`/`_DIR` names [LIVE test]. It let 9cfdea4 and a198907 land. It would have flagged 429c7e5 only as a note. |
| config-surface audit + `config-surface-probe.sh` | 08-09 / 08-21, `validation/findings/config-surface-audit.md` | Invoked by nothing (Makefile:159 comment). By the script-retention rule it cannot be trusted. |
| `substrate-config` / `env.provenance` | 08-20 | It tells you which tier supplied a value. It refuses nothing and does not distinguish behavioural from bootstrap. |
| `substrate_tuning_param` table + `getTuningParam` | migration 152, 06-04 onward. `2ededef` 08-22 | Not a shape (absent from the registry [LIVE]), so neither the drafter nor the walk can discover it. Env still wins at call sites (SF_BLEND). Only 4 rows. The flagship `THOMPSON_DECAY_HALFLIFE_DAYS` has no row. |
| Shaped policy files + producers (`walkBudget`, `lessonExecutionPolicy`, `docFixPolicy`, `bodyHonestyPolicy`) | f87f52f / a848aee 08-16. docFixPolicy 07-12 | Storage erased inside a cleaned worktree within about 50 min. `POLICY_ROOT` was never moved. Files are per-node (node2-runtime: `process.env[X] ?? "/workspace/…"` gives per-node forks, not replicas). docFixPolicy kept the env fallback. `bodyHonestyPolicy` had 0/417 producer reads. |
| Operator law-1 porting campaigns | b79c2ba, 4f7a817, 02f168c, ca286e0 (08-16..17). d3d29da, d81ab34 (08-17). 42302670 (08-22) | Instance fixes with no gate behind them. Re-gated the next day (0f79ff2 / 35f86fb, 429c7e5) and again 09-27/28. |
| Gap-driven autonomous removal (`gap-env-gated-*`) | write-allowlist ×6 landings 08-14..08-30. auto-draft 08-18 | Close predicate = commit provenance (openspec-5 Class 3). The drafter satisfies the text literally, yielding a rename, an inversion or an unreachable throw. |
| PreToolUse vessel edit gate as operator-side enforcement | `.claude/hooks/substrate-vessel-edit-gate.sh` | Itself env-gated. `SUBSTRATE_ALLOW_DIRECT_EDIT=1` has persisted since ≤09-06, so it is inert. |
| Static host scanner (surgical-gap-scan) | da76f061 → reverted 807b92ef 09-28 | Reverted as a duplicate of the graded-resolver route. The system has already ruled that the capability belongs in `env_gate_scan`, not in a new script. |

**What held:** the attempts that deleted the gate and replaced it with discovery or data held: `559a55d` (floor via discovery), `92f3336` (EXECUTABLE_RESOLVERS ∪ discovery), `8bd2fff` (model pins → policy), data-driven LLM arms (07-19), and `61ae51b` (blank-key handling). These are the patterns to keep.

---

## 5. Current verified state [LIVE, 2026-09-29]

- **Env surface, same method on both nodes** (distinct names; `.X` and `["X"]` normalized; `*.test.ts` excluded; container clones at identical HEADs on both nodes): activity-api **128** (39783b0), development-vessel **168** (f451e42), goal-host **57** (bc99f91), boredom 42, concept-db 32, llm-resolver 29. The history comparison figure "138 distinct names in activity-api src, 19 in config.ts" (git-activityapi) was measured with a different method. Since 2026-09-01, 50 Substrate Autonomous dev-vessel commits and 6 activity-api commits changed `process.env` occurrences (`git log -S`).
- **Per-node divergence of behaviour knobs:** `COMPOSE_MAX_CONCURRENT=3` is on node 1 via drop-in `compose-cap.conf` and absent on node 2. Node 1 has `SUBSTRATE_PUSH_VESSELS`, which node 2 lacks. `MITOSIS_DIRECT_PUSH=1` (unit line 29) on both. `ROUTE_EDIT_INTENT_TO_COMPOSE=` (empty string, present) on both. `PREFER_LIBP2P_ROUTE=1` in the node-1 goal-host process. `EMBEDDING_PRIOR_ENABLED=true` in every process checked.
- **`WORKSPACE_ROOT` split persists:** unit line 19 `Environment=WORKSPACE_ROOT=/workspace`. Every checked process has `/workspace/git/super-repo` because the EnvironmentFile wins. Same on both nodes.
- **fs_write scoping: none.** `WRITE_ALLOWLIST` is unset in the dev-vessel process on both nodes. The guard at `fs-write.ts:53` skips the check, and the throw at :31 is unreachable.
- **Auto-draft inversion still in HEAD:** goal-host `src/index.ts:16175`.
- **Runtime-drift repair disarmed:** `RUNTIME_DRIFT_REPAIR` unset on both nodes. 12 `runtime-drift-*` gaps open.
- **Detector:** `env_gate_scan` is advertised in the registry, with 0 selections and 0 executions observed, and no env-derived gap filed since 09-18.
- **Landing gate:** `detectArchitectureViolation` is advisory. It misses 2 of 4 known law-1 lines and exempts a third (tested with the live regexes: a198907 not matched, fs-write bracket form not matched, 9cfdea4 exempt, 429c7e5 flagged).
- **Tuning seam:** 4 rows (`TD_LAMBDA 0.6` 09-16, `SF_BLEND 1.0` 09-25, `YIELD_FLOOR 0.1`, `PROBE_NULLNONE_FIXED 3.0`). Not a registry shape. SF_BLEND call site reads env before the row.
- **Open env gaps in the live store:** 39 rows match env/law-1 patterns (34 open, 3 closed, 2 superseded), including `trace-persistence-and-retention-…` ×3, `the-compose-lane-cap-is-an-env-var-frozen-at-boot…`, `gen-env-re-quotes-…`, `test-runs-inherit-the-live-environment…`, and `a-class1-literal-step-…-log-line`.
- **Operator side:** `.claude/settings.local.json` `SUBSTRATE_ALLOW_DIRECT_EDIT: "1"` (mtime 2026-09-06). The host port for the cockpit registry (`:18100`) did not answer, and the registry was read in-container.

---

## 6. Keep / organize

- **Keep and promote:** `env_gate_scan` as the one graded runtime detector (per 807b92ef). Widen its definition to "a behavioural env read that decides a branch, whether the name is set, unset, blank or node-divergent". Repair `GUARD_RE`. Schedule it through a rhythm impulse, not a timer. `detectArchitectureViolation` as the landing-side rule: add bracket and const-alias forms, classify by use rather than name suffix, and make the law-1 rule a **refusal** on both landing paths. `substrate_tuning_param` as the replacement surface: advertise it as a shape, put the row first at every call site, persist it in the DB (not the worktree).
- **Keep as patterns:** delete-the-gate-and-use-discovery (559a55d, 92f3336, 8bd2fff) and data-as-roster (llm-arms.json).
- **Retire:** `config-surface-probe.sh` (no caller). The `gap-env-gated-*` gap text genre whose close predicate is a commit (use an effective-condition predicate). The `SUBSTRATE_ALLOW_DIRECT_EDIT=1` standing setting, or else the CLAUDE.md claim that the gate exists.
- **Kill switches stay env** (reports-5 principle: outside the substrate's authoring reach): `MITOSIS_DIRECT_PUSH=0` only. The exemption list should be explicit and short, not suffix-based.

## 7. Retire condition (measurable, checked continuously)

A bare count of `process.env` reads can be satisfied by a rename (bafd83d), so all four must hold at once:

1. **Refusal is proven by a graded activity.** A synthetic diff that adds a behavioural env gate in each of the three forms (dotted branch, bracket, const-alias with `??`, including a `*_URL`/`*_PATH` name) is **refused** by both feature_compose and patch_with_tools. The activity runs on a rhythm and reaches on at least 95% of runs over 14 days, with a positive control (a bootstrap `PORT` read) admitted.
2. **Effective-condition detector.** `env_gate_scan` executes at least daily on **both** nodes (traced executions exist), and its gaps close only when the effective process env and source no longer decide the named behaviour.
3. **Non-increasing surface.** The normalized distinct-name count per vessel (method in §5) does not increase over a rolling 30 days, and no autonomous commit in that window adds a behavioural env read (`git log -S process.env` filtered by the gate's classifier finds 0).
4. **No node divergence.** The set of env names that differ between the node-1 and node-2 effective process env for the same vessel is a subset of the declared bootstrap set (identity, port, advertise endpoint, secrets). Today it is not: `COMPOSE_MAX_CONCURRENT` and `SUBSTRATE_PUSH_VESSELS` differ.

The class is retired when 1 to 4 have all held for 30 consecutive days **and** no env-gating gap has been reopened or re-minted under a new id (a durability check across gap ids, law 7).

## 8. Related classes

`dossiers/dormant-mechanism.md` (env-off capabilities: vLLM, failover, drift repair, SCHEMA_AUTOAPPLY), `dossiers/false-verification.md` (rename, inversion and log-only closes certified as landed), `dossiers/write-read-mismatch.md` (policy readers with no producer, and a198907's log-only reader), `dossiers/endpoint-routing.md` (`*_URL` env defaults bypassing discovery, as in 9cfdea4), `dossiers/memory-recall.md` (the `WORKSPACE_ROOT` fork), `dossiers/trace-store-db.md` (retention and caps env-steered), `dossiers/selection-learning.md` (SF_BLEND/TD_LAMBDA frozen or env-short-circuited).
