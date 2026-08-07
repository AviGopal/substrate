# Build report — human surface stack

What was built, what was proven by observed command output, and what was not. The distinction
this report holds to throughout: **a command exiting 0 is not the same as the thing working.**
Every claim under "proven" has real output behind it.

---

## 1. Proven

### The vessel registers, and is findable by shape

Booted against the running substrate, then resolved through discovery:

```
uiPanel_write producers:
  stateful-ui-vessel          http://127.0.0.1:8270  resolve: /resolve
  development-vessel-local    http://localhost:8090  resolve: /v2/impulses/resolve
  human-surface-vessel-local  http://127.0.0.1:8310  resolve: http://127.0.0.1:8310/v2/impulses/resolve
```

Findability by shape is the invariant that matters, because it is exactly what the substrate's
own canonical scaffold gets wrong — a nested `resolverContract` plus a missing `systemVessel`
produces a vessel that passes its health check and is invisible to org-scoped queries. All
seven inherited shapes appear in `GET /registry/shapes` (333 shapes fleet-wide).

The registered `resolve_endpoint` is a full URL where other vessels register a bare path. This
was checked rather than assumed: discovery's forwarder handles both —
`/^https?:\/\//.test(resolveEndpoint) ? resolveEndpoint : \`${endpoint}${resolveEndpoint}\`` —
so both forms are correct.

### Shape/dispatch agreement is compiler-enforced, not documentary

Seven advertised shapes, seven `case` labels, exact match. The default branch is an
`assertExhaustive`, so drift fails to compile in both directions — an advertised shape with no
case, and a case for an unadvertised shape. The 400 response body reports `DISCOVERY_SHAPES`
verbatim, so the error message cannot drift from the advertisement either.

### The resolver round-trips

`uiPanel_write` written and echoed back with a server-assigned id; unknown shape returns 400
with the full `supported_shapes` list.

### The proxy dispatches a real goal to the live substrate

```
POST /api/run-goal  ->  202 {"dispatchId":"...","status":"running"}
```

Polled through the proxy to terminal: `status: completed`, `reached: true`,
`answerBody: "13621"`, `completionShapes: ["shellResult"]`.

### Clean shutdown deregisters

Producers advertising the vessel's shapes: 1 before `SIGTERM`, 0 after. The registry is not
left to rot for the five-minute TTL.

### The conformance gate refuses — including on real code

Self-test: **30 passed, 0 failed** — thirteen rules each proven to refuse on a violating
fixture *and* to pass on a clean one, asserting the exact set of reported rule ids rather than
mere exit status, so a fixture tripping a different rule cannot count as proof.

A green self-test is not enough, because a vacuous checker also passes its own fixtures. So the
gate was run against **real, unmodified application source**, where it reported clean; then one
violation per rule was planted into that same real file. It caught **P1, P4, P5, P9, P11, P13**,
and correctly did *not* trip on a bare hex-shaped trace id (`994b5e`, no `#`).

### Tokens

`@avigopal/design-tokens` typechecks clean. Six-state palette with `reached` and `not-reached`
at matched weight in both themes, an explicit `data-theme` override that beats the media query
in both directions, and no `@font-face` URL anywhere.

---

## 2. Defects found by running it

Each of these passed a typecheck. None would have been caught by static analysis alone.

**The vessel deadlocked against itself.** `export default app` alongside an explicit
`Bun.serve()`: Bun auto-serves a default-exported Hono app, so the process bound its port, then
tried to bind it again and died `EADDRINUSE` against its own listener. Fixed to a named export.

**Discovery advertises unreachable addresses.** goal-host registers `http://127.0.0.1:8210` —
correct for a peer inside the same container, dead for anyone else. Because the lookup
*succeeds*, an env fallback guarded on failure never fires: a silent 502 against a
healthy-looking registry. An explicit `GOAL_HOST_ENDPOINT` now outranks discovery as the escape
hatch. The durable fix is the remapping obsidian-vessel's federation sidecar already
implements (loopback → discovery host, port offset); this vessel does not yet do it.

**`vessel-ctl` swallows `post_install` entirely** — stdout, stderr, and exit status. A failed UI
build cannot make `install` report anything but `ok:true`. Worked around with a log sentinel
plus a hard assertion on `ui/dist` in `ui-only-up.sh`. The standing rule: assert the build
output, never accept the install's verdict.

