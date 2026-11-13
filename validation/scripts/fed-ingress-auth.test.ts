// fed-ingress-auth.test.ts — INBOUND AUTHENTICATION ON THE OVERLAY (an operator exception).
//
// WHAT IS JUDGED: scripts/substrate/federation-relay/ingress-auth.ts (the pure decision, credential, mint and policy
// logic) and the wiring pins in federation-transport-server.ts that a refactor could silently undo. Hermetic: no network,
// no libp2p, injected fetch and clock, placeholder credentials only.
//
// MUST-FAILS (each turns red under the mutant named beside it):
//   - a non-public shape with no credential, a raw key, an invalid token or an unreachable validator is REFUSED
//     (allow-all / accept-raw-key mutants); an outage is never reported as an invalid credential;
//   - the ingress validator states THIS node and THIS shape, and a token identity bound elsewhere is refused
//     (no-audience / trust-identity's-yes mutants);
//   - the caller's raw key never crosses: a dial carries only `Bearer <token>` minted for the dialed peer and shape, and
//     nothing when there is no key, no peer, or a refused mint (attach-raw-key / substitute-transport-key mutants);
//   - the mint asks for OBO_TTL_SECONDS at use, with this transport as actor and the caller as caller;
//   - absent policy = off until enforce has been seen, enforce after (no-ratchet mutant);
//   - ingressHandler strips the credential as its FIRST statement and never reads the raw pointer again (log-before-strip).
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  ECHO_MAX_BYTES, ECHO_RATE_MAX, ECHO_RATE_WINDOW_MS, HOP_RESERVE_FRAME, OBO_TTL_SECONDS, PUBLIC_SHAPES, makeEchoRateGate, callerKeyFromHeader, decideIngress, decodeHopStatus, destinationPeer, echoRefusal, forwardAddresses, hopFrameFrom, isRelayRefusal, makeOboMinter, makeValidator, oboAudience, probeReservationOnce, reservationProbeMs, runReservationProbes,
  oboToken, parsePolicy, pointerForDial, policyFromRecordsRows, resolveMode, stripCredentials, withoutFedAuth, type Policy, type Validate,
} from '../../scripts/substrate/federation-relay/ingress-auth'

const ROOT = resolve(import.meta.dir, '../..')
const KEY = 'PLACEHOLDER-CALLER-KEY-0001'
const OTHER = 'PLACEHOLDER-OTHER-KEY-0002'
const TOKEN = 'placeholder.obo.token-0003'
const SELF = '12D3KooWSelfPlaceholderPeer'
const PEER = '12D3KooWDestinationPlaceholderPeer'
const RELAY = '12D3KooWRelayPlaceholderPeer'
const circuitTo = (dest: string) => `/dns4/relay.invalid/tcp/1/p2p/${RELAY}/p2p-circuit/p2p/${dest}`
const policy = (over: Partial<Policy> = {}): Policy => ({ mode: 'log', cache: true, ...over })

// A validator that accepts exactly TOKEN, minted for SELF and the shape 'concept'.
const okValidator: Validate = async (c, a) =>
  (c === 'Bearer ' + TOKEN && a.node === SELF && a.shape === 'concept'
    ? { valid: true, principal: { org_id: 'org-p', user_id: 'user-p', key_hash: 'h', key_id: 'kid-placeholder' } }
    : { valid: false, reason: 'invalid' })

describe('stripCredentials', () => {
  test('removes _fedAuth and _auth, returns only _fedAuth as the credential, never mutates the input', () => {
    const raw = { type: 'concept', limit: 1, _fedAuth: 'Bearer ' + TOKEN, _auth: OTHER }
    const r = stripCredentials(raw)
    expect(r.pointer).toEqual({ type: 'concept', limit: 1 })
    expect(r.credential).toBe('Bearer ' + TOKEN)
    expect(r.carried).toBe(true)
    expect(stripCredentials({ type: 'concept' }).carried).toBe(false)
    expect(raw._fedAuth).toBe('Bearer ' + TOKEN)
    expect(JSON.stringify(r.pointer)).not.toContain('PLACEHOLDER')
  })
  test('MUST-FAIL: the retired _auth alias is never a credential', () => {
    expect(stripCredentials({ type: 'vesselRegistry', _auth: KEY })).toEqual({ pointer: { type: 'vesselRegistry' }, credential: null, carried: true })
  })
})

