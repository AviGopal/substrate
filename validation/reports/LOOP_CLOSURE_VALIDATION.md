# Loop closure: a goal through the human surface whose credit persisted

## What was broken

The trace-list default window was `now - 30d` on a table holding 473k rows spanning
TWENTY-FIVE days. The predicate excluded zero rows, so every request materialised the
whole `v_paradigm_execution_traces` view into a sort before applying LIMIT (SurrealDB
2.3.3 `MemoryOrderedLimit`). All 8 DB workers pinned at ~96% with 0.0% iowait, query
latency 30s, and the substrate's own learning writes timed out and were lost.

**The failure mode is the point.** The guard did not break, throw, or log. It crossed a
threshold — somewhere between 111k and 473k rows — after which it was a no-op that still
read as protection, with its own comment asserting a bound it no longer provided.

## Measured recovery (process start postdates the fix; not inferred)

| | before | after |
|---|---|---|
| surrealdb self-reported latency | 30263 ms | 23 ms |
| surreal CPU | 780% | 125% |
| load | 12.64 | 1.93 |
| activity-api restarts | ~7/hr | 1 per 30 min |
| hub `/health` from operator box | timeout @35s | 200 in 0.167s |

## The validated chain

Dispatch `60b0c5c7` — "Report the total number of distinct impulse shapes currently
advertised in the discovery registry" — entered through the human surface at :18310 on a
federated spoke with `activity-api` masked locally, so credit could only land on the hub.

1. reached, `deterministic:verified-registry-count`, answer `318`
2. HAND-GRADED VALID. 318 is this spoke's own registry count (`/registry/shapes`
   confirms). The 385 in the pre-capture is the federated union (local + hub, deduped);
   the hub alone reports 382. All three numbers are real and answer different questions.
3. credit `dAlpha:2` on `satisfier:shellResult`
4. PERSISTED — `satisfier:shellResult` does not appear in any
   `posterior_delta_dropped_no_row` line over 6h. Negative control: the string occurs 204
   times in the same corpus, so its absence from drop lines is signal, not a failed grep.

## Two findings this validation produced

### 1. The deterministic fast path's verifier is self-confirming

The walk log states the field was "chosen by the same rule the verifier applies", while
the reach reason claims it "independently queried" the registry. Both cannot hold. The
producer and verifier share the field-choice rule and hit the same endpoint, so the check
confirms the answer is what the rule produces — never that the rule chose the right field.

This is the shape of the `shapes/vessels` false reach graded by hand on 2026-08-17, which
took alpha+2 for the wrong field. THIS GATE COULD NOT HAVE CAUGHT THAT. It passed here
because the field choice happened to be correct, which is luck, not verification.

### 2. Posterior deltas are being dropped on live arms

23 dropped in 6h across `ribosome-extract` (11), `auth_resolve_v1` (11), and one
composition. A zero-row UPDATE returns empty rather than throwing, so the delta was
neither applied nor re-queued. Those arms are executing and learning nothing. The loss was
invisible until the drop counter was added; it is now countable.

## Also found

`human-surface-vessel` is `manifest: true`, and `apply-inventory`'s `manageable_units()`
skips manifest entries entirely — so its `role: ui` membership in the spoke group is real
but INERT. No boot path installs it; it exists only after a separate `vessel-ctl install`.
The surface requires an undocumented manual step after every boot.

---

# The spoke could not reach the hub's LLMs: four defects in series

The hub has five funded providers and answers completions (`PONG`, mistral-small-latest,
Thompson-sampled across arms). The spoke has an invalid Anthropic key and an unfunded
OpenRouter key. Everything below is why the spoke could not simply use the hub, and each
defect alone was sufficient — which is why fixing any one of them changed nothing.

## 1. The federation transport was never installed

`libp2p-federation-transport.service: No such file or directory`. It is a MANIFEST vessel, and
`apply-inventory`'s `manageable_units()` skips manifest entries entirely — so no boot path
installs it. `docs/SUBSTRATE.md:218` states the transport "auto-starts at boot". It does not.
Its clone also had no dependencies (`Cannot find package 'libp2p'`), so the first install
crashlooped while `vessel-ctl install` reported `"active":"active"`.

★ SAME CLASS, TWICE, BOTH LOAD-BEARING. human-surface-vessel is also `manifest: true` and also
  absent from every boot. One gap: a spoke boot leaves load-bearing manifest vessels
  uninstalled while the docs assert otherwise.

## 2. The resolver advertised a shape it could not serve  (fixed: llm-resolver 3ea2136)

`decideLastResort()` is pure. When it concluded nothing could serve, that conclusion died in a
log line. `hasCompletionQuota()` is

    [...modelClientMap.keys()].some((m) => !inModelCooldown(m)) ||
    (anthropic !== null && !inCooldown("anthropic")) ||
    (openaiClient !== null && !inCooldown("openai"))

