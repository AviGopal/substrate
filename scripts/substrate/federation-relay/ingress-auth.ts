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
//     cache keyed by sha256(credential, audience): a positive answer is kept at most 60 s and never past the token's own
//     expiry, a negative one 10 s. The cache can be switched off per call.
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
  const cache = new Map<string, { until: number; v: Validation }>()
  return async (credential: string, audience: Audience): Promise<Validation> => {
    const token = oboToken(credential)
    if (!token) return { valid: false, reason: 'invalid' }
    const h = createHash('sha256').update(credential).update('\n' + audience.node + '/' + audience.shape).digest('hex')
    const useCache = o.cacheEnabled ? o.cacheEnabled() : true
    if (useCache) {
      const hit = cache.get(h)
      if (hit && now() < hit.until) return hit.v
    }
    const base = o.identityUrl().replace(/\/$/, '')
    if (!base) return { valid: false, reason: 'validator_unreachable' }
    let v: Validation
    // How long a positive answer may be reused: never past the token's own expiry (identity answers it), so a token is not
    // accepted after it lapses; with no readable expiry, not at all.
    let expires = 0
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
        const e = Date.parse(String(obo?.expires_at ?? ''))
        expires = Number.isFinite(e) ? e : 0
      }
    } catch { return { valid: false, reason: 'validator_unreachable' } }
    const until = v.valid ? Math.min(now() + pos, expires) : now() + neg
    if (useCache && until > now()) {
      if (cache.size >= max) cache.delete(cache.keys().next().value as string)
      cache.set(h, { until, v })
    }
    return v
  }
}

/**
 * cache: false switches the identity-validation cache off (a measurement knob, shaped like the mode, never an env var).
 * reservation_probe_s paces the relay reservation probe (seconds, clamped to 60..3600; absent = the default).
 */
export interface Policy { mode: Mode; cache: boolean; reservation_probe_s?: number }
const isMode = (m: unknown): m is Mode => m === 'off' || m === 'log' || m === 'enforce'

/** Parse the open fedIngressAuthPolicy record body; anything malformed is null (treated as unreadable). */
export function parsePolicy(body: unknown): Policy | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!isMode(b.mode)) return null
  const pace = typeof b.reservation_probe_s === 'number' && Number.isFinite(b.reservation_probe_s) ? { reservation_probe_s: b.reservation_probe_s } : {}
  return { mode: b.mode, cache: b.cache !== false, ...pace }
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

/** True for a dial the relay refused for the destination (no reservation, or no relay↔destination connection). */
export const isRelayRefusal = (res: unknown): boolean =>
  !!res && typeof res === 'object' && /NO_RESERVATION|failed to connect via relay/i.test(String((res as { error?: unknown }).error ?? ''))

/**
 * Where a forward to a registered libp2p row is tried, in order: the row's own first address (its circuit, as
 * registered); then any LIVE connection this node already holds to the same destination peer through a relay (a
 * reservation the registered circuit no longer reaches can still have a working circuit, which is why reads got
 * through while a write's single dial was refused); then the row's other addresses (its direct listen addrs). Each
 * address once, at most 6. The destination is the /p2p/ peer of the first address, and EVERY address tried must name
 * that same peer as its final /p2p/ (the one the dial authenticates): a row address naming another peer would get a
 * token minted for that peer and the forward with it, and one naming no peer would go to whatever answers there. A row
 * is written by the node that registered it, so its later addresses are not trusted to stay on its own peer.
 */
export function forwardAddresses(row: unknown, live: readonly string[]): string[] {
  const addrs = (Array.isArray((row as { libp2p_multiaddr?: unknown })?.libp2p_multiaddr) ? ((row as { libp2p_multiaddr: unknown[] }).libp2p_multiaddr) : [])
    .map(String).filter((a) => a.length > 0)
  if (addrs.length === 0) return []
  const dest = destinationPeer(addrs[0]!)
  if (!dest) return [addrs[0]!]
  const sameDest = live.map(String).filter((a) => a.includes('/p2p-circuit/') && destinationPeer(a) === dest)
  const ownRest = addrs.slice(1).filter((a) => destinationPeer(a) === dest)
  return [...new Set([addrs[0]!, ...sameDest, ...ownRest])].slice(0, 6)
}

