# Demonstration: the learning flow through the human surface

`../../docs/assets/learning-flow-demo/learning-flow-demo.mp4` — 12m38s, 1280×800, recorded through the real UI at `:18310` on a
federated spoke. Three goals, typed as natural language, none previously dispatched. No cuts.

## What is on screen

| ≈ | goal, typed live | verdict | checked against |
|---|---|---|---|
| 0:38 | "Tell me the count of vessels the registry considers healthy." | REACHED, α+2 | `healthyCount=14` |
| 4:48 | "How many impulse shapes are advertised right now?" | REACHED | registry |
| 8:54 | "State the number of vessels currently registered with discovery." | REACHED, α+2 | `totalVessels=14` |

Offsets are approximate (derived from journal timestamps against the recording window); the
order and the verdicts are exact.

Each reach is graded `deterministic:verified-registry-count` — the verifier independently
queries `registry/stats` and compares. Credit is `alpha-credited satisfier:shellResult (+2)`,
and it lands in the HUB's store: this spoke masks `activity-api`, so a local write was not
possible. That is the loop closing end to end, from a human sentence to a posterior update on
another machine.

## Why the first goal is the point

"count of" was REFUSED before this session — `deterministic:unknown-registry-entity` — because
the counting-trigger alternation in `registry-field.ts` covered only "how many", "number of",
and "total". A well-formed question was turned away for its phrasing, which inverts law 13.

That defect was dispatched as a goal, and the substrate closed it itself: edit-intent detected,
routed to `feature_compose`, drafted against the hub's LLM over the federation transport, passed
the adversarial semantic gate, typecheck-verified, and landed `5d29f1f` on `origin/dev` with no
operator hands. An earlier attempt had put "count of" in the canonical FIELD-NAME regex — where
it is not a field name — and the substrate's own refuter caught that and rolled it back; the
next dispatch removed the bad placement and made the real change.

So goal 1 succeeding on camera is not a demonstration that the system can count. It is the
system exercising a capability it wrote for itself, after rejecting its own first draft.

## The second thing to watch for

Goal 2's walk logs `consulted concept-db via discovery: 2 concept(s) recalled`. Every walk on
this spoke previously logged `concept-db could not be asked — recall unavailable`, because
`concept-db.service` was role=infra (a spoke group) while its database is role=store (hub-only),
so it crashlooped and concept recall was silently absent from every goal. Recall now federates
to the hub. Both repairs are visible in BEHAVIOUR here, not merely in traces.

## What the video does not show

The non-deterministic tier is not demonstrated. These three goals reach through the
deterministic registry oracle, which is the tier that grades without an LLM judge. A goal
requiring semantic judgement is graded by the LLM plane, which on this spoke resolves over
federation to the hub — proven working, but not exercised on camera. Filming that honestly
requires a goal whose ground truth can still be checked by hand, and it is not in this take.

Also absent: β movement. Every β in this window was WITHHELD, by design — the log lines read
"NOT REACHED but β WITHHELD … α was structurally unreachable for this verdict". A demonstration
of learning that shows only α rising is showing half the loop.
