# git-small: git history of the 16 small repos

Source shard: git history of analysis-vessel, conversation-vessel, cpg-inference-ts, discovery-vessel,
identity-vessel, libp2p-federation-transport, light-dispatch-vessel, llm-resolver-vessel,
local-tools-vessel, metabob-cloud-dashboard, metric-collector-vessel, react-renderer, ribosome-vessel,
stateful-ui-vessel, terminal, user-vessel.

## Coverage (what was read, what was not)

- Read the full `git log` of every repo on the host (`repos/<r>`, 546 commits in total). Read the bodies and diffs of
  every revert, every commit whose message says "fix", and every autonomous commit in
  llm-resolver, local-tools, stateful-ui, light-dispatch, ribosome, libp2p, metric-collector
  and analysis. Skimmed the rest of the autonomous commits by their `+/-` lines.
- The host submodules **lag the live clones** (`/workspace/git/vessels/<r>` in substrate-live and
  compose2-live): llm-resolver is 6 commits behind (live HEAD 3c83a33, 09-27), local-tools is 9 behind
  (85b4c01, 09-28) and stateful-ui is 2 behind (b9b5d8d, 09-28). I read those live-only commits
  in the container. All other repos match on both nodes.
- Autonomous commits (author `Substrate Autonomous`): 114 on the host plus 17 live-only, **131 in total**.
  - By repo (host): llm-resolver 56, local-tools 19, light-dispatch 15, ribosome 7, libp2p 6,
    discovery 3, stateful-ui 3, analysis 2, metric-collector 2, identity 1.
  - By month (host): Jun 1, Jul 77, Aug 15, Sep 21, plus the 17 live-only Sep commits.
- Journals: substrate-live journals begin **09-25** (retention horizon). "Since 09-25" therefore means
  "since at least 09-25". I did **not** inspect compose2-live journals. The only node-2 evidence here is
  unit active-state.
- SurrealDB: queried once, read-only (`activity` rows with `learned-` in the id: 515).
- HTTP probes (read-only, with one exception):
  - GET of the template listing using the Bearer scheme and the ApiKey scheme.
  - A 404 control on a nonsense route.
  - One POST to `/v2/activities/execution-traces/reach` with a **nonexistent** execution id, to prove
    the route exists. It returned 200 and the nonsense-route control returned 404. It targeted no real
    row, but it is the one write-shaped call in this shard.
- Not read in depth: the five non-submodule directories (conversation-vessel, user-vessel,
  metabob-cloud-dashboard, react-renderer, terminal). I classified them only from their log,
  gitignore status and deployment status.
- `git log -S/-G` runs:
  - the shell-timeout identifiers in local-tools;
  - `impulse.*pointer` (envelope unwrapping) across 5 repos;
  - `duplicate_policy|distribution_policy` across all repos (grep).

Several keys were added beyond the seed list. Each notes the nearest seed key:

| Added key | Nearest seed key(s) |
|---|---|
| `path-root-ambiguity` | sync-deploy-drift / write-read-mismatch |
| `edit-primitive-safety` | drafter-quality / hollow-landing |
| `llm-plane-availability` | spend-envelope-throughput / goal-walk-floor |
| `auth-credential-plumbing` | endpoint-routing / write-read-mismatch |
| `landing-attribution` | false-verification / gap-content |
| `shell-exec-bounds` | false-verification / spend-envelope-throughput |

---

## Problem classes

### hollow-landing: autonomous commits that change nothing, fix the wrong site, or satisfy a check

- **85b4c01 (local-tools, 09-28, live-only).**
  - Gap `recommit-fs-edit-applies-new-text-through-string-replace-so-dollar-patterns-in-the-replacement-corrupt-the-file-semantic_reject`.
  - It adds 19 lines **inside the `webSearch` handler** that "undo a prior global
    String.prototype.replace override". A fleet-wide grep finds **no override of
    `String.prototype.replace` anywhere**. The premise in the comment is confabulated and the code sits in
    an unrelated function.
  - The real defect (a `$` pattern in the replacement string) had already been fixed 2 days earlier by
    6b0d86a (09-26, `text.replace(old, () => new_string)`).
  - So this is a recommit child of an already-closed gap, landing narrative code at the wrong site.
    **CONFIRMED hollow.**
- **ad86ffc (light-dispatch, 08-31), gap `route-edit-bfdcc501-narrowed`.** It sets
  `resolved.error = err.message` in a catch. The very next statement (`if (!okJson) { ... resolved.error = ... }`)
  unconditionally overwrites it. The write has no reader. **CONFIRMED hollow.**
- **e4b20b1 (light-dispatch, 08-29), gap `recommit-route-edit-7dccfd08-semantic_reject`.** The only change
  prefixes a human-readable retirement reason string with the literal `semantic_reject:`, which is the
  gap id's own suffix. This is the "drafter writes the gap id / expected literal into the file" pattern. It
  satisfies a literal-presence check and changes no behavior.
- **286a318 (local-tools, 06-17), gap `unknown-gap`.** Comment-only: 5 header lines such as
  "Maintained by the substrate loop" and "Runtime: Bun". It has 0 code lines.
- **348b79e (local-tools, 08-08), gap `pwt-local-tools-vessel-index.ts-a9bba6bc`.** It rewrites
  `signal: AbortSignal.timeout(30000)` as `const requestTimeoutMs = 30000; ... timeout(requestTimeoutMs)`.
  Behavior is identical.
- **4d0c600 (local-tools, 08-31)**, gap `recommit-groupbounded-fix-not-propagated-to-sibling-shell-exec-sites-narrowed-anchor_not_found`.
  - Added `kill -0 $__cpid &&` in front of `__killtree`.
  - The gap was "the fix was not propagated to sibling shell exec sites", and this landing did not propagate it.
  - The sibling-site work was later done piecemeal by fa603a0, 3ae3fe8 and 9eb4808 on 09-23..25.
- **llm-resolver: route-edit-e05aabcc landed twice.**
  - 9ac885c (08-28) adds `["llmCompletion", handler]` (mis-indented) to the resolver Map.
  - 1a83502 (08-28) adds the same entry again.
  - Result: a duplicate Map key, which is inert because the last one wins.
  - 7d7bf0a (09-26) rewrote the Map for spend metering and **re-created the duplicate**. The live file,
    lines 1528-1529, still has both.
