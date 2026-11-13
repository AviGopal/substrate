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
  ECHO_MAX_BYTES, ECHO_RATE_MAX, ECHO_RATE_WINDOW_MS, OBO_TTL_SECONDS, PUBLIC_SHAPES, makeEchoRateGate, callerKeyFromHeader, decideIngress, destinationPeer, echoRefusal, makeOboMinter, makeValidator, oboAudience,
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
  test('cache: keyed by credential AND audience; a positive answer is reused within 60 s; cache off always asks; unreachable is never cached', async () => {
    let calls = 0; let t = 0
    const f = async (_u: string, init: any) => { calls++; const a = JSON.parse(init.body).impulse.pointer.audience; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, orgId: 'o', userId: 'u', obo: a } }) } }
    const v = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: f, now: () => t })
    await v('Bearer ' + TOKEN, AUD); await v('Bearer ' + TOKEN, AUD); expect(calls).toBe(1)
    await v('Bearer ' + TOKEN, { node: SELF, shape: 'other' }); expect(calls).toBe(2)
    t += 60_001; await v('Bearer ' + TOKEN, AUD); expect(calls).toBe(3)
    let off = 0
    const g = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { off++; return { ok: true, status: 200, json: async () => ({ data: { authenticated: true, obo } }) } }, cacheEnabled: () => false })
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
  test('the refusal body echoes no pointer field, only the shape and a fixed reason', () => {
    const refusal = ingress.slice(ingress.indexOf("return { error: 'unauthorized'"), ingress.indexOf("return { error: 'unauthorized'") + 400)
    expect(refusal).not.toMatch(/\bpointer\b|\braw\b/)
  })
})