describe('decideIngress', () => {
  test('PUBLIC is exactly substrateBootstrap + the two overlay control shapes, and needs no credential', async () => {
    expect([...PUBLIC_SHAPES].sort()).toEqual(['federation_echo', 'federation_probe', 'substrateBootstrap'])
    for (const shape of ['substrateBootstrap', 'federation_probe', 'federation_echo']) {
      expect(await decideIngress(shape, null, SELF, okValidator)).toEqual({ allow: true, reason: 'public' })
    }
  })
  test('MUST-FAIL: the probe-witnessed report stays credentialed (it names failing checks)', async () => {
    expect(await decideIngress('federation_verification_report', null, SELF, okValidator)).toEqual({ allow: false, reason: 'absent' })
  })
  test('MUST-FAIL: a federation_echo payload over the bound is refused, naming the bound; at the bound it is not', () => {
    expect(ECHO_MAX_BYTES).toBe(131072)
    expect(echoRefusal(65536)).toBeNull()
    expect(echoRefusal(ECHO_MAX_BYTES)).toBeNull()
    const r = echoRefusal(ECHO_MAX_BYTES + 1)
    expect(r?.reason).toBe('payload_too_large')
    expect(r?.max_bytes).toBe(ECHO_MAX_BYTES)
    expect(r?.error).toContain(String(ECHO_MAX_BYTES))
  })
  test('MUST-FAIL: a peer over the echo rate bound is refused, naming the bound; under it, and other peers, are allowed', () => {
    let t = 1_000_000
    const gate = makeEchoRateGate(ECHO_RATE_MAX, ECHO_RATE_WINDOW_MS, () => t)
    for (let i = 0; i < ECHO_RATE_MAX; i++) expect(gate('peerA')).toBeNull()
    const r = gate('peerA')
    expect(r?.reason).toBe('rate_limited')
    expect(r?.max).toBe(ECHO_RATE_MAX)
    expect(r?.window_ms).toBe(ECHO_RATE_WINDOW_MS)
    expect(gate('peerB')).toBeNull()
    t += ECHO_RATE_WINDOW_MS
    expect(gate('peerA')).toBeNull()
  })
  test('MUST-FAIL: a non-public shape with no credential is refused', async () => {
    for (const shape of ['concept', 'resolver_schema', 'federation_verification_report', 'llm_completion']) {
      expect(await decideIngress(shape, null, SELF, okValidator)).toEqual({ allow: false, reason: 'absent' })
    }
  })
  test('MUST-FAIL: a raw key is refused without asking identity, even one identity would accept', async () => {
    let asked = 0
    const yes: Validate = async () => { asked++; return { valid: true, principal: { org_id: 'o', user_id: 'u', key_hash: 'h', key_id: 'k' } } }
    expect(await decideIngress('concept', KEY, SELF, yes)).toEqual({ allow: false, reason: 'not_obo' })
    expect(await decideIngress('concept', 'ApiKey ' + KEY, SELF, yes)).toEqual({ allow: false, reason: 'not_obo' })
    expect(asked).toBe(0)
  })
  test('MUST-FAIL: the validator is asked for THIS node and THIS shape; a token bound elsewhere is refused', async () => {
    expect(await decideIngress('concept', 'Bearer ' + OTHER, SELF, okValidator)).toEqual({ allow: false, reason: 'invalid' })
    expect(await decideIngress('llm_completion', 'Bearer ' + TOKEN, SELF, okValidator)).toEqual({ allow: false, reason: 'invalid' })
    expect(await decideIngress('concept', 'Bearer ' + TOKEN, PEER, okValidator)).toEqual({ allow: false, reason: 'invalid' })
  })
  test('MUST-FAIL: an unreachable or throwing validator refuses, and says validator_unreachable, never invalid', async () => {
    expect(await decideIngress('concept', 'Bearer ' + TOKEN, SELF, async () => ({ valid: false, reason: 'validator_unreachable' }))).toEqual({ allow: false, reason: 'validator_unreachable' })
    expect(await decideIngress('concept', 'Bearer ' + TOKEN, SELF, async () => { throw new Error('down') })).toEqual({ allow: false, reason: 'validator_unreachable' })
  })
  test('a token minted for this node and shape is allowed with its principal, which names the caller\'s key id', async () => {
    const d = await decideIngress('concept', 'Bearer ' + TOKEN, SELF, okValidator)
    expect(d.allow).toBe(true)
    expect(d.principal?.org_id).toBe('org-p')
    expect(d.principal?.key_id).toBe('kid-placeholder')
  })
})

