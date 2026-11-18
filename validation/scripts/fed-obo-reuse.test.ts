// fed-obo-reuse.test.ts: the sending transport mints one on-behalf-of token per caller, peer and shape for a burst of
// dials, and reuses a token for READS within its life; a write mints afresh (a key identity revokes writes nothing more).
//
// WHAT IS JUDGED: scripts/substrate/federation-relay/ingress-auth.ts makeOboMinter (identity-ask.ts beneath it).
// Hermetic: injected fetch and clock, placeholder credentials only. It imports only what the minter has always exported,
// so the legs run against a minter that mints on every dial too, and fail there by behaviour.
//
// MUST-FAILS: a burst of dials mints once; a read reuses a token until the reuse margin before its stated expiry; a
// write mints afresh (a key revoked between two writes gets no token on the second); a write burst still mints once;
// a refusal (403, 401, or an answer with no usable token) is kept a moment.
import { describe, expect, test } from 'bun:test'
import { makeOboMinter, OBO_TTL_SECONDS, oboAudience } from '../../scripts/substrate/federation-relay/ingress-auth'

const KEY = 'PLACEHOLDER-CALLER-KEY-0001'
const OTHER = 'PLACEHOLDER-OTHER-KEY-0002'
const PEER = '12D3KooWDestinationPlaceholderPeer'
const READ = { node: PEER, shape: 'record_read' }
const WRITE = { node: PEER, shape: 'record_write' }
const MARGIN_MS = 10_000 // the reuse margin, as a literal: the legs must not import anything new

// identity's mint answer: a new token per mint with its expiry stated, refused once `revoked` is set; released by the test
const identity = (t: { v: number }, o: { hold?: boolean } = {}) => {
  let n = 0
  let revoked = false
  const waiting: Array<() => void> = []
  const f = async (_url: string, init: any) => {
    n++
    if (o.hold) await new Promise<void>((r) => waiting.push(r))
    if (revoked) return { ok: false, status: 403, json: async () => ({ success: false }) }
    const expires_at = new Date(t.v + OBO_TTL_SECONDS * 1000).toISOString()
    return { ok: true, status: 200, json: async () => ({ success: true, data: { token: `tok-${n}-${JSON.parse(init.body).audience.shape}`, expires_at } }) }
  }
  return { f, mints: () => n, revoke: () => { revoked = true }, release: () => { for (const r of waiting.splice(0)) r() } }
}
const minter = (f: any, t: { v: number }) => makeOboMinter({ identityUrl: () => 'http://identity.invalid', actorKey: () => OTHER, fetchImpl: f, now: () => t.v })

describe('a burst of dials mints once; reads reuse a token within its life; writes mint afresh', () => {
  test('MUST-FAIL: a burst of read dials for one caller, peer and shape mints once', async () => {
    const t = { v: 1_000_000 }; const id = identity(t, { hold: true }); const mint = minter(id.f, t)
    const all = Promise.all([1, 2, 3, 4, 5].map(() => mint(KEY, READ)))
    await Bun.sleep(0); id.release()
    expect(new Set(await all)).toEqual(new Set(['tok-1-record_read']))
    expect(id.mints()).toBe(1)
  })
  test('MUST-FAIL: a read reuses its token until the margin before the stated expiry, then mints anew', async () => {
    const t = { v: 1_000_000 }; const id = identity(t); const mint = minter(id.f, t)
    expect(await mint(KEY, READ)).toBe('tok-1-record_read')
    t.v += OBO_TTL_SECONDS * 1000 - MARGIN_MS - 1
    expect(await mint(KEY, READ)).toBe('tok-1-record_read')
    t.v += 1
    expect(await mint(KEY, READ)).toBe('tok-2-record_read')
  })
  test('MUST-FAIL: a write burst still mints once', async () => {
    const t = { v: 1_000_000 }; const id = identity(t, { hold: true }); const mint = minter(id.f, t)
    const all = Promise.all([1, 2, 3].map(() => mint(KEY, WRITE)))
    await Bun.sleep(0); id.release()
    expect(new Set(await all)).toEqual(new Set(['tok-1-record_write']))
    expect(id.mints()).toBe(1)
  })
  // A guard, not a must-fail: the minter before this change minted on every dial, so a revoked key got no token there too.
  // What it pins is that reuse never reaches a write: a minter reusing write tokens fails it.
  test('a write mints afresh: a key revoked between two writes 1 s apart gets no token on the second, the unsuffixed write shape too (a guard)', async () => {
    const t = { v: 1_000_000 }; const id = identity(t); const mint = minter(id.f, t)
    const SIG = { node: PEER, shape: 'impulseSignatureConcept' }
    expect(await mint(KEY, WRITE)).toBe('tok-1-record_write')
    expect(await mint(KEY, SIG)).toBe('tok-2-impulseSignatureConcept')
    t.v += 1_000; id.revoke()
    expect(await mint(KEY, WRITE)).toBeNull()
    expect(await mint(KEY, SIG)).toBeNull()
    expect(id.mints()).toBe(4)
  })
  test('a doubtful shape (empty) counts as a write: it mints every time (a guard)', async () => {
    const t = { v: 1_000_000 }; const id = identity(t); const mint = minter(id.f, t)
    await mint(KEY, { node: PEER, shape: '' }); await mint(KEY, { node: PEER, shape: '' })
    expect(id.mints()).toBe(2)
  })
  test('a shape that is not a string counts as a write: it mints every time, and never throws (a guard)', async () => {
    for (const shape of [7, null, {}]) {
      const t = { v: 1_000_000 }; const id = identity(t); const mint = minter(id.f, t)
      const got = [await mint(KEY, { node: PEER, shape } as any), await mint(KEY, { node: PEER, shape } as any)]
      expect([JSON.stringify(shape), got.every((x) => typeof x === 'string'), id.mints()]).toEqual([JSON.stringify(shape), true, 2])
    }
  })
  test('MUST-FAIL: a read rides its token while a write by the same key mints afresh', async () => {
    const t = { v: 1_000_000 }; const id = identity(t); const mint = minter(id.f, t)
    await mint(KEY, READ); await mint(KEY, WRITE); await mint(KEY, READ); await mint(KEY, WRITE)
    expect(id.mints()).toBe(3) // one read mint reused, two write mints
  })
  test('MUST-FAIL: the reuse margin is 10 s (a guard on the value the legs use as a literal)', async () => {
    const m = await import('../../scripts/substrate/federation-relay/ingress-auth')
    expect((m as Record<string, unknown>).OBO_REUSE_MARGIN_MS).toBe(MARGIN_MS)
  })
})