- **llm-resolver gap `a-wired-provider-with-no-key-is-silent-capacity-loss-narrowed` landed 3 times**, on 09-11 and 09-12:
  - de3223d added `reportMissingKey`.
  - 8e952f7 added a **second** warn and report call pair directly above the existing pair: a duplicate
    log line plus a duplicate gap write.
  - 0f9a160 added a re-report loop in `reportPlaneState`. This became a flood (see gap-content).
  - f4bae3c (09-15, `route-edit-f91c8968-narrowed`) deleted the `continue` and left an orphaned
    comment. The live file now has `continue;` followed by a dangling comment line, because a later edit
    restored the `continue`.
  - 873b597 and ae07375 (09-15) both "fix" the same unguarded `choices[0]`. The live code has
    `throw` if `choices` is empty **and then** a guarded `return` for the same condition **and then**
    `if (!choice) break;`. Three guards stacked on one condition.
- **stateful-ui panel-overwrite gap: 5 landings over 8 days on the same 7 lines** (live clone):
  - bfccbaf (09-20, gap `stateful-ui-resolve-defaults-destroy-live-panels`) fixed **only the `/api/panels` route**.
    It merged `existing` panel fields there, but left the sibling `/resolve` `uiPanel_write` site
    defaulting every absent field. The gap's own name says `resolve`.
  - 4670c72 (09-20, `route-edit-dc3a888c`) swapped `??` for `Object.hasOwn(...) ? ... :` and left the defaults in place.
  - 1b447c6 (09-20, `route-edit-7f4dea92-narrowed`) added `!== null && !== undefined`. Defaults still in place.
  - 48493bb (09-23, `recommit-recommit-route-edit-7f4dea92-semantic_reject-semantic_reject`) switched to
    `typeof === 'string'`. Defaults still in place.
  - b9b5d8d (09-28, `recommit-route-edit-42265768-narrowed-semantic_reject`) finally reads `existing` and
    falls back to its fields. This is the actual fix.
  - The middle three are symptom rewrites: `superseded`, and ineffective at the time. This is the
    grep-the-sibling-call-site law, missed at landing 1.
- **light-dispatch deprecateGhostTemplates (07-13).** Three landings (5e75c6e, 6d036d8, ed6458b):
  - 5e75c6e is a startup IIFE.
  - 6d036d8 duplicates it as a named function.
  - ed6458b adds a call to the function.
  - All three POST to `/v2/activityTemplates/{id}/deprecate`, **a route that does not exist**. The HTTP
    status was logged and never checked, so it "succeeded" every boot for 3 weeks. The operator found and
    replaced it on 08-04 (7f3a81f).
- **metric-collector a885631 (08-21).** It changes the default PORT from 8280 to 8300. The unit is
  **disabled on both nodes**, so the landing cannot be verified at all. Outcome `unknown`, and that is
  the finding: the loop lands on vessels that don't run.

### narrowing-duplicates: `-narrowed` and `recommit-` children re-landing the same gap

- 10 host-visible landings carry `-narrowed` and 2 carry `recommit-`. The live-only set adds another 5
  (`recommit-route-edit-5c57d7b0-typecheck_dangling_reference`, `recommit-fs-edit-…-semantic_reject`,
  `recommit-recommit-route-edit-7f4dea92-semantic_reject-semantic_reject`,
  `recommit-route-edit-42265768-narrowed-semantic_reject`, and others).
- Double-recommit ids (`recommit-recommit-...-semantic_reject-semantic_reject`) show the chain has no
  depth bound, and each child is treated as fresh work.
- The same gap id landed ≥2 times in:
  - llm-resolver: `a-wired-provider…-narrowed` ×3; `route-edit-e05aabcc` ×2; `unguarded-choices-index…` ×2;
  - stateful-ui: the 7f4dea92 family ×3.
- The pattern: a child of a gap that is already semantically fixed lands again anyway. Examples are 85b4c01 and 48493bb.
- Also: gaps born from a recommit of a `semantic_reject`, which is a judge refusal, still land. The refusal does not stop the child.

### autonomous-regression: substrate landings that broke something

- **6fb9282 (local-tools, 07-22 SA)** added `signal: AbortSignal.timeout(30000)` to `sh()`. This is the
  **origin of the 30s shell cap** that later made every compose verify impossible (see shell-exec-bounds).
- **c709850 (local-tools, 07-22 SA)** created `boundedShellResolver`, a **second spawn site that bypasses
  `sh()`**. From then on every shell fix had to be made twice: the governor in 44c2b21, execution_id in
  fa603a0 and 9eb4808, cwd in 11636e6.
- **93fbb7f (07-22 SA)** added a `dispatch_id` resolver that broke typecheck. The operator fixed it in 24a3849 (08-01).
- **925d160 and 7d11ded (07-22 SA)** replaced the bounded-shell timeout with an AbortController and a
  hardcoded 30s. The substrate itself auto-reverted both minutes later (1a796aa, b646ee2). These are the
  only substrate-authored reverts in the shard.
- **b34e37a (09-24, `recommit-route-edit-5c57d7b0-typecheck_dangling_reference`)** changed
  `new_string === undefined` to `!new_string`. That **rejects empty `new_string`**, so the lane could no
  longer express a deletion. It was repaired the next day by aaee500 (09-25, gap
  `fs-edit-rejects-an-empty-new-string-so-the-lane-cannot-express-a-deletion`). This was a regression and
  a repair within 24h, both autonomous. The repair gap was detected, which is good.
- **0f9a160 (llm-resolver, 09-12)** added a re-report loop without dedup, which flooded the gap store:
  472 of 474 gap writes in 5 minutes, one gap id at 1.6/s, and ~3 GB RSS growth. The operator fixed it in
  789853a (09-16).
- **f4bae3c (09-15)** removed the `continue` after a missing key. That would construct `new OpenAI({apiKey: ''})`,
  which throws. It was restored later.
- **aba168a (analysis-vessel, 07-09 SA)**, gap `analysis-vessel-repos-path-unaddressable`: its
  `resolveFilePath` included a dead candidate `${WORKSPACE_ROOT}/repos/...` (`/workspace/repos` does not
  exist). The operator found it on 08-09 (5a890c3).

### directed-overshoot: operator fixes that regressed or were overturned