**The checker's own region scanner was vacuous on one rule.** `statementRegion` took the first
`{` after a declaration, which for `({ value }: Props) => {…}` is the *parameter destructure* —
so P2 scanned `{ value }` and never saw the body it exists to check. Found by probing, not by
the fixtures, which is the point: the fixtures were written in the spelling the scanner already
handled.

---

## 3. A near-miss, recorded because the process matters more than the result

The dispatched goal answered **13621** files where the operator's checkout has **78**. This was
one step from being filed as "the oracle certified a wrong answer."

It is correct. 13621 is exactly the count in the substrate's own tree
(`/workspace/git/super-repo/scripts/substrate`). **The substrate answers about its tree, not the
operator's**, and an operator validating against their working copy will see a mismatch that is
not an error.

The surface has to carry this: where an answer describes a filesystem, the reader must be able
to tell whose filesystem.

---

## 4. A design correction the live run forced

The dispatch returned `executionPath: universal_tool_fallback` with
`poolProvenance: []` — an **empty evidence ledger on a run that produced a correct answer**. The
walk log explains it: `REUSE-BEFORE-DERIVE — the store recommends the floor for this goal (6/6
reached); running it directly and skipping the walk`. The ReAct floor never populates the pool,
and the floor is a large share of executions.

A ledger rendering only `poolProvenance` would therefore print *"no artifact — the reach verdict
is unsupported"* on a run that answered correctly. That is the mirror image of the receipt
problem: instead of a receipt where content belongs, an accusation where content exists.

The ledger must fall back, in order: `answerBody` (as a `prose` entry, badged `goal_answer`),
then `completionShapes` as badges with the honest note that this execution path did not retain
per-impulse provenance, and only then the empty state.

---

## 4b. The UI, and the full chain to the hub

The surface builds clean under strict TypeScript — 195 modules, `dist/` served by the vessel at
`GET /` with both assets returning 200.

**No external host in the bundle.** Every absolute URL in `dist/`, enumerated unfiltered: four
`w3.org` XML/SVG namespaces (DOM internals), react-dom's error-decoder *message string*
(concatenated into an `Error`, never fetched), and TanStack Router's `localhost` fallback for
when `window.origin` is unavailable. No CDN, no remote font, no `@font-face` URL, no external
module. All five `fetch()` calls are relative `/api/*`.

Worth recording about the check itself: the prescribed grep filtered out `w3.org`, and the JS
bundle is a single line — so any real hit sharing that line would have been hidden. The
filtered grep returning nothing was partly an artifact. The unfiltered enumeration above is the
evidence; the filtered one was not.

**The chain reaches the hub.** SSH to the hub is unavailable, but that was only ever needed to
*deploy* there — the fleet's HTTP surface is live and reachable. This substrate is a federated
spoke (`ENABLED_ROLES=spoke`) whose `api` role lives on the hub, so `activity-api` is inactive
locally by design.

A goal dispatched at the spoke produced a trace that **landed in the hub's activity-api**, and a
human verdict submitted through the surface's own proxy was accepted there:

```
POST /api/grade -> 200
{"success":true,"content":"{\"id\":\"goal_verification_labels:7pgf4l3kdkms7tqw92d1\"}",
 "metadata":{"summary":"goal verification label created: verdict=achieved, labeler=human"}}
```

`labeler: "human"` is set server-side rather than trusted from the browser, because goal-host
reads it to decide whether a label may override `reached`.

**A contract error found only by calling it:** the verdict enum is
`achieved | not_achieved | partial`. The MCP tool surface documents `reached | not_reached |
partial`, and a first attempt with that spelling was rejected 400. The UI's own type was already
correct; the wrong spelling was in the test payload.

**`POST /api/grade` had to be added.** The UI required it and the server did not serve it — a
human verdict is not a goal-host shape, so `/api/resolve` would have rejected it. It targets
activity-api directly rather than by shape lookup, because `goal_verification_label_write` is
defined and tested in activity-api but **not advertised in this spoke's registry**; a shape
lookup would fail closed and silently swallow every verdict.

## 5. Blocked

**Deploying a container to the hub.** The SSH agent has no identities loaded and the on-disk
deploy key is rejected. This is a missing credential, not something to engineer around.

