# Validation 3 — what a human can actually read

Scope of this pass: the surface's **output**, not its plumbing. Earlier validations
proved the vessel registers, resolves, proxies, and survives a hostile registry.
None of them asked the only question a person asks, which is whether the thing on
the screen can be read.

It could not. This document records what was measured, what changed, and what is
still open.

---

## 1. The method

Findings here come from a corpus, not from reading the renderer and reasoning about
it. 212 impulse content previews were pulled from live `goalWalkState` records
across 18 distinct shapes, then each was run through the shipped `detectForm` and
judged on whether the resulting render answers "what did this run produce?".

Two properties of that corpus matter more than its size:

- It is **live**, so it carries the shapes the fleet actually emits rather than the
  ones the renderer was written against.
- It is **kept** (`.video/corpus.json`, untracked), so every later claim about the
  renderer is a replay against fixed inputs rather than a fresh opinion.

The corpus is read through goal-host's `POST /resolve` with a **flat** body
(`{"type":"goalWalkState","dispatchId":"…"}`). `GET /executions/:id` is a thinner
record carrying neither `poolProvenance` nor `answerBody`; reading it and concluding
"this run produced nothing" is a mistake available at every moment of this work.

## 2. What was wrong

**156 of 212 previews — 74% — reached the reader as raw machine text.**

The renderer knew five forms. Two of them, `rows` and `diff`, matched **zero**
corpus entries: `looksLikeRows` accepts JSON *arrays* only, and every diff in the
corpus arrives inside a command envelope and was classified as prose. So three
forms were live, one of which was the fallback, and the fallback was carrying the
work of four renderers that did not exist.

The failures, in the order a person meets them:

| # | what a reader saw | why |
|---|---|---|
| 0 | `/run/<id>` loads with the named run **1021px below the fold**, page at `scrollY 0` | the deep link never scrolls to its subject |
| 1 | the systemd table's columns **destroyed** in the answer card | `answerBody` went through markdown unconditionally; the embedded blob's `\n` escapes collapsed to spaces |
| 2 | `{"goal":"list the running systemd units in the substrate container"}` | a single-key wrapper around a sentence, with no renderer |
| 3 | a bare UUID in a `<pre>`, weighted like output | `dispatch_id` fell to the same default as the answer |
| 4 | `{"shape":"shellResult","stdout":"…\n…","exit_code":0}` | the payload was inside its own envelope; `<pre>` preserved `\n` as two literal characters |
| 5 | the number `1`, as four keys and two escapes | same envelope, minimal payload |

Failure 1 is the worst of these and was invisible to inspection: the source looked
right, the DOM looked right, and only reading the *rendered text* showed the columns
were gone. It is filmed in `.video/surface-failures.mp4` against real reached walks.

## 3. What changed

Four forms were added, and the rest of the work is about **not** adding more.

- **`terminal`** — command output with real newlines and preserved column
  alignment. Deliberately *not* reachable from raw impulse text: only as the
  unwrapped payload of a command envelope. A standalone "looks like a terminal"
  heuristic was rejected because it would fire on prose.
- **`record`** — a JSON object as labelled fields, values rendered by their own form.
- **`scalar`** — a lone value inline, not in a code block.
- **`stub`** — a provenance-only impulse (`{producedBy, executionId}` and nothing
  else) as a one-line attribution rather than as content it does not have.

The load-bearing decision is that **envelope unwrapping is a pre-pass, not a form**.
A form is a way of drawing content; unwrapping decides *which content is drawn*.
Making it a form would let a human pin `shellResult` to "envelope" and get a
permanent double-render, and it would collide with the payload's own form.

The conservatism law is unchanged and now has more surface to defend: every new form
triggers only on a **full parse of a non-truncated preview**. A truncated fragment
falls to verbatim. Pretty-printing a misidentification remains worse than showing raw
text, and `text` is still the default and still the honest common case.

### What was rejected, and why it matters

Rejections are recorded because a form nobody's data needs is a wrong mint, and a
wrong mint is negative value rather than zero.

- **A bare-UUID `identifier` form** — the largest single bucket in the corpus (47
  entries) and still rejected: UUIDs already *read* fine. They are uninformative,
  not illegible, and that is a different complaint.
- **Truncated-prefix recovery** — would have recovered 13 samples by decoding JSON
  up to the cut point. Rejected: it is exactly the guess the conservatism law
  forbids, on exactly the inputs where a guess is least checkable.
- **A standalone `error` form**, **a `{success, shape, body}` unwrap key**, and **an
  `envelope→array-of-records` form** — each below the three-distinct-sample threshold.

## 4. Feedback: the box changes the surface's form

