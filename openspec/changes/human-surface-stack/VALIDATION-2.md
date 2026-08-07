# VALIDATION-2 — the do-anything surface, second pass

Four agents worked in parallel: a design audit, an intent resolver, a design-fix
build, a UI-only container script, and two verifiers. This is the skeptic's
record. Every claim below is either (a) reproduced firsthand in this pass, marked
**[verified here]**, or (b) carried from an agent that pasted real output, marked
**[agent output]**, or (c) named as unproven. Nothing is transcribed on trust.

The headline: **the loop does not close through the box.** Two of the three
deliverables work in isolation and neither is reachable the way a human would
reach it.

---

## 1. THE FEEDBACK LOOP

**Does a human instruction typed in the box change the interface? No.**

The textarea is not connected to the parser. **[verified here]**

```
$ grep -rn "surface-intent" repos/human-surface-vessel/ui/src/
(no output)
$ grep -c "surface-intent" repos/human-surface-vessel/ui/dist/assets/*.js
0
```

Zero references in source, zero in the shipped bundle. The box's only outbound
path is a single fetch:

```
ui/src/api/client.ts:59:  const res = await fetch("/api/run-goal", {
```

So every instruction typed by a human — *"make the text bigger"*, *"show
shellResult as a table"*, *"make it sound more optimistic"* — is dispatched to
goal-host as a goal. The parser never sees it.

### The parser itself works

`POST /api/surface-intent` and `GET /api/surface-intent/grammar` exist, answer,
and are routable by shape. **[verified here]**

```
$ curl -o /dev/null -w '%{http_code}' .../api/surface-intent/grammar
200
$ curl -X POST .../api/discovery/resolve -d '{"pointer":{"type":"vesselCapability","shape":"surfaceIntent"}}'
{"content":{"shape":"surfaceIntent","vessels":[{"vesselId":"human-surface-vessel-local",
 "endpoint":"http://127.0.0.1:8310","public_endpoint":"http://127.0.0.1:18310","confidence":1,…
```

Driven by curl it is genuinely good **[agent output]** — eleven exercises with
pasted responses. Two clauses both applied, with a `changes[]` naming field, old
value, new value and the clause that caused it. Nonsense refused with **422**,
`applied:false`, nothing written, revision not advanced. Partial instructions
report the half they dropped. An unknown form is named against the closed set
(`'hologram' is not a form this surface can render`). Clamping is reported, not
silent. The verifier reproduced the important ones independently:
`revision 0→1` (type scale rewritten), `1→2` (`formByShape.shellResult → rows`),
and `2→2` **no bump** on the unparseable clause.

And the shaped-impulse half is real. The verifier's positive control wrote the
policy while the page was open: `revision 4→5`, `--sf-text-base` 14.5→19.14px,
chips rewrapped from one row to two, **no reload**. Law 1's read-at-use-time
contract holds.

### Which instruction classes work — exactly

Through `/api/surface-intent` (curl only): bigger/smaller with intensity ·
named px · `show <shape> as <form>`, where `<form>` is the closed set in
`ContentRender.tsx` · `stop overriding <shape>` · denser/looser ·
expand/collapse ledger · preview N chars · reset to defaults.
**Eight ordered rules, closed set.**

Everything else — *"make it feel more like a newspaper"*, *"show everything as
prose"* — is refused with a `suggested_goal` string that **nothing dispatches**.

**Through the box: none of them.**

### Three independent breaks, any one of which is fatal

1. **The textarea is unwired** (above).
2. **The proxy cannot reach goal-host.** `POST /api/resolve` → **502**
   `{"error":"upstream unreachable"}` **[verified here]**, while goal-host
   answers **200** from the same network position. This is why the RUNS board
   shows its outage banner permanently and why every dispatch fails.
3. **The pause control moves out from under the pointer** — 151.5px left, on
   `pointerenter`, because the *"held — you are in this region"* note reflows
   into the same row. **[agent output]** This is the attested "panel must not
   move under the reader" failure occurring on the one control that exists to
   stop the panel moving. Pause is currently reachable only by keyboard or
   script.

### The 502 is pre-existing and the author already documented it

