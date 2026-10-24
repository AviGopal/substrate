// fed-ingress-auth.test.ts — INBOUND AUTHENTICATION ON THE OVERLAY (an operator exception).
//
// WHAT IS JUDGED: scripts/substrate/federation-relay/ingress-auth.ts (the pure decision, credential and policy logic) and
// the wiring pins in federation-transport-server.ts that a refactor could silently undo. Hermetic: no network, no libp2p,
// injected fetch and clock, placeholder keys only.
//
// MUST-FAILS (each turns red under the mutant named beside it):
//   - a non-public shape with no credential, an invalid key, or an unreachable validator is REFUSED (allow-all mutant);
//   - an unreachable validator is never reported as an invalid key (outage-as-bad-key mutant);
//   - the caller's key is attached ONLY to a same-authority destination peer; a foreign peer, an address with no peer, a
//     relay-only circuit, mode off, or a missing caller key gets none (attach-always / substitute-transport-key mutants);
//   - absent policy = off until enforce has been seen, enforce after (no-ratchet mutant);
//   - ingressHandler strips the credential as its FIRST statement and never reads the raw pointer again (log-before-strip).
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  ECHO_MAX_BYTES, ECHO_RATE_MAX, ECHO_RATE_WINDOW_MS, PUBLIC_SHAPES, makeEchoRateGate, callerKeyFromHeader, decideIngress, destinationPeer, echoRefusal, makeValidator, parsePolicy, pointerForDial, policyFromPoolResponse,
  resolveMode, shouldAttachCredential, stripCredentials, withoutFedAuth, type Policy, type Validate,
} from '../../scripts/substrate/federation-relay/ingress-auth'

const ROOT = resolve(import.meta.dir, '../..')
const KEY = 'PLACEHOLDER-CALLER-KEY-0001'
const OTHER = 'PLACEHOLDER-OTHER-KEY-0002'
const SAME = '12D3KooWSameAuthorityPlaceholderPeer'
const FOREIGN = '12D3KooWForeignNamespacePlaceholderPeer'
const RELAY = '12D3KooWRelayPlaceholderPeer'
const circuitTo = (dest: string) => `/dns4/relay.invalid/tcp/1/p2p/${RELAY}/p2p-circuit/p2p/${dest}`
const policy = (over: Partial<Policy> = {}): Policy => ({ mode: 'log', same_authority_peers: [SAME], same_authority_substrates: ['hub-placeholder'], cache: true, ...over })

const okValidator: Validate = async (k) => (k === KEY ? { valid: true, principal: { org_id: 'org-p', user_id: 'user-p', key_hash: 'h' } } : { valid: false, reason: 'invalid' })

describe('stripCredentials', () => {
  test('removes _fedAuth and _auth, returns the credential (_fedAuth wins), never mutates the input', () => {
    const raw = { type: 'concept', limit: 1, _fedAuth: KEY, _auth: OTHER }
    const r = stripCredentials(raw)
    expect(r.pointer).toEqual({ type: 'concept', limit: 1 })
    expect(r.credential).toBe(KEY)
    expect(r.legacyAuth).toBe(OTHER)
    expect(raw._fedAuth).toBe(KEY)
    expect(JSON.stringify(r.pointer)).not.toContain('PLACEHOLDER')
  })
  test('the _auth alias alone is the credential', () => {
    expect(stripCredentials({ type: 'vesselRegistry', _auth: KEY }).credential).toBe(KEY)
  })
})

describe('decideIngress', () => {
  test('PUBLIC is exactly substrateBootstrap + the two overlay control shapes, and needs no key', async () => {
    expect([...PUBLIC_SHAPES].sort()).toEqual(['federation_echo', 'federation_probe', 'substrateBootstrap'])
    for (const shape of ['substrateBootstrap', 'federation_probe', 'federation_echo']) {
      expect(await decideIngress(shape, null, okValidator)).toEqual({ allow: true, reason: 'public' })
    }
  })
  test('MUST-FAIL: the probe-witnessed report stays credentialed (it names failing checks)', async () => {
    expect(await decideIngress('federation_verification_report', null, okValidator)).toEqual({ allow: false, reason: 'absent' })
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
      expect(await decideIngress(shape, null, okValidator)).toEqual({ allow: false, reason: 'absent' })
    }
  })
  test('MUST-FAIL: an invalid key is refused', async () => {
    expect(await decideIngress('concept', OTHER, okValidator)).toEqual({ allow: false, reason: 'invalid' })
  })
  test('MUST-FAIL: an unreachable or throwing validator refuses, and says validator_unreachable, never invalid', async () => {
    expect(await decideIngress('concept', KEY, async () => ({ valid: false, reason: 'validator_unreachable' }))).toEqual({ allow: false, reason: 'validator_unreachable' })
    expect(await decideIngress('concept', KEY, async () => { throw new Error('down') })).toEqual({ allow: false, reason: 'validator_unreachable' })
  })
  test('a valid key is allowed with its principal', async () => {
    const d = await decideIngress('concept', KEY, okValidator)
    expect(d.allow).toBe(true)
    expect(d.principal?.org_id).toBe('org-p')
  })
})

