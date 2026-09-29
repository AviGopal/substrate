# Dossier: operator-instrument-fault

**The class in one line:** someone reading the system (the operator, a subagent, or a walk acting as an operator) gets a negative or a number back from a probe that was mis-addressed, matched itself, was truncated, used the wrong clock, or used the wrong credential. They then declare that something is broken, dead, absent or has landed. The claim is retracted hours later, and the same thing happens again through a different interface.

**Where this class ends and its neighbours begin.** Critic-2 set the key map: this key covers faults in *the reader's own instrument*. `false-verification` covers the *system's* judge (gates, oracles, closers) grading wrongly. The critic merged `llm-plane-misdiagnosis` into this key. Close neighbours are `endpoint-routing` (the same mis-addressing, but inside code), `write-read-mismatch` (two roots, two stores) and `memory-recall` (why the lesson is never recalled).

**Sources:**
- `classes/operator-instrument-fault.json`: 2 problem rows, 0 attempts, 0 claims. The claims below come from the raw notes.
- `raw/transcripts-2.md` §2.5 and §6b, `raw/transcripts-3.md` §"Operator instrument faults", `raw/transcripts-4.md` claims table and §6.
- `raw/memory-1.md`, `raw/memory-3.md`, `raw/memory-5.md`, `raw/memory-6.md`, `raw/memory-9.md`, `raw/memory-adjacent.md` §A7, `raw/validation-other-2.md`, `raw/openspec-1.md`, `raw/reports-1.md`, `raw/node2-runtime.md`, `records/_critic-2.json`.
- Operator memory files (named inline).
- Live, read-only checks on 2026-09-29 between about 04:59 and 05:10 UTC, against `substrate-live` (node 1) and `compose2-live` (node 2).

---

## 0. How big the class is (the counts overlap, so they are not summed)