Not introduced by this change: the diff adds 92 lines to `proxy.ts` and **zero**
of them touch `resolveGoalHostEndpoint`. **[verified here]** That function
carries a comment narrating this exact failure —

> vessels register their IN-CONTAINER address … That is correct for a peer
> inside the same container and unreachable for anyone else … because the lookup
> SUCCEEDED the env fallback never fires — a silent 502 with a healthy-looking
> registry. obsidian-vessel's federation sidecar hits the same wall and solves
> it by remapping loopback to the discovery host with the port offset; until
> this vessel does the same, an explicit override is the escape hatch.

The escape hatch is `GOAL_HOST_ENDPOINT`, and it is **empty** on the running
container. **[verified here]** So: a known defect, a documented remedy not
implemented, and an interim override nobody set. Note also that the override is
an env gate on routing behaviour — a law-1 smell, acceptable only as the
temporary thing the comment says it is. The durable fix is in the same record
the surface already receives: **`public_endpoint` is right there beside
`endpoint`** and is ignored.

### A bespoke parser, not the walk — this is a gap

State it plainly, because it is the most important structural finding here.

`readSurfaceIntent` is a deterministic 8-rule parser reachable only over HTTP.
It is **not an activity**. Thompson cannot select it, no trace grades it, the
ribosome can never extract from it, and no walk can compose it with anything.
By law 2 a behaviour that exists only as a resolver is invisible to the learning
loop; by law 13 a human sends prose and *the system* owns decomposition.

The build agent's own scope note — *"No LLM escalation on the resolve path.
Unparsed clauses carry a `suggested_goal` string; nothing dispatches it. A human
choosing to send it is the escalation"* — describes the gap precisely. The
system computed the goal text and handed the human the job of dispatching it.

So the honest reading of *"make it sound more optimistic"*: the parser refuses it
correctly and helpfully, and **there is no path from that refusal to the walk**.
The capability the walk cannot reach is the gap. The parser is a fine floor; it
was built as a ceiling.

---

## 2. DESIGN

Fifteen ranked defects were filed. **Most were genuinely fixed**, and the
re-audit measured them on the running surface rather than asserting them.

### Fixed, with evidence

| Defect | Evidence |
|---|---|
| RUNS region flapped between its error banner and a loading placeholder, hiding its own outage one second in three (`L E E L E E …`) | 20 consecutive samples on the rebuilt surface: `E E E E E E E E E E E E E E E E E E E E`. One state. `role="status"` added. **[agent output]** |
| Board showed 9% of itself at a hard 290px, clipping rows mid-glyph | `clientHeight` 290 → **405px** at a 900px viewport via `clamp(290px, 45vh, 720px)`; edge mask present. Region is still viewport- not content-proportional, so the no-reflow guarantee holds. |
| 50 consecutive tab stops, each one scrolling the window under the reader | Roving tabindex keyed on **dispatchId, not index**, with a membership guard. Measured tab ring: 62 focusable candidates, **12 stops**, exactly one run row. |
| Gap region title was a `<span>` on a class with no CSS rule; no `<h1>` anywhere | Outline now `H1 … H2:Ask, H2:Runs, H2:Detail, H2:Known wrong with this interface`. |
| `reopened 4×` — the panel's most alarming datum — in the quietest ink at the tail of a meta line | Promoted to a badge on the stalled token pair, reading `reopened 4× — the fix did not hold`. |
| Every starter chip dashed, making the legend unfalsifiable | Three states: live / unverified / unknown. A chip goes dashed only on a confirmed negative. |
| Disabled Send at 2.04:1, reading as a live CTA in a broken state | Recessed to panel-alt with an ink-3 label, not a dimmed label on an accent fill. |
| Char count shown *instead of* content | Count now sits **below** the rendered content. |
| Dead type scale; region titles smaller than body | Respaced `xs 12 / sm 13.5 / base 14.5 / lg 18 / xl 22 / 2xl 28`; titles → `sm`; the goal and the verdict → `xl`. |
| No measure — prose ran to 178 characters | `--sf-measure-prose: 70ch` / `--sf-measure-ui: 84ch` applied across nine selectors. |