// ── THE RELAY'S OWN ANSWER ABOUT OUR RESERVATION (circuit relay v2, HOP) ──────────────────────────────────────────
// A node's reservation store will not ask the relay again while it believes an unexpired reservation is held, so a
// relay that dropped it (a failed confirmation close, a restart) leaves the node advertising a circuit every dialer is
// refused NO_RESERVATION on, for up to the reservation's TTL. The probe asks the relay itself: a RESERVE on the existing
// relay connection, which the relay treats as a refresh of a reservation it holds. Only the two messages the probe
// needs are encoded here, from the spec (a varint length, then fields as protobuf): the package does not export them.
export const HOP_STATUS: Readonly<Record<number, string>> = {
  0: 'UNUSED', 100: 'OK', 200: 'RESERVATION_REFUSED', 201: 'RESOURCE_LIMIT_EXCEEDED', 202: 'PERMISSION_DENIED',
  203: 'CONNECTION_FAILED', 204: 'NO_RESERVATION', 400: 'MALFORMED_MESSAGE', 401: 'UNEXPECTED_MESSAGE',
}
/** HopMessage { type: RESERVE } with its varint length prefix. */
export const HOP_RESERVE_FRAME = Uint8Array.of(0x02, 0x08, 0x00)
const varint = (b: Uint8Array, p: number): [number, number] | null => {
  let v = 0n, shift = 0n
  for (let i = p; i < b.length && i < p + 10; i++) {
    v |= BigInt(b[i]! & 0x7f) << shift
    if ((b[i]! & 0x80) === 0) return [Number(v), i + 1]
    shift += 7n
  }
  return null
}
/** One length-prefixed HOP message body from the bytes read so far, or null while it is incomplete. */
export function hopFrameFrom(acc: Uint8Array): Uint8Array | null {
  const h = varint(acc, 0)
  if (!h) return null
  const [len, at] = h
  return acc.length >= at + len ? acc.subarray(at, at + len) : null
}
/** The type, status and reservation expire (seconds since the epoch) of a HopMessage body; unknown fields skipped. */
export function decodeHopStatus(b: Uint8Array): { type?: number; status?: number; expire?: number } {
  const out: { type?: number; status?: number; expire?: number } = {}
  for (let p = 0; p < b.length; ) {
    const k = varint(b, p)
    if (!k) break
    const [key, q] = k
    const field = key >>> 3, wire = key & 7
    if (wire === 0) {
      const v = varint(b, q)
      if (!v) break
      if (field === 1) out.type = v[0]
      if (field === 5) out.status = v[0]
      p = v[1]
    } else if (wire === 2) {
      const l = varint(b, q)
      if (!l) break
      const body = b.subarray(l[1], l[1] + l[0])
      if (field === 3) {
        for (let r = 0; r < body.length; ) {
          const rk = varint(body, r)
          if (!rk) break
          if ((rk[0] & 7) === 0) { const v = varint(body, rk[1]); if (!v) break; if (rk[0] >>> 3 === 1) out.expire = v[0]; r = v[1] }
          else if ((rk[0] & 7) === 2) { const rl = varint(body, rk[1]); if (!rl) break; r = rl[1] + rl[0] }
          else break
        }
      }
      p = l[1] + l[0]
    } else break
  }
  return out
}
/** How often the probe runs: the policy row's reservation_probe_s, clamped to 60..3600 s, else 600 s. */
export const reservationProbeMs = (policy: Policy | null): number => {
  const s = policy?.reservation_probe_s
  return 1000 * (typeof s === 'number' && Number.isFinite(s) ? Math.min(3600, Math.max(60, s)) : 600)
}
export interface ProbeDeps {
  /** A new HOP stream on the existing relay connection (send(bytes), async-iterable chunks, close()), or null if none. */
  openHop: () => Promise<{ send: (b: Uint8Array) => unknown; close: () => Promise<unknown>; [Symbol.asyncIterator]: () => AsyncIterator<unknown> } | null>
  redial: (why: string) => Promise<unknown>
  log: (line: string) => void
  now?: () => number
  /** How long to wait for the relay's answer before taking it as none (default 10 s). */
  timeoutMs?: number
}
/**
 * Ask the relay once whether it holds our reservation. OK: one fact line with the relay's expire. Anything else (another
 * status, no answer, a stream error): one line saying what the relay answered, and a re-dial, so a fresh reservation is
 * made. No relay connection: nothing to ask. Never throws; returns what it found.
 */
