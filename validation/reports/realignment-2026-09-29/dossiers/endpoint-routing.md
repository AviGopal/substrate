# Dossier: endpoint-routing

**Class, one line:** a caller works out where a shape lives by itself (a pinned host:port, an env default, its own join of `endpoint` + `resolve_endpoint`, a first-match pick, or a loopback or host-mapped address) instead of getting one routed, dialable address from discovery. The result reads as "no producer", silence, or a success-shaped empty answer. Each fix patches one call site, and the class comes back at the next one.

Sources: `classes/endpoint-routing.json` (66 attempts, 45 problems, 6 claims; a few rows keyed `auth-credential-plumbing` are excluded here), `raw/*.md`, and live checks made on 2026-09-29 around 04:50 UTC against `substrate-live` (node 1) and `compose2-live` (node 2). Everything was read-only.

---

## 1. Timeline (dated; every "fixed" or "first" claim is paired with what later showed)

| Date | Event | Claimed at the time | What later showed |
|---|---|---|---|
| 2026-03-05 → 06-22 | Vessels invisible in discovery; hardcoded ports and URLs (9 recurrences, git-super-1) | — | Registration fields and ids differed per vessel |
| 04-24/25 | `vessel-discovery-client` package gains the resolver contract fields (a5881469); discovery moves from hardcoded `localhost:8080` to the impulse protocol (4bf5a11d, 5fe91335) | "use impulse protocol for vessel discovery" | Superseded. Hardcoded ports came back (41feb26b obsidian 27183 vs 27182, 06-22) |
| 05-23 → 05-25 | F-019..F-084: 401/404 between vessels and discovery; ias `85a651a` re-registers on heartbeat 404; super-repo 45af2d39/ef26b461/67bbcdb6/6ef640c3 fix systemVessel, unique ids and the activity-api endpoint vars | worked (575dba23: template registry 2 → 28) | This one held. The same idea had to be rebuilt 09-23 for development-vessel (57c759a) |
| 05-30 | Palette write resolvers: the drafter prompt tells the LLM `substrateGap_write → POST http://127.0.0.1:8270` | "drafter can mint gaps/concepts" | :8270 is now stateful-ui-vessel. **Still in `development-vessel/src/seed/draft-gap-closing-activity.ts:118` today**, and 11 non-test src files pin 8270 (verified 09-29) |
| 06-15 → 08-29 | `isIPLoopback`/127.0.0.1 logic touched in 47 goal-host commits (30 autonomous) | — | 08-10: 14 autonomous commits in 5.5 h oscillated on loopback preference (route-edit-eaa86280, 344f970..9c90131) |
| 06-22 | Obsidian endpoint repointed by env (41feb26b3) | worked | Still a pin. Recurred as the 09-22 pinned :8270 escalation writer (248 escalations nobody read) |
| 06-29 → 07-16 | goal-host `asResolvePath` rewritten 4 times (ddf7a1d, c51d3f8, 298eea5, d2a8d88); **07-05 `b135638` (operator) "normalize absolute resolve_endpoint at all remaining resolve sites"**; 07-07/07-15 surgical-hardcoded-endpoint landings 02291af, e3a4ce2, a08207c | "all remaining sites" | Held for 11 weeks, until autonomous `9531c5f` (09-20) changed the helper's contract back |
| 07-01 | `DiscoveryRegistrationLoop` added to the shared package (35eb02f5) | "consumers migrate later" | Never migrated. Only `identity-vessel` depends on the package (verified 09-29) |
| 07-04 | activity-api discovery-client envelope fix, 3013e76 (bare `{shape}` → `{pointer:{type:vesselCapability}}`) | worked | Had returned HTTP 400 "forever" without anyone noticing. Envelope drift between vessels was still reported 09-22 |
| 07-05 | ribosome e052535 "surgical hardcoded-endpoint fix" | fixed | It only wrapped the literal (`process.env.X ?? 'http://127.0.0.1:8210'`). Ribosome still has 4 files with loopback literals (09-29) |
| 07-07 | `f85f0536`: full-URL `resolve_endpoint` enters the registry (R15 start) | — | Created the "absolute vs relative" split. On 09-29 discovery returns 6 absolute and 5 relative rows out of 11 |
| 07-19 → 07-29 | Federated LLM failover rebuilt separately in feature-compose, patch-with-tools and llm-completion-dispatch (ddaf74e, dde7d33, e252256, b43062d, 534189a, da08516, d08774a, 626225e, ec8ef67) | — | Operator: "We've fixed this particular error multiple times". c3194ee (08-02) "restore LLM egress at all four llmCall recovery sites" |
| 07-19 | openspec `vessel-duplicate-genres` (distribution_policy) to replace discovery `candidates[0]`; `obsidian-pebkac-config` | spec | 6ab2e24 built the field, but tasks.md is 0/19. Only the obsidian sidecar declares a policy. Discovery `/resolve` still falls through to `candidates[0]` (index.ts:243, verified). Obsidian spec T1-T6 unchecked |
| 07-19 | Honest `/bootstrap` specified (again on 09-12) | specified | Still host-dependent on 09-29 on both nodes; `fed:join_door_host_dependent` open for 18 sweeps |
| 07-21 | engine.ts:258 first-match replaced by a healthScore pick (8e8fd30 substrate, 8602362 operator) | partial | healthScore is always undefined because discovery advertises status as a string. A reach-graded producer posterior was never built |
| 07-24 | A stale `METABOB_API_KEY` in the volume secrets shadowed the env, so `discover()` came back empty; the operator aligned it by hand | worked | The class fix (volume must not diverge from env) was only proposed. Recurred 09-10 (every fleet key revoked; 0-step terminations 85/12 h) |
| 08-01 → 08-02 | Drafter degenerate self-modification loop: 50 commits pinned `127.0.0.1:8100` and `CONCEPT_DB_ENDPOINT`, destroyed failover, crash-looped hub and spoke; fixes c20a972, 4fc14ab, 33afcc8+978a70f, c3194ee, 93b18ba, 35c6b33 | fixed | The fix had to land twice. The drafter treats env-default literals as the house idiom (there are 174 dev-vessel files with loopback literals for it to copy) |
| 08-07 | human-surface proxy remaps a loopback registry row to the discovery host (VALIDATION-2 s8) | "502 fixed at its documented cause" | The remap holds for goal-host, but the `GOAL_HOST_ENDPOINT`/`ACTIVITY_API_ENDPOINT`/`DEV_VESSEL_ENDPOINT` pins remain. 08-08 d4 (resolve activity-api by shape) went UNFAVORABLE, rolled back |
| 08-07 | Concept recall routed through discovery (53d9080, 5ab2a21, 1adbad4) | fixed | `:8260` still touched 8 more times through 08-29 |
| 08-08 | Producer discovery 8 s timeout failed open to "no producer" | partial | "abstain, not absence" was never implemented; the gap `producer-discovery-fails-open-to-no-producer` was filed |
| 08-09 | **`4fdf5b91` lifts the loopback repair (`reachableFrom`) into `@avigopal/vessel-discovery-client`** | "consumers adopt the fix rather than re-derive it" | Consumer switch was **not done** (stated in the commit). On 09-29 `reachableFrom` is used in ONE file, `human-surface-vessel/src/routes/proxy.ts` |
| 08-09 | trace-store-reconcile: hardcoded 127.0.0.1:8080 fixed (5dcfc60, af12cf3, 30aac7c, 4635174) | fixed | af12cf3: "my own fix was still broken" |
| 08-20 | Port-preserving spoke join (gen-env + Makefile) | worked | The spoke had joined a different substrate (:23100 → :18100). This held |
| 08-21 → 09-09 | Empty-env `??` defaults: env() helper per site (3409fac, fbb2441, f22d88e, 57b6cd6, d5a4aba) | — | d5a4aba was reverted by f9f1ea2. Per-site again |
| 09-07 | activity-api f027c1f surgical hardcoded-endpoint fix at one site | fixed | 8 literal host:port strings remain in activity-api src; 6 files have loopback literals on 09-29 |
| 09-10 | Fleet API keys revoked by a rotation whose re-issue never ran; operator re-issued them | worked | Silent 401s had read as an empty vocabulary. Node 2 still logs 6,844 discovery 401s and 1,194 goal-host 401s (09-26..29) |
| 09-17 | ias `d1ebb66` (operator): the discovery adapter builds URLs (libp2p via egress, absolute pass-through, path join) | worked | Came after 5 failed substrate attempts on gap-mu6dazag. It is the **second** copy of the joiner |
| 09-18 | 80ab9659: engine multiaddr-as-URL fix 2084b4b | "a substrate-authored commit landed" | Not pushed until 03:16 (dead PAT). The same day a dead-port discovery row caused about 45 min of fleet-wide 0-byte grounding; it was healed by restarting local-tools |
| 09-20 | discovery 7cc9da4: `/register` validation + probe-and-evict of dead head rows | fixed (4th strike) | A 5th strike came the same day. The rogue registrant is unidentified: `discovery-registrations-carry-no-registrant-identity…` is **open** |
| **09-20 02:05** | **Autonomous `9531c5f`** (gap `asresolvepath-discards-a-working-absolute-resolve-url…`): `asResolvePath` returns `protocol//host/path` instead of the path | gap **closed** (in the live store) | Every `${endpoint}${asResolvePath(..)}` caller now builds `http://a:1http://b:2/resolve`. The 07-05 fix was reversed without anyone updating the callers |
| 09-20 03:19 | Autonomous `7bb864b`: `routeFor` splits an absolute `resolve_endpoint` into origin + path (index.ts:7805) | http_fetch worked 30 min later | goal-host now holds **two opposite conventions** (routeFor strips to a path; asResolvePath keeps it absolute). "fetch() URL is invalid" was back on 09-21 |
| 09-22 07:12 | Autonomous `6c98916`: rawResolve guarded (1 site) | gap `rawresolve-concatenates…` | 9.8k invalid-URL failures continued (09-24 1,751 · 09-25 1,562 · 09-26 3,422 · 09-27 2,196 · 09-28 897) across 111 activity ids. The gap is **still `open`** in the store |
| 09-22 | Memory index: "THE RESOLVE-URL JOINER OVERSHOT"; gap `seven-more-resolve-url-sites-still-concatenate…` filed | law "GREP EVERY CALL SITE" written | Handed back 4 times with no `directed:true` (WITHHELD FAVORABLE). Steps 1-3 closed `superseded_hollow_decomposition` 09-28; parent and `-narrowed` still open, plus 3 `recommit-` children |
| 09-24 | Host watchdog restarts local-tools when its discovery row is hijacked (#25) | mitigated | Symptom mitigation only. `a-transient-verify-instance-registers-an-ephemeral-endpoint…` still open (×2) |
| 09-25 | Autonomous 8c31cdb: 52-line `globalThis.fetch` monkey-patch as a discovery-first shim | — | Reverted autonomously the same day (6ce1446) |
| 09-27 | Autonomous boredom `f28bc06`: inline `boredomDiscoverResolveUrls` | — | **Third copy** of the joiner (goal-host routeFor, ias discovery-adapter, boredom). Discovery `/resolve` has a fourth |
| **09-28 13:00** | **`5ca51be`** (substrate-drafted, operator-**directed**): startsWith('http') ternaries at index.ts:7457 and :15128 | 13:48 "first time the system verifies a fix to its own tool plane", retracted 13:58; **15:27 "system closed a landing on its own measurement"** (landed_verified) | Directed, not autonomous. It needed 4 seam repairs first (listing b8671c9/89f04fb, reporter, sweep starvation, cutover stamp). 9 concatenating sites remain (below) |
| 09-28 17:06 → 17:30 | Operator extended `surgical-gap-scan.ts` with a resolve-join detector (da76f061) | — | Reverted (807b92ef): it duplicated the open gaps and the trace-side oracle. "Belongs as a graded resolver like env_gate_scan, not a host timer script" |
| 09-29 | MCP cockpit: `registry_query` "socket connection was closed unexpectedly"; `goal_status` "could not find goal-host-vessel via discovery" | — | Host `localhost:18100` gives 000 while `127.0.0.1:18100` gives 200 (verified). Vessels bind IPv4 only; pasta forwards ::1; the cockpit config says `localhost` |

**Recurrence count.** The collectors sum to at least 9 + 15 + 16 + 12 + 8×6 recurrences across shards (they overlap). The goal-host resolve-join alone went correct 07-05, broken 09-20, and partly fixed 09-22 and 09-28, with **4 gap "hats"** for one defect.

## 2. Root causes

1. **There is no single URL-construction seam.** One registry row carries two hosts, `endpoint` and (often) an absolute `resolve_endpoint`, and nothing says which one wins. Discovery stores what the registrant sent. It defaults only a missing value (`registry.ts:241`) and never normalizes the form. Live on 09-29: **6 absolute, 5 relative** rows out of 11 (`/dispatch`, `/resolve`, `/v2/impulses/resolve`, and absolute rows whose host `localhost` differs from the `endpoint` host `127.0.0.1`). Every consumer re-derives the join, which gives 18 inline `startsWith("http")` joiners in dev-vessel, goal-host, llm-resolver and the others, plus the ias adapter, boredom, and discovery's own `/resolve`.
2. **A shared helper's contract changed without its call sites.** `9531c5f` flipped `asResolvePath` from path-only to absolute. No test or type distinguished "path" from "url" (both are `string`), so the 9 concatenating sites kept compiling.
3. **Callers pin instead of routing by shape.** There are 465 `127.0.0.1:8xxx|localhost:8xxx` literals in live vessel src (174 dev-vessel files), 14 files with `svc.cluster.local` defaults, 11 files pinning :8270, an LLM prompt that names :8270, and env-var fallbacks. A pinned writer cannot learn the peer moved (:8270, :27183, :18401, the 248 escalations).
4. **Registration is not bound to identity or to dialability.** Transient verify or test instances register ephemeral ports under the live vessel id, and heartbeats keep them alive. Rows advertise the registrant's in-container loopback or a host-mapped `host.containers.internal:18090` (the live dev-vessel row). `derivePublicEndpoint` keeps the loopback host. Liveness is a heartbeat, not a probe of the socket.
5. **Failure reads as absence.** An invalid URL, a 401 or a timeout becomes "no producer", `[]`, or 0-byte grounding. Nothing grades the routing layer, so infrastructure failures went into activity posteriors (auto-bridge-problem_detection sat at 63/2,348 ok before 5ca51be).
6. **Producer choice is first-match.** Discovery `/resolve` and engine.ts use `candidates[0]`. `distribution_policy` exists but nothing declares it, and no reach-graded producer posterior exists.
7. **Operator tools diverge from the vessels.** Hooks, the MCP cockpit and validation scripts use `localhost:18xxx` (21 scripts hardcode ports) and do not read the `substrate-connect` config. IPv4-only binds make `localhost` fail on the host.

## 3. Why it recurs: the missing shared capability

The class keeps coming back because there is **no single "shape → callable URL" resolution primitive** at the discovery seam, and nothing grades it:

- The fixed point (discovery) holds **unnormalized, unverified** addresses.
- Each consumer then **re-derives** reachability, the join, and the producer choice inline. That makes N copies, and every fix is a per-site patch that is "declared closed" while the next site surfaces as a "new" gap (`live-gaps.md` §5; `transcripts-4.md`: "resolve-URL joins (11 sites) recurred because instances were patched separately").
- Nothing **measures the class**. The invalid-URL oracle is a trace predicate, not a scheduled graded activity. So an autonomous edit (`9531c5f`) could re-break a 07-05 fix and close its own gap as verified.
- The drafter learns from a codebase in which the pinned literal is the most common idiom, so it writes new pins (f28bc06 on 09-27, written after the defect was documented on 09-22).

This is the concrete form of the operating-model failure "same issue recurring for the same reason". The behaviour is not encapsulated in one versioned resolver. It is copied into every caller, so evidence never accumulates on one thing that could be improved and reused.

## 4. Prior attempts at this same capability, and why each did not hold

| Attempt | When / where | Why it did not hold |
|---|---|---|
| Shared `vessel-discovery-client` package (resolver contract fields, `DiscoveryRegistrationLoop`, `reachableFrom`) | a5881469 (04-24), 35eb02f5 (07-01), 4fdf5b91 (08-09) | Every commit says "consumers migrate later". Only identity-vessel imports it, and `reachableFrom` is used in 1 file. The package has **no URL-join function**. It went unadopted because the super-repo placement rule blocked its tests and no vessel was made to depend on it |
| "Normalize absolute resolve_endpoint at all remaining sites" | b135638 (07-05, operator) + 4 asResolvePath rewrites | Held for 11 weeks. It normalized in consumers, not at the registry, so one autonomous contract flip (9531c5f) undid it; no test pinned the contract |
| asResolvePath absolute (9531c5f) / routeFor split (7bb864b) / rawResolve (6c98916) / walk-path ternaries (5ca51be) | 09-20 → 09-28 | Four per-site patches with two opposite conventions. 9 concatenating sites remain (index.ts 9460, 12746, 12776, 13507, 13519, 13994, 14347, 16678, 16797), plus unguarded 8251 and dev `feature-compose.ts:538` |
| ias discovery-adapter URL construction | d1ebb66 (09-17, operator) | Correct, but local to ias. goal-host and boredom re-implemented it |
| Discovery-side defences: /register validation + probe-and-evict | 7cc9da4 (09-20) | They evict dead rows but do not normalize the form, bind a registrant identity, or compute the address as the caller sees it. The class self-heals rather than being eliminated |
| `distribution_policy` in place of `candidates[0]` | 6ab2e24 (07-31), spec 07-19 | The field exists but no vessel declares a policy (tasks 0/19), so the fall-through to `candidates[0]` is live |
| One routing idiom for LLM calls (`llmCallWithFailover`, discover-all + egress) | e252256, c8a1383, c3194ee (07-19 → 08-07) | Built inside feature-compose. The other callers (author-producer:286 :8220, ribosome replay-observer :8220, …) stayed on band-aids |
| Global fetch shim | 8c31cdb (09-25) | It tried to centralize routing by monkey-patching, which is the wrong layer. Reverted the same day |
| Static detector (surgical-gap-scan resolve-join pattern) | da76f061 (09-28) | Duplicated open gaps and the trace oracle; reverted. The right form is a graded resolver (like `env_gate_scan`) |
| Impulse conformance ledger seams 1, 2, 5-7 (move REST hops to discovery-routed impulses) | ≤ 08-05 → 09-28 | Dormant: "scheduled" since ≤ 08-05, and the dual-parse prerequisite never landed |
| TS vessel template "Known gap" (svc.cluster.local, 5 files) | docs | "Migrate at next significant revision" never happened. 14-15 files now carry the defaults, including the exemplar vessels the doc tells drafters to copy |

Things that **did** hold and should be kept: discovery's own `/resolve` forward join (index.ts:247, correct for both forms); `thompson_posterior` as a shape (the class-(b) repair); the port-preserving spoke join (08-20); routing anchors kept out of `.substrate-secrets`; re-register on heartbeat 404 (85a651a, 57c759a); ias d1ebb66; human-surface `reachableFrom` remap; 3013e76 envelope fix; the 5ca51be ternaries (they stopped the flood).

## 5. Current verified state (2026-09-29 ~04:50 UTC)

**Code (live clones on node 1; node 2 goal-host is the same HEAD `bc99f91`):**
- `goal-host-vessel` HEAD `bc99f91` (09-28 18:16). `asResolvePath` (index.ts:448) still returns an absolute URL. **9 sites still concatenate** `endpoint + asResolvePath(...)`: 9460, 12746, 12776, 13507, 13519, 13994, 14347, 16678, 16797. `8251` fetches `${sep0.endpoint}${sep0.resolvePath}` unguarded, inside a fail-open try/catch. Guarded sites: 7457, 8004, 15128. `routeFor` at 7805 uses the opposite (split) convention.
- The operator workspace checkout `repos/goal-host-vessel` is at `ff5fbb8` (09-23), behind origin (`bc99f91`). A reader grepping the operator tree sees different line numbers (7527/9151/…).
- 18 files carry inline `startsWith("http")` joiners (dev-vessel 17 sites, goal-host, llm-resolver:500); boredom:4175; ias discovery-adapter; discovery index.ts:247. Unguarded raw join: `development-vessel/src/resolvers/feature-compose.ts:538`.
- 465 loopback `:8xxx` literals in vessel src (non-test files per vessel: dev-vessel 174, activity-api 6, ias 6, goal-host 5, ribosome 4, boredom 3, human-surface 3, …); 14 files with `svc.cluster.local`; 11 files pin 8270 (10 dev-vessel + stateful-ui).
- `reachableFrom` (shared loopback repair) is adopted in 1 file. The shared package is imported only by identity-vessel.

**Registry (node 1 discovery `vesselRegistry`, 11 rows):** 6 absolute and 5 relative `resolve_endpoint` values in 3 path forms. `development-vessel-local` advertises `http://host.containers.internal:18090` (dialable in-container today: 200). `local-tools-vessel` endpoint is `127.0.0.1:8230` while its resolve URL says `localhost:8230` (both answer 200 in-container).

**Runtime (node 1 `execution` table, `failure_mode.reason`):**
- `fetch() URL is invalid`, per hour on 09-28: 10h 83 · 11h 105 · 12h 32 · 13h 5 · **0 from 14:00 to 04:50 on 09-29** over 13,478 executions. **Positive control:** the same predicate returns 480 for 09-27T14 → 09-28T04:50. So the loud path is fixed; the 9 latent sites have not fired, because development-vessel's row is relative today.
- `Unable to connect` since 09-28T14: **233** failures (125 `dev-vessel http_fetch HTTP 500`, 13 `concept_write → concept-db POST failed`, 9 `VesselResolver(federation_*)`), across gap-closing, conservation-audit and compose arms. **These are not attributed.** They could be pinned URLs in templates or restart windows. They need a positive control before being counted in this class.
- Node 2 (`compose2-live`): no local trace store answered the query, so node-2 invalid-URL counts are **unmeasured** here. Node-2 runtime notes report 9,172 "failed to register dev-vessel proxies: Unable to connect" on the syzygy inventory (pinned loopback for masked units).

**Gap store (`/workspace/git/super-repo/gaps/gaps.json`, 6,279 gaps):** 42 class-pattern gaps. Still **open**: `rawresolve-concatenates…` (its fix 6c98916 landed 09-22), `seven-more-resolve-url-sites…` (+ `-narrowed`, 3 `recommit-`), `gap-something-re-registers-local-tools…ephemeral-ports` (+ narrowed, 3 recommit), `discovery-registrations-carry-no-registrant-identity…` (+4), `a-transient-verify-instance-registers-an-ephemeral-endpoint…` ×2, `discovery-binds-loopback-so-the-published-port-is-dark…`, `the-human-surface-prefers-a-host-mapped-public-endpoint…` ×2 (+3 recommit), `solicitation-outcome-scan-pins-one-ui-endpoint…`, `a-test-run-in-the-live-container-registered-a-phantom-endpoint…`. Closed: `asresolvepath-discards…` (the regression-causing one), `resolve-url-walk-path-sites-7457-15128`, steps 1-3.

**Operator tooling:** host `localhost:18100` and `localhost:18090` return 000 while `127.0.0.1:` returns 200. `.metabob/config.json` endpoint is `http://localhost:18080`. The cockpit TRACK and INSPECT planes failed on 09-29.

## 6. Retire condition (measurable, checked continuously by a graded activity, not a host script)

The class is retired when **all** of the following hold for 14 consecutive days on **both** nodes:

1. **One join.** The number of source sites that construct a resolve URL from registry fields outside a single named primitive (a `resolveUrlFor(row, callerView)` shape or resolver served next to discovery, or discovery normalizing `resolve_endpoint` to one form at `/register`) is **0**. Checked by a graded scan activity over `*/src/**/*.ts` (excluding tests) for `${…endpoint}${…resolve…}`, `+ asResolvePath(`, and inline `startsWith("http")` joiners. Baseline 09-29: 9 + 1 + 1 concatenations and 18 inline joiners.
2. **Registry is one form and dialable.** 100% of discovery rows carry a normalized `resolve_endpoint` and pass a registry-side socket probe from the caller's vantage. 0 rows are on ephemeral ports or unbound to a registrant identity. Baseline: 6/5 absolute/relative, identity gap open.
3. **Zero runtime class failures, with a control.** `execution.failure_mode.reason CONTAINS 'URL is invalid'` = 0 per day, and `Unable to connect` failures are attributed per target URL, with 0 attributed to a pinned or loopback address for a shape discovery routes elsewhere. Each daily check first runs a positive control of the predicate on a known-nonzero historical window (09-27 = 480).
4. **No pinned peers in behaviour.** Loopback `:8xxx`, `svc.cluster.local` and `:8270` literals in non-bootstrap vessel src and in seed prompts trend monotonically to only the bootstrap tier (port binding, the discovery anchor). Baseline 465 / 14 files / 11 files.
5. **Durability (gap-triple item 3).** No new gap matching this class's pattern is opened for a site of an already-closed hat. The existing 42 are consolidated into one parent whose closure predicate is items 1-3.
6. **Cockpit parity.** Host tools and the MCP cockpit resolve goal-host via discovery using the `substrate-connect` config (no `localhost` literal), and `registry_query` / `goal_status` answer on both nodes.