Badge contrast: **12 of 12 state pairs pass AA in both themes.** Recomputed
independently here, matching the re-audit to the hundredth: reached **5.47:1**
light, not-reached **6.04:1** light. The two are within 0.6 of each other in
both themes — the equal-weight thesis is numerically true, not just stated.
**[verified here]**

Three fixes were made *better* than filed, and each says why: the in-flight rail
is `box-shadow: inset` not `border-left` (a border shifts content 2px the instant
a run starts, which is the failure the region exists to prevent); the run-reason
clamp was chosen over expand-on-select (which changes row height on click); and
the JSON-in-serif fix needed a `JSON.parse` test in `Prose.tsx`, because the
motivating case is *unfenced* and the proposed `:has(> code:only-child)` rule
could never have fired on it. Refusing a filed fix with a reason is the right
behaviour.

### Still unfinished

1. **`--sf-ink-3` fails AA on normal-size text — four pairs.**
   **[verified here]**, recomputed from the token file:
   `#6E7982` on paper `#F0F2F3` = **3.96:1**; on panel = **4.33:1**; on
   panel-alt = **4.14:1**; dark `#7A858C` on panel-alt = **4.27:1**. Bar is
   4.5:1. It is rendered at 12–12.5px on region titles, run meta, gap meta,
   ledger foot and the machine record — nothing near the 18px large-text
   exception. This is the one real accessibility failure left.

2. **The evidence ledger's count contradicts its own list.** `EvidenceLedger.tsx`
   prints `{entries.length} impulse(s) in the pool` and then renders
   `AnswerEntry` **plus** `entries.map(…)`. **[verified here]** Observed: note
   says *3 impulses*, DOM has 4 `.sf-ledger-entry`. On a panel whose premise is
   that a count is not evidence, a count that disagrees with the list beneath it
   is the worst available error.

3. **GapStrip is the one live region with neither a buffer nor a pause control.**
   **[verified here]**: it imports `useLiveControls` but not `LiveControls`,
   while RunsRegion imports both and renders it. So a newly-filed gap splices
   above whatever the reader is reading, and the affordance to stop that is the
   one thing not in the region. The conformance checker's P3 hit here is real;
   its P6 pass is a false negative (the rule matches the word `paused`, not the
   rendered control).

4. **The type-scale fix is at the mercy of a live override, with no floor.**
   `useTokenOverrides` applies any `--*` value verbatim, unvalidated. The
   re-audit measured the whole respacing defeated by a policy revision pinning
   the old values — correct behaviour per law 1 (the impulse wins), but it means
   a typed instruction can drive the surface below the 12px floor the
   substrate's own scanner polices. **That specific override has since been
   withdrawn** — the policy now reads `revision: 13, tokenOverrides: {}`
   **[verified here]** — so the respacing renders today and the re-audit's
   screenshots were taken through an override that no longer exists. The
   transient is gone; the missing floor is the durable defect.

5. **The scroll mask fades content that is not clipped** — unconditional, so the
   first row is partly transparent at `scrollTop: 0`. Should be gated on scroll
   position.

6. **Two sources of truth for a state colour.** `styles.css` paints `accepted`
   with the *running* pair; `packages/design-tokens/index.ts:69` still declares
   `accepted: { fg: var(--sf-accepted), bg: var(--sf-accepted-bg) }`.
   **[verified here]** Nothing reads those fields today, so it is a stale
   declaration rather than a live conflict — in the package whose stated
   contract is to be the only one. Secondary cost: `accepted` and `running` are
   now the same hue, separated only by label and mark.

7. **Design tokens re-authored outside the token package.** `styles.css:31-54`
   redeclares four `--sf-text-*` steps and `--sf-live-region-height` and
   introduces three new tokens, against `tokens.css`'s stated contract that
   surfaces consume and do not re-author. **[verified here]** The block is
   commented, names the reason (the package was outside the writable scope) and
   names the follow-up — tracked debt, not silent drift. It should not become
   permanent.

8. **DETAIL still says some things twice** — the verdict prose appears in the
   verdict line and again in the `goal_answer` card. Partially fixed; the
   `goal` impulse card duplication was **kept deliberately**, on the ground that
   the ledger's contract is to mirror every impulse regardless of outcome.
   That reasoning is sound.

