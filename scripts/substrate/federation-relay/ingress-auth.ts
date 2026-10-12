// INBOUND AUTHENTICATION FOR THE OVERLAY (operator exception, user ruling 2026-10-12: inbound authentication only).
//
// The libp2p ingress used to authorize nothing: it resolved every request with this transport's own key, so anyone who
// could dial got whatever the transport could reach (peer ids are sha256 of a guessable vesselId; Noise gives
// confidentiality, not authorization). This module holds the pure parts of the fix so they can be judged hermetically:
//
//   - stripCredentials: the caller's credential travels in the pointer envelope (_fedAuth; _auth is the transitional alias
//     the registry shapes used) and is removed from the pointer BEFORE anything logs, resolves, traces or echoes it.
//   - decideIngress: PUBLIC shapes need nothing; every other shape needs a credential identity validates. A validator that
//     cannot be reached refuses (fail closed) and says so, so an outage never reads as a bad key.
//   - makeValidator: identity's POST /v1/keys/validate, with a bounded cache keyed by sha256(key): positive 60 s (so a
//     revoked key keeps working at most 60 s: accepted), negative 10 s. The cache can be switched off per call.
//   - resolveMode: the mode is a SHAPED per-node policy record (fedIngressAuthPolicy) read at use time, never an env var
//     (law 1). Absent or unreadable means `off` only until this node has once read `enforce`; after that it means
//     `enforce` (a ratchet, recorded in a sentinel file). The one env input is the named emergency rollback.
//   - shouldAttachCredential / pointerForDial: the caller's raw key is a bearer credential. It is sent ONLY to a destination
//     peer that validates against the same identity authority that issued it (the policy's same_authority_peers), decided
//     per dial address; an unknown destination gets nothing, and nothing re-attaches a key on an ingress-originated hop.
import { createHash } from 'node:crypto'

export type Mode = 'off' | 'log' | 'enforce'
export const PUBLIC_SHAPES: ReadonlySet<string> = new Set(['substrateBootstrap'])
export const CREDENTIAL_FIELDS = ['_fedAuth', '_auth'] as const

export interface Principal { org_id: string; user_id: string; key_hash: string }
export type Validation =
  | { valid: true; principal: Principal }
  | { valid: false; reason: 'invalid' | 'validator_unreachable' }
export type Validate = (key: string) => Promise<Validation>
export interface Decision { allow: boolean; reason: 'public' | 'valid' | 'absent' | 'invalid' | 'validator_unreachable'; principal?: Principal }

export const keyHash = (k: string): string => createHash('sha256').update(k).digest('hex').slice(0, 12)

/** A copy of the pointer without any credential field, and the credential it carried (_fedAuth wins over _auth). */
export function stripCredentials(pointer: unknown): { pointer: Record<string, unknown>; credential: string | null; legacyAuth: string | null } {
  const src = pointer && typeof pointer === 'object' ? (pointer as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) if (!(CREDENTIAL_FIELDS as readonly string[]).includes(k)) out[k] = v
  const fed = typeof src._fedAuth === 'string' && src._fedAuth.trim() ? src._fedAuth.trim() : null
  const legacy = typeof src._auth === 'string' && src._auth.trim() ? src._auth.trim() : null
  return { pointer: out, credential: fed ?? legacy, legacyAuth: legacy }
}