Scope of the blocker, stated precisely so it is not overclaimed: it blocks *shipping an image to
the hub host*. It does **not** block talking to the hub — HTTP to its discovery and activity-api
works, and the chain above was proven across it. What remains unexercised is the **libp2p
federation transport** itself: everything verified here crossed to the hub over plain HTTP, not
over the p2p circuit relay. `federation.md` documents that path and its verification commands;
none of it has been executed.

---

## 6. Not covered — stated so a green gate is never mistaken for conformance

Nine of the thirteen rules are partial. Their static half is real; their *core intent* is
enforceable only by a runtime probe, which is **not built**:

P1 relative prominence · P2 indirected dispatch calls · P3 whether the buffer does anything
(`buffer={0}` passes) · P5 call-site volatility · P6 whether pause and interval are wired ·
P7 MECE-ness itself · P8 content versus a gloss of content · P10 whether `accepted` and
`stalled` render distinctly.

With no static tier at all: layout stability under an arrival stream, focus and selection
survival across updates, freeze-on-interaction without dropped events, verdict legibility
asserted against the token value, and the fallback path rendering verbatim for a malformed
shape name.

`--emit-concepts` generates the concept-db lesson payloads from the same rule table the checker
runs on — one source, two readers — and each payload carries its rule's "not covered" text, so
the drafter is told which rules are only half-checked rather than being led to treat a green
gate as proof.

---

## 6b. The gate fires on the surface — and three of four static-hard rules are wrong

Run against the finished UI, the checker exits 1 with seven findings. Judged individually
against the code:

**P4 ×3 — correct, and now recorded.** Three index keys, all on content parsed out of a blob:
table rows, diff lines, walk-log lines. None has a domain id; position genuinely is identity and
the content is re-parsed wholesale rather than reconciled. These carried a prose comment
explaining the reasoning, which no checker reads. They now carry
`// @interaction:exempt P4 — <reason>` instead, and the rule clears. **The live runs board keys
on `dispatchId`** — the thing P4 exists to protect was never at risk.

**P5, P6, P10 — false positives, all with the same cause.** Each rule is file-local or
inline-only, so extracting the thing it checks into one reviewed place trips it:

- **P5** flags `[...runs].sort(compareRuns)` because the scanner only inspects inline arrow
  bodies. The named comparator it cannot see sorts on `startedAtMs` and ends on a `dispatchId`
  tiebreaker — exactly what the rule demands.
- **P6** flags the query modules because `paused`/`intervalMs` live in a `liveControls` provider
  and arrive as props, rather than being declared in the same file as the poll.
- **P10** matches `DispatchStatus`, which is goal-host's *wire* status (`running | completed |
  failed`) and correctly contains neither state. The surface's own union is in `runState.ts` and
  has both.

**This is the more serious finding than any individual violation.** A gate that fires on the
better-factored code trains reflexive exemptions, and a corpus of reflexive exemptions is worse
than no gate — it looks like scrutiny and applies none. Before this checker is wired into any
`lint` script, P5 should resolve named comparators (or skip them), P6 should follow the control
props across the module boundary, and P10 should match the surface's declared run-state union
rather than any union with status-shaped members.

## 7. Next, ranked

1. **Fix the three false-positive rules before wiring the checker into any `lint`.**
   `packages/interaction-conformance/rules.ts` — P5 must resolve or skip named comparators, P6
   must follow control props across a module boundary, P10 must match the declared run-state
   union rather than any status-shaped one. A gate that punishes correct factoring will be
   switched off, and then none of the other twelve rules run either.
2. **Build the runtime probe.** It is the enforcing half of eight rules. Without it the gate is
   honest but thin.
3. **Remap loopback endpoints resolved from discovery**, in the proxy, the way the federation
   sidecar does. The env override is a workaround, not the fix.
4. **File the scaffold defect as a gap** — `complete-vessel-scaffold.ts` still emits a nested
   `resolverContract` and omits `systemVessel`, so every vessel it generates registers partially
   invisible. The class question is what activity would detect a scaffold producing
   non-registering vessels; a completeness report that resolved the scaffold's own output
   against the registry would have caught it.
5. **Retire `react-renderer` and `workbench`** — absent from inventory, manifest, and unit
   directory, so nothing needs unwiring.
6. **Cut over `stateful-ui-vessel`** only after the replacement serves `uiPanel_write`,
   `uiQuestion_write`, `uiFeedback`, and the `interactor*` family in production. Retiring the
   vessel must not retire the vocabulary.
