# The human surface: what a person can do, and where the conversation stops

An audit of the interaction flow between a person at the human surface and the
walk working on their behalf. Everything here was observed against a running
surface driving a live substrate; every claim below names the measurement that
produced it.

## How this was observed

The surface under test is `human-surface-vessel` served from a **UI-only
federated spoke**, pointed at a substrate that holds the compute. Two were used:

- one pointed at a remote hub, which lost its `goal-host` mid-session and could
  no longer dispatch at all;
- one launched against the local substrate for the rest of the work, so the
  board, the walk state and the gap store were all readable.

Goals were **sampled at random** from a pool of ten written to the same recipe:
each interleaves a decision with data processing — read something, judge it,
then act on the judgement ("classify each execution as reached or hollow, decide
which template family is worst, and persist a note naming it"). Sampling rather
than choosing is deliberate: the question is how the interaction behaves under
variety, not what the reach rate looks like when the goals are picked to flatter.

Each dispatch was then polled through the surface's own read path, recording
what a person at the page could have seen at that moment: status, step count,
walk-log length, current step, and whether a question for the human was visible.

## The finding: the system has three ways to ask a person something, and all three end somewhere nobody is looking

This is one defect wearing three hats. A surface whose premise is that a human is
a **resolver** — the system owns decomposition and asks when it needs something —
currently cannot be asked anything.

### 1. The walk almost never asks

`solicitHumanInput` in `goal-host-vessel/src/index.ts` is the human-in-the-loop
path. It sits inside `if (attempt < maxAttempts)`, which is nested inside
`while (attempt < maxAttempts)` with `attempt++` at the top of the body. On the
last attempt the inner guard is already false, so **when the attempt budget runs
out — the ordinary way a hard goal fails — the walk goes straight to honest
failure without ever asking.** The only way to reach the solicitation is for the
recommender to run dry *before* the budget does.

Measured: a battery run that included a four-attempt honest failure
(`execution_path=fresh_derivation attempt_count=4`) produced **zero**
solicitation attempts in `goal-host-vessel`'s journal over the same window.

The substrate had already noticed from the other end: its own orphan scan filed
`orphaned-capability-human_input`, `orphaned-capability-solicitationResponse_write`
and `orphaned-capability-solicitationHeartbeat_write` — of 353 live resolvers,
324 have been invoked, and these three are not among them.

### 2. If it did ask, the surface could not see the question in time

Two independent reasons.

- **Nothing is logged while the question is open.** `solicitHumanInput` posts
  the question and then blocks on the deadline. It taps no walk-log line at the
  post; the only taps come *after* the outcome ("human answered solicitation —
  retrying…", "human solicitation outcome=… — proceeding to honest failure").
- **The surface detects questions by regex over log prose.** `detectSolicitation`
  in `ui/src/lib/walk.ts` scans `walkLog` for
  `/(solicit|awaiting (a )?(human|your) (answer|input)|human_input|asked you)/i`
  and only while `status === "running"`.

Put together: during the entire window in which a person could answer, there is
nothing for the detector to match; by the time a matching line exists, the
question has already resolved or expired. **The question is announced only after
it has stopped being answerable.**

Separately, the surface does not advertise `human_input` at all — discovery
names `development-vessel` and `metabob-mcp` as the producers — so the person at
the page is not, today, one of the humans the walk can reach.

### 3. When the walk asks through the shape the surface *does* serve, the question is stored and never rendered

`human-surface-vessel` accepts `uiPanel_write` and `uiQuestion_write`, keeps them
in a `panels` map, and reports a `panels` count on `/health`. There is **no route
to read them** — no `/api/panels` in `src/routes/proxy.ts` — and the word `panel`
does not appear anywhere in `ui/src`. The page has four regions (ask, runs,
detail, known-wrong) and none of them is for a question.

This is not hypothetical: two dispatches this session logged
`walk: write "uiQuestion_write" claimed success but effect NOT independently
readable — treating as non-persistence`. The walk tried to ask, the write
succeeded, and the artifact landed in a store with no reader.

## What else the battery surfaced

**A busy drafter is reported to the walk as a timeout, and the walk then does ten
minutes of work it cannot possibly finish.** Both edit-intent goals routed
correctly — including a symptom-shaped one that named no file and still inferred
`repos/goal-host-vessel/src/index.ts` — and both got
`EARLY EDIT-INTENT routing failed (The operation timed out.) — falling through to
walk`. The walk that follows is structurally incapable of landing an edit: every
branch terminates at `satisfier REFUSED filesystem-write shapes` or
`HOLLOW — deterministic:edit-intent-no-landed-edit`. The later retry path gets
this right and says so plainly — *"refused for CAPACITY (BUSY) after one retry —
no draft was produced, so there is nothing to judge and nothing to escalate;
retry when a compose slot frees"* — which is the honest sentence the early path
should also be able to produce.

**Whether a change request reaches the drafter depends on which synonym was
used.** The edit-intent admission requires the goal to name a file *and* match a
verb whitelist —
`/\b(edit|add|insert|append|prepend|change|modify|replace|fix|remove|delete|update|rename|refactor|wire|guard)\b/i`.
Probed offline against seven phrasings that name the same file and ask for the
same change, **five are rejected**: "give X a route", "make X serve", "teach X to
answer", "expose Y from X". Confirmed live — a dispatch phrased *"Give
repos/human-surface-vessel/src/routes/proxy.ts a browser-read route…"* never
logged an edit-intent detection at all. It walked, drafted the route body into a
`shellResult`, and landed nothing; the reach gate caught it honestly ("no
evidence that the requested route was added"). This is law 13 in one line: the
goal only works once a person rewrites it into the admitted verb, and that
rewriting is the gap.

**Concept recall costs more than the walk will wait.** A concept search measured
**7.3s** inside the container; the walk's recall budget is **4s**. Every walk
observed logged `walk-concepts: concept-db could not be asked … recall
unavailable, NOT an empty result`, and the drafter logs the same failure as
`compose-lessons: concept-db recall failed: The operation timed out` before
falling back to a jsonl file. concept-db is healthy — the cost is inside search,
which reports `BM25 scores all zero (SurrealDB 3.0 IDF not persisted) — applying
term-frequency proxy ranking` and then relaxes the term set and re-scans. Recall
is not flaky here; it is structurally unreachable, and the code comment at the
call site already says "zero successes" over 24 hours.

**What the surface renders well, in contrast.** The verdict language is honest
(`reached` versus `completed`, "accepted means the walk was received"), the
evidence ledger shows what was produced rather than shape names and character
counts, arrivals queue behind a count instead of moving the page, and the board
carries the fleet's own runs alongside the person's. The gap strip renders
findings filed from anywhere. None of that is where the interaction breaks.

## Gaps filed

| id | what it says |
|---|---|
| `walk-never-asks-the-human-on-attempt-exhaustion` | the unreachable solicitation branch, plus the missing tap while pending |
| `the-surface-stores-questions-nobody-can-read` | `uiQuestion_write` stored with no read route and no renderer |
| `a-busy-drafter-is-reported-to-the-walk-as-a-timeout` | busy-as-timeout, and the futile walk that follows |
| `concept-recall-costs-more-than-the-walk-will-wait` | 7.3s search against a 4s budget; zero successes |
| `edit-intent-admission-is-a-verb-whitelist` | 5 of 7 natural phrasings of the same change request are not admitted |
| `ui-feedback-write-path-not-discovery-routed` | complaints written to a hardcoded local address on a spoke; swallowed |

## What the coax attempts did, and why nothing landed

Six change goals were dispatched through the surface to close the first item on
the list above, including one re-run against a repaired baseline with both
compose slots free at dispatch time. **None landed a commit**, and they failed in
three different ways — which is the finding:

- **Five were admitted and refused for capacity.** They routed correctly to
  `feature_compose` — including the symptom-shaped one that named no file and
  still resolved `repos/goal-host-vessel/src/index.ts` — and each ended at
  *"refused for CAPACITY (BUSY) after one retry … retry when a compose slot
  frees"*. The concurrency cap is 2 with the top slot reserved for directed
  work, and an autonomous compose held the other continuously, so there is
  exactly **one** directed slot. Two asks in flight means one is refused, and
  the refusal is terminal: the person is told to try again by hand. Twice the
  busy answer arrived as `The operation timed out` instead of `verdict=BUSY`,
  and the fall-through then spent ten visible minutes in a walk whose every
  branch ends at "edits must route through feature_compose".
- **One was never admitted at all** — the verb-whitelist finding above.

And underneath both, a third failure surfaced once a compose finally ran on this
vessel — the best result of the session and the worst, in one artifact.

`feature_compose` filed `baseline-typecheck-broken-repos-human-surface-vessel`:
the untouched baseline fails `tsc` with `TS2304: Cannot find name 'listPanels'`.
The diff in the compose clone says why. Written at 06:33–06:34, uncommitted:

```
 src/config.ts               + "uiPanel_read"  (added to DISCOVERY_SHAPES)
 src/routes/impulses.ts      + impulsesRouter.get("/v2/panels", …) { listPanels() }
                             + case "uiPanel_read": { listPanels() }
```

That is **the substrate drafting the exact feature this audit asked for** — a
read path for the stored questions — in response to the gap filed an hour
earlier. It is also broken: `impulses.ts` imports `upsertPanel` and not
`listPanels`, so the file does not compile. The draft was never landed and never
cleaned up, and `feature-compose` composes against a dirty clone by design
(*"has uncommitted changes in the super-repo clone; composing against them rather
than discarding them"*), so **every later compose on this vessel inherits a
baseline that cannot typecheck and refuses to draft** — including three
operator-dispatched edit goals.

Generation worked. Landing did not, and the failed landing poisoned the well for
everything after it. The substrate's own gap blamed a stale runtime copy; the
cause is its own leftover draft, and that gap has been corrected in place with
the diff as evidence.

Two things follow: the abandoned draft has to be cleared, stashed, or finished
(a one-line import would make it typecheck) before any change can land on this
vessel; and compose must not be able to *leave* a non-typechecking draft in the
clone when it aborts.

**What was done about it, and what then happened.** On the operator's
instruction the draft was *finished* rather than discarded: `listPanels` was
added to the import block of `src/routes/impulses.ts` in the compose clone, with
no compose slot held at the time, after which `tsc --noEmit` on the vessel was
clean.

**The repair was moot within minutes.** On the next look the panels-read draft
was gone from the clone entirely — no `/v2/panels` handler, no `uiPanel_read`
case, no `config.ts` registration — leaving only the one-line import, now
orphaned. What removed it is not established: `feature-compose` materialized the
vessel in-tree at 07:03:57 (having logged "has uncommitted changes … composing
against them" thirty seconds earlier), and `substrate-pull-sync` ran at 07:04:59
and reported `synced=0 skipped=1`, i.e. it skipped rather than reset. Either
could have done it; the evidence does not say which, and neither is worth
guessing about.

So the honest scope of this finding is narrower than it first looked: the
abandoned draft **blocked every compose on this vessel for as long as it was
present** — three operator-dispatched edit goals were refused and the substrate
filed its own baseline gap — but the debris is transient rather than permanent,
and it took the drafted feature with it when it went. The durable part is the
mechanism: compose composes against a dirty shared clone by design, so a draft
it strands mid-flight becomes every later compose's broken baseline, and a draft
it later clears is simply lost work.

No `/api/panels` or `/v2/panels` route has landed on `origin/dev`.

The last of the six is the cleanest measurement of the lot: dispatched with a
clean baseline and both slots free, phrased with an admitted verb, alone. It was
detected on the right file, its compose call still returned
`The operation timed out`, it walked futilely for eleven minutes, and it ended
`refused for CAPACITY (BUSY) after one retry`. A compose takes minutes and the
autonomous lane refills a freed slot within seconds — measured here at 06:57:41,
the same second the slot cleared — so "retry when a compose slot frees" is
advice a person cannot act on by hand.

**A person cannot get a change made through this surface today.** Not because
the routing is wrong — it is right, including from a symptom with no file path —
but because the only outcomes available to them are a refusal that tells them to
retry into a lane that is already refilled, or a phrasing that was never
admitted. That is the interaction flow to fix, and it wants a queue with a
position and a notification rather than a better error message.

The gaps are filed. The queue is where the work should resume.

## The order these want to be fixed in

1. **Read route for stored questions** (`human-surface-vessel/src/routes/proxy.ts`)
   — smallest, and it makes an existing dead write observable.
2. **A question region on the page** that renders one and posts an answer back.
3. **Tap the solicitation when it is posted** (`goal-host-vessel/src/index.ts`)
   so a pending question is visible while it is still answerable.
4. **Ask on attempt exhaustion**, not only when the recommender runs dry.
5. **Busy is not a timeout** — hold the request and say it is queued.

Each is a single-file change and each is dispatchable as a goal.