9. **`<summary>` falls through to the UA focus ring** because the `:where(...)`
   list omits it. A consistency defect, not a WCAG failure — the UA ring is
   visible in both themes.

10. **The interval `<select>` is still a native OS widget** (`appearance: auto`),
    restyled but not replaced — a deliberate call, since a custom arrow needs an
    embedded SVG and a hex fill, and the no-colour-literal rule has no exception.
    A native affordance beats a rule violation.

### The conformance checker

Six findings; the re-audit's per-finding analysis is proven by source reading:
**1 real** (GapStrip splice), **1 unstated exemption** (`useNow` diverges
defensibly and says so nowhere), **4 false positives** — including a *new* FP
mode where a `${res.status}` interpolation inside a thrown `Error` is read as a
rendered status. The self-test is honest: 30/30, proving each rule both refuses
and passes cleanly, and proving that a bare or unknown-rule exemption is itself
a violation. Note the remedy for the one real finding names `<LiveList>`, a
component that **exists nowhere in the codebase**.

---

## 3. THE UI-ONLY CONTAINER

**Not booted. Not federated. Genuinely-UI-only never assessed — no unit ever
started.**

The container exited **1** roughly 300ms after `docker run`, before a single
service. The whole container log is two lines **[agent output]**:

```
[substrate] generating /etc/substrate/env
[gen-env] ERROR: No LLM provider key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY
          (a root/standalone needs one; a spoke inherits LLM from its hub).
```

### Root cause — two deliberate decisions contradict each other. **[verified here]**

`scripts/substrate/gen-env.sh:20-26` infers spoke-ness **solely** from
`DISCOVERY_ENDPOINT`:

```bash
_llmkey_disc_host="$(printf '%s' "${DISCOVERY_ENDPOINT:-}" | sed -E 's#^[a-z]+://##; s#[:/].*##')"
case "$_llmkey_disc_host" in
  ""|127.0.0.1|localhost|0.0.0.0|::1|"$(hostname 2>/dev/null)") _is_spoke=0 ;;
  *) _is_spoke=1 ;;
esac
if [[ "$_is_spoke" = "0" && -z "${ANTHROPIC_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
```

`scripts/substrate/Makefile:166` sets `CONTAINER_DISCOVERY_ENDPOINT :=` (empty)
on the spoke path — deliberately, so local vessels register with their own
registry. The script blanks provider keys, also deliberately, because a spoke
inherits LLM from its hub. Result: `DISCOVERY_ENDPOINT=""` → `_is_spoke=0` →
"root/standalone" → key required → none present → exit 1.

`HUB_DISCOVERY_URL` **is** set and **is** the correct spoke signal. The guard
never consults it — the same file reads it only further down, after the guard has
already exited. The Makefile's own precondition check passed at the host layer;
the guard is re-imposed, incorrectly, inside the container.

### What did work, and it is not nothing

The script's edges all behaved as documented **[agent output]**: the stale-image
preflight **refused** to run against an image whose baked manifest predates
`human-surface-vessel` (correct, and it named the remedy); the port preflight
refused on conflict at offset 0 and passed at offset 1000; it never touched
`substrate-live`, confirmed healthy before and after. It also caught that the
super-repo is private, so the git credential is mandatory rather than optional —
the single most likely silent failure in the original plan.

### Federation: untested, blocked behind the boot

Hub registry: **34 vessels before, 34 after, zero-line diff.** **[agent output]**
No row from this container.

One caveat worth preserving: `human-surface-vessel-local@<spoke-id>` **already
exists** in the hub registry, mirrored via `substrate-live`'s spoke id. A plain
grep for `human-surface` against the hub would have produced a **false PASS**.
The script's `@<FED_ID>` suffix match is what keeps them apart. Likewise
`uiPanel_write` is already advertised by three existing vessels, so that shape
alone proves nothing.

### Cleanup, verified **[verified here]**

No `substrate-ui` container. No `substrate-ui-*` volumes. `:dev` restored to its
original image id, with a backup tag alongside; the rebuild parked at
`:ui-verify` for deliberate promotion. Nothing was left behind.

---