describe('what is reused, and what is kept', () => {
  const answering = (t: { v: number }, o: { status?: number; expires?: boolean } = {}) => {
    let n = 0
    const f = async (_url: string, init: any) => {
      n++
      const status = o.status ?? 200
      const expires_at = o.expires === false ? undefined : new Date(t.v + OBO_TTL_SECONDS * 1000).toISOString()
      return { ok: status >= 200 && status < 300, status, json: async () => ({ success: true, data: { token: `tok-${n}-${JSON.parse(init.body).audience.shape}`, expires_at } }) }
    }
    return { f, mints: () => n }
  }
  test('a token whose expiry identity does not state is not reused (a guard)', async () => {
    const t = { v: 1_000_000 }; const id = answering(t, { expires: false }); const mint = minter(id.f, t)
    await mint(KEY, READ); await mint(KEY, READ)
    expect(id.mints()).toBe(2)
  })
  test('another caller, another peer or another shape mints its own token (a guard)', async () => {
    const t = { v: 1_000_000 }; const id = answering(t); const mint = minter(id.f, t)
    const got = [await mint(KEY, READ), await mint(OTHER, READ), await mint(KEY, { ...READ, node: '12D3KooWSelfPlaceholderPeer' }), await mint(KEY, { ...READ, shape: 'concept' })]
    expect(new Set(got).size).toBe(4)
    expect(id.mints()).toBe(4)
  })
  test('MUST-FAIL: a 403 or a 401 is kept a moment, then asked again', async () => {
    for (const status of [403, 401]) {
      const t = { v: 1_000_000 }; const id = answering(t, { status }); const mint = minter(id.f, t)
      expect(await mint(KEY, READ)).toBeNull(); expect(await mint(KEY, READ)).toBeNull()
      expect([status, id.mints()]).toEqual([status, 1])
      t.v += 5_000; await mint(KEY, READ)
      expect([status, id.mints()]).toEqual([status, 2])
    }
  })
  test('MUST-FAIL: a pointer whose type is not a string gets no audience, so no token is minted for it', () => {
    const address = '/dns4/relay.invalid/tcp/1/p2p/12D3KooWRelayPlaceholderPeer/p2p-circuit/p2p/' + PEER
    expect(oboAudience(address, { type: 'record_read' })).toEqual({ node: PEER, shape: 'record_read' })
    expect(oboAudience(address, { type: { shape: 'record_write' } })).toBeNull()
    expect(oboAudience(address, { type: 7 })).toBeNull()
    // no pointer at all names no shape either: no audience, and nothing thrown (the dial goes on with no credential)
    expect([oboAudience(address, null), oboAudience(address, undefined)]).toEqual([null, null])
  })
  test('MUST-FAIL: an answer with no usable token (the caller key echoed, or none) is kept a moment as a 403 is, then asked again', async () => {
    for (const token of [KEY, undefined, '']) {
      const t = { v: 1_000_000 }; let n = 0
      const f = async () => { n++; return { ok: true, status: 200, json: async () => ({ success: true, data: { token, expires_at: new Date(t.v + OBO_TTL_SECONDS * 1000).toISOString() } }) } }
      const mint = minter(f, t)
      expect(await mint(KEY, READ)).toBeNull(); expect(await mint(KEY, READ)).toBeNull()
      expect([String(token === KEY ? 'echoed' : token), n]).toEqual([String(token === KEY ? 'echoed' : token), 1])
      t.v += 5_000; await mint(KEY, READ)
      expect([String(token === KEY ? 'echoed' : token), n]).toEqual([String(token === KEY ? 'echoed' : token), 2])
    }
  })
  test('a 429, a 503 or no answer is not kept (a guard)', async () => {
    const t = { v: 1_000_000 }
    for (const status of [429, 503]) {
      const id = answering(t, { status }); const mint = minter(id.f, t)
      expect(await mint(KEY, READ)).toBeNull(); expect(await mint(KEY, READ)).toBeNull()
      expect([status, id.mints()]).toEqual([status, 2])
    }
    let thrown = 0
    const down = minter(async () => { thrown++; throw new Error('down') }, t)
    await down(KEY, READ); await down(KEY, READ)
    expect(thrown).toBe(2)
  })
})
