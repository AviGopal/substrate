// federation-probe-class-clears.test.ts — EVERY CLASS THE PROBE CAN FILE HAS A ROW THAT CAN CLOSE IT.
//
// WHAT IS JUDGED: scripts/substrate/federation-relay/federation-probe-tick.ts, read as source. A probe gap closes only
// on a PASS row that NAMES its class in `clears` (or `clearsAlso`); record() keeps those only on a pass. So a class
// that appears in some record() call's `cls` but in no call's `clears`/`clearsAlso` can be filed and never closed —
// the gap store only ever accumulates it. An earlier by-eye audit of every cls: against every clears: missed the
// ternary form `cls: ok ? undefined : '<class>'`, which left three classes in exactly that state. This test is that
// audit, run on every commit instead of remembered.
//
// HOW: a small tokenizer (strings, template literals, comments) finds every record(...) call and the expression bound
// to each cls / clears / clearsAlso key inside it; every string literal in that expression counts, so a literal and
// either branch of a ternary are all seen. A cls expression with no string literal (an identifier, a call) cannot be
// checked statically and fails the test by name rather than passing silently.
//
// MUST-FAIL: red on the parent of the fix (payload_corrupted, join_not_findable, leave_only_at_ttl have no clearing
// row); red if any one of their clears is removed. The parser's own controls run on fixed snippets below.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PROBE = resolve(ROOT, 'scripts/substrate/federation-relay/federation-probe-tick.ts')

type Tok = { k: 'str'; v: string } | { k: 'tpl' } | { k: 'id'; v: string } | { k: 'p'; v: string }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const n = src.length
  // Skips a template literal starting at src[i] === '`', including ${ ... } holes (which may nest strings/templates).
  const skipTemplate = (): void => {
    i++
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { i += 2; continue }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2
        let depth = 1
        while (i < n && depth > 0) {
          const c = src[i]!
          if (c === '`') { skipTemplate(); continue }
          if (c === "'" || c === '"') { readString(c); continue }
          if (c === '{') depth++
          else if (c === '}') depth--
          i++
        }
        continue
      }
      i++
    }
    i++
  }
  const readString = (q: string): string => {
    i++
    let v = ''
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { v += src[i + 1] ?? ''; i += 2; continue }
      v += src[i]
      i++
    }
    i++
    return v
  }
  while (i < n) {
    const c = src[i]!
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue }
    if (c === "'" || c === '"') { out.push({ k: 'str', v: readString(c) }); continue }
    if (c === '`') { skipTemplate(); out.push({ k: 'tpl' }); continue }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++
      out.push({ k: 'id', v: src.slice(i, j) })
      i = j
      continue
    }
    if (/\s/.test(c)) { i++; continue }
    // A regex literal is not tokenized specially; the probe's record() calls contain none, and a stray '/' is
    // harmless punctuation for the keys this test reads.
    out.push({ k: 'p', v: c })
    i++
  }
  return out
}

export interface ClassAudit {
  recordCalls: number
  filed: Map<string, number>     // class -> count of cls positions naming it
  cleared: Set<string>           // every class named in a clears / clearsAlso position
  uncheckable: string[]          // cls expressions with no string literal and not just `undefined`
}

