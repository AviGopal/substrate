// INBOUND AUTHENTICATION FOR THE OVERLAY (operator exception: inbound authentication only).
//
// The libp2p ingress used to authorize nothing: it resolved every request with this transport's own key, so anyone who
// could dial got whatever the transport could reach (peer ids are sha256 of a guessable vesselId; Noise gives
// confidentiality, not authorization). This module holds the pure parts of the fix so they can be judged hermetically:
//
//   - stripCredentials: the caller's credential travels in the pointer envelope (_fedAuth) and is removed from the
//     pointer BEFORE anything logs, resolves, traces or echoes it. The retired shared-key alias _auth is removed too and
//     is never a credential.
//   - decideIngress: PUBLIC shapes need nothing; every other shape needs an on-behalf-of token identity validates for
//     THIS node and THIS shape. A raw key is refused (no raw credential crosses the overlay). A validator that cannot be
//     reached refuses (fail closed) and says so, so an outage never reads as a bad credential.
//   - makeValidator: identity's /v1/auth/resolve, stating the audience <this transport's peer id>/<shape>, with a bounded
//     cache keyed by sha256(credential, audience): positive 60 s, negative 10 s. The cache can be switched off per call.
//   - resolveMode: the mode is a SHAPED per-node policy record (fedIngressAuthPolicy) read at use time, never an env var
//     (law 1). Absent or unreadable means `off` only until this node has once read `enforce`; after that it means
//     `enforce` (a ratchet, recorded in a sentinel file). The one env input is the named emergency rollback.
//   - oboAudience / makeOboMinter / pointerForDial: the caller's own key never crosses. For each dial the SENDING
//     transport asks identity for an on-behalf-of token bound to the destination's peer id (the /p2p/ id the dial
//     authenticates) and to the one shape, and only that token goes in the pointer.
import { createHash } from 'node:crypto'

export type Mode = 'off' | 'log' | 'enforce'
// PUBLIC needs no key. substrateBootstrap: a node joins knowing only a multiaddr. federation_probe and federation_echo:
// the overlay's own control shapes, which the seed allowlist (federation-transport-server.ts) names because refusing
// them "would break the overlay itself". The independent probe (federation-probe-tick) is a stranger peer by design,
// so it carries no key. probe returns a constant and echo returns the caller's own payload, so neither exposes
// substrate data. federation_verification_report stays credentialed: it names which checks fail.
export const PUBLIC_SHAPES: ReadonlySet<string> = new Set(['substrateBootstrap', 'federation_probe', 'federation_echo'])
// The largest payload federation_echo returns. Twice the probe's largest class (P5_64k, 65,536 bytes), so a sweep is
// never refused while a public echo cannot be used to move bulk data.
export const ECHO_MAX_BYTES = 131072
// The per-peer rate bound on the public echo. It follows the transport's redial limiter (a time-window gate), but per
// peer: a peer may echo ECHO_RATE_MAX times per ECHO_RATE_WINDOW_MS. One probe sweep sends about 30 echoes from a
// fresh ephemeral peer id, so 60 per minute never refuses a sweep. Echo reflects only to its caller (amplification is
// at most 1x), so the bound limits load from unauthenticated peers, not reflection. A peer that changes its id each
// burst is not bounded by this; that would need a global cap.
export const ECHO_RATE_MAX = 60
export const ECHO_RATE_WINDOW_MS = 60_000
export type EchoRateRefusal = { error: string; shape: 'federation_echo'; reason: 'rate_limited'; max: number; window_ms: number; retry_after_ms: number }
/** A per-peer gate: returns null to allow, or the refusal naming the bound. `now` is injectable for tests. */
export function makeEchoRateGate(max = ECHO_RATE_MAX, windowMs = ECHO_RATE_WINDOW_MS, now: () => number = Date.now, maxPeers = 1024) {
  const seen = new Map<string, { start: number; count: number }>()
  return (peer: string): EchoRateRefusal | null => {
    const t = now()
    let w = seen.get(peer)
    if (!w || t - w.start >= windowMs) {
      if (!w && seen.size >= maxPeers) { for (const [k, v] of seen) if (t - v.start >= windowMs) seen.delete(k) }
      w = { start: t, count: 0 }
      seen.set(peer, w)
    }
    w.count += 1
    return w.count > max
      ? { error: `federation_echo rate bound: at most ${max} per ${windowMs} ms per peer`, shape: 'federation_echo', reason: 'rate_limited', max, window_ms: windowMs, retry_after_ms: Math.max(0, w.start + windowMs - t) }
      : null
  }
}
/** null when an echo payload of `len` bytes is within the bound, else the refusal that names the bound. */
export function echoRefusal(len: number): { error: string; shape: 'federation_echo'; reason: 'payload_too_large'; len: number; max_bytes: number } | null {
  return len > ECHO_MAX_BYTES
    ? { error: `federation_echo payload of ${len} bytes exceeds the ${ECHO_MAX_BYTES}-byte bound`, shape: 'federation_echo', reason: 'payload_too_large', len, max_bytes: ECHO_MAX_BYTES }
    : null
}
export const CREDENTIAL_FIELDS = ['_fedAuth', '_auth'] as const

