# The substrate as a fleet: durability across containers, and what may cross the boundary

> Companion to the formal-lens documents, all reading one running system through
> different coordinate charts:
> [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) — the learning *rule* (factored-MDP
> Bayesian Q-learning); [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) — the
> *structure* (a weighted directed cell complex and its Hodge operators);
> [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) — the *flow in time* (a
> slow–fast dynamical system with a conditional-stability threshold);
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) — the *engineering*
> (durability groups: what persists, what is ephemeral, what is appended, who may
> change each); [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md)
> — the *representation* (an open basis of shape-axes; the momentum-space dual of
> the transformer). This doc — **the fleet** — takes the same durability
> classification and asks the one question a single substrate cannot pose: **when
> there is more than one container, for each durability group, what is its
> cross-container algebra — what does it cost to share, merge, or move that group
> between two substrates?** Its engineering counterpart,
> [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) — the *network* (the
> protocol layer that realizes the crossings) — answers **how**.
>
> It introduces no new primitives. It introduces one *classification refinement*
> (§2: the learned-durable group is not homogeneous across containers) and shows
> that this refinement is the durability-theoretic account of where the boundary
> between mergeable and non-mergeable learned state actually falls.

## 0. Altitude: this lens is deliberately at the deployment plane

"Substrate" is deployment vocabulary, not an in-system primitive: there is no
`substrate_id` field, no substrate type, and no substrate-routing primitive in any
vessel above discovery. From inside the system there are only vessels and shapes;
whether a vessel lives in this container or a peer is invisible upstream, computed
(if ever needed) from reachability annotations, not from a label.

This doc does not violate that. It operates at the **same altitude as
`SUBSTRATE_AS_SOFTWARE`** — the operator/software plane, where "substrate
(deployment sense)" and "container" are the correct words (`SUBSTRATE_AS_SOFTWARE`
§3.1, vessel-as-code vs vessel-as-instance). The fleet is a fact visible to the
*operator who deploys, backs up, and migrates*; it is not a primitive visible to
activities. Everything below treats "substrate" strictly in the deployment sense.

## 1. The four cross-container algebras

`SUBSTRATE_AS_SOFTWARE` §4 sorts one substrate into four durability groups and
observes that the loop crosses them in a fixed pattern (recall reads Informational
→ runs Ephemeral → writes Recorded; learning reads Recorded → writes
learned-durable; nothing in the normal loop writes authored-durable). The fleet
question is the same chart applied across the container line: **which crossings now
go *between* containers, and what is the merge operator for each group?** The four
answers are different, and that difference is the entire design.

| Durability group | Cross-container algebra | Operator / transport | Trust gate |
|---|---|---|---|
| **Authored-durable** | **Shareable by reference.** Identical-by-construction while every container runs the same images; *diverges* once a substrate authors its own code. Merge = git merge, review-gated. | container-side authenticated `git push` to a shared remote; peers pull + redeploy | code review / CI — the operator-or-substrate-authored boundary |
| **Recorded** | **Union.** Append-only ⇒ commutative, associative. Trivial to combine, *hard to trust*. | substrate-state bundle (migration/backup); signed traces returned by peer-aware resolution | two-sided counterparty signatures + a foreign-provenance tag |
| **Ephemeral** | **Never crosses.** A cross-container dispatch runs the Transient execution *in the remote container*; only a Recorded result returns. | n/a — reconstructable only from the trace | n/a (nothing in-flight is shipped) |
| **Learned-durable** | **No single merge operator** — it is not homogeneous (see §2). Splits into a *structural* sublayer that merges and a *quantitative* sublayer that does not. | content-addressed keys (structural); signed evidence folded locally (quantitative) | content-addressed identity (keys); two-sided signatures (evidence) |

Three of the four groups have clean cross-container behavior:

