# Conditioning selection on content-dependency differentiates what path_signature collapses

`validation/scripts/conditioned-differentiation-harness.py`. Runs entirely on the
local LLM arm via `docker exec` — no compose pipeline, no dispatch — so it
completes in **~1–2.5 minutes**, inside the 5-minute observability budget.

## The question

`path_signature` = md5(`path_activities`). On a satisfier walk that is
`[satisfier:<targetShape>]`, and the target is a deduplicated SET of output
shapes. Two goals demanding different work over the same shape collapse to one
identity — measured twice this session, a 1-operation and a 3-operation goal
recording the identical `4502429f465d532f`.

The operator's proposal: **idealize out the shapes that affect the expected output
content, and condition selection on those.** This harness tests whether that
produces a differentiation key that is *both* phrasing-invariant (two phrasings of
one goal collapse) and work-differentiating (two different goals separate) — the
two properties the LLM step count failed earlier this session.

## The design

A 5×2 matrix of goals with ground-truth work classes, plus a must-fail control:

| class | content depends on | content kind |
|---|---|---|
| W1 | discovery registry | count |
| W2 | gap store | count |
| W3 | registry + gaps | comparison |
| W4 | registry + gaps | ratio |
| W5 | gap store | id-list |

W1 and W2 are the crux: **same content kind, different source.** That is the pair
`path_signature` cannot tell apart.

- **BASELINE key** = the content kind alone (what the declared output shape
  captures — a "count" goal looks like any other "count" goal).
- **CONDITIONED key** = { data stores the content depends on } + content kind,
  with transport/write shapes idealized out.

## The result — and how it improved across three runs, in the session

**Run 1** conditioned on raw shape *names* and split identical goals (1/5
invariant): "how many shapes" picked `advertised_shape_coverage_scan`, its
rephrasing picked `discovery_vessel_registry_observer` — two shapes for one
source. The 324-shape vocabulary gives the model too many equivalent choices, so
the key moved with phrasing. **Same failure class as the step count.**

**The fix** was the `work_signature` canonicalization lesson applied again:
idealize the source down to its **owning data store** (data locality, law 11).
Six shapes that read the registry all become `discovery-registry`; the choice
space collapses from 324 to 5, and phrasing can no longer move it.

**Final run:**

```
                     correct-merges   correct-splits   cluster-purity
BASELINE (kind only)     5/5              36/40            0.80
CONDITIONED (deps)       4/5              40/40            1.00

SOURCE-BLIND COLLAPSES the baseline makes on different-work goals: 4
  of those, conditioning SEPARATES: 4   still merged: 0
CONTROL: must-fail key collides with a real goal: False  (ok)
```

- **Every source-blind collapse the baseline makes, conditioning fixes** (4/4).
  W1 `discovery-registry=>count` ≠ W2 `gap-store=>count` — the exact pair
  `path_signature` merges.
- **40/40 work-class separations, purity 1.00.**
- **Invariance 4/5–5/5 across runs.** The one miss: W5 "most recently updated
  gaps" — one phrasing attributed recency to the trace store, one to the gap
  store. That is a real ambiguity in the goal (where does "recently updated" come
  from?), not a phrasing artifact.

## What this establishes, and what it does not

**Establishes:** conditioning selection on the data-store the output content
depends on is a differentiation key that separates goals `path_signature`
collapses, while collapsing rephrasings — observably, improving across three
iterations inside one session, each run under the budget. The idealization that
makes it work is collapsing the source to its owning store, exactly as
`work_signature` collapses an endpoint to host:port + first segment.

**Does not establish:**
- **Stability.** Invariance is 80–100% run-to-run; the residual is LLM format
  variance (handled now by treating a parse miss as UNMEASURED and retrying,
  never as "depends on nothing") plus genuinely ambiguous goals. A production key
  needs the ambiguity resolved by asking the store, not the model.
- **Composition.** This differentiates at depth-1 — it is a better *identity*, not
  a composing walk. Producer steps stay 0 until the mint-side `input_shapes`
  repair gives the graph interior nodes.
- **That the live walk uses it.** This is the offline validation of the key. The
  live consumption point (threading it into producer/pathway selection) is the
  next change, not this one.

## The honest one-line verdict

The operator's idealization is **correct and demonstrable**: conditioning on
content-dependency, canonicalized to the data store, differentiates goals the
current identity collapses. It is not yet a stable production key, and it does not
by itself make the walk compose — those are the two named next steps.