export interface Principal { org_id: string; user_id: string; key_hash: string; key_id: string }
export type Validation =
  | { valid: true; principal: Principal }
  | { valid: false; reason: 'invalid' | 'validator_unreachable' }
/** The node and shape a validator serves: this transport's own peer id, and the shape of the request. */
export interface Audience { node: string; shape: string }
export type Validate = (credential: string, audience: Audience) => Promise<Validation>
export interface Decision { allow: boolean; reason: 'public' | 'valid' | 'absent' | 'not_obo' | 'invalid' | 'validator_unreachable'; principal?: Principal }

export const keyHash = (k: string): string => createHash('sha256').update(k).digest('hex').slice(0, 12)

/**
 * A copy of the pointer without any credential field, and the credential it carried. Only _fedAuth is a credential; the
 * retired shared-key alias _auth is dropped like it and read by nothing. `carried` says whether the frame held either
 * field, for the presence flag in the ingress log.
 */
export function stripCredentials(pointer: unknown): { pointer: Record<string, unknown>; credential: string | null; carried: boolean } {
  const src = pointer && typeof pointer === 'object' ? (pointer as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  let carried = false
  for (const [k, v] of Object.entries(src)) if (!(CREDENTIAL_FIELDS as readonly string[]).includes(k)) out[k] = v; else carried = true
  const fed = typeof src._fedAuth === 'string' && src._fedAuth.trim() ? src._fedAuth.trim() : null
  return { pointer: out, credential: fed, carried }
}

/** The on-behalf-of token in a `Bearer <token>` credential, or null for anything else (a raw key included). */
export const oboToken = (credential: string): string | null => {
  const m = /^Bearer\s+(\S+)\s*$/.exec(credential)
  return m ? m[1]! : null
}

/**
 * Allow or refuse one overlay request. `self` is this transport's own peer id (the libp2p node's, never config): the
 * token must have been minted for it and for this shape. A credential that is not an on-behalf-of token is refused
 * without asking identity: a raw key on the overlay is the bearer credential this design keeps off the wire.
 */
export async function decideIngress(shape: string, credential: string | null, self: string, validate: Validate): Promise<Decision> {
  if (PUBLIC_SHAPES.has(shape)) return { allow: true, reason: 'public' }
  if (!credential) return { allow: false, reason: 'absent' }
  if (!oboToken(credential)) return { allow: false, reason: 'not_obo' }
  let v: Validation
  try { v = await validate(credential, { node: self, shape }) } catch { v = { valid: false, reason: 'validator_unreachable' } }
  if (v.valid) return { allow: true, reason: 'valid', principal: v.principal }
  return { allow: false, reason: v.reason }
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>
export interface ValidatorOptions { identityUrl: () => string; fetchImpl: Fetch; now?: () => number; cacheEnabled?: () => boolean; positiveMs?: number; negativeMs?: number; max?: number; timeoutMs?: number }

/**
 * identity POST /v1/auth/resolve (nested form) with the audience stated, cached by sha256(credential, audience). Valid
 * only when identity answers an on-behalf-of binding (data.obo): a session JWT identity accepts is still not a federation
 * credential. A 401/403 is invalid; any other non-2xx, or a thrown fetch, is validator_unreachable.
 */
export function makeValidator(o: ValidatorOptions): Validate {
  const now = o.now ?? (() => Date.now())
  const pos = o.positiveMs ?? 60_000, neg = o.negativeMs ?? 10_000, max = o.max ?? 512
  const cache = new Map<string, { at: number; v: Validation }>()
  return async (credential: string, audience: Audience): Promise<Validation> => {
    const token = oboToken(credential)
    if (!token) return { valid: false, reason: 'invalid' }
    const h = createHash('sha256').update(credential).update('\n' + audience.node + '/' + audience.shape).digest('hex')
    const useCache = o.cacheEnabled ? o.cacheEnabled() : true
    if (useCache) {
      const hit = cache.get(h)
      if (hit && now() - hit.at < (hit.v.valid ? pos : neg)) return hit.v
    }
    const base = o.identityUrl().replace(/\/$/, '')
    if (!base) return { valid: false, reason: 'validator_unreachable' }
    let v: Validation
    try {
      const r = await o.fetchImpl(base + '/v1/auth/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ impulse: { type: 'authentication', pointer: { type: 'session', token, audience } } }),
        signal: AbortSignal.timeout(o.timeoutMs ?? 5_000),
      })
      if (r.status === 401 || r.status === 403) v = { valid: false, reason: 'invalid' }
      else if (!r.ok) return { valid: false, reason: 'validator_unreachable' }
      else {
        const d = ((await r.json()) as { data?: Record<string, unknown> })?.data ?? {}
        const obo = d.obo as Record<string, unknown> | undefined
        v = d.authenticated === true && obo && obo.node === audience.node && obo.shape === audience.shape
          ? { valid: true, principal: { org_id: String(d.orgId ?? ''), user_id: String(d.userId ?? ''), key_hash: keyHash(credential), key_id: String(d.keyId ?? '') } }
          : { valid: false, reason: 'invalid' }
      }
    } catch { return { valid: false, reason: 'validator_unreachable' } }
    if (useCache) {
      if (cache.size >= max) cache.delete(cache.keys().next().value as string)
      cache.set(h, { at: now(), v })
    }
    return v
  }
}

/** cache: false switches the identity-validation cache off (a measurement knob, shaped like the mode, never an env var). */
export interface Policy { mode: Mode; cache: boolean }
const isMode = (m: unknown): m is Mode => m === 'off' || m === 'log' || m === 'enforce'

/** Parse the open fedIngressAuthPolicy record body; anything malformed is null (treated as unreadable). */
export function parsePolicy(body: unknown): Policy | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!isMode(b.mode)) return null
  return { mode: b.mode, cache: b.cache !== false }
}