export async function probeReservationOnce(d: ProbeDeps): Promise<'held' | 'redialed' | 'no-connection'> {
  const now = d.now ?? (() => Date.now())
  let answer: { status?: number; expire?: number } | null = null
  let why = ''
  let stream: Awaited<ReturnType<ProbeDeps['openHop']>> = null
  try {
    stream = await d.openHop()
    if (!stream) return 'no-connection'
    stream.send(HOP_RESERVE_FRAME)
    const read = (async () => {
      let acc = new Uint8Array(0)
      for await (const chunk of stream as AsyncIterable<unknown>) {
        const c = chunk instanceof Uint8Array ? chunk : (chunk as { subarray: () => Uint8Array }).subarray()
        const next = new Uint8Array(acc.length + c.length); next.set(acc); next.set(c, acc.length); acc = next
        const body = hopFrameFrom(acc)
        if (body) return decodeHopStatus(body)
      }
      return null
    })()
    const limit = d.timeoutMs ?? 10_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<'late'>((r) => { timer = setTimeout(() => r('late'), limit) })
    const got = await Promise.race([read, late])
    clearTimeout(timer)
    if (got === 'late') why = `no answer within ${Math.round(limit / 1000)} s`
    else if (!got) why = 'no answer'
    else answer = got
  } catch (e) {
    why = 'stream error: ' + String((e as Error)?.message ?? e).replace(/[^A-Za-z0-9 _.:-]/g, '?').slice(0, 80)
  } finally {
    if (stream) await stream.close().catch(() => {})
  }
  if (answer?.status === 100) {
    const left = answer.expire ? Math.max(0, Math.round(answer.expire - now() / 1000)) : null
    d.log(`[federation] reservation probe: the relay holds it${left === null ? '' : ` (expires in ${left} s)`}`)
    return 'held'
  }
  const said = why || `status ${HOP_STATUS[answer?.status ?? -1] ?? String(answer?.status)}`
  d.log(`[federation] reservation probe: the relay answered ${said}; re-dialing for a fresh reservation`)
  await d.redial('reservation probe: ' + said).catch(() => {})
  return 'redialed'
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
export interface MinterOptions { identityUrl: () => string; actorKey: () => string; fetchImpl: Fetch; timeoutMs?: number; log?: (line: string) => void; now?: () => number }

/**
 * identity POST /v1/auth/on-behalf-of: this transport is the actor (its own key), the caller is the key the local caller
 * presented. Returns the token, or null on any refusal or failure (then the dial carries no credential and the far end
 * refuses it as absent). Never throws, and never returns the caller's key.
 *
 * A mint that yields no token says why, once a minute per status: the HTTP status identity answered, unreachable (no
 * answer), no_identity (no identity URL or no key of its own), or no_token (an answer with no usable token). Without
 * it a refused mint and a caller with no key both read only as "absent" at the far end. The line names the shape and
 * the destination peer's tail, never a key or a token.
 */
export function makeOboMinter(o: MinterOptions): Mint {
  const now = o.now ?? (() => Date.now())
  const said = new Map<string, number>()
  const refused = (status: string, audience: Audience): null => {
    const t = now()
    const last = said.get(status)
    if (o.log && (last === undefined || t - last >= 60_000)) {
      said.set(status, t)
      o.log(`[fed-egress] obo mint refused status=${status} shape=${audience.shape.replace(/[^A-Za-z0-9_.:-]/g, '?').slice(0, 64)} peer=…${audience.node.slice(-8)}`)
    }
    return null
  }
  return async (callerKey: string, audience: Audience): Promise<string | null> => {
    const base = o.identityUrl().replace(/\/$/, '')
    const actor = o.actorKey()
    if (!callerKey) return null
    if (!base || !actor) return refused('no_identity', audience)
    try {
      const r = await o.fetchImpl(base + '/v1/auth/on-behalf-of', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + actor },
        body: JSON.stringify({ caller: 'ApiKey ' + callerKey, audience, ttl_seconds: OBO_TTL_SECONDS }),
        signal: AbortSignal.timeout(o.timeoutMs ?? 5_000),
      })
      if (!r.ok) return refused(String(r.status), audience)
      // An answer that is not JSON is identity answering, not identity unreachable.
      const token = ((await r.json().catch(() => null)) as { data?: { token?: unknown } } | null)?.data?.token
      return typeof token === 'string' && token && token !== callerKey ? token : refused('no_token', audience)
    } catch { return refused('unreachable', audience) }
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
