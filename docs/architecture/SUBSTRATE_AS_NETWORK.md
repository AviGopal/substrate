# The substrate as a network: how work, identity, trust, and the system itself cross the boundary

> Companion to the formal-lens documents, all reading one system through
> different coordinate charts: [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) (the
> learning *rule* — factored-MDP Bayesian Q-learning),
> [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) (the *structure* — a weighted
> directed cell complex and its Hodge operators),
> [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) (the *flow in time* — a
> slow–fast dynamical system with a conditional-stability threshold),
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) (the *engineering* —
> durability groups: what persists, what is ephemeral, what is appended),
> [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md) (the
> *representation* — an open basis of shape-axes; the momentum-space dual of the
> transformer), and [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) (the *fleet*
> — cross-container durability; what may cross the boundary). This is the
> **network** chart: the *protocol layer* — how the crossings are realized.
>
> FLEET reads the multi-container fleet through *durability* and answers **what**
> crosses the substrate boundary (and what must not): authored-durable by
> reference, recorded by union, ephemeral never, learned-durable only as
> evidence. This doc answers the **how** — the wire protocols, identity,
> verification, execution, and self-propagation that *realize* those crossings.
> Where FLEET names a frontier (the fold mechanism, transport, edge identity,
> cross-boundary execution), this doc fills it with a mechanism-level design.
>
> It rests on how established distributed systems solve these problems
> (libp2p/IPFS, Tailscale/WireGuard, Bluesky/AT-proto, Kademlia, BitTorrent,
> PBFT/HotStuff, CRDT/gossip, Ethereum rollups + proof-of-stake, zk-SNARK/STARK);
> those grounding claims are cited by bracket key and collected in `## References`.
> It introduces no new *substrate* primitive — it specifies the protocol layer
> beneath the existing four — and stays at the deployment/protocol altitude,
> consistent with the rule that nothing *above discovery* sees a substrate.

## 0. The protocol plane

FLEET §0 places itself at the deployment altitude; this doc is one layer lower —
the **wire**. The organizing claim: every cross-boundary interaction is one of a
small set of protocol operations, and each maps to a FLEET durability crossing.

| Protocol operation | Carries (out → back) | FLEET crossing it realizes | §|
|---|---|---|---|
| **Resolve a remote impulse** | pointer + scope attestation + budget → resolved impulse (metadata-first) | recall reads remote Informational; ephemeral runs remote | §9 |
| **Dispatch a remote goal** | goal-shaped impulse + attestation + budget → result + trace ref + signature | a whole sub-execution runs remote; recorded returns | §9 |
| **Gossip an artifact** | content-addressed id → bytes (verified by re-hash) | authored- / structural-learned-durable, by reference | §2,§5 |
| **Fold foreign evidence** | signed trace (+ proof) → local posterior delta | learned-durable as evidence, never as state | §4,§5 |
| **Admit / ratify a member** | pubkey id + self-cert → quorum signature | the one non-monotonic crossing — needs agreement | §6 |
| **Propagate the substrate** | image id + identity seed + admission → a running member | spreads all groups onto a new container | §7 |

Read top to bottom this is a dependency order: resolution and dispatch presuppose
identity (§1), addressing (§2), transport (§3), and a trust gate (§4); learning
(§5) presupposes verification; admission (§6) gates membership; propagation (§7)
and environment-sensing (§8) compose all of it; execution (§9) is where it lands.

## 1. Identity — derive from a genesis operation, not a raw key-hash

The mature systems all derive identity from a public key but **decouple the id from
the current key** so rotation does not destroy identity. Bluesky's `did:plc` is the
hash of a *signed genesis operation*, controlled by a **priority-ordered set of 1–5
rotation keys** (distinct from day-to-day signing keys), evolved through a
**hash-linked signed operation log** — rolling keys is an op; the id never changes
[[did:plc]]. libp2p adds the other half: **proof-of-possession in the transport
handshake** (Noise signs a channel-binding string with the identity key), so an id
is never trusted without the holder proving the private key *on this connection*
[[libp2p-peerids]].

