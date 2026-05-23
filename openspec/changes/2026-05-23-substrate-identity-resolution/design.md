# Design — substrate-identity-resolution

## A. The minimum-bootstrap-credential pattern

Every vessel starts knowing exactly two things from its environment:

```bash
SUBSTRATE_IDENTITY_URL=https://identity.localhost:8090   # or wherever
VESSEL_BOOTSTRAP_KEY=mbk-<base64>-<hmac>                 # short-lived
```

The bootstrap key is single-use or short-lived (default 15 min from
issuance). It is good for exactly one operation: `POST
{SUBSTRATE_IDENTITY_URL}/v1/auth/resolve-context` with the key as a
Bearer credential. The response is the `(substrateIdentity,
vesselCredentials)` tuple the vessel needs.

The bootstrap key is not the vessel's working credential. Working
credentials (`vesselCredentials.api_key`) are issued only via this
exchange. The bootstrap key, once consumed, cannot be reused.

This is the cheapest possible bootstrap: two env vars, one HTTP
call, one trace. No SOPS-encrypted YAML at boot. No K8s Secret
mounts. No bash scripts.

## B. Why two env vars, not zero

A truly zero-env-var bootstrap is tempting but impossible without
either (a) hardcoded defaults (the leak we're closing) or (b) some
out-of-band discovery (DNS-SD, mDNS, well-known endpoints) that
itself becomes a deployment-specific assumption.

Two env vars is the minimum that:
- Names *which* substrate to ask (`SUBSTRATE_IDENTITY_URL`).
- Authenticates the asker (`VESSEL_BOOTSTRAP_KEY`).

A vessel that has neither cannot be told it should trust the
substrate at `https://identity.localhost:8090` over the substrate
at `https://identity.someone-elses.com`. Two env vars makes the
trust boundary explicit at the OS-process level.

## C. detectEnvironment(): keep, consolidate, or delete

Today, six vessels carry a `detectEnvironment()` function that
branches on `KUBERNETES_SERVICE_HOST` and `/.dockerenv`. Three
options:

1. **Keep per-vessel.** Status quo. Each vessel duplicates the
   logic. Cost of consolidation > cost of duplication.
2. **Consolidate into `packages/substrate-bootstrap/`.** Single
   library, all vessels import. Eliminates drift. Cost: one new
   shared package, one round of updates per vessel.
3. **Delete entirely.** Vessels read their endpoints from env or
   from `resolve-substrate-context`. No detection. The operator
   (or the substrate's own bootstrap activity) sets the right
   env values for the deployment shape.

**Default: option 3 (delete entirely).** Detection logic is the
deployment-shape leak we're trying to eliminate. If the operator
sets `SUBSTRATE_IDENTITY_URL=https://identity.localhost:8090`, the
vessel doesn't need to know it's running in Docker vs K8s vs
native — it just knows where its substrate identity broker is. The
six detection blocks get deleted, not consolidated.

This is a stronger commitment to deployment-agnosticism. If we
hit cases where the deletion breaks something (e.g., DNS
resolution behaves differently in cluster mode), we add option 2
as a fallback. Option 1 is rejected outright.

## D. mint-substrate-identity activity

Bootstrap activity that runs **once per substrate, ever**. Equivalent
of today's `scripts/substrate/seed-identity.ts`, but as an activity:

```
input_shapes:  [substrateMintRequest]   # {name, domain, federation_membership?}
output_shapes: [substrateIdentity]
tasks:
  1. generate-signing-key      deterministic   (ed25519 keypair)
  2. compute-substrate-id      deterministic   (multihash of pubkey)
  3. issue-jwt-issuer          deterministic   (compose from domain)
  4. persist-identity-record   db_write        (identity-vessel store)
  5. emit-identity             memo            (the substrateIdentity impulse)
```

The activity is run by identity-vessel itself on first boot. The
operator supplies the `substrateMintRequest` via a one-shot CLI
invocation; thereafter identity-vessel owns the `substrateIdentity`
record and serves it via `resolve-substrate-context`.

`seed-identity.ts` becomes a thin shim that dispatches this
activity, then archives itself once `closure-audit` confirms the
activity-resident path works.

## E. issue-vessel-credentials activity

Runs per-vessel-boot. Consumes a `bootstrapAttestation` (proof
the vessel holds a valid bootstrap key) and a registration
request:

```
input_shapes:  [bootstrapAttestation, vesselRegistration]
output_shapes: [vesselCredentials]
tasks:
  1. validate-bootstrap-key    deterministic   (HMAC check, expiry)
  2. mark-key-consumed         db_write        (prevent reuse)
  3. generate-api-key          deterministic   (HMAC over substrate signing key)
  4. attach-scopes             deterministic   (from registration request)
  5. persist-credential        db_write        (identity-vessel store)
  6. emit-credentials          memo
```

The credential is bound to the substrate via the signing key
fingerprint; it is verifiable offline against
`substrateIdentity.signing_key_fingerprint`.

## F. resolve-substrate-context activity

The endpoint every vessel hits at boot. Implemented as a single
HTTP route on identity-vessel:

```
POST /v1/auth/resolve-context
  Headers: Authorization: Bearer {VESSEL_BOOTSTRAP_KEY}
  Body:    { vessel_id, advertised_shapes, requested_scopes }
  Returns: { substrate_identity: {...}, vessel_credentials: {...} }
```

Server-side, this dispatches `issue-vessel-credentials` and
attaches the current `substrateIdentity` record. The vessel
receives both in one round trip.

## G. Bootstrap-key lifecycle

How does a fresh vessel get its `VESSEL_BOOTSTRAP_KEY`?

For the **first vessel of a fresh substrate** (identity-vessel
itself, or whichever vessel mints first):
- Operator generates a bootstrap key offline (random bytes), passes
  it to identity-vessel's init as `INITIAL_BOOTSTRAP_KEY`.
- Identity-vessel uses it once to self-attest, then issues its
  own real credentials.

For **subsequent vessels**:
- Operator (or a substrate-resident activity) calls identity-vessel
  to issue a fresh bootstrap key.
- The key is delivered to the new vessel via the deployment
  mechanism (systemd Environment file, Docker env, K8s Secret —
  whatever the substrate uses for env-var injection).
- The vessel boots, consumes the key, has real credentials.

For **vessels minted by the self-replacement pipeline**:
- The pipeline's `register-provisional-vessel` step calls
  identity-vessel's `issue-vessel-credentials` directly with a
  `provisional: true` scope. The provisional vessel receives a
  short-lived, narrowly-scoped credential immediately — no
  bootstrap key dance for substrate-minted vessels, since the
  substrate already authenticated the minting context.

This is the spec-aligned closure of the credential gap in
`2026-05-23-substrate-self-replacement-pipeline` (R3 of that spec
hand-waves about credentials; this design pins it down).

## H. What identity-vessel needs to add

Today identity-vessel:
- Validates API keys.
- Issues JWTs.
- Serves `/v1/auth/resolve` for credential validation.

After this change, additionally:
- Owns the `substrateIdentity` record (one row in a new
  `substrate_identity` table).
- Serves `/v1/auth/resolve-context` — the bootstrap endpoint.
- Generates and signs `bootstrapAttestation` records.
- Marks bootstrap keys consumed; refuses reuse.

The expansion is small. The hardest part is making the
substrateIdentity record the source of truth that all
JWT-issuance code reads from, instead of the literal
`'https://identity.metabob.com'` it reads today.

## I. Failure modes

| Failure | `failure_mode.type` | Boot behaviour |
|---|---|---|
| `SUBSTRATE_IDENTITY_URL` missing | `verifier_negative` (config) | Vessel exits within 5s with clear error |
| `VESSEL_BOOTSTRAP_KEY` missing on a vessel that needs credentials | `verifier_negative` (config) | Vessel exits within 5s |
| Identity-vessel unreachable at boot | `cascading` (network) | Vessel retries with exponential backoff up to N attempts, then exits |
| Bootstrap key invalid or expired | `verifier_negative` (auth) | Vessel exits; operator must reissue key |
| Bootstrap key already consumed | `safety_breach` (replay) | Vessel exits; emits warning; operator investigates |
| substrateIdentity record missing | `cascading` (substrate not bootstrapped) | Vessel exits; operator runs `mint-substrate-identity` |

The "exits within 5s with clear error" requirement is the
operational improvement: no silent fallback to a defunct
deployment. Boot becomes diagnosable.

## J. Migration path for existing vessels

Three-step rollout:

1. **Add the new endpoint** to identity-vessel; ship; verify
   `resolve-substrate-context` works against existing canary
   substrate.
2. **Update vessels one at a time** to use the new flow. Each
   vessel's update: delete the hardcoded default, require env, hit
   the new endpoint. Vessels not yet updated continue to work via
   their env-var overrides (the current substrate-only direction
   already sets the env vars; the defaults are dead code).
3. **Delete the dead defaults** in one sweep after every vessel is
   migrated. Grep for `metabob.com` and `.svc.cluster.local`;
   confirm zero matches.

Existing credentials issued before this change keep working — the
new flow is additive. Future credentials issued via
`issue-vessel-credentials` carry the new substrate-binding
metadata.

## K. What this enables downstream

- **`provider-credentials-as-impulse`** can ship next, hanging
  provider keys off the same identity-vessel infrastructure.
- **`substrate-self-replacement-pipeline`** gets a credential
  story for provisional vessels (design §G above).
- **`vessel-federation`** has a substrate-identity record to
  exchange between substrates during handshake.
- **`closure-audit`** can audit the substrate's own
  self-identification as a black-box property: launch a fresh
  substrate, supply two env vars, see if it boots.

## L. Trade-offs taken

**Two env vars vs one.** Considered a single combined env var
encoding URL + key. Rejected because (a) URL and key have
different rotation cadences, (b) URL is non-secret and key is
secret, conflating them makes the secret-handling story worse.

**identity-vessel owns vs new substrate-identity-vessel.**
Considered minting a new vessel for substrate identity.
Rejected because identity-vessel already owns substrate-related
auth state; a separate vessel would have to coordinate with it
for every credential check. The single-vessel approach is simpler
and identity-vessel's role expansion is small.

**HMAC bootstrap keys vs asymmetric.** Considered using a
public-key bootstrap (vessel generates keypair, posts pubkey, gets
attestation). Rejected for this round because HMAC matches the
existing identity-vessel API-key format and reuses existing
verification code. Asymmetric is the right long-term move per H2
of `security-hardening-findings` (pubkey-multihash vessel
identity), but H2 is a bigger change and out of scope here.

**Mint activity as one-shot vs continually available.** The mint
activity could run multiple times to re-mint the substrate identity
(e.g., key rotation). Rejected for this scope: rotation is a
separate spec, and one-shot semantics make the substrate's identity
immutable, which is the right property for trust anchoring.

**Survive identity-vessel downtime.** If identity-vessel is down at
boot, the vessel cannot start. Considered caching the most-recent
substrateIdentity on disk so vessels survive identity outages.
Rejected: it reintroduces the "stale default" problem; better to
have substrate-wide unavailability when identity is down than
silent drift across vessels.
