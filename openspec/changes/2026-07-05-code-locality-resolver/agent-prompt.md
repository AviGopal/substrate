# Agent prompt — code-locality resolver (expertise formation)

> Standing framing for any agent (operator or substrate) working on this change.
> The code use case is the first instantiation because it is easy to test and
> express — but the mechanism is generic and must be designed as such.

The generic form is **expertise formation**: the conversion of deliberate search
into calibrated, cue-triggered recall — with an explicit escalation path back to
deliberation when confidence is unwarranted.

Stripped of code, the six pieces map to a domain-independent loop:

1. **Attributed experience log** (the traces) — an episodic record of every task
   that captures not just the outcome, but *which information was consulted and
   which parts of the world were changed*. This attribution is what makes
   everything downstream possible; without it you have anecdotes, not evidence.

2. **Consolidation** (the mining tick) — an offline process that compresses
   episodes into a statistical regularity: "for tasks of kind X, the relevant
   material is reliably found at Y." This is chunking, or memory consolidation —
   turning many experiences into one indexed association.

3. **Cued recall** (the resolver) — when a new task arrives, its kind directly
   retrieves the relevant context. No search, no exploration; the situation
   itself summons what's needed. This is the recognition-primed decision of an
   expert versus the exhaustive survey of a novice.

4. **Metacognitive gating** (the confidence gate) — the recall is only *acted
   on* when its track record justifies it. A well-calibrated expert knows which
   of their intuitions to trust; below threshold, the system deliberately falls
   back to slow, exploratory reasoning — and that exploration feeds
   consolidation.

5. **Apprenticeship before autonomy** (shadow mode) — the habit runs silently
   alongside deliberation, predicting what it *would* have retrieved, and is
   promoted only when it demonstrably agrees with what deliberate search
   actually found. This guards against learning superstitions from
   correlational history.

6. **Precise blame on failure** (attribution wiring + trust posteriors) — when
   acting on recall goes wrong, the correction lands on the specific recalled
   items and the specific source's reliability, not diffusely on "the skill."
   Repeated attributed failure triggers *repair of the habit*, not just
   distrust of it.

In two familiar vocabularies: cognitively, it's the System-2-to-System-1
transition with calibrated metacognition deciding which system runs;
organizationally, it's converting open-ended investigation into runbooks with
known applicability conditions, an escalation path, and a post-mortem process
that fixes the runbook rather than merely noting it failed. The generative act
itself — actually making the change once context is in hand — remains the
irreducible judgment step in every version of the form.

---

**Sequencing directive:** start with the code use case (goals that name or
imply source files; "material" = files/symbols) because it can be tested and
expressed easily. But every shape contract, table, and gate must be written so
the code instantiation is one parameterization of the generic mechanism — the
consulted material could equally be memory notes, concepts, vault notes, or
peer vessels. No shape name, field, or key may bake in "file" where "material
locator" is meant, except in the code-specific instantiation layer.