- **7cc9da4 (discovery, 09-19, operator-landed)** added register-payload validation to satisfy
  security-audit tests. One of the checks is `shapes must be a non-empty array`. **ribosome-vessel
  registers with `shapes: []`** (src/index.ts:697, "owns no impulse shapes; it's a consumer").
  - Since then ribosome gets `register failed: 400 — vessel will be unreachable via discovery` on every
    heartbeat: **5,208 failures in 7 days**, first seen at the journal horizon 09-25. Discovery logged
    1,385 + 114 `POST /register 400` in the last day.
  - Blast radius: ribosome is a consumer, so the cost is a false "unreachable" claim, log noise and a
    re-register loop, not lost routing.
  - **CONFIRMED.** Outcome of 7cc9da4: `partial`.
- **e1ffa50 (SA, 08-15)** raised the shell kill from 30s to 300s. The **operator reverted it the same day**
  (a699887) with no reason recorded. **14 days later the operator re-derived it** as e4d604c (08-29):
  "30s made verify impossible", with a caller-specifiable timeout clamped at 900s.
  - The autonomous fix named the right constraint with a blunt remedy.
  - The revert cost 2 weeks of every code-class compose being killed mid-typecheck.
  - The 30s default then **also** killed the post-land suite from 08-31 to 09-28 (fixed elsewhere in
    5e9a0b2, per operator memory).
- **ribosome 86aebdf and 5a374df (09-02).** The operator flipped the reach rule to "the tag wins over the
  column" and reverted it the same day after reading the write path. The real defect, "two writers of
  `reached` with different rules", was recorded and not fixed.
  - Since then light-dispatch 59732fd (09-08 SA) added a **third** writer, which POSTs its own reach verdict.
- **llm-resolver: advertisement flip-flop.**
  - 9c17905 (07-17) "never un-advertise llm_completion on provider exhaustion".
  - 1f14a69 (07-19) "quota-gated de-advertisement of llm_completion". This is the opposite policy, 2 days later.
  - 3ea2136 (08-18) wired refusals into the quota gate.
- **llm-resolver 272edbd and 04b2e8f.**
  - 272edbd (08-09) "never dial the default without a willingness check".
  - The next day 04b2e8f (08-10) corrected it: "a dry default must not blackhole a live plane". The guard
    had refused while a pinned gemini model was answering.
- **llm-resolver e9f56bf and 3e7d005.** The groq slugs were replaced on 08-20 and then reverted with no reason.
- **analysis-vessel 5a890c3 and afb6955 (08-09), local-tools 44375c6 and 7a38f37 (08-09).** The operator
  wrote tests that **mirrored the function under test**, so they could not fail. The operator then used
  one as an acceptance probe and wrongly retracted a correct diagnosis. Fixed the same day by importing
  the real function.
- **metabob-cloud-dashboard 3f5e35e (08-17).** The operator first removed the global 5s poll, read the
  vessel's CLAUDE.md "5-second polling" principle, and narrowed the change to the one O(table) query.
  A self-caught overshoot.

### shell-exec-bounds (added; nearest seeds: false-verification, spend-envelope-throughput)

Shell-bound failures recur about every two weeks:

- 06-25 a999128: bash spawned with no env, so `bun` was not on PATH, typecheck exited 127, and **every
  code-class compose was UNFAVORABLE**.
- 07-22 6fb9282 (SA): hardcoded 30s AbortSignal. 925d160/7d11ded were reverted.
- 08-11 b4766ff: the timeout killed only bash, leaving orphaned `find / | xargs grep` alive for **5.5 h**.
  The resulting block I/O on a 17 GB DB gave load 40+. Fix: `set -m` plus a group kill.
- 08-15 e1ffa50 and its revert a699887 (see directed-overshoot).
- 08-29 e4d604c: caller-specifiable timeout (clamped to 900).
- 08-30 44c2b21: a cross-process slot governor for bun-test/tsc (10+ concurrent `bun test`, Tctl ~100°C).
- 08-30 791051e: kill the full descendant tree via /proc (14 orphaned `bun test` at ppid=1).
- 08-30 81c8f57: corrected the comment. The setpgid story in 791051e had been refuted.
- 08-31 4d0c600 (SA): marginal (see hollow-landing).
- 09-25 11636e6 (SA): bounded_shell's default cwd was the super-repo, so relative `sed` edited a
  submodule checkout. Fix: a hardcoded `/workspace/tmp/bounded-shell` created in an inline IIFE with `require`.
- Post-land suite dead 08-31→09-28 because of the same 30s default (cross-ref: development-vessel 5e9a0b2).

Root cause: **two spawn sites plus a hardcoded default in a primitive every verification path calls**.
Each fix addressed one site or one symptom.

### path-root-ambiguity (added; nearest seeds: sync-deploy-drift, write-read-mismatch)

There are at least 4 path roots: `/vessels` (runtime), `/workspace/git/vessels` (clones),
`/workspace/git/super-repo/repos` (submodule checkouts), and the vessel cwd. Fixes:

- 07-09 aba168a (SA, analysis): `repos/` mapping. Included a dead candidate.
- 07-14 8bf69ea: local-tools cwd did not read the envelope, so every walk git/shell call ran in `/workspace`.
- 07-21 2aaa834: local-tools opened `repos/<v>/...` relative to its cwd, which produced a **shadow garbage
  tree at /vessels/local-tools-vessel/repos** (362-byte stubs, accreting since 07-20) and ENOENT on every
  walk-routed vessel edit. "This one bug floors the whole 'walk edits a vessel' capability class."
- 08-09 44375c6: bare relative paths resolved inside the vessel dir. The walk then **confabulated filenames**
  (`trace_store_deletion_logic.py`, `./find . -name ...` as a path), and 3 walks went hollow.
- 08-09 5a890c3 (analysis): the dead candidate, plus bare paths hitting cwd.
- 09-25 11636e6 (SA): the bounded_shell cwd default.

Six fixes in two vessels over 11 weeks. There is still no single shared path-resolver primitive:
analysis has `resolve-file-path.ts` and local-tools has `mapPath`, which are duplicates.

### write-read-mismatch: producer writes where the consumer does not read

- **Revoked key still listed as active: fixed 4 times.**
  - user-vessel 4f71df7 (05-28): `WHERE revoked_at IS NONE`.
  - dashboard e092dd4 (05-28): filtered client-side on `is_active`.
  - dashboard 654aef1 (the same day): "identity-vessel uses status field not is_active".
  - identity c8bf5d9 (08-22) found the real cause: **revoke writes redis `revoked:<id>`, while the listing
    reads SurrealDB `is_active`, which nothing sets false**.
  - The first three patched readers. The fourth fixed the write/read split. It was first written up as
    an open finding in 9a58274 (08-19).