## 4. WHAT IS PROVEN vs CLAIMED

**Proven — real output pasted, and reproduced here where it mattered:**

- The intent parser's eleven exercises (responses quoted, revisions tracked
  including the *non-*bump on refusal).
- The box→`run-goal`-only routing, from a netlog **and** re-derived here from the
  single fetch in `client.ts` and a zero-hit grep of source and bundle.
- The 502 (reproduced here) and goal-host's 200 from the same position.
- The container exit and its two-line log; the gen-env/Makefile contradiction
  (read at source here).
- Contrast: 12 badge pairs and 4 ink-3 failures, recomputed here from the token
  file.
- The conformance checker's 6 findings and 30/30 self-test.
- Cleanup state (checked here, not taken on report).

**Unproven — asserted without observation:**

1. **Every design fix, at the moment it was claimed.** The build agent said so
   itself, and the disclosure is to its credit: *"I did not re-screenshot …
   none by observation of the running page."* Verified by source, build and a
   grep of `dist/` — not by looking. The re-audit later closed most of this by
   probing the rebuilt surface, so the finding is now narrow: **the flicker fix,
   the mask, the measure and the rail are observed; the claim as originally
   made was not.**

2. **The UI-only script's correctness, at the moment it was claimed.**
   "Correct and runnable", evidenced by a `DRY_RUN` plan. `DRY_RUN=1` exercises
   the argument parsing and the plan printer and **nothing that boots a
   container** — which is exactly where it failed. Exited 0 is not works.

3. **`--sf-text-2xl` "now usable".** Authored in the stylesheet and verified
   present in minified output; **no element is observed consuming it**. Present
   in the cascade is not the same as used by a pixel. (`--sf-text-xl` is a
   different case: `.sf-detail-goal` was probed at 22px with overrides
   neutralised, so it renders now that the override is withdrawn — though no
   post-reset screenshot exists to show it.)

4. **The re-audit's comparison baseline.** It reported *"there is no
   ranked-defect document on disk"* and reconstructed the comparison from
   pre-fix screenshots plus the narrations written into the diff's own comments.
   That reconstruction is not the document. The ranked audit does exist — this
   synthesis holds it, and the tables above are the comparison against the real
   list. Worth noting that the diff's self-narration was *accurate* enough for
   the reconstruction to land, which is a small point in the build's favour.

5. **"Genuinely UI-only."** Unassessable. `systemctl list-units` against a dead
   container returned `container … is not running`. Zero units observed, so the
   central claim of the deliverable — that this container runs the surface and
   little else — has no evidence either way.

---

## 5. WHAT FAILED — with the error text

```
[gen-env] ERROR: No LLM provider key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY
          (a root/standalone needs one; a spoke inherits LLM from its hub).
```
→ container `Exited (1)`, ~300ms, no unit started.

```
$ curl -X POST .../api/resolve -d '{"pointer":{"type":"activeDispatches"}}'
{"error":"upstream unreachable","detail":"Unable to connect. Is the computer able to access the url?"}
HTTP 502
```
→ dispatch dead, RUNS board permanently showing its outage banner. Goal-host
answers **200** from the same network position.

```
Pause button bounding box: x=1031.5 → x=880.0  (−151.5px on pointerenter)
aria-pressed stayed "false" across 12 samples / 2.4s
```
→ the pause control is unclickable by pointer.

**Readiness reported green over a corpse.** `make up` printed all 45 units
`skipped` and then `[ready] fleet ready` — **twice** — against a container that
had been dead for seconds. `substrate-ready.sh` runs its checks through
`docker exec` and swallows the failure with `2>/dev/null || true`; empty state
falls through to `skipped`, and only `down` increments the failure counter, so a
dead container yields zero failures. `make up` gates on this. The doctor then
failed correctly — it caught what readiness declared fine. This is the
declared≠running failure class, in the instrument.

**Secrets leaked to the log on the path that matters.** `ui-only-up.sh` applies
its redaction filter only to the `DRY_RUN` echo. The real run at line 378 echoes
the container-creation recipe **unfiltered**, so the git credential and the API
key are printed in plaintext to any log, tee, or CI capture of a real run. The
DRY_RUN half was built carefully and the real half was not covered — the classic
shape of a gate with the wrong call site.