The OpenRouter models cooled on 402, so clause 1 went false. Clause 2 stayed true forever: the
anthropic client is non-null whenever the KEY IS SET, validity unchecked, and a 401 is neither a
quota error nor a reachability error, so it matches no cooling rule. The lane cools only on the
resolve path, which a refusal never reaches. AN INVALID CREDENTIAL IS MORE DISQUALIFYING THAN
EXHAUSTED QUOTA, AND IT WAS THE ONE FAILURE MODE THAT COULD NEVER CLOSE THE GATE.

## 3. The hub-egress fallback looped back to the spoke  (fixed: development-vessel f8a2ede)

Three siblings — feature-compose:2590, patch-with-tools:665, llm-completion-dispatch:182 — each
POSTed `?vessel=llm-resolver-vessel`, all commented "the egress picks a LIVE hub circuit".
Measured:

    ?vessel=llm-resolver-vessel  -> produced_by ...@spoke-739b76f1
    ?vessel=llm-resolver-google  -> produced_by ...@spoke-739b76f1
    ?vessel=llm-resolver-haiku   -> produced_by ...@spoke-739b76f1
    ?target=<multiaddr>&vessel=llm-resolver-google -> ...@syzygy-hub, "HUB"

By-name lands LOCAL every time, even for a name present on both. And the hardcoded literal names
no vessel on the hub at all (it advertises google/haiku/opus) — two independent defects on one
line. Regression checked by failing-test SET: 81 before, 80 after, zero newly failing.

## 4. concept-db cannot run on a spoke  (fixed: inventory 7886d3a5)

role=infra (a spoke group) while surrealdb is role=store (hub-only). It crashlooped forever, so
every spoke walk logged "concept-db could not be asked — recall unavailable" and ran with concept
recall silently absent. Provable from the inventory file alone.

## Where it ended

With all four addressed and `operator` set on the dispatch (trigger=operator engages the
reserved DIRECTED compose slot — without it an operator ask is classed autonomous and starved),
the chain runs end to end: edit-intent detected -> feature_compose -> draft produced (op_count=2)
-> adversarial semantic refuter -> rollback -> escalation. The system drafted a change and its
own diverse-lens refuter rejected it at confidence 1.00 rather than landing a partial fix.

RESOLVED — AND I HAD IT BACKWARDS. I wrote that the refuter's reason ("the mapped return value
for 'count of' is missing") did not hold against the file, because the field is derived from the
NOUN (`counted[0]`), not per trigger phrase. That reasoning was sound about the FILE and wrong
about the DRAFT, which is what the refuter was actually reviewing.

The git history settles it. An earlier escalation landed `1268a11`:

    + const named = [...g.matchAll(/\b(totalshapes|totalvessels|healthycount|count of)\b/g)]
    +   if (only === "totalvessels" || only === "count of") return "totalVessels";

It put `count of` in the CANONICAL FIELD-NAME regex — a list of things the registry publishes
(`totalShapes`, `totalVessels`, `healthyCount`). "count of" is not a field name. That is exactly
the incoherence the refuter named, at confidence 1.00, and it was RIGHT.

★ I JUDGED A CRITIQUE AGAINST THE WRONG ARTEFACT. The draft was rolled back and unreadable, so I
  reasoned about the file the draft would have edited instead — and concluded a correct gate had
  false-rejected. A rejection I cannot read the subject of is not evidence the rejection was
  wrong; it is absence of evidence. I should have said only that, and I nearly filed a
  false-rejection finding against a gate that had just done its job.

THE SUBSTRATE THEN CORRECTED ITSELF. `5d29f1f` removed the bad placement and made the real
change, and this one reached:

    - const counted = [...matchAll(/\b(?:how many|number of|total)\s+...
    + const counted = [...matchAll(/\b(?:how many|number of|total|count of)\s+...
    - const named = [...matchAll(/\b(totalshapes|totalvessels|healthycount|count of)\b/g)]
    -   if (only === "totalvessels" || only === "count of") return "totalVessels";

A natural-language goal entered through the human surface, edit-intent routed to
feature_compose, the draft was produced over the repaired federation path against the hub's LLM,
the semantic gate passed it, typecheck verified it, and it landed on origin/dev with no operator
hands — repairing a defect the substrate itself had introduced one dispatch earlier. That is the
hard success criterion, and the diff is NOT inert: the live tree's line 56 now carries the
alternation, which is the behaviour the goal asked for.

## Still open

- 80 pre-existing test failures in development-vessel
- substrate-pull-sync.timer is disabled/inactive on the spoke — the only code channel is unscheduled
- 23 posterior deltas dropped in 6h (ribosome-extract, auth_resolve_v1)
- the deterministic fast path's verifier shares the producer's field-choice rule