describe('makeValidator (identity /v1/auth/resolve, audience stated)', () => {
  const AUD = { node: SELF, shape: 'concept' }
  const obo = { node: SELF, shape: 'concept' }
  const resp = (status: number, data: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ success: status === 200, data }) })
  test('identity is asked with the token and the audience, nested form; valid → principal carries a hash, never the token', async () => {
    let seen: any = null
    const f = async (url: string, init: any) => { seen = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, orgId: 'o', userId: 'u', keyId: 'kid-placeholder', obo } }) } }
    const v = await makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: f })('Bearer ' + TOKEN, AUD)
    expect(seen.url).toBe('http://identity.invalid/v1/auth/resolve')
    expect(seen.body).toEqual({ impulse: { type: 'authentication', pointer: { type: 'session', token: TOKEN, audience: AUD } } })
    expect(v).toEqual({ valid: true, principal: { org_id: 'o', user_id: 'u', key_hash: expect.any(String), key_id: 'kid-placeholder' } })
    expect(JSON.stringify(v)).not.toContain(TOKEN)
  })
  test('MUST-FAIL: identity\'s yes for a token that is not an on-behalf-of token, or is bound elsewhere, is invalid', async () => {
    const v = (data: unknown) => makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: resp(200, data) })('Bearer ' + TOKEN, AUD)
    expect(await v({ authenticated: true, orgId: 'o', userId: 'u' })).toEqual({ valid: false, reason: 'invalid' })
    expect(await v({ authenticated: true, orgId: 'o', userId: 'u', obo: { node: PEER, shape: 'concept' } })).toEqual({ valid: false, reason: 'invalid' })
    expect(await v({ authenticated: true, orgId: 'o', userId: 'u', obo: { node: SELF, shape: 'other' } })).toEqual({ valid: false, reason: 'invalid' })
    expect(await v({ authenticated: false })).toEqual({ valid: false, reason: 'invalid' })
  })
  test('MUST-FAIL: a raw key is invalid and never sent to identity', async () => {
    let calls = 0
    const f = async () => { calls++; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, obo } }) } }
    expect(await makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: f })(KEY, AUD)).toEqual({ valid: false, reason: 'invalid' })
    expect(calls).toBe(0)
  })
  test('MUST-FAIL: 401/403 are invalid; another non-2xx, a thrown fetch, or no identity URL is validator_unreachable', async () => {
    const at = (f: any, url = 'http://identity.invalid') => makeValidator({ identityUrl: () => url, fetchImpl: f })('Bearer ' + TOKEN, AUD)
    expect(await at(resp(401, {}))).toEqual({ valid: false, reason: 'invalid' })
    expect(await at(resp(403, {}))).toEqual({ valid: false, reason: 'invalid' })
    expect(await at(resp(503, {}))).toEqual({ valid: false, reason: 'validator_unreachable' })
    expect(await at(async () => { throw new Error('refused') })).toEqual({ valid: false, reason: 'validator_unreachable' })
    expect(await at(resp(200, { authenticated: true, obo }), '')).toEqual({ valid: false, reason: 'validator_unreachable' })
  })
  test('MUST-FAIL: a positive answer is reused only while the token is alive: valid at t0, refused at t0+31 s, identity asked again', async () => {
    const T0 = Date.parse('2030-01-01T00:00:00Z')
    let t = T0, calls = 0
    // identity answers the token valid until it expires (30 s after T0), as identity does.
    const f = async (_u: string, init: any) => {
      calls++
      const a = JSON.parse(init.body).impulse.pointer.audience
      return t < T0 + 30_000
        ? { ok: true, status: 200, json: async () => ({ data: { authenticated: true, orgId: 'o', userId: 'u', obo: { ...a, expires_at: new Date(T0 + 30_000).toISOString() } } }) }
        : { ok: false, status: 401, json: async () => ({}) }
    }
    const v = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: f, now: () => t })
    expect((await v('Bearer ' + TOKEN, AUD)).valid).toBe(true)
    t = T0 + 20_000
    expect((await v('Bearer ' + TOKEN, AUD)).valid).toBe(true)
    expect(calls).toBe(1)
    t = T0 + 31_000
    expect(await v('Bearer ' + TOKEN, AUD)).toEqual({ valid: false, reason: 'invalid' })
    expect(calls).toBe(2)
  })
  test('cache: keyed by credential AND audience; never more than 60 s; no readable expiry is never reused; off always asks; unreachable is never cached', async () => {
    const T0 = Date.parse('2030-01-01T00:00:00Z')
    let t = T0, calls = 0
    const far = new Date(T0 + 600_000).toISOString()
    const f = async (_u: string, init: any) => { calls++; const a = JSON.parse(init.body).impulse.pointer.audience; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, orgId: 'o', userId: 'u', obo: { ...a, expires_at: far } } }) } }
    const v = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: f, now: () => t })
    await v('Bearer ' + TOKEN, AUD); await v('Bearer ' + TOKEN, AUD); expect(calls).toBe(1)
    await v('Bearer ' + TOKEN, { node: SELF, shape: 'other' }); expect(calls).toBe(2)
    t += 60_001; await v('Bearer ' + TOKEN, AUD); expect(calls).toBe(3)
    let bare = 0
    const b = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { bare++; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, obo } }) } }, now: () => t })
    await b('Bearer ' + TOKEN, AUD); await b('Bearer ' + TOKEN, AUD); expect(bare).toBe(2)
    let off = 0
    const g = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { off++; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, obo: { ...obo, expires_at: far } } }) } }, cacheEnabled: () => false, now: () => t })
    await g('Bearer ' + TOKEN, AUD); await g('Bearer ' + TOKEN, AUD); expect(off).toBe(2)
    let down = 0
    const h = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { down++; throw new Error('x') } })
    await h('Bearer ' + TOKEN, AUD); await h('Bearer ' + TOKEN, AUD); expect(down).toBe(2)
  })
})

describe('policy and mode (law 1: a shaped record, a fail-closed ratchet)', () => {
  test('parsePolicy: a malformed record is null; cache defaults on; nothing else is read from it', () => {
    expect(parsePolicy({ mode: 'enforce!' })).toBeNull()
    expect(parsePolicy(null)).toBeNull()
    expect(parsePolicy({ mode: 'log', same_authority_peers: [PEER] })).toEqual({ mode: 'log', cache: true })
    expect(parsePolicy({ mode: 'off', cache: false })?.cache).toBe(false)
  })
  test('MUST-FAIL: absent/unreadable = off before any enforce, enforce after (ratchet); a record can only RAISE the mode; emergency off wins', () => {
    expect(resolveMode(null, false, false)).toBe('off')
    expect(resolveMode(null, true, false)).toBe('enforce')
    // the ratchet is a floor: a record of log or off never lowers a node that once enforced
    expect(resolveMode(policy({ mode: 'log' }), true, false)).toBe('enforce')
    expect(resolveMode(policy({ mode: 'off' }), true, false)).toBe('enforce')
    // above the floor a record raises it
    expect(resolveMode(policy({ mode: 'log' }), false, false)).toBe('log')
    expect(resolveMode(policy({ mode: 'enforce' }), false, false)).toBe('enforce')
    expect(resolveMode(policy({ mode: 'enforce' }), true, true)).toBe('off')
  })
})

describe('the policy is the latest row the OWNER wrote in this node\'s records (any other role\'s row is not the policy)', () => {
  const row = (role: string, seq: number, mode = 'enforce') => ({ shape: 'fedIngressAuthPolicy', role, seq, mode, same_authority_peers: ['12D3KooWAttackerPlaceholderPeer'] })
  test('the latest owner row is the policy, and only its mode and cache knob are read', () => {
    expect(policyFromRecordsRows([row('owner', 1, 'log'), row('owner', 5, 'enforce')])).toEqual({ mode: 'enforce', cache: true })
  })
  test('MUST-FAIL: a person, operator or walk row of the shape is not the policy, however late; empty and malformed reads are null', () => {
    for (const role of ['person', 'operator', 'walk', 'detector']) {
      expect([role, policyFromRecordsRows([row(role, 9)])]).toEqual([role, null])
      expect([role, policyFromRecordsRows([row('owner', 1, 'log'), row(role, 9, 'enforce')])?.mode]).toEqual([role, 'log'])
    }
    expect(policyFromRecordsRows([])).toBeNull()
    expect(policyFromRecordsRows(null)).toBeNull()
    expect(policyFromRecordsRows([{ ...row('owner', 2), mode: 'nonsense' }])).toBeNull()
  })
})