A typed instruction is read by a deterministic parser (eight rules, no LLM) before
it is ever treated as a goal. What the parser understands reshapes the surface; what
it refuses is forwarded to the walk. Refusal forwards — it does not swallow.

The new forms are nameable, so "show shellResult as a record" and "show dispatch_id
as a value" now do something. Two vocabulary decisions were made against ambiguity
rather than through it: `records` (plural) stays **unmapped** because it reads as
both a table of records and a single key/value record, and `empty` and `stub` are
**non-pinnable** — they describe what content *is*, not how it is drawn, and pinning
one would hide a shape whose next impulse carries real content.

This is steering, not learning. Each instruction lands as a shaped `renderPolicy`
impulse with a revision, which is what makes the choice observable and gradeable
rather than frozen into the bundle at build time. **Nothing yet reads those revisions
back as evidence.** The mechanism that would close that loop does not exist, and
saying it does would be the same class of claim this surface exists to prevent.

### A refusal that told the reader nothing

`/api/surface-intent` has always returned `{text, reason, suggested_goal}` for each
clause it could not read, and the server comment says why: so the surface can *offer*
a dispatch. The client flattened that record with `.map(String)`, so a person who
typed a partly-understood instruction was told, literally, that `[object Object]`
was not understood.

The reason and the suggested goal were computed and then dropped one line before
reaching the person who needed them. Both are now shown, and the suggestion inserts
into the box rather than sending — a parser refusing a clause is not permission to
guess what someone meant and dispatch it for them. Taking a suggestion **replaces**
the box's contents rather than appending, because the box still holds the instruction
whose clause was refused.

## 5. The surface is the one vessel the substrate cannot author

Dispatching a change to `repos/human-surface-vessel/src/routes/proxy.ts` routes
correctly to the edit-intent path and is then **refused**, twice, with:

> plan touches vessel repos/human-surface-vessel which does not exist in the
> runtime or push-clone roots

The reason is structural rather than incidental. The edit path looks for a
vessel in the runtime root (`/vessels/<name>`) or the push-clone root
(`/workspace/git/vessels/<name>`). That clone root holds eighteen vessels and
**every one of them is a git submodule with its own clone**. `human-surface-vessel`
is a plain committed directory in the super-repo — `040000 tree`, absent from
`.gitmodules` — so no clone of it exists there and none ever will.

Installing it at the runtime root does not help: `vessel-ctl` installs a manifest
vessel by pointing its unit at the super-repo clone, so `/vessels/<name>` stays
absent and the byte-anchored escalation fails the same way
(`live source missing: /vessels/human-surface-vessel/src/routes/proxy.ts`).

So the vessel whose entire purpose is to be reshaped by what a human notices is
the one vessel the system cannot change on its own. Every other vessel can be
self-developed; this one can only be edited by an operator. That inverts the
trajectory the operator role is measured against, and it is invisible until a
goal is dispatched, because nothing declares the submodule requirement.

Two candidate closures, both structural: promote the vessel to a submodule so it
gains a clone like every other, or teach the edit path to resolve a vessel inside
the super-repo working tree when no dedicated clone exists. The second is the
better fix — the first makes every future in-tree vessel repeat this discovery —
but either is a change to the development path, not to this surface.

Related, and found the same way: `substrate-live` runs an image whose baked
`vessels.manifest.json` predates this vessel, so `vessel-ctl` reported
`not in manifest`. The manifest has a volume copy that takes precedence, and
seeding it from the push clone is the designed override; nothing about that is
specific to this vessel and any manifest vessel added since an image was built
hits it.

## 6. Still open

- **The deep link still does not scroll to its run** (failure 0). Filmed, not fixed —
  it is a routing concern rather than a rendering one.
- **`/api/gaps` resolves a hardcoded loopback env** rather than resolving
  `substrateGap` by shape through discovery. It is the same class as the goal-host
  loopback trap already fixed in `proxy.ts`, and it will fail the same way on any
  deployment where the gap store is not in-process.
- **`surfaceIntent` is a resolver, not an activity**, so Thompson cannot select it
  and no posterior accrues to it. This is a law-2 violation carried knowingly.
- **P5/P6/P10 false-positive** on well-factored code. Unchanged, and still the
  reason the conformance checker must not be wired into a blocking lint yet.
- Observed while reading the corpus and **out of scope here**: one oracle answer
  asserts "independently recomputed **0** by TWO agreeing derivations" while the
  `shellResult` it cites carries `stdout: "1"`. The prose contradicts its own
  evidence. That is a substrate correctness defect, not a rendering one — the
  rebuilt renderer makes it visible instead of hiding it inside a JSON blob.