**`IMAGE`/`TAG` are hardcoded with no env override**, so verifying the script at
all *requires* mutating the shared `:dev` tag. It was backed up and restored,
but the script forces the risk.

---

## 6. BLOCKED — and the distinction that matters

**The hub is reachable. It is not changeable.** These are different problems and
conflating them would misroute the next step.

- **Talking to the hub: not blocked.** Registry reads returned 200 throughout
  this pass, before and after, and the vessel-list diff was taken over live
  responses. HTTP to the hub works from here.
- **Changing the hub: blocked on an SSH identity.** Shipping an image, editing
  its baked vessel manifest, or installing a unit hub-side all need shell
  access. That is structurally out of reach and correctly not attempted.

The good news is that the UI-only spoke **does not need** the blocked half. A
spoke joins over HTTP plus the relay and modifies nothing hub-side; the
federation doc was corrected in this pass to say so, replacing a claim that SSH
was a precondition. So the container failure is **not** blocked on the hub — it
is a one-line guard in a script in this repo.

**Also structurally out of reach for these agents, by rule:** restarting or
recreating `substrate-live` (respected — it was healthy throughout), and any git
operation (respected — nothing was committed; the tree carries the modified
vessel sources and the openspec doc, uncommitted).

**Environment disclosures.** `hsv` — which is *not* `substrate-live` — was
restarted several times across agents to load code, since it runs off the repo
mount with no watcher. Its store is in memory, so each restart wiped the intent
log and reset the render policy; one agent captured a peer's policy revision
before restarting and restored it verbatim afterwards, which is the right
instinct. Screenshots were written to a root-level `.verify-shots/` directory
that the pre-commit hook would reject; it is untracked and safe to delete.

---

## 7. NEXT — ranked, one file or command each

1. **Wire the box to the parser.** `ui/src/api/client.ts` — POST to
   `/api/surface-intent` first; on 422 fall through to `/api/run-goal` and
   surface the parser's `unparsed[]` + grammar to the reader. Everything else in
   the intent work is already built and already proven; this is the one edit
   that turns it from a curl feature into a human one.
2. **Make the parser reachable by the walk.**
   `repos/human-surface-vessel/src/surface-intent.ts` — mint its resolution as an
   **activity**, not a bare route, so Thompson can select it and traces can grade
   it, and dispatch the `suggested_goal` on refusal instead of handing it to the
   human. This is the law-2/13 gap; file it as a gap rather than hand-building it.
3. **Fix the 502 at its documented cause.** `repos/human-surface-vessel/src/routes/proxy.ts`
   — prefer `public_endpoint` over `endpoint`, or remap loopback to the discovery
   host with the port offset as obsidian-vessel's sidecar already does. Retire
   the `GOAL_HOST_ENDPOINT` env gate once it lands. Without this, dispatch and
   the RUNS board stay dead regardless of item 1.
4. **Let the container boot.** `scripts/substrate/gen-env.sh:20` — consult
   `HUB_DISCOVERY_URL` alongside `DISCOVERY_ENDPOINT` when inferring spoke-ness.
   One condition.
5. **Close the real-run secret leak.** `scripts/substrate/ui-only-up.sh:378` —
   apply the existing `redact()` to the real path, not only the DRY_RUN echo.
   Do this before anyone runs it again.
6. **Stop readiness reporting green over a dead container.**
   `scripts/substrate/substrate-ready.sh` — a container-running precondition
   before the poll loop, and stop mapping an empty unit state to `skipped`.
7. **Stop the pause button moving under the pointer.**
   `ui/src/components/LiveControls.tsx` — reserve the "held" note's space (fixed
   width or `visibility`), so hovering the region cannot displace the control.
8. **Fix the failing contrast.** `packages/design-tokens/tokens.css` — raise
   `--sf-ink-3` to clear 4.5:1 on paper in both themes, then move the four
   re-authored `--sf-text-*` steps and the new measure tokens out of
   `ui/src/styles.css` into the same file, retiring that tracked debt.
