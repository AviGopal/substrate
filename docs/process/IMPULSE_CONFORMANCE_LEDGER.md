# Impulse Conformance Ledger

> **The invariant.** Every vessel-to-vessel **data-plane** exchange is a typed
> impulse: the caller resolves the target by shape via discovery and POSTs the
> typed-pointer envelope `{ "impulse": { "pointer": { "type": "<shape>", … } } }`
> to the target's **discovery-advertised** `resolve_endpoint`. The *path*
> (`/resolve` vs `/v2/impulses/resolve`) is per-vessel advertised data
> (`resolve_endpoint` in the registration contract,
> `repos/discovery-vessel/src/types.ts`), not part of the contract.
>
> **Exempt (control-plane / own-store):** discovery `register`/`heartbeat`,
> identity auth issuance/validation, `/health` probes, and a vessel accessing
> *its own* datastore.
>
> Prerequisite before migrating any seam: the **dual-parse conformance fix** —
> goal-host, concept-db, and llm-resolver `/resolve` handlers accept
> `body.impulse.pointer.*` (preferred) with legacy `body.*` fallback.

Known violations are tracked as gaps, one per seam; each is migrated on its own
goal. For each seam, decide the **target shape** (existing or minted), **who moves
first** (the lowest-stakes caller), the **dual-serve window and retirement trigger**
(the old surface stays until its callers are gone), and the **risk**.

## Why migrate at all

A bespoke REST hop is invisible to the learning loop. The same exchange as a
typed impulse lands in `impulse_resolutions` / trace events — resolver tier,
latency, cost, per-shape success — so Thompson selection and composition-edge
derivation can see and improve it. Verification for every migrated seam is
therefore twofold: (a) identical outcome, (b) the exchange now appears in the
trace.