const RANK: Record<Mode, number> = { off: 0, log: 1, enforce: 2 }

/**
 * The effective mode. emergencyOff is the named bootstrap exception (an env rollback that needs no record). Otherwise the
 * ratchet is a floor: once this node has read `enforce`, it stays `enforce`. A readable record can RAISE the mode above
 * the floor, never lower it, so a record (seeded or written) cannot downgrade a node that once enforced.
 */
export function resolveMode(policy: Policy | null, ratchetSeen: boolean, emergencyOff: boolean): Mode {
  if (emergencyOff) return 'off'
  const floor: Mode = ratchetSeen ? 'enforce' : 'off'
  if (!policy) return floor
  return RANK[policy.mode] >= RANK[floor] ? policy.mode : floor
}

/**
 * The policy from records: the latest fedIngressAuthPolicy row the OWNER wrote. A row any other role wrote (person,
 * operator, walk) is not the policy. No owner row, or a malformed one, is null: unreadable, so the ratchet decides.
 *
 * Only the mode and the cache knob are read. records takes an owner role from the node key, and every vessel on the node
 * holds that key, so the row decides nothing that resolveMode would not let only rise above the ratchet.
 */
export function policyFromRecordsRows(rows: unknown): Policy | null {
  if (!Array.isArray(rows)) return null
  const owned = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && (r as Record<string, unknown>).role === 'owner')
  const latest = owned.reduce<Record<string, unknown> | null>((a, r) => (!a || Number(r.seq) > Number(a.seq) ? r : a), null)
  return latest ? parsePolicy(latest) : null
}