describe('the caller\'s key never crosses: a dial carries only a token minted for the dialed peer and shape', () => {
  test('destinationPeer is the LAST /p2p/ component (a circuit names the relay first)', () => {
    expect(destinationPeer(circuitTo(PEER))).toBe(PEER)
    expect(destinationPeer(`/dns4/relay.invalid/tcp/1/p2p/${RELAY}/p2p-circuit`)).toBe(RELAY)
    expect(destinationPeer('/dns4/x.invalid/tcp/1')).toBeNull()
  })
  test('MUST-FAIL: the audience is the peer in the DIALED address and the pointer\'s shape; no peer or no shape is no audience', () => {
    expect(oboAudience(circuitTo(PEER), { type: 'record_write', libp2p_peer_id: '12D3KooWRowFieldPlaceholder' })).toEqual({ node: PEER, shape: 'record_write' })
    expect(oboAudience('/dns4/x.invalid/tcp/1', { type: 'record_write' })).toBeNull()
    expect(oboAudience(circuitTo(PEER), {})).toBeNull()
  })
  test('MUST-FAIL: the dial pointer carries the token as Bearer, never the raw key; every credential the pointer carried is dropped', () => {
    const out = pointerForDial({ type: 'concept', _fedAuth: OTHER, _auth: OTHER }, TOKEN)
    expect(out).toEqual({ type: 'concept', _fedAuth: 'Bearer ' + TOKEN })
    expect(JSON.stringify(out)).not.toContain(KEY)
    expect(JSON.stringify(out)).not.toContain(OTHER)
  })
  test('MUST-FAIL: no token (no key, no peer, a refused mint) → nothing attached, and the retired _auth never crosses', () => {
    expect(pointerForDial({ type: 'concept' }, null)).toEqual({ type: 'concept' })
    expect(pointerForDial({ type: 'vesselRegistry', _auth: OTHER }, null)).toEqual({ type: 'vesselRegistry' })
  })
  test('MUST-FAIL: only an ApiKey caller is minted for: a Bearer session, a malformed header or none gets nothing', () => {
    expect(callerKeyFromHeader(null)).toBeNull()
    expect(callerKeyFromHeader('Bearer ' + KEY)).toBeNull()
    expect(callerKeyFromHeader('ApiKey ' + KEY)).toBe(KEY)
    expect(oboToken('Bearer ' + TOKEN)).toBe(TOKEN)
    expect(oboToken('ApiKey ' + KEY)).toBeNull()
  })
  test('withoutFedAuth drops a smuggled _fedAuth and keeps everything else (incl. the legacy _auth a local caller may send)', () => {
    expect(withoutFedAuth({ type: 'vesselRegistry', _fedAuth: KEY, _auth: OTHER })).toEqual({ type: 'vesselRegistry', _auth: OTHER })
  })
})

describe('makeOboMinter (identity /v1/auth/on-behalf-of, at the sending node)', () => {
  const AUD = { node: PEER, shape: 'record_write' }
  test('MUST-FAIL: the transport is the actor, the caller is the caller, the audience is the dial\'s, and the TTL asked is OBO_TTL_SECONDS', async () => {
    let seen: any = null
    const f = async (url: string, init: any) => { seen = { url, headers: init.headers, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ success: true, data: { token: TOKEN } }) } }
    const mint = makeOboMinter({ identityUrl: () => 'http://identity.invalid/', actorKey: () => OTHER, fetchImpl: f })
    expect(await mint(KEY, AUD)).toBe(TOKEN)
    expect(OBO_TTL_SECONDS).toBe(30)
    expect(seen).toEqual({
      url: 'http://identity.invalid/v1/auth/on-behalf-of',
      headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + OTHER },
      body: { caller: 'ApiKey ' + KEY, audience: AUD, ttl_seconds: 30 },
    })
  })
  test('MUST-FAIL: a refusal, an outage, a missing token, an echoed caller key, no identity URL or no actor key → null', async () => {
    const r = (status: number, data: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) })
    const m = (f: any, url = 'http://identity.invalid', actor = OTHER) => makeOboMinter({ identityUrl: () => url, actorKey: () => actor, fetchImpl: f })(KEY, AUD)
    expect(await m(r(403, { token: TOKEN }))).toBeNull()
    expect(await m(async () => { throw new Error('down') })).toBeNull()
    expect(await m(r(200, {}))).toBeNull()
    expect(await m(r(200, { token: KEY }))).toBeNull()
    expect(await m(r(200, { token: TOKEN }), '')).toBeNull()
    expect(await m(r(200, { token: TOKEN }), 'http://identity.invalid', '')).toBeNull()
  })
})