9. **Put a legibility floor on the impulse.** `ui/src/lib/useTokenOverrides.ts` —
   clamp `--sf-text-*` at 12px and report the clamp, the way the parser already
   reports its own. The impulse should still win; it should not win below the
   floor the substrate's own scanner enforces.
10. **Give GAPS what every other live region has.**
    `ui/src/components/GapStrip.tsx` — render `<LiveControls>`, and buffer
    arrivals behind an explicit "N new" affordance instead of splicing.

---

### One-line verdict

The parser is good and unreachable; the design fixes are largely real and were
claimed before they were seen; the container has never run. Three deliverables,
zero of them closed end-to-end — and in all three cases the remaining distance
is short and named.

---

## 8. RESOLUTION — the named distance, closed

The report above ends "the remaining distance is short and named". It was. Each
item below was fixed and then re-verified against the running surface, not
asserted.

**The loop closes through the box.** `ui/src/api/client.ts` now tries
`/api/surface-intent` first and falls through to `/api/run-goal` on a 422. That
ordering is the floor-first arrangement the substrate asks for everywhere else —
a deterministic closed rule set decides cheaply, and only what it refuses becomes
a goal. Filmed, typing into the real textarea and pressing the real Send button:

```
"make the text bigger"                  revision 0 -> 1   reshaped, no dispatch
"show shellResult as rows"              revision 1 -> 2   reshaped, no dispatch
"make it feel more like a newspaper"    revision 2 -> 2   refused -> dispatched a walk
"How many .ts files are under packages?" revision 2 -> 2  dispatched a walk
"reset to defaults"                     revision 2 -> 3   reshaped, no dispatch
```

The refused instruction appears on the board as a `running` row attributed to
`human-surface`. Refusal forwards; it does not swallow.

`reshaped` is a distinct outcome in the union, deliberately not a flavour of
`accepted`: nothing was dispatched, there is no dispatchId, and no row will
appear. The surface says exactly that, then names the field, its old value, its
new value, and the clause responsible.

**The 502 is fixed at its documented cause, with the env gate retired as the
only remedy.** `public_endpoint` turned out to be loopback too — it differs from
`endpoint` only in the port (8210 vs 18210), so preferring it changed nothing.
The working fix is the one the code comment already named: rewrite a loopback
host to the DISCOVERY host, keeping the offset port. Whatever host we reach
discovery on is a host that publishes this fleet's mapped ports, so the result is
reachable by construction, and if discovery is itself loopback we are in-container
and the address was right already. Verified with `GOAL_HOST_ENDPOINT` deliberately
UNSET: `activeDispatches` 502 -> **200, 50 dispatches**. The board populates.

**The pause control no longer moves.** The live-region note now reserves its
width with a hidden sizer carrying the longest string, both children stacked in
one grid cell. The message can change without displacing a sibling.

**The container guard.** `gen-env.sh` now consults `HUB_DISCOVERY_URL` alongside
`DISCOVERY_ENDPOINT` when inferring spoke-ness. Two correct decisions had
contradicted each other: the Makefile deliberately blanks the container's
discovery endpoint so local vessels keep their own registry, and the guard read
only that, classified a spoke as a root, and demanded the one thing a spoke is
explicitly not required to carry.

**The secret leak.** `ui-only-up.sh` pipes the real run through the same
`redact()` the DRY_RUN echo already used, with `PIPESTATUS` preserving make's
exit code. The gate had been built on the path being rehearsed and omitted from
the path that runs.

**One defect the film itself exposed.** The run contract was built optimistically
on submit and never withdrawn, so a reshaped instruction rendered "nothing was
dispatched" directly above "WHAT WAS SENT: show shellResult as rows" — two claims
disagreeing in one frame, which is the precise failure this surface exists to
prevent. The contract is now withdrawn on every outcome except `accepted`. It was
caught by looking at a frame, not by any check.

### Still open from §2 and §3

Unchanged and still true: `--sf-ink-3` fails AA on four pairs; the ledger's count
disagrees with its own list; GapStrip has neither a buffer nor a pause control;
`useTokenOverrides` has no legibility floor; readiness still reports green over a
dead container. The UI-only container has not been re-attempted since the guard
fix — the guard is one condition and the boot is unproven until someone runs it.