- **Auth traces into the trace store: fixed 3 times.**
  - 04-20 13a4d79/71e191b: status values.
  - 07-31 ff3194d: the missing X-Internal-Api-Key header meant a 401 every ~2 min and **every auth trace dropped**.
  - 08-09 01af799: no `tags`, so every trace arrived ungraded. The commit says "Third construction site
    with the same defect".
- **Envelope `{impulse:{pointer}}` vs flat body: recurring per-resolver unwrapping.**
  - local-tools a559094 (06-19 fs_write), 1b88738/dff89d9 (07-04 SA, web_search), 8bf69ea (07-14 cwd),
    befef71 (07-14, a duplicated fallback from a blanket replace), 3ae3fe8/9eb4808 (09-24/25 per-site execution_id).
  - llm-resolver db8af1d (09-23): "every routed llm_completion therefore failed 'body must include
    non-empty prompt'", so a spoke could never complete through a peer's arm.
  - Discovery has advertised `resolve_request_format` since 07-07 (7a1ea5d), yet each resolver still
    hand-unwraps. The fix is being made per call site, not at the shared VesselDaemon seam.
- **Ribosome reach signal: 6 re-fixes of "what does reached mean"**, 07-13 → 09-02:
  - 7118506 gated on `status !== failure`.
  - 2279760 read the `success` field, because the prior gate read undefined and treated **every**
    completion as reached.
  - 572cd6c used the durable task census, because the WS counters were always 0 and there were
    **ZERO extractions in 12 h**.
  - 7a688be required every task to be terminal.
  - a54691d used the honest reach verdict: exit-status `success` gave 94% "reached" against an honest
    ~13%. "The pump which filled the arm pool": 2,444 templates, 51.4% never informed.
  - 7f142af read the `reached` column, because the compat view had dropped it (migration 167). Only 1.22%
    of re-reads scored reached.
  - 86aebdf/5a374df: the tag-vs-column flip-flop.
  - Each was a new hat on one root: **no single authoritative reach field, with multiple writers**.
    Current live census over 7 days: 17,188 ALLOWED, 25,228 not-reached, 19,663 ungraded, 30,422
    ungradable skips. Only 505 extraction dispatches were actually sent.
- **analysis-vessel f6af48e (08-02).** ENOENT was returned inside a success-shaped `problem_detection`
  envelope. goal-host's rejection guard checks only `success===false` or `error`, so the filesystem error
  was bound as content and an LLM wrote polished "Root Cause" reports about a nonexistent file (a gap id).
  At least two such notes were **persisted into the memory store** (see memory-recall).
- **light-dispatch 59732fd (09-08 SA)** POSTs its own reach verdict. The route exists: 200 against a
  nonsense-route 404. It is a third writer with its own rule (all declared outputShapes produced plus
  status success). Duplicate.
- **llm-resolver 3068940 (08-10).** A provider's billing refusal was recorded as model-quality beta:
  claude-haiku beta 40.05. Graded the wrong signal.
- **light-dispatch 66b95e1 (08-04).** The derived `success_rate` "lies": 398 rows reported 0 with successes > 0,
  and 21 working arms were retired on it.

### gap-content: gaps born without an edit site or machine check; the detection channel flooded

- llm-resolver `reportMissingKey` writes gaps with `id: llm-provider-missing-key-<p>` and
  `category: configuration`, with no edit_site and no falsifier. A missing credential is bootstrap-tier
  and cannot be closed by filing (789853a says so explicitly). The detector was still landed 3 times and
  then flooded the single serialised gap store: **472 of 474 writes in 5 min, external gap writes timing
  out at 45-110 s**. "One unconfigured provider had closed the substrate's entire detection channel."
- `0768990` (08-07) files a gap when the completion plane goes dark. It is the same shape of detector
  and uses the `lastPlaneDark` dedup that the missing-key reporter lacked.
- 20 autonomous landings carry `Gap: unknown-gap` or a blank gap:
  - llm-resolver ×8 in 07-03..07-11;
  - local-tools c0afa0f and 286a318;
  - plus the operator-under-SA commits.
  - These landings cannot be traced back to any demand.

### landing-attribution (added; nearest seeds: false-verification, gap-content)

- **Operator work committed under the `Substrate Autonomous` identity**, with an operator-session
  `Co-Authored-By: Claude …` line or an "operator-landed" note in the body:
  - discovery: 586b738 (07-17), 5e8b193 (07-11), db639cf (07-09);
  - identity: bfad5ca (07-29);
  - llm-resolver: cc11aac (07-31), df5acb7 (07-19).
  - These 6 inflate any "substrate-authored commits" count, which is the autonomy criterion. The
    operator memory law "never commit operator work under the substrate identity" exists because of this.
- Conversely, discovery commits 7a1ea5d, 5fe6fb8, 3685439, b77b956 (07-01..07-07) and 7e051d7/0b7db2d are
  "substrate-authored, operator-landed" under the operator identity, because discovery is a **protected
  vessel** that `vessel_mitosis_cutover` refuses to cut over. So autonomy cannot land on discovery by
  design.
- Script sweeps under the SA identity:
  - libp2p 542e712 (09-19, "vessel-code-commit-and-push") committed **compiled `.js/.d.ts/.map`** artefacts.
  - metric-collector 6a93e22 (09-07) "Add bun.lock file".
- `Base SHA at staging` values do not resolve to any commit: 1a21b6c1aa22, e130ae142f9f, 0afc8f6d7bed and
  315f0b132929 in stateful-ui are all "Not a valid object name". This corroborates the known
  "staged_base_sha is a patched-content hash" defect.

### edit-primitive-safety (added; nearest seeds: drafter-quality, hollow-landing)

`fs_edit` and `fs_write` are exposed directly to the drafter and apply to the **running** `/vessels` tree.

- 06-17 c0afa0f (SA): normalized-unicode fallback. It guarded `nOld.length > 0`, but the exact path did not.
- 06-17 71cfc74: `code_search` returned only the first match when `flags` lacked `g`, which left the
  patcher blind. A systematic cap on patch_with_tools.
- 06-23 31a102e: `code_verify_typecheck` scanned only stderr, but tsc writes to stdout. **error_count was
  always 0.** Half of the false-FAVORABLE bug.