| Source | Window | Count |
|---|---|---|
| `raw/transcripts-3.md` (the class json's `recurrences: 40`) | 09-05 → 09-18 (the table says → 09-22) | at least 40 listed instances |
| `raw/transcripts-2.md` §2.5 "Operator measurement errors" | 08-28 → 09-16 | 25 claims declared, then retracted |
| memory `reference-claim1-powered-null-and-eight-instrument-errors-2026-08-08` | one session, 08-08 | 8 |
| `raw/memory-adjacent.md` §A7 (query artifacts read as system state) | 06-14 → 08-10 | 15 or more |
| `raw/memory-3.md` (llm-plane-misdiagnosis, merged in here) | 07-20 → 09-14 | 5 |

The class json gives `first_seen` as 2026-09-05. That is only the start of the transcripts-3 window. The earliest instance cited below is **2026-05-26**, and the class is still recurring on **2026-09-29**, including during the writing of this dossier (§5).

---

## 1. Timeline (each "learned / written / fixed" claim is paired with what later showed)

| Date | Event | Claimed at the time | What later showed |
|---|---|---|---|
| 05-25 → 05-26 | F-069/F-081/**F-083 CRITICAL**: "a container restart would DESTROY all accumulated posteriors" (`UPSERT…CONTENT`, "α=300→85") | a critical defect | **Debunked 05-26** (`validation/findings/f-083-debunked.md`, 612521ce). The grep `UPSERT activity.*CONTENT` had matched template-definition writes, not `variant_performance_metrics` (raw/validation-other-2.md:55) |
| 05-28 | Audit F14: the auditor's own jq regex (`gap-closing:fm-`) dropped `fp-*` templates, which gave the finding "0 templates produced" (Finding 12). A truncated registry read gave the same result (inv-049) | Discipline adopted: "always emit `total_pre_filter` next to filtered counts" | Not carried forward. raw/openspec-1.md:53 and validation-other-2.md:95 call it "learned in May, re-learned in September" |
| 06-14 → 06-27 | Query artifacts read as stalls: `/execution-traces` returns oldest-first; an `activity:`-prefix filter; break-on-short-page pagination that truncated 4 lift-gate detectors; "3-day stall" was a wrong repo path; null-unsafe sort; `.applied` counted as landed; "0 mints" from a field the SCHEMAFULL table strips (the real count was 106) | each one was reported as a system defect at first | Each was retracted separately. No shared instrument discipline came out of it (memory-adjacent §A7) |
| 07-20, 07-23, 07-26 | **LLM plane "totally dead / quota exhausted"** (merged key `llm-plane-misdiagnosis`) | "quota death, no cascade, no funded provider" | Refuted 3 times. `llmModelPolicy` arms were disjoint from the keyed models, so `selectArm` returned null and fell to a dead default; the hub was funded throughout (memory-3:21). Fixed by policy rev8 and `d08774a` (failover) |
| 08-08 | A 9-agent audit plus the operator's powered study: **eight** of the operator's own measurements were wrong (z=-5.58 came from 39/50 HTTP 503s; a stale truth file; a regex that ORed replay with adaptation; …) | "every one would have been reported as a fact about the substrate" (memory `reference-claim1-…-2026-08-08`) | The same session wrote no shared instrument. The next session repeated the pattern |
| 08-08 / 08-10 | substrate-utils notes: "never collapse *tool failed* into *tool found nothing*"; `bump-submodules.yml` was green every 6 h and never bumped anything, so it was fixed to exit non-zero (`851c472`); `/api/gaps` fails soft to `{"gaps":[]}` and a hub blocker was declared that had self-healed 14 min later | the law was written down | memory-adjacent:118: the 09-15 law "appears in the substrate cache as new", five weeks later |
| 08-09 / 08-10 | "Validate a counting probe with a control write before reporting zero" (NUL grep, envelope per vessel) (memory-6:235) | law | Recurred 08-21 (`feedback-my-control-passed-for-the-wrong-reason`: the control varied the name and held meta constant, so it cleared the wrong axis) |
| 08-17 / 08-22 | "A negative is unattributed until a positive control shares its address, and its credentials" (reports-1:684). Four detectors built with negative controls | built with controls | The detectors held for their own instances only (reports-1: "a detector written from one remembered instance covers exactly one instance") |
| 08-23 | memory `feedback-check-before-filing-five-false-positives`: 5 would-be findings died at "already exists / already filed / consumer disagrees"; a stale clone reports a real commit as absent | "check first" | Recurred 09-10 ("0 landings" counted in a local tree the substrate never writes to) |
| 08-28 → 09-16 | 25 declared-then-retracted operator measurements (transcripts-2 §2.5): `CONTAINS` is an array op (08-29); `grep -c '"content"'` counted the wrapper (08-31); **PDT vs UTC `--since`, "zero autonomous landings"** (08-31 06:30); `rg -r '$1'` wrote ripgrep help into the data file (09-05); non-route `/dispatch/<id>` returned empty (09-05); `NONE`≠`NULL` (09-06); non-UTF8 grep (09-07); `datetime > 'string'` matched the whole table (09-08); … | each was a finding when made | Each was retracted within hours |
| 09-05 | `$14` in POSIX sh is `${1}4`, so every per-process CPU number in the load investigation was wrong (memory `reference-dollar-14-in-posix-sh…`) | two published claims | Retracted. A busy-loop positive control caught it. Law: "a sum of exactly zero across ~90 processes is a broken probe" |
| 09-09 00:56 | "Not one was caught by re-reading. **Every single one was caught by a control.**" (transcripts-2 §6b) | the method is known | Faults continued daily, 09-10 → 09-18 |
| 09-10 → 09-11 | 09-10: "5 self-inflicted instrument failures". 09-11: `grep -c … \|\| echo 0` gave a false "LANDED"; the operator sent the derived tag `operator:claude` instead of `body.operator`, so every dispatch ran in the autonomous lane; the dispatch gate read **host** loadavg (Firefox/Steam) instead of the VM's (memory `reference-the-operator-field-not-the-tag-and-i-measured-the-wrong-machine-2026-09-11`). 09-11 12:41 "LLM plane dead", though 17 commits had landed through a 429 trickle | — | Each was fixed as an instance only |
| 09-12 → 09-14 | "four loose-substring false positives … sixth false zero" (09-12). A renamed probe; `graded=` vs `graded `; **host-local vs UTC −7 h**; sampled the wrong unit, so "an anthropic 401 sets no cooldown" was published and then retracted; a stale policy file (09-13). "four wrong greps" (09-14). LLM plane misdiagnosed again (09-14) | — | — |
| 09-15 | "ten refuted hypotheses on one throughput question: the inference record is ten for ten refuted, the measurement record three for three". User: *"Ask the advisor why we always have this habit."* Five false "X is unavailable" alarms in one session: host checkout vs `/workspace/git/vessels`; `llm-resolver` unit name (systemd fabricates `inactive` for a missing unit); `X-Api-Key` vs `Authorization: ApiKey` (concept-db, 5 vs 13 rows); dev-vessel vs stateful-ui ownership of :8270; discovery called unauthenticated with the wrong envelope | **Class law written:** memory `feedback-a-negative-result-is-unattributed-until-a-positive-control-shares-its-address` (09-15 23:59). It diagnoses why six earlier laws failed ("indexed by instance surface, not invariant") and names the system fix: *"an interface that echoed its resolution context could not be silently mis-addressed"* | **Violated within the hour** in the same session: `changesAreTestOnly` was read as dead code and a false-premise gap was filed ("the substrate cannot write a test"); 9 of 400 substrate commits were test-only and had landed. The system-side echo was not built then (see §4) |
| 09-15 | substrate-doctor check 4b, a "shape resolution round-trip … the positive control at the consuming layer" (`a5dd4b24`) | "wiring checks catch what liveness green cannot" | Held for its own check. It runs only when invoked: no unit or src file schedules it; the matches in `units/` are comments (checked 09-29) |
| 09-16 | "five false 'X is unavailable' alarms, all mis-addressing" → the class law restated as "positive control through the same address"; 21:05 "~9 instances of reading a negative without a positive control"; 09-16 20:56 `df` measured *inside a container*, concluded "disk not full" | — | 09-17 22:50: the host disk was 100% full (Docker.raw 922 GiB) |
| 09-17 | "fourth of my own conclusions overturned today … **I wrote the rule … then built a 30-minute experiment that violated it**". A client timeout was read as server work ("I was wrong last turn", 09:11). Operator probes cooled OpenRouter for 600 s each ("measurement suppressing the thing it measured"). A watcher counted log mentions as dispatches. "zero callers" for `checkAndRetireByPosterior` was a false zero | — | — |
| 09-18 | "six+ harness/instrument faults, zero misfiled as system faults"; 10:51 "**Four instrument faults; zero system faults** on this experiment's critical path" | the faults are now caught before filing | They still occur at the same rate. Catching them is not the same as removing their cause |
| 09-20 | "3 probes printed PASS and exited 1" → law "exit codes by REDIRECTION" (MEMORY index). **The system-side twin is filed:** gap `a-walk-treated-a-401-as-an-observation-and-reasoned-from-it` (human_reported, edit_site goal-host index.ts) | filed | **Still open on 09-29.** 5 approach decisions, `falsifier: "none"` (classified 09-24), no landing (live gap store, read 09-29) |
| 09-22 | Host `:18270` "dead", but the in-container control proved it alive (memory `reference-248-gap-escalations…`, "METHOD SAVE"). Discovery `/resolve` 401 returned an empty body without ApiKey, which was taken for a broken discovery (**false alarm**, memory-9:137). **`ffd1d58` (operator bypass)**: discovery rows gain registrant identity (`last_writer`) | "a negative is unattributed until a positive control shares its address — and its credentials" | This is the one partial system-side build of the echo idea, and it covers one vessel (discovery). Concept-db and dev-vessel did not follow (see §4) |
| 09-24 | C6: "Since 17:10 no change can land on any vessel" | passed on without measuring | Retracted 17:45 ("I passed on the claim … without measuring it, and it was wrong"). 20:18: wrong again, in the other direction |
| 09-26 09:39 | Boredom named as the sender of the scaffold-pin dispatches | attribution | **Retracted.** "sender unattributed until goal-host origin logging lands". Still unattributed 09-29: 1036 refusals per 24 h (node2-runtime record) |
| 09-26 → 09-29 | Node 2: discovery logs 6844 `identity rejected the key (HTTP 401)` since 09-26 12:22; goal-host `Failed to resolve SHA … 401` 1194 times all-time. Load-correlated, and **"unattributed (no positive control run)"** (raw/node2-runtime.md:78) | — | Open. A fleet-wide negative with no control through the same address |
| 09-28 06:51 | C28: "Yes, it was working, and it still is" (expectation scan, 0 violations) | working | Retracted 07:06. The post-land suite had been silently `ran=false` since 08-31 (boundary case: the system's instrument lied, and the operator trusted its self-report) |
| 09-29 | "memory-shape 404" on a probe → corrected by a positive control (transcripts-4 §6 principle 4). CHECKINS 03:15 (`44ab5fd4`) uses "positive controls: notes that exist return by title prefix" | the method is applied | Applied by hand again, each time. §5 shows it recurring during this dossier's own pass |

---

## 2. Root causes (measured, not inferred)

1. **A negative has two generators, and the default always picks "absent".** A negative can mean the thing is absent, or that the query was mis-addressed. `0 rows`, `inactive`, `NOT-ancestor` and `{"gaps":[]}` say nothing about *what was measured*, while a positive payload validates itself. (Law written 09-15; the same idea already existed on 08-09, 08-17 and 08-22.)
2. **The addressing space is wide, and every layer fails fluently.** Examples: two clones and three trees per vessel; two `WORKSPACE_ROOT`s (unit `Environment=` vs env-file); unit names that differ from vessel names; two auth headers that both return 200 into different scopes; three envelope dialects (`pointer`, `impulse.pointer`, bare `type`); host vs VM (loadavg, `df`, :182xx vs :82xx); PDT host vs UTC container; `NONE`≠`NULL`; `CONTAINS` as an array op; default `LIMIT` with worst-first sorting. Hand-addressing a port takes on this whole failure surface. Routing by shape through discovery reduces it, but the operator skips discovery for speed.
3. **Interfaces do not echo their resolution context.** No answer says which scope, org, unit, root, node or clock it resolved against. So the fact that would tell "absent" from "mis-addressed" is missing at the moment the answer is read. This is law 8 (information at the right time) applied to the reader.
4. **Verification reuses the writer's address.** A control through the same wrong header or root confirms the error instead of catching it (09-15: rows written with `X-Api-Key` were "verified at the consuming layer" with the same header).
5. **The lesson lives where no runtime reader reads it.** It is kept in operator memory files, indexed by instance surface (grep, mtime, systemctl, "probe :8220 first"), so each recurrence arrives through a new interface and misses the pattern-match. It was learned at least 10 times before being written down (transcripts-2), and written at least 6 times before 09-15.
6. **Base-rate contamination.** The substrate really does have many broken things, so "broken" is always plausible and the reflex to double-check never fires. Every false alarm "fit the narrative of its hour".

---

## 3. Why it recurs: the missing shared capability

The class keeps coming back because **the fleet has no addressed-measurement contract**. No shared seam makes a reader, whether operator, subagent or walk, receive both of these:

- **(a) a typed distinction between "your question was wrong" and "the answer is empty".** That means distinct outcomes for unauthenticated, invalid credential, wrong envelope, not the owner of this shape, not found, and empty result, instead of `200 + other-scope data`, a misleading 400, or `[]`;
- **(b) the resolution context echoed with every answer**: the node, the vessel, the scope/org used, the storage root, and the server clock.

Without this seam, every reader re-derives the discrimination by hand for each interface. Each operator law, doctor check and oracle control covers the one instrument it was written for, and the next interface fails fluently in a new way.

The same gap shows up on the system side. The walk reasons from a 401 as if it were an observation (gap filed 09-20, still open). Node 2 carries 6844 unattributed 401s. So the fix belongs at the resolve-envelope seam that every vessel and the walk go through, not in another operator memory file.

**Capability name:** *addressed measurement*. It lives at the `/resolve` (`/v2/impulses/resolve`) envelope contract, which discovery advertises and every vessel serves. It has two halves:

1. **Every vessel honours the envelope.** It returns typed errors and never returns 200 with data under a failed credential. It echoes `resolved_by` (node, vessel id, scope/org, root) and `server_time`.
2. **A shaped probe activity** (behaviour is an activity, law 2) pairs any negative with a known-present positive control through the same address and records both in the trace. The walk and the operator both route through it, so the reach judge and the gap filer can refuse to act on a negative that has no control.

---

## 4. Every prior attempt at this capability, and why it did not hold

| When | Attempt | Where | Why it did not hold |
|---|---|---|---|
| 04-24/25 | Discovery rows advertise the resolver contract (`endpoint`, `resolve_request_format`, `auth_scheme`, `resolve_timeout_ms`; `0fc0beb`, `a02e721`) | discovery-vessel | This is advertisement, not enforcement. On 09-29 discovery advertises `resolve_request_format:"pointer"` for development-vessel, and dev-vessel rejects top-level `pointer` (§5) |
| 05-28 | "Always emit `total_pre_filter` next to filtered counts" | audit discipline (openspec-1:53) | It was a per-audit convention with no runtime reader, and was relearned in September |
| 06-14 → 08-10 | Per-instance fixes for query artifacts (pagination, sort, filters); `bump-submodules` exits non-zero (`851c472`) | various | Each fixed one instrument, and the next instrument failed the same way (memory-adjacent §A7, 15+) |
| 08-08, 08-09/10, 08-21, 08-23 | Operator memory laws: control write before reporting zero; control must vary the failing caller's inputs (2×2); check before filing | operator memory files | Law 10 and the teaching law: these teach only the operator. They were indexed by surface and re-violated at the next new interface |
| 08-08 / 08-10 | substrate-utils notes: "never collapse tool-failed into tool-found-nothing" | substrate-utils notes | Did not reach the system's recall. On 09-15 the law "appeared as new" |
| 08-17 | Four detectors built with negative controls; a masked+running unit detector | tests/ops (reports-1) | Each covers exactly its own instance |
| 09-09 | `close_basis` field, so measured-vs-trusted closes can be queried (substrate-authored) | gap store | System-side, but it covers gap closure only (the false-verification side), not reads |
| 09-11 | Federation oracle NC1–NC4, including "NC3 loopback positive control" that makes a dead discovery give `undecidable` instead of `fail` (`a0c702bb`) | scripts/substrate/federation-relay/federation-probe-tick.ts | The right pattern, applied to one oracle. It is not a fleet contract, and no unit in `scripts/substrate/units` schedules it |
| 09-15 | Class law written (memory `feedback-a-negative-result-…`), naming the system fix "interfaces should echo resolution context" | operator memory | Violated within the hour, and again 09-17. **Absent from the system's memory store on 09-29** (positive control: notes from 09-28 and 09-29 resolve by `title_prefix`; this one returns 0). In `concept`, the only two rows containing "positive control" are `doc_expectation` rows with `times_loaded=0`. No runtime reader loads it |
| 09-15 | substrate-doctor 4b round-trip positive control (`a5dd4b24`) | scripts/substrate/substrate-doctor.sh:239-270 | Operator-invoked tooling. Nothing schedules it, so it is not an activity the loop grades (law 2), and it checks liveness of the resolved endpoint only, not scope or envelope |
| 08-21 → 09-22 | vessel-ctl deregister existence check, "measured against a positive control on the same fleet" (`d63d64b6`) | scripts/substrate/vessel-ctl.sh:296 | One verb |
| 09-16 → 09-18 | Operator self-audit per experiment ("six+ harness faults, zero misfiled") | transcripts | Moves *detection* before filing, but does not change how often the faults happen (4 faults on one critical path, 09-18 10:51) |
| 09-20 | Gap `a-walk-treated-a-401-as-an-observation-and-reasoned-from-it` | gap store, edit_site goal-host index.ts | Open. `falsifier:"none"`, 5 approach decisions, no landing. The system was told and has not acted |
| 09-22 | `ffd1d58` (operator bypass): discovery rows carry registrant identity `last_writer`; discovery's 401 now carries an error body and a wrong envelope gives an explicit 400 | discovery-vessel | **The only partial build of the echo, and only for discovery.** Concept-db still returns 200 with another scope's data under a bad or missing credential; dev-vessel's error names a field the caller sent |
| 09-15 → 09-29 | Advisor calls ("Ask the advisor why we always have this habit"), the read-only `q.sh` helper, CHECKINS "positive controls" notes | operator side | Operator-side crutches. The walk has none of them |

---

## 5. Current verified state (live, read-only, 2026-09-29 ~05:00 UTC)

**Node 1 (`substrate-live`)**

- **concept-db accepts any credential or none, and returns another scope with HTTP 200.** `repos/concept-db/src/middleware/jwtAuth.ts:36-50`: `PUBLIC_PATHS` contains `'/'`, and prefix-matching makes *every* path public. When no ApiKey validates, the request proceeds with `jwtAuth=null`. Measured `GET :8260/concepts/search?q=compose%20failure&limit=200`:
  - no header → HTTP 200, 76 rows, all `org_id:"default"`;
  - `X-Api-Key` → HTTP 200, 76 rows, `default`;
  - `Authorization: ApiKey <invalid>` → HTTP 200, 76 rows, `default`;
  - `Authorization: ApiKey <valid>` → HTTP 200, 200 rows, `organizations:substrate`.

  The 09-15 trap is live, and wider than recorded: **an invalid key also returns 200 with data.** Rows carry `org_id`, but the response has no top-level scope echo.
- **The dev-vessel resolve envelope disagrees with discovery's advertisement, and its error message misleads.** Discovery's row for `memoryNote` says `resolve_request_format:"pointer"`, `auth_scheme:"ApiKey"`, `vesselId:"development-vessel-local"`. `POST :8090/v2/impulses/resolve` with `{"pointer":{"type":"memoryNote",…}}` returns **400 "pointer.type is required"**, even though pointer.type was sent (`repos/development-vessel/src/routes/impulses.ts:1058-1069` reads `impulse.pointer`, `impulse`, or a bare `type`). The positive control `{"impulse":{"type":"memoryNote","pointer":{…}}}` returns notes.
- **Discovery has improved.** Unauthenticated `/resolve` now returns `401 {"error":{"code":"INVALID_API_KEY","message":"Authorization header is required"}}` (81 bytes; on 09-22 it returned an empty body). A wrong envelope returns `400 "Missing pointer or pointer.type"`. Rows echo `vesselId`, `auth_scheme` and `last_writer`.
- **systemd still fabricates state for missing units.** `systemctl show llm-resolver.service` → `LoadState=not-found ActiveState=inactive NRestarts=0`, while `llm-resolver-vessel.service` → `loaded active`. The only discriminator is `LoadState` (systemd behaviour; nothing wraps it).
- **Clocks:** host `Mon Sep 28 21:59 PDT`, container `Tue Sep 29 04:59 UTC` (`/etc/timezone` Etc/UTC). The 7 h offset that gave false zeros on 08-31, 09-13 and elsewhere is unchanged.
- **The decoy roots are still written.** `/workspace/gaps/gaps.json` is 1,064,679 B with mtime **2026-09-26 14:06:41 UTC**; the live store `/workspace/git/super-repo/gaps/gaps.json` is 10,584,263 B (6,282 gaps). `/workspace/policies/llm-model-policy.json` is from 09-07, and the live one is under `super-repo/policies`. The `development-vessel`, `development-vessel-seed` and `observe-orthogonal-refresh` units still carry `Environment=WORKSPACE_ROOT=/workspace`. The live development-vessel process has `WORKSPACE_ROOT=/workspace/git/super-repo`, because the env file wins. **Which process wrote the decoy on 09-26 was not established in this pass.**
- **The law is not in the system's memory.** memoryNote `title_prefix:"feedback-a-negative"` → 0 notes. Positive controls `project-operating-model` and `feedback-search-prior-art` → 1 note each. In `concept`, the 2 rows containing "positive control" are both `doc_expectation` with `times_loaded=0`.
- **The walk-side twin is open:** gap `a-walk-treated-a-401-as-an-observation-and-reasoned-from-it`, `status:open`, `falsifier:"none"`, last updated 09-24.

**Node 2 (`compose2-live`)**

- `/workspace/gaps` and `/workspace/policies` do not exist. The local `/workspace/git/super-repo/gaps/gaps.json` is 97,454 B from 09-26 12:07. So on node 2, a node-local count of the gap store is a **false negative for the fleet** ("absence in one place is not absence").
- `concept-db.service` shows `LoadState=masked`. Any local :8260 probe on node 2 answers nothing by design, which is another negative that needs a control through discovery.
- It carries 6844 unattributed identity-401 rejections since 09-26 12:22 (raw/node2-runtime.md:78); no control has been run.

**The class recurred during this dossier's own pass:**

1. The first concept-db count used `jq` and printed blank counts for 3 of 4 cases, because control characters in `content` broke the parse. It was redone with a pattern count.
2. The first memoryNote probe returned "53 bytes, 0 titles", which reads as "the law is absent". It was actually the misleading 400 above. It was caught only because a positive control with a known-present title was run through the same address.
3. One probe echoed an 11-character API-key prefix to the terminal. It is not reproduced here.

Three instrument faults happened in one read-only pass on 09-29, by a reader who had the law open. Discipline alone does not retire this class.

---

## 6. What to keep (existing pieces to reuse, not re-mint)

- **Keep:** discovery's contract fields and `last_writer` echo (`0fc0beb`, `a02e721`, `ffd1d58`) as the seed of the envelope contract.
- **Keep:** the NC1–NC4 oracle pattern (`federation-probe-tick.ts`, `a0c702bb`), where a failed positive control gives `undecidable` rather than `fail`. It is the template for the probe activity.
- **Keep:** doctor 4b round-trip (`a5dd4b24`), to be promoted from operator script to scheduled activity.
- **Keep as source text:** the class law file and its "cheap positive controls by interface" table, as the content the probe activity encodes.
- **Canaries to fix first:** concept-db `PUBLIC_PATHS '/'`, and the dev-vessel envelope mismatch against the advertised format.
- **Fossils to retire:** the decoy `/workspace/gaps` and `/workspace/policies` on node 1 (once their writer is attributed), and the unit-level `Environment=WORKSPACE_ROOT=/workspace` lines that the env file silently overrides.

---

## 7. Retire condition (measurable, checked by the system rather than counted by the operator)

The class is retired when **all** of the following hold at once, on **both** nodes, for **14 consecutive days**:

1. **A rhythm-scheduled, shaped probe activity** (graded by traces, not an operator script) runs at least daily over every shape in the registry. For each shape it sends a known-present pointer under (i) a valid credential, (ii) an invalid credential, (iii) no credential and (iv) a wrong envelope. It asserts:
   - case (i) returns the known row, with an echoed `resolved_by` (node, vessel, scope/org, root) and `server_time`;
   - cases (ii), (iii) and (iv) return a typed error, and **never HTTP 200 with data**;
   - a wrong-envelope error names the expected envelope, not a field the caller sent.

   **Violations = 0.**
2. **The two canaries have flipped:** concept-db with an invalid or missing credential no longer returns 200 with data, and dev-vessel accepts the envelope that discovery advertises for it (or discovery advertises what the vessel accepts).
3. Gap `a-walk-treated-a-401-as-an-observation-and-reasoned-from-it` is **closed with a landed, verified change**, and the reach judge or gap filer refuses to act on a negative whose trace has no paired positive control. That is measured as 0 filed gaps and 0 walk verdicts citing a 401 or an empty read as evidence.
4. The node-2 identity-401 stream is either attributed by the probe or gone.
5. **Durability, per law 7:** CHECKINS and session transcripts in the same 14 days carry **0 retractions whose cause is a reader instrument fault** (mis-addressed, wrong scope or credential, wrong root, wrong clock, self-matching count), against the 09-05 → 09-18 baseline of 40 or more in 14 days.