describe('a mint that yields no token says why (observability: refused and absent read alike at the far end)', () => {
  const AUD = { node: PEER, shape: 'record_write' }
  const mk = (f: any, t: { v: number }, lines: string[], url = 'http://identity.invalid', actor = OTHER) =>
    makeOboMinter({ identityUrl: () => url, actorKey: () => actor, fetchImpl: f, log: (l) => lines.push(l), now: () => t.v })
  const r = (status: number, data: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) })
  test('MUST-FAIL: a refused mint logs its status once a minute, naming shape and peer tail, never the key or a token', async () => {
    const lines: string[] = []; const t = { v: 0 }
    const m = mk(r(403, { token: TOKEN }), t, lines)
    expect(await m(KEY, AUD)).toBeNull(); expect(await m(KEY, AUD)).toBeNull()
    expect(lines).toEqual([`[fed-egress] obo mint refused status=403 shape=record_write peer=…${PEER.slice(-8)}`])
    t.v += 60_001; await m(KEY, AUD)
    expect(lines).toHaveLength(2)
    expect(lines.join('\n')).not.toContain(KEY)
    expect(lines.join('\n')).not.toContain(OTHER)
    expect(lines.join('\n')).not.toContain(TOKEN)
  })
  test('MUST-FAIL: an outage, no identity, and an answer without a usable token each log their own status', async () => {
    const lines: string[] = []; const t = { v: 0 }
    await mk(async () => { throw new Error('down') }, t, lines)(KEY, AUD)
    await mk(r(200, {}), t, lines)(KEY, AUD)
    await mk(r(200, { token: KEY }), t, lines)(KEY, AUD)
    await mk(r(200, { token: TOKEN }), t, lines, '')(KEY, AUD)
    expect(lines.map((l) => l.split(' ')[4])).toEqual(['status=unreachable', 'status=no_token', 'status=no_token', 'status=no_identity'])
    expect(lines.join('\n')).not.toContain(KEY)
  })
  test('MUST-FAIL: a minted token, and a caller with no key, log nothing', async () => {
    const lines: string[] = []; const t = { v: 0 }
    expect(await mk(r(200, { token: TOKEN }), t, lines)(KEY, AUD)).toBe(TOKEN)
    expect(await mk(r(403, {}), t, lines)('', AUD)).toBeNull()
    expect(lines).toEqual([])
  })
  test('MUST-FAIL: the transport wires the minter\'s log to its output', () => {
    const src = readFileSync(join(ROOT, 'scripts/substrate/federation-relay/federation-transport-server.ts'), 'utf8')
    const minter = src.slice(src.indexOf('const mintObo = makeOboMinter({'), src.indexOf('const mintObo = makeOboMinter({') + 300)
    expect(minter).toContain('log: (line) => console.log(line),')
  })
})

describe('a forward the relay refuses tries the same peer another way (the ingress→libp2p path)', () => {
  const OTHER_PEER = '12D3KooWOtherPlaceholderPeer'
  const reg = circuitTo(PEER)
  const direct = `/ip4/198.51.100.7/tcp/4001/p2p/${PEER}`
  const liveSame = `/dns4/relay2.invalid/tcp/1/p2p/12D3KooWRelayTwoPlaceholder/p2p-circuit/p2p/${PEER}`
  const liveOther = circuitTo(OTHER_PEER)
  test('MUST-FAIL: the registered circuit first, then a live circuit to the SAME peer, then the row\'s other addresses', () => {
    expect(forwardAddresses({ libp2p_multiaddr: [reg, direct] }, [liveOther, liveSame, '/ip4/203.0.113.9/tcp/1/p2p/' + PEER])).toEqual([reg, liveSame, direct])
  })
  test('MUST-FAIL: a row address naming another peer, or no peer, is never tried: every try names the row\'s own destination', () => {
    const otherPeerAddr = `/ip4/198.51.100.8/tcp/4001/p2p/${OTHER_PEER}`
    const bare = '/ip4/198.51.100.9/tcp/4001'
    expect(forwardAddresses({ libp2p_multiaddr: [reg, otherPeerAddr, bare, direct] }, [liveSame])).toEqual([reg, liveSame, direct])
    for (const a of forwardAddresses({ libp2p_multiaddr: [reg, otherPeerAddr, bare] }, [liveSame, liveOther])) expect([a, destinationPeer(a)]).toEqual([a, PEER])
  })
  test('MUST-FAIL: a live circuit to another peer is never tried, nor a live non-circuit address', () => {
    const got = forwardAddresses({ libp2p_multiaddr: [reg] }, [liveOther, '/ip4/203.0.113.9/tcp/1/p2p/' + PEER])
    expect(got).toEqual([reg])
  })
  test('each address once, at most 6; no address at all is no try', () => {
    const many = Array.from({ length: 9 }, (_, i) => `/ip4/198.51.100.${i + 1}/tcp/4001/p2p/${PEER}`)
    expect(forwardAddresses({ libp2p_multiaddr: [reg, reg, ...many] }, [liveSame, liveSame])).toHaveLength(6)
    expect(forwardAddresses({ libp2p_multiaddr: [] }, [liveSame])).toEqual([])
    expect(forwardAddresses({}, [liveSame])).toEqual([])
  })
  test('MUST-FAIL: only the relay\'s refusal moves a forward on; any other answer or failure is the answer', () => {
    expect(isRelayRefusal({ error: 'failed to connect via relay with status NO_RESERVATION' })).toBe(true)
    expect(isRelayRefusal({ error: 'NO_RESERVATION' })).toBe(true)
    for (const r of [{ error: 'unauthorized' }, { content: { error: 'NO_RESERVATION' } }, { content: {} }, null, 'NO_RESERVATION']) expect([r, isRelayRefusal(r)]).toEqual([r, false])
  })
  test('MUST-FAIL: a mint answered with something that is not JSON is no_token, not unreachable', async () => {
    const lines: string[] = []
    const m = makeOboMinter({ identityUrl: () => 'http://identity.invalid', actorKey: () => OTHER, fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('not json') } }) as any, log: (l) => lines.push(l), now: () => 0 })
    expect(await m(KEY, { node: PEER, shape: 'record_write' })).toBeNull()
    expect(lines.map((l) => l.split(' ')[4])).toEqual(['status=no_token'])
  })
})