A vessel identity derives from a public key via multihash — `vessel_id =
base32(multihash(SHA-256, pubkey))` with a self-signed registration challenge — and
this is the structural base. The matured form makes `vessel_id` the hash of a
*genesis op* with a rotation-key set + op-log, and adds handshake-time
proof-of-possession. A bare key-hash identity bakes in the rotation problem the
genesis-op systems already solved — a key compromise is identity death (the Mastodon
trap of §6's trust discussion). The design *avoids* a single central directory that
orders the op-log and picks forks (`did:plc`'s acknowledged centralization debt).

## 2. Disambiguation — self-describing ids, and namespaced shapes

Content-addressing solves exact-duplicate dedup for free and is the natural
template-id scheme: a template id is `sha256(canonical_json)`. Two refinements
transfer:

- **Self-describing ids.** A CID is `(version, multicodec, multihash, multibase)` —
  the address says *which* hash and *what* content-type, so the scheme can evolve
  without a flag-day [[multiformats-cid]]. A bare `sha256(canonical_json)` is
  codec-blind; prefixing template/shape ids with a multicodec+multihash header
  removes that rigidity.
- **Namespaced shapes.** Bare-string shape names collide across a trust boundary
  (same name, different contract) and synonymise (different name, same contract).
  AT-proto's **Lexicon/NSID** model namespaces every vocabulary term by **authority**
  (only the authority owner may mint under it) and makes them **versioned +
  immutable** (a breaking change is a *new* id) [[atproto-lexicon]]. A shape id of the
  form `<authority>.<name>.<version>`, where the authority is the vessel's
  pubkey-derived id, is the high-leverage form: the authority root is already held,
  it is simply put to use for vocabulary. This is the **structural prerequisite for
  FLEET §2's structural-learned-durable merge**: content-addressed keys are what make
  two substrates' lattices comparable.

This is the load-bearing refinement FLEET §2 names ("structure must align before
weights can move"): §1 + §2 *are* that alignment — pubkey identity + content-hashed,
namespaced, self-describing ids.

## 3. Transport — control/data-plane split, with the overlay beneath discovery

The biggest gap FLEET flags. Every system that reaches arbitrary network
environments splits a **control plane** (keys, endpoints, policy — tiny, hub-like)
from a **data plane** (direct, end-to-end-encrypted, peer-to-peer), degrading to a
**relay that never sees plaintext**. Tailscale: coordinator distributes config,
traffic is direct WireGuard, **DERP relays forward ciphertext only**, and existing
tunnels survive a coordinator outage [[tailscale-planes]]. libp2p is the
decentralized form — **AutoNAT** (decentralized STUN), **Circuit Relay v2**
(resource-capped bootstrap relays), **DCUtR** (½-RTT-synchronized simultaneous dial
through the relay to punch the hole, then drop it) [[libp2p-holepunch],
[dcutr-spec]]. A measurement of 4.4M attempts: **~70% ± 7.1% hole-punch success,
TCP ≈ QUIC, 97.6% succeed first try, success independent of relay quality — but the
hard-NAT residual (notably symmetric NATs) never punches through and needs a
permanent relay** [[nat-measurement]].

- The design adopts the libp2p stack (Noise + Circuit Relay v2 + AutoNAT + DCUtR) as
  the **L3 reachability layer beneath discovery-vessel**, which stays the **L7 control
  plane**. It already speaks `multihash(pubkey)` — near-zero impedance with §1. This
  separates *can these two vessels exchange packets* (transport) from *who produces
  shape X under what contract* (discovery), two questions that fuse only if the
  discovery answer is assumed to be a routable endpoint.
- The design *avoids* using libp2p's **Kademlia DHT as the discovery mechanism** — it
  is global, eventually-consistent, latency-variable; discovery-vessel is
  authoritative, low-latency, contract-aware. Tailscale chose a coordinator over a
  DHT for exactly this reason. The DHT (if used at all) serves only relay rendezvous.
- It *plans for* the symmetric-NAT ~30% floor with a funded, byte/time-capped relay;
  a fully-NATed standalone vessel reaches the fleet via that relay with E2E
  encryption intact.

## 4. Verification — a four-tier cost/trust spectrum

A signature proves *identity, not honesty*; across a trust boundary the adversary
holds both keys, so identity-signing alone is worthless. The systems sort onto a
spectrum, cheap → expensive, each buying more certainty at more cost:

| Tier | Mechanism | Trust assumption | Cost |
|---|---|---|---|
| **0** | cross-report correlation | shared trust root, honest-majority reporters | ~free, ex-post |
| **1** | stake + slashing | economically rational actors | bond + monitoring |
| **2** | optimistic / fraud-proof | 1-of-N *live* honest watcher | ~free common case + challenge window |
| **3** | ZK validity proof | math + circuit correctness | prover cost *every* item |

Tier 0 is BitTorrent private-tracker stat-fake detection (symmetric reports
cross-correlated — statistical, ex-post, collusion-defeatable, valid only within a
trust root). Tier 3 jumps to ZK. The rollup world's hard-won lesson is that
proving-everything is the wrong default [[fraud-vs-validity]]; the middle two tiers
are where the cost/trust curve is most favourable.

- **The headline middle tier — optimistic trace attestation.** Admit a trace as
  valid-by-assertion; any peer challenges within a window via **interactive bisection
  over the activity's task-DAG**, re-executing only the one disputed task. The
  per-task `input_impulse_ids`/`output_impulse_ids` + `resolver_version`/
  `vessel_version` make traces bisection-ready; the window can be far shorter than
  rollups' multi-day default. It requires a **live, incentivized watcher** — an
  unwatched fraud-proof tier silently decays to tier 0.
- **Stake + correlation-weighted slashing** is the Sybil/dishonesty deterrent under
  the optimistic tier — isolated faults cheap, coordinated faults superlinear
  [[eth-slashing]]; slashing fires only on a *won fraud proof*, never on
  correlation-tier suspicion.
- At the ZK tier, the design choice is a **STARK** (transparent setup matters because
  templates mutate; post-quantum; scales on big traces), **STARK→SNARK-wrap** for
  cheap verify/bandwidth, **recursively aggregated** to amortize — *not* Bulletproofs
  (range-only, ~1.1 s verify) [[zk-benchmark]].
- Trace attestations are **EIP-712-style typed, domain-bound, nonced** (domain
  separator `{substrate_id, vessel_id, schema_version}`) so they are replay-protected
  and scope-bound at every tier — unified with the signed-scope-attestation chain
  (§9) [[eip712]].

The attestation *tier* is precisely FLEET §3's "conservative prior," made into a
number: `signal_confidence_weight ∈ [0,1]`.

## 5. Learning across the boundary — share evidence, fold locally

FLEET §3 establishes the principle; here is the mechanism, hardened by the
federated-learning literature.

- **Fold, don't merge.** A foreign trace is admitted (attested per §4), tagged
  `foreign_provenance`, and folded into the **local** posterior:
  `α += w·s, β += w·f`, with `w` = attestation strength. Posterior state is never
  imported. Because nothing foreign enters as state, a member's storage is O(its own
  structure + a retained evidence window), **independent of total fleet volume** —
  fold-and-forget, not accumulate-everything.
- **The evidence model is structurally robust — and that is the whole defense.** The
  classic Byzantine-robust aggregators (Krum, trimmed-mean, Bulyan) *fail* against
  adaptive/colluding attacks — **ALIE** (A Little Is Enough) hides each malicious
  update inside honest variance [[alie]], **IPM** keeps distance small while flipping
  the gradient inner product [[ipm]], and a single adaptive attack breaks all four
  [[fang]]. The known fix is *judge by held-out outcome, not statistical normality* —
  which is exactly what sharing **verifiable signed evidence (traces)** instead of
  opaque gradients gives. The `α += w·s` rule is, as pure aggregation, a weak
  weighted-mean rule; it is saved by verification (§4), not by the fold.
- **Two conditions keep it sound:** (1) `w` is anchored to attestation +
  trace-verifiability and **never** to agreement-with-consensus (else the
  "stealth-by-conformity" exploit re-imports ALIE); (2) a per-source rolling-window
  **contribution quota** caps cumulative weighted influence.
- **The one real gap — Sybil/collusion at the evidence layer.** Verification catches
  *invalid* evidence, not *valid-but-collusively-correlated* evidence. A
  **FoolsGold-style update-diversity defense** — cluster incoming evidence by
  similarity and treat a too-mutually-similar cluster as one source [[foolsgold]] —
  combined with **identity cost** (§6 admission) and the quota forms a three-ring
  Sybil defense, since a quota alone is defeated by minting identities.

## 6. The consensus boundary — converge by default, agree only where forced

The **CALM theorem**: monotonic operations need no coordination — they converge
[[calm]]. This draws the line for the whole fleet.

- **~80% of fleet traffic is monotonic → CRDT + gossip, no consensus.** The Thompson
  fold is a CRDT **iff evidence is deduped by content-id** (else re-delivery
  double-counts and breaks idempotence). The append-only content-addressed trace
  store **is a Merkle-DAG/CRDT** [[merkle-crdt]]: store causal parent hashes (partial
  order), reconcile divergent stores by **Merkle-root anti-entropy** — bytes scale
  with the *divergence*, rounds are O(log N), versus O(N²) flooding.
- **~20% is non-monotonic → 3f+1 BFT quorum.** Member admission, revocation, and any
  single canonical baseline are equivocation-sensitive and irreversible: a Sybil
  admitted once is admitted forever. These need agreement, and against lying peers the
  bound is `n ≥ 3f+1`. **Compress the quorum's signatures with BLS aggregation**
  (HotStuff's lesson: 3f+1 votes → one O(1) certificate, constant-time verify)
  [[hotstuff], [bls-aggregation], [bls-multisig]] — usable even outside full
  consensus since it is just multi-sig.
- **Rule of thumb:** if a later-arriving message could *correctly change the answer*,
  it is monotonic → converge; if admitting a fact now must permanently exclude a
  conflicting one, it is non-monotonic → quorum. The design *avoids* paying 3f+1 for
  ordinary learning/trace propagation, and *avoids* a global/agreed posterior (it
  would serialize the fleet and violate "resolvers live where data lives").

This is also why **execution needs no consensus** (§9): every execution is
single-owner.

## 7. Self-propagation — a capability-graded ladder, admission-gated

Spreading is **an activity** (`propagate-substrate`), not an ops script: its output
shape is a new running member, its target is chosen by a Thompson-learned placement
policy, and it produces traces and a posterior like any other activity. It is
mitosis onto heterogeneous substrate; FLEET's durability groups dictate that
authored-durable is copied (the genome) while learned-durable is seeded or
re-derived (the epigenome). The unit of spreading is **graded by what the target can
run**:

| Target | What spreads | Idiom |
|---|---|---|
| Host / VM / capable edge box | the whole vessel fleet = a new **substrate** | mitosis + snapshot restore |
| Constrained device (Pi, phone, gateway) | **one vessel** advertising the shapes it can resolve | the standalone vessel |
| Minimal device / browser | a **resolver-only shim** for shapes it owns | the lightest cell |

The bootstrap reuses every layer above: **content-addressed image** (a container-side,
review-gated push to a registry; multi-arch = different CIDs under one self-describing
manifest, §2) → **overlay-join** for reachability (§3) → **pubkey identity** (§1) →
**quorum ratification** (§6, Tailnet-Lock-equivalent) → **state**: a full substrate
restores a learning-state snapshot; a partial/edge vessel **learns locally** because
its conditions differ (an edge `bash` resolver's latency is not the datacenter's) —
learned-durable is re-derived per environment, never copied. **Differentiation**
follows: a node specializes to its environment because the placement policy learns
which shapes pay off where.

The bootstrap sequence runs without an operator on the new host (image pull →
identity → present to N peers → quorum → admission), composed from the artifact-push
path and the federation phasing of the companion designs.

- **The operator brake is load-bearing, by design.** Autonomous spread onto *other
  devices* without admission is a worm. Two hard gates, both idiomatic: **(1)
  admission, not self-insertion** — a new node self-bootstraps but is untrusted until
  quorum-ratified by operator-held authority keys the control plane never sees (§6);
  spreading onto someone else's device requires that owner to admit it.
  **(2) bounded perception** — environment probing (§8) is scoped to an authorized
  network, not unbounded internet scanning. This is the structural push-away boundary
  between supervised and adversarial-resistant operation, not a limitation to engineer
  away. The operator holding those keys is not outside the system: it is a **modeled
  boundary entity** (the operator-as-vessel), and the substrate learns its
  interaction characteristics by the same observe → infer → score → fold mechanism it
  applies to any peer — see `SUBSTRATE_AS_REPRESENTATION.md` §6.1. "Operator
  non-load-bearing" (§7's push-away limit) is the asymptote of that learned model, not
  the operator's removal from the topology.

## 8. Environment discovery — the environment is impulses

Sensing the environment uses the same idioms as sensing code or data: resolve
pointers that address environmental facts, with the resolver living **on the node
that can see them**.

- **Environmental shapes (net-new resolvers):** `hostCapability` (arch, cores, RAM,
  GPU, disk, runtime), `networkPeer` (a device found via mDNS/SSDP/ARP/BLE/DHT —
  pointer = a reachable endpoint), `networkReachability` (NAT type, latency,
  bandwidth — **AutoNAT results become impulses**), `attachedDevice`/`sensor`, and
  for edge `powerThermalBudget` (a first-class placement constraint).
- **Discovery is the boredom loop, generalized outward.** boredom-vessel POSTs
  rotating *topology-discovery* goals (measurement, probing, health, escalation,
  coverage) against the substrate's **internal** topology; a `survey-environment`
  activity points the same surface at the **external** environment, emitting
  environmental impulses into the trace store — recorded, learnable state, not a
  one-shot scan ("the becoming never stops," applied to perception).
- **Tracking reuses the registry verbatim.** discovery-vessel does TTL, heartbeat,
  health-scoring, circuit-breaking for vessels; a discovered device is tracked the
  same way — a `networkPeer` with a TTL ages out like a dead vessel — with
  **impulse-relevance decay** keeping fresh facts and forgetting stale ones. A
  *candidate spread target* is a `networkPeer + hostCapability` whose shape-profile
  matches "can host a vessel," and the substrate **learns (Thompson) which targets
  pay off**. Observed-but-not-member devices are `foreign_provenance` impulses,
  conservatively weighted; observed → member is the §6 admission path.

The closed loop is fully idiomatic — no new control plane:
`perceive (survey-environment) → decide (placement policy) → spread
(propagate-substrate) → track (heartbeat + traces → placement posterior)`.

## 9. Cross-boundary execution — work does not move; resolution crosses

The capstone, and almost a koan: **an activity is never shipped as a moving process.
Execution stays local to whichever vessel owns the resolver; what crosses is impulse
resolution — a small request out, a small result back — recorded as a two-sided
trace.** This is FLEET §1 ("ephemeral never crosses") realized.

**Two modes — ship the data to the question, or the question to the data:**

- **Remote impulse resolution (data → question).** The activity runs in the local
  goal-host; one task needs a shape only a peer produces. Peer-aware `/resolve`
  returns the remote vessel's resolver contract (`resolve_endpoint`,
  `resolve_request_format`, `auth_scheme`, `resolve_timeout_ms`); goal-host calls it
  over the overlay; the remote vessel runs its resolver *where its data lives* and
  returns the resolved impulse **metadata-first** (bodies > 50 KB return
  `{truncated, summary}`). Only the resolution crosses.
- **Remote goal dispatch (question → data).** When the data is big, local, or
  sensitive, dispatch a goal-shaped impulse to a peer's goal-host (`POST /run-goal`,
  `goal_execution`/`activity_execution` shapes); the peer runs the whole
  sub-trajectory locally, records *its own* trace, and returns a result + trace
  reference.

The mode choice is the metadata-first idiom as a bandwidth lever: resolve the
metadata cheaply, then pull a small body (mode 1) or delegate the computation (mode
2).

**Orchestration locality — a tree of singly-owned executions, no control-flow
consensus.** Every execution has exactly one owning vessel. A cross-substrate
composition is a *tree* of singly-owned executions linked by `parent_execution_id` +
the denormalized `composition_chain` (threaded through `ExecuteOptions`); credit
flows back along the chain (`propagateCreditAlongChain`). Because control flow is
never collectively orchestrated, **execution needs no distributed consensus** —
matching §6: only membership is non-monotonic. The failure taxonomy extends across
the boundary: `safety_breach` (depth/cycle — peer-aware `/resolve` carries a depth
limit; `composition_chain` gives cross-substrate cycle detection *if ids are
content-addressed*), `budget_exhausted` (a dispatch carries a **budget grant**;
overrun is attributed correctly), `cascading` (a dropped remote link → upstream
attribution, no double-count).

**Authorization is capability-addressed and scope-attenuated.** The task names a
*shape*, not an endpoint, so dispatch is location-independent (the same property that
lets a vessel migrate without breaking callers). The resolver contract declares
`auth_token_source` (caller vs user identity) and `auth_delegation_mode: forward`.
Across a trust boundary, an **EIP-712-style scope-attestation chain** (org → user →
vessel) lets the peer authorize without a shared trust root, and **sub-goal scope
narrowing** constrains it: a cross-boundary sub-goal's `outputShapes ⊆
parent.endpoint_output_shapes`, else it converts to `human_in_the_loop_required`.

**Trusting the result vs. trusting the trace — keep them separate.** *Using* a
returned result: validate it **locally** against the activity's own validators
(enrichment-gated verification — the outputs satisfy the contract or they do not; you
can re-check, so you need not trust the peer to *use* the result). *Learning* from
the returned trace: gated by attestation tier (§4) — folded as evidence under an
attestation-weighted prior, never imported as posterior state. The peer's own
substrate learns fully from its own sub-execution; you learn at its attestation tier.

**Idempotency closes it.** Results carry content-addressed ids, so retries over the
flaky overlay are exactly-once and folding stays a CRDT (§6); a re-dispatched goal
returns the *same* execution, not a new one. A dropped link is a re-fetch, not a
distributed-transaction rollback — the boundary only ever carried a request and a
validatable, content-addressed result.

## 10. Scaling ceilings and topology growth

Everything above scales, but not on one clock. Three planes have independent growth
laws, and conflating them is how a "fully distributed" claim quietly acquires a
bottleneck. Separate them first:

| Plane | Growth law | Ceiling |
|---|---|---|
| **Data / learning** (§5) | folds evidence into local posteriors; well-behaved, O(own structure), value sublinear in N | per-node trace-store / compute — **vertical** |
| **Transport / routing** (§3) | O(log N) when structured; a relay-bound residual for the un-punchable NAT fraction | relay capacity for the symmetric-NAT periphery |
| **Control / admission** (§6) | ratifying trusted membership does **not** scale with N — a fixed authority set ratifies any number | admission throughput + authority centralization |

### The ceilings, ranked by how soon they bite

1. **Per-node trace-store / compute (vertical).** Fold-and-forget (§5) keeps each
   member's state O(own structure + retained evidence window), *independent of fleet
   volume* — so the fleet never imposes a storage cost on a node. The cheapest ceiling
   to hit is the one reached by neglecting retention: an unbounded local store. This
   is a single-node discipline, not a distributed problem.
2. **Admission throughput + authority centralization (the binding global ceiling).**
   3f+1 BFT (§6) scales to ~hundreds of signers, no further. The escape is a
   *fixed-size* authority set (Tailnet-Lock-weighted keys) that ratifies any number of
   members — so there is **no membership ceiling**. But two costs replace it: (a)
   admission *throughput* caps how fast the trusted fleet can grow, and (b) the
   authority set is the centralization SPOF and the single highest-value attack
   target. This is the chief structural tension with "fully distributed," and it is
   load-bearing by design (§7's operator brake), not an oversight.
3. **Relay capacity for the un-punchable NAT fraction (§3).** The ~30% symmetric-NAT
   residual never punches through and shares relay bandwidth. It scales by adding
   relays; the periphery's aggregate throughput is relay-bound, not peer-bound.
4. **Discovery reachability radius.** Depth-limited flooding reaches F^D nodes
   (fan-out F, depth D); past that radius a peer is invisible. Converting discovery to
   a Kademlia DHT would make reach O(log N) — at the eventual-consistency,
   latency-variable cost §3 declines for the contract-aware control plane.
5. **Trusted-membership growth rate under open federation.** The trusted subgraph
   grows only at the admission rate while the *observed* periphery branches far
   faster; that gap is not a defect — it **is** the security buffer (§5, §6).
   Byzantine tolerance caps the adversarial fraction at f < N/3.
6. **Soft ceiling: intelligence does not scale with N.** Learning convergence is
   sublinear in N — interest-overlap is bounded by Hodge sparsity — and beneath it
   sits the non-constructibility floor (`SUBSTRATE_AS_MDP.md` §11). More nodes add
   reach and resilience, not proportional intelligence.

### Expected topology growth

**Shape — core-periphery + scale-free + small-world.** Edges are capability-driven
and sparse: resolvers-live-where-data-lives makes the graph a consumer→producer-
per-shape map, and Hodge sparsity *is* that topology. Degree is scale-free —
Thompson selection plus content-addressed reuse is preferential attachment, so the
degree distribution goes power-law, with hubs being the canonical resolvers for
common shapes. Hubs are load- and SPOF-critical, though content-addressing softens
half of it: a *template* hub failing degrades gracefully (any holder can serve the
bytes), while live-resolution of a hot shape through one hub is a real bottleneck.
The result is tiered by trust × capability (§7's ladder): a ratified always-on core,
a partial edge ring, a churning resolver-shim fringe on relays — a core-periphery
structure with low diameter (O(log N) small-world via hubs + gossip).

**Rate — logistic, on two clocks.** Mitosis (§7) is branching, so spread has
exponential *potential*, but it is bounded by available targets, the Thompson
placement policy's selectivity, the cost-aware value-of-info throttle, and admission
throughput — the product is a logistic S-curve. The two clocks differ: the *trusted*
core grows ~linearly at the admission rate, while the *observed* periphery branches
fast — a slowly-thickening trusted backbone wrapped in a fast-fluctuating, mostly-
untrusted edge cloud. The edge is dynamic and the core stable: edge nodes are
partition-tolerant, diverge offline, and reconcile via Merkle anti-entropy on
reconnect (§6).

**Takeaway.** Learning and transport scale gracefully (sublinear / log); the topology
self-organizes into a scale-free small-world with a stable ratified core and a
churning untrusted edge; growth is logistic and gated by admission — and the binding
ceilings are per-node retention and admission-authority centralization, not raw N.

## 11. Scorecard — decision vs. established vs. frontier

**Canonical decisions / recommendations (this doc's authority):**

- Genesis-op + rotation-key + op-log identity, with handshake proof-of-possession. → §1
- Self-describing ids + authority-namespaced, versioned shapes (= FLEET §2's
  structural alignment). → §2
- libp2p L3 (Noise/Relay-v2/AutoNAT/DCUtR) beneath discovery as L7 control plane;
  not the DHT for discovery. → §3
- Four-tier verification spectrum; the optimistic middle + stake; STARK for the ZK
  tier. → §4
- Share evidence, fold locally; `w` anchored to attestation not consensus; FoolsGold
  diversity + identity cost. → §5
- Converge by default (CRDT/gossip, dedupe-by-content-id); 3f+1 + BLS only for
  admission/revocation/baseline. → §6
- Spread as a Thompson-learned, admission-gated activity on a capability ladder. → §7
- Environment as impulses; survey-environment + registry/relevance/Thompson tracking. → §8
- Cross-boundary execution = singly-owned tree of capability-addressed
  resolutions/dispatches; result validated locally, trace trusted by tier. → §9

**Established (rests on results cited here or by the companions):** pubkey-derived
content-addressed identity and proof-of-possession [[did:plc], [libp2p-peerids]];
self-describing and namespaced ids [[multiformats-cid], [atproto-lexicon]]; the
control/data-plane transport split and its NAT-traversal limits [[tailscale-planes],
[libp2p-holepunch], [nat-measurement]]; the fraud-proof / validity-proof cost
spectrum and the failure of statistical Byzantine aggregators against held-out
verification [[fraud-vs-validity], [alie], [ipm], [fang]]; CALM monotonicity,
Merkle-CRDT convergence, and BFT/BLS quorum compression [[calm], [merkle-crdt],
[hotstuff], [bls-aggregation]].

**Frontier (named, not asserted):** an optimistic verification tier with a bisection
re-executor and a live watcher; cross-report correlation *across* a boundary with a
global `correlation_id`; the cross-boundary **budget-grant** mechanism; deterministic
single-task replay under LLM-resolver nondeterminism; the environmental resolvers
(§8) and the `propagate-substrate` placement policy (§7); the artifact ladder below
the full-container case; concept-graph / quantitative merge beyond key alignment
(inherited from FLEET §2).

**Honest limit (carried):** none of this touches the non-constructibility ceiling
(`SUBSTRATE_AS_MDP.md` §11). More peers and more reach enlarge the *pool of
observation*; they do not complete the Informational state. A fully distributed,
openly-federated fleet is still an incomplete model — just a larger, more resilient
one.

## 12. Recap

FLEET says *what* crosses the substrate boundary, sorted by durability. This doc says
*how*: identity is a pubkey-derived, rotatable genesis id proven on the wire (§1);
artifacts and vocabulary are content-addressed, self-describing, and authority-
namespaced (§2); reachability is an overlay beneath discovery, with E2E-encrypted
relay fallback (§3); trust is a four-tier spectrum from cross-report to ZK, with an
optimistic middle (§4); learning crosses only as attested evidence folded locally,
robust *because* the evidence is verifiable (§5); the fleet converges without
consensus except for the one non-monotonic act of admitting a member (§6); the system
spreads itself as an admission-gated, Thompson-learned activity onto a
capability-graded ladder of targets (§7), sensing its environment as impulses through
the same registry-and-learning machinery it uses for everything else (§8); and work
crosses the boundary not by moving but by *composing* — a tree of singly-owned,
capability-addressed resolutions and dispatches, each running where its data lives,
each result validated locally and each trace trusted at its attestation tier (§9).

None of it is a new substrate primitive. It is the four primitives — impulse,
pointer, resolver, vessel — given a wire: a protocol layer, drawn from the proven
mechanisms of the distributed-systems canon, that lets the same learning loop run
across containers, edge devices, and arbitrary networks without ever centralizing the
learning or collectivizing the control flow.

## References

- **[did:plc]** Bluesky / AT Protocol, *DID PLC Method (v0.1) Specification*, web.plc.directory. https://web.plc.directory/spec/v0.1/did-plc — *verification: carried.*
- **[libp2p-peerids]** libp2p, *Peer IDs and Keys Specification*, libp2p/specs. https://github.com/libp2p/specs/blob/master/peer-ids/peer-ids.md — *verification: carried.*
- **[multiformats-cid]** Multiformats, *CID (Content IDentifier) Specification*, multiformats/cid. https://github.com/multiformats/cid — *verification: carried.*
- **[atproto-lexicon]** Bluesky / AT Protocol, *Lexicon Schema Guide*, atproto.com. https://atproto.com/guides/lexicon — *verification: carried.*
- **[tailscale-planes]** Tailscale, *Control Plane and Data Plane (concepts)*. https://tailscale.com/docs/concepts/control-data-planes — *verification: carried.*
- **[libp2p-holepunch]** libp2p / IPFS, *Hole Punching in libp2p — Overcoming Firewalls*, blog.ipfs.tech, 2022. https://blog.ipfs.tech/2022-01-20-libp2p-hole-punching/ — *verification: carried.*
- **[dcutr-spec]** libp2p, *Direct Connection Upgrade through Relay (DCUtR) Specification*, libp2p/specs. https://github.com/libp2p/specs/blob/master/connections/hole-punching.md — *verification: carried.*
- **[nat-measurement]** *A Large-Scale Measurement of libp2p Hole-Punching*, arXiv:2510.27500. https://arxiv.org/abs/2510.27500 — *verification: carried.*
- **[fraud-vs-validity]** Cyfrin, *Fraud Proofs and Validity Proofs: A Full Comparison*. https://www.cyfrin.io/blog/a-full-comparison-what-are-fraud-proofs-and-validity-proofs — *verification: carried.*
- **[eth-slashing]** Ethereum.org, *Proof-of-Stake Rewards and Penalties (slashing)*. https://ethereum.org/developers/docs/consensus-mechanisms/pos/rewards-and-penalties/ — *verification: carried.*
- **[zk-benchmark]** *Evaluating the Efficiency of zk-SNARK, zk-STARK, and Bulletproof in Real-World Scenarios: A Benchmark Study*, 2024. https://www.researchgate.net/publication/382138687_Evaluating_the_Efficiency_of_zk-SNARK_zk-STARK_and_Bulletproof_in_Real-World_Scenarios_A_Benchmark_Study — *verification: carried.*
- **[eip712]** Ethereum, *EIP-712: Typed Structured Data Hashing and Signing*. https://eips.ethereum.org/EIPS/eip-712 — *verification: carried.*
- **[alie]** Baruch, G., Baruch, M. & Goldberg, Y., *A Little Is Enough: Circumventing Defenses for Distributed Learning*, NeurIPS 2019; arXiv:1902.06156. https://arxiv.org/abs/1902.06156 — *verification: carried.*
- **[ipm]** Xie, C., Koyejo, O. & Gupta, I., *Fall of Empires: Breaking Byzantine-tolerant SGD by Inner Product Manipulation*, UAI 2019; arXiv:1903.03936. https://arxiv.org/abs/1903.03936 — *verification: carried.*
- **[fang]** Fang, M. et al., *Local Model Poisoning Attacks to Byzantine-Robust Federated Learning*, USENIX Security 2020; arXiv:1911.11815. https://arxiv.org/pdf/1911.11815 — *verification: carried.*
- **[foolsgold]** Fung, C., Yoon, C. & Beschastnikh, I., *The Limitations of Federated Learning in Sybil Settings (FoolsGold)*, RAID 2020; arXiv:1808.04866. https://arxiv.org/pdf/1808.04866 — *verification: carried.*
- **[calm]** Hellerstein, J. & Alvaro, P., *Keeping CALM: When Distributed Consistency Is Easy*, CACM 2020. https://cacm.acm.org/research/keeping-calm/ — *verification: carried.*
- **[merkle-crdt]** Sanjuán, H., Pöyhtäri, S., Teixeira, P. & Psaras, Y., *Merkle-CRDTs: Merkle-DAGs meet CRDTs*, arXiv:2004.00107. https://arxiv.org/pdf/2004.00107 — *verification: carried.*
- **[hotstuff]** Yin, M. et al., *HotStuff: BFT Consensus with Linearity and Responsiveness*, IACR eprint 2023/397. https://eprint.iacr.org/2023/397.pdf — *verification: carried.*
- **[bls-aggregation]** Mysten Labs, *New BLS Aggregation for Proof of Stake*. https://www.mystenlabs.com/blog/new-bls-aggregation-for-proof-of-stake — *verification: carried.*
- **[bls-multisig]** Boneh, D., Drijvers, M. & Neven, G., *Compact Multi-Signatures for Smaller Blockchains (BLS multi-signatures)*. https://crypto.stanford.edu/~dabo/pubs/papers/BLSmultisig.html — *verification: carried.*