export async function decideIngress(shape: string, credential: string | null, validate: Validate): Promise<Decision> {
  if (PUBLIC_SHAPES.has(shape)) return { allow: true, reason: 'public' }
  if (!credential) return { allow: false, reason: 'absent' }
  let v: Validation
  try { v = await validate(credential) } catch { v = { valid: false, reason: 'validator_unreachable' } }
  if (v.valid) return { allow: true, reason: 'valid', principal: v.principal }
  return { allow: false, reason: v.reason }
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>
export interface ValidatorOptions { identityUrl: () => string; fetchImpl: Fetch; now?: () => number; cacheEnabled?: () => boolean; positiveMs?: number; negativeMs?: number; max?: number; timeoutMs?: number }

/** identity POST /v1/keys/validate, cached by sha256(key). A non-2xx or a thrown fetch is validator_unreachable, never invalid. */
export function makeValidator(o: ValidatorOptions): Validate {
  const now = o.now ?? (() => Date.now())
  const pos = o.positiveMs ?? 60_000, neg = o.negativeMs ?? 10_000, max = o.max ?? 512
  const cache = new Map<string, { at: number; v: Validation }>()
  return async (key: string): Promise<Validation> => {
    const h = createHash('sha256').update(key).digest('hex')
    const useCache = o.cacheEnabled ? o.cacheEnabled() : true
    if (useCache) {
      const hit = cache.get(h)
      if (hit && now() - hit.at < (hit.v.valid ? pos : neg)) return hit.v
    }
    const base = o.identityUrl().replace(/\/$/, '')
    if (!base) return { valid: false, reason: 'validator_unreachable' }
    let v: Validation
    try {
      const r = await o.fetchImpl(base + '/v1/keys/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key }), signal: AbortSignal.timeout(o.timeoutMs ?? 5_000) })
      if (!r.ok) return { valid: false, reason: 'validator_unreachable' }
      const d = ((await r.json()) as { data?: Record<string, unknown> })?.data ?? {}
      v = d.valid === true
        ? { valid: true, principal: { org_id: String(d.org_id ?? ''), user_id: String(d.user_id ?? ''), key_hash: keyHash(key) } }
        : { valid: false, reason: 'invalid' }
    } catch { return { valid: false, reason: 'validator_unreachable' } }
    if (useCache) {
      if (cache.size >= max) cache.delete(cache.keys().next().value as string)
      cache.set(h, { at: now(), v })
    }
    return v
  }
}

/** cache: false switches the identity-validation cache off (a measurement knob, shaped like the mode, never an env var). */
export interface Policy { mode: Mode; same_authority_peers: string[]; same_authority_substrates: string[]; cache: boolean }
const isMode = (m: unknown): m is Mode => m === 'off' || m === 'log' || m === 'enforce'

/** Parse the open fedIngressAuthPolicy record body; anything malformed is null (treated as unreadable). */
export function parsePolicy(body: unknown): Policy | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!isMode(b.mode)) return null
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.length > 0) : [])
  return { mode: b.mode, same_authority_peers: list(b.same_authority_peers), same_authority_substrates: list(b.same_authority_substrates), cache: b.cache !== false }
}

/**
 * The effective mode. emergencyOff is the named bootstrap exception (an env rollback that needs no record). A readable
 * record wins. Absent or unreadable: `off` until this node has once read `enforce`, `enforce` after (fail-closed ratchet).
 */
export function resolveMode(policy: Policy | null, ratchetSeen: boolean, emergencyOff: boolean): Mode {
  if (emergencyOff) return 'off'
  if (policy) return policy.mode
  return ratchetSeen ? 'enforce' : 'off'
}

/** The final /p2p/<id> component of a multiaddr (the destination peer of a circuit address), or null. */
export function destinationPeer(target: string): string | null {
  const parts = String(target || '').split('/p2p/')
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]!.split('/')[0]!.trim()
  return last || null
}

/**
 * Attach the caller's key only when the bytes go to a peer in the SAME identity namespace: the destination address's final
 * /p2p/<peer> must be one of the policy's same_authority_peers. Decided per dial address (a fan-out across live circuits
 * reaches several peers, some possibly foreign); an address with no /p2p/ component, an unknown peer, or mode off gets
 * nothing. same_authority_substrates is descriptive only and never widens this.
 */
export function shouldAttachCredential(address: string, policy: Policy | null): boolean {
  if (!policy || policy.mode === 'off') return false
  const peer = destinationPeer(address)
  return peer !== null && policy.same_authority_peers.includes(peer)
}

/** The pointer to send to `address`: any caller-supplied _fedAuth removed, the caller's key added only when allowed. */
export function pointerForDial(address: string, pointer: unknown, callerKey: string | null, policy: Policy | null): Record<string, unknown> {
  const src = pointer && typeof pointer === 'object' ? (pointer as Record<string, unknown>) : {}
  const { _fedAuth: _drop, ...rest } = src
  return callerKey && shouldAttachCredential(address, policy) ? { ...rest, _fedAuth: callerKey } : rest
}

/** A local caller may not smuggle a _fedAuth into the pointer: dropped at every local entry, before any log or proxy. */
export function withoutFedAuth(pointer: unknown): Record<string, unknown> {
  const src = pointer && typeof pointer === 'object' ? (pointer as Record<string, unknown>) : {}
  const { _fedAuth: _drop, ...rest } = src
  return rest
}

/**
 * The caller's key from its own `Authorization: ApiKey <k>` header, or null. Only what the caller sent is ever attached:
 * a caller with no header gets no credential, and the transport never substitutes its own key for a missing one.
 */
export function callerKeyFromHeader(h: string | null): string | null {
  const m = /^ApiKey\s+(\S+)\s*$/i.exec(String(h ?? ''))
  return m ? m[1]! : null
}