describe('the relay\'s own answer about our reservation (circuit relay v2 HOP RESERVE probe)', () => {
  // Golden vectors: HopMessage.encode from @libp2p/circuit-relay-v2's own pb, taken once (the package does not export it).
  const hex = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'))
  const OK_BODY = hex('08021a0d08d8e6cfaa061205047f00000122060878108080082864') // STATUS OK, expire 1700000600, an addr, a limit
  const NORES_BODY = hex('080228cc01') // STATUS NO_RESERVATION
  const REFUSED_BODY = hex('080228c801') // STATUS RESERVATION_REFUSED
  const lp = (b: Uint8Array) => Uint8Array.from([b.length, ...b])
  test('MUST-FAIL: the RESERVE frame is the library\'s encoding with its varint length; STATUS replies decode to status and expire', () => {
    expect([...HOP_RESERVE_FRAME]).toEqual([0x02, 0x08, 0x00])
    expect(decodeHopStatus(OK_BODY)).toEqual({ type: 2, status: 100, expire: 1700000600 })
    expect(decodeHopStatus(NORES_BODY)).toEqual({ type: 2, status: 204 })
    expect(decodeHopStatus(REFUSED_BODY)).toEqual({ type: 2, status: 200 })
  })
  test('a frame is returned only once it is whole, from bytes read in any number of chunks', () => {
    const f = lp(OK_BODY)
    expect(hopFrameFrom(f.subarray(0, 5))).toBeNull()
    expect(hopFrameFrom(new Uint8Array(0))).toBeNull()
    expect([...hopFrameFrom(f)!]).toEqual([...OK_BODY])
  })
  // A stand-in HOP stream: what it was sent, the chunks it answers with, or a throw, or nothing ever.
  const stream = (answer: Uint8Array[] | 'throw' | 'never') => {
    const sent: Uint8Array[] = []
    let closed = 0
    const closeOpts: unknown[] = []
    return {
      sent, closeOpts, get closed() { return closed },
      send: (b: Uint8Array) => { sent.push(b); return true },
      close: async (o?: unknown) => { closed++; closeOpts.push(o) },
      async *[Symbol.asyncIterator]() {
        if (answer === 'throw') throw new Error('stream reset')
        if (answer === 'never') { await new Promise(() => {}) }
        for (const c of answer as Uint8Array[]) yield c
      },
    }
  }
  const run = async (s: ReturnType<typeof stream> | null, timeoutMs = 50) => {
    const lines: string[] = [], redials: string[] = []
    const got = await probeReservationOnce({ openHop: async () => s as any, redial: async (w) => { redials.push(w) }, log: (l) => lines.push(l), now: () => 1700000000_000, timeoutMs })
    return { got, lines, redials }
  }
  test('MUST-FAIL: OK is one line saying the relay granted a reservation (new or refreshed, never "holds it") with the expire, and no re-dial', async () => {
    const s = stream([lp(OK_BODY).subarray(0, 4), lp(OK_BODY).subarray(4)])
    const r = await run(s)
    expect(r).toEqual({ got: 'held', lines: ['[federation] reservation probe: the relay granted a reservation (new or refreshed; expires in 600 s)'], redials: [] })
    expect(s.sent.map((b) => [...b])).toEqual([[0x02, 0x08, 0x00]])
    expect(s.closed).toBe(1)
  })
  test('MUST-FAIL: the stream is closed under a time bound, so a stuck close cannot hold the probe', async () => {
    const s = stream([lp(OK_BODY)])
    await run(s)
    expect((s.closeOpts[0] as { signal?: unknown })?.signal).toBeInstanceOf(AbortSignal)
  })
  test('MUST-FAIL: any other status, a stream error, no answer, or no answer in time re-dials once and says what the relay answered', async () => {
    for (const [s, said] of [
      [stream([lp(NORES_BODY)]), 'status NO_RESERVATION'],
      [stream([lp(REFUSED_BODY)]), 'status RESERVATION_REFUSED'],
      [stream('throw'), 'stream error: stream reset'],
      [stream([]), 'no answer'],
      [stream('never'), 'no answer within 0 s'],
    ] as const) {
      const r = await run(s)
      expect([said, r.got, r.redials, r.lines]).toEqual([said, 'redialed', [`reservation probe: ${said}`], [`[federation] reservation probe: the relay answered ${said}; re-dialing for a fresh reservation`]])
      expect([said, s.closed]).toEqual([said, 1])
    }
  })
  test('MUST-FAIL: no relay connection is nothing to ask: no line, no re-dial', async () => {
    expect(await run(null)).toEqual({ got: 'no-connection', lines: [], redials: [] })
  })
  // The schedule, driven by a stand-in clock: sleep records each wait and refuses past 200 calls, so a schedule that never
  // probes (or never stops) fails in milliseconds rather than running away.
  const schedule = async (connectAfterPolls: number, probesWanted: number, firstWaitMs = 5_000) => {
    const events: string[] = []
    let polls = 0
    let probes = 0
    let calls = 0
    await runReservationProbes({
      connected: () => polls >= connectAfterPolls,
      probe: async () => { probes++; events.push('probe') },
      paceMs: () => 600_000,
      log: (l) => events.push('log: ' + l),
      sleep: async (ms) => { if (++calls > 200) throw new Error('stand-in clock: too many sleeps'); events.push(`sleep ${ms}`); if (ms === 1_000) polls++ },
      pollMs: 1_000,
      firstWaitMs,
      stop: () => probes >= probesWanted,
    })
    return events
  }
  test('MUST-FAIL: after a restart the first probe runs as soon as the first relay connection is up, not a whole pace later', async () => {
    expect(await schedule(3, 2)).toEqual(['sleep 1000', 'sleep 1000', 'sleep 1000', 'probe', 'sleep 600000', 'probe'])
  })
  test('MUST-FAIL: a transport already connected at start probes before any wait', async () => {
    expect((await schedule(0, 1))[0]).toBe('probe')
  })
  test('no relay connection within the first wait: one line says so, and the paced probes ask once one is up', async () => {
    const ev = await schedule(99, 1, 3_000)
    expect(ev.slice(0, 3)).toEqual(['sleep 1000', 'sleep 1000', 'sleep 1000'])
    expect(ev[3]).toBe('log: [federation] reservation probe: no relay connection within 3 s of start; the paced probe asks once one is up')
    expect(ev.slice(4)).toEqual(['sleep 600000', 'probe'])
  })
  // Throws from what the schedule asks never end it. The same capped stand-in clock: a schedule that loops without
  // sleeping, or never probes again, trips the 200-call cap or never reaches its probes.
  const throwing = async (o: { probeThrows?: (n: number) => boolean; paceThrows?: boolean; upThrows?: (polls: number) => boolean; up?: (polls: number) => boolean; probesWanted: number; firstWaitMs?: number }) => {
    const events: string[] = []
    let polls = 0
    let probes = 0
    let calls = 0
    await runReservationProbes({
      connected: () => { if (o.upThrows?.(polls)) throw new Error('getConnections failed {at /dns4/x/tcp/1}'); return o.up ? o.up(polls) : true },
      probe: async () => { probes++; if (o.probeThrows?.(probes)) { events.push('probe threw'); throw new Error('redial failed\nsecond line') } events.push('probe') },
      paceMs: () => { if (o.paceThrows) throw new Error('no policy'); return 120_000 },
      log: (l) => events.push('log: ' + l),
      sleep: async (ms) => { if (++calls > 200) throw new Error('stand-in clock: too many sleeps'); events.push(`sleep ${ms}`); if (ms === 1_000) polls++ },
      pollMs: 1_000,
      firstWaitMs: o.firstWaitMs ?? 5_000,
      stop: () => probes >= o.probesWanted,
    })
    return events
  }
  test('MUST-FAIL: a probe that throws is said in one line and followed by more probes, at the pace', async () => {
    expect(await throwing({ probeThrows: (n) => n <= 2, probesWanted: 4 })).toEqual([
      'probe threw', 'log: [federation] reservation probe schedule: the probe threw (redial failed?second line); asked again next time',
      'sleep 120000', 'probe threw', 'log: [federation] reservation probe schedule: the probe threw (redial failed?second line); asked again next time',
      'sleep 120000', 'probe', 'sleep 120000', 'probe',
    ])
  })
  test('MUST-FAIL: a pace that throws on every call sleeps the default pace each time, never none', async () => {
    const ev = await throwing({ paceThrows: true, probesWanted: 6 })
    expect(ev.filter((e) => e.startsWith('sleep'))).toEqual(Array(5).fill('sleep 600000'))
    expect(ev.filter((e) => e === 'probe')).toHaveLength(6)
  })
  test('MUST-FAIL: a relay connection check that keeps throwing in the first wait leaves it bounded, said once and counted', async () => {
    const ev = await throwing({ upThrows: () => true, probesWanted: 1, firstWaitMs: 5_000 })
    const lines = ev.filter((e) => e.startsWith('log: '))
    expect(ev.filter((e) => e === 'sleep 1000')).toHaveLength(5)
    expect(lines[0]).toBe('log: [federation] reservation probe schedule: the relay connection check threw (getConnections failed ?at ?dns4?x?tcp?1?); asked again next time')
    expect(lines[1]).toBe('log: [federation] reservation probe schedule: the relay connection check threw 6 more time(s) in the first wait')
    expect(lines[2]).toBe('log: [federation] reservation probe: no relay connection within 5 s of start; the paced probe asks once one is up')
    expect(ev.at(-1)).toBe('probe')
  })
  test('a check that throws once in the first wait and then sees the connection probes at once', async () => {
    const ev = await throwing({ upThrows: (p) => p === 0, up: (p) => p >= 1, probesWanted: 1 })
    expect(ev.filter((e) => !e.startsWith('log: '))).toEqual(['sleep 1000', 'probe'])
  })
  test('the pace is the policy row\'s reservation_probe_s, clamped to 60..3600 s, else 600 s', () => {
    expect(reservationProbeMs(null)).toBe(600_000)
    expect(reservationProbeMs(parsePolicy({ mode: 'enforce', reservation_probe_s: 5 }))).toBe(60_000)
    expect(reservationProbeMs(parsePolicy({ mode: 'enforce', reservation_probe_s: 120 }))).toBe(120_000)
    expect(reservationProbeMs(parsePolicy({ mode: 'enforce', reservation_probe_s: 99999 }))).toBe(3_600_000)
    expect(reservationProbeMs(parsePolicy({ mode: 'enforce', reservation_probe_s: 'x' }))).toBe(600_000)
  })
  test('MUST-FAIL: the transport probes on its existing relay connection, one at a time, re-dialing through redialRelay, first on connect and then on the row\'s pace', () => {
    const src = readFileSync(join(ROOT, 'scripts/substrate/federation-relay/federation-transport-server.ts'), 'utf8')
    const probe = src.slice(src.indexOf('async function probeReservation('), src.indexOf('async function redialRelay('))
    expect(probe).toContain('if (probing || !RELAY) return')
    expect(probe).toContain('const c: any = relayConnections()[0]')
    expect(probe).toContain('c.newStream(RELAY_V2_HOP_CODEC')
    expect(probe).toContain('redial: (why) => redialRelay(why),')
    expect(probe).toContain('void runReservationProbes({')
    expect(probe).toContain('connected: () => relayConnections().length > 0,')
    expect(probe).toContain('probe: () => probeReservation(),')
    expect(probe).toContain('paceMs: () => reservationProbeMs(cachedPolicy()),')
    expect(src).not.toContain('scheduleReservationProbe')
  })
})