- 08-01 24a3849: tool-name shapes were not advertised, so patch_with_tools burned 29 turns on unreachable tools.
- 08-02 b42db41: an empty `old_string` prepends at byte 0. 44 live occurrences in 24 h. This caused the
  development-vessel crash loop, where feature-compose.ts became 39 bytes.
- 08-02 67a9e71: `fs_write` truncated feature-compose.ts from 190,111 to 38 bytes, twice. The rollback
  baseline adopted the corruption.
- 08-02 dded800: identity edit (old === new). Rule #1 of the lesson guidance had no code enforcement:
  "A stated rule with no code check is a comment."
- 08-02 52928b8: the anchor-not-found error returns the real surrounding lines. 120 misses in 24 h were
  **confabulated** anchors (0 occurrences in the file).
- 09-24 b34e37a: regression (empty new_string). 09-25 aaee500: repair.
- 09-26 6b0d86a: `$` patterns in the replacement corrupted files. Fixed with a function replacer.
  09-28 85b4c01 then added the hollow follow-up.

### drafter-quality

- Confabulated anchors (52928b8), confabulated filenames (44375c6), confabulated premises (85b4c01's
  "prior global override"; 81c8f57 "a comment narrating a runtime-mutation incident that never
  happened", and the same class in substrate-gap.ts the same day).
- Symptom edits that re-shape a guard instead of addressing the defect: the stateful-ui ×3, llm choices ×2.
- Duplicate insertion of existing lines: 8e952f7 and the 1a83502 duplicate Map entry. This matches the
  memory note "duplicate anchors double-insert".

### llm-plane-availability (added; nearest seeds: spend-envelope-throughput, goal-walk-floor)

The completion plane went dark or degraded, for a different surface reason each time:

- 07-13/14: no fallback across keyed wire providers (d327b2d, b4b320c); a 402 regex (600930c).
- 07-17/18: un-advertising on exhaustion was permanent. **Nothing re-synced, so the compose paths needed
  to repair it were gone** (9c17905). Model-granular cooldowns followed (17dc3d0).
- 07-19: de-advertisement was reintroduced as quota-gated (1f14a69).
- 07-22: a model pin was a mandate, and 30+ sites pin haiku (5b199b3).
- 07-24: a cooldown stampede darkened an arm for 10 min (3fa37f0). Funded groq/mistral were never arms (cbf029a).
- 07-31: a frozen hardcoded available-model subset (b9b68d8). NaN maxCost made selection deterministic
  on arms[0] (3839090). Cloudflare 52x errors (cc11aac).
- 08-07: every arm hit credit exhaustion and **no gap was filed for a whole session** (0768990).
- 08-09/10: a blind default dial loop (272edbd). A dry default blackholed a live plane (04b2e8f). A
  12-arm policy behaved as a single point of failure because seeding was a hardcoded allow-list (c5e49d3).
  Phantom arms that the provider does not serve (dd9d886).
- 08-11/12: an invalid Anthropic key meant **43 h fleet-wide dry, 566 401s/day, zero completions**, while
  OpenRouter was funded and idle (d508933).
- 08-18: a refusal did not close the quota gate (3ea2136).
- 08-20: decommissioned groq slugs (e9f56bf, reverted).
- 09-11..16: missing-key detection, then the flood (above).
- 09-23: a spoke could not use a peer's arm because of the pointer envelope (db8af1d).
- 09-26: concurrent `savePolicy` shared one `.tmp` path, so **157 arm outcomes were lost in 2 min** under
  load (fce8203, SA, a real fix).

About 17 distinct fixes in 10 weeks. The recurring root is **provider/arm state encoded as hardcoded
lists and env keys** (law 1). Liveness is also inferred from a mix of cooldown maps, a policy file and
advertisement.

### auth-credential-plumbing (added; nearest seeds: endpoint-routing, write-read-mismatch)

- Discovery↔identity: 05-03 fb57b02 changed the validate route. 05-05 5a0abb3 raised the timeout from 5s to 10s.
  07-09 db639cf added a cache and grace window (1,215 spurious 401s in 30 min). 08-19 7978682 made 401s
  explain themselves and bounded grace by revocation (169 unexplained 401s in 37 min). 08-19 3f0edc9
  classified 401/403.
- Identity self-issuer: 07-19 c0692b9 and 14cada5 fixed a 401-on-register that **pull-sync kept reverting
  as unhealthy**.
- SurrealDB 3.x function names flip-flopped:
  - 04-29: ab82e23/1fad1f3 changed `type::thing` → `type::record`, and to direct binds.
  - 05-21: 8eae04e, then c3aca84 `type::record (not type::thing)`, then 4047cc8 `<string> cast (not type::record)`.
  - Five commits on one bind.
- Security: 08-04 352deab (the JWT mint was unauthenticated: anyone reaching the port could mint an admin
  token for any org). 08-19 318a9b2 and 08-21 fc5963f (credential echo). 08-25 0a89ebc and a9db360
  (SEC-5). 08-26 bcbcc18 (lockout: an active admin key the substrate could not use).
- **CONFIRMED NOW BROKEN: the light-dispatch retire-sweep lists templates with
  `Authorization: Bearer <api key>`** (src/index.ts:165), while every sibling call uses `ApiKey`.
  - Live probe: Bearer → **401**, ApiKey → **200**.
  - Journal: `[retire-sweep] template listing HTTP 401 at offset 0 … covered 0/0 templates … no
    never-succeeded arms over 0 templates` on every hourly run. 89 runs are visible since the 09-25
    journal horizon.
  - Candidate cause (PLAUSIBLE, not proven): identity 0a89ebc (08-25) "close Bearer … bypasses".
  - The sweep reports "no never-succeeded arms" as though it swept. A silent skip that reads as a pass.
- Discovery still logs `401 POST /resolve — identity rejected the key` about 32 times per day.

### endpoint-routing

- Hardcoded loopback fallbacks remain in current src: ribosome 8, llm-resolver 4, stateful-ui 3,
  analysis 3, light-dispatch 2, local-tools 2, metric-collector 1.
- The SA "surgical-hardcoded-endpoint-ribosome-vessel" landing (e052535, 07-05) only wrapped the literal
  as `process.env.X ?? "http://127.0.0.1:8210"`. That is cosmetic: it still pins a peer and does not use
  discovery. It also left `vessel-authoring-scenario-consumer.ts:54` with a raw `http://127.0.0.1:8210/run-goal`.
- The env names are inconsistent across vessels: `DISCOVERY_ENDPOINT` vs `DISCOVERY_VESSEL_ENDPOINT`;
  `DEV_VESSEL_ENDPOINT` vs `DEVELOPMENT_VESSEL_ENDPOINT`; `ACTIVITY_API_URL` vs `ACTIVITY_API_ENDPOINT`.
- llm-resolver `reportMissingKey` resolves `substrateGap_write` through discovery but falls back to a
  hardcoded `DEV_VESSEL_FALLBACK`. Good pattern, hardcoded fallback.
- stateful-ui `:8270` is the pinned escalation target. See human-surface-escalation.

### federation-p2p

Discovery federation history:

- 06-25 fc6faab: peer forward on a local miss.
- 06-30 7c4534c: peer fan-out plus libp2p contract fields.
- 07-11 5e8b193: `PEER_FANOUT_MODE=union` (SA-identity, env-gated).
- 07-17: 586b738 added peer-identity dedup, then dcead52 re-keyed it. The first key collapsed 12 spoke
  rows to 1, and **every Obsidian panel 502'd**.
- 07-19 b7d867f / dfe8e24: point-and-go peering and /bootstrap.
- 07-28 955b065: HUB_API_KEY.
- 07-30/31 7e051d7 / 6ab2e24: duplicate_policy and distribution_policy. Self-described as "dormant until
  registrations start carrying the field". Only the obsidian sidecar sets it (federation-sidecar.ts:686).
- 07-31 ea7f342: prefer direct local over the libp2p facade; self-echo filter.
- 09-16 0b7db2d: RELAY_MULTIADDR read from the env **file** at request time, because process.env is frozen
  at boot.
- 09-19 7cc9da4: evict dead rows at resolve time. Four incidents in which ephemeral-port rows blinded compose.
- 09-22 ffd1d58: registrant identity plus a liveness guard (operator bypass).

libp2p transport:

- 07-07 7f2b6c9: frames above 1 KB were silently truncated.
- 07-11 c68b54b: relay reservations silently lapsed after 1 h while /health reported
  `activeReservations:1`. Inbound federation died.
- 07-19 8c24c9b: self-derive the relay.
- 07-29: SA crash guards.

Node state (unit active-state only): federation-transport-vessel is **inactive on substrate-live (hub)**
and active on compose2-live. Its unit runs from the **image copy** at
`/usr/local/share/substrate/super-repo/scripts/substrate/federation-relay/…`, and an ExecStartPre
**copies `/vessels/libp2p-federation-transport/src` into node_modules and the super-repo checkout**. The
runtime is fed by copy, not by the clone.

### sync-deploy-drift

- Host submodule pointers lag the live clones by 6/9/2 commits (llm-resolver/local-tools/stateful-ui).
- 586b738 (07-17), "land running-copy drift": two features had been hot-cutover-deployed into `/vessels`
  and never committed.
- identity c0692b9/14cada5: pull-sync reverted a vessel as "unhealthy" on 401, repeatedly.
- `/vessels` holds mitosis residue directories:
  - `development-vessel-mitosis-*` ×3;
  - `human-surface-vessel-mitosis-*` ×4;
  - `discovery-vessel-mitosis-*`, `goal-host-vessel-mitosis-*`, `ias-executor-ts-mitosis-*`,
    `local-tools-vessel-mitosis-*`.
  - All are from 09-25..28. See codebase-bloat-fossils.
- The libp2p compiled `.js` committed on 09-19 is now stale relative to any later `.ts` change.

### human-surface-escalation

- stateful-ui-vessel (:8270):
  - 08-28 6dc8107 "serve uiQuestion — give the escalation channel a reader"; becfa05 "persist panels so
    escalations survive a restart".
  - Per operator memory (09-22), :8270 is the **replaced** surface that no human reads. Its panel count
    has since grown from 480 to **794** (live /health).
  - The substrate spent **5 autonomous landings (09-20→09-28)** repairing panel-overwrite semantics on a
    vessel no human reads.
- The memory law "a READ satisfier DESTROYED a live panel" is the origin of bfccbaf's gap.

### memory-recall

- analysis-vessel f6af48e: ENOENT-as-content led to LLM-narrated failure reports **persisted as memoryNote**
  (`gap-route-edit-1ac09d4f-failure-analysis-*`). Fabricated memory entered the authoritative store.

### selection-learning

- 3839090: NaN maxCost made every Thompson score NaN, so selection was **deterministic arms[0]**. Also:
  drafting arms were graded on `resolved===true` (responsiveness, not edit capability).
- 3068940: billing refusals were counted as model failures.
- light-dispatch 66b95e1: retirement was keyed on the lying `success_rate`, which retired 21 working arms.
- fce8203: lost policy writes meant lost posterior updates under load.
- ribosome b6a430f (08-05): the recursion guard never fired, producing `learned-learned-learned-auto-bridge-shellresult`
  (selected by a live walk) and 21 copies of `...-proof-`/`-improved-`. The derivative arm pool diluted selection.

### composition-crystallization

- Ribosome extraction: dead or storming, alternately.
  - 07-30 43a6d0b: **3,746 of 3,746 dispatches failed** over ~27 days. `activityDispatch` has no server.
    goal-host `mintReachedTrace` already runs ribosome-extract in-process, so the ribosome dispatch path is
    a **duplicate that was subsumed**.
  - 08-02 572cd6c: zero extractions in 12 h.
  - 08-02 079c160: a storm of 334 failing dispatches in 20 min (duplicate events, no recursion safety,
    wrong payload).
  - 08-02 f0322c3: the drain-timer path was 906/934 of dispatches at **0% success**.
  - Live now: 505 dispatches in 7 days; 515 `learned-` rows in `activity`.
  - `WARN extractionEligibilityPolicy unresolved — falling back to literal` appeared 1,199 times in 7 days.
    The law-1 policy impulse does not exist, so the fallback is the steady state.

### dormant-mechanism

- discovery distribution_policy / duplicate_policy (07-30/31): one registrant.
- ribosome `extractionEligibilityPolicy` / `extractionPolicy` shaped impulses: never resolved (1,199 + 959 WARNs in 7 days).
- light-dispatch retire-sweep: broken, running at 0/0 coverage.
- libp2p `federation-hub-e2e.ts` test (baa360c): no evidence it runs.

### env-gating

- llm-resolver has 29 distinct env vars: provider keys, `VLLM_ENDPOINTS`, `RUNPOD_MODELS`, `RUNPOD_COST_PER_MTOK`
  (08-08 f91dba8/e525336/9ca95f8), `LLM_TOOL_DISPATCH_ENDPOINT`. Identity has 37. Discovery has 16,
  including `PEER_FANOUT_MODE`.
- 0b7db2d is an explicit workaround for env frozen at boot (law 1). It reads the env file at request time
  instead of turning the relay anchor into a shape.
- metabob-cloud-dashboard 5529fbd: views gated behind `VITE_ENABLE_ACTIVITY_VIEWS`.

### trace-store-db

- identity bfad5ca (07-29, SA-identity/operator): no TTL on key_session. **1.34 M rows thrashed the host**
  and the table regrew to 10,165 (99.4% expired). The fix was an amortized reaper.
- metabob-cloud-dashboard 3f5e35e (08-17): a 5s poll on an O(table) `ORDER BY … LIMIT 10` over 473,176
  rows put all 8 SurrealDB workers at 96% and **30 s latency fleet-wide. The substrate's reach/credit
  writes timed out and were lost.** The durable fix (narrow projection, named in migration 162) was not done.
- user-vessel and identity 27d63f7/dc2719c (05-01): retry after auth-state loss on a SurrealDB restart.
- identity 69c7796: WITH INDEX hint for sessions.

### codebase-bloat-fossils

- **Non-submodule repo directories** in `repos/`. They are gitignored, not in `.gitmodules`, and not deployed:
  - conversation-vessel: last commit 05-22. Superseded by llm-resolver as the `llm_completion` producer.
  - user-vessel: 05-28. Phase A/B federation accounts, invitations and federation_links, superseded by
    discovery/libp2p federation. identity-vessel still carries an optional `user-vessel-client`, disabled.
  - metabob-cloud-dashboard: 08-17. Product-era dashboard.
  - react-renderer: 04-30.
  - terminal: 04-30.
- cpg-inference-ts is live as a library of analysis-vessel (WASM tree-sitter since 06-23).
- libp2p 542e712 committed build artefacts.
- `/vessels/*-mitosis-*` residue directories: 12 on the hub.
- Duplicate code:
  - two shell spawn sites;
  - two ghost-sweep implementations (IIFE and function), later a third (retire sweep);
  - two path resolvers (analysis `resolve-file-path.ts`, local-tools `mapPath`);
  - the duplicate `llmCompletion` Map entry;
  - duplicate missing-key warn lines;
  - triple-guarded `choices`.
- "Product-era vessel name" retirement: identity f6f1c24 and light-dispatch 8e7a471 (08-02).

### test-residue-live-state

- discovery 7cc9da4: "a short-lived process (verify-suite or staged copy booted with an ephemeral PORT)
  registering under a shared shape and dying left a row that refused every connection". Measured 4 times
  on 09-19/20. Each time it blinded fleet-wide compose grounding until a manual local-tools restart.
  Verification runs leak registrations into the live registry. The fix evicts at resolve time (a symptom
  fix). ffd1d58 then added the gap "something re-registers local-tools".
- analysis/local-tools mirrored tests (08-09): a test that re-implements its subject cannot fail.

### false-verification

- local-tools 31a102e (06-23): typecheck error_count was always 0, so typecheck-broken edits landed via
  cutover (false FAVORABLE).
- local-tools a999128: bun missing from PATH meant every compose was UNFAVORABLE. False negatives from the environment.
- e4d604c: correct patches were rolled back because the verify was killed at 30s. "Correct work,
  discarded by a watchdog." Proven by re-applying the edits: tsc exit 0.
- light-dispatch 7f3a81f/8de5cfa: the sweep reported success against a nonexistent endpoint. The coverage
  warning compared against the *requested* limit, not the response ("a no-silent-caps guard that trusts
  the request instead of the response is not a guard").
- The mirrored tests (above).

### node-locality

- Unit state differs by node:
  - hub (substrate-live): metric-collector and federation-transport are inactive.
  - node 2 (compose2-live): metric-collector, ribosome, stateful-ui and identity are inactive;
    federation-transport and discovery are active.
  - libp2p and metric-collector clones are absent on node 2.
- No journal evidence was gathered for node 2.

### spend-envelope-throughput

- 44c2b21: test/typecheck commands had no concurrency cap (10+ concurrent, thermal throttling). The
  compose-lane cap "bound a population that was never the dominant one".
- llm-resolver 7d7bf0a (09-26 SA): spend metering at the resolver-map edge. **llmSpendSummary has readers**
  (boredom, development-vessel gap-to-feature/config/impulses). Live-used.
- local-tools execution_id threading (fa603a0 etc.): `SUBSTRATE_EXECUTION_ID` is read by
  `scripts/substrate/git-hooks-ledger/_record.sh` and goal-host. Live-used, for the causal-attempt ledger.

---

## Mechanisms

| Mechanism | Location | General? | Status | Evidence |
|---|---|---|---|---|
| groupBounded + /proc killtree + test-exec slot governor | local-tools src/index.ts, test-exec-slots.ts | general (every shell verify path) | live-used | e4d604c/44c2b21/791051e; MAX_TIMEOUT_SEC=900 live |
| boundedShellResolver (second spawn site) | local-tools src/index.ts (c709850, 07-22 SA) | specific | duplicate | every fix applied twice (44c2b21, fa603a0+9eb4808, 11636e6) |
| fs_edit guards (empty anchor, identity, truncation, re-ground on miss, unicode-normalized, function replacer) | local-tools fsEdit/fsWrite | general (edit primitive for every drafter) | live-used | b42db41, dded800, 67a9e71, 52928b8, c0afa0f, 6b0d86a |
| mapPath (repos/→/vessels, bare→workspace) | local-tools | general | live-used, duplicate of analysis resolve-file-path | 2aaa834, 44375c6 |
| resolve-file-path | analysis-vessel | specific | live-used, duplicate | 5a890c3, afb6955 |
| retireNeverSucceededTemplates (retire-sweep) | light-dispatch src/index.ts:152-222 | general (arm-pool hygiene) | broken | Bearer→401, ApiKey→200; `covered 0/0` ×89 since ≥09-25; hourly setInterval (law 5) |
| deprecateGhostTemplates (07-13 SA) | light-dispatch (5e75c6e/6d036d8/ed6458b) | specific (hardcoded 2 ids) | fossil (replaced 08-04) | POSTed to a nonexistent route; status never checked |
| light-dispatch reach POST | light-dispatch runDispatch (59732fd) | specific | duplicate (third reach writer) | route exists (200 vs 404 control); ribosome 5a374df documents the multi-writer defect |
| ribosome reach re-read + census gate + depth bound | ribosome src/index.ts | general (the only ribosome gate) | live-used | 17,188 ALLOWED / 505 dispatched in 7 days |
| ribosome activityDispatch extraction path | ribosome (43a6d0b) | specific | duplicate of goal-host mintReachedTrace in-process extraction | 3,746/3,746 failed pre-07-30 |
| extractionEligibilityPolicy / extractionPolicy shaped impulses | ribosome (c779cfd) | general (law-1 read) | dormant | 1,199 + 959 "unresolved — falling back" WARNs in 7 days |
| ribosome discovery registration (shapes: []) | ribosome :697 vs discovery 7cc9da4 | specific | broken | 5,208 `register failed: 400` in 7 days |
| discovery register validation + resolve-time dead-row eviction + registration liveness guard + registrant identity | discovery (7cc9da4, ffd1d58) | general (routing fixed point) | live-used | 1,499 `/register 400` per day (mostly ribosome) |
| discovery identity-validation cache + grace + reason-bearing 401 | discovery auth (db639cf, 7978682, 3f0edc9) | general | live-used | still ~32 identity-rejected 401/day |
| distribution_policy / duplicate_policy | discovery types/registry/resolvers (7e051d7, 6ab2e24) | general | dormant | one registrant (obsidian sidecar :686); goal-host satisfier-pick reads it |
| /bootstrap point-and-go + RELAY_MULTIADDR env-file read | discovery (dfe8e24, b7d867f, 0b7db2d) | general | live-used (presumed; not probed) | 0b7db2d |
| libp2p sendAll chunking + forced re-reservation | libp2p src/index.ts | general (federation transport) | unknown (federation-transport inactive on hub) | 7f2b6c9, c68b54b |
| libp2p compiled .js/.d.ts in repo | libp2p (542e712) | n/a | fossil | stale vs .ts; unit ExecStartPre copies src |
| llm-resolver quota-gated advertisement + lastPlaneDark gap + last-resort willingness | llm-resolver | general (the LLM plane) | live-used | 1f14a69, 0768990, 272edbd, 04b2e8f, 3ea2136 |
| reportMissingKey (keyed dedup) | llm-resolver :323-352 | specific | live-used (after the 789853a dedup) | 3 duplicate landings before; flood 472/474 |
| savePolicy serialised chain | llm-resolver model-policy.ts (fce8203 SA) | general | live-used | 157 outcomes lost before |
| spend metering (llmSpendSummary) | llm-resolver (7d7bf0a SA) | general | live-used | readers in boredom and development-vessel |
| pointer-body unwrap | llm-resolver pointer-body.ts (db8af1d) | should be general; is specific | live-used, duplicates per-resolver unwrapping in local-tools | a559094, 8bf69ea, 1b88738, db8af1d |
| SUBSTRATE_EXECUTION_ID env threading | local-tools sh/bounded/gitCommit | general (causal ledger) | live-used | read by git-hooks-ledger/_record.sh and goal-host |
| key_session amortized reaper | identity (bfad5ca) | specific | live-used (presumed) | 1.34 M-row history |
| redis revocation + surreal listing split | identity (c8bf5d9) | specific | fixed 08-22 | four fixes |
| stateful-ui uiQuestion reader + panel persistence | stateful-ui (6dc8107, becfa05) | specific | live-used on a replaced surface | 794 panels, no human reader |
| user-vessel client in identity | identity services/user-vessel-client | specific | fossil (disabled; user-vessel not deployed) | config.userVessel.enabled |
| conversation-vessel, user-vessel, metabob-cloud-dashboard, react-renderer, terminal | repos/ (gitignored) | n/a | fossil | not in .gitmodules, no units |
| cpg-inference-ts (WASM tree-sitter) | lib used by analysis-vessel | general | live-used | analysis-vessel active on both nodes |
| metric-collector-vessel | repos/metric-collector-vessel | specific | dormant (unit disabled on both nodes) yet received SA landings | a885631, 6a93e22 |

---

## Principles found in this shard (commit bodies, with location)

- "A stated rule with no code check is a comment." (local-tools dded800)
- "A test that re-implements its subject is worse than no test: it reports coverage that does not exist." (local-tools 7a38f37, analysis afb6955)
- "A no-silent-caps guard that trusts the request instead of the response is not a guard." (light-dispatch 8de5cfa)
- "Suppressing repetition must not suppress recurrence." / "A condition that cannot be resolved by filing a gap must not express itself by filing one repeatedly." (llm-resolver 789853a)
- "A negative is unattributed until a positive control shares its address." (llm-resolver 789853a, 5 times in one session)
- "De-advertising is the correct REACTION and a poor DETECTION." (llm-resolver 0768990)
- "A default is a LAST RESORT, not a route." / "A pin is a preference, not a mandate." (llm-resolver 272edbd, 5b199b3)
- "A dry default must not blackhole a live plane." "Policy arms and ROUTABLE models are not the same set." (04b2e8f)
- "A configured id the provider does not serve is a PHANTOM ARM." (dd9d886)
- "A provider's billing state was being recorded as model quality": grade the right signal. (3068940)
- The ribosome must extract on the **honest reach verdict**, never on exit status. Re-deriving reach locally forks the primitive (law 3). (a54691d)
- "Two writers with different rules" is the defect: fix the write side, not the read side. (ribosome 5a374df)
- A hard-fail gate must be corpus-checked against real traffic before landing. (local-tools b42db41, 67a9e71)
- Information at the right time: return the real surrounding lines when an anchor misses. (52928b8)
- "Slow the fleet, never make it unable to verify itself": governors fail open. (44c2b21)
- A verify that ends with no exit code is the signature of a kill, not a failure. (e4d604c)
- "A 401 that cannot tell 'reissue this credential' from 'repair this network path' is not an error message." (discovery 7978682)
- Comments are what a future reader actually reads. A refuted mechanism story in a comment is a defect. (81c8f57)
- Overriding a documented design principle app-wide is not a unilateral call. Fix the one O(table) query. (dashboard 3f5e35e)
- Tag deliberately-non-extractable telemetry as reached:false rather than leaving it ungraded. (identity 01af799)
