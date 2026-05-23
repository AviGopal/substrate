# Proposal — Vessel Federation

**Date:** 2026-05-23
**Status:** Draft (post-lift sibling to the impulse-activity loop)
**Relates to:** `2026-04-26-impulse-activity-loop` Phase 26 (single-container
substrate) and Phase 27 (lift); `2026-04-26-security-hardening-findings`
H2 (vessel-id from pubkey) and H4 (Tailnet-Lock-equivalent ratification).

## Why now

Phase 26 (`2026-05-23-single-container-substrate`) collapses the vessel
fleet into one container so the development loop has a tractable trust
boundary while H1/H2/H4 are still in flight. Phase 27 declares itself the
IAL's terminal phase: once the substrate sustains its own four-stage
loop, *new external work — including new substrates — is dispatched by
the running substrate, not authored as further IAL phases*.

Lift is therefore the right moment to spec how two substrates know about
each other. Inside the container the question never arises: every vessel
is reachable via localhost; the discovery-vessel registry is the entire
known world. Between two containers (one on a laptop, one in a canary
cluster; or two laptops mid-pair-programming session) we need a way for
each side's discovery-vessel to know about the other's vessels and route
to them.

We deliberately do not name this concept "substrate routing". A
substrate is a deployment artifact — a container, a cluster, a process
tree. From inside the system there are only vessels and shapes. This
spec keeps that property: it teaches `discovery-vessel` how to know
about other `discovery-vessel`s, but everything *above* discovery
(minibob, activity-api, development-vessel, …) keeps calling
`/resolve` and gets back a vessel record. Whether the vessel happens
to live in the same container or in a peer container is invisible
upstream.

## What it adds

Three primitives, in dependency order:

1. **Vessel identity from a public key.** Apply
   `vessel_id = base32(multihash(SHA-256, pubkey))` from H2 §2 (security-
   hardening-findings) to every vessel, including the discovery-vessel
   itself. This makes "the same vessel" mean the same thing across
   containers — two registrations of the same pubkey describe the same
   vessel, regardless of which discovery-vessel saw it first.

2. **Content-addressed template ids.** Define
   `template_id = "activity:" + sha256_hex(canonical_json(template))`,
   reusing the canonical-JSON+SHA-256 construction already specified in
   `2026-05-17-state-space-signature-thompson-keying`. Two substrates
   that minted the same template independently produce the same id; one
   substrate's Thompson posteriors on that id are comparable to
   another's (separate concern, gated on H1; this spec only fixes the
   key, not the merge).

3. **Peer-aware discovery-vessel.** A discovery-vessel may hold a list
   of peer discovery-vessels (each peer identified by its pubkey-derived
   `vessel_id` and an endpoint). On `/resolve`, after exhausting local
   registrations, it forwards the query to peers under a configurable
   depth limit and merges responses. Returned vessel records carry a
   small reachability annotation (last-seen, latency hint) but **do
   not carry a substrate label**: the caller sees vessels, not topologies.

## Explicit non-goals

- **No "substrate" type, "substrate_id" field, or "substrate" routing
  primitive in any vessel above discovery.** Substrate is deployment
  vocabulary. minibob and activity-api receive vessel records, not
  topology metadata. If a future feature genuinely needs to know "is
  this vessel in my container?", the answer is computed from
  reachability annotations, not from a labelled identifier.
- **No cross-substrate Thompson sharing.** Even with content-addressed
  template ids, posteriors stay learner-local until H1 (two-sided
  signed traces) is shipped and a separate spec defines the merge
  semantics. This spec stops at "the key is comparable"; merging
  α/β across peers is out of scope.
- **No new account-scope federation.** The IAL's existing federation
  thread (`design.md §Federation as Scope Delegation`) is about
  cross-*account* RBAC scope grants embedded in API keys at issuance.
  That mechanism is orthogonal to discovery-vessel peering. Both can
  coexist: an account-scope grant decides *whether* a caller may
  invoke a remote vessel; discovery-vessel peering decides *how* the
  caller learns the remote vessel exists.
- **No automatic peer establishment.** Establishing a peer link is
  out-of-band (operator-driven). H4 (Tailnet-Lock-equivalent) is the
  authority primitive that gates the establishment in enforce mode;
  this spec ships the peering plumbing but does not require H4 to be
  green at log-only mode.

## Foundational alignment

The foundation (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
§"The Composition Graph and Informational State") already names the
abstraction we need: the **reachable subgraph** is the set of shapes
producible by resolvers across vessels currently connected to the
network. Discovery-vessel peering is the mechanism by which "currently
connected" extends past a single container boundary. The foundation
does not mention substrates as system primitives, and this spec does
not introduce them. It enlarges *reachability*, leaving the rest of the
system to keep treating "a vessel that produces shape X" as a single
addressable thing.

## Sequencing relative to lift (IAL Phase 27)

The IAL terminates at Phase 27 by design (`IAL/tasks.md:1664-1675`).
This spec is therefore **not** a new IAL phase. It is a post-lift
sibling: the substrate may run successfully without peering (one
container, one substrate, lift achievable per Phase 27's criterion);
peering is the first capability the post-lift substrate can author
*for itself* without violating the IAL's terminal condition.

The IAL `tasks.md` "Gates & Dependencies" section is updated to list
this spec as a sibling. No existing IAL phase is modified.