describe('wiring pins (federation-transport-server.ts)', () => {
  const src = readFileSync(join(ROOT, 'scripts/substrate/federation-relay/federation-transport-server.ts'), 'utf8')
  const ingress = src.slice(src.indexOf('const ingressHandler = async (raw'), src.indexOf('await serveResolve(vl, ingressHandler)'))
  const dial = src.slice(src.indexOf('async function resolveOverLibp2p('), src.indexOf('async function resolveOverLibp2p(') + 900)
  const proxy = src.slice(src.indexOf('async function proxyToVessel('), src.indexOf('async function proxyToVessel(') + 2400)
  test('MUST-FAIL: ingressHandler strips the credential as its first statement and never reads the raw pointer again', () => {
    expect(ingress.length).toBeGreaterThan(100)
    const body = ingress.slice(ingress.indexOf('=> {') + 4).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
    expect(body[0]).toBe('const { pointer, credential, carried } = stripCredentials(raw)')
    expect(body.slice(1).join('\n')).not.toMatch(/\braw\b/)
  })
  test('MUST-FAIL: the ingress decides against the libp2p node\'s own peer id, and only a valid token admits the registry branch', () => {
    expect(ingress).toContain('decision = await decideIngress(shape, credential, vl.peerId, validateKey)')
    expect(ingress).toContain("if (decision?.reason === 'valid') ingressAuthenticated.add(pointer)")
    const code = ingress.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/legacyAuth|_auth\b/)
  })
  test('MUST-FAIL: every libp2p dial goes through resolveOverLibp2p, which mints for the dialed address and attaches only the token', () => {
    const direct = src.match(/resolveVia(Libp2p|Http)\(vl,/g) ?? []
    expect(direct.length).toBe(2)
    expect(dial).toContain('const audience = oboAudience(target, pointer)')
    expect(dial).toContain('const out = pointerForDial(pointer, key && audience ? await mintObo(key, audience) : null)')
    expect(dial).not.toContain('libp2p_peer_id')
    expect(src).toContain('actorKey: () => API_KEY,')
  })
  test('MUST-FAIL: an ingress-originated hop carries no key (nothing is minted for it); a validated token is forwarded with its audience', () => {
    expect(ingress).toContain("const forward = decision?.reason === 'valid' && credential ? { authorization: credential, audience: vl.peerId + '/' + shape } : null")
    expect(ingress).toContain('callerCtx.run({ key: null, forward }, () => resolveHandler(pointer))')
  })
  test('MUST-FAIL: proxyToVessel sends a forwarded request under the caller\'s token and audience, never this node\'s key', () => {
    expect(proxy).toContain('const forward = callerCtx.getStore()?.forward')
    expect(proxy).toContain("? { 'Content-Type': 'application/json', Authorization: forward.authorization, 'X-Auth-Audience': forward.audience }")
    expect(proxy).toContain(": { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },")
  })
  test('MUST-FAIL: the policy reader trusts only policyFromRecordsRows (the owner\'s row in local records), never a raw body or the retired pool', () => {
    const reader = src.slice(src.indexOf('async function readIngressPolicy('), src.indexOf('const cachedPolicy ='))
    expect(reader).toContain('policy = policyFromRecordsRows(Array.isArray(j) ? j : j?.content)')
    expect(reader).toContain("shape: 'fedIngressAuthPolicy', where: { role: 'owner' }")
    expect(reader).toContain("'X-Discovery-Depth': '99'")
    expect(reader).not.toContain('DEVELOPMENT_VESSEL_URL')
    expect(reader).not.toMatch(/parsePolicy\(/)
    const mode = src.slice(src.indexOf('async function ingressMode('), src.indexOf('const validateKey ='))
    expect(mode).toContain("if (policy?.mode === 'enforce' && !existsSync(RATCHET_FILE))")
  })
  test('MUST-FAIL: the ingress→libp2p forward tries forwardAddresses in order, moving on only on a relay refusal, and logs each refusal', () => {
    const fwd = src.slice(src.indexOf('const forwardLibp2p = async (v: any) => {'), src.indexOf('const forwardLibp2p = async (v: any) => {') + 1400)
    expect(fwd).toContain('const tries = forwardAddresses(v, live)')
    expect(fwd).toContain('if (!isRelayRefusal(res)) break')
    expect(fwd).toContain('[fed-transport] forward relay refusal #')
    expect(fwd).toContain('.catch((e) => ({ error: String((e as Error)?.message ?? e) }))')
  })
  test('MUST-FAIL: the 5-minute window line says how many reservations the relay transport holds, beside the advertised circuit', () => {
    expect(src).toContain("window circuit_up=${currentCircuit() ? 'y' : 'n'} reservations_held=${reservationTruth().held} mode=${m}")
  })
  test('MUST-FAIL: the pre-enforcement allowlist column is gone: the ingress line says what happened, not what a list would have done', () => {
    expect(src).not.toContain('FED_INGRESS_SEED_ALLOWLIST')
    expect(src).not.toContain('would_refuse')
  })
  test('the refusal body echoes no pointer field, only the shape and a fixed reason', () => {
    const refusal = ingress.slice(ingress.indexOf("return { error: 'unauthorized'"), ingress.indexOf("return { error: 'unauthorized'") + 400)
    expect(refusal).not.toMatch(/\bpointer\b|\braw\b/)
  })
})