/** The final /p2p/<id> component of a multiaddr (the destination peer of a circuit address), or null. */
export function destinationPeer(target: string): string | null {
  const parts = String(target || '').split('/p2p/')
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]!.split('/')[0]!.trim()
  return last || null
}

/** How long a token the sending transport asks for lives: one dial and one identity round trip at the far end. */
export const OBO_TTL_SECONDS = 30

/**
 * The audience a token for this dial is bound to: the peer id in the DIALED address (the one the libp2p handshake
 * authenticates; a discovery row's own peer-id field is never read, since a row can be written under the node key) and
 * the shape being resolved. null when the address names no peer or the pointer no shape: then nothing is minted.
 */
export function oboAudience(address: string, pointer: unknown): Audience | null {
  const node = destinationPeer(address)
  const shape = pointer && typeof pointer === 'object' ? String((pointer as Record<string, unknown>).type ?? '') : ''
  return node && shape ? { node, shape } : null
}

export type Mint = (callerKey: string, audience: Audience) => Promise<string | null>
export interface MinterOptions { identityUrl: () => string; actorKey: () => string; fetchImpl: Fetch; timeoutMs?: number }

/**
 * identity POST /v1/auth/on-behalf-of: this transport is the actor (its own key), the caller is the key the local caller
 * presented. Returns the token, or null on any refusal or failure (then the dial carries no credential and the far end
 * refuses it as absent). Never throws, and never returns the caller's key.
 */
export function makeOboMinter(o: MinterOptions): Mint {
  return async (callerKey: string, audience: Audience): Promise<string | null> => {
    const base = o.identityUrl().replace(/\/$/, '')
    const actor = o.actorKey()
    if (!base || !actor || !callerKey) return null
    try {
      const r = await o.fetchImpl(base + '/v1/auth/on-behalf-of', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + actor },
        body: JSON.stringify({ caller: 'ApiKey ' + callerKey, audience, ttl_seconds: OBO_TTL_SECONDS }),
        signal: AbortSignal.timeout(o.timeoutMs ?? 5_000),
      })
      if (!r.ok) return null
      const token = ((await r.json()) as { data?: { token?: unknown } })?.data?.token
      return typeof token === 'string' && token && token !== callerKey ? token : null
    } catch { return null }
  }
}

/**
 * The pointer to send: every credential field the pointer carried (_fedAuth, and the retired _auth) is removed, and the
 * on-behalf-of token minted for this dial, if any, is attached as `Bearer <token>`. Nothing else is ever attached.
 */
export function pointerForDial(pointer: unknown, obo: string | null): Record<string, unknown> {
  const { pointer: out } = stripCredentials(pointer)
  return obo ? { ...out, _fedAuth: 'Bearer ' + obo } : out
}

/** A local caller may not smuggle a _fedAuth into the pointer: dropped at every local entry, before any log or proxy. */
export function withoutFedAuth(pointer: unknown): Record<string, unknown> {
  const src = pointer && typeof pointer === 'object' ? (pointer as Record<string, unknown>) : {}
  const { _fedAuth: _drop, ...rest } = src
  return rest
}

/**
 * The caller's key from its own `Authorization: ApiKey <k>` header, or null. Only what the caller sent is ever minted
 * for: a caller with no header gets no token, a Bearer session gets none (the session branch is a separate change), and
 * the transport never substitutes its own key for a missing one.
 */
export function callerKeyFromHeader(h: string | null): string | null {
  const m = /^ApiKey\s+(\S+)\s*$/i.exec(String(h ?? ''))
  return m ? m[1]! : null
}
