# The substrate as a network: how work, identity, trust, and the system itself cross the boundary

> Sixth companion to the lens docs, and the **engineering counterpart to
> [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md)**. FLEET reads the multi-container
> fleet through *durability* and answers **what** crosses the substrate boundary
> (and what must not): authored-durable by reference, recorded by union, ephemeral
> never, learned-durable only as evidence. This doc answers the **how** — the wire
> protocols, identity, verification, execution, and self-propagation that *realize*
> those crossings. Where FLEET names a frontier ("the fold mechanism," transport,
> edge identity, cross-boundary execution), this doc fills it with a concrete,
> mechanism-level design.
>
> It rests on a survey of how established distributed systems solve these problems
> (libp2p/IPFS, Tailscale/WireGuard, Bluesky/AT-proto, Kademlia, BitTorrent,
> PBFT/HotStuff, CRDT/gossip, Ethereum rollups + PoS, zk-SNARK/STARK). External
> claims are cited inline; the load-bearing ones are listed in §11.
>
> **Status discipline.** Almost everything here is *recommended* or *specced*, not
> *built*. The doc marks each: **LIVE** (running today), **SPECCED** (a draft
> openspec change exists), **RECOMMENDED** (this doc proposes it). It introduces no
> new *substrate* primitive — it specifies the protocol layer beneath the existing
> four — and stays at the deployment/protocol altitude, consistent with
> vessel-federation's rule that nothing *above discovery* sees a substrate
> (`../../openspec/changes/2026-05-23-vessel-federation/`).

## 0. The protocol plane

