# Federation ingress caller authentication (closes gap federation-ingress-proxies-any-shape-with-node-authority-and-the-public-relay-admits-any-peer)

## Inputs (all in repo or rulings)
- **User ruling 2026-10-02:** peers in the same identity/discovery namespace are one trust group.
- **REALIGNMENT §9.0:** caller authentication on every route and shape locality before any exposure.
- **The 09-12 host-independent-federation-join proposal:** "confused deputy still open".
- **9f1d1c98:** registry shapes already require a credential carried IN THE POINTER, because the transport package hides headers and the connection.
- **Identity issuer-aware validation (14cada5, c0692b9):** local HMAC first, then TRUSTED_ISSUERS delegation.
- **FEDERATION_PEER_AUTH_MODE / FEDERATION_SIGNING_SECRET:** unread today; recommended for removal (realignment raw/federation-relay.md, mechanisms/chunk-29 F9).
- **I9 in federation-probe-tick.ts:** tests only the guarded registry shape.

## Design (one rule, applied at one seam)
1. **Caller credential on every federated resolve.** Generalize 9f1d1c98 from registry shapes to ALL shapes: the egress side attaches the CALLER's credential, not the transport's own key. A vessel calling out supplies its own; a forwarded human or surface call carries the human's.
2. **Receiving transport validates before forwarding.** Validation goes through identity (local HMAC first, then TRUSTED_ISSUERS). That makes "same identity namespace = trust group" enforceable rather than assumed.
   - It forwards to the local owner with the CALLER's credential, never the transport's own key. This closes the confused deputy: the local vessel's own route auth (§9.0) then judges the real caller.
3. **Per-shape authorization as a shaped policy (law 1, Delta 3), not a deny-list.**
   - The policy is `federationShapePolicy`: shape → {allowed callers: trust_group | public_anchor | none}.
   - Default for write/exec-class shapes (isWriteShape plus FS_WRITE_SHAPES, shell, bounded_shell, git_*, poolImpulse_write, substrateGap_write, policy shapes) is `none` over federation.
   - Unauthenticated callers reach only `public_anchor` shapes (registry discovery as today).
   - The policy is limit-class: changed only by the accepted criterion (slice L), recorded, a widening.
4. **Relay admission.** The relay grants reservations and circuits only to peers whose peer id is in the trust group's registered node set, read from discovery or identity.
   - Discovery registration identity must itself be enforced. That is the root shared with gaps addressed-federation-answers-are-attributed-by-self-reported-produced-by… and any-local-process-can-register-a-second-policy-producer…
   - Until then: a static, gate-judged allowlist of fleet peer ids as an interim.
5. **Answer attribution.** Addressed answers are attributed by the answering circuit's authenticated peer id, not produced_by (follow-up gap).
6. **Remove the unread FEDERATION_PEER_AUTH_MODE / FEDERATION_SIGNING_SECRET knobs** (env-gated, law 1), or make the signing secret the transport's identity-issued credential source.

## Falsifiers (must fail today)
- I9 extended with a must-fail control. An unauthenticated federated resolve of a NON-registry shape, a write-class shape included, is refused at ingress. A fixture shape is used, never a live write.
- Positive control: an authenticated trust-group caller's read of an allowed shape succeeds, and the local vessel sees the CALLER's identity, not the transport's.
- A relay reservation from a peer id outside the trust group is refused.
- The network acceptance leave/rejoin cases still pass, so federation isn't broken for fleet members.

## Delivery
- **Path:** image build, then CI (network acceptance on docker and podman), then :dev, then a pubspoke canary that hash-checks the running baked file before the functional check, then the hub (user).
- **Priority:** 6b (images from the accepted sha) becomes the top security item, since this ships through the image.
- **Containment:** stopping the hub relay plus the transports, masked, with self-repair held, covers the window until it is live. That decision is the user's.

## qa ruling (2026-10-02): APPROVE with three conditions
1. **No raw caller credentials across nodes.**
   - After validating, the receiving transport presents local vessels with a short-lived, audience-bound ON-BEHALF-OF token from identity: caller identity, this node, this shape, short TTL. It never passes the original credential, because a human's session token handed to another node's vessels could be replayed.
   - Falsifier: the local vessel sees the caller identity, and the token it holds is unusable against any other node or shape.
2. **Credentials never land in traces.**
   - A credential carried in the pointer rides through everything that records pointers: traces, logs, gap evidence, replication.
   - Strip it at the ingress boundary before any trace or log write, and keep it out of egress-side traces.
   - Falsifier: after the positive-control run, scanning the trace store, the journal and the relay logs for the test credential's value finds 0 hits.
3. **Census legitimate cross-node writes before default-none.**
   - Spokes forward some writes to the hub by design (e.g. substrateGap_write via GAP_STORE_ENDPOINT, memory writes).
   - Before enforcing, take a metadata-only census (shape names and counts) of which write-class shapes cross the transport today.
   - Seed those as trust_group in federationShapePolicy, with the census as the recorded evidence. Everything else stays default-none.
   - Each census entry becomes a positive-control falsifier: the write still succeeds for a trust-group caller.
- Delivery by the image path with the hash-checked canary; 6b stays top; containment stays with the user.