describe('makeValidator (identity /v1/keys/validate)', () => {
  const resp = (status: number, data: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) })
  test('valid → principal carries a key HASH, never the key', async () => {
    const v = await makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: resp(200, { valid: true, org_id: 'o', user_id: 'u' }) })(KEY)
    expect(v.valid).toBe(true)
    expect(JSON.stringify(v)).not.toContain(KEY)
  })
  test('MUST-FAIL: a non-2xx, a thrown fetch, or no identity URL is validator_unreachable, not invalid', async () => {
    expect(await makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: resp(503, {}) })(KEY)).toEqual({ valid: false, reason: 'validator_unreachable' })
    expect(await makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { throw new Error('refused') } })(KEY)).toEqual({ valid: false, reason: 'validator_unreachable' })
    expect(await makeValidator({ identityUrl: () => '', fetchImpl: resp(200, { valid: true }) })(KEY)).toEqual({ valid: false, reason: 'validator_unreachable' })
  })
  test('valid:false is invalid', async () => {
    expect(await makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: resp(200, { valid: false }) })(KEY)).toEqual({ valid: false, reason: 'invalid' })
  })
  test('cache: a positive answer is reused within 60 s, re-asked after; cache off always asks; unreachable is never cached', async () => {
    let calls = 0; let t = 0
    const f = async () => { calls++; return { ok: true, status: 200, json: async () => ({ data: { valid: true, org_id: 'o', user_id: 'u' } }) } }
    const v = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: f, now: () => t })
    await v(KEY); await v(KEY); expect(calls).toBe(1)
    t += 60_001; await v(KEY); expect(calls).toBe(2)
    let off = 0
    const g = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { off++; return { ok: true, status: 200, json: async () => ({ data: { valid: true } }) } }, cacheEnabled: () => false })
    await g(KEY); await g(KEY); expect(off).toBe(2)
    let down = 0
    const h = makeValidator({ identityUrl: () => 'http://identity.invalid', fetchImpl: async () => { down++; throw new Error('x') } })
    await h(KEY); await h(KEY); expect(down).toBe(2)
  })
})

describe('policy and mode (law 1: a shaped record, a fail-closed ratchet)', () => {
  test('parsePolicy: a malformed record is null; cache defaults on', () => {
    expect(parsePolicy({ mode: 'enforce!' })).toBeNull()
    expect(parsePolicy(null)).toBeNull()
    expect(parsePolicy({ mode: 'log', same_authority_peers: [SAME, 3] })).toEqual({ mode: 'log', same_authority_peers: [SAME], same_authority_substrates: [], cache: true })
    expect(parsePolicy({ mode: 'off', cache: false })?.cache).toBe(false)
  })
  test('MUST-FAIL: absent/unreadable = off before any enforce, enforce after (ratchet); a readable record wins; emergency off wins', () => {
    expect(resolveMode(null, false, false)).toBe('off')
    expect(resolveMode(null, true, false)).toBe('enforce')
    expect(resolveMode(policy({ mode: 'log' }), true, false)).toBe('log')
    expect(resolveMode(policy({ mode: 'enforce' }), true, true)).toBe('off')
  })
})