FLEET §0 placed itself at the deployment altitude; this doc is one layer lower —
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
([did:plc spec](https://web.plc.directory/spec/v0.1/did-plc)). libp2p adds the
other half: **proof-of-possession in the transport handshake** (Noise signs a
channel-binding string with the identity key), so an id is never trusted without the
holder proving the private key *on this connection*
([libp2p peer-ids](https://github.com/libp2p/specs/blob/master/peer-ids/peer-ids.md)).

- **LIVE / SPECCED:** H2 derives `vessel_id = base32(multihash(SHA-256, pubkey))`
  with a self-signed registration challenge (`2026-04-26-security-hardening-findings`
  H2; `2026-05-23-vessel-federation`).
- **RECOMMENDED:** make `vessel_id` the hash of a *genesis op* with a rotation-key
  set + op-log, and add handshake-time proof-of-possession. Our current raw-hash
  identity bakes in the rotation problem the others already solved — a key
  compromise is identity death (the Mastodon trap, §6 of FLEET's trust discussion).
  *Avoid* a single central directory that orders the op-log and picks forks
  (`did:plc`'s acknowledged centralization debt).

## 2. Disambiguation — self-describing ids, and namespaced shapes

Content-addressing solves exact-duplicate dedup for free and is **already our
template-id scheme**. Two refinements transfer:

- **Self-describing ids.** A CID is `(version, multicodec, multihash, multibase)` —
  the address says *which* hash and *what* content-type, so the scheme can evolve
  without a flag-day ([multiformats/cid](https://github.com/multiformats/cid)). Our
  template ids are a bare `sha256(canonical_json)` — codec-blind.
  **RECOMMENDED:** prefix template/shape ids with a multicodec+multihash header.
- **Namespaced shapes.** Our `shapes` are bare strings — across a trust boundary they
  collide (same name, different contract) and synonymise (different name, same
  contract). AT-proto's **Lexicon/NSID** model namespaces every vocabulary term by
  **authority** (only the authority owner may mint under it) and makes them
  **versioned + immutable** (a breaking change is a *new* id)
  ([Lexicon guide](https://atproto.com/guides/lexicon)). **RECOMMENDED (high
  leverage, cheap):** make a shape id `<authority>.<name>.<version>` where the
  authority is the vessel's pubkey-derived id — we already hold the authority root;
  we simply are not using it for vocabulary. This is the **structural prerequisite
  for FLEET §2's structural-learned-durable merge**: content-addressed keys are what
  make two substrates' lattices comparable.

This is the load-bearing refinement FLEET §2 demanded ("structure must align before
weights can move"): §1 + §2 *are* that alignment — pubkey identity + content-hashed,
namespaced, self-describing ids.

## 3. Transport — control/data-plane split, with the overlay beneath discovery

The biggest gap FLEET flagged. Every system that reaches arbitrary network
environments splits a **control plane** (keys, endpoints, policy — tiny, hub-like)
from a **data plane** (direct, end-to-end-encrypted, peer-to-peer), degrading to a
**relay that never sees plaintext**. Tailscale: coordinator distributes config,
traffic is direct WireGuard, **DERP relays forward ciphertext only**, and existing
tunnels survive a coordinator outage
([control/data planes](https://tailscale.com/docs/concepts/control-data-planes)).
libp2p is the decentralized form — **AutoNAT** (decentralized STUN), **Circuit Relay
v2** (resource-capped bootstrap relays), **DCUtR** (½-RTT-synchronized simultaneous
dial through the relay to punch the hole, then drop it)
([hole-punching](https://blog.ipfs.tech/2022-01-20-libp2p-hole-punching/)). A 2025
measurement of 4.4M attempts: **~70% ± 7.1% hole-punch success, TCP ≈ QUIC, 97.6%
succeed first try, success independent of relay quality — but the hard-NAT residual
(notably symmetric NATs) never punches through and needs a permanent relay**
([arXiv 2510.27500](https://arxiv.org/abs/2510.27500)).

- **RECOMMENDED:** adopt the libp2p stack (Noise + Circuit Relay v2 + AutoNAT +
  DCUtR) as the **L3 reachability layer beneath discovery-vessel**, which stays the
  **L7 control plane**. It already speaks `multihash(pubkey)` — near-zero impedance
  with §1. This separates *can these two vessels exchange packets* (transport) from
  *who produces shape X under what contract* (discovery), which we currently fuse by
  assuming the discovery answer is a routable endpoint.
- *Avoid* using libp2p's **Kademlia DHT as the discovery mechanism** — it is global,
  eventually-consistent, latency-variable; discovery-vessel is authoritative,
  low-latency, contract-aware. Tailscale chose a coordinator over a DHT for exactly
  this reason. Use the DHT (if at all) only for relay rendezvous.
- *Plan for* the symmetric-NAT ~30% floor with a funded, byte/time-capped relay; a
  fully-NATed standalone vessel reaches the fleet via that relay with E2E encryption
  intact.

## 4. Verification — a four-tier cost/trust spectrum

A signature proves *identity, not honesty*; across a trust boundary the adversary
holds both keys, so identity-signing alone is worthless. The systems sort onto a
spectrum, cheap → expensive, each buying more certainty at more cost:

| Tier | Mechanism | Trust assumption | Cost | Our status |
|---|---|---|---|---|
| **0** | cross-report correlation | shared trust root, honest-majority reporters | ~free, ex-post | **H1, SPECCED** |
| **1** | stake + slashing | economically rational actors | bond + monitoring | **gap** |
| **2** | optimistic / fraud-proof | 1-of-N *live* honest watcher | ~free common case + challenge window | **gap → H-mid, RECOMMENDED** |
| **3** | ZK validity proof | math + circuit correctness | prover cost *every* item | **H6, forward-looking** |

H1 is BitTorrent private-tracker stat-fake detection (symmetric reports
cross-correlated — statistical, ex-post, collusion-defeatable, valid only within a
trust root). H6 jumps to ZK. **We are missing the middle two**, and the rollup
world's hard-won lesson is that proving-everything is the wrong default
([fraud vs validity proofs](https://www.cyfrin.io/blog/a-full-comparison-what-are-fraud-proofs-and-validity-proofs)).

- **RECOMMENDED (headline):** insert **H-mid, optimistic trace attestation** — admit
  a trace as valid-by-assertion; any peer challenges within a window via
  **interactive bisection over the activity's task-DAG**, re-executing only the one
  disputed task. Our per-task `input_impulse_ids`/`output_impulse_ids` +
  `resolver_version`/`vessel_version` make traces bisection-ready; the window can be
  far shorter than rollups' 7 days. Requires a **live, incentivized watcher** — an
  unwatched fraud-proof tier silently decays to tier 0.
- **RECOMMENDED:** **stake + correlation-weighted slashing** as the Sybil/dishonesty
  deterrent under H-mid — isolated faults cheap, coordinated faults superlinear
  ([Ethereum slashing](https://ethereum.org/developers/docs/consensus-mechanisms/pos/rewards-and-penalties/));
  only ever slash on a *won fraud proof*, never on correlation-tier suspicion.
- **RECOMMENDED:** when H6 is reached, choose a **STARK** (transparent setup matters
  because templates mutate; post-quantum; scales on big traces), **STARK→SNARK-wrap**
  for cheap verify/bandwidth, **recursively aggregate** to amortize — *not*
  Bulletproofs (range-only, ~1.1 s verify)
  ([SNARK/STARK/Bulletproof benchmark](https://www.researchgate.net/publication/382138687_Evaluating_the_Efficiency_of_zk-SNARK_zk-STARK_and_Bulletproof_in_Real-World_Scenarios_A_Benchmark_Study)).
- **RECOMMENDED:** make trace attestations **EIP-712-style typed, domain-bound,
  nonced** (domain separator `{substrate_id, vessel_id, schema_version}`) so they are
  replay-protected and scope-bound at every tier — unify with the planned H3.

The attestation *tier* is precisely FLEET §3's "conservative prior," made into a
number: `signal_confidence_weight ∈ [0,1]` (`2026-05-23-zk-trace-attestations`).

## 5. Learning across the boundary — share evidence, fold locally

FLEET §3 established the principle; here is the mechanism, hardened by the federated-
learning literature.

- **Fold, don't merge.** A foreign trace is admitted (attested per §4), tagged
  `foreign_provenance`, and folded into the **local** posterior:
  `α += w·s, β += w·f`, with `w` = attestation strength. Never import posterior
  state. Because nothing foreign is imported as state, a member's storage is
  O(its own structure + a retained evidence window), **independent of total fleet
  volume** — fold-and-forget, not accumulate-everything.
- **Our evidence model is structurally robust — and that is the whole defense.** The
  classic Byzantine-robust aggregators (Krum, trimmed-mean, Bulyan) *fail* against
  adaptive/colluding attacks — **ALIE** ([A Little Is Enough](https://arxiv.org/abs/1902.06156))
  hides each malicious update inside honest variance, **IPM** keeps distance small
  while flipping the gradient inner product
  ([Fall of Empires](https://arxiv.org/abs/1903.03936)), **Fang et al.** breaks all
  four ([1911.11815](https://arxiv.org/pdf/1911.11815)). Fang's own fix is *judge by
  held-out outcome, not statistical normality* — which is exactly what sharing
  **verifiable signed evidence (traces)** instead of opaque gradients gives us. Our
  `α += w·s` is, as pure aggregation, a weak weighted-mean rule; it is saved by
  verification (§4), not by the fold.
- **Two conditions keep it sound:** (1) `w` is anchored to attestation +
  trace-verifiability and **never** to agreement-with-consensus (else the
  "stealth-by-conformity" exploit re-imports ALIE); (2) a per-source rolling-window
  **contribution quota** caps cumulative weighted influence.
- **The one real gap — Sybil/collusion at the evidence layer.** Verification catches
  *invalid* evidence, not *valid-but-collusively-correlated* evidence.
  **RECOMMENDED:** a **FoolsGold-style update-diversity defense** — cluster incoming
  evidence by similarity and treat a too-mutually-similar cluster as one source
  ([1808.04866](https://arxiv.org/pdf/1808.04866)). Combine with **identity cost**
  (§6 admission) and the quota: a three-ring Sybil defense, since a quota alone is
  defeated by minting identities.

## 6. The consensus boundary — converge by default, agree only where forced

The **CALM theorem**: monotonic operations need no coordination — they converge.
This draws the line for the whole fleet.

- **~80% of fleet traffic is monotonic → CRDT + gossip, no consensus.** Our Thompson
  fold is a CRDT **iff evidence is deduped by content-id** (else re-delivery
  double-counts and breaks idempotence). Our append-only content-addressed trace
  store **is a Merkle-DAG/CRDT** ([Merkle-CRDTs](https://arxiv.org/pdf/2004.00107)):
  store causal parent hashes (partial order), reconcile divergent stores by
  **Merkle-root anti-entropy** — bytes scale with the *divergence*, rounds are
  O(log N), versus O(N²) flooding.
- **~20% is non-monotonic → 3f+1 BFT quorum.** Member admission, revocation, and any
  single canonical baseline (H5) are equivocation-sensitive and irreversible: a Sybil
  admitted once is admitted forever. These need agreement, and against lying peers
  the bound is `n ≥ 3f+1`. **Compress the quorum's signatures with BLS aggregation**
  (HotStuff's lesson: 3f+1 votes → one O(1) certificate, constant-time verify) —
  usable even outside full consensus since it is just multi-sig.
- **Rule of thumb:** if a later-arriving message could *correctly change the answer*,
  it is monotonic → converge; if admitting a fact now must permanently exclude a
  conflicting one, it is non-monotonic → quorum. *Avoid* paying 3f+1 for ordinary
  learning/trace propagation, and *avoid* a global/agreed posterior (it would
  serialize the fleet and violate "resolvers live where data lives").

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

The bootstrap reuses every layer above: **content-addressed image** (self-persistence
Phase 2 pushes it to a registry; multi-arch = different CIDs under one self-describing
manifest, §2) → **overlay-join** for reachability (§3) → **pubkey identity** (§1) →
**quorum ratification (§6, Tailnet-Lock / H4)** → **state**: a full substrate restores
the `substrate-state` snapshot (self-persistence Phase 0); a partial/edge vessel
**learns locally** because its conditions differ (an edge `bash` resolver's latency
is not the datacenter's) — learned-durable is re-derived per environment, never
copied. **Differentiation** follows: a node specializes to its environment because
the placement policy learns which shapes pay off where.

- **SPECCED:** the bootstrap sequence is fleet-federation R3 (image pull → identity →
  present to N peers → quorum → admission, no operator on the new host); the artifact
  + push path is `2026-06-16-substrate-self-persistence-and-direct-push`.
- **The operator brake is load-bearing, by design.** Autonomous spread onto *other
  devices* without admission is a worm. Two hard gates, both idiomatic: **(1)
  admission, not self-insertion** — a new node self-bootstraps but is untrusted until
  quorum-ratified by operator-held authority keys the control plane never sees (§6);
  spreading onto someone else's device requires that owner to admit it.
  **(2) bounded perception** — environment probing (§8) is scoped to an authorized
  network, not unbounded internet scanning. This is the S2→S3 push-away boundary, not
  a limitation to engineer away.

## 8. Environment discovery — the environment is impulses

Sensing the environment uses the same idioms as sensing code or data: resolve
pointers that address environmental facts, with the resolver living **on the node
that can see them**.

- **Environmental shapes (RECOMMENDED, net-new resolvers):** `hostCapability` (arch,
  cores, RAM, GPU, disk, runtime), `networkPeer` (a device found via
  mDNS/SSDP/ARP/BLE/DHT — pointer = a reachable endpoint), `networkReachability`
  (NAT type, latency, bandwidth — **AutoNAT results become impulses**),
  `attachedDevice`/`sensor`, and for edge `powerThermalBudget` (a first-class
  placement constraint).
- **Discovery is the boredom loop, generalized outward.** boredom-vessel already POSTs
  rotating *topology-discovery* goals (measurement, probing, health, escalation,
  coverage) against the substrate's **internal** topology; a `survey-environment`
  activity points the same surface at the **external** environment, emitting
  environmental impulses into the trace store — recorded, learnable state, not a
  one-shot scan ("the becoming never stops," applied to perception).
- **Tracking reuses the registry verbatim.** discovery-vessel already does TTL,
  heartbeat, health-scoring, circuit-breaking for vessels; a discovered device is
  tracked the same way — a `networkPeer` with a TTL ages out like a dead vessel —
  with **impulse-relevance decay** keeping fresh facts and forgetting stale ones. A
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

- **Remote impulse resolution (data → question, LIVE primitive).** The activity runs
  in the local goal-host; one task needs a shape only a peer produces. Peer-aware
  `/resolve` returns the remote vessel's resolver contract (`resolve_endpoint`,
  `resolve_request_format`, `auth_scheme`, `resolve_timeout_ms`); goal-host calls it
  over the overlay; the remote vessel runs its resolver *where its data lives* and
  returns the resolved impulse **metadata-first** (bodies > 50 KB return
  `{truncated, summary}`). Only the resolution crosses.
- **Remote goal dispatch (question → data, LIVE primitive).** When the data is big,
  local, or sensitive, dispatch a goal-shaped impulse to a peer's goal-host
  (`POST /run-goal`, `goal_execution`/`activity_execution` shapes); the peer runs the
  whole sub-trajectory locally, records *its own* trace, and returns a result + trace
  reference.

The mode choice is the metadata-first idiom as a bandwidth lever: resolve the
metadata cheaply, then pull a small body (mode 1) or delegate the computation (mode
2).

**Orchestration locality — a tree of singly-owned executions, no control-flow
consensus.** Every execution has exactly one owning vessel. A cross-substrate
composition is a *tree* of singly-owned executions linked by `parent_execution_id` +
the denormalized `composition_chain` (threaded through `ExecuteOptions`, **LIVE**);
credit flows back along the chain (`propagateCreditAlongChain`). Because control flow
is never collectively orchestrated, **execution needs no distributed consensus** —
matching §6: only membership is non-monotonic. The failure taxonomy already extends
across the boundary: `safety_breach` (depth/cycle — peer-aware `/resolve` carries a
depth limit; `composition_chain` gives cross-substrate cycle detection *if ids are
content-addressed*), `budget_exhausted` (a dispatch carries a **budget grant**;
overrun is attributed correctly), `cascading` (a dropped remote link → upstream
attribution, no double-count).

**Authorization is capability-addressed and scope-attenuated.** The task names a
*shape*, not an endpoint, so dispatch is location-independent (the same property that
lets a vessel migrate without breaking callers). The resolver contract already
declares `auth_token_source` (caller vs user identity) and `auth_delegation_mode:
forward`. Across a trust boundary, the **H3 EIP-712-style scope-attestation chain**
(org → user → vessel) lets the peer authorize without a shared trust root, and
**CC1** narrows it: a cross-boundary sub-goal's `outputShapes ⊆
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

## 10. Scorecard — decision vs. established vs. frontier

**Canonical decisions / recommendations (this doc's authority):**

- Genesis-op + rotation-key + op-log identity, with handshake proof-of-possession. → §1
- Self-describing ids + authority-namespaced, versioned shapes (= FLEET §2's
  structural alignment). → §2
- libp2p L3 (Noise/Relay-v2/AutoNAT/DCUtR) beneath discovery as L7 control plane;
  not the DHT for discovery. → §3
- Four-tier verification spectrum; add the optimistic **H-mid** middle + stake; STARK
  for H6. → §4
- Share evidence, fold locally; `w` anchored to attestation not consensus; add
  FoolsGold diversity + identity cost. → §5
- Converge by default (CRDT/gossip, dedupe-by-content-id); 3f+1 + BLS only for
  admission/revocation/baseline. → §6
- Spread as a Thompson-learned, admission-gated activity on a capability ladder. → §7
- Environment as impulses; survey-environment + registry/relevance/Thompson tracking. → §8
- Cross-boundary execution = singly-owned tree of capability-addressed
  resolutions/dispatches; result validated locally, trace trusted by tier. → §9

**Established (LIVE or SPECCED today):** peer-aware `/resolve` and content-addressed
vessel/template ids (vessel-federation, SPECCED); H1/H2 (security-hardening, SPECCED);
resolver-contract auth fields, goal-host `/run-goal` + `/resolve`,
`parent_execution_id`/`composition_chain`, `propagateCreditAlongChain`, the
failure-mode taxonomy, boredom topology-discovery (LIVE); the self-persistence /
fleet-federation phasing (SPECCED, draft).

**Frontier (named, not built):** H-mid optimistic verification + bisection
re-executor; H1's invoked-view *across* a boundary + a global `correlation_id`; the
cross-boundary **budget-grant** mechanism; deterministic single-task replay under
LLM-resolver nondeterminism; the environmental resolvers (§8) and the
`propagate-substrate` placement policy (§7); the artifact ladder below the
full-container case; concept-graph / quantitative-merge beyond key alignment
(inherited from FLEET §2).

**Honest limit (carried):** none of this touches the non-constructibility ceiling
(`SUBSTRATE_AS_MDP.md` §11). More peers and more reach enlarge the *pool of
observation*; they do not complete the Informational state. A fully distributed,
openly-federated fleet is still an incomplete model — just a larger, more resilient
one.

## 11. Recap

FLEET said *what* crosses the substrate boundary, sorted by durability. This doc says
*how*: identity is a pubkey-derived, rotatable genesis id proven on the wire (§1);
artifacts and vocabulary are content-addressed, self-describing, and authority-
namespaced (§2); reachability is an overlay beneath discovery, with E2E-encrypted
relay fallback (§3); trust is a four-tier spectrum from cross-report to ZK, with an
optimistic middle we currently lack (§4); learning crosses only as attested evidence
folded locally, robust *because* the evidence is verifiable (§5); the fleet converges
without consensus except for the one non-monotonic act of admitting a member (§6);
the system spreads itself as an admission-gated, Thompson-learned activity onto a
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

---

**External grounding** (load-bearing empirical claims): identity/rotation —
[did:plc](https://web.plc.directory/spec/v0.1/did-plc),
[libp2p peer-ids](https://github.com/libp2p/specs/blob/master/peer-ids/peer-ids.md);
disambiguation — [multiformats/cid](https://github.com/multiformats/cid),
[AT-proto Lexicon](https://atproto.com/guides/lexicon); transport —
[libp2p hole-punching](https://blog.ipfs.tech/2022-01-20-libp2p-hole-punching/),
[DCUtR spec](https://github.com/libp2p/specs/blob/master/connections/hole-punching.md),
[NAT measurement (arXiv 2510.27500)](https://arxiv.org/abs/2510.27500),
[Tailscale control/data planes](https://tailscale.com/docs/concepts/control-data-planes),
[Tailnet Lock](https://tailscale.com/docs/concepts/tailnet-lock-whitepaper);
verification — [fraud vs validity proofs](https://www.cyfrin.io/blog/a-full-comparison-what-are-fraud-proofs-and-validity-proofs),
[Ethereum slashing](https://ethereum.org/developers/docs/consensus-mechanisms/pos/rewards-and-penalties/),
[EIP-712](https://eips.ethereum.org/EIPS/eip-712),
[SNARK/STARK/Bulletproof benchmark](https://www.researchgate.net/publication/382138687_Evaluating_the_Efficiency_of_zk-SNARK_zk-STARK_and_Bulletproof_in_Real-World_Scenarios_A_Benchmark_Study);
learning — [Fall of Empires/IPM (arXiv 1903.03936)](https://arxiv.org/abs/1903.03936),
[Fang et al. (arXiv 1911.11815)](https://arxiv.org/pdf/1911.11815),
[FoolsGold (arXiv 1808.04866)](https://arxiv.org/pdf/1808.04866); consensus/convergence —
[Keeping CALM (CACM 2020)](https://cacm.acm.org/research/keeping-calm/),
[Merkle-CRDTs (arXiv 2004.00107)](https://arxiv.org/pdf/2004.00107),
[HotStuff (eprint 2023/397)](https://eprint.iacr.org/2023/397.pdf),
[BLS aggregation (Mysten)](https://www.mystenlabs.com/blog/new-bls-aggregation-for-proof-of-stake)
+ [BLS multi-signatures, Boneh et al.](https://crypto.stanford.edu/~dabo/pubs/papers/BLSmultisig.html).
