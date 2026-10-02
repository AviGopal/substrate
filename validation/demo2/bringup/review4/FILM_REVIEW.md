# Film review — three-path bring-up (v3)

## Verdict

**PASS WITH DEFECTS.** Both of the defect classes this review exists to catch are absent from this cut, and I verified that directly rather than taking the captions at face value. The counted-caption fix held: `b.jsonl` "FOUR check(s) failed. This list is counted from the output above, not written by hand" is backed by exactly four failing sources in the frame above it (`[ready] NOT ready: 7 unit(s) down`, `FAIL surrealdb root auth FAILED`, `FAIL activity-api authed probe returned HTTP 000`, `FAIL all 3 local llm arm(s) are up but CANNOT COMPLETE`), and `c.jsonl` "THREE check(s) failed" is backed by exactly three (`NOT ready: 1 unit(s) down`, `FAIL activity-api … HTTP 000`, `FAIL all 3 local llm arm(s) …`). The phantom-verification class is also clean: the provider-401 narration attributes the body to "the arm's own call", and that call really happened — `substrate-doctor.sh` check 7 POSTs a real 16-token completion to each local arm, and the on-screen grep at `b.jsonl` t=1787163994.5 / `c.jsonl` t=1787164299.4 re-surfaces *that run's own record* by timestamp, not a hardcoded string. One narration line survives as a genuine (minor) defect: path B's closing "The container is healthy" is hardcoded prose that generalises past what the same pane just showed crash-looping.

## Secrets

**No credential value is visible anywhere in the three logs.** What I checked:

- Prefix sweep across `a.jsonl b.jsonl c.jsonl` for `sk-ant-|sk-proj-|sk-|gho_|ghp_|ghu_|ghs_|github_pat_|mb-|eyJ` → exactly **one** hit, `c.jsonl` ~record 306, and it is the *text of a `grep -viE 'mb-[A-Za-z0-9]|…'` filter* inside a logged command line — a pattern, not a value. The redactor's `[:6]` prefix-preserving branch never executed in this cut.
- Redaction survey: **26** `<redacted>` occurrences, and I confirmed the *form* of every one (the naive quote-matching grep returns empty because the jsonl escapes quotes — a filter measuring itself). All 26 are name-form: `-e GITHUB_TOKEN="<redacted>"` ×5, `-e SUBSTRATE_GIT_PAT="<redacted>"` ×5, `-e METABOB_API_KEY="<redacted>"` ×4, `OPENAI_API_KEY=<redacted>` ×4, `-e ANTHROPIC_API_KEY="<redacted>"` ×2, `hub api key : <redacted> chars)` ×2, `git pat : <redacted>` ×2. Variable name and separator survive; no value material does.
- Closest-to-key-material line in the artifact: `c.jsonl` t=1787164301.150 — `{"valid":true,"org_id":"organizations:substrate","user_id":"users:<redacted>","key_id":"key_<redacted>","scopes":["read","write"],"role":"user"}`. This is **required** evidence for the adjacent narration ("does THIS identity's secret sign a key it issued?") — redacting it would manufacture the exact defect this review targets. The key itself is captured into `$K` and never echoed (t=1787164301.07); `org_id` is a repo-wide constant; `user_id`/`key_id` are per-seed random ids on a throwaway network; the signature and `iss` are absent, so nothing here reassembles into a usable key. The film also runs its own negative control immediately after (t=1787164301.2): the hub's key against this identity → `{"valid":false,"error":"Invalid API key signature"}`.

## Does the surface show data

The three right panes render **three different shape counts**, which is itself the proof that the UI pane is per-instance and not a reused screenshot.

| Path | What the UI pane renders | Instance-correctness cross-check |
|---|---|---|
| **A** (UI-only onto hub) | ASK box live with "The 15 shapes currently visible are all internal plumbing…"; RUNS board shows the error state "The board could not be read: upstream unreachable. This is the surface failing, not the fleet being idle." | The board error is the **verbatim body** of `a.jsonl` t=1787162575.219 — `{"error":"upstream unreachable",…}` returned HTTP 502 to the terminal one second earlier. 18 frames captured = the log's own "surface photographed on :25310 — 18 screenshot(s) captured". |
| **B** (compute spoke onto hub) | Full board: ASK + chips, "Derived from the **320** shapes the fleet is advertising right now", one RUNS row `not reached — deliver obsidian active-note assist / Not reached. The template exited cleanly and the goal was still not met.`, DETAIL panel | 320 matches `b.jsonl` t≈1787164025 out `{"totalVessels":15,"totalShapes":320,"healthyCount":15}` exactly. 6 frames = "6 screenshot(s) captured". |
| **C** (new network, full fleet) | Same board, "Derived from the **404** shapes" at 1787164305, **342** at 1787164335; two RUNS rows, both `not reached, and the walk did not record a reason` | Terminal `curl 127.0.0.1:27100/registry/stats` at t=1787164336.78 → "14 vessels, **404** shapes, 14 healthy". The 404→342→404 movement is real and is the crash-loop the same frame narrates (`llm-haiku`, `llm-opus`, `llm-resolver-google` in `activating/auto-restart`), not a compositing artefact — the pane and the terminal agree at 404 when sampled ~30s apart. |