describe('policy rows count ONLY when the pool verified an operator stamp (a forged row is unreadable)', () => {
  const body = { mode: 'enforce', same_authority_peers: ['12D3KooWAttackerPlaceholderPeer'] }
  const read = (row: Record<string, unknown> | null) => ({ body: { impulses: row ? [row] : [] } })
  test('a verified operator row is the policy', () => {
    expect(policyFromPoolResponse(read({ body, attested_verified: true, attested: { by: 'operator' } }))?.mode).toBe('enforce')
  })
  test('MUST-FAIL: unattested, unverified, forged-verified-without-operator, evaluator, runner, empty and malformed reads are all null', () => {
    for (const row of [
      { body },
      { body, attested: { by: 'operator' } },
      { body, attested_verified: false, attested: { by: 'operator' } },
      { body, attested_verified: true },
      { body, attested_verified: true, attested: { by: 'evaluator' } },
      { body, attested_verified: true, attested: { by: 'runner' } },
      { body: { mode: 'nonsense' }, attested_verified: true, attested: { by: 'operator' } },
    ]) expect([JSON.stringify(row).slice(0, 70), policyFromPoolResponse(read(row))]).toEqual([JSON.stringify(row).slice(0, 70), null])
    expect(policyFromPoolResponse(read(null))).toBeNull()
    expect(policyFromPoolResponse(null)).toBeNull()
    expect(policyFromPoolResponse({ body: { impulses: 'x' } })).toBeNull()
  })
  test('MUST-FAIL: so an unattested row naming an attacker peer routes NO key, and its enforce cannot arm the ratchet', () => {
    const p = policyFromPoolResponse(read({ body, attested_verified: false }))
    expect(pointerForDial('/dns4/x.invalid/tcp/1/p2p/12D3KooWAttackerPlaceholderPeer', { type: 'concept' }, KEY, p)).toEqual({ type: 'concept' })
    expect(resolveMode(p, false, false)).toBe('off')
  })
})

describe('the caller key crosses only to the same identity authority (no bearer key across a trust boundary)', () => {
  test('destinationPeer is the LAST /p2p/ component (a circuit names the relay first)', () => {
    expect(destinationPeer(circuitTo(SAME))).toBe(SAME)
    expect(destinationPeer(`/dns4/relay.invalid/tcp/1/p2p/${RELAY}/p2p-circuit`)).toBe(RELAY)
    expect(destinationPeer('/dns4/x.invalid/tcp/1')).toBeNull()
  })
  test('same-authority peer gets the caller key', () => {
    expect(pointerForDial(circuitTo(SAME), { type: 'concept' }, KEY, policy())).toEqual({ type: 'concept', _fedAuth: KEY })
  })
  test('MUST-FAIL: a foreign-namespace destination receives NO _fedAuth, even one the caller smuggled in', () => {
    expect(pointerForDial(circuitTo(FOREIGN), { type: 'concept' }, KEY, policy())).toEqual({ type: 'concept' })
    expect(pointerForDial(circuitTo(FOREIGN), { type: 'concept', _fedAuth: OTHER }, KEY, policy())).toEqual({ type: 'concept' })
  })
  test('MUST-FAIL: no peer in the address, a relay-only circuit, mode off, or no policy → nothing attached', () => {
    expect(pointerForDial('/dns4/x.invalid/tcp/1', { type: 'concept' }, KEY, policy())).toEqual({ type: 'concept' })
    expect(shouldAttachCredential(`/dns4/relay.invalid/tcp/1/p2p/${RELAY}/p2p-circuit`, policy())).toBe(false)
    expect(pointerForDial(circuitTo(SAME), { type: 'concept' }, KEY, policy({ mode: 'off' }))).toEqual({ type: 'concept' })
    expect(pointerForDial(circuitTo(SAME), { type: 'concept' }, KEY, null)).toEqual({ type: 'concept' })
  })
  test('MUST-FAIL: same_authority_substrates never widens attachment (only peers decide)', () => {
    expect(shouldAttachCredential(circuitTo(FOREIGN), policy({ same_authority_substrates: ['anything'] }))).toBe(false)
  })
  test('MUST-FAIL: no caller key → nothing attached; the transport never substitutes its own', () => {
    expect(pointerForDial(circuitTo(SAME), { type: 'concept' }, null, policy())).toEqual({ type: 'concept' })
    expect(callerKeyFromHeader(null)).toBeNull()
    expect(callerKeyFromHeader('Bearer ' + KEY)).toBeNull()
    expect(callerKeyFromHeader('ApiKey ' + KEY)).toBe(KEY)
  })
  test('MUST-FAIL: the legacy _auth (shared fleet key) never reaches a foreign peer once a policy is in force', () => {
    expect(pointerForDial(circuitTo(FOREIGN), { type: 'vesselRegistry', _auth: OTHER }, KEY, policy())).toEqual({ type: 'vesselRegistry' })
    expect(pointerForDial(circuitTo(FOREIGN), { type: 'vesselRegistry', _auth: OTHER }, null, policy({ mode: 'enforce' }))).toEqual({ type: 'vesselRegistry' })
    expect(pointerForDial('/dns4/x.invalid/tcp/1', { type: 'vesselRegistry', _auth: OTHER }, null, policy())).toEqual({ type: 'vesselRegistry' })
  })
  test('the legacy _auth still reaches a same-authority peer, and passes unchanged with no policy or mode off (pre-opt-in behaviour)', () => {
    expect(pointerForDial(circuitTo(SAME), { type: 'vesselRegistry', _auth: OTHER }, null, policy())).toEqual({ type: 'vesselRegistry', _auth: OTHER })
    expect(pointerForDial(circuitTo(FOREIGN), { type: 'vesselRegistry', _auth: OTHER }, null, null)).toEqual({ type: 'vesselRegistry', _auth: OTHER })
    expect(pointerForDial(circuitTo(FOREIGN), { type: 'vesselRegistry', _auth: OTHER }, null, policy({ mode: 'off' }))).toEqual({ type: 'vesselRegistry', _auth: OTHER })
  })
  test('withoutFedAuth drops a smuggled _fedAuth and keeps everything else (incl. the legacy _auth a local caller may send)', () => {
    expect(withoutFedAuth({ type: 'vesselRegistry', _fedAuth: KEY, _auth: OTHER })).toEqual({ type: 'vesselRegistry', _auth: OTHER })
  })
})