- **Authored-durable** is the *common substrate of all substrates* — while every
  container runs the same images, the system "operates identically on any
  substrate." It diverges only once a substrate begins authoring its own code; the
  propagation channel is then git — a container-side, review-gated push to the
  shared branch — and the merge discipline is review/CI. The fleet analog of
  `SUBSTRATE_AS_SOFTWARE` §4's "nothing in the loop writes authored-durable":
  **nothing in the cross-container *loop* writes a peer's authored-durable** — that
  only happens through git, review-gated.

- **Recorded** is append-only, so its merge is set-union: commutative and
  associative, the easiest algebra in the table. The hard part is not combining it
  but *trusting* it — a trace produced in B and consumed in A is meaningless unless
  both endpoints signed it (two-sided signatures), which is why a hardening
  property that is otherwise forward-looking becomes critical-path for the fleet.

- **Ephemeral** never crosses *by construction*. This is why the fleet has no
  distributed-transaction problem on in-flight state: a cross-container dispatch is
  a recall request going out and a Recorded result coming back; the trajectory, the
  slot bindings, the resolver call stack all stay in whichever container runs the
  execution. The boundary is crossed by recall and by record, **never by shipping a
  live execution.**

The fourth group is the whole frontier, and it is the rest of this doc.

## 2. Learned-durable is not homogeneous across containers

`SUBSTRATE_AS_SOFTWARE` §4 lists the learned-durable group as a single bucket:
Thompson posteriors (α/β), the shape lattice, composition-edge weights, goal-paths,
impulse-relevance scores. Within one substrate that lumping is harmless — it is all
one database snapshot. **Across containers it is the load-bearing distinction**,
because the bucket contains two things with opposite cross-container algebra:

| Sublayer | What it is | Cross-container algebra | Why |
|---|---|---|---|
| **Structural** learned-durable | *which* shapes exist, *which* templates exist, *which* composition edges and goal-paths exist — the topology, identified by its keys | **Mergeable** (graph union) once the keys are made comparable | keys can be made identical *by construction* via content-addressing |
| **Quantitative** learned-durable | the α/β magnitudes on those edges, impulse-relevance counts — the evidence accumulated *on* the structure | **Not mergeable** as state; moves only as signed evidence folded locally | a count means "what *this* learner observed"; combining counts double-counts priors and requires aligned keys |

The structural sublayer federates closer to *authored*-durable than to posteriors,
and the mechanism is **content-addressing of identity**. This is the
representation-lens point read at the deployment plane: the structural learned-
durable *is* the open shape-basis topology of `SUBSTRATE_AS_REPRESENTATION` (which
axes exist, which edges connect them), and content-addressing is what makes "the
same axis" mean the same thing in two containers.

- `vessel_id = base32(multihash(SHA-256, pubkey))`: two registrations of the same
  pubkey describe the same vessel, regardless of which discovery-vessel saw it
  first.
- `template_id = "activity:" + sha256(canonical_json(template))`, reusing
  canonical-JSON + SHA-256 keying: two substrates that minted the same template
  independently produce the same id.

Content-addressing **is** the alignment of the structural sublayer: it makes "the
same shape," "the same template," "the same composition edge" mean the same thing
in two containers without a shared registry. The key is made comparable; merging
α/β is a separate problem. Read through durability, that division is: **content-
addressing federates the structural sublayer; the quantitative sublayer is a
separate problem with a different algebra.**