Both B and C reach a genuinely rendered surface late in the run (vessel-ctl install at t=1787163999.3 and t=1787164303.6). The share of film time given to the surface (~16% and ~23%) is *larger* than the share of real wall time it existed for (~12% and ~10%), so the brevity is fidelity, not under-selling.

## Narration truthfulness

The computed-caption fix held, and I checked it against the evidence rather than against the caption's own claim to be computed:

- `b` "FOUR check(s) failed" — four failing sources present verbatim in the preceding frame. Correct.
- `c` "THREE check(s) failed" — three present verbatim. Correct. (One cosmetic tell: the verdict lists *llm arms* before *activity-api* while the frame above prints them in the opposite order, because the counter unions FAIL lines across both doctor runs. Membership is right; only ordering differs.)
- `b` "5 unit(s) above are in auto-restart — crash-looping right now" is computed live (`grep -c auto-restart`) and matches the five `activating/auto-restart` units printed immediately above.
- Provider-401: `b`/`c` "that body is the PROVIDER's, returned to the arm's own call — the request reached Anthropic and was refused there." A real paid call was made in-run by doctor check 7; the response is a resolver envelope `{"resolved":false,"shape":"llmCompletion","error":"401 {…authentication_error…}"}` — the nesting proves the arm accepted the request and the upstream refused it. The on-screen grep visibly names its own source (`logs/b.jsonl`) and is an exhibit step, not a claimed independent check. This is the opposite of the previous cut's defect.
- Path A emits no counted caption at all; it emits a script-generated PASS/FAIL VERDICT block instead, and its closing "The surface is up and serving; the FEDERATION of it is what did not happen" is backed by the live 0-row hub check (`this container's federation id: spoke-6bca452c` / `rows in the hub answer matching it: 0`) and the assert at t=1787162442. Structural asymmetry between paths, not a false claim.
- **Remaining hardcoded claim: one.** See below.

## Defects

| Severity | Where | What | Fix |
|---|---|---|---|
| minor | `b.jsonl` say, t=1787164036 — *"so this path does NOT get to exit 0. The container is healthy, the surface serves, and the thing the path is FOR did not happen."* Hardcoded at `harness/path-b.sh:169` (the `JOINED -eq 0` branch). | No probe in path B measures container or fleet health. Sixty lines earlier the same pane shows `[ready] NOT ready: 7 unit(s) down`, seven units in `activating/auto-restart` (bootstrap-seeder, concept-db-seeder, federation-transport-vessel, llm-google, llm-haiku, llm-opus, substrate-ready), and the path's own computed line "5 unit(s) above are in auto-restart — crash-looping right now". Three of those are the llm arms the same path says "cannot draft". The nearest supporting `out` records (`/health` 200, `healthyCount:15`, HTTP 200) evidence "the surface serves", not "the container is healthy". | Reword to "the container is up and the surface serves", or compute it — e.g. emit the auto-restart count into the sentence. |

Note on the finding as originally filed: its supporting citation of a right-pane `substrate-demo-spoke Up 4 minutes (healthy)` frame is fabricated — path B's right pane is the human-surface board throughout, with no docker output in any of its six frames. The defect stands on the log records alone.

## What to change next

1. **Fix `path-b.sh:169`** — the one surviving hardcoded health claim (above). Cheapest, and it is the only line in the film a hostile viewer can point at.
2. **Harden `_counted_failures` against FAIL→PASS across doctor re-runs.** It unions FAIL lines over every doctor run in a tag, so a check that failed early and passed later would still be narrated as failing "from the output above". It did not fire here — C's only flip is PASS→FAIL, which the union handles correctly by construction — but the cross-run ordering tell in C's verdict shows the mechanism is live. Keep the last run's membership, not the union.
3. **Drop the redactor's `[:6]` prefix retention** (`vidkit.py:92`). It never executed in this cut, and for `sk-`/`mb-` it would preserve 3 characters of real key material. Replace the value wholesale, as the name-rule already does.
4. **Optional polish, not defects:** the ~1s "human surface: not serving yet" residue at C's install boundary (10s status-poll cadence vs a 12ms curl — already disclosed by the permanent banner), and the caption floods at the three segment openings where several records share one capture timestamp and drop below the 0.35s dwell floor.