describe('wiring pins (federation-transport-server.ts)', () => {
  const src = readFileSync(join(ROOT, 'scripts/substrate/federation-relay/federation-transport-server.ts'), 'utf8')
  const ingress = src.slice(src.indexOf('const ingressHandler = async (raw'), src.indexOf('await serveResolve(vl, ingressHandler)'))
  test('MUST-FAIL: ingressHandler strips the credential as its first statement and never reads the raw pointer again', () => {
    expect(ingress.length).toBeGreaterThan(100)
    const body = ingress.slice(ingress.indexOf('=> {') + 4).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
    expect(body[0]).toBe('const { pointer, credential, legacyAuth } = stripCredentials(raw)')
    expect(body.slice(1).join('\n')).not.toMatch(/\braw\b/)
  })
  test('MUST-FAIL: every libp2p dial goes through resolveOverLibp2p, which applies pointerForDial', () => {
    const direct = src.match(/resolveVia(Libp2p|Http)\(vl,/g) ?? []
    expect(direct.length).toBe(2)
    const fn = src.slice(src.indexOf('async function resolveOverLibp2p('), src.indexOf('async function resolveOverLibp2p(') + 600)
    expect(fn).toContain('pointerForDial(target, pointer, callerCtx.getStore()?.key ?? null, cachedPolicy())')
  })
  test('MUST-FAIL: the policy reader trusts only policyFromPoolResponse (a verified operator row), never a raw body', () => {
    const reader = src.slice(src.indexOf('async function readIngressPolicy('), src.indexOf('const cachedPolicy ='))
    expect(reader).toContain('policy = policyFromPoolResponse(j)')
    expect(reader).not.toMatch(/parsePolicy\(/)
    const mode = src.slice(src.indexOf('async function ingressMode('), src.indexOf('const validateKey ='))
    expect(mode).toContain("if (policy?.mode === 'enforce' && !existsSync(RATCHET_FILE))")
  })
  test('MUST-FAIL: an ingress-originated hop runs with an EMPTY caller context (no re-attachment)', () => {
    expect(ingress).toContain('callerCtx.run({ key: null }, () => resolveHandler(pointer))')
  })
  test('the refusal body echoes no pointer field, only the shape and a fixed reason', () => {
    const refusal = ingress.slice(ingress.indexOf("return { error: 'unauthorized'"), ingress.indexOf("return { error: 'unauthorized'") + 400)
    expect(refusal).not.toMatch(/\bpointer\b|\braw\b/)
  })
})