> **Canonical refinement (this doc's authority):** the learned-durable group of
> `SUBSTRATE_AS_SOFTWARE` §4 splits, *across containers*, into a **structural**
> sublayer (topology, made comparable by content-addressed identity) and a
> **quantitative** sublayer (counts, learner-local until signed evidence can move
> them). Structure must align before weights can move, because the weights are
> indexed by the keys the structure defines.

## 3. Share evidence, not weights — and why the foundation forces it

The quantitative sublayer is where the temptation lives: *just ship the posteriors
to a central place and combine α/β.* The architecture forbids it, and the
durability lens explains why the prohibition is correct rather than conservative.

**"Resolvers live where data lives" is a statement against centralizing learned
state.** In the DEC lens it is the *sparsity of the Hodge Laplacian* — bounded-
support update ⇒ sparse operator ⇒ message-passing locality (`SUBSTRATE_AS_DEC.md`
§2; `SUBSTRATE_AS_DYNAMICS.md` §5, where the locality phrasing is metaphor and the
defensible claim is this sparsity one). A merged global posterior is a *dense*
operator: it couples every learner to every other learner's counts. So "merge the
weights" is not a missing feature; it is the thing the architecture is built to
avoid.

**The merge is also lossy and ill-defined.** A Beta posterior starts at a prior
`(α₀, β₀)` and becomes `(α₀ + s, β₀ + f)` after `s` successes and `f` failures. The
honest "as if one learner saw all evidence" merge of substrate A and B is

```
α_merged = α_A + α_B − α₀ ,   β_merged = β_A + β_B − β₀
```

— the naive `α_A + α_B` **double-counts the shared prior**. Worse, the merge is
only meaningful if the `(resolver, signature)` key denotes the same object in both
substrates — which two independently-grown shape lattices do **not** guarantee
unless §2's structural alignment has already happened. So even the quantitative
merge, where it is wanted, is *blocked on structure first*.

**The correct cross-container move is therefore federated-learning-by-evidence, not
by weights:** a foreign trace is admitted *only if both endpoints signed it* (two-
sided signatures), tagged with foreign provenance, and folded into the **local**
substrate's *own* posterior under a **separate, more conservative confidence
prior** — the update is recomputed locally, never imported as state. The companion
non-goal — *no cross-substrate Thompson sharing; merging α/β across peers is out of
scope* — is therefore **a consequence of the foundation, not a gap to be closed
later.** The system shares the Recorded group (evidence, union-mergeable, trust-
gated) and lets each learner re-derive its own quantitative learned-durable from
it. It never ships the quantitative learned-durable directly.

## 4. The two motions, across the boundary

`SUBSTRATE_AS_SOFTWARE` §1.1 names the two motions within a substrate — **recall**
(Informational → Transient → Observational) and **learning** (Observational →
Transient → Informational). At fleet scale each acquires a cross-container form,
and naming both is what makes "what may cross the boundary" precise:

- **Cross-container recall** = peer-aware resolution. After exhausting local
  registrations, a discovery-vessel forwards the query to peers under a depth limit
  and merges responses. The *Transient* execution then runs in whichever container
  hosts the chosen vessel; only a *Recorded* result returns. Reads Informational
  (the peer's authored + structural learned-durable, reached by content-addressed
  identity), runs Ephemeral *remotely*, returns Recorded. Ephemeral never crosses.

- **Cross-container learning** = a peer's signed, foreign-provenance Recorded trace
  folded into the local quantitative learned-durable under a conservative prior
  (§3). Reads (foreign, signature-verified) Recorded → writes local learned-
  durable. The peer's Recorded becomes *evidence for* the local Informational of
  the next cycle — the loop, extended one container outward.

- **No motion in the normal cross-container loop writes a peer's authored-durable.**
  That is the fleet analog of `SUBSTRATE_AS_SOFTWARE` §4's operator-authored
  boundary. A substrate changes a *peer's* code only through git + review, exactly
  as, within one substrate, the authored-durable boundary is crossed only when the
  substrate begins authoring its own code. **Self-installation onto a fresh host**
  (image pull, identity generation, presentation to N peers for quorum
  ratification) is the one case where a substrate writes authored-durable *to a new
  container*, and it is fenced behind quorum ratification precisely because it
  crosses that boundary.

## 5. The degenerate fleet: N = 1 is migration (self-persistence)

The smallest fleet has one member that moves. A substrate migrating from host A to
host B is the cross-container question with the peer set to *its own future self*,
and it exercises exactly the same algebra:

- **Authored-durable** travels as the image + git remote (already shareable by
  reference).
- **Recorded + quantitative learned-durable** travel as the **substrate-state
  bundle** — database posteriors/traces + concept graph + memory notes exported to
  a versioned, verified bundle in a durable store, with restore-on-bootstrap so a
  fresh container resumes as the prior one.
- **Ephemeral** does not travel — a migrated substrate reconstructs nothing
  in-flight; it resumes from the restored Recorded + learned-durable.

This is the continuity requirement the math docs state directly: *the carrier of
learning must survive a move from host A to host B* — `SUBSTRATE_AS_DEC.md` §4.4
(the learned content is `⋆`, the persisted posterior precision);
`SUBSTRATE_AS_MDP.md` §4.6 ("the transient state is the steady state"). The N=1
case is where the **transport** for the durable groups is exercised; the N>1 case
(§3) adds only the *trust gate and the conservative-prior fold* on top of the same
transport. Migration is federation with a trusted peer of one — the **base case of
the algebra**, not a preparatory step toward it. Single-substrate operation and
this self-persistence case are the exercised path; the N>1 rows of the table are
design, and the scorecard (§7) carries that distinction honestly.

## 6. Trust = which durability group a peer may write to in your substrate

The adversary-model progression (a)/(b)/(c) is the fleet-scale restatement of the
operator-supervised → supervised-federation → operator-non-load-bearing
progression, and durability makes its meaning concrete: **a peer's trust level is
exactly the set of your durability groups it is allowed to influence.**

| Adversary model | Peer may influence | Gate |
|---|---|---|
| **(a) trusted-peer audit** — all operator-controlled | your Recorded (as signed evidence → your quantitative learned-durable, conservative prior); scoped audit probes | two-sided signatures + content-addressed identity + scoped attestations + a baseline immune to audit-poisoning |
| **(b) semi-trusted federation** — mutually untrusted code | same, plus admission of the peer *vessel* into your reachable structural layer | + quorum ratification (k-of-n authority signatures) before the registry trusts the peer |
| **(c) open federation** — anyone may peer | same, under sustained adversarial exposure | gated on **push-away** evidence (interventions refused with cited rationale) — no mechanical gate |

The invariant across all three rows: **no adversary model ever lets a peer write
your authored-durable or your quantitative learned-durable directly.** The most a
peer can do, even when fully trusted, is supply *Recorded evidence* (counterparty-
signed) that *you* fold into *your* posteriors under *your* conservative prior, and
— once ratified — be *reachable* in your structural layer by content-addressed
identity. Trust escalates *what a peer may offer*, never *what it may overwrite*.
That is the durability statement of "push-away": the operator (and, at the open-
federation limit, the substrate itself) becomes non-load-bearing precisely because
the boundary between offered-evidence and owned-state is structural, not
procedural.

## 7. Scorecard — decision vs. established vs. frontier

Following the companion docs.

**Canonical decisions (this doc's authority):**

- The fleet lens is at the *deployment plane*; it introduces no in-system substrate
  primitive, consistent with the rule that nothing above discovery sees a
  substrate. → §0
- The learned-durable group splits, across containers, into a **structural**
  sublayer (content-addressed, mergeable) and a **quantitative** sublayer (counts,
  learner-local; movable only as signed evidence). Structure aligns before weights
  move. → §2
- Cross-container learning is **share-evidence-not-weights**: signature-verified
  foreign-provenance Recorded folded into the *local* posterior under a
  conservative prior; the quantitative learned-durable is never shipped as state.
  → §3

**Established (rests on results/specs already cited by the companions):**

- Content-addressed vessel and template identity (pubkey-multihash; canonical-JSON
  + SHA-256 keying) is the structural-alignment mechanism. → §2
- Append-only Recorded merges by union; two-sided counterparty signatures are the
  trust gate. → §1, §3
- Ephemeral never crosses; cross-container dispatch is recall-out / record-back —
  peer-aware resolution. → §1, §4
- The Beta-merge double-counting (`α_A+α_B−α₀`) and the sparsity-of-`L` argument
  against dense global posteriors. → §3 (`SUBSTRATE_AS_DEC.md` §2)

**Frontier (named, not asserted):**

- The *mechanism* that folds a foreign signed trace into the local posterior under
  a conservative prior (the exact prior, the down-weighting rule, the decay) is
  described, not pinned down. → §3
- **Cross-substrate concept-graph merge** (identity collisions, edge-weight
  reconciliation) is open even with content-addressed keys; §2 says *structure can
  merge*, not that the merge is fully specified. → §2
- A **content-addressed composition-edge / goal-path identity** that makes the
  structural sublayer mergeable end-to-end (beyond vessel + template ids) is implied
  by §2 but not separately specified. → §2

**Honest limit (carried):**

- Federation does not touch the non-constructibility ceiling
  (`SUBSTRATE_AS_MDP.md` §11). Sharing evidence across containers enlarges the pool
  of observations; it does not make the Informational state complete. More peers ≠
  a complete model. → inherited from `SUBSTRATE_AS_SOFTWARE` §6.

### Absorbable mechanisms — what the world already offers

The frontier items above do not all require invention. Several are standard,
well-analyzed mechanisms that enter through the primitives this doc already names
— the Recorded group's union-merge, content-addressed identity, the evidence-fold
rules of §3, and the admission gates of §6 — as normal operation, not as new
tiers. For each: what it offers, how it enters, and what it does not solve.

- **Transparency logs / verifiable append-only structures** ([Laurie 2014]).
  *Offers:* Merkle-tree logs with inclusion and consistency proofs make the
  Recorded group's union-merge *auditable* across peers — a peer can prove a
  trace was in its store before it signed it, and a consumer can prove the
  peer's log has not been rewritten under it. *Enters as:* the storage
  discipline of the existing trace store — the Recorded group is already
  content-addressed and append-only; a Merkle overlay is a stronger way of
  keeping the same store, not a new one. *Does not solve:* inclusion is not
  truthfulness. A provably-logged trace can still be a lie about what executed;
  two-sided counterparty signatures remain the trust gate (§1, §3).

- **Merkle-CRDT anti-entropy** ([Sanjuán et al.]; the network chart leans on
  the same mechanism). *Offers:* reconciliation of divergent Recorded stores
  with transfer cost proportional to the divergence, not the store — two peers
  exchange only the sub-DAGs the other lacks. *Enters as:* the transport for
  the union algebra §1 already names; append-only set-union is exactly the
  merge a Merkle-CRDT computes, so this is the wire realization of an operator
  the table already commits to. *Does not solve:* it merges *records*. It never
  merges quantitative learned state — the §2/§3 line is untouched, and a
  reconciled foreign trace still passes the signature gate before it folds.

- **Secure aggregation** ([Bonawitz et al. 2017]). *Offers:* where the evidence
  itself is sensitive, peers can contribute *aggregate* evidence (summed
  success/failure counts over a cohort) without revealing any individual trace.
  *Enters as:* an optional evidence-fold transport under the same
  conservative-prior fold of §3 — the local learner still recomputes its own
  posterior; only the granularity of what it folds changes. *Does not solve:*
  it protects the privacy of evidence at the cost of per-trace verifiability —
  an aggregate cannot carry two-sided signatures on its constituent traces, so
  it trades directly against the trust gate and must be scoped accordingly
  (e.g., only among peers already at row (a)/(b) of §6, with a further-widened
  conservative prior).

- **Reputation-weighted evidence folding** (federated-bandit literature, e.g.
  [Demirel et al.]). *Offers:* per-source trust weights learned from held-out
  outcome agreement — a peer whose evidence historically predicts local
  outcomes earns a larger fold weight. *Enters as:* the existing
  attestation-weight `w` in the conservative-prior fold made *adaptive per
  source* — same fold rule, learned coefficient. *Does not solve:*
  verification. A weight anchored to consensus agreement re-imports the
  poisoning attacks the network chart names (collude, agree, then defect);
  reputation modulates *how much* signed evidence moves a posterior, never
  *whether* unsigned evidence is admitted.

## 8. Recap

The fleet is the single-substrate durability chart applied across the container
line, one merge operator per group. **Authored-durable** is shareable by reference
(git, review-gated; diverges only once a substrate authors its own code).
**Recorded** merges by union and is trust-gated by two-sided signatures.
**Ephemeral** never crosses — a cross-container dispatch runs the execution remotely
and returns only a trace, so the fleet has no in-flight distributed state to
reconcile. And **learned-durable**, the one group with no single operator, splits
into a *structural* sublayer that content-addressing makes mergeable — the open
shape-basis topology of `SUBSTRATE_AS_REPRESENTATION`, read at the deployment plane
— and a *quantitative* sublayer that the architecture forbids merging as state, so
it moves only as signed evidence folded locally under a conservative prior. Trust
between substrates is exactly *which durability group a peer may influence*, and no
trust level ever lets a peer overwrite your authored or quantitative-learned state;
it only lets it *offer evidence* and *be reachable*. Migration is the N=1 case that
builds the transport; federation adds the trust gate on top.

None of this is new machinery, and none of it re-decides where the federation lines
fall — it is the durability-theoretic account of **why** they stop at "the key is
comparable" and "fold signed evidence, don't merge weights." Those are not the
unfinished halves of cross-container learning; they are its correct shape, and the
line they draw is the line between the structural and quantitative sublayers of the
Informational state.

## References

This doc's cross-container claims rest on the companion charts (cited inline by
name and section) and on a small set of external results carried from the prior
text:

- **[Demirel et al.]** Demirel, I. et al., *Federated Multi-Armed Bandits Under Byzantine Attacks*, 2022. https://arxiv.org/abs/2205.04134 — *verification: carried.*
- **[Laurie 2014]** Laurie, B., *Certificate Transparency*, ACM Queue 12(8), 2014. https://queue.acm.org/detail.cfm?id=2668154 — *verification: carried.* (Merkle-tree transparency logs; inclusion and consistency proofs for append-only stores)
- **[Sanjuán et al.]** Sanjuán, H., Pöyhtäri, S., Teixeira, P. & Psaras, I., *Merkle-CRDTs: Merkle-DAGs meet CRDTs*, 2020. https://arxiv.org/abs/2004.00107 — *verification: carried.* (anti-entropy merge of append-only stores with divergence-proportional transfer; also cited by `SUBSTRATE_AS_NETWORK.md`)
- **[Bonawitz et al. 2017]** Bonawitz, K. et al., *Practical Secure Aggregation for Privacy-Preserving Machine Learning*, ACM CCS 2017. https://dl.acm.org/doi/10.1145/3133956.3133982 — *verification: carried.* (aggregate contributions without revealing individual inputs)
- **[MARL surveys]** Cooperative-MARL / federated-RL survey literature on sharing experience rather than parameters across agents. — *verification: carried.*
- **[Heaps' law]** Heaps, H. S., *Information Retrieval: Computational and Theoretical Aspects*, Academic Press, 1978 (vocabulary-growth law for an open, growing symbol set). — *verification: carried.*
- **[Hansen & Ghrist 2019]** Hansen, J. & Ghrist, R., *Toward a Spectral Theory of Cellular Sheaves*, J. Applied & Computational Topology, 2019; arXiv:1808.01513. https://arxiv.org/abs/1808.01513 — *verification: verified.* (via the sparsity-of-`L` cross-reference to `SUBSTRATE_AS_DEC.md` §2)