export function auditClasses(src: string): ClassAudit {
  const t = tokenize(src)
  const audit: ClassAudit = { recordCalls: 0, filed: new Map(), cleared: new Set(), uncheckable: [] }
  const OPEN = new Set(['(', '[', '{'])
  const CLOSE = new Set([')', ']', '}'])
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i]!, b = t[i + 1]!
    if (!(a.k === 'id' && a.v === 'record' && b.k === 'p' && b.v === '(')) continue
    const prev = t[i - 1]
    if (prev && ((prev.k === 'id' && prev.v === 'function') || (prev.k === 'p' && prev.v === '.'))) continue
    audit.recordCalls++
    // The call's tokens, to its matching ')'.
    let depth = 0
    let end = i + 1
    for (; end < t.length; end++) {
      const x = t[end]!
      if (x.k === 'p' && OPEN.has(x.v)) depth++
      else if (x.k === 'p' && CLOSE.has(x.v)) { depth--; if (depth === 0) break }
    }
    const call = t.slice(i + 2, end)
    // Nesting depth of each token within the call's arguments: the opts object's own keys sit at depth 1.
    const at: number[] = []
    let cd = 0
    for (const x of call) {
      if (x.k === 'p' && CLOSE.has(x.v)) cd--
      at.push(cd)
      if (x.k === 'p' && OPEN.has(x.v)) cd++
    }
    for (let j = 0; j < call.length - 1; j++) {
      const key = call[j]!, colon = call[j + 1]!
      if (key.k !== 'id' || !(key.v === 'cls' || key.v === 'clears' || key.v === 'clearsAlso')) continue
      if (!(colon.k === 'p' && colon.v === ':')) continue
      // A key only counts as a property of the opts object itself (depth 1), never of a nested evidence/config object.
      const before = call[j - 1]
      if (at[j] !== 1 || !before || before.k !== 'p' || !(before.v === '{' || before.v === ',')) continue
      // The value expression: up to the next ',' '}' or ')' at its own depth.
      const expr: Tok[] = []
      let d = 0
      for (let m = j + 2; m < call.length; m++) {
        const x = call[m]!
        if (x.k === 'p' && OPEN.has(x.v)) d++
        else if (x.k === 'p' && CLOSE.has(x.v)) { if (d === 0) break; d-- }
        else if (x.k === 'p' && x.v === ',' && d === 0) break
        expr.push(x)
      }
      const literals = expr.filter((x): x is { k: 'str'; v: string } => x.k === 'str').map((x) => x.v)
      if (key.v === 'cls') {
        const onlyUndefined = expr.length === 1 && expr[0]!.k === 'id' && expr[0]!.v === 'undefined'
        if (literals.length === 0 && !onlyUndefined) {
          audit.uncheckable.push(expr.map((x) => ('v' in x ? x.v : '`…`')).join(' '))
        }
        for (const l of literals) audit.filed.set(l, (audit.filed.get(l) ?? 0) + 1)
      } else {
        for (const l of literals) audit.cleared.add(l)
      }
    }
  }
  return audit
}

const unclosable = (a: ClassAudit) => [...a.filed.keys()].filter((c) => !a.cleared.has(c)).sort()

describe('the parser (controls on fixed snippets)', () => {
  test('a literal cls with no clears is reported unclosable', () => {
    const a = auditClasses(`record('X', 'fail', { witness: 'probe', cls: 'alpha' })`)
    expect(a.recordCalls).toBe(1)
    expect(unclosable(a)).toEqual(['alpha'])
  })
  test('both ternary branches of cls are seen, and a ternary clears closes them', () => {
    const open = auditClasses(`record('X', ok ? 'pass' : 'fail', { cls: ok ? undefined : 'beta', evidence: { a: 1 } })
      record('Y', 'fail', { witness: 'probe', cls: ok ? 'gamma' : 'delta' })`)
    expect(unclosable(open)).toEqual(['beta', 'delta', 'gamma'])
    const closed = auditClasses(`record('X', ok ? 'pass' : 'fail', { cls: ok ? undefined : 'beta', clears: ok ? 'beta' : undefined })`)
    expect(unclosable(closed)).toEqual([])
  })
  test('clearsAlso counts; comments, nested evidence keys and the declaration do not', () => {
    const a = auditClasses(`
      function record(invariant: string, verdict: Verdict, opts: { cls?: string; clears?: string }) {}
      // record('Z', 'fail', { cls: 'in_a_comment' })
      record('A', 'pass', { witness: 'probe', clears: 'one', clearsAlso: 'two', evidence: { cls: 'nested_not_a_key' } })
      record('B', 'fail', { witness: 'probe', cls: 'one', evidence: { s: \`a \${'x'} b\` } })
      record('C', 'fail', { witness: 'probe', cls: 'two' })`)
    expect(a.recordCalls).toBe(3)
    expect([...a.filed.keys()].sort()).toEqual(['one', 'two'])
    expect(unclosable(a)).toEqual([])
  })
  test('a cls bound to an identifier is uncheckable, not silently passed', () => {
    const a = auditClasses(`record('X', 'fail', { cls: someClass })`)
    expect(a.uncheckable).toEqual(['someClass'])
  })
})

describe('federation-probe-tick.ts', () => {
  const audit = auditClasses(readFileSync(PROBE, 'utf8'))

  test('the parser saw the probe (a vacuous audit is not a pass)', () => {
    expect(audit.recordCalls).toBeGreaterThan(20)
    expect(audit.filed.size).toBeGreaterThan(10)
    // Known classes in each form: a plain literal, and the ternary form the earlier audit missed.
    expect(audit.filed.has('transport_unit_flapping')).toBe(true)
    expect(audit.filed.has('payload_corrupted')).toBe(true)
  })

  test('every cls is a literal the audit can read', () => {
    expect(audit.uncheckable).toEqual([])
  })

  test('every class a probe can fail with is named by some clears / clearsAlso', () => {
    expect(unclosable(audit)).toEqual([])
  })
})
